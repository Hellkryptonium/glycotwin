package com.glycotwin.patient

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Surface
import com.glycotwin.patient.ui.GlycoTwinApp
import com.glycotwin.patient.ui.theme.GlycoTwinTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
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
