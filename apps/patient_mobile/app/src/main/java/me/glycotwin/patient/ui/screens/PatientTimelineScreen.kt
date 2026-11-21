package me.glycotwin.patient.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import me.glycotwin.patient.data.remote.PatientTimelineItem
import me.glycotwin.patient.ui.components.BrandHeader
import me.glycotwin.patient.ui.components.EmptyState
import me.glycotwin.patient.ui.components.SectionCard
import me.glycotwin.patient.ui.components.TactileOutlinedButton
import me.glycotwin.patient.ui.theme.MutedInk
import me.glycotwin.patient.ui.viewmodel.PatientViewModel

private val sourceOptions = linkedMapOf(
    "" to "All sources",
    "MANUAL" to "Manual",
    "HEALTH_CONNECT" to "Health Connect",
    "CGM" to "CGM",
    "WATCH" to "Watch",
    "REPLAY" to "Demo replay",
)

@Composable
fun PatientTimelineScreen(viewModel: PatientViewModel, onBack: () -> Unit, modifier: Modifier = Modifier) {
    val state by viewModel.state.collectAsState()
    LazyColumn(
        modifier.fillMaxSize().padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(vertical = 20.dp),
    ) {
        item { BrandHeader() }
        item { Text("Health history", style = MaterialTheme.typography.headlineLarge) }
        item { Text("Glucose, meals, medication, activity, sleep, and symptoms.", color = MutedInk) }
        item { TactileOutlinedButton("Back to Today", onBack, Modifier.fillMaxWidth()) }
        item {
            ProfileChoice("Source", state.timelineSource.orEmpty(), sourceOptions) { source ->
                viewModel.loadTimeline(source = source.ifBlank { null })
            }
            TactileOutlinedButton("Refresh history", { viewModel.loadTimeline() }, Modifier.fillMaxWidth(), enabled = !state.timelineLoading)
        }
        state.timelineError?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
        if (!state.timelineLoading && state.timelineError == null && state.timeline.isEmpty()) {
            item { EmptyState("No records to show", "Saved and synced records will appear here.") }
        }
        items(state.timeline, key = { it.id }) { entry ->
            SectionCard(entry.title) { TimelineEntryDetails(entry) }
        }
        if (state.timelineLoading) item { CircularProgressIndicator() }
        if (state.timelineHasMore && !state.timelineLoading) {
            item { TactileOutlinedButton("Load more", { viewModel.loadTimeline(append = true) }, Modifier.fillMaxWidth()) }
        }
    }
}

@Composable
internal fun TimelineEntryDetails(entry: PatientTimelineItem, showReceipt: Boolean = true) {
    entry.glucose?.let { Text("${it.value} ${it.unit}", style = MaterialTheme.typography.titleMedium) }
    entry.detail?.takeIf(String::isNotBlank)?.let { Text(it) }
    val source = sourceOptions[entry.source] ?: entry.source
    Text("$source · ${glucoseTimeLabel(entry.occurredAt)}", color = MutedInk, style = MaterialTheme.typography.bodySmall)
    entry.deviceOrigin?.takeIf(String::isNotBlank)?.let {
        Text(it, color = MutedInk, style = MaterialTheme.typography.bodySmall)
    }
    if (showReceipt && entry.receivedAt != entry.occurredAt) {
        Text("Received ${glucoseTimeLabel(entry.receivedAt)}", color = MutedInk, style = MaterialTheme.typography.bodySmall)
    }
}
