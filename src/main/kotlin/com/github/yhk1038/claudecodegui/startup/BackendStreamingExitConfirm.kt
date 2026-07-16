package com.github.yhk1038.claudecodegui.startup

import com.github.yhk1038.claudecodegui.services.ExitDisposition
import com.github.yhk1038.claudecodegui.services.NodeBackendService
import com.github.yhk1038.claudecodegui.statusbar.BackendStatusClient
import com.intellij.ide.AppLifecycleListener
import com.intellij.openapi.application.ApplicationListener
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.ui.MessageDialogBuilder
import com.intellij.openapi.ui.Messages
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

/**
 * Exit-confirm modal while a Claude session is still streaming — the same pattern as the IDE's own "a run
 * configuration is still running" dialog on exit.
 *
 * [canExitApplication] is the veto hook (public API, called during the exit
 * flow BEFORE `AppLifecycleListener.appWillBeClosed` — so a vetoed exit never
 * triggers [BackendParentClosingListener]'s fast backend shutdown). It sums
 * the `sessions.streaming` counters from every running backend's
 * `GET /internal/status` (the endpoint built for the mode-D status card) and,
 * when any turn is in flight, asks the user to pick one of THREE options:
 *
 * - **Exit** — informed "close everything": the exit proceeds and
 *   [NodeBackendService.notifyParentClosing] sends PARENT_CLOSING with
 *   `force: true` (immediate backend shutdown, live browser/tunnel clients
 *   deliberately included).
 * - **Exit, Keep Backend** — the exit proceeds and NO notification is sent:
 *   the full pre-fast-path regime applies (ppid watchdog, 60 s idle grace, 30 s
 *   session cleanup), so a browser/tunnel-subscribed session can keep the
 *   backend alive. The label deliberately promises only a running backend —
 *   NOT that in-flight turns finish: with JCEF panels as the only clients the
 *   30 s session cleanup still stops them (that safety net is untouchable).
 * - **Cancel** (and ESC / closing the dialog) — vetoes the exit; nothing
 *   happens, exactly as before.
 *
 * The choice cannot be acted on inside the veto round (a LATER listener may
 * still veto the exit), so it is carried as a one-shot
 * [NodeBackendService.exitDisposition] and consumed in `appWillBeClosed`. The
 * holder is reset at the start of every veto round, so a choice from a vetoed
 * attempt never leaks into a later exit. IDE restarts take the same path:
 * the default `canRestartApplication()` delegates here, and
 * `appWillBeClosed(isRestart = true)` consumes the disposition the same way.
 *
 * Never blocks the exit on a sick backend: every status fetch failure counts
 * as zero (BackendStatusClient maps failures to null) and the whole poll runs
 * against a hard [STATUS_BUDGET_MS] deadline, so a hung backend delays the
 * exit by at most ~2 s and shows no dialog.
 *
 * [ApplicationListener] has no plugin.xml topic (it is not message-bus based),
 * so the instance registers itself from [appFrameCreated] with the app-level
 * [NodeBackendService] as the parent disposable — a dynamic plugin unload
 * removes the listener with the service.
 */
class BackendStreamingExitConfirm : AppLifecycleListener, ApplicationListener {

    private val logger = Logger.getInstance(BackendStreamingExitConfirm::class.java)

    override fun appFrameCreated(commandLineArgs: MutableList<String>) {
        val application = ApplicationManager.getApplication()
        application.addApplicationListener(this, NodeBackendService.getInstance())
    }

    override fun canExitApplication(): Boolean {
        val service = NodeBackendService.getInstance()
        // Every veto round starts from the default disposition: a choice made
        // in an earlier round whose exit was then vetoed must not leak here.
        service.exitDisposition.reset()

        val streaming = countStreamingSessions()
        if (streaming == 0) return true

        logger.info("IDE exit requested while $streaming session(s) are streaming — asking the user")
        val subject = if (streaming == 1) "1 Claude Code session is" else "$streaming Claude Code sessions are"
        val result = MessageDialogBuilder.yesNoCancel(
            "Claude Code GUI",
            "$subject still streaming. Exiting now will stop the in-flight work.\n\n" +
                "\"$KEEP_BACKEND_LABEL\" leaves the backend process running for browser and tunnel clients.",
        )
            .yesText("Exit")
            .noText(KEEP_BACKEND_LABEL)
            .cancelText("Cancel")
            .icon(Messages.getWarningIcon())
            .guessWindowAndAsk()

        val choice = exitChoiceForDialogResult(result)
        service.exitDisposition.set(choice.disposition)
        logger.info("Exit-confirm choice: ${choice.disposition} (canExit=${choice.canExit})")
        return choice.canExit
    }

    /**
     * Total streaming sessions across every running backend. Fetches run in
     * parallel against one shared deadline; a backend that fails or misses the
     * deadline contributes zero (exit must never hang on a dead backend).
     */
    private fun countStreamingSessions(): Int {
        val ports = NodeBackendService.getInstance().runningPorts()
        if (ports.isEmpty()) return 0

        val futures = ports.map { port ->
            CompletableFuture.supplyAsync { BackendStatusClient.fetch(port) }
        }
        val deadline = System.currentTimeMillis() + STATUS_BUDGET_MS
        val statuses = futures.map { future ->
            try {
                future.get((deadline - System.currentTimeMillis()).coerceAtLeast(1), TimeUnit.MILLISECONDS)
            } catch (e: Exception) {
                null
            }
        }
        return totalStreamingSessions(statuses)
    }

    private companion object {
        /** Hard overall budget for polling all backends before the exit proceeds. */
        const val STATUS_BUDGET_MS = 2_000L

        /**
         * The third option's label. Deliberately promises keeping the backend
         * only — never "finishing the session" (see the class KDoc).
         */
        const val KEEP_BACKEND_LABEL = "Exit, Keep Backend"
    }
}

/**
 * Sum of `sessions.streaming` over the reachable backends; null statuses
 * (unreachable/hung backends) count as zero so they can never veto the exit.
 * Kept top-level and internal so it can be unit-tested without the IDE.
 */
internal fun totalStreamingSessions(statuses: Collection<BackendStatusClient.BackendStatus?>): Int =
    statuses.filterNotNull().sumOf { it.sessions.streaming }

/** The veto verdict plus the disposition carried over to appWillBeClosed. */
internal data class ExitChoice(val canExit: Boolean, val disposition: ExitDisposition)

/**
 * Map the three-option dialog result to the exit decision. Yes = Exit (force
 * shutdown), No = Exit-Keep-Backend (send nothing), Cancel = veto — ESC and
 * closing the dialog window report [Messages.CANCEL] and land on the veto too.
 * Kept top-level and internal so it can be unit-tested without the IDE.
 */
internal fun exitChoiceForDialogResult(result: Int): ExitChoice = when (result) {
    Messages.YES -> ExitChoice(canExit = true, disposition = ExitDisposition.FORCE_SHUTDOWN)
    Messages.NO -> ExitChoice(canExit = true, disposition = ExitDisposition.KEEP_BACKEND)
    else -> ExitChoice(canExit = false, disposition = ExitDisposition.NOTIFY_PARENT_CLOSING)
}
