package com.github.yhk1038.claudecodegui.startup

import com.github.yhk1038.claudecodegui.services.NodeBackendService
import com.intellij.ide.AppLifecycleListener

/**
 * Fast backend shutdown on a CLEAN IDE exit.
 *
 * [appWillBeClosed] fires after the final "can exit?" veto round and after
 * settings are saved — the exit is certain at that point. (Deliberately NOT
 * [AppLifecycleListener.appClosing]: that one fires BEFORE the veto round, so
 * a vetoed exit would still have told every backend to die.) Each
 * RPC-connected backend receives a PARENT_CLOSING notification and drops its
 * idle grace to ~0: it exits the moment it has no /ws clients — the JCEF
 * sockets close moments later when the IDE tears the browsers down — instead
 * of lingering ~60 s in the task manager after every IDE close. A live
 * browser/tunnel client keeps its backend alive exactly as before (the mode
 * C/D promise is unchanged).
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
