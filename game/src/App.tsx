import { useState, useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { useAuthStore } from './store/authStore';
import { GameBoard } from './components/GameBoard';
import { Home } from './pages/Home';
import { Leaderboard } from './components/Leaderboard';
import { UserProfile } from './components/UserProfile';
import { saveGameRecord } from './services/gameService';

type Page = 'home' | 'game' | 'leaderboard' | 'profile';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const gameStatus = useGameStore((state) => state.gameStatus);
  const gameState = useGameStore();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    // Fetch user on mount
    const token = localStorage.getItem('accessToken');
    if (token && !user) {
      useAuthStore.getState().fetchUser();
    }
  }, [user]);

  const handleGameEnd = async () => {
    if (user && gameStatus !== 'playing') {
      try {
        const gameDuration = (gameState.gameEndTime - gameState.gameStartTime) / 1000;
        const playerWallsUsed = 10 - gameState.playerWallsLeft;
        const aiWallsUsed = 10 - gameState.aiWallsLeft;

        await saveGameRecord({
          aiLevel: gameState.aiLevel,
          winner: gameStatus === 'won' ? 'player' : 'ai',
          playerWallsUsed,
          aiWallsUsed,
          totalMoves: gameState.moveHistory.length,
          gameDuration,
        });

        // Refresh user stats
        await useAuthStore.getState().fetchUser();
      } catch (error) {
        console.error('Failed to save game record:', error);
      }
    }
  };

  useEffect(() => {
    if (gameStatus !== 'playing') {
      handleGameEnd();
    }
  }, [gameStatus]);

  const renderContent = () => {
    switch (currentPage) {
      case 'home':
        return <Home onGameStart={() => setCurrentPage('game')} />;
      case 'game':
        return (
          <div className="bg-[#0f1419] min-h-screen">
            <GameBoard />
            <div className="flex justify-center gap-4 mt-8 pb-8">
              <button
                onClick={() => setCurrentPage('home')}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold"
              >
                홈으로
              </button>
              <button
                onClick={() => useGameStore.getState().undoMove()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
              >
                실행 취소
              </button>
              {gameStatus !== 'playing' && (
                <button
                  onClick={() => setCurrentPage('home')}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold"
                >
                  새 게임
                </button>
              )}
            </div>
          </div>
        );
      case 'leaderboard':
        return <Leaderboard />;
      case 'profile':
        return (
          <div className="bg-[#0f1419] min-h-screen p-8">
            <div className="max-w-4xl mx-auto">
              <button
                onClick={() => setCurrentPage('home')}
                className="mb-8 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
              >
                ← 돌아가기
              </button>
              <UserProfile />
            </div>
          </div>
        );
    }
  };

  return (
    <div>
      {/* Navigation Bar */}
      {currentPage !== 'game' && (
        <nav className="bg-[#1a1a2e] border-b border-[#2a2a4e] px-4 py-4">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <h1
              onClick={() => setCurrentPage('home')}
              className="text-2xl font-bold text-cyan-400 cursor-pointer hover:text-cyan-300"
            >
              🎮 QUORIDOR
            </h1>
            <div className="flex gap-4">
              <button
                onClick={() => setCurrentPage('home')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  currentPage === 'home'
                    ? 'bg-cyan-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                홈
              </button>
              <button
                onClick={() => setCurrentPage('leaderboard')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  currentPage === 'leaderboard'
                    ? 'bg-cyan-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                🏆 리더보드
              </button>
              {user && (
                <button
                  onClick={() => setCurrentPage('profile')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    currentPage === 'profile'
                      ? 'bg-cyan-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  👤 프로필
                </button>
              )}
            </div>
          </div>
        </nav>
      )}

      {renderContent()}
    </div>
  );
}

export default App;
