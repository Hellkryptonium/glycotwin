package me.glycotwin.patient

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Surface
import me.glycotwin.patient.ui.GlycoTwinApp
import me.glycotwin.patient.ui.theme.GlycoTwinTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        setTheme(R.style.Theme_GlycoTwin)
        super.onCreate(savedInstanceState)
        setContent {
            GlycoTwinTheme {
                Surface {
                    GlycoTwinApp()
                }
            }
        }
    }
}
