package com.kortie.quoridor.model

import androidx.compose.ui.graphics.Color

data class Position(val x: Int, val y: Int)

enum class WallOrientation { HORIZONTAL, VERTICAL }

data class Wall(val position: Position, val orientation: WallOrientation)

data class Player(
    val name: String,
    var position: Position,
    var wallsLeft: Int = 10,
    val targetRow: Int, // 8 for Player 1, 0 for Player 2
    val color: Color
)

data class GameState(
    val player1: Player,
    val player2: Player,
    val walls: List<Wall> = emptyList(),
    val isPlayer1Turn: Boolean = true,
    val turnCount: Int = 0,
    val playTimeSeconds: Long = 0L,
    val difficulty: Int = 0, // 0 for Local PvP, 1-5 for AI
    val winner: Player? = null,
    val highlightedMoves: List<Position> = emptyList(),
    val lastMovePosition: Position? = null
)
