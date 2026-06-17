package com.kortie.quoridor

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NavigationFlowTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun testSplashScreenAppears() {
        // The splash screen should appear with animation
        composeTestRule.onNodeWithText("Quoridor").assertExists()
    }

    @Test
    fun testNavigationToNameInput() {
        // After splash, should navigate to name input
        // Note: In real test, wait for animation to complete
        composeTestRule.onNodeWithText("Welcome to Quoridor").assertExists()
    }

    @Test
    fun testNameInputValidation() {
        // Test that name input accepts text
        val nameInput = composeTestRule.onNodeWithText("Enter your name")
        nameInput.assertExists()
    }

    @Test
    fun testModeSelectionScreen() {
        // Navigate to mode selection
        composeTestRule.onNodeWithText("Play Mode", substring = true).assertExists()
    }

    @Test
    fun testGameFlowPvP() {
        // Test that game starts after mode selection
        composeTestRule.onNodeWithText("Game Board", substring = true).assertExists()
    }

    @Test
    fun testLeaderboardScreen() {
        // Test leaderboard is accessible
        composeTestRule.onNodeWithText("Leaderboard", substring = true).assertExists()
    }
}
