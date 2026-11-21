package me.glycotwin.patient

import android.content.Context
import android.net.Uri
import androidx.core.net.toUri
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataItem
import com.google.android.gms.wearable.DataMap
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import java.util.UUID

internal data class ActivitySample(
    val kind: String,
    val measuredAtMs: Long,
    val startedAtMs: Long? = null,
    val value: Double? = null,
    val activityType: String? = null,
    val simulated: Boolean = false,
    val eventId: String = UUID.randomUUID().toString(),
)

/** The phone owns glucose and consent; the watch owns activity until the phone acknowledges it. */
internal class WatchDataLayer(
    context: Context,
    private val onState: (PhoneSyncState) -> Unit,
    private val onActivitySync: (ActivitySyncStatus) -> Unit,
) : DataClient.OnDataChangedListener {
    private val dataClient = Wearable.getDataClient(context.applicationContext)
    private val capabilityClient = Wearable.getCapabilityClient(context.applicationContext)
    private val nodeClient = Wearable.getNodeClient(context.applicationContext)
    private var active = false
    private var observerGeneration = 0
    private var refreshing = false
    private var refreshAgain = false
    private var ownNodeId: String? = null
    private var state = PhoneSyncState()
    private val capabilityListener = CapabilityClient.OnCapabilityChangedListener { refresh() }
    private val unsent = mutableMapOf<String, ActivitySample>()
    private val putting = mutableSetOf<String>()
    private val waitingForAck = mutableSetOf<String>()
    private var receivedAcknowledgment = false

    fun start() {
        active = true
        val generation = ++observerGeneration
        publish(state.withoutConnection(PhoneStatus.CHECKING))
        dataClient.addListener(this, allItems, DataClient.FILTER_PREFIX)
        capabilityClient.addListener(capabilityListener, phoneCapability)
        nodeClient.localNode.addOnSuccessListener {
            if (isCurrent(generation)) {
                ownNodeId = it.id
                refresh()
            }
        }
        refresh()
    }

    fun stop() {
        active = false
        refreshing = false
        refreshAgain = false
        dataClient.removeListener(this)
        capabilityClient.removeListener(capabilityListener, phoneCapability)
    }

    override fun onDataChanged(events: DataEventBuffer) {
        if (events.any { event ->
                val path = event.dataItem.uri.path.orEmpty()
                path == glucosePath || path == pairingPath || path.startsWith(ackPrefix)
            }
        ) {
            refresh()
        }
    }

    fun refresh() {
        if (!active) return
        if (refreshing) {
            refreshAgain = true
            return
        }
        refreshing = true
        val generation = observerGeneration
        capabilityClient.getCapability(phoneCapability, CapabilityClient.FILTER_REACHABLE)
            .addOnSuccessListener { capability ->
                if (!isCurrent(generation)) return@addOnSuccessListener
                val phone = capability.nodes.sortedWith(compareBy({ !it.isNearby }, { it.id })).firstOrNull()
                if (phone == null) {
                    publish(state.withoutConnection(PhoneStatus.DISCONNECTED))
                    refreshFinished()
                } else {
                    readSnapshot(phone.id, generation)
                }
            }
            .addOnFailureListener {
                if (!isCurrent(generation)) return@addOnFailureListener
                publish(state.withoutConnection(PhoneStatus.UNAVAILABLE))
                refreshFinished()
            }
    }

    fun send(sessionId: String, samples: List<ActivitySample>) {
        if (sessionId != state.activitySessionId) {
            onActivitySync(ActivitySyncStatus.DISCARDED)
            return
        }
        receivedAcknowledgment = false
        samples.forEach { unsent[it.eventId] = it }
        flushPending(sessionId)
    }

    private fun readSnapshot(phone: String, generation: Int) {
        dataClient.getDataItems(allItems, DataClient.FILTER_PREFIX)
            .addOnSuccessListener { items ->
                try {
                    if (!isCurrent(generation)) return@addOnSuccessListener
                    val snapshot = mutableMapOf<String, DataMap>()
                    val outgoing = mutableListOf<Pair<Uri, DataMap>>()
                    for (item in items) {
                        val uri = item.uri
                        val path = uri.path.orEmpty()
                        if (uri.host == phone && (path == glucosePath || path == pairingPath || path.startsWith(ackPrefix))) {
                            item.toMapOrNull()?.let { snapshot[path] = it }
                        } else if (uri.host == ownNodeId && path.startsWith(activityPrefix)) {
                            item.toMapOrNull()?.let { outgoing.add(uri to it) }
                        }
                    }
                    val pairing = snapshot[pairingPath]
                    val session = pairing?.takeIf { it.getBoolean("enabled") }
                        ?.getString("activitySessionId")?.takeIf(String::isNotBlank)
                    val changed = pairing != null && session != state.activitySessionId
                    val discarded = changed && (unsent.isNotEmpty() || waitingForAck.isNotEmpty())
                    if (changed) {
                        unsent.clear()
                        waitingForAck.clear()
                        receivedAcknowledgment = false
                    }
                    publish(PhoneSyncState(
                        status = PhoneStatus.CONNECTED,
                        glucose = snapshot[glucosePath]?.asGlucose(),
                        activitySessionId = if (pairing == null) state.activitySessionId else session,
                        activitySharingKnown = pairing != null,
                    ))
                    if (discarded) onActivitySync(ActivitySyncStatus.DISCARDED)
                    if (pairing != null) {
                        reconcileActivity(outgoing, snapshot, session)
                        if (session != null) flushPending(session)
                    }
                } finally {
                    items.release()
                    if (isCurrent(generation)) refreshFinished()
                }
            }
            .addOnFailureListener {
                if (!isCurrent(generation)) return@addOnFailureListener
                publish(state.withoutConnection(PhoneStatus.UNAVAILABLE))
                refreshFinished()
            }
    }

    private fun reconcileActivity(items: List<Pair<Uri, DataMap>>, snapshot: Map<String, DataMap>, session: String?) {
        for ((uri, item) in items) {
            val eventId = item.getString("eventId") ?: continue
            val ownerSession = item.getString("activitySessionId")
            val ack = snapshot["$ackPrefix$eventId"]
            val acknowledged = ownerSession != null && ownerSession == session && ack != null &&
                ack.getString("activitySessionId") == ownerSession && ack.getString("eventId") == eventId
            if (acknowledged) {
                receivedAcknowledgment = true
                waitingForAck.remove(eventId)
                unsent.remove(eventId)
            }
            if (acknowledged || ownerSession != session) dataClient.deleteDataItems(uri)
            else if (session != null) waitingForAck.add(eventId)
        }
    }

    private fun flushPending(session: String) {
        val ready = unsent.values.filter { it.eventId !in putting }
        for (sample in ready) {
            putting.add(sample.eventId)
            val request = PutDataMapRequest.create("$activityPrefix${sample.eventId}").apply {
                dataMap.putString("eventId", sample.eventId)
                dataMap.putString("activitySessionId", session)
                dataMap.putString("kind", sample.kind)
                dataMap.putLong("measuredAtMs", sample.measuredAtMs)
                sample.startedAtMs?.let { dataMap.putLong("startedAtMs", it) }
                sample.value?.let { dataMap.putDouble("value", it) }
                sample.activityType?.let { dataMap.putString("activityType", it) }
                if (sample.simulated) dataMap.putBoolean("simulated", true)
            }.asPutDataRequest().setUrgent()
            dataClient.putDataItem(request).addOnCompleteListener { result ->
                putting.remove(sample.eventId)
                if (session == state.activitySessionId) {
                    if (result.isSuccessful && unsent.remove(sample.eventId) != null) {
                        waitingForAck.add(sample.eventId)
                    }
                    if (active) reportActivityProgress()
                }
            }
        }
        if (active) reportActivityProgress()
    }

    private fun reportActivityProgress() {
        activitySyncStatus(
            hasUnsent = unsent.isNotEmpty(),
            isSaving = putting.any(unsent::containsKey),
            hasUnacknowledged = waitingForAck.isNotEmpty(),
            receivedAcknowledgment = receivedAcknowledgment,
        )?.let(onActivitySync)
    }

    private fun isCurrent(generation: Int) = active && generation == observerGeneration

    private fun refreshFinished() {
        refreshing = false
        if (refreshAgain) {
            refreshAgain = false
            refresh()
        }
    }

    private fun publish(newState: PhoneSyncState) {
        if (newState == state) return
        state = newState
        onState(state)
    }

    private fun DataItem.toMapOrNull() =
        runCatching { DataMapItem.fromDataItem(this).dataMap }.getOrNull()

    private fun DataMap.asGlucose(): SharedGlucose? {
        if (!getBoolean("available")) return null
        val id = getString("readingId")?.takeIf(String::isNotBlank) ?: return null
        val value = getString("value")?.takeIf { it.toDoubleOrNull()?.isFinite() == true } ?: return null
        val unit = getString("unit")?.takeIf { it == "mg/dL" || it == "mmol/L" } ?: return null
        val source = getString("source")?.takeIf { it in glucoseSources } ?: return null
        val measuredAt = getLong("measuredAtMs")
        if (measuredAt <= 0) return null
        return SharedGlucose(id, value, unit, source, measuredAt)
    }

    private companion object {
        const val phoneCapability = "glycotwin_phone"
        const val glucosePath = "/glycotwin/glucose/v1"
        const val pairingPath = "/glycotwin/pairing/v1"
        const val activityPrefix = "/glycotwin/activity/v1/"
        const val ackPrefix = "/glycotwin/activity-ack/v1/"
        val allItems = "wear://*/glycotwin".toUri()
        val glucoseSources = setOf("MANUAL", "CGM", "HEALTH_CONNECT", "REPLAY")
    }
}
