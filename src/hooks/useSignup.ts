/**
 * React Query hooks for signup: role selection, email-password auth, OAuth/SSO start,
 * and result resolution.
 *
 * **Routes:** POST /v1/signup/role-selection, POST /v1/signup/auth/email-password,
 * POST /v1/signup/auth/oauth/start, POST /v1/signup/auth/sso/start, GET /v1/signup/result
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type {
  SignupRoleSelectionRequest,
  SignupRoleSelectionResponse,
  SignupEmailPasswordRequest,
  SignupOAuthStartRequest,
  SignupSSOStartRequest,
  OAuthStartResponse,
  SignupResult,
} from '../types/signup-onboarding';

/**
 * Creates or updates the signup role selection (brand/agency); returns signupSessionId.
 *
 * Call when the user selects account type on the signup flow. Uses idempotency for
 * duplicate submissions. The response signupSessionId is used for subsequent steps
 * (e.g. email-password auth, onboarding session create).
 *
 * **Route:** POST /v1/signup/role-selection
 *
 * @returns Mutation. Invoke with SignupRoleSelectionRequest. On success, data is SignupRoleSelectionResponse (includes signupSessionId).
 */
export function useSignupRoleSelection() {
  return useMutation({
    mutationKey: ['signup', 'role-selection'],
    mutationFn: async (payload: SignupRoleSelectionRequest) => {
      const idempotencyKey = crypto.randomUUID();
      return apiClient.post<SignupRoleSelectionResponse>(
        '/v1/signup/role-selection',
        payload,
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
    },
  });
}

/**
 * Signs up with email and password; returns SignupResult (tokens, user, signupSessionId).
 *
 * Call when the user submits the email/password signup form. Uses idempotency.
 * On success, store the token and redirect to onboarding or dashboard as needed.
 *
 * **Route:** POST /v1/signup/auth/email-password
 *
 * @returns Mutation. Invoke with SignupEmailPasswordRequest. On success, data is SignupResult.
 */
export function useSignupEmailPassword() {
  return useMutation({
    mutationKey: ['signup', 'email-password'],
    mutationFn: async (payload: SignupEmailPasswordRequest) => {
      const idempotencyKey = crypto.randomUUID();
      return apiClient.post<SignupResult>('/v1/signup/auth/email-password', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
    },
  });
}

/**
 * Starts the Google/Microsoft OAuth flow; returns the provider redirect URL.
 *
 * Call when the user clicks "Continue with Google" (or Microsoft). On success,
 * navigate the browser to data.redirectUrl. After the provider round-trip the
 * backend redirects back and the result is resolved via useSignupResult.
 *
 * **Route:** POST /v1/signup/auth/oauth/start
 *
 * @returns Mutation. Invoke with SignupOAuthStartRequest. On success, data is OAuthStartResponse.
 */
export function useSignupOAuthStart() {
  return useMutation({
    mutationKey: ['signup', 'oauth-start'],
    mutationFn: async (payload: SignupOAuthStartRequest) => {
      const idempotencyKey = crypto.randomUUID();
      return apiClient.post<OAuthStartResponse>('/v1/signup/auth/oauth/start', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
    },
  });
}

/**
 * Starts the SSO flow; returns the IdP redirect URL.
 *
 * Call when the user clicks "Continue with SSO". On success, navigate the browser
 * to data.redirectUrl. After the IdP round-trip the backend redirects back and the
 * result is resolved via useSignupResult.
 *
 * **Route:** POST /v1/signup/auth/sso/start
 *
 * @returns Mutation. Invoke with SignupSSOStartRequest. On success, data is OAuthStartResponse.
 */
export function useSignupSSOStart() {
  return useMutation({
    mutationKey: ['signup', 'sso-start'],
    mutationFn: async (payload: SignupSSOStartRequest) => {
      const idempotencyKey = crypto.randomUUID();
      return apiClient.post<OAuthStartResponse>('/v1/signup/auth/sso/start', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
    },
  });
}

/**
 * Resolves signup result after OAuth/SSO callback (e.g. redirect with session id).
 *
 * Use when returning from an external auth provider to get tokens and user info.
 * When signupSessionId is null the query does not run. Poll or refetch as needed
 * until the backend has completed the OAuth flow.
 *
 * **Route:** GET /v1/signup/result?signupSessionId=
 *
 * @param signupSessionId - Signup session ID from URL or context; null disables the query.
 * @returns React Query result: data is SignupResult (tokens, user, etc.) when ready.
 */
export function useSignupResult(signupSessionId: string | null) {
  return useQuery({
    queryKey: ['signup', 'result', signupSessionId],
    queryFn: async () => {
      if (!signupSessionId) throw new Error('Missing signupSessionId');
      return apiClient.get<SignupResult>(
        `/v1/signup/result?signupSessionId=${encodeURIComponent(signupSessionId)}`
      );
    },
    enabled: !!signupSessionId,
  });
}
