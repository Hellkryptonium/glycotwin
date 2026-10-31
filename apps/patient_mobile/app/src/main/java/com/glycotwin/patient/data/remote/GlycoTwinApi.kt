package com.glycotwin.patient.data.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

data class ApiResponse<T>(val success: Boolean, val data: T?, val error: ApiError?)
data class ApiError(val code: String?, val message: String?)
data class Credentials(val email: String, val password: String)
data class RefreshRequest(val refreshToken: String)
data class AuthTokensDto(val accessToken: String, val refreshToken: String, val expiresIn: Long)
data class UserDto(
    val id: String,
    val email: String,
    val role: String,
    val isActive: Boolean,
    val patientProfile: PatientProfileDto?,
)
data class PatientProfileDto(val id: String, val fullName: String?, val dateOfBirth: String?, val gender: String?, val diabetesType: String?)
data class InvitationDto(
    val id: String,
    val status: String,
    val expiresAt: String?,
    val respondedAt: String?,
    val createdAt: String?,
    val doctor: DoctorDto?,
)
data class DoctorDto(val id: String?, val fullName: String?)
data class InvitationAction(val action: String)
data class InvitationStatus(val status: String)
data class PatientProfileUpdate(
    val fullName: String,
    val dateOfBirth: String?,
    val gender: String?,
    val diabetesType: String?,
)

interface GlycoTwinApi {
    @POST("auth/register/patient")
    suspend fun register(@Body body: Credentials): Response<ApiResponse<UserDto>>

    @POST("auth/login")
    suspend fun login(@Body body: Credentials): Response<ApiResponse<AuthTokensDto>>

    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): Response<ApiResponse<AuthTokensDto>>

    @POST("auth/logout")
    suspend fun logout(@Body body: RefreshRequest): Response<Unit>

    @GET("auth/me")
    suspend fun me(@retrofit2.http.Header("Authorization") authorization: String): Response<ApiResponse<UserDto>>

    @GET("patient/invitations")
    suspend fun invitations(@retrofit2.http.Header("Authorization") authorization: String): Response<ApiResponse<List<InvitationDto>>>

    @POST("patient/invitations/{id}/respond")
    suspend fun respond(
        @Path("id") id: String,
        @Body body: InvitationAction,
        @retrofit2.http.Header("Authorization") authorization: String,
    ): Response<ApiResponse<InvitationStatus>>

    @retrofit2.http.GET("patient/profile")
    suspend fun profile(@retrofit2.http.Header("Authorization") authorization: String): Response<ApiResponse<PatientProfileResponse>>

    @retrofit2.http.PUT("patient/profile")
    suspend fun updateProfile(
        @retrofit2.http.Body body: PatientProfileUpdate,
        @retrofit2.http.Header("Authorization") authorization: String,
    ): Response<ApiResponse<PatientProfileResponse>>

    @retrofit2.http.POST("patient/glucose-readings")
    suspend fun createGlucoseReading(
        @retrofit2.http.Body body: GlucoseReadingInput,
        @retrofit2.http.Header("Authorization") authorization: String,
    ): Response<ApiResponse<GlucoseReadingDto>>

    @retrofit2.http.GET("patient/glucose-readings")
    suspend fun glucoseReadings(
        @retrofit2.http.Query("page") page: Int,
        @retrofit2.http.Query("limit") limit: Int,
        @retrofit2.http.Header("Authorization") authorization: String,
    ): Response<ApiResponse<GlucosePageDto>>

    @retrofit2.http.PUT("patient/glucose-readings/{id}")
    suspend fun updateGlucoseReading(
        @retrofit2.http.Path("id") id: String,
        @retrofit2.http.Body body: GlucoseReadingInput,
        @retrofit2.http.Header("Authorization") authorization: String,
    ): Response<ApiResponse<GlucoseReadingDto>>

    @retrofit2.http.DELETE("patient/glucose-readings/{id}")
    suspend fun deleteGlucoseReading(
        @retrofit2.http.Path("id") id: String,
        @retrofit2.http.Header("Authorization") authorization: String,
    ): Response<Unit>
}

data class PatientProfileResponse(val email: String, val profile: PatientProfileDto)
data class GlucoseReadingDto(
    val id: String,
    val patientId: String,
    val value: String,
    val unit: String,
    val measuredAt: String,
    val context: String,
    val source: String,
    val notes: String?,
    val createdAt: String,
    val updatedAt: String,
)
data class GlucosePageDto(val items: List<GlucoseReadingDto>, val page: Int, val limit: Int)
data class GlucoseReadingInput(
    val value: String,
    val unit: String,
    val measuredAt: String,
    val context: String,
    val notes: String?,
)
