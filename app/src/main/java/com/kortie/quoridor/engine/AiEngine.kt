package com.kortie.quoridor.engine

import com.kortie.quoridor.model.GameState
import com.kortie.quoridor.model.Position
import com.kortie.quoridor.model.Wall
import com.kortie.quoridor.model.WallOrientation
import kotlin.math.max
import kotlin.math.min

sealed class Action {
    data class MovePawn(val position: Position) : Action()
    data class PlaceWall(val wall: Wall) : Action()
}

object AiEngine {

    fun getBestAction(gameState: GameState, depth: Int): Action {
        var bestScore = Int.MIN_VALUE
        var bestAction: Action? = null

        val actions = generateValidActions(gameState, isPlayer1 = false)
        
        for (action in actions) {
            val simulatedState = simulateAction(gameState, action, isPlayer1 = false)
            // The AI plays as Player 2 (Maximizing)
            val score = minimax(simulatedState, depth - 1, Int.MIN_VALUE, Int.MAX_VALUE, isMaximizing = false)
            
            if (score > bestScore) {
                bestScore = score
                bestAction = action
            }
        }
        
        // Fallback to a random move if all are equally scored
        return bestAction ?: actions.random()
    }

    private fun minimax(state: GameState, depth: Int, alpha: Int, beta: Int, isMaximizing: Boolean): Int {
        if (depth == 0 || state.winner != null) {
            return evaluateState(state)
        }

        var a = alpha
        var b = beta

        if (isMaximizing) {
            var maxEval = Int.MIN_VALUE
            for (action in generateValidActions(state, isPlayer1 = false)) {
                val eval = minimax(simulateAction(state, action, isPlayer1 = false), depth - 1, a, b, isMaximizing = false)
                maxEval = max(maxEval, eval)
                a = max(a, eval)
                if (b <= a) break // Beta Pruning
            }
            return maxEval
        } else {
            var minEval = Int.MAX_VALUE
            for (action in generateValidActions(state, isPlayer1 = true)) {
                val eval = minimax(simulateAction(state, action, isPlayer1 = true), depth - 1, a, b, isMaximizing = true)
                minEval = min(minEval, eval)
                b = min(b, eval)
                if (b <= a) break // Alpha Pruning
            }
            return minEval
        }
    }

    private fun evaluateState(state: GameState): Int {
        // Check for terminal win states
        if (state.player2.position.y == state.player2.targetRow) return 1000 // AI wins
        if (state.player1.position.y == state.player1.targetRow) return -1000 // Human wins

        val aiDist = GameEngine.getShortestPathDistance(state.player2.position, state.player2.targetRow, state.walls)
        val playerDist = GameEngine.getShortestPathDistance(state.player1.position, state.player1.targetRow, state.walls)
        
        // Higher score is better for AI. We want Human's distance to be long, and AI's to be short.
        return playerDist - aiDist
    }

    private fun generateValidActions(state: GameState, isPlayer1: Boolean): List<Action> {
        val actions = mutableListOf<Action>()
        val player = if (isPlayer1) state.player1 else state.player2
        val opponent = if (isPlayer1) state.player2 else state.player1

        // 1. All Valid Pawn Moves
        GameEngine.calculateValidMoves(player, state).forEach { pos ->
            actions.add(Action.MovePawn(pos))
        }

        // 2. Optimized Wall Generation
        // To prevent CPU lag, we ONLY evaluate walls placed directly in front of or beside the opponent
        if (player.wallsLeft > 0) {
            val minX = max(0, opponent.position.x - 2)
            val maxX = min(7, opponent.position.x + 2)
            val minY = max(0, opponent.position.y - 2)
            val maxY = min(7, opponent.position.y + 2)

            for (x in minX..maxX) {
                for (y in minY..maxY) {
                    val pos = Position(x, y)
                    val hWall = Wall(pos, WallOrientation.HORIZONTAL)
                    val vWall = Wall(pos, WallOrientation.VERTICAL)

                    if (GameEngine.isValidWallPlacement(hWall, state)) actions.add(Action.PlaceWall(hWall))
                    if (GameEngine.isValidWallPlacement(vWall, state)) actions.add(Action.PlaceWall(vWall))
                }
            }
        }
        return actions
    }

    private fun simulateAction(state: GameState, action: Action, isPlayer1: Boolean): GameState {
        return when (action) {
            is Action.MovePawn -> {
                if (isPlayer1) {
                    val newP1 = state.player1.copy(position = action.position)
                    state.copy(player1 = newP1, winner = if (newP1.position.y == newP1.targetRow) newP1 else state.winner)
                } else {
                    val newP2 = state.player2.copy(position = action.position)
                    state.copy(player2 = newP2, winner = if (newP2.position.y == newP2.targetRow) newP2 else state.winner)
                }
            }
            is Action.PlaceWall -> {
                if (isPlayer1) {
                    state.copy(player1 = state.player1.copy(wallsLeft = state.player1.wallsLeft - 1), walls = state.walls + action.wall)
                } else {
                    state.copy(player2 = state.player2.copy(wallsLeft = state.player2.wallsLeft - 1), walls = state.walls + action.wall)
                }
            }
        }
    }
}