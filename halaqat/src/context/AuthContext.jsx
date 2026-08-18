import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => authService.getStoredSession());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // قراءة الجلسة المخزنة مرة واحدة عند الإقلاع.
    setSession(authService.getStoredSession());
    setReady(true);
  }, []);

  // مزامنة الجلسة بين تبويبات المتصفح (تسجيل خروج في تبويب = خروج في الكل).
  useEffect(() => {
    const handler = (event) => {
      if (event.key && !event.key.includes('session')) return;
      setSession(authService.getStoredSession());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const signIn = useCallback((newSession) => {
    setSession(newSession);
    return newSession;
  }, []);

  const signOut = useCallback(async () => {
    await authService.logout();
    setSession(null);
  }, []);

  const switchRole = useCallback(async (role) => {
    const next = await authService.switchRole(role);
    setSession(next);
    return next;
  }, []);

  const updateSession = useCallback((changes) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...changes };
      authService.persistSession(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session,
      role: session?.role ?? null,
      isAuthenticated: Boolean(session),
      ready,
      signIn,
      signOut,
      switchRole,
      updateSession,
    }),
    [session, ready, signIn, signOut, switchRole, updateSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth يجب استخدامه داخل AuthProvider');
  return ctx;
}
