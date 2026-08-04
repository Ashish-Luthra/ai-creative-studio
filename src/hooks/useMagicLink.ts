/**
 * React Query hooks for magic-link (passwordless) login.
 *
 * Request: POST /v1/auth/magic-link/request — emails a one-time login link;
 * always resolves "sent" (the backend never reveals whether an account exists).
 * Verify: POST /v1/auth/magic-link/verify — consumes the single-use token from
 * the link and returns the app JWT + nextStep for routing.
 */

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type {
  MagicLinkRequest,
  MagicLinkRequestResult,
  MagicLinkVerifyRequest,
  MagicLinkVerifyResult,
} from '../types/signup-onboarding';

/**
 * Sends a magic login link to an email address.
 *
 * Used by the login screen's email step (and its Resend action). Success only
 * means the request was accepted — delivery is asynchronous and account
 * existence is never revealed.
 *
 * **Route:** POST /v1/auth/magic-link/request
 */
export function useRequestMagicLink() {
  return useMutation({
    mutationKey: ['magic-link', 'request'],
    // navigator.onLine misreports on some networks (and headless browsers); the
    // default 'online' networkMode would silently pause the mutation forever.
    networkMode: 'always',
    mutationFn: async (payload: MagicLinkRequest) => {
      const idempotencyKey = crypto.randomUUID();
      return apiClient.post<MagicLinkRequestResult>('/v1/auth/magic-link/request', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
    },
  });
}

/** One shared verify promise per token (module scope, survives remounts). */
const verifyInflight = new Map<string, Promise<MagicLinkVerifyResult>>();

/**
 * Verifies a magic-link token from the emailed link — exactly once per token.
 *
 * Used by the /auth/magic/callback page. On success, callers pass the returned
 * JWT to AuthContext.login and route by nextStep.
 *
 * Deliberately NOT a useMutation: the token is single-use, and React 18
 * StrictMode's simulated remount detaches a component-bound mutation observer
 * mid-flight (freezing the UI at "pending" and dropping callbacks). A
 * module-level shared promise verifies once no matter how often the callback
 * component mounts, and every mount can await the same result.
 *
 * **Route:** POST /v1/auth/magic-link/verify
 */
export function verifyMagicLinkOnce(token: string): Promise<MagicLinkVerifyResult> {
  let promise = verifyInflight.get(token);
  if (!promise) {
    const payload: MagicLinkVerifyRequest = { token };
    promise = apiClient.post<MagicLinkVerifyResult>('/v1/auth/magic-link/verify', payload);
    verifyInflight.set(token, promise);
  }
  return promise;
}
