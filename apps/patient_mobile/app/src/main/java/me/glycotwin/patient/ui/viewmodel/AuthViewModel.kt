package me.glycotwin.patient.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import me.glycotwin.patient.data.remote.UserDto
import me.glycotwin.patient.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.IOException

data class AuthState(
    val restoring: Boolean = true,
    val resumeAvailable: Boolean = false,
    val loading: Boolean = false,
    val user: UserDto? = null,
    val error: String? = null,
    val notice: String? = null,
    val sessionKey: String? = null,
)

class AuthViewModel(internal val repository: AuthRepository) : ViewModel() {
    private val _state = MutableStateFlow(AuthState())
    val state: StateFlow<AuthState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            repository.expiredSessions.collect { expiredId ->
                if (_state.value.sessionKey == expiredId && _state.value.user != null) {
                    _state.value = signedOut("Your session expired. Sign in to continue.")
                }
            }
        }
        restore()
    }

    fun restore() {
        if (_state.value.loading) return
        if (!repository.hasSavedSession()) {
            _state.value = signedOut()
            return
        }
        _state.value = _state.value.copy(restoring = true, loading = true, error = null)
        viewModelScope.launch { authenticate(repository.session()) }
    }

    fun register(email: String, password: String) = submit { authenticate(repository.register(email, password)) }

    fun login(email: String, password: String) = submit { authenticate(repository.login(email, password)) }

    fun logout() = submit {
        repository.logout()
        _state.value = signedOut()
    }

    fun deleteAccount(password: String) = submit {
        repository.deleteAccount(password).onSuccess { _state.value = signedOut("Your account was deleted.") }.onFailure(::showError)
    }

    fun changePassword(current: String, updated: String) = submit {
        repository.changePassword(current, updated).onSuccess {
            _state.value = signedOut("Password updated. Sign in with your new password.")
        }.onFailure(::showError)
    }

    fun clearMessage() {
        _state.value = _state.value.copy(error = null, notice = null)
    }

    private fun submit(block: suspend () -> Unit) {
        if (_state.value.loading) return
        _state.value = _state.value.copy(loading = true, error = null, notice = null)
        viewModelScope.launch { block() }
    }

    private fun authenticate(result: Result<UserDto>) {
        result.onSuccess { user ->
            _state.value = AuthState(restoring = false, user = user, sessionKey = repository.sessionId())
        }.onFailure { error ->
            _state.value = AuthState(
                restoring = false,
                resumeAvailable = repository.hasSavedSession(),
                error = error.userMessage(),
            )
        }
    }

    private fun showError(error: Throwable) {
        _state.value = _state.value.copy(loading = false, error = error.userMessage())
    }

    private fun signedOut(notice: String? = null) = AuthState(restoring = false, notice = notice)
}

private fun Throwable.userMessage(): String = when (this) {
    is IOException -> "Couldn’t reach GlycoTwin. Check your connection and try again."
    else -> message?.takeIf { it.isNotBlank() } ?: "Something went wrong. Try again."
}
