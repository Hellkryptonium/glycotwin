package me.glycotwin.patient

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import me.glycotwin.patient.ui.components.TactileOutlinedButton
import me.glycotwin.patient.ui.theme.GlycoTwinTheme

class HealthPermissionsActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            GlycoTwinTheme {
                Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        Text("Health data access", style = MaterialTheme.typography.headlineLarge)
                        Text("GlycoTwin can read blood glucose from Health Connect when you open Data connections and choose a source. Importing saves the selected readings to your GlycoTwin account.")
                        Text("Connected clinicians may see imported readings under your existing sharing settings. Use Health Connect settings to manage access. Wear OS sharing has its own switch.")
                        TactileOutlinedButton("Close", { finish() })
                    }
                }
            }
        }
    }
}
