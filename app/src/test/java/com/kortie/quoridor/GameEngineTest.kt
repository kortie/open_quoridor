package com.kortie.quoridor

import com.kortie.quoridor.engine.GameEngine
import com.kortie.quoridor.model.GameState
import com.kortie.quoridor.model.Player
import com.kortie.quoridor.model.Position
import com.kortie.quoridor.model.Wall
import com.kortie.quoridor.model.WallOrientation
import org.junit.Test
import org.junit.Assert.*
import androidx.compose.ui.graphics.Color

class GameEngineTest {

    private fun createDefaultGameState(): GameState {
        return GameState(
            player1 = Player("P1", Position(4, 0), targetRow = 8, color = Color.White),
            player2 = Player("P2", Position(4, 8), targetRow = 0, color = Color.Black)
        )
    }

    @Test
    fun testBasicMovement() {
        val state = createDefaultGameState()
        val moves = GameEngine.calculateValidMoves(state.player1, state)

        // Player 1 at (4, 0) should be able to move down (4, 1) and left/right
        assertEquals(3, moves.size)
        assertTrue(moves.contains(Position(4, 1)))
        assertTrue(moves.contains(Position(3, 0)))
        assertTrue(moves.contains(Position(5, 0)))
    }

    @Test
    fun testBoundaryConstraint() {
        val state = createDefaultGameState()
        val moves = GameEngine.calculateValidMoves(state.player1, state)

        // No move should be outside 0-8 bounds
        assertTrue(moves.all { it.x in 0..8 && it.y in 0..8 })
    }

    @Test
    fun testJumpMovement() {
        // Player 1 at (4, 2), Player 2 at (4, 3) - can jump to (4, 4)
        val state = GameState(
            player1 = Player("P1", Position(4, 2), targetRow = 8, color = Color.White),
            player2 = Player("P2", Position(4, 3), targetRow = 0, color = Color.Black)
        )

        val moves = GameEngine.calculateValidMoves(state.player1, state)
        assertTrue("Should include jump position", moves.contains(Position(4, 4)))
    }

    @Test
    fun testDiagonalJumpMovement() {
        // Player 1 at (4, 2), Player 2 at (4, 3) with wall blocking straight jump
        val state = GameState(
            player1 = Player("P1", Position(4, 2), targetRow = 8, color = Color.White),
            player2 = Player("P2", Position(4, 3), targetRow = 0, color = Color.Black),
            walls = listOf(Wall(Position(4, 3), WallOrientation.HORIZONTAL))
        )

        val moves = GameEngine.calculateValidMoves(state.player1, state)

        // Should allow diagonal jumps when straight jump is blocked
        assertTrue("Should include diagonal jumps", moves.contains(Position(3, 3)) || moves.contains(Position(5, 3)))
    }

    @Test
    fun testWallBlockingMovement() {
        val state = GameState(
            player1 = Player("P1", Position(4, 2), targetRow = 8, color = Color.White),
            player2 = Player("P2", Position(4, 8), targetRow = 0, color = Color.Black),
            walls = listOf(Wall(Position(4, 2), WallOrientation.VERTICAL))
        )

        val moves = GameEngine.calculateValidMoves(state.player1, state)

        // Vertical wall at (4, 2) should block movement right
        assertFalse("Should not allow movement through wall", moves.contains(Position(5, 2)))
    }

    @Test
    fun testGoldenRuleValidation() {
        val state = createDefaultGameState()

        // Place a valid wall that doesn't block either player
        val validWall = Wall(Position(0, 0), WallOrientation.HORIZONTAL)
        assertTrue("Valid wall should be accepted", GameEngine.isValidWallPlacement(validWall, state))
    }

    @Test
    fun testGoldenRuleBlockingWall() {
        // Create a scenario where a wall would block player 1
        val state = GameState(
            player1 = Player("P1", Position(4, 0), targetRow = 8, color = Color.White),
            player2 = Player("P2", Position(4, 8), targetRow = 0, color = Color.Black),
            walls = listOf(
                Wall(Position(3, 1), WallOrientation.HORIZONTAL),
                Wall(Position(5, 1), WallOrientation.HORIZONTAL),
                Wall(Position(4, 2), WallOrientation.HORIZONTAL)
            )
        )

        // Attempting to place wall that blocks player 1 completely should fail
        val blockingWall = Wall(Position(4, 0), WallOrientation.HORIZONTAL)
        assertFalse("Blocking wall should be rejected", GameEngine.isValidWallPlacement(blockingWall, state))
    }

    @Test
    fun testWallOverlapDetection() {
        val state = GameState(
            player1 = Player("P1", Position(4, 0), targetRow = 8, color = Color.White),
            player2 = Player("P2", Position(4, 8), targetRow = 0, color = Color.Black),
            walls = listOf(Wall(Position(2, 2), WallOrientation.HORIZONTAL))
        )

        // Attempt to place exact same wall
        val duplicateWall = Wall(Position(2, 2), WallOrientation.HORIZONTAL)
        assertFalse("Duplicate wall should be rejected", GameEngine.isValidWallPlacement(duplicateWall, state))
    }

    @Test
    fun testShortestPathCalculation() {
        val state = createDefaultGameState()

        // Player 1 at (4, 0), target row is 8
        val distance = GameEngine.getShortestPathDistance(Position(4, 0), 8, state.walls)

        // Shortest path should be 8 moves straight down
        assertEquals(8, distance)
    }

    @Test
    fun testPathWithWalls() {
        val state = GameState(
            player1 = Player("P1", Position(4, 0), targetRow = 8, color = Color.White),
            player2 = Player("P2", Position(4, 8), targetRow = 0, color = Color.Black),
            walls = listOf(Wall(Position(4, 4), WallOrientation.VERTICAL))
        )

        // Wall at (4, 4) blocks straight path, should force detour
        val distance = GameEngine.getShortestPathDistance(Position(4, 0), 8, state.walls)

        // Should be longer than 8
        assertTrue("Path with walls should be longer", distance > 8)
    }
}
