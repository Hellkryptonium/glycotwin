package me.glycotwin.patient

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.format.DateUtils
import android.view.WindowManager
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import com.google.android.material.button.MaterialButton
import java.text.NumberFormat

class MainActivity : AppCompatActivity(R.layout.activity_main) {
    private lateinit var bridge: WatchDataLayer
    private lateinit var workout: WorkoutRecorder
    private val glucoseValue by lazy { findViewById<TextView>(R.id.glucose_value) }
    private val glucoseUnit by lazy { findViewById<TextView>(R.id.glucose_unit) }
    private val glucoseDetail by lazy { findViewById<TextView>(R.id.glucose_detail) }
    private val glucoseFreshnessLabel by lazy { findViewById<TextView>(R.id.glucose_freshness) }
    private val phoneStatus by lazy { findViewById<TextView>(R.id.phone_status) }
    private val activityStatus by lazy { findViewById<TextView>(R.id.activity_status) }
    private val uploadStatus by lazy { findViewById<TextView>(R.id.activity_upload_status) }
    private val workoutAction by lazy { findViewById<MaterialButton>(R.id.workout_action) }
    private val sensorAccess by lazy { findViewById<MaterialButton>(R.id.sensor_access) }
    private val demoAction by lazy { findViewById<MaterialButton>(R.id.replay_activity) }
    private var state = PhoneSyncState()
    private var activityFeedback: Int? = null
    private val handler = Handler(Looper.getMainLooper())
    private val refreshStatus = object : Runnable {
        override fun run() {
            bridge.refresh()
            renderGlucose()
            handler.postDelayed(this, 15_000L)
        }
    }
    private val updateWorkout = object : Runnable {
        override fun run() {
            if (workout.workoutType == null) return
            renderActivity()
            handler.postDelayed(this, 1_000L)
        }
    }
    private val requestSensors = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
        if (results.values.any { !it }) Toast.makeText(this, R.string.activity_no_permission, Toast.LENGTH_LONG).show()
        renderActivity()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        setTheme(R.style.Theme_GlycoTwinWatch)
        super.onCreate(savedInstanceState)
        workout = WorkoutRecorder(this)
        bridge = WatchDataLayer(this, ::applyState, ::updateActivityFeedback)
        workoutAction.setOnClickListener {
            if (workout.workoutType != null) finishWorkout() else chooseWorkout()
        }
        sensorAccess.setOnClickListener { requestSensors.launch(workout.missingPermissions().toTypedArray()) }
        demoAction.setOnClickListener { confirmDemo() }
        renderGlucose()
        renderActivity()
    }

    override fun onStart() {
        super.onStart()
        bridge.start()
        handler.postDelayed(refreshStatus, 15_000L)
    }

    override fun onStop() {
        finishWorkout()
        bridge.stop()
        handler.removeCallbacks(refreshStatus)
        super.onStop()
    }

    private fun applyState(newState: PhoneSyncState) {
        if (newState.revokesWorkout(state.activitySessionId)) activityFeedback = null
        state = newState
        if (newState.revokesWorkout(workout.activitySessionId)) {
            workout.cancel()
            stopWorkoutTimer()
            activityFeedback = R.string.activity_discarded
        }
        renderGlucose()
        renderActivity()
    }

    private fun renderGlucose() {
        val reading = state.glucose
        val statusText = when (state.status) {
            PhoneStatus.CHECKING -> R.string.phone_checking
            PhoneStatus.CONNECTED -> R.string.phone_connected
            PhoneStatus.DISCONNECTED -> R.string.phone_disconnected
            PhoneStatus.UNAVAILABLE -> R.string.phone_unavailable
        }
        val connectionLabel = getText(statusText)
        if (phoneStatus.text != connectionLabel) phoneStatus.text = connectionLabel
        glucoseValue.textSize = if (reading == null) 17f else 32f
        glucoseUnit.isVisible = reading != null
        glucoseDetail.isVisible = reading != null
        if (reading == null) {
            glucoseValue.setText(if (state.status == PhoneStatus.CONNECTED) R.string.glucose_empty else R.string.glucose_waiting)
            glucoseUnit.text = ""
            glucoseDetail.text = ""
            glucoseFreshnessLabel.isVisible = false
            return
        }
        val source = when (reading.source) {
            "CGM" -> R.string.source_cgm
            "HEALTH_CONNECT" -> R.string.source_health_connect
            "REPLAY" -> R.string.source_replay
            else -> R.string.source_manual
        }
        val value = NumberFormat.getNumberInstance().apply { maximumFractionDigits = 2 }.format(reading.value.toDouble())
        val now = System.currentTimeMillis()
        val freshness = glucoseFreshness(reading.measuredAtMs, now)
        glucoseValue.text = value
        glucoseUnit.text = reading.unit
        glucoseDetail.text = if (freshness == GlucoseFreshness.CLOCK_AHEAD) getString(source)
        else getString(R.string.glucose_details, getString(source), measurementAge(reading.measuredAtMs, now))
        glucoseFreshnessLabel.isVisible = freshness != GlucoseFreshness.RECENT
        when (freshness) {
            GlucoseFreshness.RECENT -> glucoseFreshnessLabel.text = ""
            GlucoseFreshness.OLDER -> glucoseFreshnessLabel.setText(R.string.glucose_older)
            GlucoseFreshness.CLOCK_AHEAD -> glucoseFreshnessLabel.setText(R.string.glucose_clock_ahead)
        }
    }

    private fun measurementAge(measuredAt: Long, now: Long): CharSequence =
        if (now - measuredAt < DateUtils.MINUTE_IN_MILLIS) getString(R.string.glucose_just_now)
        else DateUtils.getRelativeTimeSpanString(measuredAt, now, DateUtils.MINUTE_IN_MILLIS, DateUtils.FORMAT_ABBREV_RELATIVE)

    private fun renderActivity() {
        val type = workout.workoutType
        val enabled = state.canStartWorkout
        workoutAction.isVisible = enabled || type != null
        workoutAction.setText(if (type == null) R.string.workout_start else R.string.workout_finish)
        sensorAccess.isVisible = enabled && type == null && workout.missingPermissions().isNotEmpty()
        demoAction.isVisible = BuildConfig.DEBUG && enabled && type == null

        activityStatus.text = if (type != null) {
            val elapsed = workout.elapsedSeconds
            val time = getString(R.string.workout_time, elapsed / 60, elapsed % 60)
            val title = getString(if (type == "walking") R.string.walk_option else R.string.workout_recording)
            val current = getString(R.string.workout_current, title, time)
            val metrics = listOfNotNull(
                workout.steps?.let { resources.getQuantityString(R.plurals.workout_steps, it, it) },
                workout.heartRate?.let { getString(R.string.workout_heart_rate, it) },
            )
            if (metrics.isEmpty()) current else getString(R.string.workout_metric_line, current, metrics.joinToString(" · "))
        } else {
            getString(when (state.status) {
                PhoneStatus.CHECKING -> R.string.activity_checking
                PhoneStatus.DISCONNECTED -> R.string.activity_connect_phone
                PhoneStatus.UNAVAILABLE -> R.string.activity_sync_unavailable
                PhoneStatus.CONNECTED -> when {
                    enabled -> R.string.activity_ready
                    state.activitySharingKnown -> R.string.activity_enable_phone
                    else -> R.string.activity_checking
                }
            })
        }
        val feedback = if (type != null && !enabled) R.string.workout_phone_offline else activityFeedback
        uploadStatus.isVisible = feedback != null
        val uploadLabel = feedback?.let(::getString).orEmpty()
        if (uploadStatus.text != uploadLabel) uploadStatus.text = uploadLabel
    }

    private fun chooseWorkout() {
        AlertDialog.Builder(this)
            .setTitle(R.string.workout_kind)
            .setItems(arrayOf(getString(R.string.walk_option), getString(R.string.workout_option))) { _, index ->
                val sessionId = state.activitySessionId ?: return@setItems
                if (!state.canStartWorkout) return@setItems
                activityFeedback = null
                workout.start(sessionId, if (index == 0) "walking" else "workout")
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                handler.post(updateWorkout)
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun finishWorkout() {
        if (workout.elapsedSeconds < 1 && workout.workoutType != null) {
            workout.cancel()
            activityFeedback = R.string.workout_too_short
        }
        val result = workout.finish()
        stopWorkoutTimer()
        result?.let { (sessionId, samples) -> bridge.send(sessionId, samples) }
        renderActivity()
    }

    private fun stopWorkoutTimer() {
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        handler.removeCallbacks(updateWorkout)
    }

    private fun confirmDemo() {
        if (!BuildConfig.DEBUG) return
        AlertDialog.Builder(this)
            .setTitle(R.string.replay_title)
            .setMessage(R.string.replay_body)
            .setPositiveButton(R.string.replay_send) { _, _ ->
                val sessionId = state.activitySessionId ?: return@setPositiveButton
                if (!state.canStartWorkout) return@setPositiveButton
                val now = System.currentTimeMillis()
                val start = now - 10 * 60 * 1000L
                bridge.send(sessionId, listOf(
                    ActivitySample("workout", now, startedAtMs = start, activityType = "walking", simulated = true),
                    ActivitySample("steps", now, startedAtMs = start, value = 384.0, simulated = true),
                    ActivitySample("heart_rate", now, value = 96.0, simulated = true),
                ))
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun updateActivityFeedback(status: ActivitySyncStatus) {
        val feedback = when (status) {
            ActivitySyncStatus.SAVING -> R.string.activity_saving
            ActivitySyncStatus.QUEUED -> R.string.activity_queued
            ActivitySyncStatus.RETRYING -> R.string.activity_retrying
            ActivitySyncStatus.ACKNOWLEDGED -> R.string.activity_acknowledged
            ActivitySyncStatus.DISCARDED -> R.string.activity_discarded
        }
        if (activityFeedback == feedback) return
        activityFeedback = feedback
        renderActivity()
    }
}
