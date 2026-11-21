package me.glycotwin.patient

import me.glycotwin.patient.data.local.SessionStorage
import me.glycotwin.patient.data.local.StoredSession
import me.glycotwin.patient.data.remote.ApiResponse
import me.glycotwin.patient.data.remote.AuthTokensDto
import me.glycotwin.patient.data.remote.GlycoTwinApi
import me.glycotwin.patient.data.remote.RefreshRequest
import me.glycotwin.patient.data.remote.UserDto
import me.glycotwin.patient.data.repository.AuthRepository
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import okhttp3.ResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response
import java.io.IOException
import java.lang.reflect.Proxy
import java.time.Instant

class AuthRepositoryTest {
    private val user = UserDto("patient", "patient@example.test", "patient", true, null)
    private val initial = StoredSession("original", "old-access", "old-refresh", Instant.parse("2090-01-08T00:00:00Z"))

    @Test
    fun restoredSessionRetriesMeWithTheNewTokenAndPreservesOriginalExpiry() = runBlocking {
        val calls = mutableListOf<String>()
        val tokens = MemoryStore(initial)
        val api = fakeApi { method, args ->
            when (method) {
                "me" -> {
                    calls.add(args.first() as String)
                    if (calls.size == 1) unauthorized<UserDto>() else success(user)
                }
                "refresh" -> {
                    assertEquals(RefreshRequest(initial.refreshToken), args.first())
                    success(AuthTokensDto("new-access", "new-refresh", 900, "2090-02-08T00:00:00Z"))
                }
                else -> failUnexpectedCall(method)
            }
        }

        assertEquals(user, AuthRepository(api, tokens).session().getOrThrow())
        assertEquals(listOf("Bearer old-access", "Bearer new-access"), calls)
        assertEquals(initial.copy(accessToken = "new-access", refreshToken = "new-refresh"), tokens.current())
    }

    @Test
    fun concurrentUnauthorizedRequestsShareOneRefresh() = runBlocking {
        val bothUnauthorized = CompletableDeferred<Unit>()
        var oldRequests = 0
        var refreshCalls = 0
        val repo = AuthRepository(
            fakeApi { method, _ ->
                if (method != "refresh") failUnexpectedCall(method)
                refreshCalls++
                success(AuthTokensDto("renewed-access", "renewed-refresh", 900))
            },
            MemoryStore(initial),
        )
        suspend fun request(): String? = repo.authorized { bearer ->
            if (bearer == "Bearer old-access") {
                oldRequests++
                if (oldRequests == 2) bothUnauthorized.complete(Unit)
                bothUnauthorized.await()
                Response.error(401, unauthorizedBody())
            } else {
                Response.success(bearer)
            }
        }.body()

        val first = async { request() }
        val second = async { request() }
        assertEquals("Bearer renewed-access", first.await())
        assertEquals("Bearer renewed-access", second.await())
        assertEquals(1, refreshCalls)
    }

    @Test
    fun temporaryRestoreFailureKeepsEncryptedSessionButRevocationClearsIt() = runBlocking {
        val tokens = MemoryStore(initial)
        val offline = AuthRepository(fakeApi { _, _ -> throw IOException("offline") }, tokens)
        assertTrue(offline.session().isFailure)
        assertTrue(offline.hasSavedSession())

        val revoked = AuthRepository(fakeApi { _, _ -> unauthorized<UserDto>() }, tokens)
        assertTrue(revoked.session().isFailure)
        assertFalse(revoked.hasSavedSession())
        assertNull(tokens.current())
    }

    @Test
    fun logoutRevokesUsingTheCurrentAccessAndRefreshCredentials() = runBlocking {
        val tokens = MemoryStore(initial)
        val api = fakeApi { method, args ->
            assertEquals("logout", method)
            assertEquals(RefreshRequest("old-refresh"), args.first())
            assertEquals("Bearer old-access", args[1])
            Response.success<Unit>(204, null)
        }
        AuthRepository(api, tokens).logout()
        assertNull(tokens.current())
    }

    private class MemoryStore(private var session: StoredSession?) : SessionStorage {
        override fun current() = session
        override fun replace(session: StoredSession) { this.session = session }

        override fun update(session: StoredSession): Boolean {
            if (this.session?.id != session.id) return false
            replace(session)
            return true
        }

        override fun clear(id: String): Boolean {
            if (session?.id != id) return false
            session = null
            return true
        }
    }

    private fun fakeApi(handler: (String, Array<out Any?>) -> Any?): GlycoTwinApi = Proxy.newProxyInstance(
        GlycoTwinApi::class.java.classLoader,
        arrayOf(GlycoTwinApi::class.java),
    ) { _, method, args -> handler(method.name, args.orEmpty()) } as GlycoTwinApi

    private fun <T> success(body: T) = Response.success(ApiResponse(success = true, data = body, error = null))

    private fun <T> unauthorized(): Response<ApiResponse<T>> =
        Response.error(401, unauthorizedBody())

    private fun unauthorizedBody() = ResponseBody.create(null, """{"error":{"code":"UNAUTHORIZED","message":"Session invalid"}}""")

    private fun failUnexpectedCall(method: String): Nothing = throw AssertionError("Unexpected API call $method")
}
