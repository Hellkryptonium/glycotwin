package com.glycotwin.patient.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.glycotwin.patient.data.remote.InvitationDto
import com.glycotwin.patient.data.remote.PatientProfileResponse
import com.glycotwin.patient.data.remote.PatientProfileUpdate
import com.glycotwin.patient.data.remote.GlucoseReadingDto
import com.glycotwin.patient.data.remote.GlucoseReadingInput
import com.glycotwin.patient.data.repository.ApiException
import com.glycotwin.patient.data.repository.PatientRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

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
)

class PatientViewModel(private val repository: PatientRepository) : ViewModel() {
    private val _state = MutableStateFlow(PatientState())
    val state: StateFlow<PatientState> = _state.asStateFlow()

    fun load() {
        fetch(refresh = false)
        loadProfile()
        loadReadings()
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
            else -> message ?: "Unable to update invitations."
        }
    }
    return message ?: "Unable to update invitations."
}
