import React from 'react';
import { useAuthStore } from '../store/authStore';

export const UserProfile: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <div className="bg-[#1a1a2e] border border-[#2a2a4e] rounded-lg p-6 max-w-md mx-auto">
      <div className="flex items-center gap-4 mb-6">
        {user.profileImage && (
          <img src={user.profileImage} alt={user.nickname} className="w-16 h-16 rounded-full" />
        )}
        <div>
          <h2 className="text-2xl font-bold text-white">{user.nickname}</h2>
          <p className="text-gray-400">포인트: {user.totalPoints}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#0f1419] p-4 rounded-lg">
          <p className="text-gray-400 text-sm">게임</p>
          <p className="text-2xl font-bold text-cyan-400">{user.totalGames}</p>
        </div>
        <div className="bg-[#0f1419] p-4 rounded-lg">
          <p className="text-gray-400 text-sm">승리</p>
          <p className="text-2xl font-bold text-emerald-400">{user.totalWins}</p>
        </div>
        <div className="bg-[#0f1419] p-4 rounded-lg">
          <p className="text-gray-400 text-sm">승률</p>
          <p className="text-2xl font-bold text-blue-400">
            {user.totalGames > 0 ? ((user.totalWins / user.totalGames) * 100).toFixed(1) : 0}%
          </p>
        </div>
        <div className="bg-[#0f1419] p-4 rounded-lg">
          <p className="text-gray-400 text-sm">연승</p>
          <p className="text-2xl font-bold text-purple-400">{user.currentStreak}</p>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all"
      >
        로그아웃
      </button>
    </div>
  );
};
