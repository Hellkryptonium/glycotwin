package me.glycotwin.patient.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import me.glycotwin.patient.ui.theme.MutedInk
import me.glycotwin.patient.ui.theme.Tomato
import kotlinx.coroutines.delay
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

internal enum class GlucoseSource(val label: String) {
    MANUAL("Manual reading"),
    CGM("CGM"),
    HEALTH_CONNECT("Health Connect"),
    REPLAY("Sample replay"),
    UNKNOWN("Source unavailable"),
}

internal fun glucoseSource(value: String?): GlucoseSource =
    GlucoseSource.entries.firstOrNull { it.name == value } ?: GlucoseSource.UNKNOWN

internal val DEVICE_GAP: Duration = Duration.ofMinutes(15)

internal fun measuredInstant(value: String?): Instant? = value?.let { runCatching { Instant.parse(it) }.getOrNull() }

internal fun glucoseTimeLabel(value: String?): String = measuredInstant(value)?.let(::glucoseTimeLabel) ?: "Time unavailable"

internal fun glucoseTimeLabel(value: Instant): String =
    DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)
        .withZone(ZoneId.systemDefault()).format(value)

@Composable
internal fun GlucoseReadingDetails(source: String?, measuredAt: String, receivedAt: String?, deviceOrigin: String?) {
    val readingSource = glucoseSource(source)
    val now by produceState(Instant.now()) {
        while (true) {
            delay(30_000)
            value = Instant.now()
        }
    }
    val time = measuredInstant(measuredAt)
    val stale = time != null && readingSource in setOf(GlucoseSource.CGM, GlucoseSource.REPLAY)
        && Duration.between(time, now) > DEVICE_GAP
    Text(
        if (stale) "${readingSource.label} · Data delayed" else readingSource.label,
        color = if (stale) Tomato else MutedInk,
        style = MaterialTheme.typography.labelLarge,
    )
    Text("Measured ${glucoseTimeLabel(measuredAt)}", color = MutedInk, style = MaterialTheme.typography.bodySmall)
    if (readingSource == GlucoseSource.HEALTH_CONNECT && !deviceOrigin.isNullOrBlank()) {
        Text(deviceOrigin, color = MutedInk, style = MaterialTheme.typography.bodySmall)
    }
    if (readingSource != GlucoseSource.MANUAL && receivedAt != null) {
        Text("Last received ${glucoseTimeLabel(receivedAt)}", color = MutedInk, style = MaterialTheme.typography.bodySmall)
    }
}

internal fun countDeviceGaps(timestamps: List<String>): Int = timestamps.mapNotNull(::measuredInstant)
    .distinct().sorted()
    .zipWithNext().count { (early, later) -> Duration.between(early, later) > DEVICE_GAP }
