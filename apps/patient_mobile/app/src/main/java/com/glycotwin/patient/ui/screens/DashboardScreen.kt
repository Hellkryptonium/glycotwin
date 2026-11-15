package com.glycotwin.patient.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.ShowChart
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.DirectionsWalk
import androidx.compose.material.icons.filled.Bloodtype
import androidx.compose.material.icons.filled.Medication
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Medication
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp
import com.glycotwin.patient.data.remote.InvitationDto
import com.glycotwin.patient.data.remote.UserDto
import com.glycotwin.patient.ui.components.BrandHeader
import com.glycotwin.patient.ui.components.ProfileAvatar
import com.glycotwin.patient.ui.components.EmptyState
import com.glycotwin.patient.ui.components.SectionCard
import com.glycotwin.patient.ui.components.StatusLabel
import com.glycotwin.patient.ui.components.TactileButton
import com.glycotwin.patient.ui.components.TactileOutlinedButton
import com.glycotwin.patient.ui.components.TintedSectionCard
import com.glycotwin.patient.ui.theme.Blush
import com.glycotwin.patient.ui.theme.BrandMint
import com.glycotwin.patient.ui.theme.BrandTeal
import com.glycotwin.patient.ui.theme.GlycoWhite
import com.glycotwin.patient.ui.theme.Ink
import com.glycotwin.patient.ui.theme.MutedInk
import com.glycotwin.patient.ui.theme.Pine
import com.glycotwin.patient.ui.theme.Tomato
import com.glycotwin.patient.ui.viewmodel.InvitationAction
import com.glycotwin.patient.ui.viewmodel.PatientState
import com.glycotwin.patient.ui.viewmodel.PatientViewModel
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun DashboardScreen(user: UserDto?, patientViewModel: PatientViewModel, onLogout: () -> Unit) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val patientState by patientViewModel.state.collectAsState()
    var homeVisited by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        patientViewModel.load()
    }
    LaunchedEffect(selectedTab) {
        if (selectedTab == 0) {
            if (homeVisited) patientViewModel.refreshHome()
            homeVisited = true
        }
        if (selectedTab == 2) patientViewModel.refresh()
        if (selectedTab == 1) patientViewModel.loadReadings(refresh = true)
    }
    Scaffold(
        containerColor = com.glycotwin.patient.ui.theme.WarmOat,
        bottomBar = {
            GlycoBottomNavigation(selectedTab) { selectedTab = it }
        },
    ) { paddingValues ->
        when (selectedTab) {
            0 -> HomeContent(
                Modifier.padding(paddingValues),
                user,
                patientState,
                onCareTeam = { selectedTab = 2 },
                onHealth = { selectedTab = 1 },
                onMedication = { selectedTab = 5 },
                onLifestyle = { selectedTab = 4 },
                onProfile = { selectedTab = 6 },
            )
            1 -> HealthRecordsScreen(
                patientViewModel,
                Modifier.padding(paddingValues),
            )
            2 -> CareTeamContent(Modifier.padding(paddingValues), patientState, patientViewModel)
            3 -> HealthTrendsScreen(patientViewModel, Modifier.padding(paddingValues))
            4 -> LifestyleScreen(patientViewModel, Modifier.padding(paddingValues))
            5 -> MedicationScreen(patientViewModel, Modifier.padding(paddingValues), onBack = { selectedTab = 1 })
            else -> ProfileScreen(patientViewModel, user, onLogout)
        }
    }
}

@Composable
private fun GlycoBottomNavigation(selectedTab: Int, onTabSelected: (Int) -> Unit) {
    val items = listOf(
        NavigationDestination("Home", Icons.Default.Home),
        NavigationDestination("Health", Icons.Default.Favorite),
        NavigationDestination("Care", Icons.Default.Groups),
        NavigationDestination("Trends", Icons.Default.ShowChart),
        NavigationDestination("Lifestyle", Icons.Default.DirectionsWalk),
        NavigationDestination("Meds", Icons.Default.Medication),
    )
    NavigationBar(containerColor = GlycoWhite) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            items.forEachIndexed { index, item ->
                val selected = selectedTab == index
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onTabSelected(index) }
                        .padding(vertical = 6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .background(
                                brush = if (selected) {
                                    Brush.linearGradient(listOf(BrandMint, BrandTeal))
                                } else {
                                    Brush.linearGradient(listOf(Color.Transparent, Color.Transparent))
                                },
                                shape = RoundedCornerShape(12.dp),
                            )
                            .padding(horizontal = 10.dp, vertical = 4.dp),
                    ) {
                        androidx.compose.material3.Icon(
                            imageVector = item.icon,
                            contentDescription = item.label,
                            tint = if (selected) GlycoWhite else MutedInk,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                    Text(
                        item.label,
                        color = if (selected) Pine else MutedInk,
                        fontSize = 10.sp,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}

private data class NavigationDestination(
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
)

@Composable
private fun HomeContent(
    modifier: Modifier,
    user: UserDto?,
    state: PatientState,
    onCareTeam: () -> Unit,
    onHealth: () -> Unit,
    onMedication: () -> Unit,
    onLifestyle: () -> Unit,
    onProfile: () -> Unit,
) {
    val pendingCount = state.invitations.count { it.status == "pending" }
    val acceptedDoctor = state.invitations.firstOrNull { it.status == "accepted" }?.doctor
    LazyColumn(
        modifier = modifier.fillMaxSize().padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(vertical = 24.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                BrandHeader()
                ProfileAvatar(
                    state.profile?.profile?.fullName ?: user?.patientProfile?.fullName,
                    onClick = onProfile,
                )
            }
        }
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
        item {
            HealthOverview(
                state = state,
                onHealth = onHealth,
                onMedication = onMedication,
                onLifestyle = onLifestyle,
            )
        }
        state.confirmation?.let { confirmation -> item { Text(confirmation, color = Pine) } }
        state.error?.let { error -> item { Text(error, color = MaterialTheme.colorScheme.error) } }
    }
}

@Composable
private fun HealthOverview(
        state: PatientState,
        onHealth: () -> Unit,
        onMedication: () -> Unit,
        onLifestyle: () -> Unit,
    ) {
        val latestReading = state.readings.maxByOrNull { it.measuredAt.epochMillisOrMin() }
        val previousReading = state.readings
            .filter { it.id != latestReading?.id }
            .maxByOrNull { it.measuredAt.epochMillisOrMin() }
        val latestMeal = state.lifestyle.filter { it.type == "meal" }.maxByOrNull { it.occurredAt.epochMillisOrMin() }
        val latestActivity = state.lifestyle.filter { it.type == "activity" }.maxByOrNull { it.occurredAt.epochMillisOrMin() }
        val latestSleep = state.lifestyle.filter { it.type == "sleep" }.maxByOrNull { it.occurredAt.epochMillisOrMin() }
        val latestSymptom = state.lifestyle.filter { it.type == "symptom" }.maxByOrNull { it.occurredAt.epochMillisOrMin() }
        val isLoading = state.readingsLoading || state.medicationsLoading || state.lifestyleLoading
        val hasData = latestReading != null || state.medications.isNotEmpty() || state.lifestyle.isNotEmpty()

        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                "Health overview",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )
            if (isLoading && !hasData) {
                CircularProgressIndicator()
            } else if (!hasData) {
                EmptyState("No health data yet", "Health information will appear here when it is available.", Blush)
            } else {
                TintedSectionCard("Glucose", Icons.Default.Bloodtype, GlycoWhite, onClick = onHealth) {
                    if (latestReading == null) {
                        Text("No glucose readings yet", color = MutedInk)
                    } else {
                        Text("${latestReading.value} ${latestReading.unit}", style = MaterialTheme.typography.headlineMedium)
                        Text("Latest reading · ${formatDateTime(latestReading.measuredAt)}", color = MutedInk)
                        previousReading?.let {
                            Text("Previous: ${it.value} ${it.unit} · ${formatDateTime(it.measuredAt)}", color = MutedInk)
                        }
                        val unitCounts = state.readings.groupingBy { it.unit }.eachCount()
                        Text(
                            unitCounts.entries.joinToString(" · ") { "${it.value} ${it.key} readings" },
                            color = MutedInk,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
                TintedSectionCard("Medication", Icons.Default.Medication, GlycoWhite, onClick = onMedication) {
                    if (state.medications.isEmpty()) {
                        Text("No active medications", color = MutedInk)
                    } else {
                        Text("${state.medications.size} active medication${if (state.medications.size == 1) "" else "s"}")
                        state.medications.take(3).forEach { medication ->
                            Text("${medication.name} · ${medication.dosage}", color = MutedInk)
                            Text("${medication.frequency} · ${medication.scheduleTimes.joinToString()}", color = MutedInk, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
                TintedSectionCard("Lifestyle", Icons.Default.FavoriteBorder, GlycoWhite, onClick = onLifestyle) {
                    LifestyleSummary(
                        latestMeal = latestMeal,
                        latestActivity = latestActivity,
                        latestSleep = latestSleep,
                        latestSymptom = latestSymptom,
                        totalEntries = state.lifestyle.size,
                    )
                }
            }
            state.readingsError?.let { Text("Glucose unavailable: $it", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            state.medicationError?.let { Text("Medication unavailable: $it", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            state.lifestyleError?.let { Text("Lifestyle unavailable: $it", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        }
    }

@Composable
private fun LifestyleSummary(
    latestMeal: com.glycotwin.patient.data.remote.LifestyleEntryDto?,
    latestActivity: com.glycotwin.patient.data.remote.LifestyleEntryDto?,
    latestSleep: com.glycotwin.patient.data.remote.LifestyleEntryDto?,
    latestSymptom: com.glycotwin.patient.data.remote.LifestyleEntryDto?,
    totalEntries: Int,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        LifestyleCategorySummary(
            label = "Meal",
            value = latestMeal?.let { "${it.description ?: it.mealType ?: "Recorded"} · ${formatDateTime(it.occurredAt)}" },
        )
        LifestyleCategorySummary(
            label = "Activity",
            value = latestActivity?.let { "${it.activityType ?: it.description ?: "Recorded"} · ${formatDateTime(it.occurredAt)}" },
        )
        LifestyleCategorySummary(
            label = "Sleep",
            value = latestSleep?.let { "${it.sleepDurationMinutes ?: 0} minutes · ${formatDateTime(it.occurredAt)}" },
        )
        LifestyleCategorySummary(
            label = "Symptom",
            value = latestSymptom?.let { "${it.description ?: "Recorded"} · ${formatDateTime(it.occurredAt)}" },
        )
        Text(
            "$totalEntries recorded entr${if (totalEntries == 1) "y" else "ies"}",
            color = MutedInk,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun LifestyleCategorySummary(label: String, value: String?) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelLarge, color = Pine, fontWeight = FontWeight.Bold)
        Text(value ?: "No record yet", color = if (value == null) MutedInk else Ink)
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
    DateTimeFormatter.ofPattern("d MMM yyyy").format(OffsetDateTime.parse(value).atZoneSameInstant(ZoneId.systemDefault()))
}.getOrDefault(value)

private fun formatDateTime(value: String): String = runCatching {
    DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a", Locale.getDefault())
        .format(OffsetDateTime.parse(value).atZoneSameInstant(ZoneId.systemDefault()))
}.getOrDefault(value)

private fun String.epochMillisOrMin(): Long = runCatching { OffsetDateTime.parse(this).toInstant().toEpochMilli() }.getOrDefault(Long.MIN_VALUE)
