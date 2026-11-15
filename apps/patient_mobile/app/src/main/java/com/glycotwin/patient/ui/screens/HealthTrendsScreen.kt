package com.glycotwin.patient.ui.screens

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.glycotwin.patient.BuildConfig
import com.glycotwin.patient.ui.components.BrandHeader
import com.glycotwin.patient.ui.components.EmptyState
import com.glycotwin.patient.ui.components.SectionCard
import com.glycotwin.patient.ui.components.TactileOutlinedButton
import com.glycotwin.patient.ui.theme.MutedInk
import com.glycotwin.patient.ui.theme.Tomato
import com.glycotwin.patient.ui.viewmodel.PatientViewModel

@Composable
fun HealthTrendsScreen(viewModel: PatientViewModel, modifier: Modifier = Modifier) {
    val state by viewModel.state.collectAsState()
    val analytics = state.analytics
    LazyColumn(
        modifier = modifier.fillMaxSize().padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(top = 20.dp, bottom = 24.dp),
    ) {
        item { BrandHeader() }
        item { Text("Health trends", style = MaterialTheme.typography.headlineLarge) }
        item { Text("Descriptive summaries of your recorded glucose readings.", color = MutedInk) }
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
        if (!state.analyticsLoading && analytics?.totalReadings == 0) {
            item { EmptyState("No readings in this range", "Recorded glucose readings will appear here.") }
        } else if (!state.analyticsLoading && analytics != null) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(
                        "Latest" to (analytics.latest?.let { "${it.value} ${it.unit}" } ?: "—"),
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
            if (analytics.byUnit.size <= 1) item { TrendChart(analytics.readings.map { it.value.toFloatOrNull() ?: 0f }) }
            else item { Text("Readings use multiple units. The chart is unavailable without converting values.", color = MutedInk) }
            item { Text("${analytics.totalReadings} recorded reading${if (analytics.totalReadings == 1) "" else "s"}", color = MutedInk) }
            analytics.daily.forEach { day ->
                item { SectionCard(day.date) { Text("${day.average} ${day.unit} · ${day.readingCount} reading${if (day.readingCount == 1) "" else "s"}") } }
            }
        }
    }
}

@Composable
private fun TrendChart(values: List<Float>) {
    SectionCard("Glucose trend") {
        Canvas(Modifier.fillMaxWidth().height(180.dp).padding(vertical = 12.dp)) {
            if (values.size > 1) {
                val min = values.minOrNull() ?: 0f
                val max = values.maxOrNull() ?: 1f
                val points = values.mapIndexed { index, value ->
                    androidx.compose.ui.geometry.Offset(
                        index * size.width / (values.size - 1),
                        size.height - ((value - min) / (max - min).coerceAtLeast(1f) * size.height),
                    )
                }
                for (index in 0 until points.lastIndex) drawLine(Color(0xFF1746A2), points[index], points[index + 1], strokeWidth = 5f)
                points.forEach { drawCircle(Tomato, 6f, it) }
            }
        }
    }
}
