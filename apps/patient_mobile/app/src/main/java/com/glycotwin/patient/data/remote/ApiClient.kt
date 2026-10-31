package com.glycotwin.patient.data.remote

import android.util.Log
import com.glycotwin.patient.BuildConfig
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {
    val api: GlycoTwinApi by lazy {
        val diagnostics = Interceptor { chain ->
            val request = chain.request()
            val startedAt = System.nanoTime()
            try {
                val response = chain.proceed(request)
                Log.d("GlycoTwinApi", "${request.method()} ${request.url()} -> ${response.code()} (${elapsedMs(startedAt)} ms)")
                response
            } catch (error: Exception) {
                Log.e("GlycoTwinApi", "${request.method()} ${request.url()} transport failure after ${elapsedMs(startedAt)} ms: ${error.javaClass.simpleName}", error)
                throw error
            }
        }
        val client = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .callTimeout(35, TimeUnit.SECONDS)
            .addInterceptor(diagnostics)
            .build()
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(GlycoTwinApi::class.java)
    }

    private fun elapsedMs(startedAt: Long): Long =
        TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt)
}
