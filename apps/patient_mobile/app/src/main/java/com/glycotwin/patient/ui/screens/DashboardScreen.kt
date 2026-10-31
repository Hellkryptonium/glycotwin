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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.glycotwin.patient.data.remote.InvitationDto
import com.glycotwin.patient.data.remote.UserDto
import com.glycotwin.patient.ui.components.BrandHeader
import com.glycotwin.patient.ui.components.EmptyState
import com.glycotwin.patient.ui.components.SectionCard
import com.glycotwin.patient.ui.components.StatusLabel
import com.glycotwin.patient.ui.components.TactileButton
import com.glycotwin.patient.ui.components.TactileOutlinedButton
import com.glycotwin.patient.ui.theme.Blush
import com.glycotwin.patient.ui.theme.MutedInk
import com.glycotwin.patient.ui.theme.Pine
import com.glycotwin.patient.ui.theme.Tomato
import com.glycotwin.patient.ui.viewmodel.InvitationAction
import com.glycotwin.patient.ui.viewmodel.PatientState
import com.glycotwin.patient.ui.viewmodel.PatientViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun DashboardScreen(user: UserDto?, patientViewModel: PatientViewModel, onLogout: () -> Unit) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val patientState by patientViewModel.state.collectAsState()
    LaunchedEffect(Unit) {
        patientViewModel.load()
    }
    LaunchedEffect(selectedTab) {
        if (selectedTab == 2) patientViewModel.refresh()
        if (selectedTab == 1) patientViewModel.loadReadings(refresh = true)
    }
    Scaffold(
        containerColor = com.glycotwin.patient.ui.theme.WarmOat,
        bottomBar = {
            NavigationBar(containerColor = com.glycotwin.patient.ui.theme.GlycoWhite) {
                NavigationBarItem(selected = selectedTab == 0, onClick = { selectedTab = 0 }, icon = { Text("01") }, label = { Text("Home") })
                NavigationBarItem(selected = selectedTab == 1, onClick = { selectedTab = 1 }, icon = { Text("02") }, label = { Text("Health") })
                NavigationBarItem(selected = selectedTab == 2, onClick = { selectedTab = 2 }, icon = { Text("03") }, label = { Text("Care team") })
                NavigationBarItem(selected = selectedTab == 3, onClick = { selectedTab = 3 }, icon = { Text("04") }, label = { Text("Profile") })
            }
        },
    ) { paddingValues ->
        when (selectedTab) {
            0 -> HomeContent(
                Modifier.padding(paddingValues),
                user,
                patientState,
                onCareTeam = { selectedTab = 2 },
            )
            1 -> HealthRecordsScreen(patientViewModel)
            2 -> CareTeamContent(Modifier.padding(paddingValues), patientState, patientViewModel)
            else -> ProfileScreen(patientViewModel, user, onLogout)
        }
    }
}

@Composable
private fun HomeContent(
    modifier: Modifier,
    user: UserDto?,
    state: PatientState,
    onCareTeam: () -> Unit,
) {
    val pendingCount = state.invitations.count { it.status == "pending" }
    val acceptedDoctor = state.invitations.firstOrNull { it.status == "accepted" }?.doctor
    LazyColumn(
        modifier = modifier.fillMaxSize().padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(vertical = 24.dp),
    ) {
        item { BrandHeader() }
        item {
            Column {
                Text("Good to see you${state.profile?.profile?.fullName?.let { ", $it" } ?: user?.patientProfile?.fullName?.let { ", $it" } ?: ""}.", style = MaterialTheme.typography.headlineLarge)
                Text("Your care, in reach.", color = MutedInk)
            }
        }
        item {
            SectionCard("Doctor connection") {
                when {
                    acceptedDoctor != null -> {
                        StatusLabel("Connected", Pine)
                        Text(acceptedDoctor.fullName ?: "Your doctor", color = MutedInk, modifier = Modifier.padding(top = 6.dp))
                    }
                    pendingCount > 0 -> {
                        StatusLabel("$pendingCount pending invitation${if (pendingCount == 1) "" else "s"}", Tomato)
                        TactileOutlinedButton("View care team", onCareTeam, Modifier.fillMaxWidth().padding(top = 12.dp))
                    }
                    else -> {
                        Text("No doctor connected", color = MutedInk)
                        TactileOutlinedButton("Open care team", onCareTeam, Modifier.fillMaxWidth().padding(top = 12.dp))
                    }
                }
            }
        }
        item { SectionCard("Health overview") { EmptyState("No health data yet", "Health information will appear here when it is available.", Blush) } }
        state.confirmation?.let { confirmation -> item { Text(confirmation, color = Pine) } }
        state.error?.let { error -> item { Text(error, color = MaterialTheme.colorScheme.error) } }
    }
}

@Composable
private fun CareTeamContent(modifier: Modifier, state: PatientState, viewModel: PatientViewModel) {
    LazyColumn(
        modifier = modifier.fillMaxSize().padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                BrandHeader()
                TactileOutlinedButton("Refresh", viewModel::refresh)
            }
        }
        item { Text("Care team", style = MaterialTheme.typography.headlineLarge) }
        state.confirmation?.let { confirmation -> item { Text(confirmation, color = Pine) } }
        state.error?.let { error -> item { Text(error, color = MaterialTheme.colorScheme.error) } }
        if (state.loading) item { CircularProgressIndicator() }
        if (state.invitations.isEmpty() && !state.loading) {
            item { EmptyState("No invitations", "Doctor invitations will appear here.") }
        } else {
            items(state.invitations, key = { it.id }) { invitation ->
                InvitationCard(invitation, invitation.id in state.actionInProgress, viewModel::respond)
            }
        }
    }
}

@Composable
private fun InvitationCard(invitation: InvitationDto, actionInProgress: Boolean, respond: (String, InvitationAction) -> Unit) {
    SectionCard(invitation.doctor?.fullName ?: "Doctor invitation") {
        Text(statusLabel(invitation.status), color = statusColor(invitation.status))
        invitation.createdAt?.let { date ->
            Text("Received ${formatDate(date)}", color = MutedInk, style = MaterialTheme.typography.bodySmall)
        }
        if (invitation.status == "pending") {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth().padding(top = 12.dp)) {
                TactileButton(
                    if (actionInProgress) "Updating..." else "Accept",
                    { if (!actionInProgress) respond(invitation.id, InvitationAction.ACCEPT) },
                    Modifier.weight(1f),
                )
                TactileOutlinedButton(
                    "Decline",
                    { if (!actionInProgress) respond(invitation.id, InvitationAction.DECLINE) },
                    Modifier.weight(1f),
                )
            }
        }
    }
}

private fun statusLabel(status: String): String = when (status) {
    "accepted" -> "Accepted"
    "declined" -> "Declined"
    "expired" -> "Expired"
    "cancelled" -> "Cancelled"
    else -> "Pending"
}

private fun statusColor(status: String) = when (status) {
    "accepted" -> Pine
    "pending" -> Tomato
    else -> MutedInk
}

private fun formatDate(value: String): String = runCatching {
    DateTimeFormatter.ofPattern("d MMM yyyy").format(
        Instant.parse(value).atZone(ZoneId.systemDefault()),
    )
}.getOrDefault(value)
