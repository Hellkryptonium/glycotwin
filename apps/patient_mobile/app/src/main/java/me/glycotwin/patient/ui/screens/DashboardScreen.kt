package me.glycotwin.patient.ui.screens

import androidx.activity.compose.BackHandler
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
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Medication
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp
import me.glycotwin.patient.data.remote.InvitationDto
import me.glycotwin.patient.data.remote.UserDto
import me.glycotwin.patient.data.wear.WearBridge
import me.glycotwin.patient.data.wear.WatchSyncState
import me.glycotwin.patient.ui.components.BrandHeader
import me.glycotwin.patient.ui.components.ProfileAvatar
import me.glycotwin.patient.ui.components.EmptyState
import me.glycotwin.patient.ui.components.SectionCard
import me.glycotwin.patient.ui.components.StatusLabel
import me.glycotwin.patient.ui.components.TactileButton
import me.glycotwin.patient.ui.components.TactileOutlinedButton
import me.glycotwin.patient.ui.components.TintedSectionCard
import me.glycotwin.patient.ui.theme.Blush
import me.glycotwin.patient.ui.theme.Cobalt
import me.glycotwin.patient.ui.theme.GlycoWhite
import me.glycotwin.patient.ui.theme.Ink
import me.glycotwin.patient.ui.theme.Marigold
import me.glycotwin.patient.ui.theme.MutedInk
import me.glycotwin.patient.ui.theme.Pine
import me.glycotwin.patient.ui.theme.Tomato
import me.glycotwin.patient.ui.viewmodel.AuthViewModel
import me.glycotwin.patient.ui.viewmodel.InvitationAction
import me.glycotwin.patient.ui.viewmodel.PatientState
import me.glycotwin.patient.ui.viewmodel.PatientViewModel
import me.glycotwin.patient.ui.viewmodel.PatientAiViewModel
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private enum class PatientScreen { Today, Health, Care, Trends, Lifestyle, Medications, Profile, Connections, Account, History, VisitPrep, Ai }

@Composable
fun DashboardScreen(
    user: UserDto,
    patientViewModel: PatientViewModel,
    authViewModel: AuthViewModel,
    patientAiViewModel: PatientAiViewModel,
    wearBridge: WearBridge,
    onLogout: () -> Unit,
) {
    var screen by rememberSaveable { mutableStateOf(PatientScreen.Today) }
    var connectionsReturnScreen by rememberSaveable { mutableStateOf(PatientScreen.Today) }
    val patientState by patientViewModel.state.collectAsState()
    val watchSync by wearBridge.state.collectAsState()
    var homeVisited by remember { mutableStateOf(false) }
    val openConnections = {
        connectionsReturnScreen = screen
        screen = PatientScreen.Connections
    }
    val goBack = {
        screen = when (screen) {
            PatientScreen.Connections -> connectionsReturnScreen
            PatientScreen.Account -> PatientScreen.Profile
            PatientScreen.VisitPrep -> PatientScreen.Care
            else -> PatientScreen.Today
        }
    }
    BackHandler(enabled = screen != PatientScreen.Today, onBack = goBack)
    LaunchedEffect(screen) {
        when (screen) {
            PatientScreen.Today -> {
                if (homeVisited) patientViewModel.refreshHome()
                homeVisited = true
            }
            PatientScreen.Care -> patientViewModel.refresh()
            PatientScreen.Health -> patientViewModel.loadReadings(refresh = true)
            PatientScreen.Lifestyle -> patientViewModel.loadWatchActivity()
            PatientScreen.History -> patientViewModel.loadTimeline()
            PatientScreen.VisitPrep -> {
                patientViewModel.loadCare()
                patientViewModel.loadTimeline(source = null)
            }
            PatientScreen.Ai -> patientAiViewModel.load()
            else -> Unit
        }
    }
    LaunchedEffect(watchSync.lastActivityAt) {
        if (watchSync.lastActivityAt != null) {
            patientViewModel.loadRecentTimeline()
            if (screen == PatientScreen.Lifestyle) patientViewModel.loadWatchActivity()
            if (screen == PatientScreen.History) patientViewModel.loadTimeline()
        }
    }
    Scaffold(
        containerColor = me.glycotwin.patient.ui.theme.WarmOat,
        floatingActionButton = {
            if (screen != PatientScreen.Ai) FloatingActionButton(
                onClick = { screen = PatientScreen.Ai },
                containerColor = Cobalt,
                contentColor = GlycoWhite,
            ) { Icon(Icons.Default.Chat, contentDescription = "Open GlycoTwin AI") }
        },
        bottomBar = {
            GlycoBottomNavigation(screen) { screen = it }
        },
    ) { paddingValues ->
        val modifier = Modifier.padding(paddingValues)
        when (screen) {
            PatientScreen.Today -> HomeContent(
                modifier,
                user,
                patientState,
                watchSync,
                onCareTeam = { screen = PatientScreen.Care },
                onHealth = { screen = PatientScreen.Health },
                onMedication = { screen = PatientScreen.Medications },
                onLifestyle = { screen = PatientScreen.Lifestyle },
                onProfile = { screen = PatientScreen.Profile },
                onDataConnections = openConnections,
                onHistory = { screen = PatientScreen.History },
            )
            PatientScreen.Health -> HealthRecordsScreen(patientViewModel, modifier)
            PatientScreen.Care -> CareTeamContent(modifier, patientState, patientViewModel) { screen = PatientScreen.VisitPrep }
            PatientScreen.Trends -> HealthTrendsScreen(patientViewModel, modifier, onDataConnections = openConnections)
            PatientScreen.Lifestyle -> LifestyleScreen(patientViewModel, modifier)
            PatientScreen.Medications -> MedicationScreen(patientViewModel, modifier, onBack = { screen = PatientScreen.Health })
            PatientScreen.Connections -> DataConnectionsScreen(patientViewModel, wearBridge, user.email, goBack, modifier)
            PatientScreen.Profile -> ProfileScreen(
                patientViewModel, user, onLogout,
                modifier = modifier,
                onBack = goBack,
                onAccountSecurity = { authViewModel.clearMessage(); screen = PatientScreen.Account },
                onCareTeam = { screen = PatientScreen.Care },
                onDataConnections = openConnections,
            )
            PatientScreen.Account -> AccountSecurityScreen(authViewModel, user.email, goBack, onLogout, modifier)
            PatientScreen.History -> PatientTimelineScreen(patientViewModel, goBack, modifier)
            PatientScreen.VisitPrep -> VisitPrepScreen(patientViewModel, goBack, modifier)
            PatientScreen.Ai -> PatientAiScreen(patientAiViewModel, goBack, modifier)
        }
    }
}

@Composable
private fun GlycoBottomNavigation(current: PatientScreen, onTabSelected: (PatientScreen) -> Unit) {
    val items = listOf(
        NavigationDestination(PatientScreen.Today, "Today", Icons.Default.Home),
        NavigationDestination(PatientScreen.Health, "Health", Icons.Default.Favorite),
        NavigationDestination(PatientScreen.Care, "Care", Icons.Default.Groups),
        NavigationDestination(PatientScreen.Trends, "Trends", Icons.Default.ShowChart),
        NavigationDestination(PatientScreen.Lifestyle, "Lifestyle", Icons.Default.DirectionsWalk),
        NavigationDestination(PatientScreen.Medications, "Meds", Icons.Default.Medication),
    )
    NavigationBar(containerColor = GlycoWhite) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            items.forEach { item ->
                val selected = current == item.screen
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onTabSelected(item.screen) }
                        .padding(vertical = 6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .background(if (selected) Cobalt else Color.Transparent, RoundedCornerShape(8.dp))
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
                        color = if (selected) Cobalt else MutedInk,
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
    val screen: PatientScreen,
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
)

@Composable
private fun HomeContent(
    modifier: Modifier,
    user: UserDto?,
    state: PatientState,
    watchSync: WatchSyncState,
    onCareTeam: () -> Unit,
    onHealth: () -> Unit,
    onMedication: () -> Unit,
    onLifestyle: () -> Unit,
    onProfile: () -> Unit,
    onDataConnections: () -> Unit,
    onHistory: () -> Unit,
) {
    val pendingCount = state.invitations.count { it.status == "pending" }
    val connectedDoctors = state.care?.connections.orEmpty()
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
            Column(
                modifier = Modifier.fillMaxWidth().background(Cobalt, RoundedCornerShape(14.dp)).padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("Your care, in reach", color = Marigold, style = MaterialTheme.typography.labelLarge)
                Text(
                    "Good to see you${state.profile?.profile?.fullName?.let { ", $it" } ?: user?.patientProfile?.fullName?.let { ", $it" } ?: ""}.",
                    color = GlycoWhite,
                    style = MaterialTheme.typography.headlineLarge,
                )
            }
        }
        item {
            SectionCard("Device sync") {
                Text(if (watchSync.reachable) "Watch connected" else "Watch unavailable", color = MutedInk)
                watchSync.lastActivityAt?.let { Text("Last activity upload ${glucoseTimeLabel(it)}", color = MutedInk) }
                watchSync.message?.let { Text(it, color = MutedInk) }
                TactileOutlinedButton("Data connections", onDataConnections, Modifier.fillMaxWidth())
            }
        }
        item {
            SectionCard("Recent records") {
                if (state.recentTimeline.isEmpty()) Text("Saved and synced records will appear here.", color = MutedInk)
                state.recentTimeline.forEach { entry ->
                    Text(entry.title, style = MaterialTheme.typography.titleMedium)
                    TimelineEntryDetails(entry, showReceipt = false)
                }
                TactileOutlinedButton("View health history", onHistory, Modifier.fillMaxWidth())
            }
        }
        item {
            SectionCard("Doctor connection") {
                when {
                    connectedDoctors.isNotEmpty() -> {
                        StatusLabel("Connected", Pine)
                        Text(connectedDoctors.joinToString { it.doctorName ?: "Your doctor" }, color = MutedInk)
                        TactileOutlinedButton("Open care team", onCareTeam, Modifier.fillMaxWidth())
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
        val liveReadings = state.readings.filter { it.source != GlucoseSource.REPLAY.name }
        val latestReading = liveReadings.maxByOrNull { it.measuredAt.epochMillisOrMin() }
            ?: state.readings.maxByOrNull { it.measuredAt.epochMillisOrMin() }
        val sameSource = state.readings.filter { it.source == latestReading?.source && it.deviceOrigin == latestReading?.deviceOrigin }
        val previousReading = sameSource.filter { it.id != latestReading?.id }.maxByOrNull { it.measuredAt.epochMillisOrMin() }
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
                        GlucoseReadingDetails(latestReading.source, latestReading.measuredAt, latestReading.receivedAt, latestReading.deviceOrigin)
                        previousReading?.let {
                            Text("Previous: ${it.value} ${it.unit} · ${formatDateTime(it.measuredAt)}", color = MutedInk)
                        }
                        if (glucoseSource(latestReading.source) in setOf(GlucoseSource.CGM, GlucoseSource.REPLAY)) {
                            val gaps = countDeviceGaps(sameSource.map { it.measuredAt })
                            if (gaps > 0) Text("$gaps recent data gaps over 15 minutes", color = MutedInk, style = MaterialTheme.typography.bodySmall)
                        }
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
    latestMeal: me.glycotwin.patient.data.remote.LifestyleEntryDto?,
    latestActivity: me.glycotwin.patient.data.remote.LifestyleEntryDto?,
    latestSleep: me.glycotwin.patient.data.remote.LifestyleEntryDto?,
    latestSymptom: me.glycotwin.patient.data.remote.LifestyleEntryDto?,
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
private fun CareTeamContent(
    modifier: Modifier,
    state: PatientState,
    viewModel: PatientViewModel,
    openVisitPrep: () -> Unit,
) {
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
        careRecords(state, viewModel, openVisitPrep)
        item { Text("Invitations", style = MaterialTheme.typography.titleLarge) }
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
