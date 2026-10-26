import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { LoginButton } from '../components/LoginButton';
import { initKakaoSDK } from '../services/kakaoAuth';
import { OFFLINE } from '../config';

interface HomeProps {
  onGameStart: () => void;
}

const LEVELS = [
  { level: 'Easy', label: '쉬움', emoji: '🌱', glow: 'shadow-glow-mint', ring: 'ring-teal-300' },
  { level: 'Normal', label: '보통', emoji: '🍀', glow: 'shadow-glow-sky', ring: 'ring-sky-300' },
  { level: 'Hard', label: '어려움', emoji: '🔥', glow: 'shadow-glow-lemon', ring: 'ring-amber-200' },
  { level: 'VeryHard', label: '매우 어려움', emoji: '⚡', glow: 'shadow-glow-pink', ring: 'ring-pink-300' },
  { level: 'Expert', label: '전문가', emoji: '👑', glow: 'shadow-glow-lilac', ring: 'ring-violet-300' },
] as const;

export const Home: React.FC<HomeProps> = ({ onGameStart }) => {
  const startGame = useGameStore((state) => state.startGame);
  const user = useAuthStore((state) => state.user);
  const [selectedLevel, setSelectedLevel] = useState<string>('Normal');

  useEffect(() => {
    if (!OFFLINE) initKakaoSDK();
  }, []);

  const handleStartGame = () => {
    startGame(selectedLevel);
    onGameStart();
  };

  return (
    <div
      className={`${OFFLINE ? 'app-screen' : 'min-h-screen'} text-white flex flex-col items-center justify-center px-5 py-6`}
    >
      {/* User Info Header */}
      {user && (
        <div className="absolute top-4 right-4 flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl shadow-glow-lilac">
          {user.profileImage && (
            <img src={user.profileImage} alt={user.nickname} className="w-8 h-8 rounded-full" />
          )}
          <span className="text-sm">{user.nickname}</span>
        </div>
      )}

      <div className="max-w-md w-full flex flex-col gap-7">
        {/* Logo with the two pawns */}
        <div className="text-center flex flex-col items-center gap-3">
          <div className="flex gap-4">
            <span className="w-12 h-12 rounded-full bg-teal-300 shadow-glow-mint pawn-float flex items-center justify-center text-2xl">😊</span>
            <span className="w-12 h-12 rounded-full bg-pink-300 shadow-glow-pink pawn-float flex items-center justify-center text-2xl" style={{ animationDelay: '0.6s' }}>😼</span>
          </div>
          <h1 className="text-5xl font-extrabold tracking-wide text-violet-100 glow-text-lilac">QUORIDOR</h1>
          <p className="text-violet-200/80">벽을 세워 AI보다 먼저 도착하세요!</p>
        </div>

        {/* Game rules: web only (the app keeps a single uncluttered screen) */}
        {!OFFLINE && (
          <div className="bg-white/5 rounded-3xl p-5 space-y-2 shadow-glow-lilac">
            <h2 className="text-lg font-bold text-teal-200">게임 규칙</h2>
            <ul className="space-y-1 text-sm text-violet-100/90">
              <li>✓ 목표: 먼저 상대방 쪽 끝에 도달하기</li>
              <li>✓ 매턴마다 이동 또는 벽 배치 중 선택</li>
              <li>✓ 각 플레이어는 벽 10개 보유</li>
              <li>✓ 상대를 완전히 막을 수 없음</li>
            </ul>
          </div>
        )}

        {/* Difficulty Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-violet-200">난이도 선택</label>
          <div className="grid grid-cols-2 gap-3">
            {LEVELS.map(({ level, label, emoji, glow, ring }, i) => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`py-3 px-4 rounded-2xl font-bold transition-all active:scale-95 ${
                  i === LEVELS.length - 1 ? 'col-span-2' : ''
                } ${
                  selectedLevel === level
                    ? `bg-white/20 text-white ring-2 ${ring} ${glow} scale-[1.03]`
                    : 'bg-white/5 text-violet-200'
                }`}
              >
                <span className="mr-1.5">{emoji}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Login Section */}
        {!OFFLINE && !user && (
          <div className="bg-white/5 rounded-3xl p-5 text-center space-y-4 shadow-glow-sky">
            <p className="text-violet-200">로그인하여 기록을 저장하세요!</p>
            <LoginButton />
          </div>
        )}

        {/* Start Button */}
        <button
          onClick={handleStartGame}
          className="w-full bg-gradient-to-r from-teal-300 via-sky-300 to-pink-300 text-[#1e1b3a] text-lg font-extrabold py-4 rounded-3xl shadow-glow-mint transition-transform hover:scale-[1.02] active:scale-95"
        >
          게임 시작 ✨
        </button>
      </div>
    </div>
  );
};
