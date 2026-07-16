package com.github.yhk1038.claudecodegui.startup

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
 * Exit-confirm modal while a Claude session is still streaming —
 * the same pattern as the IDE's own "a run configuration is still running"
 * dialog on exit.
 *
 * [canExitApplication] is the veto hook (public API, called during the exit
 * flow BEFORE `AppLifecycleListener.appWillBeClosed` — so a vetoed exit never
 * triggers [BackendParentClosingListener]'s fast backend shutdown). It sums
 * the `sessions.streaming` counters from every running backend's
 * `GET /internal/status` (the endpoint built for the mode-D status card) and,
 * when any turn is in flight, asks the user to confirm. Losing the in-flight
 * work is exactly what the fast shutdown of E7 would otherwise silently do.
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
        val streaming = countStreamingSessions()
        if (streaming == 0) return true

        logger.info("IDE exit requested while $streaming session(s) are streaming — asking the user")
        val subject = if (streaming == 1) "1 Claude Code session is" else "$streaming Claude Code sessions are"
        return MessageDialogBuilder.yesNo(
            "Claude Code GUI",
            "$subject still streaming.\nExiting now will stop the in-flight work. Exit anyway?",
        )
            .yesText("Exit")
            .noText("Cancel")
            .icon(Messages.getWarningIcon())
            .guessWindowAndAsk()
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
    }
}

/**
 * Sum of `sessions.streaming` over the reachable backends; null statuses
 * (unreachable/hung backends) count as zero so they can never veto the exit.
 * Kept top-level and internal so it can be unit-tested without the IDE.
 */
internal fun totalStreamingSessions(statuses: Collection<BackendStatusClient.BackendStatus?>): Int =
    statuses.filterNotNull().sumOf { it.sessions.streaming }
