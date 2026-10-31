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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.glycotwin.patient.ui.components.BrandHeader
import com.glycotwin.patient.ui.components.EmptyState
import com.glycotwin.patient.ui.components.TactileButton
import com.glycotwin.patient.ui.components.TactileOutlinedButton
import com.glycotwin.patient.ui.theme.MutedInk
import com.glycotwin.patient.ui.theme.Pine

@Composable
fun WelcomeScreen(onGetStarted: () -> Unit, onSignIn: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 28.dp),
        verticalArrangement = Arrangement.SpaceBetween,
    ) {
        BrandHeader()
        Column(modifier = Modifier.padding(vertical = 56.dp)) {
            Text("YOUR CARE,\nIN REACH.", style = MaterialTheme.typography.displayLarge, fontWeight = FontWeight.Normal)
            Spacer(Modifier.height(18.dp))
            Text(
                "GlycoTwin helps you stay connected with your healthcare team and keep your care journey in one thoughtful place.",
                style = MaterialTheme.typography.bodyLarge,
                color = MutedInk,
            )
            Spacer(Modifier.height(28.dp))
            EmptyState(
                title = "Your health space starts here.",
                message = "The patient experience is being built for Android, with your privacy and your everyday rhythm in mind.",
                accent = com.glycotwin.patient.ui.theme.Blush,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            TactileButton("Get started", onGetStarted, Modifier.fillMaxWidth())
            TactileOutlinedButton("Sign in", onSignIn, Modifier.fillMaxWidth())
        }
    }
}
