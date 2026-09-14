'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { User, AuthContextType } from '@/types/auth';
import { STORAGE_KEYS } from '@/utils/constants';
import { supabase } from '@/lib/supabase';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const bridgedRef = useRef(false);

  const login = useCallback(async (userData: Omit<User, 'loginTime'>) => {
    // Phase 2: the server binds this identity to an HMAC-signed HttpOnly
    // cookie (/api/session). The cookie is no longer forgeable client-side.
    // Credential verification itself is still demo-grade (any identity
    // accepted) until the Supabase Auth cutover — see STABILIZATION_REPORT.
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userData.id, email: userData.email, username: userData.username }),
    });
    if (!res.ok) {
      throw new Error("Failed to establish server session");
    }
    const newUser: User = {
      ...userData,
      loginTime: Date.now(),
    };
    // Local copy drives UI only; authority is the HttpOnly server cookie.
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
    setUser(newUser);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      let hasLocal = false;
      try {
        // 1. Local app session (drives UI; authority is the HttpOnly cookie).
        const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
        if (storedUser) {
          if (alive) setUser(JSON.parse(storedUser));
          hasLocal = true;
        }
      } catch (error) {
        console.error('Failed to parse user from localStorage', error);
      }
      if (!hasLocal && !bridgedRef.current) {
        bridgedRef.current = true;
        // 2. Supabase OAuth bridge: a completed Google/GitHub flow lands here
        // with a Supabase session but no app session yet. getUser() validates
        // server-side; the returned identity is then bound via login() below.
        try {
          const { data, error } = await supabase.auth.getUser();
          const su = error ? null : data.user;
          if (alive && su?.email) {
            await login({
              id: su.id,
              email: su.email,
              username: (
                (su.user_metadata?.name as string | undefined) ??
                (su.user_metadata?.user_name as string | undefined) ??
                su.email.split('@')[0]
              ).slice(0, 64),
              avatar: (su.user_metadata?.avatar_url as string | undefined) ?? (su.user_metadata?.picture as string | undefined),
            });
          }
        } catch (error) {
          console.error('Supabase session bridge failed', error);
        }
      }
      if (alive) setIsLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [login]);

  const logout = async () => {
    try {
      await fetch("/api/session", { method: "DELETE" });
    } catch {
      // Best effort: still clear local state below.
    }
    try {
      // Otherwise the next page load would silently bridge back in.
      await supabase.auth.signOut();
    } catch {
      // Best effort.
    }
    // Clear legacy unsigned cookie (pre-Phase-2 clients wrote it via JS).
    document.cookie = `interveai_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    setUser(null);
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
