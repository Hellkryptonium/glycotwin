package me.glycotwin.patient

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.SystemClock
import androidx.core.content.ContextCompat
import kotlin.math.roundToInt

/** Captures optional sensor values only while a user-started workout is on screen. */
internal class WorkoutRecorder(private val context: Context) : SensorEventListener {
    private val sensorManager = context.getSystemService(SensorManager::class.java)
    private val stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
        ?: sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    private val heartRateSensor = sensorManager.getDefaultSensor(Sensor.TYPE_HEART_RATE)
    private val heartRatePermission = if (Build.VERSION.SDK_INT >= 36) {
        "android.permission.health.READ_HEART_RATE"
    } else {
        Manifest.permission.BODY_SENSORS
    }
    private var session: Session? = null
    private var stepBaseline: Int? = null
    private var stepsCaptured: Int? = null
    private var pulse: Int? = null
    private var pulseElapsedNanos = 0L

    val workoutType: String? get() = session?.activityType
    val activitySessionId: String? get() = session?.activitySessionId
    val steps: Int? get() = stepsCaptured
    val heartRate: Int? get() = recentPulse(SystemClock.elapsedRealtimeNanos())
    val elapsedSeconds: Long get() = session?.let { (SystemClock.elapsedRealtimeNanos() - it.startedAtElapsedNanos) / 1_000_000_000L } ?: 0L

    fun missingPermissions() = buildList {
        if (stepSensor != null && Build.VERSION.SDK_INT >= 29 && !granted(Manifest.permission.ACTIVITY_RECOGNITION)) {
            add(Manifest.permission.ACTIVITY_RECOGNITION)
        }
        if (heartRateSensor != null && !granted(heartRatePermission)) add(heartRatePermission)
    }

    fun start(activitySessionId: String, activityType: String) {
        session = Session(activitySessionId, activityType, SystemClock.elapsedRealtimeNanos())
        stepBaseline = null
        stepsCaptured = null
        pulse = null
        pulseElapsedNanos = 0L
        if (Build.VERSION.SDK_INT < 29 || granted(Manifest.permission.ACTIVITY_RECOGNITION)) {
            stepSensor?.let(::listen)
        }
        if (granted(heartRatePermission)) heartRateSensor?.let(::listen)
    }

    fun finish(): Pair<String, List<ActivitySample>>? {
        val current = session ?: return null
        val now = System.currentTimeMillis()
        val elapsed = SystemClock.elapsedRealtimeNanos()
        val start = now - (elapsed - current.startedAtElapsedNanos) / 1_000_000L
        val samples = buildList {
            add(ActivitySample("workout", now, startedAtMs = start, activityType = current.activityType))
            stepsCaptured?.takeIf { it > 0 }?.let {
                add(ActivitySample("steps", now, startedAtMs = start, value = it.toDouble()))
            }
            recentPulse(elapsed)?.let {
                val measuredAt = now - (elapsed - pulseElapsedNanos).coerceAtLeast(0L) / 1_000_000L
                add(ActivitySample("heart_rate", measuredAt, value = it.toDouble()))
            }
        }
        cancel()
        return current.activitySessionId to samples
    }

    fun cancel() {
        session = null
        sensorManager.unregisterListener(this)
    }

    override fun onSensorChanged(event: SensorEvent) {
        val current = session ?: return
        val initialStepCount = event.sensor.type == Sensor.TYPE_STEP_COUNTER && stepBaseline == null
        if (!initialStepCount && event.timestamp < current.startedAtElapsedNanos) return
        val value = event.values.firstOrNull()?.takeIf { it.isFinite() } ?: return
        when (event.sensor.type) {
            Sensor.TYPE_STEP_DETECTOR -> if (value > 0f) stepsCaptured = (stepsCaptured ?: 0) + 1
            Sensor.TYPE_STEP_COUNTER -> if (value >= 0f) {
                val count = value.roundToInt()
                val baseline = stepBaseline?.takeIf { count >= it } ?: count.also { stepBaseline = it }
                stepsCaptured = maxOf(stepsCaptured ?: 0, count - baseline)
            }
            Sensor.TYPE_HEART_RATE -> if (value >= 1f && value <= 300f && event.accuracy > SensorManager.SENSOR_STATUS_UNRELIABLE) {
                pulse = value.roundToInt()
                pulseElapsedNanos = event.timestamp
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) = Unit

    private fun recentPulse(elapsedNanos: Long): Int? =
        pulse?.takeIf { elapsedNanos - pulseElapsedNanos in 0L..60_000_000_000L }

    private fun listen(sensor: Sensor) {
        // Access may be revoked after the permission check and before registration.
        try {
            sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL)
        } catch (_: SecurityException) {
            // The timed workout remains available with the sensors that could be started.
        }
    }

    private fun granted(permission: String) =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    private data class Session(val activitySessionId: String, val activityType: String, val startedAtElapsedNanos: Long)
}
