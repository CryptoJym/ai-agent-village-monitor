import { useState, useCallback } from 'react';
import type { User } from './useAuth';

// Development authentication bypass for testing
export function useDevAuth() {
  const [isDevMode] = useState(() => {
    // Check if we're in development mode and have E2E testing enabled
    return (
      import.meta.env.DEV &&
      (import.meta.env.VITE_E2E_TEST_MODE === 'true' || window.location.search.includes('dev-auth'))
    );
  });

  const loginAsDeveloper = useCallback(async (userId = 1, username = 'dev-user') => {
    if (!isDevMode) {
      console.warn('Development auth is not enabled');
      return false;
    }

    try {
      const response = await fetch(`/test/login/${userId}?username=${encodeURIComponent(username)}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        // Reload to trigger auth state update
        window.location.reload();
        return true;
      } else {
        console.error('Dev login failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Dev login error:', error);
      return false;
    }
  }, [isDevMode]);

  const createMockUser = useCallback((id = 1, username = 'dev-user'): User => {
    return {
      id,
      username,
      avatarUrl: `https://avatars.githubusercontent.com/u/${id}?v=4`,
    };
  }, []);

  return {
    isDevMode,
    loginAsDeveloper,
    createMockUser,
  };
}

// Development auth component for testing
export function DevAuthButton() {
  const { isDevMode, loginAsDeveloper } = useDevAuth();

  if (!isDevMode) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '16px',
      left: '16px',
      zIndex: 50,
      backgroundColor: '#fef3c7',
      border: '1px solid #fbbf24',
      borderRadius: '6px',
      padding: '8px'
    }}>
      <div style={{
        fontSize: '12px',
        color: '#92400e',
        marginBottom: '8px'
      }}>
        Development Mode
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => loginAsDeveloper(1, 'dev-user')}
          style={{
            backgroundColor: '#f59e0b',
            color: 'white',
            fontSize: '12px',
            padding: '4px 8px',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d97706'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f59e0b'}
        >
          Login as Dev User
        </button>
        <button
          onClick={() => loginAsDeveloper(2, 'admin-user')}
          style={{
            backgroundColor: '#d97706',
            color: 'white',
            fontSize: '12px',
            padding: '4px 8px',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b45309'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#d97706'}
        >
          Login as Admin
        </button>
      </div>
    </div>
  );
}