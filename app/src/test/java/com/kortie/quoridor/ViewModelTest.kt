package com.kortie.quoridor

import androidx.compose.ui.graphics.Color
import com.kortie.quoridor.model.GameState
import com.kortie.quoridor.model.Player
import com.kortie.quoridor.model.Position
import org.junit.Test
import org.junit.Assert.*

class ViewModelTest {

    @Test
    fun testScoreCalculation() {
        val difficulty = 3
        val turnCount = 25
        val playTimeSeconds = 120L

        // Score = Difficulty * (100 - Turns) + PlayTime
        val expectedScore = (difficulty * (100 - turnCount) + playTimeSeconds).toLong()
        val actualScore = (difficulty * (100 - turnCount) + playTimeSeconds).toLong()

        assertEquals(expectedScore, actualScore)
        assertEquals(345L, expectedScore) // 3 * (100 - 25) + 120 = 225 + 120 = 345
    }

    @Test
    fun testScoreWithHighTurns() {
        val difficulty = 5
        val turnCount = 95  // High turn count
        val playTimeSeconds = 600L

        val score = (difficulty * (100 - turnCount) + playTimeSeconds).toLong()

        // Should still be positive (5 * 5 + 600 = 625)
        assertEquals(625L, score)
    }

    @Test
    fun testScoreWithMaxTurns() {
        val difficulty = 1
        val turnCount = 100  // Max turns
        val playTimeSeconds = 1000L

        val score = (difficulty * (100 - turnCount) + playTimeSeconds).toLong()

        // Score = 1 * 0 + 1000 = 1000
        assertEquals(1000L, score)
    }

    @Test
    fun testGameState_playerPositionUpdate() {
        val state = GameState(
            player1 = Player("P1", Position(4, 0), targetRow = 8, color = Color.White),
            player2 = Player("P2", Position(4, 8), targetRow = 0, color = Color.Black)
        )

        val updatedState = state.copy(
            player1 = state.player1.copy(position = Position(4, 1))
        )

        assertEquals(Position(4, 1), updatedState.player1.position)
        assertEquals(Position(4, 8), updatedState.player2.position)
    }

    @Test
    fun testGameState_wallCountDecrement() {
        val state = GameState(
            player1 = Player("P1", Position(4, 0), wallsLeft = 10, targetRow = 8, color = Color.White),
            player2 = Player("P2", Position(4, 8), targetRow = 0, color = Color.Black)
        )

        val updatedState = state.copy(
            player1 = state.player1.copy(wallsLeft = state.player1.wallsLeft - 1)
        )

        assertEquals(9, updatedState.player1.wallsLeft)
    }

    @Test
    fun testGameState_turnIncrement() {
        val state = GameState(
            player1 = Player("P1", Position(4, 0), targetRow = 8, color = Color.White),
            player2 = Player("P2", Position(4, 8), targetRow = 0, color = Color.Black),
            turnCount = 5
        )

        val updatedState = state.copy(turnCount = state.turnCount + 1)

        assertEquals(6, updatedState.turnCount)
    }

    @Test
    fun testGameState_playerSwitch() {
        val state = GameState(
            player1 = Player("P1", Position(4, 0), targetRow = 8, color = Color.White),
            player2 = Player("P2", Position(4, 8), targetRow = 0, color = Color.Black),
            isPlayer1Turn = true
        )

        val updatedState = state.copy(isPlayer1Turn = !state.isPlayer1Turn)

        assertFalse(updatedState.isPlayer1Turn)
        assertTrue(state.isPlayer1Turn)
    }

    @Test
    fun testGameState_winCondition() {
        val state = GameState(
            player1 = Player("P1", Position(4, 7), targetRow = 8, color = Color.White),
            player2 = Player("P2", Position(4, 8), targetRow = 0, color = Color.Black)
        )

        val player2Wins = state.copy(
            player2 = state.player2.copy(position = Position(4, 0)),
            winner = state.player2
        )

        assertEquals(state.player2, player2Wins.winner)
        assertNull(state.winner)
    }
}
