// Auth store — Zustand-based, persists token across app restarts
import type { User, UserRole } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { api } from './api';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const BIOMETRIC_KEY = 'biometric_enabled';

interface AuthState {
  role: UserRole;
  token: string | null;
  user: User | null;
  email: string;
  biometricEnabled: boolean;
  setRole: (role: UserRole) => void;
  setEmail: (email: string) => void;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  loadBiometricEnabled: () => Promise<void>;
  setSession: (token: string, user: User) => Promise<void>;
  setUser: (user: User | null) => void;
  /** Updates the profile photo on the current user and in the saved session. */
  setAvatarUrl: (avatarUrl: string | null) => Promise<void>;
  /** Restores a saved session from storage. Returns the user if one exists. */
  restoreSession: () => Promise<User | null>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  role: 'user',
  token: null,
  user: null,
  email: '',
  biometricEnabled: true,

  setRole: (role) => set({ role }),
  setEmail: (email) => set({ email }),

  setBiometricEnabled: async (enabled) => {
    set({ biometricEnabled: enabled });
    await AsyncStorage.setItem(BIOMETRIC_KEY, enabled ? 'true' : 'false');
  },

  loadBiometricEnabled: async () => {
    const stored = await AsyncStorage.getItem(BIOMETRIC_KEY);
    set({ biometricEnabled: stored !== 'false' });
  },

  setSession: async (token, user) => {
    set({ token, user, role: user.role });
    api.setMemToken(token);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [USER_KEY, JSON.stringify(user)],
    ]);
  },

  setUser: (user) => set({ user, role: user ? user.role : 'user' }),

  setAvatarUrl: async (avatarUrl) => {
    const current = get().user;
    if (!current) return;
    const updated: User = { ...current, avatarUrl: avatarUrl ?? undefined };
    set({ user: updated });
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
  },

  restoreSession: async () => {
    const [[, token], [, userJson]] = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
    if (!token || !userJson) return null;
    try {
      const user = JSON.parse(userJson) as User;
      set({ token, user, role: user.role });
      api.setMemToken(token);
      return user;
    } catch {
      return null;
    }
  },

  logout: async () => {
    set({ token: null, user: null, role: 'user' });
    await api.clearToken();
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  },
}));

// Imperative helpers for non-component code
export const AuthStore = {
  getRole: () => useAuthStore.getState().role,
  getEmail: () => useAuthStore.getState().email,
  setEmail: (email: string) => useAuthStore.getState().setEmail(email),
  getToken: () => useAuthStore.getState().token,
  getUser: () => useAuthStore.getState().user,
  setUser: (user: User | null) => useAuthStore.getState().setUser(user),
  setAvatarUrl: (avatarUrl: string | null) => useAuthStore.getState().setAvatarUrl(avatarUrl),
  setSession: (token: string, user: User) => useAuthStore.getState().setSession(token, user),
  restoreSession: () => useAuthStore.getState().restoreSession(),
  logout: () => useAuthStore.getState().logout(),
  getBiometricEnabled: () => useAuthStore.getState().biometricEnabled,
  setBiometricEnabled: (enabled: boolean) => useAuthStore.getState().setBiometricEnabled(enabled),
  loadBiometricEnabled: () => useAuthStore.getState().loadBiometricEnabled(),
};