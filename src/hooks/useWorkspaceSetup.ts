/**
 * React Query hooks for the one-time post-login workspace setup dialog.
 *
 * Backed by GET/PUT /v1/me/workspace-setup (contracts/openapi/openapi.yaml).
 * The controller shows the dialog only when the backend reports completed=false;
 * submitting PUTs the profile and updates the cached state so the dialog hides
 * without a refetch.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { WorkspaceSetupRequest, WorkspaceSetupState } from '../types/signup-onboarding';

/** Cache key is per user so switching accounts refetches the right state. */
export function workspaceSetupQueryKey(userId: string): unknown[] {
  return ['workspace-setup', userId];
}

/**
 * Fetches the current user's workspace setup state (completed flag + stored profile).
 *
 * Disabled until the user is authenticated (`userId` null disables the query). Once
 * loaded, the state is kept fresh in cache for the session; submitting the dialog
 * updates it via `useSubmitWorkspaceSetup`.
 *
 * **Route:** GET /v1/me/workspace-setup
 *
 * @param userId - Authenticated user ID; pass null to disable the query.
 * @returns React Query result: `data` is WorkspaceSetupState.
 */
export function useWorkspaceSetupState(userId: string | null) {
  return useQuery({
    queryKey: workspaceSetupQueryKey(userId ?? 'anonymous'),
    queryFn: async () => apiClient.get<WorkspaceSetupState>('/v1/me/workspace-setup'),
    enabled: !!userId,
    staleTime: Infinity,
  });
}

/**
 * Submits the workspace setup dialog for the current user.
 *
 * On success the cached state for `userId` is replaced with the response
 * (completed=true + profile), which hides the dialog.
 *
 * **Route:** PUT /v1/me/workspace-setup
 *
 * @param userId - Authenticated user ID (used to update the per-user cache entry).
 * @returns Mutation. Invoke with WorkspaceSetupRequest; `data` is the updated WorkspaceSetupState.
 */
export function useSubmitWorkspaceSetup(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['workspace-setup', 'submit', userId],
    mutationFn: async (payload: WorkspaceSetupRequest) =>
      apiClient.put<WorkspaceSetupState>('/v1/me/workspace-setup', payload),
    onSuccess: (data) => {
      if (userId) queryClient.setQueryData(workspaceSetupQueryKey(userId), data);
    },
  });
}
