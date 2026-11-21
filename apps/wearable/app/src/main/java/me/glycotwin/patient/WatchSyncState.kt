package me.glycotwin.patient

internal data class SharedGlucose(
    val id: String,
    val value: String,
    val unit: String,
    val source: String,
    val measuredAtMs: Long,
)

internal data class PhoneSyncState(
    val status: PhoneStatus = PhoneStatus.CHECKING,
    val glucose: SharedGlucose? = null,
    val activitySessionId: String? = null,
    val activitySharingKnown: Boolean = false,
) {
    val canStartWorkout: Boolean
        get() = status == PhoneStatus.CONNECTED && activitySharingKnown && activitySessionId != null

    fun revokesWorkout(sessionId: String?): Boolean =
        activitySharingKnown && sessionId != null && sessionId != activitySessionId

    fun withoutConnection(status: PhoneStatus): PhoneSyncState =
        copy(status = status, glucose = null, activitySharingKnown = false)
}

internal enum class PhoneStatus { CHECKING, CONNECTED, DISCONNECTED, UNAVAILABLE }

internal enum class GlucoseFreshness { RECENT, OLDER, CLOCK_AHEAD }

internal fun glucoseFreshness(measuredAtMs: Long, nowMs: Long): GlucoseFreshness = when {
    measuredAtMs > nowMs -> GlucoseFreshness.CLOCK_AHEAD
    nowMs - measuredAtMs > 15 * 60 * 1_000L -> GlucoseFreshness.OLDER
    else -> GlucoseFreshness.RECENT
}

internal enum class ActivitySyncStatus { SAVING, QUEUED, RETRYING, ACKNOWLEDGED, DISCARDED }

internal fun activitySyncStatus(
    hasUnsent: Boolean,
    isSaving: Boolean,
    hasUnacknowledged: Boolean,
    receivedAcknowledgment: Boolean,
): ActivitySyncStatus? = when {
    isSaving -> ActivitySyncStatus.SAVING
    hasUnsent -> ActivitySyncStatus.RETRYING
    hasUnacknowledged -> ActivitySyncStatus.QUEUED
    receivedAcknowledgment -> ActivitySyncStatus.ACKNOWLEDGED
    else -> null
}
