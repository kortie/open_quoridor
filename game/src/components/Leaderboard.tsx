import React, { useEffect, useState } from 'react';
import { useLeaderboardStore } from '../store/leaderboardStore';
import { useAuthStore } from '../store/authStore';

type LeaderboardTab = 'global' | 'weekly' | 'my-rank';

export const Leaderboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('global');
  const user = useAuthStore((state) => state.user);
  const {
    globalLeaderboard,
    weeklyLeaderboard,
    myRank,
    myPoints,
    isLoading,
    fetchGlobalLeaderboard,
    fetchWeeklyLeaderboard,
    fetchMyRank,
  } = useLeaderboardStore();

  useEffect(() => {
    if (activeTab === 'global') {
      fetchGlobalLeaderboard();
    } else if (activeTab === 'weekly') {
      fetchWeeklyLeaderboard();
    } else if (activeTab === 'my-rank') {
      fetchMyRank();
    }
  }, [activeTab, fetchGlobalLeaderboard, fetchWeeklyLeaderboard, fetchMyRank]);

  const leaderboard = activeTab === 'global' ? globalLeaderboard : weeklyLeaderboard;

  return (
    <div className="bg-[#0f1419] min-h-screen text-white p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-cyan-400">🏆 리더보드</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-[#2a2a4e]">
          {(['global', 'weekly', 'my-rank'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === tab
                  ? 'border-b-2 border-cyan-400 text-cyan-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'global' && '🌍 전체'}
              {tab === 'weekly' && '📅 주간'}
              {tab === 'my-rank' && '👤 내 순위'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">로딩 중...</div>
          </div>
        ) : activeTab === 'my-rank' ? (
          <MyRankCard myRank={myRank} myPoints={myPoints} user={user} />
        ) : (
          <LeaderboardTable entries={leaderboard} />
        )}
      </div>
    </div>
  );
};

interface MyRankCardProps {
  myRank: number;
  myPoints: number;
  user: any;
}

const MyRankCard: React.FC<MyRankCardProps> = ({ myRank, myPoints, user }) => {
  if (!user) {
    return (
      <div className="bg-[#1a1a2e] border border-[#2a2a4e] rounded-lg p-8 text-center">
        <p className="text-gray-400">로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a2e] border border-[#2a2a4e] rounded-lg p-8 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        {user.profileImage && (
          <img src={user.profileImage} alt={user.nickname} className="w-16 h-16 rounded-full" />
        )}
        <div>
          <h2 className="text-2xl font-bold">{user.nickname}</h2>
          <p className="text-gray-400">총 {user.totalGames}게임</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#0f1419] p-4 rounded-lg">
          <p className="text-gray-400 text-sm">현재 순위</p>
          <p className="text-3xl font-bold text-cyan-400"># {myRank}</p>
        </div>
        <div className="bg-[#0f1419] p-4 rounded-lg">
          <p className="text-gray-400 text-sm">총 포인트</p>
          <p className="text-3xl font-bold text-emerald-400">{myPoints}</p>
        </div>
        <div className="bg-[#0f1419] p-4 rounded-lg">
          <p className="text-gray-400 text-sm">승리</p>
          <p className="text-3xl font-bold text-blue-400">{user.totalWins}</p>
        </div>
        <div className="bg-[#0f1419] p-4 rounded-lg">
          <p className="text-gray-400 text-sm">승률</p>
          <p className="text-3xl font-bold text-purple-400">
            {user.totalGames > 0 ? ((user.totalWins / user.totalGames) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>
    </div>
  );
};

interface LeaderboardTableProps {
  entries: any[];
}

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ entries }) => {
  return (
    <div className="bg-[#1a1a2e] border border-[#2a2a4e] rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-[#0f1419] border-b border-[#2a2a4e]">
          <tr>
            <th className="px-6 py-4 text-left text-gray-400 font-semibold">순위</th>
            <th className="px-6 py-4 text-left text-gray-400 font-semibold">닉네임</th>
            <th className="px-6 py-4 text-center text-gray-400 font-semibold">포인트</th>
            <th className="px-6 py-4 text-center text-gray-400 font-semibold">승리</th>
            <th className="px-6 py-4 text-center text-gray-400 font-semibold">승률</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.userId}
              className="border-b border-[#2a2a4e] hover:bg-[#252541] transition-colors"
            >
              <td className="px-6 py-4">
                <span className="font-bold text-lg">
                  {entry.rank === 1 && '🥇'}
                  {entry.rank === 2 && '🥈'}
                  {entry.rank === 3 && '🥉'}
                  {entry.rank > 3 && `#${entry.rank}`}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  {entry.profileImage && (
                    <img
                      src={entry.profileImage}
                      alt={entry.nickname}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="text-white font-medium">{entry.nickname}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-center">
                <span className="text-cyan-400 font-semibold">{entry.totalPoints}</span>
              </td>
              <td className="px-6 py-4 text-center">
                <span className="text-emerald-400 font-semibold">{entry.totalWins}</span>
              </td>
              <td className="px-6 py-4 text-center">
                <span className="text-blue-400 font-semibold">
                  {entry.totalGames > 0 ? ((entry.totalWins / entry.totalGames) * 100).toFixed(1) : 0}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {entries.length === 0 && (
        <div className="text-center py-12 text-gray-400">아직 기록이 없습니다.</div>
      )}
    </div>
  );
};
