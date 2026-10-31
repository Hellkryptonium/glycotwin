package com.glycotwin.patient.ui.screens

import android.app.DatePickerDialog
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
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
import com.glycotwin.patient.data.remote.PatientProfileUpdate
import com.glycotwin.patient.data.remote.UserDto
import com.glycotwin.patient.ui.components.BrandHeader
import com.glycotwin.patient.ui.components.SectionCard
import com.glycotwin.patient.ui.components.TactileButton
import com.glycotwin.patient.ui.components.TactileOutlinedButton
import com.glycotwin.patient.ui.theme.MutedInk
import com.glycotwin.patient.ui.theme.Pine
import com.glycotwin.patient.ui.viewmodel.PatientViewModel
import java.time.LocalDate

@Composable
fun ProfileScreen(
    viewModel: PatientViewModel,
    user: UserDto?,
    onLogout: () -> Unit,
    required: Boolean = false,
) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    var fullName by rememberSaveable { mutableStateOf("") }
    var dateOfBirth by rememberSaveable { mutableStateOf<String?>(null) }
    var gender by rememberSaveable { mutableStateOf("") }
    var diabetesType by rememberSaveable { mutableStateOf("") }
    var validationError by rememberSaveable { mutableStateOf<String?>(null) }
    var editing by rememberSaveable { mutableStateOf(required) }

    LaunchedEffect(state.profile?.profile?.id) {
        state.profile?.profile?.let { profile ->
            fullName = profile.fullName.orEmpty()
            dateOfBirth = profile.dateOfBirth
            gender = profile.gender.orEmpty()
            diabetesType = profile.diabetesType.orEmpty()
            editing = required
        }
    }
    LaunchedEffect(state.confirmation) {
        if (!required && !state.confirmation.isNullOrBlank()) editing = false
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        BrandHeader()
        Text(if (required) "Complete your profile" else "Profile")
        if (required) Text("Add your name to continue.", color = MutedInk)
        if (state.profileLoading) {
            CircularProgressIndicator()
        } else if (state.profile == null) {
            Text(state.error ?: "Profile is unavailable.")
            TactileOutlinedButton("Retry", viewModel::loadProfile, Modifier.fillMaxWidth())
        } else {
            SectionCard("Account") {
                Text(user?.email ?: state.profile?.email.orEmpty(), color = MutedInk)
            }
            SectionCard("Your information") {
                if (!editing) {
                    Text(fullName)
                    Text(dateOfBirth ?: "Date of birth not provided", color = MutedInk)
                    Text(gender.ifBlank { "Gender not provided" }, color = MutedInk)
                    Text(diabetesType.ifBlank { "Diabetes type not provided" }, color = MutedInk)
                    TactileButton("Edit profile", { editing = true }, Modifier.fillMaxWidth())
                } else {
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
                    OutlinedTextField(diabetesType, { diabetesType = it }, Modifier.fillMaxWidth(), label = { Text("Diabetes type (optional)") }, singleLine = true)
                    validationError?.let { Text(it) }
                    state.error?.let { Text(it) }
                    state.confirmation?.let { Text(it, color = Pine) }
                    TactileButton(
                        if (state.profileSaving) "Saving..." else "Save profile",
                        {
                            if (fullName.trim().isEmpty()) validationError = "Full name is required."
                            else viewModel.saveProfile(PatientProfileUpdate(fullName.trim(), dateOfBirth, gender.trim().ifEmpty { null }, diabetesType.trim().ifEmpty { null }))
                        },
                        Modifier.fillMaxWidth(),
                    )
                    if (!required) {
                        TactileOutlinedButton("Cancel", {
                            state.profile?.profile?.let { profile ->
                                fullName = profile.fullName.orEmpty()
                                dateOfBirth = profile.dateOfBirth
                                gender = profile.gender.orEmpty()
                                diabetesType = profile.diabetesType.orEmpty()
                            }
                            validationError = null
                            editing = false
                        }, Modifier.fillMaxWidth())
                    }
                }
            }
        }
        if (!required) TactileOutlinedButton("Log out", onLogout, Modifier.fillMaxWidth())
    }
}
