package com.kortie.quoridor.engine

import com.kortie.quoridor.model.GameState
import com.kortie.quoridor.model.Player
import com.kortie.quoridor.model.Position
import com.kortie.quoridor.model.Wall
import com.kortie.quoridor.model.WallOrientation

object GameEngine {

    fun calculateValidMoves(currentPlayer: Player, gameState: GameState): List<Position> {
        val validMoves = mutableListOf<Position>()
        val opponent = if (currentPlayer == gameState.player1) gameState.player2 else gameState.player1
        val pos = currentPlayer.position
        
        val directions = listOf(
            Position(0, -1), // Up
            Position(0, 1),  // Down
            Position(-1, 0), // Left
            Position(1, 0)   // Right
        )
        
        for (dir in directions) {
            val adjacent = Position(pos.x + dir.x, pos.y + dir.y)
            
            if (!isValidBounds(adjacent)) continue
            if (hasWallBetween(pos, adjacent, gameState.walls)) continue
            
            if (adjacent == opponent.position) {
                val straightJump = Position(adjacent.x + dir.x, adjacent.y + dir.y)
                
                if (isValidBounds(straightJump) && !hasWallBetween(adjacent, straightJump, gameState.walls)) {
                    validMoves.add(straightJump)
                } else {
                    if (dir.x == 0) {
                        val diagLeft = Position(adjacent.x - 1, adjacent.y)
                        val diagRight = Position(adjacent.x + 1, adjacent.y)
                        if (isValidBounds(diagLeft) && !hasWallBetween(adjacent, diagLeft, gameState.walls)) validMoves.add(diagLeft)
                        if (isValidBounds(diagRight) && !hasWallBetween(adjacent, diagRight, gameState.walls)) validMoves.add(diagRight)
                    } else {
                        val diagUp = Position(adjacent.x, adjacent.y - 1)
                        val diagDown = Position(adjacent.x, adjacent.y + 1)
                        if (isValidBounds(diagUp) && !hasWallBetween(adjacent, diagUp, gameState.walls)) validMoves.add(diagUp)
                        if (isValidBounds(diagDown) && !hasWallBetween(adjacent, diagDown, gameState.walls)) validMoves.add(diagDown)
                    }
                }
            } else {
                validMoves.add(adjacent)
            }
        }
        
        return validMoves
    }

    fun isValidWallPlacement(newWall: Wall, gameState: GameState): Boolean {
        // 1. Check if the wall overlaps or intersects with existing walls
        if (isWallOverlapping(newWall, gameState.walls)) return false

        // 2. Temporarily add the wall to simulate the board state
        val simulatedWalls = gameState.walls + newWall

        // 3. Run BFS for both players to ensure neither is trapped
        val player1HasPath = hasPath(gameState.player1.position, gameState.player1.targetRow, simulatedWalls)
        val player2HasPath = hasPath(gameState.player2.position, gameState.player2.targetRow, simulatedWalls)

        // The Golden Rule: Both players must have at least one path to their target row
        return player1HasPath && player2HasPath
    }

    private fun hasPath(start: Position, targetRow: Int, walls: List<Wall>): Boolean {
        val queue = ArrayDeque<Position>()
        val visited = mutableSetOf<Position>()

        queue.add(start)
        visited.add(start)

        val directions = listOf(
            Position(0, -1), // Up
            Position(0, 1),  // Down
            Position(-1, 0), // Left
            Position(1, 0)   // Right
        )

        while (queue.isNotEmpty()) {
            val current = queue.removeFirst()

            // If we've reached any cell in the target row, a path exists
            if (current.y == targetRow) {
                return true
            }

            for (dir in directions) {
                val neighbor = Position(current.x + dir.x, current.y + dir.y)

                if (isValidBounds(neighbor) && neighbor !in visited) {
                    // We ignore the opponent's pawn for pathfinding, as they can eventually move out of the way
                    if (!hasWallBetween(current, neighbor, walls)) {
                        visited.add(neighbor)
                        queue.add(neighbor)
                    }
                }
            }
        }

        // Queue is empty and we never reached the target row; the player is trapped
        return false
    }

    fun getShortestPathDistance(start: Position, targetRow: Int, walls: List<Wall>): Int {
        val queue = ArrayDeque<Pair<Position, Int>>()
        val visited = mutableSetOf<Position>()

        queue.add(start to 0)
        visited.add(start)

        val directions = listOf(
            Position(0, -1), Position(0, 1), Position(-1, 0), Position(1, 0)
        )

        while (queue.isNotEmpty()) {
            val (current, dist) = queue.removeFirst()
            if (current.y == targetRow) return dist

            for (dir in directions) {
                val neighbor = Position(current.x + dir.x, current.y + dir.y)
                if (isValidBounds(neighbor) && neighbor !in visited && !hasWallBetween(current, neighbor, walls)) {
                    visited.add(neighbor)
                    queue.add(neighbor to dist + 1)
                }
            }
        }
        return 999 // Fallback, should not be reached due to Golden Rule
    }

    private fun isWallOverlapping(newWall: Wall, walls: List<Wall>): Boolean {
        for (wall in walls) {
            // Exact same origin covers both exact duplicates and perpendicular crosses
            if (wall.position == newWall.position) {
                return true
            }
            
            // Check for partial overlaps (end-to-end collisions)
            if (wall.orientation == newWall.orientation) {
                if (wall.orientation == WallOrientation.HORIZONTAL) {
                    if (wall.position.y == newWall.position.y && kotlin.math.abs(wall.position.x - newWall.position.x) == 1) {
                        return true
                    }
                } else {
                    if (wall.position.x == newWall.position.x && kotlin.math.abs(wall.position.y - newWall.position.y) == 1) {
                        return true
                    }
                }
            }
        }
        return false
    }

    private fun isValidBounds(pos: Position): Boolean {
        return pos.x in 0..8 && pos.y in 0..8
    }

    private fun hasWallBetween(p1: Position, p2: Position, walls: List<Wall>): Boolean {
        val xMin = minOf(p1.x, p2.x)
        val yMin = minOf(p1.y, p2.y)
        
        if (p1.x == p2.x) { 
            return walls.any {
                it.orientation == WallOrientation.HORIZONTAL &&
                it.position.y == yMin &&
                (it.position.x == xMin || it.position.x == xMin - 1)
            }
        } else if (p1.y == p2.y) { 
            return walls.any {
                it.orientation == WallOrientation.VERTICAL &&
                it.position.x == xMin &&
                (it.position.y == yMin || it.position.y == yMin - 1)
            }
        }
        return false
    }
}