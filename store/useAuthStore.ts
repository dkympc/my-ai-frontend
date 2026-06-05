import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  userRole: string;
  isAuthChecking: boolean;
  setIsAuthenticated: (val: boolean) => void;
  setUserRole: (role: string) => void;
  setIsAuthChecking: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  userRole: 'user',
  isAuthChecking: true,
  setIsAuthenticated: (val) => set({ isAuthenticated: val }),
  setUserRole: (role) => set({ userRole: role }),
  setIsAuthChecking: (val) => set({ isAuthChecking: val }),
}));