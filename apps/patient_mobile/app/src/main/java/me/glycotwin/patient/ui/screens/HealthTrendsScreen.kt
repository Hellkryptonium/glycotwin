package me.glycotwin.patient.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.dp
import me.glycotwin.patient.BuildConfig
import me.glycotwin.patient.data.remote.GlucoseAnalyticsReadingDto
import me.glycotwin.patient.ui.components.BrandHeader
import me.glycotwin.patient.ui.components.EmptyState
import me.glycotwin.patient.ui.components.SectionCard
import me.glycotwin.patient.ui.components.TactileOutlinedButton
import me.glycotwin.patient.ui.theme.Cobalt
import me.glycotwin.patient.ui.theme.MutedInk
import me.glycotwin.patient.ui.theme.Tomato
import me.glycotwin.patient.ui.viewmodel.PatientViewModel
import java.time.Duration
import java.time.Instant

@Composable
fun HealthTrendsScreen(
    viewModel: PatientViewModel,
    modifier: Modifier = Modifier,
    onDataConnections: () -> Unit = {},
) {
    val state by viewModel.state.collectAsState()
    val analytics = state.analytics
    LazyColumn(
        modifier = modifier.fillMaxSize().padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(top = 20.dp, bottom = 24.dp),
    ) {
        item { BrandHeader() }
        item { Text("Health trends", style = MaterialTheme.typography.headlineLarge) }
        item { Text("Explore your recorded glucose history.", color = MutedInk) }
        item { TactileOutlinedButton("Data connections", onDataConnections, Modifier.fillMaxWidth()) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("7d", "30d", "90d").forEach { range ->
                    TactileOutlinedButton(range, { viewModel.loadAnalytics(range) })
                }
            }
        }
        if (BuildConfig.DEBUG) {
            item {
                TactileOutlinedButton("Preview sample data", viewModel::showAnalyticsPreview)
            }
        }
        if (state.analyticsLoading) item { CircularProgressIndicator() }
        state.analyticsError?.let { error ->
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(error, color = MaterialTheme.colorScheme.error)
                    TactileOutlinedButton("Retry", { viewModel.loadAnalytics(state.analyticsRange, refresh = true) })
                }
            }
        }
        if (state.analyticsPreview) {
            item { Text("Sample preview · Synthetic readings", color = Cobalt, style = MaterialTheme.typography.labelLarge) }
        }
        if (!state.analyticsLoading && analytics?.totalReadings == 0) {
            item { EmptyState("No readings in this range", "Recorded glucose readings will appear here.") }
        } else if (!state.analyticsLoading && analytics != null) {
            analytics.latest?.let { latest ->
                item {
                    SectionCard("Latest reading in range") {
                        Text("${latest.value} ${latest.unit}", style = MaterialTheme.typography.headlineMedium)
                        GlucoseReadingDetails(latest.source, latest.measuredAt, latest.receivedAt, latest.deviceOrigin)
                        val source = glucoseSource(latest.source)
                        if (source in setOf(GlucoseSource.CGM, GlucoseSource.REPLAY)) {
                            val gaps = countDeviceGaps(analytics.readings.filter {
                                it.source == latest.source && it.deviceOrigin == latest.deviceOrigin
                            }.map { it.measuredAt })
                            if (gaps > 0) Text("$gaps data gaps over 15 minutes", color = MutedInk)
                        }
                    }
                }
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(
                        "Average" to (analytics.average?.let { "$it ${analytics.unit ?: ""}" } ?: "—"),
                        "Highest" to (analytics.maximum?.let { "$it ${analytics.unit ?: ""}" } ?: "—"),
                        "Lowest" to (analytics.minimum?.let { "$it ${analytics.unit ?: ""}" } ?: "—"),
                    ).chunked(2).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            row.forEach { (label, value) -> SectionCard(label, Modifier.weight(1f)) { Text(value) } }
                        }
                    }
                }
            }
            if (analytics.byUnit.size <= 1) item { TrendChart(analytics.readings) }
            else item { Text("Readings use multiple units. The chart is unavailable without converting values.", color = MutedInk) }
            item { Text("${analytics.totalReadings} recorded reading${if (analytics.totalReadings == 1) "" else "s"}", color = MutedInk) }
            analytics.daily.forEach { day ->
                item { SectionCard(day.date) { Text("${day.average} ${day.unit} · ${day.readingCount} reading${if (day.readingCount == 1) "" else "s"}") } }
            }
        }
    }
}

@Composable
private fun TrendChart(readings: List<GlucoseAnalyticsReadingDto>) {
    val points = readings.mapNotNull { reading ->
        val time = measuredInstant(reading.measuredAt) ?: return@mapNotNull null
        val value = reading.value.toFloatOrNull()?.takeIf(Float::isFinite) ?: return@mapNotNull null
        TrendPoint(time, value, glucoseSource(reading.source), reading.deviceOrigin)
    }.sortedBy { it.time }
    SectionCard("Glucose trend") {
        if (points.isEmpty()) return@SectionCard
        Canvas(Modifier.fillMaxWidth().height(180.dp).padding(vertical = 12.dp)) {
            val min = points.minOf { it.value } - 1
            val max = points.maxOf { it.value } + 1
            val origin = points.first().time
            val interval = Duration.between(origin, points.last().time).toMillis().coerceAtLeast(1)
            val locations = points.map { point ->
                val x = if (points.size == 1) size.width / 2
                else (Duration.between(origin, point.time).toMillis().toDouble() / interval).toFloat() * size.width
                Offset(x, size.height * (1f - (point.value - min) / (max - min)))
            }
            for (index in 0 until points.lastIndex) {
                val first = points[index]
                val next = points[index + 1]
                if (first.source == next.source && first.origin == next.origin &&
                    first.source in setOf(GlucoseSource.CGM, GlucoseSource.REPLAY) &&
                    Duration.between(first.time, next.time) <= DEVICE_GAP
                ) drawLine(Cobalt, locations[index], locations[index + 1], strokeWidth = 3.dp.toPx())
            }
            locations.forEach { drawCircle(Tomato, 3.dp.toPx(), it) }
        }
        Text("Points are placed by measurement time. Continuous sources are joined across gaps up to 15 minutes.", color = MutedInk, style = MaterialTheme.typography.bodySmall)
    }
}

private data class TrendPoint(val time: Instant, val value: Float, val source: GlucoseSource, val origin: String?)
