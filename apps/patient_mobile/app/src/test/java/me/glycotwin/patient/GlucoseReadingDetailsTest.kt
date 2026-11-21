package me.glycotwin.patient

import me.glycotwin.patient.ui.screens.GlucoseSource
import me.glycotwin.patient.ui.screens.countDeviceGaps
import me.glycotwin.patient.ui.screens.glucoseSource
import org.junit.Assert.assertEquals
import org.junit.Test

class GlucoseReadingDetailsTest {
    @Test fun countsOnlyMeasuredGapsLargerThanFifteenMinutes() {
        val reported = listOf(
            "2026-11-20T00:31:00Z",
            "2026-11-20T00:15:00Z",
            "2026-11-20T00:00:00Z",
            "2026-11-20T00:15:00Z",
            "not-a-time",
        )
        assertEquals(1, countDeviceGaps(reported))
    }

    @Test fun keepsImportedAndSimulatedSourcesDistinctFromCgm() {
        assertEquals(GlucoseSource.HEALTH_CONNECT, glucoseSource("HEALTH_CONNECT"))
        assertEquals(GlucoseSource.REPLAY, glucoseSource("REPLAY"))
        assertEquals(GlucoseSource.UNKNOWN, glucoseSource(null))
    }
}
