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
}
