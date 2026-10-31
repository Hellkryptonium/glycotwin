package com.glycotwin.patient.ui.screens

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.glycotwin.patient.data.remote.GlucoseReadingDto
import com.glycotwin.patient.data.remote.GlucoseReadingInput
import com.glycotwin.patient.ui.components.BrandHeader
import com.glycotwin.patient.ui.components.EmptyState
import com.glycotwin.patient.ui.components.SectionCard
import com.glycotwin.patient.ui.components.TactileButton
import com.glycotwin.patient.ui.components.TactileOutlinedButton
import com.glycotwin.patient.ui.theme.MutedInk
import com.glycotwin.patient.ui.theme.Pine
import com.glycotwin.patient.ui.viewmodel.PatientViewModel
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val contexts = listOf("FASTING", "BEFORE_MEAL", "AFTER_MEAL", "RANDOM")
private val units = listOf("mg/dL", "mmol/L")
private val displayDateTime = DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a", Locale.getDefault())

@Composable
fun HealthRecordsScreen(viewModel: PatientViewModel) {
    val state by viewModel.state.collectAsState()
    var editing by remember { mutableStateOf<GlucoseReadingDto?>(null) }
    var showForm by rememberSaveable { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<GlucoseReadingDto?>(null) }

    if (showForm) {
        GlucoseForm(
            initial = editing,
            saving = state.readingSaving,
            error = state.readingsError,
            onCancel = { showForm = false; editing = null },
            onSave = { id, input -> viewModel.saveReading(id, input); showForm = false; editing = null },
        )
        return
    }

    if (deleteTarget != null) {
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete reading?") },
            text = { Text("This manually entered record will be permanently removed.") },
            confirmButton = {
                TextButton(onClick = {
                    deleteTarget?.id?.let { viewModel.deleteReading(it) }
                    deleteTarget = null
                }) { Text("Delete") }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Cancel") } },
        )
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                BrandHeader()
                TactileOutlinedButton("Refresh", { viewModel.loadReadings(refresh = true) })
            }
        }
        item { Text("Health records", style = MaterialTheme.typography.headlineLarge) }
        item { TactileButton("Add glucose reading", { editing = null; showForm = true }, Modifier.fillMaxWidth()) }
        state.confirmation?.let { item { Text(it, color = Pine) } }
        state.readingsError?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
        if (state.readingsLoading) {
            item { CircularProgressIndicator() }
        } else if (state.readings.isEmpty()) {
            item { EmptyState("No readings yet", "Add your first manual blood glucose reading when you are ready.") }
        } else {
            items(state.readings, key = { it.id }) { reading ->
                ReadingCard(reading, reading.id in state.readingDeleting, {
                    editing = reading
                    showForm = true
                }, { deleteTarget = reading })
            }
        }
    }
}

@Composable
private fun ReadingCard(reading: GlucoseReadingDto, deleting: Boolean, onEdit: () -> Unit, onDelete: () -> Unit) {
    SectionCard("${reading.value} ${reading.unit}") {
        Text(contextLabel(reading.context), color = MutedInk)
        Text(formatDateTime(reading.measuredAt), color = MutedInk)
        reading.notes?.takeIf { it.isNotBlank() }?.let { Text(it) }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) {
            TactileOutlinedButton("Edit", onEdit, Modifier.weight(1f))
            TactileOutlinedButton(if (deleting) "Deleting..." else "Delete", onDelete, Modifier.weight(1f))
        }
    }
}

@Composable
private fun GlucoseForm(
    initial: GlucoseReadingDto?,
    saving: Boolean,
    error: String?,
    onCancel: () -> Unit,
    onSave: (String?, GlucoseReadingInput) -> Unit,
) {
    val context = LocalContext.current
    val initialTime = remember(initial?.id) {
        initial?.measuredAt?.let { runCatching { OffsetDateTime.parse(it) }.getOrNull() } ?: OffsetDateTime.now()
    }
    var value by rememberSaveable(initial?.id) { mutableStateOf(initial?.value.orEmpty()) }
    var unit by rememberSaveable(initial?.id) { mutableStateOf(initial?.unit ?: units.first()) }
    var measurementContext by rememberSaveable(initial?.id) { mutableStateOf(initial?.context ?: contexts.last()) }
    var measuredAt by rememberSaveable(initial?.id) { mutableStateOf(initialTime.toString()) }
    var notes by rememberSaveable(initial?.id) { mutableStateOf(initial?.notes.orEmpty()) }
    var validationError by rememberSaveable { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier.fillMaxSize().padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        BrandHeader()
        Text(if (initial == null) "Add reading" else "Edit reading", style = MaterialTheme.typography.headlineLarge)
        OutlinedTextField(value, { value = it; validationError = null }, Modifier.fillMaxWidth(), label = { Text("Glucose value") }, singleLine = true)
        ChoiceField("Unit", unit, units) { unit = it }
        ChoiceField("Context", contextLabel(measurementContext), contexts.map(::contextLabel)) { selected -> measurementContext = contexts[contexts.map(::contextLabel).indexOf(selected)] }
        TactileOutlinedButton("Measured ${formatDateTime(measuredAt)}", {
            val current = runCatching { OffsetDateTime.parse(measuredAt) }.getOrDefault(OffsetDateTime.now())
            DatePickerDialog(context, { _, year, month, day ->
                TimePickerDialog(context, { _, hour, minute ->
                    measuredAt = current.withYear(year).withMonth(month + 1).withDayOfMonth(day).withHour(hour).withMinute(minute).withSecond(0).withNano(0).toString()
                }, current.hour, current.minute, true).show()
            }, current.year, current.monthValue - 1, current.dayOfMonth).show()
        }, Modifier.fillMaxWidth())
        OutlinedTextField(notes, { notes = it }, Modifier.fillMaxWidth(), label = { Text("Notes (optional)") }, minLines = 2)
        validationError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        TactileButton(if (saving) "Saving..." else "Save reading", {
            val numeric = value.trim().toBigDecimalOrNull()
            if (numeric == null || numeric <= java.math.BigDecimal.ZERO || numeric > java.math.BigDecimal("1000")) {
                validationError = "Enter a value between 0 and 1000."
            } else {
                onSave(initial?.id, GlucoseReadingInput(value.trim(), unit, measuredAt, measurementContext, notes.trim().ifEmpty { null }))
            }
        }, Modifier.fillMaxWidth())
        TactileOutlinedButton("Cancel", onCancel, Modifier.fillMaxWidth())
    }
}

@Composable
private fun ChoiceField(label: String, value: String, options: List<String>, onSelected: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        TactileOutlinedButton("$label: $value", { expanded = true }, Modifier.fillMaxWidth())
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { option ->
                DropdownMenuItem(text = { Text(option) }, onClick = { onSelected(option); expanded = false })
            }
        }
    }
}

private fun contextLabel(value: String) = value.replace('_', ' ').lowercase().replaceFirstChar { it.titlecase() }

private fun formatDateTime(value: String): String = runCatching {
    OffsetDateTime.parse(value).atZoneSameInstant(ZoneId.systemDefault()).format(displayDateTime)
}.getOrDefault(value)
