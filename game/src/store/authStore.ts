import { create } from 'zustand';
import axiosInstance from '../services/api';
import { loginWithKakao, logoutWithKakao } from '../services/kakaoAuth';

export interface User {
  id: string;
  nickname: string;
  profileImage: string;
  totalGames: number;
  totalWins: number;
  totalPoints: number;
  currentStreak: number;
  eloRating: number;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;

  loginWithKakao: () => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  isLoading: false,
  error: null,

  loginWithKakao: async () => {
    set({ isLoading: true, error: null });
    try {
      // 1. Kakao 로그인
      const kakaoAuth = await loginWithKakao();

      // 2. 백엔드에 인증 토큰 전송
      const response = await axiosInstance.post('/auth/kakao/login', {
        kakaoAccessToken: kakaoAuth.access_token,
      });

      const { accessToken, user } = response.data;

      // 3. 토큰 저장
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('user', JSON.stringify(user));

      set({ user, accessToken, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Login failed';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await axiosInstance.post('/auth/logout');
      await logoutWithKakao();

      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');

      set({ user: null, accessToken: null, isLoading: false });
    } catch (error: any) {
      console.error('Logout error:', error);
      set({ user: null, accessToken: null, isLoading: false });
    }
  },

  fetchUser: async () => {
    set({ isLoading: true });
    try {
      const response = await axiosInstance.get('/auth/me');
      const user = response.data;

      localStorage.setItem('user', JSON.stringify(user));
      set({ user, isLoading: false });
    } catch (error: any) {
      console.error('Fetch user error:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      set({ user: null, accessToken: null, isLoading: false, error: 'Failed to fetch user' });
    }
  },

  setUser: (user: User) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Load user from localStorage on init
const savedUser = localStorage.getItem('user');
if (savedUser) {
  try {
    useAuthStore.setState({ user: JSON.parse(savedUser) });
  } catch (e) {
    console.error('Failed to parse saved user');
  }
}
