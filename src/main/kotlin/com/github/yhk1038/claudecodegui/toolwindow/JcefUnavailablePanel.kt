package com.github.yhk1038.claudecodegui.toolwindow

import com.intellij.openapi.diagnostic.Logger
import java.awt.BorderLayout
import javax.swing.BorderFactory
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.SwingConstants

/**
 * Fallback panel shown when JCEF is not available in the current JetBrains Runtime.
 *
 * Android Studio ships without JCEF by default. When [com.intellij.ui.jcef.JBCefApp.isSupported]
 * returns false, this panel is displayed in place of the normal WebView panel.
 *
 * Users are guided to switch to a JBR that includes JCEF via the
 * "Choose Boot Java Runtime for the IDE…" action.
 */
class JcefUnavailablePanel : JPanel(BorderLayout()) {

    private val logger = Logger.getInstance(JcefUnavailablePanel::class.java)

    init {
        border = BorderFactory.createEmptyBorder(40, 40, 40, 40)

        val messageLabel = JLabel(
            "<html><div style='text-align:center;'>" +
            "<b>JCEF runtime is not available</b><br><br>" +
            "This plugin requires a JetBrains Runtime with JCEF (Chromium Embedded Framework).<br><br>" +
            "Android Studio ships without JCEF by default. " +
            "To use this plugin, switch the IDE's boot runtime to one that includes JCEF.<br><br>" +
            "<b>Steps to fix:</b><br>" +
            "1. Open Find Action (Cmd/Ctrl+Shift+A)<br>" +
            "2. Search for &quot;Choose Boot Java Runtime for the IDE&hellip;&quot;<br>" +
            "3. Pick a runtime whose name contains &quot;JCEF&quot; or &quot;with JCEF&quot;<br>" +
            "4. Restart the IDE" +
            "</div></html>"
        ).apply {
            horizontalAlignment = SwingConstants.CENTER
            verticalAlignment = SwingConstants.CENTER
        }

        add(messageLabel, BorderLayout.CENTER)

        logger.info("JcefUnavailablePanel created — JCEF is not supported in this runtime")
    }
}
