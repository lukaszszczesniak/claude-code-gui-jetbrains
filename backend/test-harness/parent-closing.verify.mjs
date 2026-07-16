#!/usr/bin/env node
/**
 * PARENT_CLOSING verification: fast backend shutdown on a CLEAN IDE exit,
 * with the non-JCEF-client correction and the forced variant.
 * Kotlin sends a PARENT_CLOSING JSON-RPC notification from
 * AppLifecycleListener.appWillBeClosed; the backend then exits the moment it
 * has no /ws clients (immediately, or when the last one detaches — JCEF
 * sockets close AFTER the notification) instead of waiting the 60 s idle
 * grace — but only while no browser/tunnel client remains: a surviving
 * non-JCEF client clears the fast path and restores the normal idle regime.
 * PARENT_CLOSING { force: true } (the user's explicit "Exit" choice) shuts
 * everything down immediately, live clients included (SIGTERM → ~1.5 s →
 * SIGKILL stragglers). An IDE *crash* never sends the notification and must
 * stay on the ppid-watchdog + 60 s grace path.
 *
 * Scripted, NO token burn — same fake-CLI + fake-parent approach as
 * backend-lifecycle.verify.mjs, isolated $HOME per scenario, scratch ports 19850+ (never the
 * real 19836, disjoint from the lifecycle harness's 19840+). Scenarios run CONCURRENTLY (the
 * control scenarios sit through the full 60 s grace).
 *
 * Scenarios:
 *   S1 clean exit, JCEF ordering — JCEF /ws client (panelId) attached,
 *      PARENT_CLOSING over /rpc (client survives the notification, as JCEF
 *      does), then the client disconnects → backend exits FAST (seconds, not
 *      the 60 s grace).
 *   S2 clean exit, no clients — PARENT_CLOSING with zero /ws clients →
 *      immediate exit.
 *   S3 gate bypass — keep-alive ON + PARENT_CLOSING, no clients →
 *      immediate exit (the gate's parent is going away).
 *   S4 crash control — keep-alive ON, SIGKILL the parent, NO notification →
 *      backend still alive at +30 s (no fast path) and exits only after the
 *      watchdog poll + full idle grace (unchanged crash regime).
 *   S5 live-client promise — PARENT_CLOSING with a live browser
 *      client → backend survives well past the grace while the client stays;
 *      once the client leaves, the OLD regime applies: still alive well into
 *      the 60 s grace, exit only after it elapses (the uncorrected fast path asserted an
 *      immediate exit — that was the F5-killing regression).
 *   S6 flag clearing + F5 reconnect — JCEF panel at notification time (flag
 *      armed), a browser client connects after it, the panel detaches → the
 *      backend logs the fast-path cancellation; then the browser drops and
 *      reconnects (F5) → the backend survives.
 *   S7 forced shutdown — live browser client + a CLI session whose fake CLI
 *      IGNORES SIGTERM; PARENT_CLOSING { force: true } → backend exits within
 *      seconds despite the client, and the CLI tree dies via the SIGKILL
 *      escalation.
 *
 * Usage: node backend/test-harness/parent-closing.verify.mjs
 * Artifacts land in $TMPDIR/parent-closing-verify/.
 */
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(new URL('../package.json', import.meta.url));
const WebSocket = require('ws');

const BASE_PORT = Number(process.env.E7_PORT ?? 19850);
const ROOT = join(process.env.TMPDIR || os.tmpdir(), 'parent-closing-verify');
const BACKEND = fileURLToPath(new URL('../dist/backend.mjs', import.meta.url));

const IDLE_GRACE_MS = 60_000;
const WATCHDOG_POLL_MS = 10_000;
// The fast path is "immediate": allow a few seconds of scheduling/log slack.
const FAST_EXIT_MS = 8_000;
// Crash-path allowance: grace + watchdog poll + scheduling slack.
const EXIT_ALLOWANCE_MS = IDLE_GRACE_MS + WATCHDOG_POLL_MS + 15_000;
// "Still alive past the grace" probe point (S5).
const SURVIVE_PROBE_MS = IDLE_GRACE_MS + 15_000;

const results = [];
let failed = false;

function report(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitUntil(cond, timeoutMs, what) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await cond()) return true;
    await delay(200);
  }
  throw new Error(`timeout waiting for: ${what}`);
}

// ── Per-scenario context (same shape as backend-lifecycle.verify) ───────────────────────────

const contexts = [];

async function startContext(name, port, { cliIgnoresSigterm = false } = {}) {
  const root = join(ROOT, name);
  const home = join(root, 'home');
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(home, '.claude-code-gui'), { recursive: true });
  mkdirSync(join(root, 'bin'), { recursive: true });
  mkdirSync(join(root, 'proj'), { recursive: true });

  const fakeCli = join(root, 'bin', 'claude');
  // The SIGTERM-ignoring variant proves the forced shutdown's SIGKILL
  // escalation: such a CLI can only die from the SIGKILL pass.
  const termTrap = cliIgnoresSigterm
    ? `trap 'echo "SIGTERM ignored pid=$$" >> "$log"' TERM`
    : `trap 'echo "SIGTERM pid=$$" >> "$log"; exit 0' TERM`;
  writeFileSync(fakeCli, `#!/bin/bash
log="\${FAKE_CLI_LOG:?}"
echo "started pid=$$ args=$*" >> "$log"
${termTrap}
while true; do sleep 1; done
`);
  chmodSync(fakeCli, 0o755);
  writeFileSync(
    join(home, '.claude-code-gui', 'settings.js'),
    `export default {\n  cliPath: ${JSON.stringify(fakeCli)},\n};\n`,
  );

  const fakeParent = join(root, 'fake-parent.cjs');
  writeFileSync(fakeParent, `
const { spawn } = require('child_process');
const child = spawn(process.execPath, [process.argv[2]], { stdio: ['ignore', 'inherit', 'inherit'] });
console.log('BACKEND_PID:' + child.pid);
setInterval(() => {}, 1000); // stay alive until killed
`);

  const parent = spawn(process.execPath, [fakeParent, BACKEND], {
    env: {
      ...process.env,
      HOME: home,
      PORT: String(port),
      JETBRAINS_MODE: 'true',
      FAKE_CLI_LOG: join(root, 'fake-cli.log'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const ctx = { name, port, root, parent, out: '', err: '', backendPid: null, cliLog: join(root, 'fake-cli.log') };
  parent.stdout.on('data', (d) => (ctx.out += d.toString()));
  parent.stderr.on('data', (d) => (ctx.err += d.toString()));
  contexts.push(ctx);

  await waitUntil(() => /BACKEND_PID:(\d+)/.test(ctx.out), 10_000, `${name} backend pid`);
  ctx.backendPid = Number(/BACKEND_PID:(\d+)/.exec(ctx.out)[1]);
  await waitUntil(() => ctx.out.includes(`PORT:${port}`), 15_000, `${name} PORT line`);
  return ctx;
}

function openWs(port, query = '') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws${query}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

/**
 * Send a Kotlin-style JSON-RPC notification over /rpc. Errors after the frame
 * is flushed are swallowed — the backend may legitimately exit the moment a
 * PARENT_CLOSING notification lands (zero-client case).
 */
function pushNotification(port, method, params = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/rpc`);
    ws.on('open', () => {
      ws.on('error', () => {}); // post-send errors are expected on fast exit
      ws.send(JSON.stringify({ jsonrpc: '2.0', method, params }));
      setTimeout(() => {
        try {
          ws.close();
        } catch {
          // Peer already gone
        }
        resolve();
      }, 300);
    });
    ws.on('error', reject);
  });
}

/**
 * Connect to /ws and SEND_MESSAGE so the backend spawns a fake-CLI session
 * (same shape as cli-process-tree.verify's driveSession). Resolves with the open socket
 * once the backend acknowledges the stream.
 */
function driveSession(port, sessionId, workingDir) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const timer = setTimeout(() => reject(new Error('ws drive timeout')), 10_000);
    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          type: 'SEND_MESSAGE',
          requestId: `harness-${sessionId}`,
          timestamp: Date.now(),
          payload: {
            content: 'force-path probe',
            workingDir,
            sessionId,
            isNewSession: true,
            inputMode: 'text',
          },
        }),
      );
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ACK' || msg.type === 'STREAM_START') {
        clearTimeout(timer);
        resolve(ws);
      }
    });
    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** First fake-CLI pid recorded in the context's log, or null. */
function firstCliPid(ctx) {
  try {
    const started = readFileSync(ctx.cliLog, 'utf8')
      .split('\n')
      .find((line) => line.startsWith('started'));
    return started ? Number(/pid=(\d+)/.exec(started)[1]) : null;
  } catch {
    return null;
  }
}

// ── Scenarios ────────────────────────────────────────────────────────────────

async function s1_cleanExitJcefOrdering(port) {
  const ctx = await startContext('s1', port);
  const ws = await openWs(port, '?env=jetbrains&panelId=harness-panel');
  await delay(500);

  await pushNotification(port, 'PARENT_CLOSING');
  await waitUntil(() => ctx.err.includes('Parent closing cleanly'), 5_000, 'S1 notification log');
  await delay(2_000);
  report('S1 backend still up while the JCEF client is attached', pidAlive(ctx.backendPid));

  ws.close();
  const start = Date.now();
  await waitUntil(() => !pidAlive(ctx.backendPid), FAST_EXIT_MS, 'S1 fast exit');
  const elapsed = Date.now() - start;
  report('S1 exit is immediate after the last client detaches (JCEF ordering)', true, `${(elapsed / 1000).toFixed(1)}s`);
  report('S1 fast-shutdown log present', ctx.err.includes('Shutting down now'));
}

async function s2_cleanExitNoClients(port) {
  const ctx = await startContext('s2', port);
  await delay(500);

  const start = Date.now();
  await pushNotification(port, 'PARENT_CLOSING');
  await waitUntil(() => !pidAlive(ctx.backendPid), FAST_EXIT_MS, 'S2 immediate exit');
  const elapsed = Date.now() - start;
  report('S2 zero-client backend exits immediately on PARENT_CLOSING', true, `${(elapsed / 1000).toFixed(1)}s`);
  report('S2 notification log present', ctx.err.includes('Parent closing cleanly'));
}

async function s3_gateBypass(port) {
  const ctx = await startContext('s3', port);
  await pushNotification(port, 'SET_KEEP_ALIVE', { enabled: true });
  await delay(500);
  report('S3 gate log present before the exit', ctx.err.includes('Keep-alive enabled'));

  const start = Date.now();
  await pushNotification(port, 'PARENT_CLOSING');
  await waitUntil(() => !pidAlive(ctx.backendPid), FAST_EXIT_MS, 'S3 immediate exit');
  const elapsed = Date.now() - start;
  report('S3 PARENT_CLOSING bypasses the keep-alive gate (keep-alive backend)', true, `${(elapsed / 1000).toFixed(1)}s`);
}

async function s4_crashControl(port) {
  const ctx = await startContext('s4', port);
  await pushNotification(port, 'SET_KEEP_ALIVE', { enabled: true });
  await delay(500);

  process.kill(ctx.parent.pid, 'SIGKILL');
  const start = Date.now();
  await delay(30_000);
  report('S4 crash path has NO fast exit (backend alive 30 s after parent SIGKILL)', pidAlive(ctx.backendPid));

  await waitUntil(() => !pidAlive(ctx.backendPid), EXIT_ALLOWANCE_MS, 'S4 crash-path exit');
  const elapsed = Date.now() - start;
  report(
    'S4 crash path unchanged: exit only after watchdog + full idle grace',
    elapsed >= IDLE_GRACE_MS - 2_000,
    `${Math.round(elapsed / 1000)}s`,
  );
  report('S4 watchdog log present', ctx.err.includes('died'));
  report('S4 no parent-closing log on the crash path', !ctx.err.includes('Parent closing cleanly'));
}

async function s5_browserClientPromise(port) {
  const ctx = await startContext('s5', port);
  const ws = await openWs(port); // plain browser client (no panelId)
  await delay(500);

  await pushNotification(port, 'PARENT_CLOSING');
  await waitUntil(
    () => ctx.err.includes('keeping the normal idle regime'),
    5_000,
    'S5 non-JCEF-client log',
  );
  await delay(SURVIVE_PROBE_MS);
  report(
    'S5 live browser client keeps the backend up well past the grace (live-client promise)',
    pidAlive(ctx.backendPid),
  );

  // The correction: once the browser leaves, the OLD regime applies — the
  // 60 s idle grace, NOT the uncorrected immediate exit (which made any transient
  // /ws drop after the IDE exit fatal).
  ws.close();
  const start = Date.now();
  await delay(20_000);
  report(
    'S5 no fast exit after the browser leaves (normal idle regime, not the fast path)',
    pidAlive(ctx.backendPid),
  );
  await waitUntil(() => !pidAlive(ctx.backendPid), EXIT_ALLOWANCE_MS, 'S5 idle-grace exit');
  const elapsed = Date.now() - start;
  report(
    'S5 exit only after the full 60 s idle grace',
    elapsed >= IDLE_GRACE_MS - 2_000,
    `${Math.round(elapsed / 1000)}s`,
  );
}

async function s6_flagClearingAndF5Reconnect(port) {
  const ctx = await startContext('s6', port);
  // JCEF panel is the only client at notification time → the flag arms.
  const panel = await openWs(port, '?env=jetbrains&panelId=harness-panel-s6');
  await delay(500);

  await pushNotification(port, 'PARENT_CLOSING');
  await waitUntil(() => ctx.err.includes('Parent closing cleanly'), 5_000, 'S6 notification log');

  // A browser client connects after the notification, then the panel detaches
  // (the JCEF ordering) — the surviving non-JCEF client must clear the flag.
  const browser = await openWs(port);
  await delay(300);
  panel.close();
  await waitUntil(
    () => ctx.err.includes('fast shutdown cancelled'),
    5_000,
    'S6 flag-clearing log',
  );
  report('S6 surviving browser client clears the fast path (log present)', true);

  // F5: the browser connection drops and reconnects moments later — with the
  // flag cleared this is a routine idle-grace round trip, not a death.
  browser.close();
  await delay(2_000);
  report('S6 backend alive right after the F5 drop (no fast exit)', pidAlive(ctx.backendPid));
  const reconnected = await openWs(port);
  await delay(10_000);
  report('S6 backend survives the F5 reconnect (the motivating case)', pidAlive(ctx.backendPid));
  reconnected.close();
}

async function s7_forcedShutdown(port) {
  // The fake CLI ignores SIGTERM: only the forced path's SIGKILL escalation
  // can kill it.
  const ctx = await startContext('s7', port, { cliIgnoresSigterm: true });
  const ws = await driveSession(port, 'e7s7-session', join(ctx.root, 'proj'));
  await waitUntil(() => firstCliPid(ctx) !== null, 10_000, 'S7 fake CLI spawn');
  const cliPid = firstCliPid(ctx);
  ws.on('error', () => {}); // the forced path disconnects us — expected
  await delay(500);

  const start = Date.now();
  await pushNotification(port, 'PARENT_CLOSING', { force: true });
  await waitUntil(() => !pidAlive(ctx.backendPid), FAST_EXIT_MS, 'S7 forced exit');
  const elapsed = Date.now() - start;
  report(
    'S7 forced shutdown exits within seconds despite a live browser client',
    true,
    `${(elapsed / 1000).toFixed(1)}s`,
  );
  report('S7 forced-shutdown log present', ctx.err.includes('Forced shutdown (user chose Exit)'));

  const cliLog = readFileSync(ctx.cliLog, 'utf8');
  report('S7 CLI got the SIGTERM it ignored', cliLog.includes('SIGTERM ignored'));
  report('S7 SIGKILL escalation logged', /SIGKILLed 1 surviving CLI tree/.test(ctx.err));
  await waitUntil(() => !pidAlive(cliPid), 5_000, 'S7 CLI death');
  report('S7 SIGTERM-ignoring CLI is dead after the escalation', !pidAlive(cliPid));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });

  const scenarios = [
    s1_cleanExitJcefOrdering,
    s2_cleanExitNoClients,
    s3_gateBypass,
    s4_crashControl,
    s5_browserClientPromise,
    s6_flagClearingAndF5Reconnect,
    s7_forcedShutdown,
  ];
  const outcomes = await Promise.allSettled(scenarios.map((fn, i) => fn(BASE_PORT + i)));
  for (const [i, outcome] of outcomes.entries()) {
    if (outcome.status === 'rejected') {
      report(`S${i + 1} scenario error`, false, String(outcome.reason));
    }
  }

  console.log('\nArtifacts in', ROOT);
  console.log(failed ? 'RESULT: FAIL' : 'RESULT: ALL PASS');
  process.exitCode = failed ? 1 : 0;
}

main()
  .catch((err) => {
    console.error('VERIFY ERROR:', err);
    process.exitCode = 2;
  })
  .finally(() => {
    for (const ctx of contexts) {
      for (const pid of [ctx.backendPid, ctx.parent?.pid]) {
        if (pid && pidAlive(pid)) {
          try {
            process.kill(pid, 'SIGKILL');
          } catch {
            // Already gone
          }
        }
      }
    }
  });
