import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { clearToken, getToken, setToken, setUnauthorizedHandler } from '@/lib/api';
import { fetchMe, login as loginRequest } from './api';
import type { AdminUser } from './types';

interface AuthContextValue {
  user: AdminUser | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setStatus('unauthenticated');
      return;
    }
    fetchMe()
      .then((me) => {
        if (me.role !== 'admin') {
          logout();
          return;
        }
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => logout());
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const { user: loggedInUser, session } = await loginRequest(email, password);
    setToken(session.access_token);
    setUser(loggedInUser);
    setStatus('authenticated');
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
