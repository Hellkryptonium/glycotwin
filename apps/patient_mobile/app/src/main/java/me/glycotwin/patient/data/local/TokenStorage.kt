package me.glycotwin.patient.data.local

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.google.gson.JsonParser
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.time.Instant
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class StoredSession(
    val id: String,
    val accessToken: String,
    val refreshToken: String,
    val expiresAt: Instant?,
) {
    fun belongsTo(accountId: String): Boolean = runCatching {
        val payload = java.util.Base64.getUrlDecoder().decode(accessToken.split('.')[1])
        JsonParser.parseString(payload.toString(StandardCharsets.UTF_8)).asJsonObject["sub"].asString == accountId
    }.getOrDefault(false)
}

interface SessionStorage {
    fun current(): StoredSession?
    fun replace(session: StoredSession)
    fun update(session: StoredSession): Boolean
    fun clear(id: String): Boolean
}

class TokenStorage(context: Context) : SessionStorage {
    private val preferences = context.getSharedPreferences("session", Context.MODE_PRIVATE)
    private val keyAlias = "glycotwin_session_key"

    @Synchronized
    override fun replace(session: StoredSession) {
        preferences.edit()
            .putString("access", encrypt(session.accessToken))
            .putString("refresh", encrypt(session.refreshToken))
            .putString("id", session.id)
            .putLong("expires", session.expiresAt?.toEpochMilli() ?: 0L)
            .apply()
    }

    @Synchronized
    override fun current(): StoredSession? {
        val access = preferences.getString("access", null)?.let(::decrypt) ?: return null
        val refresh = preferences.getString("refresh", null)?.let(::decrypt) ?: return null
        val id = preferences.getString("id", null) ?: UUID.randomUUID().toString().also {
            preferences.edit().putString("id", it).apply()
        }
        val expiresAt = preferences.getLong("expires", 0L).takeIf { it > 0L }?.let(Instant::ofEpochMilli)
        return StoredSession(id, access, refresh, expiresAt)
    }

    @Synchronized
    override fun update(session: StoredSession): Boolean {
        if (preferences.getString("id", null) != session.id) return false
        replace(session)
        return true
    }

    @Synchronized
    override fun clear(id: String): Boolean {
        if (preferences.getString("id", null) != id) return false
        preferences.edit().clear().apply()
        return true
    }

    private fun key(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = keyStore.getKey(keyAlias, null) as? SecretKey
        if (existing != null) return existing
        return KeyGenerator.getInstance("AES", "AndroidKeyStore").apply {
            init(
                KeyGenParameterSpec.Builder(
                    keyAlias,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build(),
            )
        }.generateKey()
    }

    private fun encrypt(value: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val combined = cipher.iv + cipher.doFinal(value.toByteArray(StandardCharsets.UTF_8))
        return Base64.encodeToString(combined, Base64.NO_WRAP)
    }

    private fun decrypt(value: String): String? = runCatching {
        val combined = Base64.decode(value, Base64.NO_WRAP)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, combined, 0, 12))
        String(cipher.doFinal(combined, 12, combined.size - 12), StandardCharsets.UTF_8)
    }.getOrNull()
}
