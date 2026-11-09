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
import com.glycotwin.patient.data.remote.GlucoseAnalyticsDto
import com.glycotwin.patient.data.remote.LifestyleEntryDto
import com.glycotwin.patient.data.remote.LifestyleEntryInput
import com.glycotwin.patient.data.remote.LifestylePageDto
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

    suspend fun glucoseAnalytics(range: String): Result<GlucoseAnalyticsDto> = runCatching {
        authenticated { api.glucoseAnalytics(range, auth()) }.body().requireData()
    }

    suspend fun lifestyleTimeline(page: Int = 1, limit: Int = 50): Result<LifestylePageDto> = runCatching {
        authenticated { api.lifestyleTimeline(page, limit, auth()) }.body().requireData()
    }

    suspend fun createLifestyle(type: String, input: LifestyleEntryInput): Result<LifestyleEntryDto> = runCatching {
        val endpoint = when (type) {
            "meal" -> "meals"
            "activity" -> "activities"
            "sleep" -> "sleep"
            "symptom" -> "symptoms"
            else -> throw ApiException("Unsupported lifestyle type: $type")
        }
        authenticated { api.createLifestyle(endpoint, input, auth()) }.body().requireData()
    }

    suspend fun deleteLifestyle(id: String): Result<Unit> = runCatching {
        authenticatedUnit { api.deleteLifestyle(id, auth()) }
    }

    suspend fun updateLifestyle(id: String, input: LifestyleEntryInput): Result<LifestyleEntryDto> = runCatching {
        authenticated { api.updateLifestyle(id, input, auth()) }.body().requireData()
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
        val requestId = runCatching { gson.fromJson(body, ErrorEnvelope::class.java)?.requestId }.getOrNull()
        return ApiException(
            error?.message ?: body?.takeIf { it.isNotBlank() } ?: "Request failed (${code()})",
            code(),
            error?.code,
            requestId,
        )
    }

    private fun Response<Unit>.toUnitApiException(): ApiException = ApiException("Request failed (${code()})", code())

    private data class ErrorEnvelope(val error: ErrorBody?, val requestId: String?)
    private data class ErrorBody(val code: String?, val message: String?)
}
