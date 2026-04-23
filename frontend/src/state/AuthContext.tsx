import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  login: (tokens: { accessToken: string; refreshToken: string }) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

function isJwtExpired(token: string | null): boolean {
  if (!token) {
    return true;
  }

  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const decoded = JSON.parse(window.atob(base64)) as { exp?: number };
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 <= Date.now() : true;
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    const token = localStorage.getItem('accessToken');
    return isJwtExpired(token) ? null : token;
  });
  const [refreshToken, setRefreshToken] = useState<string | null>(() => {
    const token = localStorage.getItem('refreshToken');
    return isJwtExpired(token) ? null : token;
  });

  useEffect(() => {
    if (accessToken) localStorage.setItem('accessToken', accessToken);
    else localStorage.removeItem('accessToken');

    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    else localStorage.removeItem('refreshToken');
  }, [accessToken, refreshToken]);

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config as { _retry?: boolean } | undefined;
        const requestUrl = String(originalRequest?.url ?? '');
        if (requestUrl.includes('/auth/refresh')) {
          return Promise.reject(error);
        }

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry && refreshToken) {
          originalRequest._retry = true;
          try {
            const response = await api.post('/auth/refresh', { refreshToken });
            setAccessToken(response.data.accessToken);
            setRefreshToken(response.data.refreshToken);
            return api(originalRequest as never);
          } catch {
            setAccessToken(null);
            setRefreshToken(null);
            return Promise.reject(error);
          }
        }
        return Promise.reject(error);
      },
    );

    return () => api.interceptors.response.eject(interceptor);
  }, [refreshToken]);

  const value = useMemo<AuthState>(
    () => ({
      accessToken,
      refreshToken,
      login: (tokens) => {
        setAccessToken(tokens.accessToken);
        setRefreshToken(tokens.refreshToken);
      },
      logout: () => {
        setAccessToken(null);
        setRefreshToken(null);
      },
    }),
    [accessToken, refreshToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
