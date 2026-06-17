package com.kortie.quoridor.ui.components

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import com.kortie.quoridor.model.GameState
import com.kortie.quoridor.model.Position
import com.kortie.quoridor.model.Wall
import com.kortie.quoridor.model.WallOrientation
import kotlin.math.abs

@Composable
fun QuoridorBoard(
    gameState: GameState,
    onCellClicked: (Position) -> Unit,
    onWallPlaced: (Wall) -> Unit,
    modifier: Modifier = Modifier
) {
    val boardBackgroundColor = Color(0xFF6D4C41)
    val cellColor = Color(0xFF8D6E63)
    val wallColor = Color(0xFFFFB300)
    val previewWallColor = Color(0x88FFB300) // Transparent amber for drag preview
    val highlightColor = Color(0x664CAF50)
    val lastMoveHighlightColor = Color(0x662196F3) // Semi-transparent blue for opponent's last move

    val gapRatio = 0.25f 
    
    // Animate Player 1 position
    val p1X by animateFloatAsState(targetValue = gameState.player1.position.x.toFloat(), animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow), label = "p1x")
    val p1Y by animateFloatAsState(targetValue = gameState.player1.position.y.toFloat(), animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow), label = "p1y")
    
    // Animate Player 2 position
    val p2X by animateFloatAsState(targetValue = gameState.player2.position.x.toFloat(), animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow), label = "p2x")
    val p2Y by animateFloatAsState(targetValue = gameState.player2.position.y.toFloat(), animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow), label = "p2y")

    // Animate walls scaling in
    val wallScales = gameState.walls.associate { wall ->
        key(wall) {
            val scale = remember { Animatable(0f) }
            LaunchedEffect(wall) {
                scale.animateTo(
                    targetValue = 1f,
                    animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow)
                )
            }
            wall to scale.value
        }
    }

    var dragStart by remember { mutableStateOf<Offset?>(null) }
    var dragCurrent by remember { mutableStateOf<Offset?>(null) }

    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .padding(16.dp)
            .pointerInput(Unit) {
                detectTapGestures { tapOffset ->
                    val cellWidth = size.width / (9f + 8f * gapRatio)
                    val gapWidth = cellWidth * gapRatio
                    val step = cellWidth + gapWidth

                    val clickedX = (tapOffset.x / step).toInt().coerceIn(0, 8)
                    val clickedY = (tapOffset.y / step).toInt().coerceIn(0, 8)
                    
                    onCellClicked(Position(clickedX, clickedY))
                }
            }
            .pointerInput(Unit) {
                detectDragGestures(
                    onDragStart = { dragStart = it; dragCurrent = it },
                    onDragEnd = {
                        val start = dragStart
                        val current = dragCurrent
                        if (start != null && current != null) {
                            val dx = current.x - start.x
                            val dy = current.y - start.y
                            // Require a minimum drag distance to prevent accidental wall placements
                            if (abs(dx) > 20f || abs(dy) > 20f) {
                                val orientation = if (abs(dx) > abs(dy)) WallOrientation.HORIZONTAL else WallOrientation.VERTICAL
                                val cellWidth = size.width / (9f + 8f * gapRatio)
                                val gapWidth = cellWidth * gapRatio
                                val step = cellWidth + gapWidth
                                // Coerce to 7 max because walls span 2 cells (max index is 7 for 9x9 grid)
                                val x = (current.x / step).toInt().coerceIn(0, 7)
                                val y = (current.y / step).toInt().coerceIn(0, 7)
                                onWallPlaced(Wall(Position(x, y), orientation))
                            }
                        }
                        dragStart = null
                        dragCurrent = null
                    },
                    onDragCancel = {
                        dragStart = null
                        dragCurrent = null
                    },
                    onDrag = { change, _ ->
                        change.consume()
                        dragCurrent = change.position
                    }
                )
            }
    ) {
        val cellWidth = size.width / (9f + 8f * gapRatio)
        val gapWidth = cellWidth * gapRatio

        drawRoundRect(
            color = boardBackgroundColor,
            size = size,
            cornerRadius = CornerRadius(16f, 16f)
        )

        for (x in 0 until 9) {
            for (y in 0 until 9) {
                val left = x * (cellWidth + gapWidth)
                val top = y * (cellWidth + gapWidth)

                drawRoundRect(
                    color = cellColor,
                    topLeft = Offset(left, top),
                    size = Size(cellWidth, cellWidth),
                    cornerRadius = CornerRadius(8f, 8f)
                )
            }
        }

        gameState.lastMovePosition?.let { pos ->
            val left = pos.x * (cellWidth + gapWidth)
            val top = pos.y * (cellWidth + gapWidth)

            drawRoundRect(
                color = lastMoveHighlightColor,
                topLeft = Offset(left, top),
                size = Size(cellWidth, cellWidth),
                cornerRadius = CornerRadius(8f, 8f)
            )
        }

        gameState.highlightedMoves.forEach { pos ->
            val left = pos.x * (cellWidth + gapWidth)
            val top = pos.y * (cellWidth + gapWidth)

            drawRoundRect(
                color = highlightColor,
                topLeft = Offset(left, top),
                size = Size(cellWidth, cellWidth),
                cornerRadius = CornerRadius(8f, 8f)
            )
        }

        gameState.walls.forEach { wall ->
            val scale = wallScales[wall] ?: 1f
            val left = wall.position.x * (cellWidth + gapWidth)
            val top = wall.position.y * (cellWidth + gapWidth)

            if (wall.orientation == WallOrientation.HORIZONTAL) {
                val wallWidth = cellWidth * 2 + gapWidth
                val wallHeight = gapWidth
                val wallLeft = left
                val wallTop = top + cellWidth

                withTransform({
                    scale(scaleX = scale, scaleY = scale, pivot = Offset(wallLeft + wallWidth / 2, wallTop + wallHeight / 2))
                }) {
                    drawRoundRect(
                        color = wallColor,
                        topLeft = Offset(wallLeft, wallTop),
                        size = Size(width = wallWidth, height = wallHeight),
                        cornerRadius = CornerRadius(4f, 4f)
                    )
                }
            } else {
                val wallWidth = gapWidth
                val wallHeight = cellWidth * 2 + gapWidth
                val wallLeft = left + cellWidth
                val wallTop = top

                withTransform({
                    scale(scaleX = scale, scaleY = scale, pivot = Offset(wallLeft + wallWidth / 2, wallTop + wallHeight / 2))
                }) {
                    drawRoundRect(
                        color = wallColor,
                        topLeft = Offset(wallLeft, wallTop),
                        size = Size(width = wallWidth, height = wallHeight),
                        cornerRadius = CornerRadius(4f, 4f)
                    )
                }
            }
        }

        // 5. Draw Pawns (Players)
        // Player 1
        drawCircle(
            color = gameState.player1.color,
            radius = cellWidth / 2.5f,
            center = Offset(
                x = p1X * (cellWidth + gapWidth) + (cellWidth / 2),
                y = p1Y * (cellWidth + gapWidth) + (cellWidth / 2)
            )
        )
        
        // Player 2
        drawCircle(
            color = gameState.player2.color,
            radius = cellWidth / 2.5f,
            center = Offset(
                x = p2X * (cellWidth + gapWidth) + (cellWidth / 2),
                y = p2Y * (cellWidth + gapWidth) + (cellWidth / 2)
            )
        )

        // 6. Draw Drag Preview Wall
        val start = dragStart
        val current = dragCurrent
        if (start != null && current != null) {
            val dx = current.x - start.x
            val dy = current.y - start.y
            if (abs(dx) > 20f || abs(dy) > 20f) {
                val orientation = if (abs(dx) > abs(dy)) WallOrientation.HORIZONTAL else WallOrientation.VERTICAL
                
                val step = cellWidth + gapWidth
                val x = (current.x / step).toInt().coerceIn(0, 7)
                val y = (current.y / step).toInt().coerceIn(0, 7)

                val left = x * step
                val top = y * step

                if (orientation == WallOrientation.HORIZONTAL) {
                    drawRoundRect(
                        color = previewWallColor,
                        topLeft = Offset(left, top + cellWidth),
                        size = Size(width = cellWidth * 2 + gapWidth, height = gapWidth),
                        cornerRadius = CornerRadius(4f, 4f)
                    )
                } else {
                    drawRoundRect(
                        color = previewWallColor,
                        topLeft = Offset(left + cellWidth, top),
                        size = Size(width = gapWidth, height = cellWidth * 2 + gapWidth),
                        cornerRadius = CornerRadius(4f, 4f)
                    )
                }
            }
        }
    }
}
