import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionManager } from '../connection-manager';
import { ClientEnv } from '../../shared';
import { MessageType } from '../../shared';
import { Claude } from '../../core/claude';

// connection-manager delegates process kills to Claude.killTree (process-group
// kill). Mock it here: unit tests use fake PIDs, and a real group
// signal aimed at a fake PID could hit an unrelated live process group on the
// test machine. Real-process coverage lives in kill-tree.integration.test.ts.
vi.mock('../../core/claude', () => ({
  Claude: { killTree: vi.fn() },
}));

function createMockWs(readyState = 1) {
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as import('ws').WebSocket;
}

describe('ConnectionManager', () => {
  let cm: ConnectionManager;

  beforeEach(() => {
    cm = new ConnectionManager();
    vi.useFakeTimers();
  });

  describe('subscribe / unsubscribe', () => {
    it('should subscribe connection to session', () => {
      const ws = createMockWs();
      const connId = cm.addConnection(ws);
      cm.subscribe(connId, 'sess-1');

      const client = cm.getClient(connId);
      expect(client?.subscribedSessionId).toBe('sess-1');
    });

    it('should unsubscribe from previous session when subscribing to new one', () => {
      const ws = createMockWs();
      const connId = cm.addConnection(ws);
      cm.subscribe(connId, 'sess-1');
      cm.subscribe(connId, 'sess-2');

      const client = cm.getClient(connId);
      expect(client?.subscribedSessionId).toBe('sess-2');
    });

    it('should be no-op when subscribing to same session', () => {
      const ws = createMockWs();
      const connId = cm.addConnection(ws);
      cm.subscribe(connId, 'sess-1');
      cm.subscribe(connId, 'sess-1'); // no-op
      expect(cm.getClient(connId)?.subscribedSessionId).toBe('sess-1');
    });

    it('should unsubscribe and set subscribedSessionId to null', () => {
      const ws = createMockWs();
      const connId = cm.addConnection(ws);
      cm.subscribe(connId, 'sess-1');
      cm.unsubscribe(connId);
      expect(cm.getClient(connId)?.subscribedSessionId).toBeNull();
    });
  });

  describe('broadcastToSession', () => {
    it('should send to all subscribers of a session', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const conn1 = cm.addConnection(ws1);
      const conn2 = cm.addConnection(ws2);
      cm.subscribe(conn1, 'sess-1');
      cm.subscribe(conn2, 'sess-1');

      cm.broadcastToSession('sess-1', 'TEST_EVENT', { data: 'hello' });

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });

    it('should exclude specified connection', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const conn1 = cm.addConnection(ws1);
      const conn2 = cm.addConnection(ws2);
      cm.subscribe(conn1, 'sess-1');
      cm.subscribe(conn2, 'sess-1');

      cm.broadcastToSession('sess-1', 'TEST_EVENT', {}, conn1);

      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });

    it('should be no-op for non-existent session', () => {
      cm.broadcastToSession('nonexistent', 'TEST_EVENT');
      // No exception
    });
  });

  describe('broadcastToAll', () => {
    it('should send to all connections', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      cm.addConnection(ws1);
      cm.addConnection(ws2);

      cm.broadcastToAll('GLOBAL_EVENT', { data: 'all' });

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });

    it('should not send to closed connections', () => {
      const wsOpen = createMockWs(1);
      const wsClosed = createMockWs(3); // CLOSED
      cm.addConnection(wsOpen);
      cm.addConnection(wsClosed);

      cm.broadcastToAll('EVENT');

      expect(wsOpen.send).toHaveBeenCalled();
      expect(wsClosed.send).not.toHaveBeenCalled();
    });
  });

  describe('shutdownAll', () => {
    it('should kill all session processes and close all connections', () => {
      const ws = createMockWs();
      cm.addConnection(ws);
      const mockProcess = { pid: 4242, kill: vi.fn() } as unknown as import('child_process').ChildProcess;
      cm.setProcess('sess-1', mockProcess);

      cm.shutdownAll();

      expect(Claude.killTree).toHaveBeenCalledWith(mockProcess, 'SIGTERM');
      expect(ws.close).toHaveBeenCalled();
    });
  });

  describe('session process management', () => {
    it('should set and get process for session', () => {
      const proc = { kill: vi.fn() } as unknown as import('child_process').ChildProcess;
      cm.getOrCreateSession('sess-1');
      cm.setProcess('sess-1', proc);
      expect(cm.getProcess('sess-1')).toBe(proc);
    });

    it('should return null for non-existent session process', () => {
      expect(cm.getProcess('nonexistent')).toBeNull();
    });
  });

  describe('buffer management', () => {
    it('should set and get buffer', () => {
      cm.getOrCreateSession('sess-1');
      cm.setBuffer('sess-1', 'partial data');
      expect(cm.getBuffer('sess-1')).toBe('partial data');
    });

    it('should return empty string for non-existent session buffer', () => {
      expect(cm.getBuffer('nonexistent')).toBe('');
    });
  });

  describe('getConnectionCount', () => {
    it('should return 0 when there are no connections', () => {
      expect(cm.getConnectionCount()).toBe(0);
    });

    it('should reflect the number of active connections', () => {
      cm.addConnection(createMockWs());
      cm.addConnection(createMockWs());
      expect(cm.getConnectionCount()).toBe(2);
    });

    it('should decrease when a connection is removed', () => {
      const connId = cm.addConnection(createMockWs());
      cm.addConnection(createMockWs());
      cm.removeConnection(connId);
      expect(cm.getConnectionCount()).toBe(1);
    });
  });

  describe('getConnectionStats', () => {
    it('classifies panelId connections as panels regardless of origin', () => {
      cm.addConnection(createMockWs(), ClientEnv.JETBRAINS, 'panel-1', 'http://localhost:63412');
      expect(cm.getConnectionStats()).toEqual({ total: 1, panels: 1, tunnels: 0, browsers: 0 });
    });

    it('classifies *.trycloudflare.com origins without panelId as tunnels', () => {
      cm.addConnection(createMockWs(), ClientEnv.BROWSER, null, 'https://demo-tunnel.trycloudflare.com');
      expect(cm.getConnectionStats()).toEqual({ total: 1, panels: 0, tunnels: 1, browsers: 0 });
    });

    it('classifies everything else as browsers (incl. missing origin)', () => {
      cm.addConnection(createMockWs(), ClientEnv.BROWSER, null, 'http://127.0.0.1:63412');
      cm.addConnection(createMockWs(), ClientEnv.BROWSER, null, null);
      expect(cm.getConnectionStats()).toEqual({ total: 2, panels: 0, tunnels: 0, browsers: 2 });
    });

    it('counts a mixed set and tracks removals', () => {
      const panel = cm.addConnection(createMockWs(), ClientEnv.JETBRAINS, 'panel-1', null);
      cm.addConnection(createMockWs(), ClientEnv.JETBRAINS, 'panel-2', null);
      cm.addConnection(createMockWs(), ClientEnv.BROWSER, null, 'https://x.trycloudflare.com');
      cm.addConnection(createMockWs(), ClientEnv.BROWSER, null, 'http://localhost:63412');
      expect(cm.getConnectionStats()).toEqual({ total: 4, panels: 2, tunnels: 1, browsers: 1 });

      cm.removeConnection(panel);
      expect(cm.getConnectionStats()).toEqual({ total: 3, panels: 1, tunnels: 1, browsers: 1 });
    });
  });

  describe('streaming flag / session counters', () => {
    it('counts sessions and streaming sessions', () => {
      cm.getOrCreateSession('sess-1');
      cm.getOrCreateSession('sess-2');
      expect(cm.getSessionCount()).toBe(2);
      expect(cm.getStreamingSessionCount()).toBe(0);

      cm.setStreaming('sess-1', true);
      expect(cm.getStreamingSessionCount()).toBe(1);

      cm.setStreaming('sess-1', false);
      expect(cm.getStreamingSessionCount()).toBe(0);
    });

    it('ignores setStreaming for an unknown session', () => {
      cm.setStreaming('nonexistent', true);
      expect(cm.getStreamingSessionCount()).toBe(0);
    });

    it('clears the flag on STREAM_END broadcast (process death safety net)', () => {
      const connId = cm.addConnection(createMockWs());
      cm.subscribe(connId, 'sess-1');
      cm.setStreaming('sess-1', true);
      expect(cm.getStreamingSessionCount()).toBe(1);

      cm.broadcastToSession('sess-1', MessageType.STREAM_END);
      expect(cm.getStreamingSessionCount()).toBe(0);
    });

    it('does not clear the flag on other broadcasts', () => {
      const connId = cm.addConnection(createMockWs());
      cm.subscribe(connId, 'sess-1');
      cm.setStreaming('sess-1', true);

      cm.broadcastToSession('sess-1', MessageType.CLI_EVENT, { type: 'assistant' });
      expect(cm.getStreamingSessionCount()).toBe(1);
    });
  });

  describe('keep-alive gate (idle shutdown)', () => {
    const IDLE_GRACE = 60_000;
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      exitSpy.mockClear();
    });

    afterEach(() => {
      exitSpy.mockRestore();
    });

    it('should idle-shutdown 60s after the last connection leaves (baseline)', () => {
      const connId = cm.addConnection(createMockWs());
      cm.removeConnection(connId);
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should not schedule idle shutdown while keep-alive is enabled', () => {
      cm.setKeepAlive(true);
      const connId = cm.addConnection(createMockWs());
      cm.removeConnection(connId);
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should cancel an already-armed timer when keep-alive is enabled', () => {
      const connId = cm.addConnection(createMockWs());
      cm.removeConnection(connId); // arms the timer
      cm.setKeepAlive(true);
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should arm the timer on a false push with zero connections (prewarm-leak fix)', () => {
      // Fresh manager, no /ws connection was ever added: removeConnection never
      // fires, so without this push the backend would linger forever.
      cm.setKeepAlive(false);
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should arm the timer when keep-alive is disabled at zero connections (keep-alive clamp)', () => {
      cm.setKeepAlive(true);
      cm.setKeepAlive(false);
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should not arm the timer when keep-alive is disabled with live connections', () => {
      cm.addConnection(createMockWs());
      cm.setKeepAlive(false);
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should cancel the setKeepAlive(false)-armed timer when a connection arrives', () => {
      cm.setKeepAlive(false); // arms (zero connections)
      cm.addConnection(createMockWs());
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should report the gate state via isKeepAlive', () => {
      expect(cm.isKeepAlive()).toBe(false);
      cm.setKeepAlive(true);
      expect(cm.isKeepAlive()).toBe(true);
      cm.setKeepAlive(false);
      expect(cm.isKeepAlive()).toBe(false);
    });

    it('should boot with the gate up when constructed for standalone mode', () => {
      // ws-server passes !isJetBrainsMode: a standalone backend never arms the
      // idle timer — the operator owns its lifetime (Ctrl+C graceful shutdown).
      const standalone = new ConnectionManager(true);
      expect(standalone.isKeepAlive()).toBe(true);

      const connId = standalone.addConnection(createMockWs());
      standalone.removeConnection(connId);
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should keep the JetBrains boot default (gate down) with the no-arg constructor', () => {
      const jetbrains = new ConnectionManager();
      expect(jetbrains.isKeepAlive()).toBe(false);

      const connId = jetbrains.addConnection(createMockWs());
      jetbrains.removeConnection(connId);
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('parent-closing fast shutdown (clean IDE exit)', () => {
    const IDLE_GRACE = 60_000;
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      exitSpy.mockClear();
    });

    afterEach(() => {
      exitSpy.mockRestore();
    });

    it('should shut down immediately when PARENT_CLOSING arrives with zero connections', () => {
      cm.setParentClosing();
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should wait for the last /ws client, then shut down immediately (JCEF ordering)', () => {
      // JCEF sockets close AFTER the notification: connection still up when
      // PARENT_CLOSING arrives, fast path must fire from removeConnection.
      // (the client must be a JCEF panel — a non-JCEF client would cancel
      // the fast path instead.)
      const connId = cm.addConnection(createMockWs(), ClientEnv.JETBRAINS, 'panel-1');
      cm.setParentClosing();
      expect(exitSpy).not.toHaveBeenCalled();

      cm.removeConnection(connId);
      // No timer advance: the shutdown is immediate, not the 60 s grace.
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should bypass the keep-alive gate (keep-alive backend, IDE exiting)', () => {
      cm.setKeepAlive(true);
      cm.setParentClosing();
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should cancel an already-armed idle timer and exit now', () => {
      const connId = cm.addConnection(createMockWs());
      cm.removeConnection(connId); // arms the 60 s timer
      cm.setParentClosing();
      expect(exitSpy).toHaveBeenCalledWith(0);
      // The armed timer was cleared by shutdownAll — advancing time must not
      // trigger a second shutdown pass.
      exitSpy.mockClear();
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should be idempotent (a second PARENT_CLOSING is a no-op)', () => {
      const connId = cm.addConnection(createMockWs(), ClientEnv.JETBRAINS, 'panel-1');
      cm.setParentClosing();
      cm.setParentClosing();
      expect(exitSpy).not.toHaveBeenCalled();
      cm.removeConnection(connId);
      expect(exitSpy).toHaveBeenCalledTimes(1);
    });

    it('should keep the 60 s grace on the crash path (no PARENT_CLOSING)', () => {
      // Control: without the notification the idle regime is untouched.
      const connId = cm.addConnection(createMockWs());
      cm.removeConnection(connId);
      expect(exitSpy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should report the flag via isParentClosing', () => {
      const connId = cm.addConnection(createMockWs(), ClientEnv.JETBRAINS, 'panel-1');
      expect(cm.isParentClosing()).toBe(false);
      cm.setParentClosing();
      expect(cm.isParentClosing()).toBe(true);
      cm.removeConnection(connId);
    });
  });

  describe('parent-closing with non-JCEF clients', () => {
    const IDLE_GRACE = 60_000;
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      exitSpy.mockClear();
    });

    afterEach(() => {
      exitSpy.mockRestore();
    });

    it('should not arm the fast path while a browser client is connected', () => {
      const browser = cm.addConnection(createMockWs(), ClientEnv.BROWSER, null, 'http://127.0.0.1:63412');
      cm.setParentClosing();
      expect(cm.isParentClosing()).toBe(false);

      // The browser leaving later gets the normal 60 s grace, not the fast exit.
      cm.removeConnection(browser);
      expect(exitSpy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should treat a tunnel client as non-JCEF too', () => {
      cm.addConnection(createMockWs(), ClientEnv.BROWSER, null, 'https://demo.trycloudflare.com');
      cm.setParentClosing();
      expect(cm.isParentClosing()).toBe(false);
    });

    it('should still fast-exit when only JCEF panels were connected', () => {
      const panel1 = cm.addConnection(createMockWs(), ClientEnv.JETBRAINS, 'panel-1');
      const panel2 = cm.addConnection(createMockWs(), ClientEnv.JETBRAINS, 'panel-2');
      cm.setParentClosing();
      expect(cm.isParentClosing()).toBe(true);

      cm.removeConnection(panel1);
      expect(exitSpy).not.toHaveBeenCalled();
      cm.removeConnection(panel2);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should clear the flag when a browser client survives the JCEF detachments', () => {
      const panel = cm.addConnection(createMockWs(), ClientEnv.JETBRAINS, 'panel-1');
      cm.setParentClosing();
      expect(cm.isParentClosing()).toBe(true);

      // A browser client connects after the notification (e.g. tunnel reconnect
      // racing the IDE shutdown), then the JCEF panel detaches.
      const browser = cm.addConnection(createMockWs(), ClientEnv.BROWSER, null, null);
      cm.removeConnection(panel);
      expect(cm.isParentClosing()).toBe(false);
      expect(exitSpy).not.toHaveBeenCalled();

      // From here the old regime applies: 60 s grace after the browser leaves.
      cm.removeConnection(browser);
      expect(exitSpy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should survive an F5 reconnect after the IDE exit', () => {
      // Backend outlived the IDE thanks to a browser client; the fast path was
      // never armed. A page refresh drops and re-opens the connection within
      // the grace — the backend must survive.
      const browser = cm.addConnection(createMockWs(), ClientEnv.BROWSER, null, null);
      cm.setParentClosing();

      cm.removeConnection(browser); // F5: connection drops, 60 s timer arms
      vi.advanceTimersByTime(2_000);
      cm.addConnection(createMockWs(), ClientEnv.BROWSER, null, null); // reconnect
      vi.advanceTimersByTime(IDLE_GRACE * 2);
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  describe('forced shutdown (PARENT_CLOSING force)', () => {
    const FORCE_WAIT = 1_500;
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      exitSpy.mockClear();
      vi.mocked(Claude.killTree).mockClear();
      vi.mocked(Claude.killTree).mockImplementation(() => undefined);
    });

    afterEach(() => {
      exitSpy.mockRestore();
    });

    function mockProcess(pid: number, exitCode: number | null = null) {
      return {
        pid,
        kill: vi.fn(),
        exitCode,
        signalCode: null,
      } as unknown as import('child_process').ChildProcess;
    }

    it('should shut down despite live clients: disconnect, SIGTERM, then SIGKILL survivors', async () => {
      const ws = createMockWs();
      cm.addConnection(ws, ClientEnv.BROWSER, null, null);
      const survivor = mockProcess(4242);
      cm.setProcess('sess-1', survivor);

      cm.setParentClosing(true);
      // Synchronous phase: clients disconnected, CLI trees SIGTERMed.
      expect(ws.close).toHaveBeenCalled();
      expect(Claude.killTree).toHaveBeenCalledWith(survivor, 'SIGTERM');
      expect(exitSpy).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(FORCE_WAIT + 1);
      expect(Claude.killTree).toHaveBeenCalledWith(survivor, 'SIGKILL');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should not SIGKILL a tree that exited within the escalation window', async () => {
      const survivor = mockProcess(4242);
      const graceful = mockProcess(4343);
      cm.setProcess('sess-1', survivor);
      cm.setProcess('sess-2', graceful);
      // The graceful tree reacts to the SIGTERM by exiting.
      vi.mocked(Claude.killTree).mockImplementation((proc, signal) => {
        if (signal === 'SIGTERM' && proc === graceful) {
          (graceful as { exitCode: number | null }).exitCode = 0;
        }
      });

      cm.setParentClosing(true);
      await vi.advanceTimersByTimeAsync(FORCE_WAIT + 1);

      expect(Claude.killTree).toHaveBeenCalledWith(survivor, 'SIGKILL');
      expect(Claude.killTree).not.toHaveBeenCalledWith(graceful, 'SIGKILL');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should ignore close events landing mid-escalation (no premature sync exit)', async () => {
      const connId = cm.addConnection(createMockWs(), ClientEnv.JETBRAINS, 'panel-1');
      cm.setProcess('sess-1', mockProcess(4242));

      cm.setParentClosing(true);
      // The ws.close() issued by the forced path emits a close event that the
      // ws-server relays as removeConnection — it must not trigger the
      // synchronous parent-closing exit before the SIGKILL escalation.
      cm.removeConnection(connId);
      expect(exitSpy).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(FORCE_WAIT + 1);
      expect(exitSpy).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should be idempotent (a second force notification is a no-op)', async () => {
      cm.setProcess('sess-1', mockProcess(4242));
      cm.setParentClosing(true);
      cm.setParentClosing(true);
      await vi.advanceTimersByTimeAsync(FORCE_WAIT + 1);
      expect(exitSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('pending editor context buffer', () => {
    it('should return the stashed payload on consume', () => {
      const payload = { absolutePath: '/abs/src/file.ts', relativePath: 'src/file.ts' };
      cm.setPendingEditorContext(payload);
      expect(cm.consumePendingEditorContext()).toEqual(payload);
    });

    it('should clear the buffer after a single consume', () => {
      cm.setPendingEditorContext({ absolutePath: '/abs/a.ts', relativePath: 'a.ts' });
      cm.consumePendingEditorContext();
      expect(cm.consumePendingEditorContext()).toBeNull();
    });

    it('should return null when nothing was stashed', () => {
      expect(cm.consumePendingEditorContext()).toBeNull();
    });

    it('should return null and clear after the 10s expiry window', () => {
      cm.setPendingEditorContext({ absolutePath: '/abs/a.ts', relativePath: 'a.ts' });
      vi.advanceTimersByTime(10_000 + 1);
      expect(cm.consumePendingEditorContext()).toBeNull();
    });

    it('should still return the payload just before expiry', () => {
      const payload = { absolutePath: '/abs/a.ts', relativePath: 'a.ts' };
      cm.setPendingEditorContext(payload);
      vi.advanceTimersByTime(9_999);
      expect(cm.consumePendingEditorContext()).toEqual(payload);
    });

    it('should overwrite an earlier pending payload with the latest one', () => {
      cm.setPendingEditorContext({ absolutePath: '/abs/old.ts', relativePath: 'old.ts' });
      const latest = { absolutePath: '/abs/new.ts', relativePath: 'new.ts' };
      cm.setPendingEditorContext(latest);
      expect(cm.consumePendingEditorContext()).toEqual(latest);
    });

    it('should replay a stashed payload to a newly added connection as EDITOR_CONTEXT', () => {
      const payload = { absolutePath: '/abs/src/file.ts', relativePath: 'src/file.ts', startLine: 10, endLine: 25 };
      cm.setPendingEditorContext(payload);

      const ws = createMockWs();
      cm.addConnection(ws);

      expect(ws.send).toHaveBeenCalledTimes(1);
      const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(sent.type).toBe(MessageType.EDITOR_CONTEXT);
      expect(sent.payload).toEqual(payload);
    });

    it('should consume the buffer on replay so the next connection gets nothing', () => {
      cm.setPendingEditorContext({ absolutePath: '/abs/a.ts', relativePath: 'a.ts' });
      cm.addConnection(createMockWs());

      const ws2 = createMockWs();
      cm.addConnection(ws2);
      expect(ws2.send).not.toHaveBeenCalled();
    });

    it('should not replay an expired buffer to a newly added connection', () => {
      cm.setPendingEditorContext({ absolutePath: '/abs/a.ts', relativePath: 'a.ts' });
      vi.advanceTimersByTime(10_000 + 1);

      const ws = createMockWs();
      cm.addConnection(ws);
      expect(ws.send).not.toHaveBeenCalled();
    });
  });
});
