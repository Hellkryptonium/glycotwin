package me.glycotwin.patient.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import me.glycotwin.patient.ui.components.BrandHeader
import me.glycotwin.patient.ui.components.TactileButton
import me.glycotwin.patient.ui.theme.MutedInk
import me.glycotwin.patient.ui.theme.Pine
import me.glycotwin.patient.ui.viewmodel.AuthState

private const val MINIMUM_PASSWORD_LENGTH = 8

internal fun newPasswordError(password: String, confirmation: String): String? = when {
    password.codePointCount(0, password.length) < MINIMUM_PASSWORD_LENGTH -> "Use at least 8 characters."
    password != confirmation -> "Passwords don’t match."
    else -> null
}

@Composable
fun RegisterScreen(state: AuthState, onSubmit: (String, String) -> Unit, onBack: () -> Unit, onLogin: () -> Unit) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmation by remember { mutableStateOf("") }
    var validation by remember { mutableStateOf<String?>(null) }
    AuthScaffold("Create account", "Use your email and a password with at least 8 characters.", onBack) {
        EmailField(email, { email = it; validation = null }, create = true)
        PasswordField(password, { password = it; validation = null }, "Password", new = true)
        PasswordField(confirmation, { confirmation = it; validation = null }, "Confirm password", new = true)
        AuthMessages(state, validation)
        TactileButton(
            if (state.loading) "Creating account…" else "Create account",
            onClick = {
                validation = if (email.isBlank()) "Enter your email address." else newPasswordError(password, confirmation)
                if (validation == null) onSubmit(email.trim(), password)
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = !state.loading,
        )
        TextButton(onClick = onLogin, enabled = !state.loading) { Text("Go to sign in") }
    }
}

@Composable
fun LoginScreen(state: AuthState, onSubmit: (String, String) -> Unit, onBack: () -> Unit) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    AuthScaffold("Welcome back", "Sign in to your GlycoTwin account.", onBack) {
        EmailField(email, { email = it })
        PasswordField(password, { password = it }, "Password")
        AuthMessages(state)
        TactileButton(
            if (state.loading) "Signing in…" else "Sign in",
            { onSubmit(email.trim(), password) },
            Modifier.fillMaxWidth(),
            enabled = !state.loading && email.isNotBlank() && password.isNotEmpty(),
        )
    }
}

@Composable
fun RestoringSessionScreen(state: AuthState, onRetry: () -> Unit, onSignOut: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        BrandHeader()
        if (state.restoring) {
            CircularProgressIndicator()
            Text("Restoring your session…", color = MutedInk)
        } else {
            Text("Reconnect to GlycoTwin", style = MaterialTheme.typography.headlineLarge)
            AuthMessages(state)
            TactileButton("Try again", onRetry, Modifier.fillMaxWidth(), enabled = !state.loading)
            TextButton(onClick = onSignOut, enabled = !state.loading) { Text("Sign out") }
        }
    }
}

@Composable
private fun EmailField(value: String, update: (String) -> Unit, create: Boolean = false) {
    OutlinedTextField(
        value,
        update,
        Modifier.fillMaxWidth().semantics { contentType = if (create) ContentType.NewUsername else ContentType.EmailAddress },
        label = { Text("Email") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
        singleLine = true,
    )
}

@Composable
internal fun PasswordField(
    value: String,
    update: (String) -> Unit,
    label: String,
    new: Boolean = false,
) {
    OutlinedTextField(
        value,
        update,
        Modifier.fillMaxWidth().semantics { contentType = if (new) ContentType.NewPassword else ContentType.Password },
        label = { Text(label) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        visualTransformation = PasswordVisualTransformation(),
        singleLine = true,
    )
}

@Composable
internal fun AuthMessages(state: AuthState, validation: String? = null) {
    (validation ?: state.error)?.let { Text(it, color = MaterialTheme.colorScheme.error) }
    state.notice?.let { Text(it, color = Pine) }
}

@Composable
private fun AuthScaffold(title: String, subtitle: String, onBack: () -> Unit, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        BrandHeader()
        Spacer(Modifier.height(32.dp))
        Text(title, style = MaterialTheme.typography.headlineLarge)
        Text(subtitle, color = MutedInk)
        Spacer(Modifier.height(8.dp))
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) { content() }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            TextButton(onClick = onBack) { Text("Back") }
        }
    }
}
