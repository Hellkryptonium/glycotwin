package com.glycotwin.patient.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.glycotwin.patient.ui.components.BrandHeader
import com.glycotwin.patient.ui.components.TactileButton
import com.glycotwin.patient.ui.theme.MutedInk
import com.glycotwin.patient.ui.theme.Pine
import com.glycotwin.patient.ui.viewmodel.AuthState

@Composable
fun RegisterScreen(state: AuthState, onSubmit: (String, String) -> Unit, onBack: () -> Unit, onLogin: () -> Unit) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var confirmPassword by rememberSaveable { mutableStateOf("") }
    var validationError by rememberSaveable { mutableStateOf<String?>(null) }
    AuthScaffold(title = "Create account", subtitle = "Use your email and a strong password.", onBack = onBack) {
        OutlinedTextField(email, { email = it; validationError = null }, Modifier.fillMaxWidth(), label = { Text("Email") }, singleLine = true)
        OutlinedTextField(password, { password = it; validationError = null }, Modifier.fillMaxWidth(), label = { Text("Password") }, visualTransformation = PasswordVisualTransformation(), singleLine = true)
        OutlinedTextField(confirmPassword, { confirmPassword = it; validationError = null }, Modifier.fillMaxWidth(), label = { Text("Confirm password") }, visualTransformation = PasswordVisualTransformation(), singleLine = true)
        AuthMessage(validationError)
        AuthMessage(state.error)
        TactileButton("Create account", { if (email.isBlank() || password.length < 12) validationError = "Enter a valid email and a 12-character password." else if (password != confirmPassword) validationError = "Passwords do not match." else onSubmit(email, password) }, Modifier.fillMaxWidth())
        if (state.loading) Text("Creating account...", color = MutedInk)
        if (state.registrationComplete) {
            Text("Account created. Sign in to continue.", color = Pine)
            TextButton(onClick = onLogin) { Text("Go to sign in") }
        }
    }
}

@Composable
fun LoginScreen(state: AuthState, onSubmit: (String, String) -> Unit, onBack: () -> Unit) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    AuthScaffold(title = "Welcome back", subtitle = "Sign in to continue your care journey.", onBack = onBack) {
        OutlinedTextField(email, { email = it }, Modifier.fillMaxWidth(), label = { Text("Email") }, singleLine = true)
        OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), label = { Text("Password") }, visualTransformation = PasswordVisualTransformation(), singleLine = true)
        AuthMessage(state.error)
        TactileButton("Sign in", { if (email.isBlank() || password.isBlank()) Unit else onSubmit(email, password) }, Modifier.fillMaxWidth())
        if (state.loading) Text("Signing in...", color = MutedInk)
    }
}

@Composable
private fun AuthMessage(message: String?) {
    if (!message.isNullOrBlank()) Text(message, color = MaterialTheme.colorScheme.error)
}

@Composable
private fun AuthScaffold(title: String, subtitle: String, onBack: () -> Unit, content: @Composable () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        BrandHeader()
        Spacer(Modifier.height(32.dp))
        Text(title, style = MaterialTheme.typography.headlineLarge)
        Text(subtitle, color = MutedInk)
        Spacer(Modifier.height(8.dp))
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) { content() }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            TextButton(onClick = onBack) { Text("Back") }
        }
    }
}
