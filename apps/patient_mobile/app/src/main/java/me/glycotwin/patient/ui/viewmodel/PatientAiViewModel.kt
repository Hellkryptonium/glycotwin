package me.glycotwin.patient.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import me.glycotwin.patient.data.remote.PatientAiConversationDetailDto
import me.glycotwin.patient.data.remote.PatientAiConversationDto
import me.glycotwin.patient.data.remote.PatientAiImageInput
import me.glycotwin.patient.data.remote.PatientAiMessageDto
import me.glycotwin.patient.data.remote.PatientAiMessageInput
import me.glycotwin.patient.data.repository.ApiException
import me.glycotwin.patient.data.repository.PatientRepository

data class PatientAiState(
    val loading: Boolean = true,
    val conversations: List<PatientAiConversationDto> = emptyList(),
    val detail: PatientAiConversationDetailDto? = null,
    val sending: Boolean = false,
    val error: String? = null,
)

class PatientAiViewModel(private val repository: PatientRepository) : ViewModel() {
    private val _state = MutableStateFlow(PatientAiState())
    val state: StateFlow<PatientAiState> = _state.asStateFlow()

    fun load() {
        viewModelScope.launch {
            repository.aiConversations().onSuccess { conversations ->
                _state.value = _state.value.copy(loading = false, conversations = conversations, error = null)
                conversations.firstOrNull()?.let(::open)
            }.onFailure { error ->
                _state.value = _state.value.copy(loading = false, error = error.userMessage())
            }
        }
    }

    fun open(conversation: PatientAiConversationDto) {
        viewModelScope.launch {
            repository.aiConversation(conversation.id).onSuccess { detail ->
                _state.value = _state.value.copy(detail = detail, error = null)
            }.onFailure { error -> _state.value = _state.value.copy(error = error.userMessage()) }
        }
    }

    fun startNew() {
        if (_state.value.sending) return
        viewModelScope.launch {
            repository.createAiConversation().onSuccess { conversation ->
                _state.value = _state.value.copy(
                    detail = PatientAiConversationDetailDto(conversation, emptyList()),
                    conversations = listOf(conversation) + _state.value.conversations,
                    error = null,
                )
            }.onFailure { error -> _state.value = _state.value.copy(error = error.userMessage()) }
        }
    }

    fun send(message: String, reviewKind: String? = null, image: PatientAiImageInput? = null) {
        if (_state.value.sending || (message.isBlank() && image == null)) return
        val current = _state.value.detail
        if (current == null) {
            viewModelScope.launch {
                repository.createAiConversation().onSuccess { conversation ->
                    _state.value = _state.value.copy(
                        detail = PatientAiConversationDetailDto(conversation, emptyList()),
                        conversations = listOf(conversation) + _state.value.conversations,
                        error = null,
                    )
                    send(message, reviewKind, image)
                }.onFailure { error -> _state.value = _state.value.copy(error = error.userMessage()) }
            }
            return
        }
        val content = message.trim()
        val optimistic = PatientAiMessageDto(
            id = "pending-${System.nanoTime()}", conversationId = current.conversation.id, role = "PATIENT",
            content = content.ifBlank { if (reviewKind == "FOOD") "Please review this food photo." else "Please review this medication photo." },
            reviewKind = reviewKind, imageName = image?.name, createdAt = "",
        )
        _state.value = _state.value.copy(
            sending = true, error = null,
            detail = current.copy(messages = current.messages + optimistic),
        )
        viewModelScope.launch {
            repository.sendAiMessage(current.conversation.id, PatientAiMessageInput(content, reviewKind, image)).onSuccess { result ->
                val latest = _state.value.detail
                if (latest?.conversation?.id == current.conversation.id) {
                    _state.value = _state.value.copy(
                        sending = false,
                        detail = latest.copy(messages = latest.messages.filterNot { it.id == optimistic.id } + result.patientMessage + result.assistantMessage),
                        conversations = _state.value.conversations.map {
                            if (it.id == current.conversation.id) it.copy(updatedAt = result.assistantMessage.createdAt) else it
                        }.sortedByDescending { it.updatedAt },
                    )
                }
            }.onFailure { error ->
                val latest = _state.value.detail
                _state.value = _state.value.copy(
                    sending = false,
                    error = error.userMessage(),
                    detail = latest?.copy(messages = latest.messages.filterNot { it.id == optimistic.id }),
                )
            }
        }
    }

    fun clearError() { _state.value = _state.value.copy(error = null) }
    fun reportError(message: String) { _state.value = _state.value.copy(error = message) }
}

private fun Throwable.userMessage() = (this as? ApiException)?.message ?: "Something went wrong. Please try again."
