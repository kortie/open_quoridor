# Quoridor for Android

A native Android implementation of the classic abstract strategy board game **Quoridor**. Built entirely with modern Android development practices including **Kotlin**, **Jetpack Compose**, and **MVVM architecture**.

## 📱 Features

* **Multiple Game Modes:** 
  * Play Locally vs a Human (Same Device).
  * Play vs AI.
* **5 AI Difficulty Levels:** Ranging from random moves (Level 1) to advanced Minimax with Alpha-Beta Pruning (Level 5).
* **Interactive UI:** Fully custom-drawn 9x9 game board using Jetpack Compose `Canvas`.
* **Smart Validation:** 
  * Strict adherence to Quoridor movement rules (including straight and diagonal jumping).
  * Implementation of Breadth-First Search (BFS) to enforce the "Golden Rule" (a player can never be completely walled off from their goal).
* **Game Statistics & Scoring:** Tracks play time, turn count, and calculates a final score based on difficulty and efficiency.

## 🛠️ Tech Stack & Architecture

* **Language:** Kotlin
* **UI Toolkit:** Jetpack Compose
* **Architecture:** MVVM (Model-View-ViewModel)
* **Asynchronous Programming:** Kotlin Coroutines & StateFlow
* **Navigation:** Jetpack Navigation Compose

### Project Structure
```text
app/src/main/java/com/example/quoridor/
│
├── model/          # Pure data classes (Player, Wall, Position, GameState)
├── engine/         # Game logic, move validation, BFS pathfinding, and AI
├── viewmodel/      # QuoridorViewModel (State management, timers, turn cycling)
├── ui/
│   ├── screens/    # Compose screens (NameInput, ModeSelect, GameScreen, etc.)
│   └── components/ # Reusable UI pieces (QuoridorBoard Canvas, Dialogs)
└── MainActivity.kt # Entry point and Navigation Host

📖 Game Rules
Objective: Be the first player to move your pawn to any cell on the opponent's baseline.
On Your Turn: You may either move your pawn one step orthogonally OR place a wall.
Walls: Each player starts with 10 walls. Walls span exactly two squares and cannot overlap.
Jumping: If your pawn is adjacent to your opponent's, you may jump over them. If a wall blocks the straight jump, you may jump diagonally.
The Golden Rule: You cannot place a wall that completely blocks either player's path to their goal line. There must always be at least one open path.

🏆 Scoring System
When a match against the AI is completed, the score is calculated using the following formula:

Score = Difficulty * (100 - Turns) + Play Time (Seconds)

Difficulty: Multiplier from 1 to 5.
Turns: Taking fewer turns results in a higher score.
Play Time: Total elapsed time in the match.

🏆 Scoring System
When a match against the AI is completed, the score is calculated using the following formula:

Score = Difficulty * (100 - Turns) + Play Time (Seconds)

Difficulty: Multiplier from 1 to 5.
Turns: Taking fewer turns results in a higher score.
Play Time: Total elapsed time in the match.

🚀 How to Build and Run
Clone or download this repository.
Open the project in Android Studio (Giraffe or newer recommended).
Allow Gradle to sync and download the necessary dependencies (Compose, Coroutines, etc.).
Select an emulator or physical device.
Click Run (Shift + F10).

🔮 Future Improvements
Network Multiplayer (WebSockets or Firebase) for remote PvP.
Leaderboard system using a local Room Database or cloud storage.
Board themes and customized pawn colors.