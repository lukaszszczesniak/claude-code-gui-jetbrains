package com.github.yhk1038.claudecodegui.services

/**
 * What [NodeBackendService.notifyParentClosing] should tell the backends once
 * the IDE exit is certain — the user's choice from the three-option
 * exit-confirm dialog, carried from the veto round
 * ([com.github.yhk1038.claudecodegui.startup.BackendStreamingExitConfirm.canExitApplication])
 * to `AppLifecycleListener.appWillBeClosed`
 * ([com.github.yhk1038.claudecodegui.startup.BackendParentClosingListener]).
 */
enum class ExitDisposition {
    /**
     * Default — the dialog never showed (nothing streaming) or a later exit
     * proceeds without a choice: send plain PARENT_CLOSING. The backend takes
     * the fast shutdown only while no browser/tunnel client remains; a
     * surviving non-JCEF client restores the normal idle regime.
     */
    NOTIFY_PARENT_CLOSING,

    /**
     * The user chose "Exit" knowing sessions are streaming — an informed
     * "close everything": send PARENT_CLOSING { force: true }. The backend
     * shuts down immediately, live browser/tunnel clients included (SIGTERM
     * the CLI trees, a short window, SIGKILL the stragglers).
     */
    FORCE_SHUTDOWN,

    /**
     * The user chose "Exit, Keep Backend": send NOTHING. The full pre-fast-path
     * regime applies — ppid watchdog, 60 s idle grace, 30 s session cleanup —
     * so a browser/tunnel-subscribed session can keep the backend alive.
     */
    KEEP_BACKEND,
}

/**
 * One-shot carrier of the exit disposition between the two exit-flow rounds.
 *
 * The choice is made in the veto round (`canExitApplication`) but acted on in
 * `appWillBeClosed`, and the two must not leak state across exit attempts: a
 * disposition chosen in a round whose exit was then vetoed (by our Cancel or
 * by any LATER veto listener) must never apply to a future exit. Hence the
 * two guards: [consume] resets to the default on read, and
 * BackendStreamingExitConfirm calls [reset] at the start of every veto round.
 */
class ExitDispositionHolder {
    @Volatile
    private var value = ExitDisposition.NOTIFY_PARENT_CLOSING

    fun set(disposition: ExitDisposition) {
        value = disposition
    }

    fun reset() {
        value = ExitDisposition.NOTIFY_PARENT_CLOSING
    }

    /** Return the stored disposition and reset to the default (one-shot). */
    fun consume(): ExitDisposition {
        val current = value
        value = ExitDisposition.NOTIFY_PARENT_CLOSING
        return current
    }
}
