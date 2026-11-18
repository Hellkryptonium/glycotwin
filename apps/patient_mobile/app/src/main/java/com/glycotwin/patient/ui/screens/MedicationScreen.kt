package com.glycotwin.patient.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.glycotwin.patient.data.remote.MedicationDto
import com.glycotwin.patient.data.remote.MedicationInput
import com.glycotwin.patient.ui.components.BrandHeader
import com.glycotwin.patient.ui.components.EmptyState
import com.glycotwin.patient.ui.components.SectionCard
import com.glycotwin.patient.ui.components.TactileButton
import com.glycotwin.patient.ui.components.TactileOutlinedButton
import com.glycotwin.patient.ui.theme.MutedInk
import com.glycotwin.patient.ui.viewmodel.PatientViewModel
import java.time.OffsetDateTime
import java.time.ZoneOffset

@Composable
fun MedicationScreen(viewModel: PatientViewModel, modifier: Modifier = Modifier, onBack: (() -> Unit)? = null) {
    val state by viewModel.state.collectAsState()
    var editing by remember { mutableStateOf<MedicationDto?>(null) }
    var showForm by remember { mutableStateOf(false) }
    var discontinueTarget by remember { mutableStateOf<MedicationDto?>(null) }
    LazyColumn(
        modifier.fillMaxSize().padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(top = 20.dp, bottom = 24.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                BrandHeader()
                onBack?.let { TactileOutlinedButton("Back to health", it) }
            }
        }
        item { Text("Medication", style = MaterialTheme.typography.headlineLarge) }
        item { Text("Manage medicines entered by you.", color = MutedInk) }
        item { TactileButton("Add medication", { editing = null; showForm = true }, Modifier.fillMaxWidth()) }
        state.medicationError?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
        if (state.medicationsLoading) item { CircularProgressIndicator() }
        if (!state.medicationsLoading && state.medications.isEmpty()) item { EmptyState("No active medications", "Add a medication to see its schedule here.") }
        items(state.medications, key = { it.id }) { medication ->
            SectionCard(medication.name) {
                Text("${medication.dosage} · ${medication.frequency}")
                Text("Schedule: ${medication.scheduleTimes.joinToString()}", color = MutedInk)
                medication.instructions?.let { Text(it, color = MutedInk) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) {
                    TactileOutlinedButton("History", { viewModel.loadMedicationDoses(medication.id) }, Modifier.weight(1f))
                    TactileOutlinedButton("Edit", { editing = medication; showForm = true }, Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                    TactileOutlinedButton("Taken", { viewModel.recordMedicationDose(medication.id, "taken") }, Modifier.weight(1f))
                    TactileOutlinedButton("Skipped", { viewModel.recordMedicationDose(medication.id, "skipped") }, Modifier.weight(1f))
                    TactileOutlinedButton("Discontinue", { discontinueTarget = medication }, Modifier.weight(1f))
                }
            }
        }
        if (state.medicationDoses.isNotEmpty()) {
            item { Text("Medication history", style = MaterialTheme.typography.titleLarge) }
            items(state.medicationDoses, key = { it.id }) { dose ->
                SectionCard(dose.status.replaceFirstChar { it.uppercase() }) {
                    Text("Scheduled ${dose.scheduledAt}", color = MutedInk)
                    dose.takenAt?.let { Text("Recorded $it", color = MutedInk) }
                }
            }
        }
    }
    if (showForm) MedicationForm(editing, state.medicationSaving, viewModel::saveMedication, { showForm = false })
    discontinueTarget?.let { medication ->
        AlertDialog(
            onDismissRequest = { discontinueTarget = null },
            title = { Text("Discontinue ${medication.name}?") },
            text = { Text("This keeps its history but removes it from active medications.") },
            confirmButton = { TextButton(onClick = { viewModel.discontinueMedication(medication.id); discontinueTarget = null }) { Text("Discontinue") } },
            dismissButton = { TextButton(onClick = { discontinueTarget = null }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun MedicationForm(
    initial: MedicationDto?,
    saving: Boolean,
    onSave: (String?, MedicationInput) -> Unit,
    onCancel: () -> Unit,
) {
    var name by remember(initial) { mutableStateOf(initial?.name.orEmpty()) }
    var dosage by remember(initial) { mutableStateOf(initial?.dosage.orEmpty()) }
    var frequency by remember(initial) { mutableStateOf(initial?.frequency.orEmpty()) }
    var schedule by remember(initial) { mutableStateOf(initial?.scheduleTimes?.joinToString(", ").orEmpty()) }
    var instructions by remember(initial) { mutableStateOf(initial?.instructions.orEmpty()) }
    AlertDialog(
        onDismissRequest = onCancel,
        title = { Text(if (initial == null) "Add medication" else "Edit medication") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("Medication name") }, singleLine = true)
                OutlinedTextField(dosage, { dosage = it }, label = { Text("Dosage") }, singleLine = true)
                OutlinedTextField(frequency, { frequency = it }, label = { Text("Frequency") }, singleLine = true)
                OutlinedTextField(schedule, { schedule = it }, label = { Text("Schedule times, e.g. 08:00, 20:00") }, singleLine = true)
                OutlinedTextField(instructions, { instructions = it }, label = { Text("Instructions (optional)") })
            }
        },
        confirmButton = {
            TextButton(enabled = !saving && name.isNotBlank() && dosage.isNotBlank() && schedule.isNotBlank(), onClick = {
                onSave(initial?.id, MedicationInput(name.trim(), dosage.trim(), frequency.trim(), schedule.split(',').map { it.trim() }, initial?.startDate ?: OffsetDateTime.now(ZoneOffset.UTC).toString(), instructions = instructions.trim().ifBlank { null }))
                onCancel()
            }) { Text(if (saving) "Saving..." else "Save") }
        },
        dismissButton = { TextButton(onClick = onCancel) { Text("Cancel") } },
    )
}
