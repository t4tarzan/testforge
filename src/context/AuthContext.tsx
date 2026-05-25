import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

import { fetchCurrentUser, logoutUser, type CurrentUser } from '@/lib/api';
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
  loginWithGitHub: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Translates the /api/auth/me payload into the shape the rest of the UI uses.
function toUser(me: CurrentUser): User {
  const plan = (me.plan || 'free') as UserPlan;
  const creditsTotal = plan === 'pro' ? 100 : plan === 'enterprise' ? 9999 : 5;
  return {
    id: me.id,
    name: me.name || me.login,
    email: me.email || `${me.login}@github`,
    avatar: (me.login || 'GH').substring(0, 2).toUpperCase(),
    plan,
    creditsUsed: 0,
    creditsTotal,
    testsRun: me.testsRun ?? 0,
    passRate: 0,
    repos: 0,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Single source of truth: the session cookie. Hydrate by calling /me.
  const refresh = useCallback(async () => {
    try {
      const me = await fetchCurrentUser();
      if (me) {
        setState({ user: toUser(me), isAuthenticated: true, isLoading: false });
      } else {
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // GitHub OAuth — top-level navigation. The callback sets the session
  // cookie and redirects to /#/account; the effect below picks that up.
  const loginWithGitHub = useCallback(() => {
    window.location.href = '/api/auth/callback';
  }, []);

  // After the OAuth redirect lands on /#/account, re-hydrate from /me so
  // we pick up the cookie that was just set.
  useEffect(() => {
    if (window.location.hash.startsWith('#/account')) {
      void refresh();
    }
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // ignore — we still clear local state below
    }
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, loginWithGitHub, logout, refresh }}>
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
