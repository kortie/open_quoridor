package com.kortie.quoridor.viewmodel

import androidx.compose.ui.graphics.Color
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.kortie.quoridor.engine.Action
import com.kortie.quoridor.engine.AiEngine
import com.kortie.quoridor.engine.GameEngine
import com.kortie.quoridor.model.GameState
import com.kortie.quoridor.model.Player
import com.kortie.quoridor.model.Position
import com.kortie.quoridor.model.Wall
import com.kortie.quoridor.utils.UserPreferences
import com.kortie.quoridor.data.MatchRecord
import com.kortie.quoridor.data.MatchRecordDao
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class QuoridorViewModel(
    private val userPreferences: UserPreferences,
    private val matchRecordDao: MatchRecordDao
) : ViewModel() {

    companion object {
        private const val MAX_HISTORY_DEPTH = 40
    }

    // Initializing a default game state
    private val _gameState = MutableStateFlow(
        GameState(
            player1 = Player("Player 1", Position(4, 0), targetRow = 8, color = Color.White),
            player2 = Player("Player 2", Position(4, 8), targetRow = 0, color = Color.Black)
        )
    )
    val gameState = _gameState.asStateFlow()

    // Expose high score for the UI
    val highScore: StateFlow<Long> = userPreferences.highScoreFlow
        .stateIn(viewModelScope, SharingStarted.Lazily, 0L)

    // Expose the Room database leaderboard for the UI
    val topScores: StateFlow<List<MatchRecord>> = matchRecordDao.getTopScores()
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    private val stateHistory = mutableListOf<GameState>()
    private val redoHistory = mutableListOf<GameState>()

    private val _canUndo = MutableStateFlow(false)
    val canUndo = _canUndo.asStateFlow()

    private val _canRedo = MutableStateFlow(false)
    val canRedo = _canRedo.asStateFlow()

    init {
        viewModelScope.launch {
            userPreferences.userNameFlow.collect { savedName ->
                if (savedName.isNotBlank() && _gameState.value.player1.name == "Player 1") {
                    _gameState.value = _gameState.value.copy(player1 = _gameState.value.player1.copy(name = savedName))
                }
            }
        }
        startTimer()
    }

    private fun startTimer() {
        viewModelScope.launch {
            while (_gameState.value.winner == null) {
                delay(1000)
                _gameState.value = _gameState.value.copy(
                    playTimeSeconds = _gameState.value.playTimeSeconds + 1
                )
            }
        }
    }

    private fun saveState() {
        stateHistory.add(_gameState.value)
        if (stateHistory.size > MAX_HISTORY_DEPTH) {
            stateHistory.removeAt(0)
        }
        redoHistory.clear()
        updateUndoRedoState()
    }

    private fun updateUndoRedoState() {
        _canUndo.value = stateHistory.isNotEmpty()
        _canRedo.value = redoHistory.isNotEmpty()
    }

    fun onPawnSelected() {
        val currentState = _gameState.value
        val currentPlayer = if (currentState.isPlayer1Turn) currentState.player1 else currentState.player2
        
        // Use the GameEngine to calculate moves
        val validMoves = GameEngine.calculateValidMoves(currentPlayer, currentState)
        
        _gameState.value = currentState.copy(highlightedMoves = validMoves)
    }

    fun movePawn(newPosition: Position) {
        val currentState = _gameState.value

        // 1. Identify current player and ensure the move is valid
        val currentPlayer = if (currentState.isPlayer1Turn) currentState.player1 else currentState.player2
        val validMoves = GameEngine.calculateValidMoves(currentPlayer, currentState)
        if (newPosition !in validMoves) return

        saveState()

        val updatedPlayer = currentPlayer.copy(position = newPosition)

        // 3. Check for win condition
        val hasWon = newPosition.y == updatedPlayer.targetRow
        val winner = if (hasWon) updatedPlayer else null

        if (hasWon) {
            val isAiGame = currentState.difficulty > 0
            val score = if (isAiGame) (currentState.difficulty * (100 - currentState.turnCount)) + currentState.playTimeSeconds else 0L
            
            // Save to DataStore if it's an AI game high score
            if (currentState.isPlayer1Turn && isAiGame) {
                viewModelScope.launch {
                    userPreferences.saveHighScore(score)
                }
            }

            // Save to Room Leaderboard
            viewModelScope.launch(Dispatchers.IO) {
                matchRecordDao.insertMatch(
                    MatchRecord(
                        playerName = currentState.player1.name,
                        opponentName = currentState.player2.name,
                        difficulty = currentState.difficulty,
                        turns = currentState.turnCount,
                        playTimeSeconds = currentState.playTimeSeconds,
                        score = score,
                        isWin = currentState.isPlayer1Turn // True if Player 1 caused the win state
                    )
                )
            }
        }

        // 4. Update state and switch turns
        _gameState.value = currentState.copy(
            player1 = if (currentState.isPlayer1Turn) updatedPlayer else currentState.player1,
            player2 = if (!currentState.isPlayer1Turn) updatedPlayer else currentState.player2,
            highlightedMoves = emptyList(), // Clear highlights
            lastMovePosition = if (!currentState.isPlayer1Turn) newPosition else null, // Highlight the opponent's last move
            isPlayer1Turn = !currentState.isPlayer1Turn,
            turnCount = currentState.turnCount + 1,
            winner = winner
        )
        
        triggerAiTurnIfNeeded()
    }

    fun placeWall(wall: Wall): Boolean {
        val currentState = _gameState.value
        if (currentState.winner != null) return false // Game is over

        val currentPlayer = if (currentState.isPlayer1Turn) currentState.player1 else currentState.player2
        
        // 1. Check if the player has walls left
        if (currentPlayer.wallsLeft <= 0) return false

        // 2. Validate the placement using the GameEngine (checks overlapping & Golden Rule BFS)
        if (GameEngine.isValidWallPlacement(wall, currentState)) {
            saveState()
            val updatedPlayer = currentPlayer.copy(wallsLeft = currentPlayer.wallsLeft - 1)
            
            _gameState.value = currentState.copy(
                player1 = if (currentState.isPlayer1Turn) updatedPlayer else currentState.player1,
                player2 = if (!currentState.isPlayer1Turn) updatedPlayer else currentState.player2,
                walls = currentState.walls + wall,
                isPlayer1Turn = !currentState.isPlayer1Turn,
                turnCount = currentState.turnCount + 1
            )
            
            triggerAiTurnIfNeeded()
            return true
        }
        return false
    }

    private fun triggerAiTurnIfNeeded() {
        val currentState = _gameState.value
        // If it's Player 2's turn, it's an AI game, and no one has won yet
        if (!currentState.isPlayer1Turn && currentState.difficulty > 0 && currentState.winner == null) {
            // Launch in Default dispatcher to avoid freezing the UI during Minimax calculation
            viewModelScope.launch(Dispatchers.Default) {
                
                // Map Difficulty 1-5 to a Minimax Search Depth
                val depth = when(currentState.difficulty) {
                    1 -> 1 // Greedy/Random
                    2 -> 2 // Looks 1 move ahead
                    3, 4 -> 3 // Stronger foresight
                    5 -> 4 // Expert 
                    else -> 2
                }
                
                // Grab a snapshot so AI calculates against the board as it was right after the human turn
                val stateSnapshot = _gameState.value
                val bestAction = AiEngine.getBestAction(stateSnapshot, depth)
                
                // Switch back to Main thread to update UI state
                withContext(Dispatchers.Main) {
                    // Prevent race condition if user undid their move while AI was thinking
                    if (!_gameState.value.isPlayer1Turn && _gameState.value.winner == null) {
                        when (bestAction) {
                            is Action.MovePawn -> movePawn(bestAction.position)
                            is Action.PlaceWall -> placeWall(bestAction.wall)
                        }
                    }
                }
            }
        }
    }

    fun undo() {
        if (stateHistory.isNotEmpty()) {
            val wasGameOver = _gameState.value.winner != null
            redoHistory.add(_gameState.value)
            
            var prevState = stateHistory.removeLast()
            
            // If playing vs AI, revert the AI's move and the human's move in one tap
            if (prevState.difficulty > 0 && !prevState.isPlayer1Turn && stateHistory.isNotEmpty()) {
                redoHistory.add(prevState)
                prevState = stateHistory.removeLast()
            }
            
            // Preserve the ongoing timer to prevent time-cheating
            _gameState.value = prevState.copy(playTimeSeconds = _gameState.value.playTimeSeconds)
            updateUndoRedoState()

            // Restart the background timer coroutine if the user undid a game-over state
            if (wasGameOver && _gameState.value.winner == null) startTimer()
        }
    }

    fun redo() {
        if (redoHistory.isNotEmpty()) {
            stateHistory.add(_gameState.value)
            var nextState = redoHistory.removeLast()
            
            // If playing vs AI, re-apply the human's move and the AI's response in one tap
            if (nextState.difficulty > 0 && !nextState.isPlayer1Turn && redoHistory.isNotEmpty()) {
                stateHistory.add(nextState)
                nextState = redoHistory.removeLast()
            }
            
            _gameState.value = nextState.copy(playTimeSeconds = _gameState.value.playTimeSeconds)
            updateUndoRedoState()
        }
    }

    fun setPlayerName(name: String) {
        _gameState.value = _gameState.value.copy(
            player1 = _gameState.value.player1.copy(name = name)
        )
        viewModelScope.launch {
            userPreferences.saveUserName(name)
        }
    }

    fun resetGame() {
        val currentName = _gameState.value.player1.name
        val currentDifficulty = _gameState.value.difficulty

        stateHistory.clear()
        redoHistory.clear()
        updateUndoRedoState()

        _gameState.value = GameState(
            player1 = Player(currentName, Position(4, 0), targetRow = 8, color = Color.White),
            player2 = Player(if (currentDifficulty > 0) "AI Opponent" else "Player 2", Position(4, 8), targetRow = 0, color = Color.Black),
            difficulty = currentDifficulty
        )
        startTimer()
    }

    fun setDifficulty(level: Int) {
        _gameState.value = _gameState.value.copy(
            difficulty = level,
            playTimeSeconds = 0L,
            turnCount = 0,
            winner = null
        )
    }

    // Factory to help instantiate ViewModel with UserPreferences
    class Factory(private val userPreferences: UserPreferences, private val matchRecordDao: MatchRecordDao) : ViewModelProvider.Factory {
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            if (modelClass.isAssignableFrom(QuoridorViewModel::class.java)) {
                @Suppress("UNCHECKED_CAST")
                return QuoridorViewModel(userPreferences, matchRecordDao) as T
            }
            throw IllegalArgumentException("Unknown ViewModel class")
        }
    }
}
