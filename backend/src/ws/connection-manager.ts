import type { WebSocket } from 'ws';
import type { ChildProcess } from 'child_process';
import type { IPCMessage, NativeDropEntry } from '../core/types';
import { ClientEnv, MessageType } from '../shared';
import { Claude } from '../core/claude';

const SESSION_CLEANUP_GRACE_MS = 30_000;
const IDLE_SHUTDOWN_GRACE_MS = 60_000;
/**
 * Forced-shutdown escalation window (PARENT_CLOSING { force: true }):
 * how long the SIGTERMed CLI trees get to exit gracefully before the survivors
 * are SIGKILLed and the backend exits.
 */
const FORCE_SHUTDOWN_KILL_WAIT_MS = 1_500;
/**
 * How long an editor-context payload stays valid while waiting for a webview to
 * connect. The "Add to Claude" action can fire before the JCEF panel has opened
 * its /ws socket (cold start); we stash the payload and replay it to the first
 * connection that arrives, but only within this window so a stale selection from
 * minutes ago is never injected.
 */
const PENDING_EDITOR_CONTEXT_TTL_MS = 10_000;

/** Push message type carrying the IDE editor selection to the webview. */
export const EDITOR_CONTEXT_MESSAGE = MessageType.EDITOR_CONTEXT;

interface PendingEditorContext {
  payload: Record<string, unknown>;
  expiresAt: number;
}

interface SessionRecord {
  sessionId: string;
  process: ChildProcess | null;
  subscribers: Set<string>;
  buffer: string;
  workingDir: string;
  /**
   * True while a turn is in flight: set when a prompt is written to the CLI
   * stdin, cleared on the CLI `result` event (turn end) and on STREAM_END
   * (process death safety net). NOT the STREAM_START..STREAM_END window —
   * the CLI process is long-lived across turns, so that window only means
   * "process alive". Feeds the streaming-sessions counter (status endpoint,
   * future IDE exit-confirm modal).
   */
  streaming: boolean;
}

interface ClientRecord {
  subscribedSessionId: string | null;
  env: ClientEnv;
  /**
   * IDE panel that owns this webview connection (JetBrains mode only). Set from the
   * `panelId` query param that Kotlin embeds in the JCEF URL. Used to route panel-
   * scoped notifications (e.g. NATIVE_DROP) to the exact webview the user is looking
   * at, independent of sessionId which the webview generates itself.
   */
  panelId: string | null;
  /**
   * Native drop paths stashed by CefDragHandler.onDragEnter, waiting for the page-level
   * drop event to flush them. JCEF doesn't expose absolute paths on `dataTransfer` for
   * security reasons, so we receive the paths over the /rpc socket on drag-enter, hold
   * them here, and release them on NATIVE_DROP_FLUSH (which the webview fires from its
   * own `drop` handler). Cleared on flush and on disconnect.
   */
  nativeDropStash: NativeDropEntry[] | null;
  /**
   * `Origin` header of the WebSocket upgrade request, when present. Used only
   * to classify the connection type for status reporting: Remote Tunnel
   * clients arrive with a *.trycloudflare.com origin (already allowlisted by
   * ws-server's validateOrigin), local browsers with a localhost one.
   */
  origin: string | null;
}

/** Connection-count breakdown for the status endpoint / status-bar card. */
export interface ConnectionStats {
  total: number;
  /** JCEF IDE panels — connections carrying a `panelId` query param. */
  panels: number;
  /** Remote Tunnel clients — recognized by their *.trycloudflare.com origin. */
  tunnels: number;
  /** Everything else: plain (local) browsers. */
  browsers: number;
}

export class ConnectionManager {
  private connectionMap = new Map<string, WebSocket>();
  private clientMap = new Map<string, ClientRecord>();
  private sessionRegistry = new Map<string, SessionRecord>();
  private cleanupTimers = new Map<string, NodeJS.Timeout>();
  private idleShutdownTimer: NodeJS.Timeout | null = null;
  /**
   * Idle-shutdown gate ("keep backend running"). While true the backend never
   * schedules its zero-connection self-shutdown.
   *
   * The boot value comes from the constructor: a standalone backend
   * boots with the gate up and nothing ever lowers it — the operator owns the
   * process lifetime (visible terminal, Ctrl+C → graceful shutdown), so the
   * idle timer is never armed at all. In JetBrains mode the gate boots down
   * and is driven exclusively over the /rpc channel (SET_KEEP_ALIVE): Kotlin
   * pushes the desired state on every RPC (re)connect and on user toggle; the
   * parent watchdog flips it back to false when the IDE dies (keep-alive
   * clamp).
   */
  private keepAlive: boolean;
  /**
   * Set by the PARENT_CLOSING notification (clean IDE exit). Once true, the
   * idle grace is effectively zero: zero /ws connections — now or when the
   * last client detaches — mean an immediate shutdown instead of the 60 s
   * timer. Only holds while no non-JCEF client remains: a live
   * browser/tunnel client prevents it from being set, and one that survives
   * the JCEF detachments clears it — otherwise any transient /ws drop after
   * the IDE exit (page refresh, tunnel hiccup) would kill the backend and its
   * CLI sessions instantly, where the pre-fast-path regime gave a 60 s grace the
   * webview's auto-reconnect routinely beat. Never set on an IDE crash (that
   * path stays on ppid watchdog + grace) and never in standalone mode (no
   * Kotlin to send it).
   */
  private parentClosing = false;
  /**
   * True while the forced shutdown (PARENT_CLOSING { force: true }) is running
   * its async SIGTERM → wait → SIGKILL sequence. Guards removeConnection():
   * the ws.close() calls issued by the forced path emit close events that land
   * mid-wait, and without the guard they would trigger the synchronous
   * fast-shutdown path and exit before the SIGKILL escalation runs.
   */
  private forceShutdownInProgress = false;
  // Secondary index for O(1) panelId → connectionId resolution. Panel ↔ connection
  // is 1:1 (one JCEF browser per IDE panel, one /ws socket per browser), so this
  // map is always in sync with the panelId stored on each ClientRecord.
  private panelIdIndex = new Map<string, string>();
  // Editor context awaiting a webview connection. Replayed to the first
  // connection that arrives within PENDING_EDITOR_CONTEXT_TTL_MS, then cleared.
  private pendingEditorContext: PendingEditorContext | null = null;
  private nextId = 0;

  constructor(initialKeepAlive = false) {
    this.keepAlive = initialKeepAlive;
  }

  // ─── Connection lifecycle ───────────────────────────────────────────────────

  addConnection(
    ws: WebSocket,
    env: ClientEnv = ClientEnv.BROWSER,
    panelId: string | null = null,
    origin: string | null = null,
  ): string {
    const connectionId = `conn-${++this.nextId}-${Date.now()}`;
    this.connectionMap.set(connectionId, ws);
    this.clientMap.set(connectionId, { subscribedSessionId: null, env, panelId, nativeDropStash: null, origin });
    if (panelId) this.panelIdIndex.set(panelId, connectionId);
    this.cancelIdleShutdown('new connection received');
    console.error(
      '[node-backend]',
      `Connection added: ${connectionId} (env: ${env}, panelId: ${panelId ?? 'none'})`,
    );

    // Replay any editor context that arrived before this webview connected
    // (e.g. "Add to Claude" fired during JCEF cold start).
    const pendingEditorContext = this.consumePendingEditorContext();
    if (pendingEditorContext) {
      this.sendTo(connectionId, EDITOR_CONTEXT_MESSAGE, pendingEditorContext);
    }

    return connectionId;
  }

  // ─── Editor context buffer ──────────────────────────────────────────────────

  /**
   * Stash an editor-context payload to replay to the next webview connection.
   * Overwrites any earlier pending payload — only the latest selection matters.
   */
  setPendingEditorContext(payload: Record<string, unknown>): void {
    this.pendingEditorContext = {
      payload,
      expiresAt: Date.now() + PENDING_EDITOR_CONTEXT_TTL_MS,
    };
  }

  /**
   * Return the stashed editor-context payload and clear the buffer. Returns null
   * if nothing is stashed or the stash has expired (also clears in that case).
   */
  consumePendingEditorContext(): Record<string, unknown> | null {
    const pending = this.pendingEditorContext;
    this.pendingEditorContext = null;
    if (!pending) return null;
    if (Date.now() > pending.expiresAt) return null;
    return pending.payload;
  }

  setNativeDropStash(panelId: string, entries: NativeDropEntry[]): boolean {
    const connectionId = this.panelIdIndex.get(panelId);
    if (!connectionId) return false;
    const record = this.clientMap.get(connectionId);
    if (!record) return false;
    record.nativeDropStash = entries;
    return true;
  }

  takeNativeDropStash(connectionId: string): NativeDropEntry[] | null {
    const record = this.clientMap.get(connectionId);
    if (!record || !record.nativeDropStash) return null;
    const stash = record.nativeDropStash;
    record.nativeDropStash = null;
    return stash;
  }

  /**
   * Resolve a panelId (assigned by Kotlin on JCEF browser creation) back to its
   * webview connection. Panel ↔ connection is 1:1 since each panel hosts one
   * JCEF browser that opens one /ws socket.
   */
  getConnectionIdByPanelId(panelId: string): string | null {
    return this.panelIdIndex.get(panelId) ?? null;
  }

  removeConnection(connectionId: string): void {
    this.unsubscribe(connectionId);
    const record = this.clientMap.get(connectionId);
    if (record?.panelId) this.panelIdIndex.delete(record.panelId);
    this.connectionMap.delete(connectionId);
    this.clientMap.delete(connectionId);
    console.error('[node-backend]', `Connection removed: ${connectionId}`);

    // The forced-shutdown sequence closes every socket itself; their close
    // events must not re-enter the shutdown paths below mid-escalation.
    if (this.forceShutdownInProgress) return;

    if (this.connectionMap.size === 0) {
      // Fast path on a clean IDE exit: the JCEF sockets close AFTER the
      // PARENT_CLOSING notification arrives, so the flag check must live here
      // too, not only at notification time.
      if (this.parentClosing) {
        this.shutdownAfterParentClosed();
      } else {
        this.scheduleIdleShutdown();
      }
    } else if (this.parentClosing && this.hasNonJcefClient()) {
      // A browser/tunnel client survived the JCEF
      // detachments (e.g. it connected between the notification and the JCEF
      // close events). It must get the pre-fast-path regime back — with the flag
      // kept, its next transient drop (F5, tunnel hiccup) would kill the
      // backend instantly instead of giving the 60 s reconnect grace.
      this.parentClosing = false;
      console.error(
        '[node-backend]',
        'Parent-closing fast shutdown cancelled: a browser/tunnel client is still connected — normal idle regime restored',
      );
    }
  }

  /** True when any /ws client without a panelId (browser or tunnel) is connected. */
  private hasNonJcefClient(): boolean {
    for (const record of this.clientMap.values()) {
      if (record.panelId === null) return true;
    }
    return false;
  }

  // ─── Messaging ──────────────────────────────────────────────────────────────

  sendTo(connectionId: string, type: string, payload: Record<string, unknown> = {}): void {
    const ws = this.connectionMap.get(connectionId);
    if (!ws) return;

    const message: IPCMessage = {
      type,
      payload,
      timestamp: Date.now(),
    };

    try {
      if (ws.readyState === 1 /* WebSocket.OPEN */) {
        ws.send(JSON.stringify(message));
      }
    } catch {
      // send failure — will be cleaned up on disconnect
    }
  }

  broadcastToSession(
    sessionId: string,
    type: string,
    payload: Record<string, unknown> = {},
    excludeConnectionId?: string,
  ): void {
    const session = this.sessionRegistry.get(sessionId);
    if (!session) return;

    // Safety net for the turn-in-flight flag: STREAM_END fires on every CLI
    // process death path (close, spawn error, WSL mismatch), where no `result`
    // event will ever arrive to clear the flag.
    if (type === MessageType.STREAM_END) {
      session.streaming = false;
    }

    const message: IPCMessage = {
      type,
      payload,
      timestamp: Date.now(),
    };
    const data = JSON.stringify(message);

    for (const connId of session.subscribers) {
      if (connId === excludeConnectionId) continue;
      const ws = this.connectionMap.get(connId);
      if (!ws) continue;

      try {
        if (ws.readyState === 1 /* WebSocket.OPEN */) {
          ws.send(data);
        }
      } catch {
        // send failure — will be cleaned up on disconnect
      }
    }
  }

  broadcastToAll(type: string, payload: Record<string, unknown> = {}): void {
    const message: IPCMessage = {
      type,
      payload,
      timestamp: Date.now(),
    };
    const data = JSON.stringify(message);

    for (const [, ws] of this.connectionMap) {
      try {
        if (ws.readyState === 1 /* WebSocket.OPEN */) {
          ws.send(data);
        }
      } catch {
        // send failure — will be cleaned up on disconnect
      }
    }
  }

  // ─── Subscription (Pub/Sub) ─────────────────────────────────────────────────

  subscribe(connectionId: string, sessionId: string): void {
    const client = this.clientMap.get(connectionId);
    // Already subscribed to the same session — no-op
    if (client?.subscribedSessionId === sessionId) {
      return;
    }

    // Unsubscribe from any DIFFERENT session first
    this.unsubscribe(connectionId);

    const session = this.getOrCreateSession(sessionId);
    session.subscribers.add(connectionId);

    // Cancel pending cleanup if reconnecting within grace period
    const pendingTimer = this.cleanupTimers.get(sessionId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.cleanupTimers.delete(sessionId);
      console.error(
        '[node-backend]',
        `Cancelled cleanup timer for session ${sessionId} (subscriber reconnected)`,
      );
    }

    if (client) {
      client.subscribedSessionId = sessionId;
    }

    console.error(
      '[node-backend]',
      `${connectionId} subscribed to session ${sessionId} (subscribers: ${session.subscribers.size})`,
    );
  }

  unsubscribe(connectionId: string): void {
    const client = this.clientMap.get(connectionId);
    if (!client?.subscribedSessionId) return;

    const sessionId = client.subscribedSessionId;
    const session = this.sessionRegistry.get(sessionId);

    if (session) {
      session.subscribers.delete(connectionId);
      console.error(
        '[node-backend]',
        `${connectionId} unsubscribed from session ${sessionId} (subscribers: ${session.subscribers.size})`,
      );

      if (session.subscribers.size === 0) {
        console.error(
          '[node-backend]',
          `Session ${sessionId} has no subscribers, scheduling cleanup in ${SESSION_CLEANUP_GRACE_MS}ms`,
        );
        const timer = setTimeout(() => {
          this.cleanupTimers.delete(sessionId);
          const currentSession = this.sessionRegistry.get(sessionId);
          if (currentSession && currentSession.subscribers.size === 0) {
            this.cleanupSession(sessionId);
          }
        }, SESSION_CLEANUP_GRACE_MS);
        this.cleanupTimers.set(sessionId, timer);
      }
    }

    client.subscribedSessionId = null;
  }

  // ─── Accessors ──────────────────────────────────────────────────────────────

  getConnectionCount(): number {
    return this.connectionMap.size;
  }

  /** Connection-count breakdown by client type (status endpoint / status-bar card). */
  getConnectionStats(): ConnectionStats {
    const stats: ConnectionStats = { total: 0, panels: 0, tunnels: 0, browsers: 0 };
    for (const record of this.clientMap.values()) {
      stats.total++;
      if (record.panelId !== null) {
        stats.panels++;
      } else if (record.origin?.endsWith('.trycloudflare.com')) {
        stats.tunnels++;
      } else {
        stats.browsers++;
      }
    }
    return stats;
  }

  getSessionCount(): number {
    return this.sessionRegistry.size;
  }

  /** Number of sessions with a turn in flight (see SessionRecord.streaming). */
  getStreamingSessionCount(): number {
    let count = 0;
    for (const session of this.sessionRegistry.values()) {
      if (session.streaming) count++;
    }
    return count;
  }

  /**
   * Flip the per-session turn-in-flight flag. claude-process sets it true
   * after writing a prompt to the CLI stdin and false on the `result` event;
   * broadcastToSession clears it on STREAM_END as the process-death safety net.
   */
  setStreaming(sessionId: string, streaming: boolean): void {
    const session = this.sessionRegistry.get(sessionId);
    if (session) session.streaming = streaming;
  }

  getClient(connectionId: string): ClientRecord | undefined {
    return this.clientMap.get(connectionId);
  }

  getClientEnv(connectionId: string): ClientEnv {
    return this.clientMap.get(connectionId)?.env ?? ClientEnv.BROWSER;
  }

  getSession(sessionId: string): SessionRecord | undefined {
    return this.sessionRegistry.get(sessionId);
  }

  getOrCreateSession(sessionId: string, workingDir?: string): SessionRecord {
    let session = this.sessionRegistry.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        process: null,
        subscribers: new Set(),
        buffer: '',
        workingDir: workingDir ?? '',
        streaming: false,
      };
      this.sessionRegistry.set(sessionId, session);
    }
    return session;
  }

  // ─── Process accessors ─────────────────────────────────────────────────────

  setProcess(sessionId: string, proc: ChildProcess | null): void {
    const session = this.getOrCreateSession(sessionId);
    session.process = proc;
  }

  getProcess(sessionId: string): ChildProcess | null {
    return this.sessionRegistry.get(sessionId)?.process ?? null;
  }

  setBuffer(sessionId: string, buffer: string): void {
    const session = this.sessionRegistry.get(sessionId);
    if (session) {
      session.buffer = buffer;
    }
  }

  getBuffer(sessionId: string): string {
    return this.sessionRegistry.get(sessionId)?.buffer ?? '';
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  /**
   * Kill-sweep over every live session CLI tree. shutdownAll uses it with
   * SIGTERM (graceful path); the process 'exit' hook in server.ts uses it with
   * SIGKILL as the last-resort orphan guard, so it must stay synchronous —
   * 'exit' handlers cannot await.
   */
  killAllSessionProcesses(signal: NodeJS.Signals): number {
    let killed = 0;
    for (const session of this.sessionRegistry.values()) {
      if (session.process) {
        Claude.killTree(session.process, signal);
        killed++;
      }
    }
    return killed;
  }

  shutdownAll(): void {
    // Clear all pending cleanup timers
    for (const timer of this.cleanupTimers.values()) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();

    this.cancelIdleShutdown('shutting down');

    const killedSessions = this.killAllSessionProcesses('SIGTERM');
    let closedConnections = 0;

    for (const ws of this.connectionMap.values()) {
      ws.close();
      closedConnections++;
    }

    this.sessionRegistry.clear();
    this.connectionMap.clear();
    this.clientMap.clear();
    this.panelIdIndex.clear();

    console.error(
      '[node-backend]',
      `Shutdown: killed ${killedSessions} session(s), closed ${closedConnections} connection(s)`,
    );
  }

  /**
   * Toggle the idle-shutdown gate. Enabling cancels any armed timer. Disabling
   * restores the normal regime — and, when there are no /ws connections at that
   * moment, arms the timer immediately: removeConnection() only fires on a
   * connection that existed, so a backend that never received one (eager start,
   * prewarm) would otherwise linger forever.
   */
  setKeepAlive(enabled: boolean): void {
    // No early return on an unchanged value: the initial state is false, yet the
    // very first SET_KEEP_ALIVE(false) push must still arm the timer below when
    // the backend has no /ws connections (the eager-start/prewarm case).
    if (this.keepAlive !== enabled) {
      console.error('[node-backend]', `Keep-alive ${enabled ? 'enabled' : 'disabled'}`);
    }
    this.keepAlive = enabled;

    if (enabled) {
      this.cancelIdleShutdown('keep-alive enabled');
    } else if (this.connectionMap.size === 0) {
      this.scheduleIdleShutdown();
    }
  }

  isKeepAlive(): boolean {
    return this.keepAlive;
  }

  /**
   * Fast-shutdown path for a CLEAN IDE exit.
   * Kotlin sends PARENT_CLOSING from AppLifecycleListener.appWillBeClosed —
   * i.e. only when the exit is certain — and the backend then treats zero /ws
   * connections as "shut down right now" instead of waiting the 60 s idle
   * grace: immediately when no client is connected, or from
   * removeConnection() when the last one detaches (JCEF sockets close AFTER
   * the notification). Bypasses the keep-alive gate — the parent the gate was
   * held up for is going away. An IDE crash never sends this; that path
   * deliberately stays on ppid watchdog + grace.
   *
   * The fast path applies only while no non-JCEF client
   * remains. A live browser/tunnel client — now, or surviving the JCEF
   * detachments — keeps/restores the pre-fast-path regime (60 s idle grace, gate
   * driven by the ppid watchdog), so a page refresh or tunnel hiccup after
   * the IDE exit cannot kill the backend.
   *
   * `force: true` (the user's explicit "Exit" choice in the exit-confirm
   * dialog) means "close everything now": live clients are NOT a keep-alive
   * factor — disconnect them all, SIGTERM every CLI tree, give the survivors
   * a short window, SIGKILL them, exit. Runs asynchronously (see
   * shutdownForced); the synchronous shutdownAll stays untouched for the
   * 'exit' hook in server.ts.
   */
  setParentClosing(force = false): void {
    if (force) {
      this.parentClosing = true;
      void this.shutdownForced();
      return;
    }
    if (this.parentClosing) return;
    if (this.hasNonJcefClient()) {
      console.error(
        '[node-backend]',
        'Parent closing cleanly, but a browser/tunnel client is connected — keeping the normal idle regime (no fast shutdown)',
      );
      return;
    }
    this.parentClosing = true;
    console.error(
      '[node-backend]',
      'Parent closing cleanly — immediate shutdown once no /ws client remains',
    );
    if (this.connectionMap.size === 0) {
      this.shutdownAfterParentClosed();
    }
  }

  isParentClosing(): boolean {
    return this.parentClosing;
  }

  private shutdownAfterParentClosed(): void {
    console.error(
      '[node-backend]',
      'Parent closed cleanly and no /ws clients remain. Shutting down now.',
    );
    this.shutdownAll();
    process.exit(0);
  }

  /**
   * Forced shutdown (PARENT_CLOSING { force: true }): the user chose
   * "Exit" knowing sessions are streaming, so live clients are deliberately
   * not a keep-alive factor. Disconnect every client, SIGTERM every CLI tree,
   * wait FORCE_SHUTDOWN_KILL_WAIT_MS for them to exit, SIGKILL the survivors,
   * exit. Asynchronous by necessity (the wait); the synchronous shutdownAll()
   * stays as-is for the process 'exit' hook in server.ts, which cannot await.
   */
  private async shutdownForced(): Promise<void> {
    if (this.forceShutdownInProgress) return;
    this.forceShutdownInProgress = true;

    for (const timer of this.cleanupTimers.values()) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();
    this.cancelIdleShutdown('shutting down (forced)');

    let closedConnections = 0;
    for (const ws of this.connectionMap.values()) {
      ws.close();
      closedConnections++;
    }
    this.connectionMap.clear();
    this.clientMap.clear();
    this.panelIdIndex.clear();

    const procs = [...this.sessionRegistry.values()]
      .map((session) => session.process)
      .filter((proc): proc is ChildProcess => proc !== null);
    for (const proc of procs) {
      Claude.killTree(proc, 'SIGTERM');
    }
    console.error(
      '[node-backend]',
      `Forced shutdown (user chose Exit): closed ${closedConnections} connection(s), ` +
        `SIGTERMed ${procs.length} CLI tree(s), escalating to SIGKILL in ${FORCE_SHUTDOWN_KILL_WAIT_MS}ms`,
    );

    await new Promise((resolve) => setTimeout(resolve, FORCE_SHUTDOWN_KILL_WAIT_MS));

    let escalated = 0;
    for (const proc of procs) {
      if (proc.exitCode === null && proc.signalCode === null) {
        Claude.killTree(proc, 'SIGKILL');
        escalated++;
      }
    }
    // Clear the registry so the 'exit' hook's SIGKILL sweep doesn't re-signal
    // trees this path already handled.
    this.sessionRegistry.clear();
    console.error(
      '[node-backend]',
      `Forced shutdown complete: SIGKILLed ${escalated} surviving CLI tree(s). Exiting.`,
    );
    process.exit(0);
  }

  private scheduleIdleShutdown(): void {
    if (this.keepAlive) return;
    if (this.idleShutdownTimer !== null) return;

    console.error(
      '[node-backend]',
      `No active connections. Idle shutdown scheduled in ${IDLE_SHUTDOWN_GRACE_MS}ms`,
    );
    this.idleShutdownTimer = setTimeout(() => {
      console.error('[node-backend]', 'Idle shutdown grace period elapsed. Shutting down.');
      // The timer has fired — null it out so shutdownAll()'s cancelIdleShutdown()
      // no-ops instead of logging a misleading "timer cancelled" line.
      this.idleShutdownTimer = null;
      this.shutdownAll();
      process.exit(0);
    }, IDLE_SHUTDOWN_GRACE_MS);
  }

  private cancelIdleShutdown(reason: string): void {
    if (this.idleShutdownTimer === null) return;

    clearTimeout(this.idleShutdownTimer);
    this.idleShutdownTimer = null;
    console.error('[node-backend]', `Idle shutdown timer cancelled (${reason})`);
  }

  private cleanupSession(sessionId: string): void {
    const session = this.sessionRegistry.get(sessionId);
    if (!session) return;

    if (session.process) {
      console.error(
        '[node-backend]',
        `Killing process for session ${sessionId} (PID: ${session.process.pid})`,
      );
      Claude.killTree(session.process);
      session.process = null;
    }

    this.sessionRegistry.delete(sessionId);
    console.error('[node-backend]', `Session ${sessionId} cleaned up`);
  }
}
