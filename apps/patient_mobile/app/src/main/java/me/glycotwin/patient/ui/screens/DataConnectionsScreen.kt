package me.glycotwin.patient.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import me.glycotwin.patient.BuildConfig
import me.glycotwin.patient.data.health.HealthConnectGlucose
import me.glycotwin.patient.data.remote.ImportedGlucoseReading
import me.glycotwin.patient.data.wear.WearBridge
import me.glycotwin.patient.ui.components.BrandHeader
import me.glycotwin.patient.ui.components.SectionCard
import me.glycotwin.patient.ui.components.TactileOutlinedButton
import me.glycotwin.patient.ui.theme.MutedInk
import me.glycotwin.patient.ui.theme.Pine
import me.glycotwin.patient.ui.viewmodel.PatientViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
internal fun DataConnectionsScreen(
    viewModel: PatientViewModel,
    wearBridge: WearBridge,
    email: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val patient by viewModel.state.collectAsState()
    val watch by wearBridge.state.collectAsState()
    val showReplay = BuildConfig.DEBUG && email.endsWith("@example.test", ignoreCase = true)
    LaunchedEffect(showReplay) {
        wearBridge.refresh()
        if (showReplay) viewModel.loadReplay()
    }
    LazyColumn(
        modifier = modifier.fillMaxSize().padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(top = 20.dp, bottom = 24.dp),
    ) {
        item { BrandHeader() }
        item { TactileOutlinedButton("Back", onBack) }
        item { Text("Data connections", style = MaterialTheme.typography.headlineLarge) }
        item {
            SectionCard("Wear OS") {
                Text(
                    if (watch.reachable) "GlycoTwin watch app reachable" else "Watch app not reachable",
                    color = if (watch.reachable) Pine else MutedInk,
                    style = MaterialTheme.typography.labelLarge,
                )
                Text("Pair your watch in Wear OS and open GlycoTwin on both devices.", color = MutedInk)
                WatchOption(
                    title = "Share my latest glucose",
                    detail = "Show the latest reading and its source on your paired watch.",
                    checked = watch.shareGlucose,
                    onCheckedChange = wearBridge::setGlucoseSharing,
                )
                WatchOption(
                    title = "Sync watch activity",
                    detail = "Send activity from the paired watch to this GlycoTwin account.",
                    checked = watch.syncActivity,
                    onCheckedChange = wearBridge::setActivitySync,
                )
                watch.lastShareAt?.takeIf { watch.shareGlucose }?.let {
                    Text("Last queued for watch ${glucoseTimeLabel(it)}", color = MutedInk)
                }
                watch.lastActivityAt?.takeIf { watch.syncActivity }?.let {
                    Text("Last activity upload ${glucoseTimeLabel(it)}", color = MutedInk)
                }
                watch.message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                TactileOutlinedButton("Refresh watch connection", wearBridge::refresh, Modifier.fillMaxWidth())
            }
        }
        item { HealthConnectSection(viewModel) }
        if (showReplay) {
            item {
                SectionCard("Glucose replay") {
                    Text("Load synthetic data to try the phone, dashboard, and watch. Sample readings stay separate from your glucose trends.", color = MutedInk)
                    Button(onClick = viewModel::runReplay, enabled = !patient.replaySaving, modifier = Modifier.fillMaxWidth()) {
                        Text(if (patient.replaySaving) "Loading sample readings…" else "Load sample readings")
                    }
                    patient.replayMessage?.let { Text(it, color = Pine) }
                    patient.replayError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    patient.replayReadings.firstOrNull()?.let { sample ->
                        Text("${sample.value} ${sample.unit}", style = MaterialTheme.typography.headlineMedium)
                        GlucoseReadingDetails(sample.source, sample.measuredAt, sample.receivedAt, sample.deviceOrigin)
                        val gaps = countDeviceGaps(patient.replayReadings.map { it.measuredAt })
                        if (gaps > 0) Text("$gaps sample data gaps over 15 minutes", color = MutedInk)
                    }
                }
            }
        }
    }
}

@Composable
private fun WatchOption(title: String, detail: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(detail, color = MutedInk, style = MaterialTheme.typography.bodySmall)
        }
        Switch(checked, onCheckedChange)
    }
}

@Composable
private fun HealthConnectSection(viewModel: PatientViewModel) {
    val patient by viewModel.state.collectAsState()
    val context = LocalContext.current
    val health = remember(context.applicationContext) { HealthConnectGlucose(context) }
    val scope = rememberCoroutineScope()
    var sources by remember { mutableStateOf<Map<String, List<ImportedGlucoseReading>>>(emptyMap()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val loadSources = {
        scope.launch {
            loading = true
            error = null
            sources = emptyMap()
            try {
                sources = health.availableSources()
                if (sources.isEmpty()) error = "There are no blood glucose readings from the last 7 days."
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                error = "GlycoTwin couldn’t read glucose data. Check the blood glucose permission in Health Connect."
            } finally {
                loading = false
            }
        }
    }
    val requestPermission = rememberLauncherForActivityResult(PermissionController.createRequestPermissionResultContract()) {
        if (HealthConnectGlucose.PERMISSION in it) loadSources()
        else error = "Glucose access is off. You can change it in Health Connect settings."
    }
    SectionCard("Health Connect") {
        Text("Choose an app that stores blood glucose in Health Connect and import up to 7 days of its readings.", color = MutedInk)
        when (health.status()) {
            HealthConnectClient.SDK_AVAILABLE -> {
                Button(
                    onClick = {
                        scope.launch {
                            try {
                                val granted = HealthConnectClient.getOrCreate(context).permissionController.getGrantedPermissions()
                                if (HealthConnectGlucose.PERMISSION in granted) loadSources()
                                else requestPermission.launch(setOf(HealthConnectGlucose.PERMISSION))
                            } catch (cancelled: CancellationException) {
                                throw cancelled
                            } catch (_: Exception) {
                                error = "Health Connect is unavailable on this phone."
                            }
                        }
                    },
                    enabled = !loading && !patient.importSaving,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(if (loading) "Checking sources…" else "Find glucose sources") }
            }
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ->
                Text("Install or update Health Connect to import glucose readings.", color = MutedInk)
            else -> Text("Health Connect is unavailable on this phone.", color = MutedInk)
        }
        for ((source, readings) in sources) {
            Text(source, style = MaterialTheme.typography.titleMedium)
            Button(
                onClick = {
                    scope.launch {
                        try {
                            val granted = HealthConnectClient.getOrCreate(context).permissionController.getGrantedPermissions()
                            if (HealthConnectGlucose.PERMISSION in granted) viewModel.importGlucose(readings)
                            else {
                                sources = emptyMap()
                                error = "Restore blood glucose permission before importing."
                            }
                        } catch (cancelled: CancellationException) {
                            throw cancelled
                        } catch (_: Exception) {
                            error = "GlycoTwin couldn’t check Health Connect permission."
                        }
                    }
                },
                enabled = !patient.importSaving,
                modifier = Modifier.fillMaxWidth(),
            ) { Text(if (patient.importSaving) "Importing…" else "Import ${readings.size} readings") }
        }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        patient.importError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        patient.importMessage?.let { Text(it, color = Pine) }
    }
}
