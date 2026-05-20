package com.github.yhk1038.claudecodegui.notifications

import com.github.yhk1038.claudecodegui.platform.PlatformActionInvoker
import com.intellij.notification.Notification
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project
import java.util.Collections
import java.util.concurrent.ConcurrentHashMap

/**
 * Displays a sticky warning notification when JCEF is not available in the current runtime.
 *
 * Provides a "Switch Runtime" action button that triggers the IDE's built-in
 * "Choose Boot Java Runtime" dialog so the user can switch to a JBR with JCEF.
 *
 * Each project receives at most one notification per IDE session (deduplication via [notifiedProjects]).
 */
object JcefRuntimeNotifier {

    private val notifiedProjects: MutableSet<Project> =
        Collections.newSetFromMap(ConcurrentHashMap<Project, Boolean>())

    fun notify(project: Project) {
        if (!notifiedProjects.add(project)) return  // already notified for this project

        val notification = NotificationGroupManager.getInstance()
            .getNotificationGroup("claude-code-gui.jcef-runtime")
            .createNotification(
                "JCEF runtime not available",
                "Claude Code GUI needs JCEF to render its chat UI. Click to install a JCEF-enabled runtime.",
                NotificationType.WARNING
            )
            .addAction(object : NotificationAction("Install JCEF Runtime") {
                override fun actionPerformed(e: AnActionEvent, n: Notification) {
                    // PlatformActionInvoker handles the 2024.3+ modern API vs 2024.2 legacy
                    // fallback internally, so this call site stays free of deprecated symbols.
                    PlatformActionInvoker.invokeActionByIdFromEvent("ChooseRuntime", e, "JcefRuntimeNotifier")
                    n.expire()
                }
            })

        notification.notify(project)
    }
}
