/**
 * React Query hooks for onboarding session and step APIs.
 *
 * Used by onboarding layout, business-context, tools-connectors, pricing-payment,
 * invites, setup-progress, and activation-home flows. All mutations use idempotency
 * keys and invalidate or set session cache on success.
 *
 * Flows:
 * - Create session → cache session by id.
 * - Step mutations (business-context, tools-connectors, etc.) → PUT session step, update cache.
 * - useOnboardingSession / useOnboardingSetupProgress / useOnboardingActivationHome → GET and poll.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type {
  CreateOnboardingSessionRequest,
  OnboardingSession,
  BusinessContextStepRequest,
  ToolsConnectorsStepRequest,
  PricingPaymentStepRequest,
  InvitesStepRequest,
  SetupProgressResponse,
  ActivationHomeResponse,
} from '../types/signup-onboarding';

/**
 * Creates a new onboarding session for the current user and account type.
 *
 * Call this after signup/role selection to start the onboarding flow. The mutation is
 * idempotent when the backend receives the same idempotency key. On success, the
 * returned session is written to the React Query cache under `['onboarding', 'session', data.id]`
 * so that the layout and child routes can read it without a refetch.
 *
 * **Route:** POST /v1/onboarding/sessions
 *
 * @returns Mutation object. Invoke `mutate(payload)` or `mutateAsync(payload)` with
 *   CreateOnboardingSessionRequest. On success, `data` is the OnboardingSession.
 * @throws Errors from the API (e.g. 401, 422) are surfaced via the mutation's `error` state.
 */
export function useCreateOnboardingSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['onboarding', 'create-session'],
    mutationFn: async (payload: CreateOnboardingSessionRequest) => {
      const idempotencyKey = crypto.randomUUID();
      return apiClient.post<OnboardingSession>('/v1/onboarding/sessions', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['onboarding', 'session', data.id], data);
    },
  });
}

/**
 * Fetches a single onboarding session by ID.
 *
 * Use this in the onboarding layout or step components to load the current session.
 * When `sessionId` is null, the query does not run (`enabled: false`). After a successful
 * create or step update, the cache is updated so this query typically returns cached data
 * without a network request until the user navigates or the cache is invalidated.
 *
 * **Route:** GET /v1/onboarding/sessions/{sessionId}
 *
 * @param sessionId - Onboarding session UUID from context or route; pass null to disable the query.
 * @returns React Query result: `data` is OnboardingSession; `isLoading`, `error`, `refetch` also available.
 */
export function useOnboardingSession(sessionId: string | null) {
  return useQuery({
    queryKey: ['onboarding', 'session', sessionId],
    queryFn: async () => {
      if (!sessionId) throw new Error('Missing sessionId');
      return apiClient.get<OnboardingSession>(`/v1/onboarding/sessions/${sessionId}`);
    },
    enabled: !!sessionId,
  });
}

/**
 * Updates the onboarding session's business-context step (e.g. company name, industry).
 *
 * Call this when the user submits the business-context form. The mutation sends a PUT
 * with idempotency and, on success, updates the cached session so the UI reflects the
 * new step state without refetching.
 *
 * **Route:** PUT /v1/onboarding/sessions/{sessionId}/business-context
 *
 * @param sessionId - Onboarding session UUID. Must be non-null; mutationFn throws if null.
 * @returns Mutation. Invoke with BusinessContextStepRequest. On success, `data` is the updated OnboardingSession.
 */
export function useOnboardingBusinessContext(sessionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['onboarding', 'business-context', sessionId],
    mutationFn: async (payload: BusinessContextStepRequest) => {
      if (!sessionId) throw new Error('Missing sessionId');
      const idempotencyKey = crypto.randomUUID();
      return apiClient.put<OnboardingSession>(
        `/v1/onboarding/sessions/${sessionId}/business-context`,
        payload,
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['onboarding', 'session', sessionId], data);
    },
    meta: { sessionId },
  });
}

/**
 * Updates the onboarding session's tools-connectors step (selected tools/connectors).
 *
 * Call when the user submits the tools-connectors selection. Sends a PUT with idempotency;
 * on success, the cached session is updated so the UI shows the new step without refetch.
 *
 * **Route:** PUT /v1/onboarding/sessions/{sessionId}/tools-connectors
 *
 * @param sessionId - Onboarding session UUID. Must be non-null; mutationFn throws if null.
 * @returns Mutation. Invoke with ToolsConnectorsStepRequest. On success, `data` is the updated OnboardingSession.
 */
export function useOnboardingToolsConnectors(sessionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['onboarding', 'tools-connectors', sessionId],
    mutationFn: async (payload: ToolsConnectorsStepRequest) => {
      if (!sessionId) throw new Error('Missing sessionId');
      const idempotencyKey = crypto.randomUUID();
      return apiClient.put<OnboardingSession>(
        `/v1/onboarding/sessions/${sessionId}/tools-connectors`,
        payload,
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['onboarding', 'session', sessionId], data);
    },
    meta: { sessionId },
  });
}

/**
 * Updates the onboarding session's pricing-payment step (plan, payment details).
 *
 * Call when the user completes the pricing/payment form. Sends a PUT with idempotency;
 * on success, the cached session is updated.
 *
 * **Route:** PUT /v1/onboarding/sessions/{sessionId}/pricing-payment
 *
 * @param sessionId - Onboarding session UUID. Must be non-null; mutationFn throws if null.
 * @returns Mutation. Invoke with PricingPaymentStepRequest. On success, `data` is the updated OnboardingSession.
 */
export function useOnboardingPricingPayment(sessionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['onboarding', 'pricing-payment', sessionId],
    mutationFn: async (payload: PricingPaymentStepRequest) => {
      if (!sessionId) throw new Error('Missing sessionId');
      const idempotencyKey = crypto.randomUUID();
      return apiClient.put<OnboardingSession>(
        `/v1/onboarding/sessions/${sessionId}/pricing-payment`,
        payload,
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['onboarding', 'session', sessionId], data);
    },
    meta: { sessionId },
  });
}

/**
 * Updates the onboarding session's invites step (team invite list).
 *
 * Call when the user submits the invites form. Sends a PUT with idempotency; on success,
 * the cached session is updated.
 *
 * **Route:** PUT /v1/onboarding/sessions/{sessionId}/invites
 *
 * @param sessionId - Onboarding session UUID. Must be non-null; mutationFn throws if null.
 * @returns Mutation. Invoke with InvitesStepRequest. On success, `data` is the updated OnboardingSession.
 */
export function useOnboardingInvites(sessionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['onboarding', 'invites', sessionId],
    mutationFn: async (payload: InvitesStepRequest) => {
      if (!sessionId) throw new Error('Missing sessionId');
      const idempotencyKey = crypto.randomUUID();
      return apiClient.put<OnboardingSession>(
        `/v1/onboarding/sessions/${sessionId}/invites`,
        payload,
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['onboarding', 'session', sessionId], data);
    },
    meta: { sessionId },
  });
}

/**
 * Fetches setup-progress for the onboarding session (checklist and status).
 *
 * Use on the setup-progress or activation screens to poll for backend setup completion
 * (e.g. workspace creation, policy pack). When `sessionId` is null the query is disabled.
 * Refetch interval defaults to 2000 ms so the UI updates as steps complete.
 *
 * **Route:** GET /v1/onboarding/sessions/{sessionId}/setup-progress
 *
 * @param sessionId - Onboarding session UUID; pass null to disable the query.
 * @param options - Optional `refetchInterval` in ms (default 2000).
 * @returns React Query result: `data` is SetupProgressResponse; refetches on the given interval when enabled.
 */
export function useOnboardingSetupProgress(sessionId: string | null, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ['onboarding', 'setup-progress', sessionId],
    queryFn: async () => {
      if (!sessionId) throw new Error('Missing sessionId');
      return apiClient.get<SetupProgressResponse>(
        `/v1/onboarding/sessions/${sessionId}/setup-progress`
      );
    },
    enabled: !!sessionId,
    refetchInterval: options?.refetchInterval ?? 2000,
  });
}

/**
 * Fetches the activation-home payload for the onboarding session.
 *
 * Use after setup is complete to load the post-setup summary and next actions (e.g. CTA
 * links, workspace entry). When `sessionId` is null the query is disabled.
 *
 * **Route:** GET /v1/onboarding/sessions/{sessionId}/activation-home
 *
 * @param sessionId - Onboarding session UUID; pass null to disable the query.
 * @returns React Query result: `data` is ActivationHomeResponse (summary cards, CTAs, etc.).
 */
export function useOnboardingActivationHome(sessionId: string | null) {
  return useQuery({
    queryKey: ['onboarding', 'activation-home', sessionId],
    queryFn: async () => {
      if (!sessionId) throw new Error('Missing sessionId');
      return apiClient.get<ActivationHomeResponse>(
        `/v1/onboarding/sessions/${sessionId}/activation-home`
      );
    },
    enabled: !!sessionId,
  });
}
