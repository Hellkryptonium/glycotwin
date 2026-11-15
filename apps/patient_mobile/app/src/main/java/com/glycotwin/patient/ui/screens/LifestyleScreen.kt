package com.glycotwin.patient.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.BorderStroke
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.glycotwin.patient.data.remote.LifestyleEntryInput
import com.glycotwin.patient.data.remote.LifestyleEntryDto
import com.glycotwin.patient.ui.components.BrandHeader
import com.glycotwin.patient.ui.components.EmptyState
import com.glycotwin.patient.ui.components.SectionCard
import com.glycotwin.patient.ui.components.TactileButton
import com.glycotwin.patient.ui.components.TactileOutlinedButton
import com.glycotwin.patient.ui.theme.MutedInk
import com.glycotwin.patient.ui.theme.Ink
import com.glycotwin.patient.ui.viewmodel.PatientViewModel
import java.time.OffsetDateTime
import java.time.ZoneOffset

@Composable
fun LifestyleScreen(viewModel: PatientViewModel, modifier: Modifier = Modifier) {
    val state by viewModel.state.collectAsState()
    var type by remember { mutableStateOf("meal") }
    var description by remember { mutableStateOf("") }
    var mealType by remember { mutableStateOf("breakfast") }
    var activityType by remember { mutableStateOf("Walking") }
    var customActivity by remember { mutableStateOf("") }
    var duration by remember { mutableStateOf("") }
    var sleepDuration by remember { mutableStateOf("") }
    var editing by remember { mutableStateOf<LifestyleEntryDto?>(null) }
    var showForm by remember { mutableStateOf(false) }
    LazyColumn(
        modifier.fillMaxSize().padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(top = 20.dp, bottom = 24.dp),
    ) {
        item { BrandHeader() }
        item { Text("Lifestyle", style = MaterialTheme.typography.headlineLarge) }
        item { Text("Record meals, activity, sleep, and symptoms.", color = MutedInk) }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("meal", "activity", "sleep", "symptom").forEach { option ->
                    LifestyleTab(option, selected = type == option) {
                        type = option
                        editing = null
                        showForm = false
                        description = ""
                        if (option == "activity" && activityType.isBlank()) activityType = "Walking"
                        customActivity = ""
                        duration = ""
                        sleepDuration = ""
                    }
                }
            }
        }
        item {
            TactileButton(
                "Add ${type.displayName()}",
                {
                    editing = null
                    description = ""
                    customActivity = ""
                    duration = ""
                    sleepDuration = ""
                    showForm = true
                },
                Modifier.fillMaxWidth(),
            )
        }
        if (showForm) {
            item {
                SectionCard(if (editing == null) "Add ${type.displayName()}" else "Edit ${type.displayName()}") {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (type == "meal") {
                            LifestyleDropdown(
                                label = "Meal type",
                                value = mealType.replaceFirstChar { it.uppercase() },
                                options = listOf("Breakfast", "Lunch", "Snack", "Dinner"),
                                onSelected = { mealType = it.lowercase() },
                            )
                        }
                        if (type == "activity") {
                            LifestyleDropdown(
                                label = "Activity type",
                                value = if (activityType == "Custom") "Custom" else activityType,
                                options = listOf("Walking", "Running", "Cycling", "Swimming", "Yoga", "Strength training", "Sports", "Custom"),
                                onSelected = {
                                    activityType = it
                                    if (it != "Custom") customActivity = ""
                                },
                            )
                            if (activityType == "Custom") {
                                OutlinedTextField(
                                    customActivity,
                                    { customActivity = it },
                                    Modifier.fillMaxWidth(),
                                    label = { Text("Custom activity") },
                                    singleLine = true,
                                )
                            }
                            OutlinedTextField(duration, { duration = it }, Modifier.fillMaxWidth(), label = { Text("Duration (minutes)") })
                        }
                        if (type == "sleep") OutlinedTextField(sleepDuration, { sleepDuration = it }, Modifier.fillMaxWidth(), label = { Text("Sleep duration (minutes)") })
                        OutlinedTextField(description, { description = it }, Modifier.fillMaxWidth(), label = { Text(if (type == "symptom") "Symptom" else "Description") })
                        TactileButton(if (state.lifestyleSaving) "Saving..." else if (editing == null) "Save entry" else "Update entry", {
                            val activityMinutes = duration.toDurationMinutes()
                            val sleepMinutes = sleepDuration.toSleepMinutes()
                            val input = LifestyleEntryInput(
                                type = type,
                                occurredAt = OffsetDateTime.now(ZoneOffset.UTC).toString(),
                                mealType = if (type == "meal") mealType else null,
                                description = description.ifBlank { null },
                                activityType = if (type == "activity") {
                                    (if (activityType == "Custom") customActivity else activityType).ifBlank { null }
                                } else null,
                                durationMinutes = if (type == "activity") activityMinutes else null,
                                sleepDurationMinutes = if (type == "sleep") sleepMinutes else null,
                            )
                            editing?.let { viewModel.updateLifestyle(it.id, input) } ?: viewModel.addLifestyle(input)
                            description = ""
                            editing = null
                            showForm = false
                        }, Modifier.fillMaxWidth())
                    }
                }
            }
        }
        val selectedEntries = state.lifestyle.filter { it.type == type }
        item { Text(type.historyTitle(), style = MaterialTheme.typography.titleLarge) }
        state.lifestyleError?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
        if (state.lifestyleLoading) item { CircularProgressIndicator() }
        if (!state.lifestyleLoading && selectedEntries.isEmpty()) {
            item { EmptyState("No ${type.displayName().lowercase()} history", "Your saved ${type.displayName().lowercase()} records will appear here.") }
        } else {
            selectedEntries.forEach { entry ->
                item(key = entry.id) {
                    LifestyleRecordCard(
                        entry = entry,
                        onEdit = {
                            editing = it
                            type = it.type
                            description = it.description.orEmpty()
                            mealType = it.mealType ?: mealType
                            activityType = it.activityType.orEmpty()
                            customActivity = ""
                            duration = it.durationMinutes?.toString().orEmpty()
                            sleepDuration = it.sleepDurationMinutes?.toString().orEmpty()
                            showForm = true
                        },
                        onDelete = viewModel::deleteLifestyle,
                    )
                }
            }
        }
    }
}

@Composable
private fun LifestyleRecordCard(
    entry: LifestyleEntryDto,
    onEdit: (LifestyleEntryDto) -> Unit,
    onDelete: (String) -> Unit,
) {
    SectionCard(entryTitle(entry), Modifier.fillMaxWidth().padding(top = 4.dp)) {
        Text(entryDescription(entry), style = MaterialTheme.typography.bodyLarge)
        Text("Recorded: ${formatLifestyleDate(entry.occurredAt)}", color = MutedInk, style = MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
            TactileOutlinedButton("Edit", { onEdit(entry) }, Modifier.weight(1f))
            TactileOutlinedButton("Delete", { onDelete(entry.id) }, Modifier.weight(1f))
        }
    }
}

private fun entryTitle(entry: LifestyleEntryDto): String = when (entry.type) {
    "meal" -> entry.mealType?.replaceFirstChar { it.uppercase() } ?: "Meal"
    "activity" -> entry.activityType ?: "Activity"
    "sleep" -> "Sleep record"
    else -> entry.description ?: "Symptom"
}

private fun entryDescription(entry: LifestyleEntryDto): String = when (entry.type) {
    "activity" -> listOfNotNull(
        entry.durationMinutes?.let { "$it minutes" },
        entry.description,
    ).joinToString(" · ").ifBlank { "Recorded activity" }
    "sleep" -> listOfNotNull(
        entry.sleepDurationMinutes?.let { "$it minutes" },
        entry.description,
    ).joinToString(" · ").ifBlank { "Recorded sleep" }
    else -> entry.description ?: entry.activityType ?: entry.mealType ?: "Recorded entry"
}

private fun formatLifestyleDate(value: String): String = runCatching {
    java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy · h:mm a")
        .format(java.time.OffsetDateTime.parse(value).atZoneSameInstant(java.time.ZoneId.systemDefault()))
}.getOrDefault(value)

@Composable
private fun RowScope.LifestyleTab(type: String, selected: Boolean, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        modifier = Modifier.weight(1f),
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(2.dp, Ink),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = if (selected) Color(0xFF00B894) else Color.Transparent,
            contentColor = Ink,
        ),
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp),
    ) {
        Text(
            type.displayName(),
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            maxLines = 1,
        )
    }
}

private fun String.displayName(): String = replaceFirstChar { it.uppercase() }

private fun String.historyTitle(): String = when (this) {
    "meal" -> "Meals"
    "activity" -> "Physical Activity"
    "sleep" -> "Sleep"
    else -> "Symptoms"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LifestyleDropdown(
    label: String,
    value: String,
    options: List<String>,
    onSelected: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded },
        modifier = Modifier.fillMaxWidth(),
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            singleLine = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option) },
                    onClick = {
                        onSelected(option)
                        expanded = false
                    },
                )
            }
        }
    }
}

private fun String.toDurationMinutes(): Int? =
    Regex("""^\s*(\d+)""").find(this)?.groupValues?.get(1)?.toIntOrNull()

private fun String.toSleepMinutes(): Int? =
    trim().lowercase().let { value ->
        val amount = Regex("""^\s*(\d+)""").find(value)?.groupValues?.get(1)?.toIntOrNull()
        when {
            amount == null -> null
            value.contains("hour") || value.endsWith("h") -> amount * 60
            else -> amount
        }
    }
