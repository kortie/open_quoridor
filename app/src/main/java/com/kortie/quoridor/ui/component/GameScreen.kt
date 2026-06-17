package com.kortie.quoridor.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.kortie.quoridor.model.GameState
import com.kortie.quoridor.model.Player
import com.kortie.quoridor.model.Position
import com.kortie.quoridor.model.Wall
import com.kortie.quoridor.ui.components.QuoridorBoard

@Composable
fun GameScreen(
    gameState: GameState,
    onCellClicked: (Position) -> Unit,
    onWallPlaced: (Wall) -> Unit,
    onUndo: () -> Unit,
    onRedo: () -> Unit,
    canUndo: Boolean,
    canRedo: Boolean,
    onRestart: () -> Unit,
    onQuit: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showQuitDialog by remember { mutableStateOf(false) }

    // Intercepts the physical back button press
    BackHandler {
        showQuitDialog = true
    }

    if (showQuitDialog) {
        AlertDialog(
            onDismissRequest = { showQuitDialog = false },
            title = { Text(text = "Quit Game?") },
            text = { Text(text = "Are you sure you want to quit this match? All current progress will be lost.") },
            confirmButton = {
                TextButton(onClick = {
                    showQuitDialog = false
                    onQuit()
                }) {
                    Text("Quit", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showQuitDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Top Section: Game Info (Timer, Turn)
        GameHeader(
            playTimeSeconds = gameState.playTimeSeconds,
            turnCount = gameState.turnCount,
            isPlayer1Turn = gameState.isPlayer1Turn
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Player 2 (Top) Stats
        PlayerStats(
            player = gameState.player2,
            isCurrentTurn = !gameState.isPlayer1Turn
        )

        Spacer(modifier = Modifier.height(16.dp))

        // The Board
        QuoridorBoard(
            gameState = gameState,
            onCellClicked = onCellClicked,
            onWallPlaced = onWallPlaced,
            modifier = Modifier.weight(1f)
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Player 1 (Bottom) Stats
        PlayerStats(
            player = gameState.player1,
            isCurrentTurn = gameState.isPlayer1Turn
        )
        
        Spacer(modifier = Modifier.height(16.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            OutlinedButton(
                onClick = onUndo,
                enabled = canUndo,
                modifier = Modifier.weight(1f)
            ) {
                Text("Undo")
            }
            OutlinedButton(
                onClick = onRedo,
                enabled = canRedo,
                modifier = Modifier.weight(1f)
            ) {
                Text("Redo")
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedButton(
            onClick = { showQuitDialog = true },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Quit Match", color = MaterialTheme.colorScheme.error)
        }
    }

    if (gameState.winner != null) {
        ResultDialog(
            gameState = gameState,
            onRestart = onRestart
        )
    }
}

@Composable
fun GameHeader(playTimeSeconds: Long, turnCount: Int, isPlayer1Turn: Boolean) {
    val minutes = playTimeSeconds / 60
    val seconds = playTimeSeconds % 60
    val timeString = String.format("%02d:%02d", minutes, seconds)

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "Turn: $turnCount",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        
        Text(
            text = if (isPlayer1Turn) "Player 1's Turn" else "Player 2's Turn",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.ExtraBold,
            color = MaterialTheme.colorScheme.primary
        )

        Text(
            text = timeString,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
fun PlayerStats(player: Player, isCurrentTurn: Boolean) {
    // Highlight the card if it's currently this player's turn
    val containerColor = if (isCurrentTurn) {
        MaterialTheme.colorScheme.primaryContainer
    } else {
        MaterialTheme.colorScheme.surfaceVariant
    }
    val elevation = if (isCurrentTurn) 8.dp else 2.dp

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = containerColor),
        elevation = CardDefaults.cardElevation(defaultElevation = elevation)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(player.color)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = player.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Text(
                text = "Walls: ${player.wallsLeft}",
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
fun ResultDialog(gameState: GameState, onRestart: () -> Unit) {
    val winnerName = gameState.winner?.name ?: "Unknown"
    
    // Score = Difficulty * (100 - Turns) + Play Time (Seconds)
    // Only calculate score if it's an AI game (Difficulty > 0)
    val score = if (gameState.difficulty > 0) {
        (gameState.difficulty * (100 - gameState.turnCount)) + gameState.playTimeSeconds
    } else {
        null
    }

    AlertDialog(
        onDismissRequest = { }, // Disable outside click dismiss
        title = { Text(text = "Game Over!") },
        text = {
            Column {
                Text(text = "$winnerName Wins!", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "Turns Taken: ${gameState.turnCount}")
                Text(text = "Match Time: ${gameState.playTimeSeconds}s")
                
                Spacer(modifier = Modifier.height(8.dp))
                if (score != null) {
                    Text(text = "Difficulty: Level ${gameState.difficulty}")
                    Text(text = "Final Score: $score", fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                } else {
                    Text(text = "Mode: Local PvP (No Score)", color = MaterialTheme.colorScheme.secondary)
                }
            }
        },
        confirmButton = {
            Button(onClick = onRestart) {
                Text("Play Again")
            }
        }
    )
}