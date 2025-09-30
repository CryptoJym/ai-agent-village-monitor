import { useEffect, useState, useContext } from 'react';

export interface User {
  id: number;
  username: string;
  avatarUrl?: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

// Create a context for authentication state
import { createContext } from 'react';

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for auth state management
export function useAuthState(): AuthState & {
  login: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  checkAuth: () => Promise<void>;
} {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else if (response.status === 401) {
        // Try to refresh the token
        await refresh();
      } else {
        setUser(null);
        setError('Authentication check failed');
      }
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    try {
      const response = await fetch('/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // After successful refresh, check auth again
        await checkAuth();
      } else {
        setUser(null);
        setError('Token refresh failed');
      }
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : 'Token refresh error');
    }
  };

  const login = () => {
    // Redirect to GitHub OAuth login
    window.location.href = '/auth/login';
  };

  const logout = async () => {
    try {
      setLoading(true);
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logout error');
    } finally {
      setLoading(false);
    }
  };

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Set up automatic token refresh
  useEffect(() => {
    if (!user) return;

    // Refresh token every 50 minutes (access token expires in 1 hour)
    const refreshInterval = setInterval(() => {
      refresh();
    }, 50 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [user]);

  return {
    user,
    loading,
    error,
    login,
    logout,
    refresh,
    checkAuth,
  };
}