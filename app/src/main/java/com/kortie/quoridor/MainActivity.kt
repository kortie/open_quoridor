package com.kortie.quoridor

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.kortie.quoridor.ui.screens.GameScreen
import com.kortie.quoridor.ui.screens.LevelSelectionScreen
import com.kortie.quoridor.ui.screens.ModeSelectionScreen
import com.kortie.quoridor.ui.screens.NameInputScreen
import com.kortie.quoridor.ui.screens.SplashScreen
import com.kortie.quoridor.ui.screens.LeaderboardScreen
import com.kortie.quoridor.utils.SoundManager
import com.kortie.quoridor.utils.UserPreferences
import com.kortie.quoridor.data.AppDatabase
import com.kortie.quoridor.viewmodel.QuoridorViewModel

class MainActivity : ComponentActivity() {
    
    private lateinit var userPreferences: UserPreferences
    private lateinit var appDatabase: AppDatabase

    // Instantiate the ViewModel using our custom Factory
    private val viewModel: QuoridorViewModel by viewModels {
        QuoridorViewModel.Factory(userPreferences, appDatabase.matchRecordDao())
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        userPreferences = UserPreferences(applicationContext)
        appDatabase = AppDatabase.getDatabase(applicationContext)

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    val context = LocalContext.current
                    val soundManager = remember { SoundManager(context) }

                    // Clean up audio resources when the Activity is destroyed
                    DisposableEffect(Unit) {
                        onDispose { soundManager.release() }
                    }

                    val navController = rememberNavController()
                    
                    // Observe the StateFlow from the ViewModel
                    val gameState by viewModel.gameState.collectAsState()
                    
                    val highScore by viewModel.highScore.collectAsState()
                    val topScores by viewModel.topScores.collectAsState()

                    val canUndo by viewModel.canUndo.collectAsState()
                    val canRedo by viewModel.canRedo.collectAsState()

                    // Observe changes to trigger sound effects reactively
                    var previousTurnCount by remember { mutableIntStateOf(gameState.turnCount) }
                    var previousWallCount by remember { mutableIntStateOf(gameState.walls.size) }

                    LaunchedEffect(gameState.turnCount) {
                        if (gameState.turnCount > previousTurnCount) {
                            if (gameState.walls.size > previousWallCount) soundManager.playWallSound()
                            else soundManager.playMoveSound()
                        }
                        previousTurnCount = gameState.turnCount
                        previousWallCount = gameState.walls.size
                    }

                    NavHost(
                        navController = navController, 
                        startDestination = "splash_screen",
                        enterTransition = { slideInHorizontally(tween(300)) { it } + fadeIn(tween(300)) },
                        exitTransition = { slideOutHorizontally(tween(300)) { -it } + fadeOut(tween(300)) },
                        popEnterTransition = { slideInHorizontally(tween(300)) { -it } + fadeIn(tween(300)) },
                        popExitTransition = { slideOutHorizontally(tween(300)) { it } + fadeOut(tween(300)) }
                    ) {
                        composable("splash_screen") {
                            SplashScreen(
                                onSplashFinished = {
                                    navController.navigate("name_input") {
                                        popUpTo("splash_screen") { inclusive = true }
                                    }
                                }
                            )
                        }
                        composable("name_input") {
                            NameInputScreen(
                                initialName = gameState.player1.name.takeIf { it != "Player 1" } ?: "",
                                onNameSubmitted = { name ->
                                    viewModel.setPlayerName(name)
                                    navController.navigate("mode_select")
                                }
                            )
                        }
                        composable("mode_select") {
                            ModeSelectionScreen(
                                highScore = highScore,
                                onPlayVsHuman = {
                                    viewModel.setDifficulty(0) // 0 indicates Local PvP
                                    viewModel.resetGame() // Applies the names and starts the timer
                                    navController.navigate("game")
                                },
                                onPlayVsAi = { navController.navigate("level_select") },
                                onViewLeaderboard = { navController.navigate("leaderboard") },
                                onBackClicked = { navController.popBackStack() }
                            )
                        }
                        composable("level_select") {
                            LevelSelectionScreen(
                                onLevelSelected = { level ->
                                    viewModel.setDifficulty(level)
                                    viewModel.resetGame() // Applies the AI name & chosen difficulty and starts the timer
                                    navController.navigate("game")
                                },
                                onBackClicked = { navController.popBackStack() }
                            )
                        }
                        composable("game") {
                            GameScreen(
                                gameState = gameState,
                                onCellClicked = { position ->
                                    val currentPlayer = if (gameState.isPlayer1Turn) gameState.player1 else gameState.player2
                                    if (position == currentPlayer.position) viewModel.onPawnSelected() 
                                    else viewModel.movePawn(position)
                                },
                                onWallPlaced = viewModel::placeWall,
                                onUndo = viewModel::undo,
                                onRedo = viewModel::redo,
                                canUndo = canUndo,
                                canRedo = canRedo,
                                onRestart = viewModel::resetGame,
                                onQuit = {
                                    navController.popBackStack("mode_select", inclusive = false)
                                }
                            )
                        }
                        composable("leaderboard") {
                            LeaderboardScreen(
                                topScores = topScores,
                                onBackClicked = { navController.popBackStack() }
                            )
                        }
                    }
                }
            }
        }
    }
}