package com.github.yhk1038.claudecodegui.startup

import com.github.yhk1038.claudecodegui.statusbar.BackendStatusClient.BackendStatus
import com.github.yhk1038.claudecodegui.statusbar.BackendStatusClient.ConnectionStats
import com.github.yhk1038.claudecodegui.statusbar.BackendStatusClient.SessionStats
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

/**
 * The exit-confirm decision input: the modal fires iff the sum of
 * `sessions.streaming` over the REACHABLE backends is positive. Unreachable
 * backends (null statuses — timeouts, connection refused, hung process) must
 * count as zero so a sick backend can never veto or hang the IDE exit.
 */
class BackendStreamingExitConfirmTest {

    private fun status(streaming: Int, total: Int = streaming) = BackendStatus(
        keepAlive = false,
        connections = ConnectionStats(total = 0, panels = 0, tunnels = 0, browsers = 0),
        sessions = SessionStats(total = total, streaming = streaming),
    )

    @Test
    fun `sums streaming sessions across backends`() {
        assertEquals(3, totalStreamingSessions(listOf(status(1), status(2), status(0, total = 4))))
    }

    @Test
    fun `unreachable backends count as zero instead of blocking the exit`() {
        assertEquals(1, totalStreamingSessions(listOf(null, status(1), null)))
        assertEquals(0, totalStreamingSessions(listOf(null, null)))
    }

    @Test
    fun `zero when no backend is running`() {
        assertEquals(0, totalStreamingSessions(emptyList()))
    }

    @Test
    fun `idle sessions do not trigger the modal input`() {
        assertEquals(0, totalStreamingSessions(listOf(status(0, total = 3), status(0, total = 1))))
    }
}
