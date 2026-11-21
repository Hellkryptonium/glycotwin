package me.glycotwin.patient.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import me.glycotwin.patient.data.remote.InvitationDto
import me.glycotwin.patient.data.remote.PatientProfileResponse
import me.glycotwin.patient.data.remote.PatientProfileUpdate
import me.glycotwin.patient.data.remote.PatientCareDto
import me.glycotwin.patient.data.remote.PatientTimelineItem
import me.glycotwin.patient.data.remote.VisitBriefInput
import me.glycotwin.patient.data.remote.GlucoseReadingDto
import me.glycotwin.patient.data.remote.GlucoseReadingInput
import me.glycotwin.patient.data.remote.GlucoseAnalyticsDto
import me.glycotwin.patient.data.remote.GlucoseAnalyticsReadingDto
import me.glycotwin.patient.data.remote.DailyGlucoseDto
import me.glycotwin.patient.data.remote.GlucoseUnitSummaryDto
import me.glycotwin.patient.data.remote.LifestyleEntryDto
import me.glycotwin.patient.data.remote.LifestyleEntryInput
import me.glycotwin.patient.data.remote.MedicationDto
import me.glycotwin.patient.data.remote.MedicationInput
import me.glycotwin.patient.data.remote.MedicationDoseDto
import me.glycotwin.patient.data.remote.MedicationDoseInput
import me.glycotwin.patient.data.repository.ApiException
import me.glycotwin.patient.data.repository.PatientRepository
import me.glycotwin.patient.data.remote.GlucoseImportInput
import me.glycotwin.patient.data.remote.ImportedGlucoseReading
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.OffsetDateTime
import java.time.ZoneOffset

data class PatientState(
    val loading: Boolean = true,
    val refreshing: Boolean = false,
    val invitations: List<InvitationDto> = emptyList(),
    val actionInProgress: Set<String> = emptySet(),
    val error: String? = null,
    val confirmation: String? = null,
    val profileLoading: Boolean = true,
    val profile: PatientProfileResponse? = null,
    val profileSaving: Boolean = false,
    val readings: List<GlucoseReadingDto> = emptyList(),
    val readingsLoading: Boolean = true,
    val readingsRefreshing: Boolean = false,
    val readingSaving: Boolean = false,
    val readingDeleting: Set<String> = emptySet(),
    val readingsError: String? = null,
    val analytics: GlucoseAnalyticsDto? = null,
    val analyticsRange: String = "7d",
    val analyticsLoading: Boolean = false,
    val analyticsError: String? = null,
    val analyticsPreview: Boolean = false,
    val replaySaving: Boolean = false,
    val replayReadings: List<GlucoseReadingDto> = emptyList(),
    val replayMessage: String? = null,
    val replayError: String? = null,
    val importSaving: Boolean = false,
    val importMessage: String? = null,
    val importError: String? = null,
    val lifestyle: List<LifestyleEntryDto> = emptyList(),
    val lifestyleLoading: Boolean = false,
    val lifestyleError: String? = null,
    val lifestyleSaving: Boolean = false,
    val medications: List<MedicationDto> = emptyList(),
    val medicationsLoading: Boolean = false,
    val medicationSaving: Boolean = false,
    val medicationError: String? = null,
    val medicationDoses: List<MedicationDoseDto> = emptyList(),
    val medicationDoseSaving: Boolean = false,
    val recentTimeline: List<PatientTimelineItem> = emptyList(),
    val timeline: List<PatientTimelineItem> = emptyList(),
    val timelineSource: String? = null,
    val timelinePage: Int = 0,
    val timelineHasMore: Boolean = false,
    val timelineLoading: Boolean = false,
    val timelineError: String? = null,
    val watchActivity: List<PatientTimelineItem> = emptyList(),
    val watchActivityError: String? = null,
    val care: PatientCareDto? = null,
    val careLoading: Boolean = false,
    val careSaving: Boolean = false,
    val careError: String? = null,
    val careMessage: String? = null,
)

class PatientViewModel(
    private val repository: PatientRepository,
    private val accountId: String,
) : ViewModel() {
    private val _state = MutableStateFlow(PatientState())
    val state: StateFlow<PatientState> = _state.asStateFlow()
    private var analyticsRequestId = 0
    private var timelineRequestId = 0
    private var recentTimelineRequestId = 0
    private var careRequestId = 0

    fun endSession() {
        viewModelScope.cancel()
        _state.value = PatientState()
    }

    fun load() {
        fetch(refresh = false)
        loadProfile()
        loadReadings()
        loadAnalytics()
        loadLifestyle()
        loadMedications()
        loadRecentTimeline()
        loadCare()
    }

    fun loadRecentTimeline() {
        val requestId = ++recentTimelineRequestId
        viewModelScope.launch {
            val result = repository.timeline(limit = 12)
            if (requestId != recentTimelineRequestId) return@launch
            result.onSuccess { page ->
                _state.value = _state.value.copy(recentTimeline = page.items.filterNot { it.source == "REPLAY" }.take(5))
            }
        }
    }

    fun loadTimeline(source: String? = _state.value.timelineSource, append: Boolean = false) {
        val current = _state.value
        if (append && (current.timelineLoading || !current.timelineHasMore || source != current.timelineSource)) return
        val requestId = ++timelineRequestId
        val nextPage = if (append) current.timelinePage + 1 else 1
        _state.value = current.copy(
            timelineSource = source,
            timelineLoading = true,
            timelineError = null,
            timeline = current.timeline.takeIf { source == current.timelineSource }.orEmpty(),
            timelinePage = if (append) current.timelinePage else 0,
            timelineHasMore = append && current.timelineHasMore,
        )
        viewModelScope.launch {
            val result = repository.timeline(page = nextPage, source = source)
            if (requestId != timelineRequestId) return@launch
            result.onSuccess { response ->
                _state.value = _state.value.copy(
                    timeline = if (append) (_state.value.timeline + response.items).distinctBy { it.id } else response.items,
                    timelinePage = response.page,
                    timelineHasMore = response.hasMore,
                    timelineLoading = false,
                )
            }.onFailure { error ->
                _state.value = _state.value.copy(timelineLoading = false, timelineError = error.toUserMessage())
            }
        }
    }

    fun loadWatchActivity() {
        viewModelScope.launch {
            repository.timeline(limit = 50, source = "WATCH").onSuccess { page ->
                _state.value = _state.value.copy(watchActivity = page.items, watchActivityError = null)
            }.onFailure { error -> _state.value = _state.value.copy(watchActivityError = error.toUserMessage()) }
        }
    }

    fun loadCare(refresh: Boolean = false) {
        if (_state.value.careLoading && !refresh) return
        val requestId = ++careRequestId
        _state.value = _state.value.copy(careLoading = true, careError = null)
        viewModelScope.launch {
            val result = repository.care()
            if (requestId != careRequestId) return@launch
            result.onSuccess { records -> _state.value = _state.value.copy(care = records, careLoading = false) }
                .onFailure { error -> _state.value = _state.value.copy(careLoading = false, careError = error.toUserMessage()) }
        }
    }

    fun shareVisitBrief(input: VisitBriefInput, onShared: () -> Unit) = updateCare("Visit brief shared.", onShared) {
        repository.createVisitBrief(input).map { }
    }

    fun deleteVisitBrief(id: String) = updateCare("Visit brief sharing stopped.") { repository.deleteVisitBrief(id) }

    fun revokeRelationship(id: String) = updateCare("Care team access ended.", { refresh() }) { repository.revokeRelationship(id) }

    private fun updateCare(message: String, onSuccess: () -> Unit = {}, operation: suspend () -> Result<Unit>) {
        if (_state.value.careSaving) return
        _state.value = _state.value.copy(careSaving = true, careError = null, careMessage = null)
        viewModelScope.launch {
            operation().onSuccess {
                _state.value = _state.value.copy(careSaving = false, careMessage = message)
                loadCare(refresh = true)
                onSuccess()
            }.onFailure { error ->
                _state.value = _state.value.copy(careSaving = false, careError = error.toUserMessage())
            }
        }
    }

    fun loadMedications() {
        viewModelScope.launch {
            _state.value = _state.value.copy(medicationsLoading = true, medicationError = null)
            repository.medications().onSuccess { page -> _state.value = _state.value.copy(medications = page.items, medicationsLoading = false) }
                .onFailure { error -> _state.value = _state.value.copy(medicationsLoading = false, medicationError = error.toUserMessage()) }
        }
    }

    fun saveMedication(id: String?, input: MedicationInput) {
        if (_state.value.medicationSaving) return
        viewModelScope.launch {
            _state.value = _state.value.copy(medicationSaving = true, medicationError = null)
            val result = if (id == null) repository.createMedication(input) else repository.updateMedication(id, input)
            result.onSuccess { _state.value = _state.value.copy(medicationSaving = false); loadMedications() }
                .onFailure { error -> _state.value = _state.value.copy(medicationSaving = false, medicationError = error.toUserMessage()) }
        }
    }

    fun discontinueMedication(id: String) {
        viewModelScope.launch { repository.discontinueMedication(id).onSuccess { loadMedications() }.onFailure { error -> _state.value = _state.value.copy(medicationError = error.toUserMessage()) } }
    }

    fun deleteMedication(id: String) {
        viewModelScope.launch { repository.deleteMedication(id).onSuccess { loadMedications() }.onFailure { error -> _state.value = _state.value.copy(medicationError = error.toUserMessage()) } }
    }

    fun loadMedicationDoses(id: String) {
        viewModelScope.launch { repository.medicationDoses(id).onSuccess { page -> _state.value = _state.value.copy(medicationDoses = page.items) }.onFailure { error -> _state.value = _state.value.copy(medicationError = error.toUserMessage()) } }
    }

    fun recordMedicationDose(id: String, input: MedicationDoseInput, onSaved: () -> Unit) {
        if (_state.value.medicationDoseSaving) return
        viewModelScope.launch {
            _state.value = _state.value.copy(medicationDoseSaving = true, medicationError = null)
            repository.createMedicationDose(id, input)
                .onSuccess {
                    _state.value = _state.value.copy(medicationDoseSaving = false)
                    onSaved()
                    loadMedicationDoses(id)
                }
                .onFailure { error ->
                    _state.value = _state.value.copy(medicationDoseSaving = false, medicationError = error.toUserMessage())
                }
        }
    }

    fun loadLifestyle() {
        viewModelScope.launch {
            _state.value = _state.value.copy(lifestyleLoading = true, lifestyleError = null)
            repository.lifestyleTimeline().onSuccess { page ->
                _state.value = _state.value.copy(lifestyle = page.items, lifestyleLoading = false)
            }.onFailure { error ->
                _state.value = _state.value.copy(lifestyleLoading = false, lifestyleError = error.toUserMessage())
            }
        }
    }

    fun addLifestyle(input: LifestyleEntryInput, onSaved: () -> Unit) {
        if (_state.value.lifestyleSaving) return
        viewModelScope.launch {
            _state.value = _state.value.copy(lifestyleSaving = true, lifestyleError = null)
            repository.createLifestyle(input.type, input).onSuccess {
                _state.value = _state.value.copy(lifestyleSaving = false)
                onSaved()
                loadLifestyle()
            }.onFailure { error ->
                _state.value = _state.value.copy(lifestyleSaving = false, lifestyleError = error.toUserMessage())
            }
        }
    }

    fun deleteLifestyle(id: String) {
        viewModelScope.launch {
            repository.deleteLifestyle(id).onSuccess { loadLifestyle() }
                .onFailure { error -> _state.value = _state.value.copy(lifestyleError = error.toUserMessage()) }
        }
    }

    fun updateLifestyle(id: String, input: LifestyleEntryInput, onSaved: () -> Unit) {
        if (_state.value.lifestyleSaving) return
        viewModelScope.launch {
            _state.value = _state.value.copy(lifestyleSaving = true, lifestyleError = null)
            repository.updateLifestyle(id, input).onSuccess {
                _state.value = _state.value.copy(lifestyleSaving = false)
                onSaved()
                loadLifestyle()
            }.onFailure { error ->
                _state.value = _state.value.copy(lifestyleSaving = false, lifestyleError = error.toUserMessage())
            }
        }
    }

    fun loadAnalytics(range: String = _state.value.analyticsRange, refresh: Boolean = false) {
        val requestId = ++analyticsRequestId
        viewModelScope.launch {
        _state.value = _state.value.copy(analyticsRange = range, analyticsLoading = true, analyticsError = null, analyticsPreview = false)
            repository.glucoseAnalytics(range).onSuccess { analytics ->
                if (requestId == analyticsRequestId) {
                    _state.value = _state.value.copy(analytics = analytics, analyticsLoading = false)
                }
            }.onFailure { error ->
                if (requestId == analyticsRequestId) {
                    _state.value = _state.value.copy(analyticsLoading = false, analyticsError = error.toUserMessage())
                }
            }
        }
    }

    fun showAnalyticsPreview() {
        ++analyticsRequestId
        val now = OffsetDateTime.now(ZoneOffset.UTC)
        val readings = listOf(112, 126, 118, 134, 121, 142, 129).mapIndexed { index, value ->
            GlucoseAnalyticsReadingDto(
                value = value.toString(),
                measuredAt = now.minusDays((6 - index).toLong()).withHour(8).withMinute(0).toString(),
                unit = "mg/dL",
                source = "REPLAY",
            )
        }
        _state.value = _state.value.copy(
            analytics = GlucoseAnalyticsDto(
                range = "7d",
                from = now.minusDays(7).toString(),
                to = now.toString(),
                unit = "mg/dL",
                latest = readings.last(),
                totalReadings = readings.size,
                average = "126.00",
                minimum = "112.00",
                maximum = "142.00",
                daily = readings.mapIndexed { index, reading ->
                    DailyGlucoseDto(
                        date = now.minusDays((6 - index).toLong()).toLocalDate().toString(),
                        average = reading.value,
                        readingCount = 1,
                        unit = reading.unit,
                    )
                },
                readings = readings,
                byUnit = listOf(
                    GlucoseUnitSummaryDto("mg/dL", readings.size, "126.00", "112.00", "142.00"),
                ),
            ),
            analyticsRange = "7d",
            analyticsLoading = false,
            analyticsError = null,
            analyticsPreview = true,
        )
    }

    fun loadReplay() {
        viewModelScope.launch {
            repository.glucoseReadings(source = "REPLAY").onSuccess { page ->
                _state.value = _state.value.copy(replayReadings = page.items)
            }.onFailure { error ->
                _state.value = _state.value.copy(replayError = error.toUserMessage())
            }
        }
    }

    fun runReplay() {
        if (_state.value.replaySaving) return
        viewModelScope.launch {
            _state.value = _state.value.copy(replaySaving = true, replayMessage = null, replayError = null)
            repository.replayGlucose().onSuccess { result ->
                _state.value = _state.value.copy(
                    replaySaving = false,
                    replayMessage = "${result.inserted} sample readings added. ${result.duplicates} were already saved.",
                )
                loadReplay()
                loadReadings(refresh = true)
            }.onFailure { error ->
                _state.value = _state.value.copy(replaySaving = false, replayError = error.toUserMessage())
            }
        }
    }

    fun importGlucose(readings: List<ImportedGlucoseReading>) {
        if (_state.value.importSaving || readings.isEmpty()) return
        viewModelScope.launch {
            _state.value = _state.value.copy(importSaving = true, importMessage = null, importError = null)
            var inserted = 0
            var duplicates = 0
            for (batch in readings.chunked(500)) {
                val result = repository.importGlucose(GlucoseImportInput(batch), accountId)
                val error = result.exceptionOrNull()
                if (error is CancellationException) throw error
                if (error != null) {
                    _state.value = _state.value.copy(
                        importSaving = false,
                        importError = if (inserted > 0) "$inserted readings imported before the request failed. ${error.toUserMessage()}" else error.toUserMessage(),
                    )
                    if (inserted > 0) loadReadings(refresh = true)
                    return@launch
                }
                val count = result.getOrThrow()
                inserted += count.inserted
                duplicates += count.duplicates
            }
            _state.value = _state.value.copy(
                importSaving = false,
                importMessage = "$inserted readings imported. $duplicates were already saved.",
            )
            loadReadings(refresh = true)
            loadAnalytics(_state.value.analyticsRange, refresh = true)
        }
    }

    fun loadReadings(refresh: Boolean = false) {
        if (refresh && _state.value.readingsRefreshing) return
        viewModelScope.launch {
            _state.value = _state.value.copy(
                readingsLoading = !refresh,
                readingsRefreshing = refresh,
                readingsError = null,
            )
            repository.glucoseReadings().onSuccess { page ->
                _state.value = _state.value.copy(
                    readingsLoading = false,
                    readingsRefreshing = false,
                    readings = page.items,
                )
            }.onFailure { error ->
                _state.value = _state.value.copy(
                    readingsLoading = false,
                    readingsRefreshing = false,
                    readingsError = error.toUserMessage(),
                )
            }
        }
    }

    fun saveReading(id: String?, input: GlucoseReadingInput) {
        if (_state.value.readingSaving) return
        viewModelScope.launch {
            _state.value = _state.value.copy(readingSaving = true, readingsError = null, confirmation = null)
            val result = if (id == null) repository.createGlucoseReading(input) else repository.updateGlucoseReading(id, input)
            result.onSuccess {
                _state.value = _state.value.copy(readingSaving = false, confirmation = if (id == null) "Reading saved." else "Reading updated.")
                loadReadings(refresh = true)
            }.onFailure { error ->
                _state.value = _state.value.copy(readingSaving = false, readingsError = error.toUserMessage())
            }
        }
    }

    fun deleteReading(id: String) {
        if (id in _state.value.readingDeleting) return
        viewModelScope.launch {
            _state.value = _state.value.copy(readingDeleting = _state.value.readingDeleting + id, readingsError = null)
            repository.deleteGlucoseReading(id).onSuccess {
                _state.value = _state.value.copy(readingDeleting = _state.value.readingDeleting - id, confirmation = "Reading deleted.")
                loadReadings(refresh = true)
            }.onFailure { error ->
                _state.value = _state.value.copy(readingDeleting = _state.value.readingDeleting - id, readingsError = error.toUserMessage())
            }
        }
    }

    fun loadProfile() {
        if (_state.value.profileLoading && _state.value.profile != null) return
        viewModelScope.launch {
            _state.value = _state.value.copy(profileLoading = true, error = null)
            repository.profile().onSuccess { profile ->
                _state.value = _state.value.copy(profileLoading = false, profile = profile)
            }.onFailure { error ->
                _state.value = _state.value.copy(profileLoading = false, error = error.toUserMessage())
            }
        }
    }

    fun saveProfile(input: PatientProfileUpdate) {
        if (_state.value.profileSaving) return
        viewModelScope.launch {
            _state.value = _state.value.copy(profileSaving = true, error = null, confirmation = null)
            repository.updateProfile(input).onSuccess { profile ->
                _state.value = _state.value.copy(profileSaving = false, profile = profile, confirmation = "Profile saved.")
            }.onFailure { error ->
                _state.value = _state.value.copy(profileSaving = false, error = error.toUserMessage())
            }
        }
    }

    fun refresh() {
        fetch(refresh = true)
        loadCare()
    }

    fun refreshHome() {
        fetch(refresh = true)
        loadReadings(refresh = true)
        loadMedications()
        loadLifestyle()
        loadRecentTimeline()
        loadCare()
    }

    private fun fetch(refresh: Boolean) {
        if (_state.value.refreshing || (_state.value.loading && refresh)) return
        viewModelScope.launch {
            _state.value = _state.value.copy(
                loading = !refresh,
                refreshing = refresh,
                error = null,
            )
            repository.invitations().onSuccess { invitations ->
                _state.value = _state.value.copy(
                    loading = false,
                    refreshing = false,
                    invitations = invitations,
                    error = null,
                )
            }.onFailure { error ->
                _state.value = _state.value.copy(
                    loading = false,
                    refreshing = false,
                    error = error.toUserMessage(),
                )
            }
        }
    }

    fun respond(id: String, action: InvitationAction) {
        val current = _state.value
        if (id in current.actionInProgress) return
        val invitation = current.invitations.firstOrNull { it.id == id } ?: return
        if (invitation.status != "pending") return

        viewModelScope.launch {
            _state.value = current.copy(
                actionInProgress = current.actionInProgress + id,
                error = null,
                confirmation = null,
            )
            repository.respond(id, action.value).onSuccess { status ->
                _state.value = _state.value.copy(
                    actionInProgress = _state.value.actionInProgress - id,
                    confirmation = if (status == "accepted") {
                        "Doctor connection accepted."
                    } else {
                        "Invitation declined."
                    },
                )
                fetch(refresh = true)
                loadCare(refresh = true)
            }.onFailure { error ->
                _state.value = _state.value.copy(
                    actionInProgress = _state.value.actionInProgress - id,
                    error = error.toUserMessage(),
                )
            }
        }
    }

    fun clearMessages() {
        _state.value = _state.value.copy(error = null, confirmation = null)
    }
}

enum class InvitationAction(val value: String) {
    ACCEPT("accepted"),
    DECLINE("declined"),
}

private fun Throwable.toUserMessage(): String {
    if (this is ApiException) {
        return when (code) {
            "INVITATION_EXPIRED" -> "This invitation has expired."
            "INVITATION_NOT_PENDING" -> "This invitation has already been resolved."
            "INVITATION_NOT_FOUND" -> "This invitation is no longer available."
            "UNAUTHORIZED" -> "Your session has expired. Please sign in again."
            else -> buildString {
                append(message ?: "Request failed")
                statusCode?.let { append(" (HTTP $it)") }
                requestId?.let { append(" [request $it]") }
            }
        }
    }
    return message ?: "Unable to update invitations."
}
