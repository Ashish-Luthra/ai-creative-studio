/**
 * Hook for listing workspaces available to the current user.
 *
 * **Route:** GET /v1/workspaces
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../components/Providers/AuthContext';

/**
 * Workspace summary returned by GET /v1/workspaces.
 *
 * @property id - Workspace UUID.
 * @property name - Display name.
 * @property edition - Edition (e.g. free, team).
 * @property defaultEnv - Default environment: "sandbox" or "prod".
 * @property createdAt - ISO timestamp.
 */
export interface Workspace {
  id: string;
  name: string;
  edition: string;
  defaultEnv: string;
  createdAt: string;
}

interface PaginatedWorkspaces {
  items: Workspace[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Fetches workspaces available to the authenticated user.
 *
 * Used by layout (workspace switcher) and environment checks. The query runs only
 * when the user is authenticated and has a token; otherwise it is disabled.
 *
 * **Route:** GET /v1/workspaces?limit=100
 *
 * @returns React Query result: data has items (Workspace[]), nextCursor, hasMore.
 */
export function useWorkspaces() {
  const { isAuthenticated, token } = useAuth();

  return useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedWorkspaces>('/v1/workspaces?limit=100');
      return response;
    },
    enabled: isAuthenticated && !!token, // Only run when authenticated and token is available
    retry: 1,
  });
}

