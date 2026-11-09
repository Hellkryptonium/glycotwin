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
data class LifestylePageDto(val items: List<LifestyleEntryDto>, val page: Int, val limit: Int)
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

    @retrofit2.http.GET("patient/analytics/glucose")
    suspend fun glucoseAnalytics(
        @retrofit2.http.Query("range") range: String,
        @retrofit2.http.Header("Authorization") authorization: String,
    ): Response<ApiResponse<GlucoseAnalyticsDto>>

    @retrofit2.http.POST("patient/lifestyle/{type}")
    suspend fun createLifestyle(
        @retrofit2.http.Path("type") type: String,
        @retrofit2.http.Body body: LifestyleEntryInput,
        @retrofit2.http.Header("Authorization") authorization: String,
    ): Response<ApiResponse<LifestyleEntryDto>>

    @retrofit2.http.GET("patient/lifestyle/timeline")
    suspend fun lifestyleTimeline(
        @retrofit2.http.Query("page") page: Int,
        @retrofit2.http.Query("limit") limit: Int,
        @retrofit2.http.Header("Authorization") authorization: String,
    ): Response<ApiResponse<LifestylePageDto>>

    @retrofit2.http.DELETE("patient/lifestyle/{id}")
    suspend fun deleteLifestyle(
        @retrofit2.http.Path("id") id: String,
        @retrofit2.http.Header("Authorization") authorization: String,
    ): Response<Unit>

    @retrofit2.http.PATCH("patient/lifestyle/{id}")
    suspend fun updateLifestyle(
        @retrofit2.http.Path("id") id: String,
        @retrofit2.http.Body body: LifestyleEntryInput,
        @retrofit2.http.Header("Authorization") authorization: String,
    ): Response<ApiResponse<LifestyleEntryDto>>

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
data class GlucoseAnalyticsDto(
    val range: String,
    val from: String,
    val to: String,
    val unit: String?,
    val latest: GlucoseAnalyticsReadingDto?,
    val totalReadings: Int,
    val average: String?,
    val minimum: String?,
    val maximum: String?,
    val daily: List<DailyGlucoseDto>,
    val readings: List<GlucoseAnalyticsReadingDto>,
    val byUnit: List<GlucoseUnitSummaryDto>,
)
data class GlucoseAnalyticsReadingDto(val value: String, val measuredAt: String, val unit: String)
data class DailyGlucoseDto(val date: String, val average: String, val readingCount: Int, val unit: String)
data class GlucoseUnitSummaryDto(val unit: String, val totalReadings: Int, val average: String, val minimum: String, val maximum: String)
data class LifestyleEntryDto(
    val id: String,
    val patientId: String,
    val type: String,
    val occurredAt: String,
    val mealType: String?,
    val description: String?,
    val activityType: String?,
    val durationMinutes: Int?,
    val sleepDurationMinutes: Int?,
    val notes: String?,
)
data class LifestyleEntryInput(
    val type: String,
    val occurredAt: String,
    val mealType: String? = null,
    val description: String? = null,
    val activityType: String? = null,
    val durationMinutes: Int? = null,
    val sleepDurationMinutes: Int? = null,
    val notes: String? = null,
)
data class GlucoseReadingInput(
    val value: String,
    val unit: String,
    val measuredAt: String,
    val context: String,
    val notes: String?,
)
