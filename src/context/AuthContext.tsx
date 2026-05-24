import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

import { loginUser } from '@/lib/api';
import type { UserPlan } from '@/data/seedData';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  plan: UserPlan;
  creditsUsed: number;
  creditsTotal: number;
  testsRun: number;
  passRate: number;
  repos: number;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  loginWithGitHub: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'testforge_auth';

const DEMO_USER: User = {
  id: 'usr_123',
  name: 'Alex Chen',
  email: 'alex@example.com',
  avatar: 'AC',
  plan: 'standard',
  creditsUsed: 1247,
  creditsTotal: 2000,
  testsRun: 47,
  passRate: 82,
  repos: 5,
};

function loadAuthFromStorage(): AuthState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.user) {
        return {
          user: parsed.user as User,
          isAuthenticated: true,
          isLoading: false,
        };
      }
    }
  } catch {
    // ignore
  }
  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isAuthenticated: false, isLoading: true });

  useEffect(() => {
    const saved = loadAuthFromStorage();
    setState(saved);
    // Small delay to simulate auth check
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, isLoading: false }));
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      // Try API first
      const { user: apiUser } = await loginUser(email, password);
      const user: User = {
        ...apiUser,
        plan: apiUser.plan as UserPlan,
      };
      const newState: AuthState = { user, isAuthenticated: true, isLoading: false };
      setState(newState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user }));
    } catch {
      // Fallback to demo user
      await new Promise((resolve) => setTimeout(resolve, 500));
      const newState: AuthState = {
        user: { ...DEMO_USER, email },
        isAuthenticated: true,
        isLoading: false,
      };
      setState(newState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: { ...DEMO_USER, email } }));
    }
  }, []);

  // GitHub OAuth redirect
  const loginWithGitHub = useCallback(() => {
    window.location.href = '/api/auth/callback';
  }, []);

  // Handle GitHub OAuth callback (user data in URL hash)
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const match = hash.match(/github_user=([^&]+)/);
    if (!match) return;
    try {
      const githubUser = JSON.parse(decodeURIComponent(match[1]));
      const user: User = {
        id: githubUser.id,
        name: githubUser.name,
        email: githubUser.email,
        avatar: githubUser.login?.substring(0, 2).toUpperCase() || 'GH',
        plan: 'standard',
        creditsUsed: 0, creditsTotal: 2000, testsRun: 0, passRate: 0, repos: 0,
      };
      setState({ user, isAuthenticated: true, isLoading: false });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user }));
      window.history.replaceState(null, '', '/#/account');
    } catch {}
  }, []);

  const logout = useCallback(() => {
    setState({ user: null, isAuthenticated: false, isLoading: false });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, loginWithGitHub, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
