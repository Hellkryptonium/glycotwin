package com.glycotwin.patient.data.repository

import com.glycotwin.patient.data.local.TokenStorage
import com.glycotwin.patient.data.remote.ApiResponse
import com.glycotwin.patient.data.remote.GlycoTwinApi
import com.glycotwin.patient.data.remote.InvitationAction
import com.glycotwin.patient.data.remote.InvitationDto
import com.glycotwin.patient.data.remote.PatientProfileResponse
import com.glycotwin.patient.data.remote.PatientProfileUpdate
import com.glycotwin.patient.data.remote.GlucosePageDto
import com.glycotwin.patient.data.remote.GlucoseReadingDto
import com.glycotwin.patient.data.remote.GlucoseReadingInput
import com.google.gson.Gson
import retrofit2.Response

class PatientRepository(private val api: GlycoTwinApi, private val tokens: TokenStorage, private val authRepository: AuthRepository) {
    private val gson = Gson()
    suspend fun invitations(): Result<List<InvitationDto>> = runCatching {
        authenticated { api.invitations(auth()) }.body().requireData()
    }

    suspend fun respond(id: String, action: String): Result<String> = runCatching {
        authenticated { api.respond(id, InvitationAction(action), auth()) }.body().requireData().status
    }

    suspend fun profile(): Result<PatientProfileResponse> = runCatching {
        authenticated { api.profile(auth()) }.body().requireData()
    }

    suspend fun updateProfile(input: PatientProfileUpdate): Result<PatientProfileResponse> = runCatching {
        authenticated { api.updateProfile(input, auth()) }.body().requireData()
    }

    suspend fun glucoseReadings(page: Int = 1, limit: Int = 20): Result<GlucosePageDto> = runCatching {
        authenticated { api.glucoseReadings(page, limit, auth()) }.body().requireData()
    }

    suspend fun createGlucoseReading(input: GlucoseReadingInput): Result<GlucoseReadingDto> = runCatching {
        authenticated { api.createGlucoseReading(input, auth()) }.body().requireData()
    }

    suspend fun updateGlucoseReading(id: String, input: GlucoseReadingInput): Result<GlucoseReadingDto> = runCatching {
        authenticated { api.updateGlucoseReading(id, input, auth()) }.body().requireData()
    }

    suspend fun deleteGlucoseReading(id: String): Result<Unit> = runCatching {
        authenticatedUnit { api.deleteGlucoseReading(id, auth()) }
    }

    private fun auth() = "Bearer ${tokens.accessToken() ?: throw ApiException("Session expired")}"

    private suspend fun <T> authenticated(call: suspend () -> Response<ApiResponse<T>>): Response<ApiResponse<T>> {
        var response = call()
        if (response.code() == 401 && tokens.refreshToken() != null) {
            authRepository.refreshAccess()
            response = call()
        }
        if (!response.isSuccessful) throw response.toApiException()
        return response
    }

    private suspend fun authenticatedUnit(call: suspend () -> Response<Unit>) {
        var response = call()
        if (response.code() == 401 && tokens.refreshToken() != null) {
            authRepository.refreshAccess()
            response = call()
        }
        if (!response.isSuccessful) throw response.toUnitApiException()
    }

    private fun <T> ApiResponse<T>?.requireData(): T =
        this?.data ?: throw ApiException(this?.error?.message ?: "The server returned no data")

    private fun <T> Response<ApiResponse<T>>.toApiException(): ApiException {
        val body = errorBody()?.string()
        val error = runCatching { gson.fromJson(body, ErrorEnvelope::class.java)?.error }.getOrNull()
        return ApiException(
            error?.message ?: "Request failed (${code()})",
            code(),
            error?.code,
        )
    }

    private fun Response<Unit>.toUnitApiException(): ApiException = ApiException("Request failed (${code()})", code())

    private data class ErrorEnvelope(val error: ErrorBody?)
    private data class ErrorBody(val code: String?, val message: String?)
}
