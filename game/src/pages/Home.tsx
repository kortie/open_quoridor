import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { LoginButton } from '../components/LoginButton';
import { initKakaoSDK } from '../services/kakaoAuth';

interface HomeProps {
  onGameStart: () => void;
}

const LEVELS = [
  { level: 'Easy', label: '🟢 쉬움' },
  { level: 'Normal', label: '🟡 보통' },
  { level: 'Hard', label: '🟠 어려움' },
  { level: 'VeryHard', label: '🔴 매우 어려움' },
  { level: 'Expert', label: '💀 전문가' },
] as const;

export const Home: React.FC<HomeProps> = ({ onGameStart }) => {
  const startGame = useGameStore((state) => state.startGame);
  const user = useAuthStore((state) => state.user);
  const [selectedLevel, setSelectedLevel] = useState<string>('Normal');

  useEffect(() => {
    initKakaoSDK();
  }, []);

  const handleStartGame = () => {
    startGame(selectedLevel);
    onGameStart();
  };

  return (
    <div className="min-h-screen bg-[#0f1419] text-white flex flex-col items-center justify-center p-4">
      {/* User Info Header */}
      {user && (
        <div className="absolute top-4 right-4 flex items-center gap-3 bg-[#1a1a2e] border border-[#2a2a4e] px-4 py-2 rounded-lg">
          {user.profileImage && (
            <img src={user.profileImage} alt={user.nickname} className="w-8 h-8 rounded-full" />
          )}
          <span className="text-sm">{user.nickname}</span>
        </div>
      )}

      <div className="max-w-md w-full space-y-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-5xl font-bold text-cyan-400 mb-2">🎮 QUORIDOR</h1>
          <p className="text-gray-400 text-lg">AI와의 전략 보드게임</p>
        </div>

        {/* Game Description */}
        <div className="bg-[#1a1a2e] border border-[#2a2a4e] rounded-lg p-6 space-y-3">
          <h2 className="text-xl font-semibold text-emerald-400">게임 규칙</h2>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>✓ 목표: 먼저 상대방 쪽 끝에 도달하기</li>
            <li>✓ 매턴마다 이동 또는 벽 배치 중 선택</li>
            <li>✓ 각 플레이어는 벽 10개 보유</li>
            <li>✓ 상대를 완전히 막을 수 없음</li>
          </ul>
        </div>

        {/* Difficulty Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-300">난이도 선택</label>
          <div className="grid grid-cols-2 gap-2">
            {LEVELS.map(({ level, label }, i) => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                  i === LEVELS.length - 1 ? 'col-span-2' : ''
                } ${
                  selectedLevel === level
                    ? 'bg-cyan-500 text-white'
                    : 'bg-[#1a1a2e] text-gray-300 border border-[#2a2a4e] hover:border-cyan-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Login Section */}
        {!user && (
          <div className="bg-[#1a1a2e] border border-[#2a2a4e] rounded-lg p-6 text-center space-y-4">
            <p className="text-gray-400">로그인하여 기록을 저장하세요!</p>
            <LoginButton />
          </div>
        )}

        {/* Start Button */}
        <button
          onClick={handleStartGame}
          className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-4 rounded-lg transition-all transform hover:scale-105 active:scale-95"
        >
          게임 시작
        </button>

        {/* Controls Info */}
        <div className="bg-[#1a1a2e] border border-[#2a2a4e] rounded-lg p-4">
          <h3 className="font-semibold text-sm text-gray-300 mb-2">조작 방법</h3>
          <p className="text-xs text-gray-400">
            - 초록색 동그라미: 이동 가능한 위치<br/>
            - 클릭으로 이동<br/>
            - 우측 상단 벽 배치 버튼 사용
          </p>
        </div>
      </div>
    </div>
  );
};
