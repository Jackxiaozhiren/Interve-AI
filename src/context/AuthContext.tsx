'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthContextType } from '@/types/auth';
import { STORAGE_KEYS } from '@/utils/constants';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
      if (storedUser) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Failed to parse user from localStorage', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (userData: Omit<User, 'loginTime'>) => {
    try {
      const newUser: User = {
        ...userData,
        loginTime: Date.now(),
      };
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      document.cookie = `interveai_user=${encodeURIComponent(JSON.stringify(newUser))}; path=/; max-age=86400; SameSite=Lax`;
      setUser(newUser);
    } catch (error) {
      console.error('Failed to save user to localStorage', error);
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      document.cookie = `interveai_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      setUser(null);
    } catch (error) {
      console.error('Failed to remove user from localStorage', error);
    }
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
