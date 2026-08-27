import { create } from 'zustand';
import {
  getGlobalLeaderboard,
  getWeeklyLeaderboard,
  getMyRank,
  LeaderboardEntry,
} from '../services/leaderboardService';

export interface LeaderboardState {
  globalLeaderboard: LeaderboardEntry[];
  weeklyLeaderboard: LeaderboardEntry[];
  myRank: number;
  myPoints: number;
  myPercentile: number;
  isLoading: boolean;
  error: string | null;

  fetchGlobalLeaderboard: (limit?: number, offset?: number) => Promise<void>;
  fetchWeeklyLeaderboard: (limit?: number) => Promise<void>;
  fetchMyRank: () => Promise<void>;
  clearError: () => void;
}

export const useLeaderboardStore = create<LeaderboardState>((set) => ({
  globalLeaderboard: [],
  weeklyLeaderboard: [],
  myRank: 0,
  myPoints: 0,
  myPercentile: 0,
  isLoading: false,
  error: null,

  fetchGlobalLeaderboard: async (limit = 100, offset = 0) => {
    set({ isLoading: true, error: null });
    try {
      const data = await getGlobalLeaderboard(limit, offset);
      set({ globalLeaderboard: data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch leaderboard', isLoading: false });
    }
  },

  fetchWeeklyLeaderboard: async (limit = 100) => {
    set({ isLoading: true, error: null });
    try {
      const data = await getWeeklyLeaderboard(limit);
      set({ weeklyLeaderboard: data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch weekly leaderboard', isLoading: false });
    }
  },

  fetchMyRank: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await getMyRank();
      set({
        myRank: data.rank,
        myPoints: data.totalPoints,
        myPercentile: data.percentile,
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch rank', isLoading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
