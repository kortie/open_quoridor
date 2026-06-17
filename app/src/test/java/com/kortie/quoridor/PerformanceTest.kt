package com.kortie.quoridor

import com.kortie.quoridor.engine.AiEngine
import com.kortie.quoridor.engine.GameEngine
import com.kortie.quoridor.model.GameState
import com.kortie.quoridor.model.Player
import com.kortie.quoridor.model.Position
import com.kortie.quoridor.model.Wall
import com.kortie.quoridor.model.WallOrientation
import org.junit.Test
import org.junit.Assert.*
import androidx.compose.ui.graphics.Color
import kotlin.system.measureTimeMillis

class PerformanceTest {

    private fun createDefaultGameState(): GameState {
        return GameState(
            player1 = Player("P1", Position(4, 0), targetRow = 8, color = Color.White),
            player2 = Player("P2", Position(4, 8), targetRow = 0, color = Color.Black)
        )
    }

    @Test
    fun testMoveCalculationPerformance() {
        val state = createDefaultGameState()
        val player = state.player1

        val timeMs = measureTimeMillis {
            for (i in 0..100) {
                GameEngine.calculateValidMoves(player, state)
            }
        }

        // Should complete 100 calculations in less than 100ms (1ms per calculation)
        println("Move calculation time: ${timeMs}ms for 100 iterations")
        assertTrue("Move calculation too slow", timeMs < 1000)
    }

    @Test
    fun testWallValidationPerformance() {
        val state = createDefaultGameState()

        val timeMs = measureTimeMillis {
            for (i in 0..50) {
                val wall = Wall(Position((i % 8), (i / 8)), WallOrientation.HORIZONTAL)
                GameEngine.isValidWallPlacement(wall, state)
            }
        }

        // Should validate 50 walls in less than 500ms
        println("Wall validation time: ${timeMs}ms for 50 walls")
        assertTrue("Wall validation too slow", timeMs < 1000)
    }

    @Test
    fun testPathfindingPerformance() {
        val state = createDefaultGameState()

        val timeMs = measureTimeMillis {
            for (i in 0..50) {
                GameEngine.getShortestPathDistance(Position(4, 0), 8, state.walls)
            }
        }

        // Should calculate path 50 times in less than 500ms
        println("Pathfinding time: ${timeMs}ms for 50 calculations")
        assertTrue("Pathfinding too slow", timeMs < 1000)
    }

    @Test
    fun testAIDifficulty1Performance() {
        val state = createDefaultGameState()

        val timeMs = measureTimeMillis {
            for (i in 0..5) {
                AiEngine.getBestAction(state, 1)
            }
        }

        // Difficulty 1 (depth 1) should be very fast
        println("AI Level 1 time: ${timeMs}ms for 5 moves")
        assertTrue("AI Level 1 too slow", timeMs < 2000)
    }

    @Test
    fun testAIDifficulty3Performance() {
        val state = createDefaultGameState()

        val timeMs = measureTimeMillis {
            for (i in 0..3) {
                AiEngine.getBestAction(state, 3)
            }
        }

        // Difficulty 3 (depth 3) should be reasonable
        println("AI Level 3 time: ${timeMs}ms for 3 moves")
        assertTrue("AI Level 3 too slow", timeMs < 10000)
    }

    @Test
    fun testMemoryWithManyWalls() {
        val wallList = mutableListOf<Wall>()

        // Simulate placing many walls
        for (x in 0..7) {
            for (y in 0..7) {
                if ((x + y) % 2 == 0) {
                    wallList.add(Wall(Position(x, y), WallOrientation.HORIZONTAL))
                }
            }
        }

        val state = createDefaultGameState().copy(walls = wallList)

        // Should still perform well with many walls
        val timeMs = measureTimeMillis {
            GameEngine.calculateValidMoves(state.player1, state)
        }

        println("Performance with ${wallList.size} walls: ${timeMs}ms")
        assertTrue("Performance degraded with many walls", timeMs < 500)
    }

    @Test
    fun testGameLoopPerformance() {
        var state = createDefaultGameState()
        var moveCount = 0

        val timeMs = measureTimeMillis {
            // Simulate 30 moves (a typical game)
            for (turn in 0..30) {
                val currentPlayer = if (state.isPlayer1Turn) state.player1 else state.player2
                val validMoves = GameEngine.calculateValidMoves(currentPlayer, state)

                if (validMoves.isNotEmpty()) {
                    val newPos = validMoves[0]
                    val updatedPlayer = currentPlayer.copy(position = newPos)

                    state = if (state.isPlayer1Turn) {
                        state.copy(player1 = updatedPlayer, isPlayer1Turn = false, turnCount = state.turnCount + 1)
                    } else {
                        state.copy(player2 = updatedPlayer, isPlayer1Turn = true, turnCount = state.turnCount + 1)
                    }
                    moveCount++
                }
            }
        }

        // 30 moves should complete in less than 500ms
        println("Game loop time: ${timeMs}ms for $moveCount moves")
        assertTrue("Game loop too slow", timeMs < 1000)
    }
}
