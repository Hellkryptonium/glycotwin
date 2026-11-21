package me.glycotwin.patient.data.wear

import android.content.Context
import android.net.Uri
import me.glycotwin.patient.data.remote.DeviceActivityEvent
import me.glycotwin.patient.data.remote.DeviceActivityInput
import me.glycotwin.patient.data.remote.GlucoseReadingDto
import me.glycotwin.patient.data.repository.ApiException
import me.glycotwin.patient.data.repository.PatientRepository
import com.google.android.gms.tasks.Task
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataMap
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import java.time.Instant
import java.time.Duration
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class WatchSyncState(
    val reachable: Boolean = false,
    val shareGlucose: Boolean = false,
    val syncActivity: Boolean = false,
    val lastShareAt: Instant? = null,
    val lastActivityAt: Instant? = null,
    val message: String? = null,
)

/**
 * Every queued watch activity includes an opaque pairing identifier. Watch-owned
 * data items are durable until the watch receives an acknowledgement for an API
 * success. Reconciliation on the phone retries after failures and restarts.
 */
class WearBridge(
    context: Context,
    private val repository: PatientRepository,
) {
    private val appContext = context.applicationContext
    private val preferences = appContext.getSharedPreferences("wear_pairing", Context.MODE_PRIVATE)
    private val client = Wearable.getDataClient(appContext)
    private val capability = Wearable.getCapabilityClient(appContext)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val work = Channel<Unit>(Channel.CONFLATED)
    private val _state = MutableStateFlow(WatchSyncState())
    val state = _state.asStateFlow()

    private var owner: String? = null
    private var ready = false
    private var activitySession: String? = null
    private var latest: GlucoseReadingDto? = null
    private var publishedPairing: Pairing? = null
    private var publishedGlucose: GlucoseSnapshot? = null
    private var localNodeId: String? = null
    private val listener = DataClient.OnDataChangedListener { events ->
        if (events.any { it.dataItem.uri.path.orEmpty().startsWith(ACTIVITY_PATH) }) refresh()
    }

    init {
        runCatching { client.addListener(listener) }
        scope.launch {
            while (isActive) {
                withTimeoutOrNull(RETRY_MILLIS) { work.receive() }
                if (ready) reconcile()
            }
        }
    }

    fun bind(accountId: String?) {
        if (ready && owner == accountId) return
        ready = true
        owner = accountId
        latest = null
        val sameAccount = accountId != null && accountId == preferences.getString("owner", null)
        activitySession = if (sameAccount) preferences.getString("activity_session", null) else null
        _state.value = WatchSyncState(
            shareGlucose = sameAccount && preferences.getBoolean("share_glucose", false),
            syncActivity = activitySession != null,
        )
        saveOptions()
        refresh()
    }

    fun acceptLatestReading(accountId: String, reading: GlucoseReadingDto?) {
        if (accountId == owner && reading != latest) {
            latest = reading
            refresh()
        }
    }

    fun setGlucoseSharing(enabled: Boolean) {
        if (owner == null) return
        _state.value = _state.value.copy(shareGlucose = enabled, message = null)
        saveOptions()
        refresh()
    }

    fun setActivitySync(enabled: Boolean) {
        if (owner == null || enabled == (activitySession != null)) return
        activitySession = if (enabled) UUID.randomUUID().toString() else null
        _state.value = _state.value.copy(syncActivity = enabled, message = null)
        saveOptions()
        refresh()
    }

    fun refresh() { work.trySend(Unit) }

    fun close() {
        scope.cancel()
        runCatching { client.removeListener(listener) }
    }

    private fun saveOptions() {
        preferences.edit()
            .putString("owner", owner)
            .putBoolean("share_glucose", _state.value.shareGlucose)
            .putString("activity_session", activitySession)
            .apply()
    }

    private suspend fun reconcile() {
        try {
            publishPairing()
            publishGlucose()
            val watches = capability.getCapability("glycotwin_watch", CapabilityClient.FILTER_REACHABLE).awaitResult()
            _state.value = _state.value.copy(reachable = watches.nodes.isNotEmpty())
            flushActivities()
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            _state.value = _state.value.copy(reachable = false)
        }
    }

    private suspend fun publishPairing() {
        val pairing = Pairing(activitySession)
        if (pairing == publishedPairing) return
        put(PAIRING_PATH) {
            putBoolean("enabled", pairing.session != null)
            putString("activitySessionId", pairing.session.orEmpty())
            putLong("sharedAtMs", System.currentTimeMillis())
        }
        publishedPairing = pairing
    }

    private suspend fun publishGlucose() {
        val reading = latest.takeIf { _state.value.shareGlucose && owner != null }
        val snapshot = GlucoseSnapshot(reading?.takeIf { it.measuredAt.toInstantOrNull() != null })
        if (publishedGlucose == snapshot) return
        val now = Instant.now()
        put(GLUCOSE_PATH) {
            putBoolean("available", snapshot.reading != null)
            putLong("sharedAtMs", now.toEpochMilli())
            snapshot.reading?.let {
                putString("readingId", it.id)
                putString("value", it.value)
                putString("unit", it.unit)
                putString("source", it.source)
                putLong("measuredAtMs", it.measuredAt.toInstantOrNull()!!.toEpochMilli())
                putLong("receivedAtMs", it.receivedAt.toInstantOrNull()?.toEpochMilli() ?: 0L)
            }
        }
        publishedGlucose = snapshot
        if (owner != null && snapshot.reading != null && _state.value.shareGlucose) {
            _state.value = _state.value.copy(lastShareAt = now)
        }
    }

    private suspend fun flushActivities() {
        val accountId = owner
        val pairingId = activitySession
        val localNode = localNodeId ?: Wearable.getNodeClient(appContext).localNode.awaitResult().id.also { localNodeId = it }
        val buffer = client.getDataItems().awaitResult()
        val staleAcknowledgements = mutableListOf<Uri>()
        val pending = try {
            val presentActivityPaths = buffer.mapNotNull { it.uri.path }.filter { it.startsWith(ACTIVITY_PATH) }.toSet()
            val cutoff = Instant.now().minus(ACK_RETENTION).toEpochMilli()
            val acknowledged = buffer.mapNotNull { item ->
                val path = item.uri.path.orEmpty().takeIf { it.startsWith(ACTIVITY_ACK_PATH) } ?: return@mapNotNull null
                if (item.uri.host != localNode) return@mapNotNull null
                val map = runCatching { DataMapItem.fromDataItem(item).dataMap }.getOrNull() ?: return@mapNotNull null
                val id = path.removePrefix(ACTIVITY_ACK_PATH)
                if (ACTIVITY_PATH + id !in presentActivityPaths || map.getLong("sharedAtMs") < cutoff) {
                    staleAcknowledgements.add(item.uri)
                }
                id.takeIf { pairingId != null && map.getString("activitySessionId") == pairingId }
            }.toSet()
            if (pairingId == null) emptyList() else buffer.mapNotNull { item ->
                val path = item.uri.path.orEmpty()
                if (!path.startsWith(ACTIVITY_PATH)) return@mapNotNull null
                val map = runCatching { DataMapItem.fromDataItem(item).dataMap }.getOrNull() ?: return@mapNotNull null
                if (map.getString("activitySessionId") != pairingId) return@mapNotNull null
                parseActivity(path, map)?.takeUnless { it.eventId in acknowledged }
            }.distinctBy { it.eventId }
        } finally {
            buffer.release()
        }
        staleAcknowledgements.take(32).forEach { client.deleteDataItems(it).awaitResult() }
        if (accountId == null || pairingId == null || pending.isEmpty()) return
        var lastError: String? = null
        for (batch in pending.groupBy { it.simulated == true }.values.flatMap { it.chunked(25) }) {
            if (owner != accountId || activitySession != pairingId) return
            val result = repository.importDeviceActivity(DeviceActivityInput(batch), accountId)
            val error = result.exceptionOrNull()
            if (error is CancellationException) throw error
            if (owner != accountId || activitySession != pairingId) return
            if (result.isSuccess) {
                for (event in batch) {
                    if (owner != accountId || activitySession != pairingId) return
                    put(ACTIVITY_ACK_PATH + event.eventId) {
                        putString("activitySessionId", pairingId)
                        putString("eventId", event.eventId)
                        putLong("sharedAtMs", System.currentTimeMillis())
                    }
                }
                _state.value = _state.value.copy(lastActivityAt = Instant.now())
            } else {
                lastError = if (error is ApiException && error.statusCode == 403 && batch.first().simulated == true) {
                    "Sample watch activity is allowed on the local demo account."
                } else {
                    "Watch activity is queued. Check your connection and try again."
                }
            }
        }
        _state.value = _state.value.copy(message = lastError)
    }

    private fun parseActivity(path: String, map: DataMap): DeviceActivityEvent? {
        val id = map.getString("eventId") ?: return null
        if (path != ACTIVITY_PATH + id || runCatching { UUID.fromString(id).toString() }.getOrNull() != id) return null
        val kind = map.getString("kind")?.takeIf { it in ACTIVITY_KINDS } ?: return null
        val measuredAt = map.getLong("measuredAtMs").takeIf { it > 0 } ?: return null
        val event = DeviceActivityEvent(
            eventId = id,
            kind = kind,
            measuredAt = Instant.ofEpochMilli(measuredAt).toString(),
            simulated = if (map.getBoolean("simulated")) true else null,
        )
        val startedAt = map.getLong("startedAtMs").takeIf { it in 1 until measuredAt }
            ?.let { Instant.ofEpochMilli(it).toString() }
        val value = if (map.containsKey("value")) map.getDouble("value") else null
        return when (kind) {
            "steps" -> event.copy(
                startedAt = startedAt,
                value = value?.takeIf { it >= 1 && it <= 100_000 && it % 1 == 0.0 } ?: return null,
            )
            "heart_rate" -> event.copy(value = value?.takeIf { it > 0 && it <= 300 } ?: return null)
            "workout" -> event.copy(
                startedAt = startedAt ?: return null,
                activityType = map.getString("activityType")?.trim()?.takeIf { it.isNotEmpty() && it.length <= 100 } ?: return null,
            )
            else -> null
        }
    }

    private suspend fun put(path: String, data: DataMap.() -> Unit) {
        val request = PutDataMapRequest.create(path)
        request.dataMap.data()
        client.putDataItem(request.asPutDataRequest().setUrgent()).awaitResult()
    }

    private data class Pairing(val session: String?)
    private data class GlucoseSnapshot(val reading: GlucoseReadingDto?)

    private companion object {
        const val PAIRING_PATH = "/glycotwin/pairing/v1"
        const val GLUCOSE_PATH = "/glycotwin/glucose/v1"
        const val ACTIVITY_PATH = "/glycotwin/activity/v1/"
        const val ACTIVITY_ACK_PATH = "/glycotwin/activity-ack/v1/"
        const val RETRY_MILLIS = 20_000L
        val ACK_RETENTION: Duration = Duration.ofDays(8)
        val ACTIVITY_KINDS = setOf("steps", "workout", "heart_rate")
    }
}

private fun String?.toInstantOrNull() = this?.let { runCatching { Instant.parse(it) }.getOrNull() }

private suspend fun <T> Task<T>.awaitResult(): T = suspendCancellableCoroutine { continuation ->
    addOnCompleteListener {
        if (!continuation.isActive) return@addOnCompleteListener
        when {
            it.isCanceled -> continuation.cancel()
            it.isSuccessful -> continuation.resume(it.result)
            else -> continuation.resumeWithException(it.exception ?: IllegalStateException("Wear OS sync failed"))
        }
    }
}
