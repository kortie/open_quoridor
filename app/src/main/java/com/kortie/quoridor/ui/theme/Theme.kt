package com.kortie.quoridor.ui.theme

import androidx.compose.foundation.isSystemInDarkMode
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Light theme colors
private val LightColorScheme = lightColorScheme(
    primary = Color(0xFF2E7D32),      // Dark green for primary
    onPrimary = Color.White,
    primaryContainer = Color(0xFFA5D6A7),
    onPrimaryContainer = Color(0xFF1B5E20),
    secondary = Color(0xFF1976D2),    // Blue for secondary
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFBBDEFB),
    onSecondaryContainer = Color(0xFF0D47A1),
    tertiary = Color(0xFFD32F2F),     // Red for accent
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFFFCDD2),
    onTertiaryContainer = Color(0xFFB71C1C),
    background = Color(0xFFFAFAFA),
    onBackground = Color(0xFF212121),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF212121),
    outline = Color(0xFF757575),
    outlineVariant = Color(0xFFBDBDBD)
)

// Dark theme colors
private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF66BB6A),       // Light green
    onPrimary = Color(0xFF1B5E20),
    primaryContainer = Color(0xFF2E7D32),
    onPrimaryContainer = Color(0xFFA5D6A7),
    secondary = Color(0xFF64B5F6),     // Light blue
    onSecondary = Color(0xFF0D47A1),
    secondaryContainer = Color(0xFF1976D2),
    onSecondaryContainer = Color(0xFFBBDEFB),
    tertiary = Color(0xFFEF5350),      // Light red
    onTertiary = Color(0xFFB71C1C),
    tertiaryContainer = Color(0xFFD32F2F),
    onTertiaryContainer = Color(0xFFFFCDD2),
    background = Color(0xFF121212),
    onBackground = Color(0xFFFAFAFA),
    surface = Color(0xFF1E1E1E),
    onSurface = Color(0xFFFAFAFA),
    outline = Color(0xFF828282),
    outlineVariant = Color(0xFF424242)
)

@Composable
fun QuoridorTheme(
    darkTheme: Boolean = isSystemInDarkMode(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = QuoridorTypography,
        content = content
    )
}
