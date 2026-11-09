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
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.glycotwin.patient.data.remote.LifestyleEntryInput
import com.glycotwin.patient.data.remote.LifestyleEntryDto
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
                    LifestyleTab(option) {
                        type = option
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
            SectionCard("Add $type") {
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
                    }, Modifier.fillMaxWidth())
                }
            }

        }
        state.lifestyleError?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
        if (state.lifestyleLoading) item { CircularProgressIndicator() }
        if (!state.lifestyleLoading && state.lifestyle.isEmpty()) item { EmptyState("No lifestyle entries", "Your saved daily health activity will appear here.") }
        items(state.lifestyle, key = { it.id }) { entry ->
            SectionCard(entry.type.replaceFirstChar { it.uppercase() }) {
                Text(entry.description ?: entry.activityType ?: entry.mealType ?: "${entry.sleepDurationMinutes} minutes")
                Text(entry.occurredAt, color = MutedInk)
                TactileOutlinedButton("Edit", {
                    editing = entry
                    type = entry.type
                    description = entry.description.orEmpty()
                    mealType = entry.mealType ?: mealType
                    activityType = entry.activityType.orEmpty()
                    customActivity = ""
                    duration = entry.durationMinutes?.toString().orEmpty()
                    sleepDuration = entry.sleepDurationMinutes?.toString().orEmpty()
                })
                TactileOutlinedButton("Delete", { viewModel.deleteLifestyle(entry.id) })
            }
        }

    }
}

@Composable
private fun RowScope.LifestyleTab(type: String, onClick: () -> Unit) {
    TactileOutlinedButton(
        type.replaceFirstChar { it.uppercase() },
        onClick,
        Modifier.weight(1f),
    )
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
