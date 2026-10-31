package com.glycotwin.patient.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import com.glycotwin.patient.data.local.TokenStorage
import com.glycotwin.patient.data.remote.ApiClient
import com.glycotwin.patient.data.repository.AuthRepository
import com.glycotwin.patient.data.repository.PatientRepository
import com.glycotwin.patient.ui.screens.DashboardScreen
import com.glycotwin.patient.ui.screens.LoginScreen
import com.glycotwin.patient.ui.screens.RegisterScreen
import com.glycotwin.patient.ui.screens.WelcomeScreen
import com.glycotwin.patient.ui.viewmodel.AuthViewModel
import com.glycotwin.patient.ui.viewmodel.PatientViewModel

private enum class Destination {
    Welcome,
    Register,
    Login,
    Dashboard,
}

@Composable
fun GlycoTwinApp() {
    val context = LocalContext.current
    val storage = remember { TokenStorage(context.applicationContext) }
    val authRepository = remember { AuthRepository(ApiClient.api, storage) }
    val patientRepository = remember { PatientRepository(ApiClient.api, storage, authRepository) }
    val authViewModel: AuthViewModel = viewModel(factory = SimpleFactory { AuthViewModel(authRepository) })
    val authState by authViewModel.state.collectAsState()
    if (authState.restoring) return
    if (authState.user != null) {
        val patientViewModel: PatientViewModel = viewModel(factory = SimpleFactory { PatientViewModel(patientRepository) })
        DashboardScreen(
            user = authState.user,
            patientViewModel = patientViewModel,
            onLogout = authViewModel::logout,
        )
        return
    }
    var destination by remember { mutableStateOf(if (authState.registrationComplete) Destination.Login else Destination.Welcome) }
    when (destination) {
        Destination.Welcome -> WelcomeScreen(
            onGetStarted = { destination = Destination.Register },
            onSignIn = { destination = Destination.Login },
        )
        Destination.Register -> RegisterScreen(
            state = authState,
            onSubmit = authViewModel::register,
            onBack = { destination = Destination.Welcome },
            onLogin = { destination = Destination.Login },
        )
        Destination.Login -> LoginScreen(
            state = authState,
            onSubmit = authViewModel::login,
            onBack = { destination = Destination.Welcome },
        )
        Destination.Dashboard -> Unit
    }
}

private class SimpleFactory<T : androidx.lifecycle.ViewModel>(private val create: () -> T) :
    androidx.lifecycle.ViewModelProvider.Factory {
    override fun <R : androidx.lifecycle.ViewModel> create(modelClass: Class<R>): R = create() as R
}
