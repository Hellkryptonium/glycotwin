package me.glycotwin.patient.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import me.glycotwin.patient.data.local.TokenStorage
import me.glycotwin.patient.data.remote.ApiClient
import me.glycotwin.patient.data.repository.AuthRepository
import me.glycotwin.patient.data.repository.PatientRepository
import me.glycotwin.patient.data.wear.WearBridge
import me.glycotwin.patient.ui.screens.DashboardScreen
import me.glycotwin.patient.ui.screens.LoginScreen
import me.glycotwin.patient.ui.screens.ProfileScreen
import me.glycotwin.patient.ui.screens.RegisterScreen
import me.glycotwin.patient.ui.screens.RestoringSessionScreen
import me.glycotwin.patient.ui.screens.WelcomeScreen
import me.glycotwin.patient.ui.viewmodel.AuthViewModel
import me.glycotwin.patient.ui.viewmodel.PatientViewModel

private enum class Destination { Welcome, Register, Login }

@Composable
fun GlycoTwinApp() {
    val context = LocalContext.current.applicationContext
    val authViewModel: AuthViewModel = viewModel(factory = SimpleFactory {
        AuthViewModel(AuthRepository(ApiClient.api, TokenStorage(context)))
    })
    val authRepository = authViewModel.repository
    val wearBridge = remember(authRepository) { WearBridge(context, PatientRepository(ApiClient.api, authRepository)) }
    DisposableEffect(wearBridge) { onDispose { wearBridge.close() } }

    val authState by authViewModel.state.collectAsState()
    LaunchedEffect(authState.restoring, authState.resumeAvailable, authState.sessionKey) {
        if (!authState.restoring && !authState.resumeAvailable) wearBridge.bind(authState.user?.id)
    }
    if (authState.restoring || authState.resumeAvailable) {
        RestoringSessionScreen(authState, authViewModel::restore, authViewModel::logout)
        return
    }

    val user = authState.user
    if (user != null) {
        val sessionKey = authState.sessionKey
        val patientViewModel: PatientViewModel = viewModel(
            key = "patient/$sessionKey",
            factory = SimpleFactory { PatientViewModel(PatientRepository(ApiClient.api, authRepository, user.id), user.id) },
        )
        val patientState by patientViewModel.state.collectAsState()
        val latestReading = patientState.readings.firstOrNull()
        LaunchedEffect(wearBridge, user.id, latestReading) { wearBridge.acceptLatestReading(user.id, latestReading) }
        LaunchedEffect(patientViewModel) { patientViewModel.load() }
        DisposableEffect(patientViewModel) {
            onDispose {
                if (authViewModel.state.value.sessionKey != sessionKey) patientViewModel.endSession()
            }
        }
        val logout = {
            wearBridge.bind(null)
            authViewModel.logout()
        }
        if ((patientState.profile?.profile ?: user.patientProfile)?.fullName.isNullOrBlank()) {
            ProfileScreen(patientViewModel, user, logout, required = true)
        } else {
            DashboardScreen(
                user = user, patientViewModel = patientViewModel, authViewModel = authViewModel,
                wearBridge = wearBridge, onLogout = logout,
            )
        }
        return
    }

    var destination by rememberSaveable {
        mutableStateOf(if (authState.notice != null || authState.error != null) Destination.Login else Destination.Welcome)
    }
    fun navigate(next: Destination) {
        authViewModel.clearMessage()
        destination = next
    }
    when (destination) {
        Destination.Welcome -> WelcomeScreen(
            onGetStarted = { navigate(Destination.Register) },
            onSignIn = { navigate(Destination.Login) },
        )
        Destination.Register -> RegisterScreen(
            state = authState,
            onSubmit = authViewModel::register,
            onBack = { navigate(Destination.Welcome) },
            onLogin = { navigate(Destination.Login) },
        )
        Destination.Login -> LoginScreen(
            state = authState,
            onSubmit = authViewModel::login,
            onBack = { navigate(Destination.Welcome) },
        )
    }
}

private class SimpleFactory<T : androidx.lifecycle.ViewModel>(private val create: () -> T) :
    androidx.lifecycle.ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <R : androidx.lifecycle.ViewModel> create(modelClass: Class<R>): R = create() as R
}
