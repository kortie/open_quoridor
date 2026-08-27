import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';

export const LoginButton: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const loginWithKakao = useAuthStore((state) => state.loginWithKakao);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithKakao();
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogin}
      disabled={isLoading}
      className="px-6 py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-400 text-black font-semibold rounded-lg transition-all"
    >
      {isLoading ? '로그인 중...' : '🍯 카카오로 시작'}
    </button>
  );
};
