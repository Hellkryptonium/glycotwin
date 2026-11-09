package com.glycotwin.patient.data.repository

import com.glycotwin.patient.data.local.TokenStorage
import com.glycotwin.patient.data.remote.ApiResponse
import com.glycotwin.patient.data.remote.AuthTokensDto
import com.glycotwin.patient.data.remote.Credentials
import com.glycotwin.patient.data.remote.GlycoTwinApi
import com.glycotwin.patient.data.remote.RefreshRequest
import com.glycotwin.patient.data.remote.UserDto
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import retrofit2.Response

class ApiException(
    message: String,
    val statusCode: Int? = null,
    val code: String? = null,
    val requestId: String? = null,
) : Exception(message)

class AuthRepository(private val api: GlycoTwinApi, private val tokens: TokenStorage) {
    private val refreshMutex = Mutex()

    suspend fun register(email: String, password: String): Result<UserDto> =
        runCatching { request { api.register(Credentials(email, password)) }.body().requireData() }

    suspend fun login(email: String, password: String): Result<UserDto> = runCatching {
        val auth = request { api.login(Credentials(email, password)) }.body().requireData()
        tokens.save(auth.accessToken, auth.refreshToken)
        authenticated { api.me("Bearer ${tokens.accessToken()}") }.body().requireData()
    }

    suspend fun session(): Result<UserDto> = runCatching {
        val access = tokens.accessToken() ?: throw ApiException("No saved session")
        authenticated { api.me("Bearer $access") }.let { response ->
            if (response.isSuccessful) response.body().requireData()
            else {
                refreshAccess()
            authenticated { api.me("Bearer ${tokens.accessToken()}") }.body().requireData()
            }
        }
    }.onFailure(::clearIfInvalid)

    suspend fun logout() {
        val refresh = tokens.refreshToken()
        if (refresh != null) runCatching { api.logout(RefreshRequest(refresh)) }
        tokens.clear()
    }

    suspend fun refreshAccess(): AuthTokensDto = refreshMutex.withLock {
        val refresh = tokens.refreshToken() ?: throw ApiException("Session expired")
        val result = request { api.refresh(RefreshRequest(refresh)) }.body().requireData()
        tokens.save(result.accessToken, result.refreshToken)
        result
    }

    private suspend fun <T> authenticated(call: suspend () -> Response<ApiResponse<T>>): Response<ApiResponse<T>> {
        var response = call()
        if (response.code() == 401 && tokens.refreshToken() != null) {
            refreshAccess()
            response = call()
        }
        return response
    }

    private suspend fun <T> request(call: suspend () -> Response<ApiResponse<T>>): Response<ApiResponse<T>> {
        val response = call()
        if (!response.isSuccessful) throw ApiException(response.errorBody()?.string() ?: "Request failed", response.code())
        return response
    }

    private fun <T> ApiResponse<T>?.requireData(): T =
        this?.data ?: throw ApiException(this?.error?.message ?: "The server returned no data")

    private fun clearIfInvalid(error: Throwable) {
        if (error is ApiException && (error.statusCode == 401 || error.message == "Session expired")) tokens.clear()
    }
}
