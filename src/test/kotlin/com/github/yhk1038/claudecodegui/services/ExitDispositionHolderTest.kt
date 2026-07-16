package com.github.yhk1038.claudecodegui.services

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

/**
 * The one-shot carrier of the exit-confirm choice between the veto round
 * (canExitApplication) and appWillBeClosed. Both leak guards
 * matter: consume() resets on read, and the veto round resets on entry — a
 * disposition chosen in a vetoed exit attempt must never apply to a later one.
 */
class ExitDispositionHolderTest {

    @Test
    fun `defaults to plain PARENT_CLOSING when nothing was chosen`() {
        assertEquals(ExitDisposition.NOTIFY_PARENT_CLOSING, ExitDispositionHolder().consume())
    }

    @Test
    fun `carries the stored choice to the consumer`() {
        val holder = ExitDispositionHolder()
        holder.set(ExitDisposition.FORCE_SHUTDOWN)
        assertEquals(ExitDisposition.FORCE_SHUTDOWN, holder.consume())

        holder.set(ExitDisposition.KEEP_BACKEND)
        assertEquals(ExitDisposition.KEEP_BACKEND, holder.consume())
    }

    @Test
    fun `consume is one-shot - the second read gets the default`() {
        val holder = ExitDispositionHolder()
        holder.set(ExitDisposition.FORCE_SHUTDOWN)
        holder.consume()
        assertEquals(ExitDisposition.NOTIFY_PARENT_CLOSING, holder.consume())
    }

    @Test
    fun `reset clears a choice left over from a vetoed exit attempt`() {
        val holder = ExitDispositionHolder()
        // Round 1: the user chose Exit, but a later veto listener cancelled
        // the exit — appWillBeClosed never ran, the choice is stale.
        holder.set(ExitDisposition.FORCE_SHUTDOWN)
        // Round 2 starts: the veto round resets before anything else.
        holder.reset()
        assertEquals(ExitDisposition.NOTIFY_PARENT_CLOSING, holder.consume())
    }
}
