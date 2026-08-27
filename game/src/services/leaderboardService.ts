import axiosInstance from './api';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  nickname: string;
  profileImage: string;
  totalPoints: number;
  totalWins: number;
  totalGames: number;
  winRate: number;
  currentStreak: number;
}

export interface UserStats {
  userId: string;
  nickname: string;
  profileImage: string;
  totalGames: number;
  totalWins: number;
  totalPoints: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  lastGameDate: string;
  myRank: number;
}

export async function getGlobalLeaderboard(limit: number = 100, offset: number = 0): Promise<LeaderboardEntry[]> {
  try {
    const response = await axiosInstance.get('/leaderboard/global', {
      params: { limit, offset },
    });

    return response.data;
  } catch (error) {
    console.error('❌ Failed to fetch global leaderboard:', error);
    throw error;
  }
}

export async function getWeeklyLeaderboard(limit: number = 100): Promise<LeaderboardEntry[]> {
  try {
    const response = await axiosInstance.get('/leaderboard/weekly', {
      params: { limit },
    });

    return response.data;
  } catch (error) {
    console.error('❌ Failed to fetch weekly leaderboard:', error);
    throw error;
  }
}

export async function getMyRank(): Promise<{ rank: number; totalPoints: number; percentile: number }> {
  try {
    const response = await axiosInstance.get('/leaderboard/my-rank');
    return response.data;
  } catch (error) {
    console.error('❌ Failed to fetch my rank:', error);
    throw error;
  }
}

export async function getUserStats(): Promise<UserStats> {
  try {
    const response = await axiosInstance.get('/stats/me');
    return response.data;
  } catch (error) {
    console.error('❌ Failed to fetch user stats:', error);
    throw error;
  }
}
