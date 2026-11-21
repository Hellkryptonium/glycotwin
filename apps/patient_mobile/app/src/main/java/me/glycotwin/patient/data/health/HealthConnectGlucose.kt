package me.glycotwin.patient.data.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import me.glycotwin.patient.data.remote.ImportedGlucoseReading
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant
import java.time.temporal.ChronoUnit

internal class HealthConnectGlucose(context: Context) {
    private val appContext = context.applicationContext
    fun status(): Int = HealthConnectClient.getSdkStatus(appContext)

    suspend fun availableSources(): Map<String, List<ImportedGlucoseReading>> {
        val client = HealthConnectClient.getOrCreate(appContext)
        check(PERMISSION in client.permissionController.getGrantedPermissions()) {
            "Allow access to blood glucose in Health Connect to list available sources."
        }
        val readings = mutableListOf<ImportedGlucoseReading>()
        val now = Instant.now()
        val range = TimeRangeFilter.between(now.minus(7, ChronoUnit.DAYS), now)
        var page: String? = null
        do {
            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = BloodGlucoseRecord::class,
                    timeRangeFilter = range,
                    ascendingOrder = false,
                    pageSize = 500,
                    pageToken = page,
                ),
            )
            response.records.mapNotNullTo(readings) { record ->
                val source = record.metadata.dataOrigin.packageName
                val amount = record.level.inMilligramsPerDeciliter.takeIf { it.isFinite() && it > 0 }
                    ?: return@mapNotNullTo null
                val value = BigDecimal.valueOf(amount).setScale(4, RoundingMode.HALF_UP).stripTrailingZeros()
                if (value.signum() <= 0 || record.metadata.id.isBlank() || source.isBlank()) return@mapNotNullTo null
                ImportedGlucoseReading(
                    externalId = record.metadata.id,
                    value = value.toPlainString(),
                    unit = "mg/dL",
                    measuredAt = record.time.toString(),
                    deviceOrigin = source,
                )
            }
            val next = response.pageToken
            if (next == page) break
            page = next
        } while (page != null)
        return readings.groupBy { it.deviceOrigin.orEmpty() }
    }

    companion object {
        val PERMISSION: String = HealthPermission.getReadPermission(BloodGlucoseRecord::class)
    }
}
