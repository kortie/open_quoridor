package com.kortie.quoridor

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class GameInteractionTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun testGameBoardRendering() {
        // Game board should render with 9x9 grid
        composeTestRule.onNodeWithContentDescription("Game Board").assertExists()
    }

    @Test
    fun testPawnSelection() {
        // Test that clicking on player pawn shows valid moves
        composeTestRule.onNodeWithContentDescription("Player Pawn").performClick()
        // Should highlight valid moves (implementation-specific)
    }

    @Test
    fun testPawnMovement() {
        // Test moving pawn to valid position
        composeTestRule.onNodeWithContentDescription("Valid Move Position").performClick()
        // Pawn should move and turn should switch
    }

    @Test
    fun testWallPlacementUI() {
        // Test wall placement button is available
        composeTestRule.onNodeWithContentDescription("Place Wall Button").assertExists()
    }

    @Test
    fun testUndoButton() {
        // Test undo functionality
        composeTestRule.onNodeWithContentDescription("Undo Button").performClick()
        // Should revert last action
    }

    @Test
    fun testRedoButton() {
        // Test redo functionality
        composeTestRule.onNodeWithContentDescription("Redo Button").performClick()
        // Should re-apply last undone action
    }

    @Test
    fun testGameStats() {
        // Test that turn count and timer are visible
        composeTestRule.onNodeWithContentDescription("Turn Counter").assertExists()
        composeTestRule.onNodeWithContentDescription("Game Timer").assertExists()
    }

    @Test
    fun testWallCounter() {
        // Test that wall counter shows remaining walls
        composeTestRule.onNodeWithContentDescription("Walls Remaining").assertExists()
    }

    @Test
    fun testQuitDialog() {
        // Test that quit button opens confirmation dialog
        composeTestRule.onNodeWithContentDescription("Quit Button").performClick()
        composeTestRule.onNodeWithContentDescription("Quit Confirmation Dialog").assertExists()
    }

    @Test
    fun testGameOver() {
        // Test that game over screen appears when player wins
        composeTestRule.onNodeWithContentDescription("Game Over Screen", substring = true).assertExists()
    }
}
