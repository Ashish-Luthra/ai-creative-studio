/**
 * Authorization hooks: accessible organizations and workspaces for workspace switcher,
 * invite acceptance, and bootstrap sync.
 *
 * **Routes:** GET /v1/authz/organizations, GET /v1/authz/workspaces,
 * POST /v1/invites/{inviteToken}/accept, POST /v1/authz/bootstrap/sync
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../components/Providers/AuthContext';

// ---------- Types (OpenAPI: AccessibleOrganization, AccessibleWorkspace) ----------

export interface AccessibleOrganization {
  organizationId: string;
  enterpriseId?: string | null;
  name?: string | null;
  /** Slug when returned by API; use for display and optional slug-based routing. */
  slug?: string | null;
  effectivePermission: string;
  decisionSource?: string;
}

export interface AccessibleWorkspace {
  workspaceId: string;
  organizationId: string;
  workspaceName: string;
  /** Slug when returned by API; use for display and optional slug-based routing. */
  slug?: string | null;
  enterpriseId?: string | null;
  effectivePermission: string;
  decisionSource?: string;
}

export interface AccessibleEnterprisesResponse {
  items: Array<{
    enterpriseId: string;
    name?: string | null;
    effectivePermission: string;
    decisionSource?: string;
  }>;
}

export interface AccessibleOrganizationsResponse {
  items: AccessibleOrganization[];
}

export interface AccessibleWorkspacesResponse {
  items: AccessibleWorkspace[];
}

const AUTHZ_QUERY_KEY = ['authz'] as const;

/**
 * List organizations the current user can access.
 * **Route:** GET /v1/authz/organizations
 */
export function useAuthzOrganizations(params?: { enterpriseId?: string; limit?: number }) {
  const { isAuthenticated, token } = useAuth();
  const search = new URLSearchParams();
  if (params?.enterpriseId) search.set('enterpriseId', params.enterpriseId);
  if (params?.limit) search.set('limit', String(params.limit));
  const query = search.toString();
  return useQuery({
    queryKey: [...AUTHZ_QUERY_KEY, 'organizations', query],
    queryFn: async () =>
      apiClient.get<AccessibleOrganizationsResponse>(
        `/v1/authz/organizations${query ? `?${query}` : ''}`
      ),
    enabled: isAuthenticated && !!token,
    retry: 1,
  });
}

/**
 * List workspaces the current user can access.
 * **Route:** GET /v1/authz/workspaces
 */
export function useAuthzWorkspaces(params?: {
  organizationId?: string;
  enterpriseId?: string;
  limit?: number;
}) {
  const { isAuthenticated, token } = useAuth();
  const search = new URLSearchParams();
  if (params?.organizationId) search.set('organizationId', params.organizationId);
  if (params?.enterpriseId) search.set('enterpriseId', params.enterpriseId);
  if (params?.limit) search.set('limit', String(params.limit ?? 200));
  const query = search.toString();
  return useQuery({
    queryKey: [...AUTHZ_QUERY_KEY, 'workspaces', query],
    queryFn: async () =>
      apiClient.get<AccessibleWorkspacesResponse>(
        `/v1/authz/workspaces${query ? `?${query}` : ''}`
      ),
    enabled: isAuthenticated && !!token,
    retry: 1,
  });
}

/**
 * Fetch both organizations and workspaces for the workspace switcher.
 * Uses GET /v1/authz/organizations and GET /v1/authz/workspaces.
 */
export function useAuthzOrgAndWorkspaces() {
  const orgs = useAuthzOrganizations({ limit: 200 });
  const workspaces = useAuthzWorkspaces({ limit: 200 });
  return {
    organizations: orgs,
    workspaces,
    isLoading: orgs.isLoading || workspaces.isLoading,
    error: orgs.error ?? workspaces.error,
    data: orgs.data && workspaces.data ? { organizations: orgs.data, workspaces: workspaces.data } : undefined,
  };
}

// ---------- Invite accept & bootstrap sync (onboarding) ----------

export interface InviteAcceptResponse {
  organizationMembershipCreated: boolean;
  teamMembershipsCreated?: string[];
  bootstrapSyncStatus?: string;
}

export interface BootstrapSyncResponse {
  status: string;
  tuplesWritten: number;
  failedTuples: number;
  retryToken?: string | null;
}

/**
 * Accept an invite and create authorization relationships.
 * **Route:** POST /v1/invites/{inviteToken}/accept
 */
export function useAcceptInvite(inviteToken: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['authz', 'invite-accept', inviteToken],
    mutationFn: async (body?: { organizationId?: string; workspaceId?: string; teamIds?: string[]; grantPermission?: string }) => {
      if (!inviteToken) throw new Error('Missing invite token');
      return apiClient.post<InviteAcceptResponse>(`/v1/invites/${encodeURIComponent(inviteToken)}/accept`, body ?? {}, {
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['authz'] });
    },
  });
}

/**
 * Sync bootstrap authorization relationships after signup/onboarding.
 * **Route:** POST /v1/authz/bootstrap/sync
 */
export function useBootstrapSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['authz', 'bootstrap-sync'],
    mutationFn: async (body: { organizationId?: string | null; workspaceId?: string | null; authzBootstrapOutputRef?: string | null; force?: boolean }) => {
      return apiClient.post<BootstrapSyncResponse>('/v1/authz/bootstrap/sync', body, {
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['authz'] });
      qc.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}
