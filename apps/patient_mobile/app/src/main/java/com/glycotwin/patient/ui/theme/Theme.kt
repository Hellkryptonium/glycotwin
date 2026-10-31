package com.glycotwin.patient.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val GlycoColorScheme = lightColorScheme(
    primary = Cobalt,
    onPrimary = GlycoWhite,
    secondary = Pine,
    onSecondary = GlycoWhite,
    tertiary = Marigold,
    onTertiary = Ink,
    background = WarmOat,
    onBackground = Ink,
    surface = GlycoWhite,
    onSurface = Ink,
    surfaceVariant = Blush,
    onSurfaceVariant = MutedInk,
    error = Tomato,
    onError = Ink,
)

private val GlycoTypography = Typography().run {
    copy(
        displayLarge = displayLarge.copy(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Normal, letterSpacing = (-1.5).sp),
        headlineLarge = headlineLarge.copy(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Normal, letterSpacing = (-0.5).sp),
        headlineMedium = headlineMedium.copy(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Normal),
        titleLarge = titleLarge.copy(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Normal),
    )
}

@Composable
fun GlycoTwinTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = GlycoColorScheme,
        typography = GlycoTypography,
        content = content,
    )
}
