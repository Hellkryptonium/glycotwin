package me.glycotwin.patient.ui.screens

import android.app.DatePickerDialog
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import me.glycotwin.patient.data.remote.PatientProfileUpdate
import me.glycotwin.patient.data.remote.UserDto
import me.glycotwin.patient.ui.components.ProfileAvatar
import me.glycotwin.patient.ui.components.BrandHeader
import me.glycotwin.patient.ui.components.SectionCard
import me.glycotwin.patient.ui.components.TactileButton
import me.glycotwin.patient.ui.components.TactileOutlinedButton
import me.glycotwin.patient.ui.theme.MutedInk
import me.glycotwin.patient.ui.theme.Pine
import me.glycotwin.patient.ui.viewmodel.PatientViewModel
import java.time.LocalDate

@Composable
fun ProfileScreen(
    viewModel: PatientViewModel,
    user: UserDto?,
    onLogout: () -> Unit,
    required: Boolean = false,
    modifier: Modifier = Modifier,
    onBack: () -> Unit = {},
    onAccountSecurity: () -> Unit = {},
    onCareTeam: () -> Unit = {},
    onDataConnections: () -> Unit = {},
) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    var fullName by rememberSaveable { mutableStateOf("") }
    var dateOfBirth by rememberSaveable { mutableStateOf<String?>(null) }
    var gender by rememberSaveable { mutableStateOf("") }
    var diabetesType by rememberSaveable { mutableStateOf("") }
    var treatmentContext by rememberSaveable { mutableStateOf("") }
    var validationError by rememberSaveable { mutableStateOf<String?>(null) }
    var editing by rememberSaveable { mutableStateOf(required) }
    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) runCatching { context.contentResolver.openInputStream(uri)?.use { it.readBytes() } }.getOrNull()?.let(viewModel::uploadProfilePhoto)
    }
    LaunchedEffect(state.profile?.profile?.id) {
        state.profile?.profile?.let { profile ->
            fullName = profile.fullName.orEmpty()
            dateOfBirth = profile.dateOfBirth
            gender = profile.gender.orEmpty()
            diabetesType = profile.diabetesType.orEmpty()
            treatmentContext = profile.treatmentContext.orEmpty()
            editing = required
        }
    }
    LaunchedEffect(state.confirmation) {
        if (!required && state.confirmation == "Profile saved.") editing = false
    }

    Column(
        modifier = modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        BrandHeader()
        Text(if (required) "Complete your profile" else "Profile", style = MaterialTheme.typography.headlineLarge)
        if (required) Text("Add your name to continue.", color = MutedInk)
        else TactileOutlinedButton("Back to Today", onBack, Modifier.fillMaxWidth())
        if (state.profileLoading) {
            CircularProgressIndicator()
        } else if (state.profile == null) {
            Text(state.error ?: "Profile is unavailable.")
            TactileOutlinedButton("Retry", viewModel::loadProfile, Modifier.fillMaxWidth())
        } else {
            if (!editing) {
                SectionCard("Personal details") {
                    ProfileAvatar(fullName)
                    TactileOutlinedButton(if (state.profileSaving) "Uploading photo…" else "Choose profile photo", { photoPicker.launch("image/*") }, Modifier.fillMaxWidth(), enabled = !state.profileSaving)
                    Text(fullName, style = MaterialTheme.typography.titleLarge)
                    Text(state.profile?.email ?: user?.email.orEmpty(), color = MutedInk)
                    dateOfBirth?.let { Text("Born $it", color = MutedInk) }
                    if (gender.isNotBlank()) Text(gender, color = MutedInk)
                    TactileButton("Edit profile", { editing = true }, Modifier.fillMaxWidth())
                }
                SectionCard("Diabetes and treatment") {
                    Text(diabetesType.ifBlank { "Diabetes type not provided" }, color = MutedInk)
                    Text(treatmentChoices[treatmentContext] ?: "Treatment context not provided", color = MutedInk)
                }
                state.confirmation?.takeIf { it == "Profile saved." }?.let { Text(it, color = Pine) }
            } else {
                SectionCard("Edit your information") {
                    OutlinedTextField(fullName, { fullName = it; validationError = null }, Modifier.fillMaxWidth(), label = { Text("Full name") }, singleLine = true)
                    TactileOutlinedButton(
                        dateOfBirth?.let { "Date of birth: $it" } ?: "Set date of birth",
                        {
                            val initial = dateOfBirth?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: LocalDate.now()
                            DatePickerDialog(context, { _, year, month, day ->
                                dateOfBirth = "%04d-%02d-%02d".format(year, month + 1, day)
                            }, initial.year, initial.monthValue - 1, initial.dayOfMonth).show()
                        },
                        Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(gender, { gender = it }, Modifier.fillMaxWidth(), label = { Text("Gender (optional)") }, singleLine = true)
                    val knownTypes = linkedMapOf(
                        "" to "Not provided",
                        "Type 1 diabetes" to "Type 1 diabetes",
                        "Type 2 diabetes" to "Type 2 diabetes",
                        "Gestational diabetes" to "Gestational diabetes",
                        "Other" to "Other",
                        "Unsure" to "Unsure",
                    )
                    // Keep a previous free-text entry available until the patient chooses another value.
                    if (diabetesType !in knownTypes) knownTypes[diabetesType] = diabetesType
                    ProfileChoice("Diabetes type", diabetesType, knownTypes) { diabetesType = it }
                    val contextChoices = if (state.profile?.profile?.treatmentContext != null) {
                        treatmentChoices.filterKeys { it.isNotEmpty() }
                    } else treatmentChoices
                    ProfileChoice("Treatment context", treatmentContext, contextChoices) { treatmentContext = it }
                    validationError?.let { Text(it) }
                    state.error?.let { Text(it) }
                    state.confirmation?.let { Text(it, color = Pine) }
                    TactileButton(
                        if (state.profileSaving) "Saving..." else "Save profile",
                        {
                            if (fullName.trim().isEmpty()) validationError = "Full name is required."
                            else viewModel.saveProfile(
                                PatientProfileUpdate(
                                    fullName.trim(), dateOfBirth, gender.trim().ifEmpty { null },
                                    diabetesType.ifEmpty { null },
                                    treatmentContext.ifEmpty { null },
                                ),
                            )
                        },
                        Modifier.fillMaxWidth(),
                        enabled = !state.profileSaving,
                    )
                    if (!required) {
                        TactileOutlinedButton("Cancel", {
                            state.profile?.profile?.let { profile ->
                                fullName = profile.fullName.orEmpty()
                                dateOfBirth = profile.dateOfBirth
                                gender = profile.gender.orEmpty()
                                diabetesType = profile.diabetesType.orEmpty()
                                treatmentContext = profile.treatmentContext.orEmpty()
                            }
                            validationError = null
                            editing = false
                        }, Modifier.fillMaxWidth())
                    }
                }
            }
        }
        if (required) {
            TactileOutlinedButton("Sign out", onLogout, Modifier.fillMaxWidth())
        } else {
            SectionCard("Account & care") {
                TactileOutlinedButton("Account & security", onAccountSecurity, Modifier.fillMaxWidth())
                TactileOutlinedButton("Care team and sharing", onCareTeam, Modifier.fillMaxWidth())
                TactileOutlinedButton("Data connections", onDataConnections, Modifier.fillMaxWidth())
            }
        }
    }
}

private val treatmentChoices = linkedMapOf(
    "" to "Not provided",
    "INSULIN" to "Uses insulin",
    "NON_INSULIN" to "Non-insulin medication",
    "LIFESTYLE" to "Lifestyle management",
    "UNKNOWN" to "Unsure",
)

@Composable
internal fun ProfileChoice(label: String, selected: String, options: Map<String, String>, choose: (String) -> Unit) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    Box(Modifier.fillMaxWidth()) {
        TactileOutlinedButton("$label · ${options[selected] ?: "Not provided"}", { expanded = true }, Modifier.fillMaxWidth())
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            for ((id, display) in options) {
                DropdownMenuItem(text = { Text(display) }, onClick = { choose(id); expanded = false })
            }
        }
    }
}
