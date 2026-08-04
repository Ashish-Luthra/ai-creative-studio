/**
 * Auth context: token, workspace, user id, roles, and login/logout/OAuth2.
 *
 * Provides isAuthenticated, workspaceId, userId, roles to the app. Handles token
 * from URL (OAuth2 callback), localStorage, and refresh; clears token on 401 and
 * invokes apiClient.setOnTokenExpired for redirect. Used by layout and protected routes.
 */
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { apiClient } from '../../lib/api-client';
import {
  extractTokenFromUrl,
  isTokenExpired,
  getTokenExpiration,
  initiateOAuth2Login as startOAuth2Login,
} from '../../lib/oauth2';

/**
 * Auth context value: token, workspace, user, roles, and auth actions.
 *
 * @property token - JWT or null.
 * @property workspaceId - Current workspace ID or null.
 * @property userId - Current user ID or null.
 * @property roles - User roles in the current workspace.
 * @property isAuthenticated - True when token is present and not expired.
 * @property login - Set token and decode workspace/user/roles.
 * @property logout - Clear token and auth state.
 * @property setWorkspace - Switch current workspace.
 * @property initiateOAuth2Login - Redirect to OAuth2 provider.
 * @property authReady - True after initial hydration from URL/localStorage; avoid redirecting before this.
 */
interface AuthContextType {
  token: string | null;
  workspaceId: string | null;
  userId: string | null;
  roles: string[];
  isAuthenticated: boolean;
  /** False until token has been read from URL or localStorage; use to avoid flash/redirect before hydration. */
  authReady: boolean;
  login: (token: string) => void;
  logout: () => void;
  setWorkspace: (workspaceId: string) => void;
  initiateOAuth2Login: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_WORKSPACE = 'martechos_selected_workspace_id';

/**
 * Provides auth state and actions to the tree. Call useAuth() in children to access.
 * Handles token from URL (callback), localStorage, and refresh timer.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);

  const login = useCallback((newToken: string) => {
    try {
      // Validate token format
      const parts = newToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format: Expected JWT with 3 parts');
      }

      // Decode and validate token
      let payload;
      try {
        payload = JSON.parse(atob(newToken.split('.')[1]));
      } catch (e) {
        throw new Error('Invalid token format: Cannot decode payload');
      }

      // Check if token is expired
      if (isTokenExpired(newToken)) {
        throw new Error('Token is expired');
      }

      console.log('Login: Token validated, setting auth state...', {
        userId: payload.sub,
        workspaceId: payload.workspaceId,
        issuer: payload.iss || 'none',
        exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'no expiration',
      });

      setToken(newToken);
      setWorkspaceId(payload.workspaceId || null);
      setUserId(payload.sub || null);
      // Extract roles from JWT (if present) - database is authoritative but JWT can be used for UI hints
      setRoles(Array.isArray(payload.roles) ? payload.roles : []);
      apiClient.setToken(newToken);
    } catch (e) {
      console.error('Login failed:', e);
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    // Capture token before clearing so we can send it with the logout request
    const currentToken = token;

    // Clear local state
    setToken(null);
    setRoles([]);
    setWorkspaceId(null);
    setUserId(null);
    apiClient.setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem(STORAGE_KEY_WORKSPACE);

    // Call logout endpoint with the captured token
    if (currentToken) {
      try {
        await apiClient.post('/v1/auth/logout', undefined, {
          headers: { Authorization: `Bearer ${currentToken}` },
        });
      } catch (e) {
        // Ignore logout errors - we've already cleared local state
        console.warn('Logout API call failed (ignored):', e);
      }
    }
  }, [token]);

  // Handle OAuth2 callback and hydrate from localStorage on mount
  useEffect(() => {
    // Set up token expired callback for API client
    apiClient.setOnTokenExpired(() => {
      console.warn('Token expired during API call, logging out...');
      logout();
    });

    // Check for token in URL (OAuth2 callback)
    const { token: urlToken, error } = extractTokenFromUrl();
    
    if (error) {
      console.error('OAuth2 error:', error);
      setAuthReady(true);
      return;
    }

    if (urlToken) {
      // Token from OAuth2 callback
      console.log('OAuth2 callback: Token received, attempting login...');
      try {
        login(urlToken);
        console.log('OAuth2 callback: Login successful');
      } catch (e) {
        console.error('OAuth2 callback: Failed to login with token from URL:', e);
        localStorage.removeItem('auth_token');
      }
      setAuthReady(true);
      return;
    }

    // Load token from localStorage on mount
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      try {
        if (isTokenExpired(savedToken)) {
          console.warn('Stored token is expired, clearing...');
          localStorage.removeItem('auth_token');
          setAuthReady(true);
          return;
        }

        const parts = savedToken.split('.');
        if (parts.length !== 3) {
          console.warn('Stored token has invalid format, clearing...');
          localStorage.removeItem('auth_token');
          setAuthReady(true);
          return;
        }

        const payload = JSON.parse(atob(parts[1]));
        if (!payload.iss) {
          console.warn('Stored token missing issuer claim, clearing. Please log in again.');
          localStorage.removeItem('auth_token');
          setAuthReady(true);
          return;
        }

        setToken(savedToken);
        const tokenWorkspaceId = payload.workspaceId || null;
        const savedWorkspaceId = localStorage.getItem(STORAGE_KEY_WORKSPACE);
        setWorkspaceId(savedWorkspaceId || tokenWorkspaceId);
        setUserId(payload.sub || null);
        const rolesFromToken = Array.isArray(payload.roles) ? payload.roles : [];
        const roles =
          process.env.NODE_ENV !== 'production' && !rolesFromToken.includes('admin')
            ? [...rolesFromToken, 'admin']
            : rolesFromToken.length > 0
              ? rolesFromToken
              : process.env.NODE_ENV !== 'production'
                ? ['admin']
                : [];
        setRoles(roles);
        apiClient.setToken(savedToken);
        console.log('Loaded token from storage:', {
          userId: payload.sub,
          workspaceId: payload.workspaceId,
          issuer: payload.iss,
        });
      } catch (e) {
        console.error('Invalid token format:', e);
        localStorage.removeItem('auth_token');
      }
    }
    setAuthReady(true);
  }, [login, logout]);

  // Set up token expiration check
  useEffect(() => {
    if (!token) return;

    const expirationTime = getTokenExpiration(token);
    if (!expirationTime) return;

    const now = Date.now();
    const timeUntilExpiration = expirationTime - now - 5 * 60 * 1000; // 5 min buffer

    if (timeUntilExpiration <= 0) {
      // Token already expired or about to expire
      console.warn('Token expired, logging out...');
      logout();
      return;
    }

    // Set timeout to check token expiration
    const timeoutId = setTimeout(() => {
      if (isTokenExpired(token)) {
        console.warn('Token expired, logging out...');
        logout();
      }
    }, timeUntilExpiration);

    return () => clearTimeout(timeoutId);
  }, [token, logout]);

  const setWorkspace = useCallback((newWorkspaceId: string) => {
    setWorkspaceId(newWorkspaceId);
    localStorage.setItem(STORAGE_KEY_WORKSPACE, newWorkspaceId);
  }, []);

  const initiateOAuth2Login = useCallback(() => {
    startOAuth2Login();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        workspaceId,
        userId,
        isAuthenticated: !!token,
        authReady,
        roles,
        login,
        logout,
        setWorkspace,
        initiateOAuth2Login,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

