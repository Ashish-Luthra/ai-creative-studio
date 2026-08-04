/**
 * OAuth2 client helpers for the MartechOS auth flow.
 *
 * Handles redirect to the OAuth2 provider (authorization URL, state for CSRF),
 * extraction of token/error from callback URL, and JWT expiration checks.
 * Used by the login page and auth callback route. Configuration via
 * NEXT_PUBLIC_OAUTH2_* env vars.
 */

const OAUTH2_AUTHORIZATION_URL =
  process.env.NEXT_PUBLIC_OAUTH2_AUTHORIZATION_URL || 'http://localhost:54444/oauth2/auth';
const OAUTH2_CLIENT_ID = process.env.NEXT_PUBLIC_OAUTH2_CLIENT_ID || '2b35eafb-57e9-478b-a1aa-40fcaaa93665';
const OAUTH2_CALLBACK_URL =
  process.env.NEXT_PUBLIC_OAUTH2_CALLBACK_URL || 'http://localhost:58000/v1/auth/callback';
// Scopes should be space-separated per OAuth2 spec. Accept comma- or space-separated env values.
const OAUTH2_SCOPES = process.env.NEXT_PUBLIC_OAUTH2_SCOPES || 'openid profile email';

/**
 * Generate a random state string for CSRF protection
 */
function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Stores state in sessionStorage for validation after redirect.
 * @internal
 */
function storeState(state: string): void {
  sessionStorage.setItem('oauth2_state', state);
}

/**
 * Gets and clears state from sessionStorage (one-time use).
 * @internal
 */
function getAndClearState(): string | null {
  const state = sessionStorage.getItem('oauth2_state');
  if (state) {
    sessionStorage.removeItem('oauth2_state');
  }
  return state;
}

/**
 * Validates the state parameter from the OAuth2 callback against stored state (CSRF check).
 *
 * @param state - State query param from the callback URL.
 * @returns True if state matches stored value (and clears it); false otherwise.
 */
export function validateState(state: string | null): boolean {
  const storedState = getAndClearState();
  return storedState !== null && storedState === state;
}

/**
 * Normalizes scopes to space-separated format per OAuth2 spec.
 * @internal
 */
function normalizeScopes(scopes: string): string {
  if (scopes.includes(',')) {
    return scopes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' ');
  }
  return scopes;
}

/**
 * Initiates the OAuth2 authorization flow by redirecting to the provider.
 *
 * Generates and stores a state value for CSRF protection, then sets
 * window.location to the authorization URL with client_id, redirect_uri,
 * scope, and state. The user is redirected away from the app.
 */
export function initiateOAuth2Login(): void {
  const state = generateState();
  storeState(state);

  // Normalize scopes to space-separated format (OAuth2 spec requirement)
  const scopeParam = normalizeScopes(OAUTH2_SCOPES);

  const params = new URLSearchParams({
    client_id: OAUTH2_CLIENT_ID,
    redirect_uri: OAUTH2_CALLBACK_URL,
    response_type: 'code',
    scope: scopeParam,
    state,
  });

  const authorizationUrl = `${OAUTH2_AUTHORIZATION_URL}?${params.toString()}`;
  window.location.href = authorizationUrl;
}

/**
 * Extracts token or error from the current URL query (after OAuth2 callback).
 *
 * Cleans the URL (removes query params) if token or error is present so the
 * callback page does not leave sensitive data in the address bar.
 *
 * @returns Object with token (if present) and error (if present); one may be null.
 */
export function extractTokenFromUrl(): { token: string | null; error: string | null } {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const error = params.get('error');

  // Clean up URL by removing query parameters
  if (token || error) {
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  return { token, error };
}

/**
 * Checks whether a JWT token is expired (or within 5 minutes of expiry).
 *
 * @param token - JWT string (e.g. from callback or storage).
 * @returns True if token is expired or unparseable, false if still valid.
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp;
    if (!exp) {
      return false; // No expiration claim, assume valid
    }
    const expirationTime = exp * 1000; // Convert to milliseconds
    const now = Date.now();
    // Add 5 minute buffer to refresh before actual expiration
    return now >= expirationTime - 5 * 60 * 1000;
  } catch (e) {
    console.error('Failed to parse token:', e);
    return true; // If we can't parse, assume expired
  }
}

/**
 * Returns the JWT expiration timestamp in milliseconds (Unix ms), or null if missing/unparseable.
 *
 * @param token - JWT string.
 * @returns Expiration time in ms, or null.
 */
export function getTokenExpiration(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp;
    if (!exp) {
      return null;
    }
    return exp * 1000; // Convert to milliseconds
  } catch (e) {
    console.error('Failed to parse token:', e);
    return null;
  }
}

