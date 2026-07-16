package com.github.yhk1038.claudecodegui.startup

import com.github.yhk1038.claudecodegui.services.NodeBackendService
import com.intellij.ide.AppLifecycleListener

/**
 * Fast backend shutdown on a CLEAN IDE exit, with three dispositions.
 *
 * [appWillBeClosed] fires after the final "can exit?" veto round and after
 * settings are saved — the exit is certain at that point. (Deliberately NOT
 * [AppLifecycleListener.appClosing]: that one fires BEFORE the veto round, so
 * a vetoed exit would still have told every backend to die.) What each
 * RPC-connected backend receives is decided by the one-shot disposition the
 * exit-confirm dialog may have stored ([BackendStreamingExitConfirm]) and is dispatched by [NodeBackendService.notifyParentClosing]: plain
 * PARENT_CLOSING by default (fast shutdown only while no browser/tunnel
 * client remains), `{ force: true }` after an explicit "Exit" while sessions
 * stream, or nothing at all after "Exit, Keep Backend". `isRestart` makes no
 * difference — an IDE restart takes the same path.
 *
 * Best-effort by design: an IDE crash never runs this listener — the crash
 * path intentionally stays on the backend's ppid watchdog + 60 s idle grace
 * (a sensible protection against an accidental IDE death).
 */
class BackendParentClosingListener : AppLifecycleListener {

    override fun appWillBeClosed(isRestart: Boolean) {
        NodeBackendService.getInstance().notifyParentClosing()
    }
}
