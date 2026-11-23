package me.glycotwin.patient.data.repository

import me.glycotwin.patient.data.remote.GlycoTwinApi
import me.glycotwin.patient.data.remote.InvitationAction
import me.glycotwin.patient.data.remote.InvitationDto
import me.glycotwin.patient.data.remote.PatientProfileResponse
import me.glycotwin.patient.data.remote.PatientProfileUpdate
import me.glycotwin.patient.data.remote.GlucosePageDto
import me.glycotwin.patient.data.remote.GlucoseReadingDto
import me.glycotwin.patient.data.remote.GlucoseReadingInput
import me.glycotwin.patient.data.remote.GlucoseAnalyticsDto
import me.glycotwin.patient.data.remote.DeviceActivityInput
import me.glycotwin.patient.data.remote.GlucoseImportInput
import me.glycotwin.patient.data.remote.ImportResultDto
import me.glycotwin.patient.data.remote.LifestyleEntryDto
import me.glycotwin.patient.data.remote.LifestyleEntryInput
import me.glycotwin.patient.data.remote.LifestylePageDto
import me.glycotwin.patient.data.remote.MedicationDto
import me.glycotwin.patient.data.remote.MedicationInput
import me.glycotwin.patient.data.remote.MedicationPageDto
import me.glycotwin.patient.data.remote.MedicationDoseDto
import me.glycotwin.patient.data.remote.MedicationDoseInput
import me.glycotwin.patient.data.remote.MedicationDosePageDto
import me.glycotwin.patient.data.remote.PatientCareDto
import me.glycotwin.patient.data.remote.PatientTimelinePage
import me.glycotwin.patient.data.remote.VisitBriefDto
import me.glycotwin.patient.data.remote.VisitBriefInput
import me.glycotwin.patient.data.remote.PatientAiConversationDto
import me.glycotwin.patient.data.remote.PatientAiConversationDetailDto
import me.glycotwin.patient.data.remote.PatientAiMessageInput
import me.glycotwin.patient.data.remote.PatientAiSendResultDto
import retrofit2.Response
import me.glycotwin.patient.data.remote.MediaUploadInput
import me.glycotwin.patient.data.remote.MediaUploadDto
import me.glycotwin.patient.data.remote.MediaAssetDto
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class PatientRepository(
    private val api: GlycoTwinApi,
    private val authRepository: AuthRepository,
    private val accountId: String? = null,
) {
    suspend fun invitations(): Result<List<InvitationDto>> = authResult {
        authenticated { api.invitations(it) }.body().requireData()
    }

    suspend fun respond(id: String, action: String): Result<String> = authResult {
        authenticated { api.respond(id, InvitationAction(action), it) }.body().requireData().status
    }

    suspend fun profile(): Result<PatientProfileResponse> = authResult {
        authenticated { api.profile(it) }.body().requireData()
    }

    suspend fun updateProfile(input: PatientProfileUpdate): Result<PatientProfileResponse> = authResult {
        authenticated { api.updateProfile(input, it) }.body().requireData()
    }

    suspend fun glucoseReadings(page: Int = 1, limit: Int = 20, source: String? = null): Result<GlucosePageDto> = authResult {
        authenticated { api.glucoseReadings(page, limit, source, it) }.body().requireData()
    }

    suspend fun replayGlucose(): Result<ImportResultDto> = authResult {
        authenticated { api.replayGlucose(it) }.body().requireData()
    }

    suspend fun importGlucose(input: GlucoseImportInput, accountId: String): Result<ImportResultDto> = authResult {
        authRepository.authorized(accountId) { api.importGlucose(input, it) }.body().requireData()
    }

    suspend fun importDeviceActivity(input: DeviceActivityInput, accountId: String): Result<ImportResultDto> = authResult {
        authRepository.authorized(accountId) { api.importDeviceActivity(input, it) }.body().requireData()
    }

    suspend fun glucoseAnalytics(range: String): Result<GlucoseAnalyticsDto> = authResult {
        authenticated { api.glucoseAnalytics(range, it) }.body().requireData()
    }

    suspend fun lifestyleTimeline(page: Int = 1, limit: Int = 50): Result<LifestylePageDto> = authResult {
        authenticated { api.lifestyleTimeline(page, limit, it) }.body().requireData()
    }

    suspend fun createLifestyle(type: String, input: LifestyleEntryInput): Result<LifestyleEntryDto> = authResult {
        val endpoint = when (type) {
            "meal" -> "meals"
            "activity" -> "activities"
            "sleep" -> "sleep"
            "symptom" -> "symptoms"
            else -> throw ApiException("Unsupported lifestyle type: $type")
        }
        authenticated { api.createLifestyle(endpoint, input, it) }.body().requireData()
    }

    suspend fun deleteLifestyle(id: String): Result<Unit> = authResult {
        authenticated { api.deleteLifestyle(id, it) }
    }

    suspend fun updateLifestyle(id: String, input: LifestyleEntryInput): Result<LifestyleEntryDto> = authResult {
        authenticated { api.updateLifestyle(id, input, it) }.body().requireData()
    }

    suspend fun medications(): Result<MedicationPageDto> = authResult { authenticated { api.medications("active", it) }.body().requireData() }
    suspend fun createMedication(input: MedicationInput): Result<MedicationDto> = authResult { authenticated { api.createMedication(input, it) }.body().requireData() }
    suspend fun updateMedication(id: String, input: MedicationInput): Result<MedicationDto> = authResult { authenticated { api.updateMedication(id, input, it) }.body().requireData() }
    suspend fun deleteMedication(id: String): Result<Unit> = authResult { authenticated { api.deleteMedication(id, it) } }
    suspend fun discontinueMedication(id: String): Result<MedicationDto> = authResult { authenticated { api.discontinueMedication(id, it) }.body().requireData() }
    suspend fun medicationDoses(id: String): Result<MedicationDosePageDto> = authResult { authenticated { api.medicationDoses(id, it) }.body().requireData() }
    suspend fun createMedicationDose(id: String, input: MedicationDoseInput): Result<MedicationDoseDto> = authResult { authenticated { api.createMedicationDose(id, input, it) }.body().requireData() }

    suspend fun createGlucoseReading(input: GlucoseReadingInput): Result<GlucoseReadingDto> = authResult {
        authenticated { api.createGlucoseReading(input, it) }.body().requireData()
    }

    suspend fun updateGlucoseReading(id: String, input: GlucoseReadingInput): Result<GlucoseReadingDto> = authResult {
        authenticated { api.updateGlucoseReading(id, input, it) }.body().requireData()
    }

    suspend fun deleteGlucoseReading(id: String): Result<Unit> = authResult {
        authenticated { api.deleteGlucoseReading(id, it) }
    }

    suspend fun timeline(
        page: Int = 1,
        limit: Int = 30,
        source: String? = null,
        from: String? = null,
        to: String? = null,
    ): Result<PatientTimelinePage> = authResult {
        authenticated { api.timeline(page, limit, source, from, to, it) }.body().requireData()
    }

    suspend fun care(): Result<PatientCareDto> = authResult {
        authenticated { api.care(it) }.body().requireData()
    }

    suspend fun revokeRelationship(id: String): Result<Unit> = authResult {
        authenticated { api.revokeRelationship(id, it) }
    }

    suspend fun createVisitBrief(input: VisitBriefInput): Result<VisitBriefDto> = authResult {
        authenticated { api.createVisitBrief(input, it) }.body().requireData()
    }

    suspend fun deleteVisitBrief(id: String): Result<Unit> = authResult {
        authenticated { api.deleteVisitBrief(id, it) }
    }

    suspend fun uploadProfilePhoto(bytes: ByteArray, contentType: String = "image/jpeg"): Result<String> = authResult {
        if (bytes.size > 5 * 1024 * 1024) throw ApiException("Choose a profile photo smaller than 5 MB.")
        val upload: MediaUploadDto = authenticated { api.createMediaUpload(MediaUploadInput("PROFILE_PHOTO", contentType, bytes.size, "profile-photo.jpg"), it) }.body().requireData()
        withContext(Dispatchers.IO) {
            val connection = URL(upload.uploadUrl).openConnection() as HttpURLConnection
            connection.requestMethod = "PUT"
            connection.setRequestProperty("Content-Type", contentType)
            connection.doOutput = true
            connection.outputStream.use { it.write(bytes) }
            if (connection.responseCode !in 200..299) throw ApiException("Photo upload failed.")
        }
        authenticated { api.completeMediaUpload(upload.asset.id, it) }.body().requireData()
        authenticated { api.attachProfilePhoto(upload.asset.id, it) }.body().requireData()
        upload.asset.id
    }

    suspend fun aiConversations(): Result<List<PatientAiConversationDto>> = authResult {
        authenticated { api.aiConversations(it) }.body().requireData()
    }

    suspend fun createAiConversation(): Result<PatientAiConversationDto> = authResult {
        authenticated { api.createAiConversation(it) }.body().requireData()
    }

    suspend fun aiConversation(id: String): Result<PatientAiConversationDetailDto> = authResult {
        authenticated { api.aiConversation(id, it) }.body().requireData()
    }

    suspend fun sendAiMessage(id: String, input: PatientAiMessageInput): Result<PatientAiSendResultDto> = authResult {
        authenticated { api.sendAiMessage(id, input, it) }.body().requireData()
    }

    private suspend fun <T> authenticated(call: suspend (String) -> Response<T>): Response<T> =
        authRepository.authorized(accountId, call)
}
