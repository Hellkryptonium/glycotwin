package me.glycotwin.patient.data.repository

import me.glycotwin.patient.data.local.SessionStorage
import me.glycotwin.patient.data.local.StoredSession
import me.glycotwin.patient.data.remote.ApiResponse
import me.glycotwin.patient.data.remote.AuthTokensDto
import me.glycotwin.patient.data.remote.Credentials
import me.glycotwin.patient.data.remote.GlycoTwinApi
import me.glycotwin.patient.data.remote.PasswordChangeInput
import me.glycotwin.patient.data.remote.PasswordConfirmation
import me.glycotwin.patient.data.remote.RefreshRequest
import me.glycotwin.patient.data.remote.UserDto
import com.google.gson.Gson
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import retrofit2.Response
import java.time.Instant
import java.util.UUID

class ApiException(
    message: String,
    val statusCode: Int? = null,
    val code: String? = null,
    val requestId: String? = null,
) : Exception(message)

class AuthRepository(private val api: GlycoTwinApi, private val tokens: SessionStorage) {
    private val refreshMutex = Mutex()
    private val _expiredSessions = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val expiredSessions = _expiredSessions.asSharedFlow()

    fun hasSavedSession(): Boolean = tokens.current() != null

    fun sessionId(): String? = tokens.current()?.id

    suspend fun register(email: String, password: String): Result<UserDto> = authResult {
        startSession(api.register(Credentials(email, password)).checked().body().requireData())
    }

    suspend fun login(email: String, password: String): Result<UserDto> = authResult {
        startSession(api.login(Credentials(email, password)).checked().body().requireData())
    }

    suspend fun session(): Result<UserDto> = authResult {
        val initial = activeSession()
        try {
            requirePatient(authorizedRequest { api.me(it.bearer) }.body().requireData(), initial.id)
        } catch (error: ApiException) {
            if (error.statusCode == 401 || error.statusCode == 403) expire(initial.id)
            throw error
        }
    }

    suspend fun logout() {
        val initial = tokens.current() ?: return
        try {
            authorizedRequest { current -> api.logout(RefreshRequest(current.refreshToken), current.bearer) }
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            // Clear local credentials even when the phone is offline.
        } finally {
            tokens.clear(initial.id)
        }
    }

    suspend fun deleteAccount(password: String): Result<Unit> = authResult {
        val initial = activeSession()
        authorizedRequest { api.deleteAccount(PasswordConfirmation(password), it.bearer) }
        tokens.clear(initial.id)
    }

    suspend fun changePassword(current: String, updated: String): Result<Unit> = authResult {
        val initial = activeSession()
        authorizedRequest { api.changePassword(PasswordChangeInput(current, updated), it.bearer) }
        tokens.clear(initial.id)
    }

    internal suspend fun <T> authorized(
        accountId: String? = null,
        call: suspend (String) -> Response<T>,
    ): Response<T> = authorizedRequest(accountId) { call(it.bearer) }

    private suspend fun startSession(auth: AuthTokensDto): UserDto {
        val stored = auth.toSession(UUID.randomUUID().toString())
        tokens.replace(stored)
        return auth.user?.let { requirePatient(it, stored.id) } ?: session().getOrThrow()
    }

    private fun requirePatient(user: UserDto, sessionId: String): UserDto {
        if (user.role == "patient") return user
        tokens.clear(sessionId)
        throw ApiException("Use the doctor dashboard to sign in to your doctor account.")
    }

    private suspend fun <T> authorizedRequest(
        accountId: String? = null,
        call: suspend (StoredSession) -> Response<T>,
    ): Response<T> {
        val initial = activeSession()
        if (accountId != null && !initial.belongsTo(accountId)) throw sessionExpired()
        val response = call(initial)
        if (response.code() != 401) return response.checked()
        response.errorBody()?.close()
        val renewed = refreshAfter(initial)
        return call(renewed).checked()
    }

    private suspend fun refreshAfter(rejected: StoredSession): StoredSession = refreshMutex.withLock {
        val current = activeSession()
        if (current.id != rejected.id) throw sessionExpired()
        if (current.accessToken != rejected.accessToken || current.refreshToken != rejected.refreshToken) return@withLock current
        val response = api.refresh(RefreshRequest(current.refreshToken))
        if (response.code() == 401 || response.code() == 403) expire(current.id)
        val renewal = response.checked().body().requireData().toSession(current.id, current.expiresAt)
        if (!tokens.update(renewal)) throw sessionExpired()
        renewal
    }

    private fun activeSession(): StoredSession {
        val session = tokens.current() ?: throw sessionExpired()
        if (session.expiresAt?.isAfter(Instant.now()) == false) {
            expire(session.id)
            throw sessionExpired()
        }
        return session
    }

    private fun expire(sessionId: String) {
        if (tokens.clear(sessionId)) _expiredSessions.tryEmit(sessionId)
    }
}

private val StoredSession.bearer get() = "Bearer $accessToken"

private fun AuthTokensDto.toSession(id: String, originalExpiry: Instant? = null): StoredSession {
    if (accessToken.isNullOrBlank() || refreshToken.isNullOrBlank()) throw ApiException("The server did not return a complete session.")
    val expiry = sessionExpiresAt?.let { runCatching { Instant.parse(it) }.getOrNull() }
    return StoredSession(id, accessToken, refreshToken, listOfNotNull(originalExpiry, expiry).minOrNull())
}

private fun sessionExpired() = ApiException("Your session expired. Sign in to continue.", 401, "SESSION_EXPIRED")

internal fun <T> ApiResponse<T>?.requireData(): T =
    this?.data ?: throw ApiException(this?.error?.message ?: "The server returned no data.")

private val gson = Gson()
private data class ErrorEnvelope(val error: ErrorBody?, val requestId: String?)
private data class ErrorBody(val code: String?, val message: String?)

private fun <T> Response<T>.checked(): Response<T> {
    if (isSuccessful) return this
    val error = runCatching { gson.fromJson(errorBody()?.string(), ErrorEnvelope::class.java) }.getOrNull()
    val message = error?.error?.message ?: "Request failed (${code()}). Try again."
    throw ApiException(message, code(), error?.error?.code, error?.requestId)
}

internal inline fun <T> authResult(block: () -> T): Result<T> = try {
    Result.success(block())
} catch (error: CancellationException) {
    throw error
} catch (error: Exception) {
    Result.failure(error)
}
