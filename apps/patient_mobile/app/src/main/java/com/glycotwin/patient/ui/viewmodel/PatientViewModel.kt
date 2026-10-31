package com.glycotwin.patient.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.glycotwin.patient.data.remote.InvitationDto
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
)

class PatientViewModel(private val repository: PatientRepository) : ViewModel() {
    private val _state = MutableStateFlow(PatientState())
    val state: StateFlow<PatientState> = _state.asStateFlow()

    fun load() {
        fetch(refresh = false)
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
