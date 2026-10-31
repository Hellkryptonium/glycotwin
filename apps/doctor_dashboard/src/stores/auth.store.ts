import { create } from 'zustand';
import type { SafeUser, Tokens } from '../types/api';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: SafeUser | null;
  setTokens: (tokens: Tokens) => void;
  setUser: (user: SafeUser | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
  setUser: (user) => set({ user }),
  clear: () => set({ accessToken: null, refreshToken: null, user: null }),
}));