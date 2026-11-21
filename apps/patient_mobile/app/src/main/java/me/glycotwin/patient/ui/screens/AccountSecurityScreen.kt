package me.glycotwin.patient.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
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
import me.glycotwin.patient.ui.components.BrandHeader
import me.glycotwin.patient.ui.components.SectionCard
import me.glycotwin.patient.ui.components.TactileButton
import me.glycotwin.patient.ui.components.TactileOutlinedButton
import me.glycotwin.patient.ui.theme.MutedInk
import me.glycotwin.patient.ui.theme.GlycoWhite
import me.glycotwin.patient.ui.theme.Tomato
import me.glycotwin.patient.ui.viewmodel.AuthViewModel

@Composable
fun AccountSecurityScreen(
    viewModel: AuthViewModel,
    email: String,
    onBack: () -> Unit,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsState()
    var changingPassword by remember { mutableStateOf(false) }
    var delete by remember { mutableStateOf(false) }

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        BrandHeader()
        Text("Account & security", style = MaterialTheme.typography.headlineLarge)
        TactileOutlinedButton("Back to profile", onBack, Modifier.fillMaxWidth(), enabled = !state.loading)
        SectionCard("Sign-in details") {
            Text(email, color = MutedInk)
            if (!changingPassword) {
                TactileOutlinedButton(
                    "Change password",
                    { viewModel.clearMessage(); changingPassword = true },
                    Modifier.fillMaxWidth(),
                    enabled = !state.loading,
                )
            }
        }

        if (changingPassword) {
            var current by remember { mutableStateOf("") }
            var password by remember { mutableStateOf("") }
            var confirmation by remember { mutableStateOf("") }
            var validation by remember { mutableStateOf<String?>(null) }
            SectionCard("Change password") {
                PasswordField(current, { current = it }, "Current password")
                PasswordField(password, { password = it; validation = null }, "New password", new = true)
                PasswordField(confirmation, { confirmation = it; validation = null }, "Confirm new password", new = true)
                if (!delete) AuthMessages(state, validation)
                TactileButton(
                    if (state.loading) "Updating…" else "Update password",
                    {
                        validation = newPasswordError(password, confirmation)
                        if (validation == null) viewModel.changePassword(current, password)
                    },
                    Modifier.fillMaxWidth(),
                    enabled = !state.loading && current.isNotEmpty(),
                )
                TactileOutlinedButton(
                    "Cancel", { viewModel.clearMessage(); changingPassword = false },
                    Modifier.fillMaxWidth(), enabled = !state.loading,
                )
            }
        }
        SectionCard("Manage account") {
            TactileOutlinedButton("Sign out", onLogout, Modifier.fillMaxWidth(), enabled = !state.loading)
            Text("Permanently remove your account, personal profile and health records.", color = MutedInk)
            Button(
                onClick = { viewModel.clearMessage(); delete = true },
                modifier = Modifier.fillMaxWidth(),
                enabled = !state.loading,
                colors = ButtonDefaults.buttonColors(containerColor = Tomato, contentColor = GlycoWhite),
            ) { Text("Delete account") }
        }
    }

    if (delete) {
        var password by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { if (!state.loading) { delete = false; viewModel.clearMessage() } },
            title = { Text("Delete your account?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Your profile and health records will be permanently removed, and your care team’s access will end.")
                    PasswordField(password, { password = it }, "Current password")
                    AuthMessages(state)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { delete = false; viewModel.clearMessage() },
                    enabled = !state.loading,
                ) { Text("Cancel") }
            },
            confirmButton = {
                TextButton(onClick = { viewModel.deleteAccount(password) }, enabled = !state.loading && password.isNotEmpty()) {
                    Text(if (state.loading) "Deleting…" else "Delete permanently", color = Tomato)
                }
            },
        )
    }
}
