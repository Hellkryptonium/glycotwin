package me.glycotwin.patient

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WatchSyncStateTest {
    @Test
    fun disconnectionHidesGlucoseWhileTheWorkoutCanStillBeFinished() {
        val connected = PhoneSyncState(
            status = PhoneStatus.CONNECTED,
            glucose = SharedGlucose("reading", "112", "mg/dL", "CGM", 1_000L),
            activitySessionId = "session",
            activitySharingKnown = true,
        )
        assertTrue(connected.canStartWorkout)

        val disconnected = connected.withoutConnection(PhoneStatus.DISCONNECTED)
        assertNull(disconnected.glucose)
        assertFalse(disconnected.canStartWorkout)
        assertEquals("session", disconnected.activitySessionId)
        assertFalse(disconnected.revokesWorkout("session"))
    }

    @Test
    fun delayedPairingDataDoesNotRevokeButConfirmedOptOutEndsTheWorkout() {
        val waiting = PhoneSyncState(status = PhoneStatus.CONNECTED, activitySessionId = "previous")
        assertFalse(waiting.canStartWorkout)
        assertFalse(waiting.revokesWorkout("previous"))

        val optedOut = waiting.copy(activitySharingKnown = true, activitySessionId = null)
        assertFalse(optedOut.canStartWorkout)
        assertTrue(optedOut.revokesWorkout("previous"))

        val replacement = waiting.copy(activitySharingKnown = true, activitySessionId = "new")
        assertTrue(replacement.canStartWorkout)
        assertTrue(replacement.revokesWorkout("previous"))
    }

    @Test
    fun readingAgeUsesTheMeasurementTimeAndLabelsAClockMismatch() {
        val measured = 1_000L
        val fifteenMinutes = 15 * 60 * 1_000L
        assertEquals(GlucoseFreshness.RECENT, glucoseFreshness(measured, measured + fifteenMinutes))
        assertEquals(GlucoseFreshness.OLDER, glucoseFreshness(measured, measured + fifteenMinutes + 1))
        assertEquals(GlucoseFreshness.CLOCK_AHEAD, glucoseFreshness(measured, measured - 1))
    }

    @Test
    fun partialAcknowledgmentKeepsTheWorkoutQueued() {
        assertEquals(ActivitySyncStatus.QUEUED, activitySyncStatus(false, false, true, true))
        assertEquals(ActivitySyncStatus.ACKNOWLEDGED, activitySyncStatus(false, false, false, true))
        assertEquals(ActivitySyncStatus.SAVING, activitySyncStatus(true, true, false, false))
        assertEquals(ActivitySyncStatus.RETRYING, activitySyncStatus(true, false, true, true))
    }
}
