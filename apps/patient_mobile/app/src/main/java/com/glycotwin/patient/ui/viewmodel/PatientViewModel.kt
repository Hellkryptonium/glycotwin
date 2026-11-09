package com.glycotwin.patient.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.glycotwin.patient.data.remote.InvitationDto
import com.glycotwin.patient.data.remote.PatientProfileResponse
import com.glycotwin.patient.data.remote.PatientProfileUpdate
import com.glycotwin.patient.data.remote.GlucoseReadingDto
import com.glycotwin.patient.data.remote.GlucoseReadingInput
import com.glycotwin.patient.data.remote.GlucoseAnalyticsDto
import com.glycotwin.patient.data.remote.GlucoseAnalyticsReadingDto
import com.glycotwin.patient.data.remote.DailyGlucoseDto
import com.glycotwin.patient.data.remote.GlucoseUnitSummaryDto
import com.glycotwin.patient.data.remote.LifestyleEntryDto
import com.glycotwin.patient.data.remote.LifestyleEntryInput
import com.glycotwin.patient.data.repository.ApiException
import com.glycotwin.patient.data.repository.PatientRepository
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
    val lifestyle: List<LifestyleEntryDto> = emptyList(),
    val lifestyleLoading: Boolean = false,
    val lifestyleError: String? = null,
    val lifestyleSaving: Boolean = false,
)

class PatientViewModel(private val repository: PatientRepository) : ViewModel() {
    private val _state = MutableStateFlow(PatientState())
    val state: StateFlow<PatientState> = _state.asStateFlow()
    private var analyticsRequestId = 0

    fun load() {
        fetch(refresh = false)
        loadProfile()
        loadReadings()
        loadAnalytics()
        loadLifestyle()
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

    fun addLifestyle(input: LifestyleEntryInput) {
        if (_state.value.lifestyleSaving) return
        viewModelScope.launch {
            _state.value = _state.value.copy(lifestyleSaving = true, lifestyleError = null)
            repository.createLifestyle(input.type, input).onSuccess {
                _state.value = _state.value.copy(lifestyleSaving = false)
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

    fun updateLifestyle(id: String, input: LifestyleEntryInput) {
        viewModelScope.launch {
            _state.value = _state.value.copy(lifestyleSaving = true, lifestyleError = null)
            repository.updateLifestyle(id, input).onSuccess {
                _state.value = _state.value.copy(lifestyleSaving = false)
                loadLifestyle()
            }.onFailure { error ->
                _state.value = _state.value.copy(lifestyleSaving = false, lifestyleError = error.toUserMessage())
            }
        }
    }

    fun loadAnalytics(range: String = _state.value.analyticsRange, refresh: Boolean = false) {
        val requestId = ++analyticsRequestId
        viewModelScope.launch {
            _state.value = _state.value.copy(analyticsRange = range, analyticsLoading = true, analyticsError = null)
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
        val now = OffsetDateTime.now(ZoneOffset.UTC)
        val readings = listOf(112, 126, 118, 134, 121, 142, 129).mapIndexed { index, value ->
            GlucoseAnalyticsReadingDto(
                value = value.toString(),
                measuredAt = now.minusDays((6 - index).toLong()).withHour(8).withMinute(0).toString(),
                unit = "mg/dL",
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
        )
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
