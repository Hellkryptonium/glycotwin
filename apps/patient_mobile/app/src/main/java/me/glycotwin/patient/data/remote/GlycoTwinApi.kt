package me.glycotwin.patient.data.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.HTTP
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.PUT
import retrofit2.http.Query

data class ApiResponse<T>(val success: Boolean, val data: T?, val error: ApiError?)
data class ApiError(val code: String?, val message: String?)
data class Credentials(val email: String, val password: String)
data class RefreshRequest(val refreshToken: String)
data class AuthTokensDto(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Long,
    val sessionExpiresAt: String? = null,
    val user: UserDto? = null,
)
data class PasswordConfirmation(val currentPassword: String)
data class PasswordChangeInput(val currentPassword: String, val newPassword: String)
data class UserDto(
    val id: String,
    val email: String,
    val role: String,
    val isActive: Boolean,
    val patientProfile: PatientProfileDto?,
)
data class LifestylePageDto(val items: List<LifestyleEntryDto>, val page: Int, val limit: Int)
data class PatientProfileDto(
    val id: String,
    val fullName: String?,
    val dateOfBirth: String?,
    val gender: String?,
    val diabetesType: String?,
    val treatmentContext: String? = null,
    val profilePhotoAssetId: String? = null,
)
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
    val treatmentContext: String? = null,
)

interface GlycoTwinApi {
    @POST("auth/register/patient")
    suspend fun register(@Body body: Credentials): Response<ApiResponse<AuthTokensDto>>

    @POST("auth/login")
    suspend fun login(@Body body: Credentials): Response<ApiResponse<AuthTokensDto>>

    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): Response<ApiResponse<AuthTokensDto>>

    @POST("auth/logout")
    suspend fun logout(@Body body: RefreshRequest, @Header("Authorization") authorization: String): Response<Unit>

    @HTTP(method = "DELETE", path = "auth/account", hasBody = true)
    suspend fun deleteAccount(@Body body: PasswordConfirmation, @Header("Authorization") authorization: String): Response<Unit>

    @PUT("auth/account/password")
    suspend fun changePassword(@Body body: PasswordChangeInput, @Header("Authorization") authorization: String): Response<Unit>

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

    @GET("patient/timeline")
    suspend fun timeline(
        @Query("page") page: Int,
        @Query("limit") limit: Int,
        @Query("source") source: String?,
        @Query("from") from: String?,
        @Query("to") to: String?,
        @Header("Authorization") authorization: String,
    ): Response<ApiResponse<PatientTimelinePage>>

    @GET("patient/care")
    suspend fun care(@Header("Authorization") authorization: String): Response<ApiResponse<PatientCareDto>>

    @POST("patient/relationships/{id}/revoke")
    suspend fun revokeRelationship(@Path("id") id: String, @Header("Authorization") authorization: String): Response<Unit>

    @POST("patient/visit-briefs")
    suspend fun createVisitBrief(@Body body: VisitBriefInput, @Header("Authorization") authorization: String): Response<ApiResponse<VisitBriefDto>>

    @retrofit2.http.DELETE("patient/visit-briefs/{id}")
    suspend fun deleteVisitBrief(@Path("id") id: String, @Header("Authorization") authorization: String): Response<Unit>

    @retrofit2.http.POST("patient/glucose-readings")
    suspend fun createGlucoseReading(
        @retrofit2.http.Body body: GlucoseReadingInput,
        @retrofit2.http.Header("Authorization") authorization: String,
    ): Response<ApiResponse<GlucoseReadingDto>>

    @retrofit2.http.GET("patient/glucose-readings")
    suspend fun glucoseReadings(
        @retrofit2.http.Query("page") page: Int,
        @retrofit2.http.Query("limit") limit: Int,
        @retrofit2.http.Query("source") source: String?,
        @retrofit2.http.Header("Authorization") authorization: String,
    ): Response<ApiResponse<GlucosePageDto>>

    @POST("patient/glucose-readings/replay")
    suspend fun replayGlucose(@retrofit2.http.Header("Authorization") authorization: String): Response<ApiResponse<ImportResultDto>>

    @POST("patient/glucose-readings/import")
    suspend fun importGlucose(
        @Body body: GlucoseImportInput,
        @retrofit2.http.Header("Authorization") authorization: String,
    ): Response<ApiResponse<ImportResultDto>>

    @POST("patient/device-activity")
    suspend fun importDeviceActivity(
        @Body body: DeviceActivityInput,
        @retrofit2.http.Header("Authorization") authorization: String,
    ): Response<ApiResponse<ImportResultDto>>

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

    @retrofit2.http.POST("patient/medications")
    suspend fun createMedication(@retrofit2.http.Body body: MedicationInput, @retrofit2.http.Header("Authorization") authorization: String): Response<ApiResponse<MedicationDto>>
    @retrofit2.http.GET("patient/medications")
    suspend fun medications(@retrofit2.http.Query("status") status: String, @retrofit2.http.Header("Authorization") authorization: String): Response<ApiResponse<MedicationPageDto>>
    @retrofit2.http.PATCH("patient/medications/{id}")
    suspend fun updateMedication(@retrofit2.http.Path("id") id: String, @retrofit2.http.Body body: MedicationInput, @retrofit2.http.Header("Authorization") authorization: String): Response<ApiResponse<MedicationDto>>
    @retrofit2.http.DELETE("patient/medications/{id}")
    suspend fun deleteMedication(@retrofit2.http.Path("id") id: String, @retrofit2.http.Header("Authorization") authorization: String): Response<Unit>
    @retrofit2.http.POST("patient/medications/{id}/discontinue")
    suspend fun discontinueMedication(@retrofit2.http.Path("id") id: String, @retrofit2.http.Header("Authorization") authorization: String): Response<ApiResponse<MedicationDto>>
    @retrofit2.http.GET("patient/medications/{id}/doses")
    suspend fun medicationDoses(@retrofit2.http.Path("id") id: String, @retrofit2.http.Header("Authorization") authorization: String): Response<ApiResponse<MedicationDosePageDto>>
    @retrofit2.http.POST("patient/medications/{id}/doses")
    suspend fun createMedicationDose(@retrofit2.http.Path("id") id: String, @retrofit2.http.Body body: MedicationDoseInput, @retrofit2.http.Header("Authorization") authorization: String): Response<ApiResponse<MedicationDoseDto>>

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

    @POST("patient/ai/conversations")
    suspend fun createAiConversation(@Header("Authorization") authorization: String): Response<ApiResponse<PatientAiConversationDto>>

    @GET("patient/ai/conversations")
    suspend fun aiConversations(@Header("Authorization") authorization: String): Response<ApiResponse<List<PatientAiConversationDto>>>

    @GET("patient/ai/conversations/{id}")
    suspend fun aiConversation(@Path("id") id: String, @Header("Authorization") authorization: String): Response<ApiResponse<PatientAiConversationDetailDto>>

    @POST("patient/ai/conversations/{id}/messages")
    suspend fun sendAiMessage(
        @Path("id") id: String,
        @Body body: PatientAiMessageInput,
        @Header("Authorization") authorization: String,
    ): Response<ApiResponse<PatientAiSendResultDto>>

    @POST("media/uploads")
    suspend fun createMediaUpload(@Body body: MediaUploadInput, @Header("Authorization") authorization: String): Response<ApiResponse<MediaUploadDto>>
    @POST("media/assets/{id}/complete")
    suspend fun completeMediaUpload(@Path("id") id: String, @Header("Authorization") authorization: String): Response<ApiResponse<MediaAssetDto>>
    @POST("media/assets/{id}/attach-profile-photo")
    suspend fun attachProfilePhoto(@Path("id") id: String, @Header("Authorization") authorization: String): Response<ApiResponse<MediaAssetDto>>
}

data class PatientProfileResponse(val email: String, val profile: PatientProfileDto)
data class PatientTimelinePage(val items: List<PatientTimelineItem>, val page: Int, val limit: Int, val hasMore: Boolean)
data class PatientTimelineItem(
    val id: String,
    val kind: String,
    val occurredAt: String,
    val receivedAt: String,
    val source: String,
    val title: String,
    val detail: String?,
    val glucose: TimelineGlucose?,
    val deviceOrigin: String?,
)
data class TimelineGlucose(val value: String, val unit: String)
data class PatientAiConversationDto(val id: String, val title: String, val createdAt: String, val updatedAt: String)
data class PatientAiMessageDto(
    val id: String,
    val conversationId: String,
    val role: String,
    val content: String,
    val reviewKind: String? = null,
    val imageName: String? = null,
    val createdAt: String,
)
data class PatientAiConversationDetailDto(val conversation: PatientAiConversationDto, val messages: List<PatientAiMessageDto>)
data class PatientAiImageInput(val mimeType: String, val base64: String, val name: String? = null)
data class PatientAiMessageInput(val message: String, val reviewKind: String? = null, val image: PatientAiImageInput? = null)
data class PatientAiSendResultDto(val patientMessage: PatientAiMessageDto, val assistantMessage: PatientAiMessageDto)
data class MediaUploadInput(val purpose: String, val contentType: String, val sizeBytes: Int, val fileName: String? = null)
data class MediaAssetDto(val id: String, val status: String, val contentType: String, val sizeBytes: Int)
data class MediaUploadDto(val asset: MediaAssetDto, val uploadUrl: String)
data class PatientCareDto(val connections: List<CareConnectionDto>, val items: List<CareItemDto>, val briefs: List<VisitBriefDto>)
data class CareConnectionDto(
    val id: String,
    val doctorName: String?,
    val specialization: String?,
    val verificationStatus: String?,
)
data class CareItemDto(
    val id: String,
    val kind: String,
    val title: String,
    val detail: String?,
    val dueDate: String?,
    val status: String,
    val createdAt: String,
    val updatedAt: String,
)
data class VisitBriefInput(val relationshipId: String, val title: String, val notes: String?, val eventIds: List<String>)
data class VisitBriefDto(
    val id: String,
    val relationshipId: String,
    val title: String,
    val notes: String?,
    val events: List<PatientTimelineItem>,
    val createdAt: String,
)
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
    val receivedAt: String? = null,
    val deviceOrigin: String? = null,
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
data class GlucoseAnalyticsReadingDto(
    val value: String,
    val measuredAt: String,
    val unit: String,
    val source: String? = null,
    val receivedAt: String? = null,
    val deviceOrigin: String? = null,
)
data class ImportResultDto(val inserted: Int, val duplicates: Int)
data class GlucoseImportInput(val readings: List<ImportedGlucoseReading>)
data class ImportedGlucoseReading(
    val externalId: String,
    val value: String,
    val unit: String,
    val measuredAt: String,
    val deviceOrigin: String?,
)
data class DeviceActivityInput(val events: List<DeviceActivityEvent>)
data class DeviceActivityEvent(
    val eventId: String,
    val kind: String,
    val measuredAt: String,
    val startedAt: String? = null,
    val value: Double? = null,
    val activityType: String? = null,
    val simulated: Boolean? = null,
)
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
    val carbohydrateGrams: Double? = null,
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
    val carbohydrateGrams: Double? = null,
    val clearCarbohydrateGrams: Boolean? = null,
)
data class MedicationDto(
    val id: String,
    val patientId: String,
    val name: String,
    val dosage: String,
    val frequency: String,
    val scheduleTimes: List<String>,
    val startDate: String,
    val endDate: String?,
    val instructions: String?,
    val status: String,
)
data class MedicationPageDto(val items: List<MedicationDto>, val page: Int, val limit: Int)
data class MedicationInput(
    val name: String,
    val dosage: String,
    val frequency: String,
    val scheduleTimes: List<String>,
    val startDate: String,
    val endDate: String? = null,
    val instructions: String? = null,
)
data class MedicationDoseDto(
    val id: String,
    val medicationId: String,
    val patientId: String,
    val scheduledAt: String,
    val takenAt: String?,
    val status: String,
    val actualDose: String? = null,
)
data class MedicationDosePageDto(val items: List<MedicationDoseDto>, val page: Int, val limit: Int)
data class MedicationDoseInput(
    val scheduledAt: String,
    val takenAt: String?,
    val status: String,
    val actualDose: String? = null,
)
data class GlucoseReadingInput(
    val value: String,
    val unit: String,
    val measuredAt: String,
    val context: String,
    val notes: String?,
)
