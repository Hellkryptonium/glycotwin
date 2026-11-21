import { create } from 'zustand';
import type { BrowserSession, SafeUser } from '../types/api';

interface AuthState {
  accessToken: string | null;
  sessionExpiresAt: string | null;
  user: SafeUser | null;
  status: 'restoring' | 'authenticated' | 'signedOut' | 'unavailable';
  setSession: (session: BrowserSession) => void;
  setUser: (user: SafeUser) => void;
  markUnavailable: () => void;
  resetForRestore: () => void;
  clear: () => void;
}

const emptySession = { accessToken: null, sessionExpiresAt: null, user: null };

export const useAuthStore = create<AuthState>((set) => ({
  ...emptySession,
  status: 'restoring',
  setSession: ({ accessToken, sessionExpiresAt, user }) => set((previous) => ({
    accessToken,
    sessionExpiresAt,
    user: user ?? previous.user,
    status: 'authenticated',
  })),
  setUser: (user) => set({ user }),
  markUnavailable: () => set({ status: 'unavailable', accessToken: null }),
  resetForRestore: () => set({ ...emptySession, status: 'restoring' }),
  clear: () => set({ ...emptySession, status: 'signedOut' }),
}));
