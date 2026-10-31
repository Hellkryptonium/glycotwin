package com.glycotwin.patient.ui.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.glycotwin.patient.data.remote.UserDto
import com.glycotwin.patient.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AuthState(
    val restoring: Boolean = true,
    val loading: Boolean = false,
    val user: UserDto? = null,
    val error: String? = null,
    val registrationComplete: Boolean = false,
)

class AuthViewModel(private val repository: AuthRepository) : ViewModel() {
    private val _state = MutableStateFlow(AuthState())
    val state: StateFlow<AuthState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            repository.session().onSuccess { user ->
                _state.value = AuthState(restoring = false, user = user)
            }.onFailure {
                _state.value = AuthState(restoring = false)
            }
        }
    }

    fun register(email: String, password: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, registrationComplete = false)
            repository.register(email, password).onSuccess {
                _state.value = AuthState(restoring = false, registrationComplete = true)
            }.onFailure { error ->
                Log.e("GlycoTwinAuth", "Registration failed", error)
                _state.value = _state.value.copy(loading = false, error = error.userMessage())
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            repository.login(email, password).onSuccess { user ->
                _state.value = AuthState(restoring = false, user = user)
            }.onFailure { error ->
                Log.e("GlycoTwinAuth", "Login failed", error)
                _state.value = _state.value.copy(loading = false, error = error.userMessage())
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            repository.logout()
            _state.value = AuthState(restoring = false)
        }
    }

    fun clearMessage() {
        _state.value = _state.value.copy(error = null, registrationComplete = false)
    }
}

private fun Throwable.userMessage(): String =
    message?.takeIf { it.isNotBlank() } ?: "Something went wrong. Try again."
