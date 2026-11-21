package me.glycotwin.patient.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import me.glycotwin.patient.data.remote.PatientTimelineItem
import me.glycotwin.patient.data.remote.VisitBriefInput
import me.glycotwin.patient.ui.components.BrandHeader
import me.glycotwin.patient.ui.components.EmptyState
import me.glycotwin.patient.ui.components.SectionCard
import me.glycotwin.patient.ui.components.TactileButton
import me.glycotwin.patient.ui.components.TactileOutlinedButton
import me.glycotwin.patient.ui.theme.MutedInk
import me.glycotwin.patient.ui.theme.Pine
import me.glycotwin.patient.ui.viewmodel.PatientState
import me.glycotwin.patient.ui.viewmodel.PatientViewModel

private const val MAX_VISIT_EVENTS = 20

@Composable
fun VisitPrepScreen(viewModel: PatientViewModel, onBack: () -> Unit, modifier: Modifier = Modifier) {
    val state by viewModel.state.collectAsState()
    val connections = state.care?.connections.orEmpty().filter { it.verificationStatus == "verified" }
    var relationshipId by remember { mutableStateOf("") }
    var title by remember { mutableStateOf("Visit brief") }
    var notes by remember { mutableStateOf("") }
    var entries by remember { mutableStateOf<Map<String, PatientTimelineItem>>(emptyMap()) }
    var confirm by remember { mutableStateOf(false) }
    val doctor = connections.firstOrNull { it.id == relationshipId } ?: connections.singleOrNull()
    val availableEntries = state.timeline.filterNot { it.source == "REPLAY" }
    LazyColumn(
        modifier.fillMaxSize().padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(vertical = 20.dp),
    ) {
        item { BrandHeader() }
        item { Text("Prepare for a visit", style = MaterialTheme.typography.headlineLarge) }
        item { TactileOutlinedButton("Back to care team", onBack, Modifier.fillMaxWidth(), enabled = !state.careSaving) }
        state.careError?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
        if (state.careLoading) item { CircularProgressIndicator() }
        if (connections.isEmpty()) {
            item {
                EmptyState("Connect a verified doctor", "You can share a visit brief after connecting a verified doctor.")
                TactileOutlinedButton("Refresh care team", { viewModel.loadCare() }, Modifier.fillMaxWidth(), enabled = !state.careLoading)
            }
        } else {
            item {
                SectionCard("Your visit brief") {
                    Text("Choose records and add anything you’d like to discuss.", color = MutedInk)
                    ProfileChoice("Share with", doctor?.id.orEmpty(), connections.associate { it.id to (it.doctorName ?: "Your doctor") }) {
                        relationshipId = it
                    }
                    OutlinedTextField(
                        title, { title = it.take(120) }, Modifier.fillMaxWidth(), label = { Text("Title") }, singleLine = true,
                    )
                    OutlinedTextField(
                        notes, { notes = it.take(2000) }, Modifier.fillMaxWidth(), label = { Text("Questions or notes (optional)") },
                        minLines = 2,
                    )
                    Text("${entries.size} of $MAX_VISIT_EVENTS records selected", color = MutedInk)
                    TactileButton(
                        "Review & share", { confirm = true }, Modifier.fillMaxWidth(),
                        enabled = doctor != null && title.isNotBlank() && entries.isNotEmpty() && !state.careSaving,
                    )
                }
            }
            item { Text("Records to share", style = MaterialTheme.typography.titleLarge) }
            state.timelineError?.let {
                item {
                    Text(it, color = MaterialTheme.colorScheme.error)
                    TactileOutlinedButton("Reload records", { viewModel.loadTimeline(source = null) }, Modifier.fillMaxWidth())
                }
            }
            if (availableEntries.isEmpty() && !state.timelineLoading && !state.timelineHasMore && state.timelineError == null) {
                item { EmptyState("No records available", "Add a health record, then return to this brief.") }
            }
            items(availableEntries, key = { it.id }) { entry ->
                val checked = entry.id in entries
                val enabled = !state.careSaving && (checked || entries.size < MAX_VISIT_EVENTS)
                SectionCard(entry.title) {
                    Row(
                        Modifier.fillMaxWidth().toggleable(value = checked, enabled = enabled, role = Role.Checkbox) {
                            entries = if (it) entries + (entry.id to entry) else entries - entry.id
                        },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Checkbox(checked, onCheckedChange = null, enabled = enabled)
                        Column { TimelineEntryDetails(entry, showReceipt = false) }
                    }
                }
            }
            if (state.timelineLoading) item { CircularProgressIndicator() }
            if (state.timelineHasMore && !state.timelineLoading) {
                item {
                    TactileOutlinedButton("Load older records", { viewModel.loadTimeline(source = null, append = true) }, Modifier.fillMaxWidth())
                }
            }
        }
    }
    if (confirm && doctor != null) {
        AlertDialog(
            onDismissRequest = { if (!state.careSaving) confirm = false },
            title = { Text("Share visit brief?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("${doctor.doctorName ?: "Your doctor"} will receive $title and ${entries.size} selected record${if (entries.size == 1) "" else "s"}.")
                    if (notes.isNotBlank()) Text("Your notes will be included.")
                    state.careError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
            },
            dismissButton = { TextButton(onClick = { confirm = false }, enabled = !state.careSaving) { Text("Cancel") } },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.shareVisitBrief(VisitBriefInput(doctor.id, title.trim(), notes.trim().ifBlank { null }, entries.keys.toList())) {
                            confirm = false
                            onBack()
                        }
                    },
                    enabled = !state.careSaving,
                ) { Text(if (state.careSaving) "Sharing…" else "Share brief") }
            },
        )
    }
}

internal fun LazyListScope.careRecords(state: PatientState, viewModel: PatientViewModel, openVisitPrep: () -> Unit) {
    if (state.careLoading && state.care == null) item { CircularProgressIndicator() }
    state.careError?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
    state.careMessage?.let { item { Text(it, color = Pine) } }
    state.care?.let { care ->
        item {
            SectionCard("Care team access") {
                if (care.connections.isEmpty()) {
                    Text("You can share a visit brief after connecting a doctor.", color = MutedInk)
                } else {
                    care.connections.forEach { doctor ->
                        Text(doctor.doctorName ?: "Your doctor", style = MaterialTheme.typography.titleMedium)
                        doctor.specialization?.let { Text(it, color = MutedInk) }
                        if (doctor.verificationStatus != "verified") Text("Verification required before sharing records.", color = MutedInk)
                        ConfirmCareAction(
                            "End access", "End this doctor’s access?",
                            "This will end their access to your health records and shared visit briefs.",
                            state.careSaving,
                        ) { viewModel.revokeRelationship(doctor.id) }
                    }
                    if (care.connections.any { it.verificationStatus == "verified" }) {
                        TactileButton("Prepare a visit brief", openVisitPrep, Modifier.fillMaxWidth(), enabled = !state.careSaving)
                    }
                }
            }
        }
        if (care.items.isNotEmpty()) {
            item { Text("Goals and follow-ups", style = MaterialTheme.typography.titleLarge) }
            items(care.items, key = { it.id }) { entry ->
                SectionCard(entry.title) {
                    val kind = if (entry.kind == "GOAL") "Goal" else "Follow-up"
                    val status = if (entry.status == "DONE") "Completed" else "Open"
                    Text("$kind · $status", color = MutedInk)
                    entry.detail?.let { Text(it) }
                    entry.dueDate?.let { Text("Due $it", color = MutedInk) }
                }
            }
        }
        if (care.briefs.isNotEmpty()) {
            item { Text("Shared visit briefs", style = MaterialTheme.typography.titleLarge) }
            items(care.briefs, key = { it.id }) { brief ->
                SectionCard(brief.title) {
                    val doctor = care.connections.firstOrNull { it.id == brief.relationshipId }?.doctorName ?: "Your care team"
                    Text("Shared with $doctor · ${glucoseTimeLabel(brief.createdAt)}", color = MutedInk)
                    brief.notes?.let { Text(it) }
                    brief.events.forEach { TimelineEntryDetails(it, showReceipt = false) }
                    ConfirmCareAction(
                        "Stop sharing", "Stop sharing this visit brief?",
                        "The brief will be removed from the doctor’s workspace.",
                        state.careSaving,
                    ) { viewModel.deleteVisitBrief(brief.id) }
                }
            }
        }
    }
}

@Composable
private fun ConfirmCareAction(action: String, title: String, message: String, busy: Boolean, onConfirm: () -> Unit) {
    var open by remember { mutableStateOf(false) }
    TactileOutlinedButton(action, { open = true }, Modifier.fillMaxWidth(), enabled = !busy)
    if (open) AlertDialog(
        onDismissRequest = { open = false },
        title = { Text(title) },
        text = { Text(message) },
        dismissButton = { TextButton(onClick = { open = false }) { Text("Cancel") } },
        confirmButton = { TextButton(onClick = { open = false; onConfirm() }, enabled = !busy) { Text(action) } },
    )
}
