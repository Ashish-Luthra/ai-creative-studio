/**
 * Admin hooks for workspaces, teams, roles, connectors, members, tools, credentials,
 * marketplace, billing, audit, policy packs, and brand center (brandkits, templates,
 * disclaimers, copy guidelines, assets, publish events).
 * Each hook documents **Route**, optional "When to use", @param and @returns where applicable.
 *
 * **Routes:** All under /v1/admin/*, /v1/workspaces/*, /v1/connectors, /v1/me/credentials.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../components/Providers/AuthContext';

// ---------- Types (aligned with API / OpenAPI) ----------
export interface AdminWorkspace {
  id: string;
  name: string;
  edition: string;
  defaultEnv: string;
  defaultPolicyPackId?: string | null;
  defaultBrandKitId?: string | null;
  timezone?: string;
  productionLock?: boolean;
  status?: string;
  slug?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Enterprise (top of hierarchy). OpenAPI: AdminEnterprise. */
export interface AdminEnterprise {
  id: string;
  name: string;
  status?: string;
  slug?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Tenant / organization. OpenAPI: AdminTenant. */
export interface AdminTenant {
  id: string;
  name: string;
  enterpriseId?: string | null;
  status?: string;
  slug?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTeam {
  id: string;
  name: string;
  workspaceId: string;
  teamType?: string;
  membersCount?: number;
  defaultRoles?: Record<string, unknown>;
  status?: string;
  slug?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRole {
  id: string;
  name: string;
  /** "system" | "org" | "workspace" */
  scope: string;
  workspaceId?: string | null;
  permissionsSummary?: string;
  status?: string;
  /** True for built-in roles (maker, checker, auditor, admin, agency_guest). Cannot be deleted. */
  isSystem?: boolean;
  lastUpdated: string;
}

export interface WorkspaceMember {
  userId: string;
  email?: string;
  name?: string;
  /** Actual slug from DB (globally or per-org unique); null when not set. */
  slug?: string | null;
  roles: string[];
  addedAt?: string;
  addedBy?: string;
}

export interface PaginatedWorkspaceMembers {
  items: WorkspaceMember[];
  nextCursor?: string | null;
  hasMore?: boolean;
}

export interface AddWorkspaceMemberRequest {
  userId: string;
  roles: string[];
}

export interface UserRoles {
  userId: string;
  workspaceId: string;
  roles: string[];
}

export interface UpdateUserRolesRequest {
  roles: string[];
}

export interface Connector {
  name: string;
  displayName?: string;
  description?: string;
  version?: string;
  supportedOperations?: string[];
  healthStatus?: string;
}

export interface ConnectorInstance {
  id: string;
  connectorId: string;
  workspaceId: string;
  env: string;
  authStatus?: string;
  preflightStatus?: string;
  lastPreflightAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Credential metadata only (ADR 0017). Secret value is never returned by API or stored in frontend. */
export interface Credential {
  id: string;
  namespace: 'auth' | 'oauth' | 'connector' | 'mcp' | 'llm_gateway' | 'internal';
  key: string;
  env: 'sandbox' | 'prod';
  subjectType: 'user' | 'workspace' | 'team' | 'service';
  subjectId: string;
  displayName: string;
  description?: string | null;
  tags?: Record<string, unknown>;
  rotationPolicy?: Record<string, unknown>;
  status: 'active' | 'revoked' | 'expired' | 'pending';
  lastRotatedAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateCredentialRequest {
  namespace: Credential['namespace'];
  key: string;
  env: Credential['env'];
  subjectType: Credential['subjectType'];
  subjectId: string;
  displayName: string;
  description?: string | null;
  tags?: Record<string, unknown>;
  rotationPolicy?: Record<string, unknown>;
  secretValue: string;
}

export interface RotateCredentialRequest {
  secretValue: string;
}

export interface UpdateCredentialMetadataRequest {
  displayName?: string;
  description?: string | null;
  tags?: Record<string, unknown>;
  rotationPolicy?: Record<string, unknown>;
  status?: Credential['status'];
}

export interface CredentialsListFilters {
  namespace?: string;
  env?: string;
  subjectType?: string;
  subjectId?: string;
  workspaceId?: string;
  teamId?: string;
  status?: string;
  cursor?: string;
  limit?: number;
}

export interface McpOAuthProviderProfilesItem {
  provider: string;
  providerLabel: string;
  defaultClientProfile: string;
  clientProfiles: string[];
  clientProfileLabels: Record<string, string>;
  scopes: string[];
  scopeDescriptions: Record<string, string>;
  /** From MCP contract auth.oauth.redirectUriLocalhostToLoopback */
  redirectUriLocalhostToLoopback?: boolean;
}

export interface SkillCatalogItem {
  id: string;
  name: string;
  provider?: string;
  category?: string;
  riskLevel?: string;
  requiredScopes?: string[];
}

export interface InstalledSkill {
  id: string;
  skillId: string;
  version: string;
  enabledWorkspaces?: string[];
  status?: string;
  lastUpdated: string;
}

export interface UsageMetersResponse {
  workspaceId: string;
  agentRuns?: number;
  toolCalls?: number;
  executions?: number;
  dataVolume?: number;
  cost?: number;
}

export interface UsageHistoryItem {
  periodStart: string;
  periodEnd: string;
  agentRuns: number;
  toolCalls: number;
  executions: number;
  dataVolume: number;
  cost: number;
}

export interface UsageHistoryResponse {
  workspaceId: string;
  items: UsageHistoryItem[];
}

export interface BudgetCapConfig {
  budgetType?: string | null;
  billingDayStart?: string | null;
  alertRecipients?: string[] | null;
  dailyReports?: boolean | null;
  slackNotifications?: boolean | null;
  slackWebhook?: string | null;
  overagePolicy?: string | null;
  overageFee?: string | null;
  autoScaleDown?: boolean | null;
}

export interface BudgetCap {
  id: string;
  workspaceId: string;
  limit: number;
  alertThreshold?: number | null;
  enforcement?: string;
  config?: BudgetCapConfig | null;
  createdAt: string;
}

/** Payment method from GET /v1/admin/billing/payment-methods (OpenAPI PaymentMethod). */
export interface AdminPaymentMethod {
  id: string;
  provider?: string;
  methodType?: 'card' | 'bank_account' | 'wallet' | 'other';
  displayName?: string;
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  country?: string;
  currency?: string;
  status?: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminPolicyPack {
  id: string;
  name: string;
  mode?: string;
  channelsAllowed?: string[];
  consentRequired?: boolean;
  description?: string | null;
  owner?: string | null;
  ownerRef?: AssetOwnerRef | null;
  forbiddenTerms?: string[];
  requiredDisclaimers?: string[];
  approvalRules?: Record<string, string> | null;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEventItem {
  id: string;
  time: string;
  actor: string;
  role?: string;
  action: string;
  objectRef?: string;
  env?: string | null;
  result?: string | null;
  reasonCode?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface RetentionPolicy {
  evidencePacksDays: number;
  auditLogDays: number;
  toolCallLogDays: number;
  lastUpdatedAt?: string | null;
}

export interface AuditStorageUsage {
  usedBytes: number;
  quotaBytes: number;
}

export interface BrandKit {
  id: string;
  name: string;
  version?: string;
  status?: string;
  workspacesUsing?: string[];
  lastUpdated: string;
  /** BrandKit spec.tokens (structured token tables). */
  tokens?: Record<string, unknown> | null;
  typography?: Record<string, unknown> | null;
  /** BrandKit spec.components (e.g. generated style mappings). */
  components?: Record<string, unknown> | null;
  owner?: string | null;
  ownerRef?: AssetOwnerRef | null;
  /** IR scope: org | workspace */
  scope?: string | null;
  notes?: string | null;
  appliesToWorkspaces?: string[] | null;
  defaultForEditions?: string[] | null;
}

export interface BrandTemplate {
  id: string;
  name: string;
  status?: string;
  brandKitId?: string | null;
  lastUpdated: string;
  type?: string;
  formats?: string[];
  locales?: string[];
  usedIn?: number;
}
export interface LegalDisclaimer {
  id: string;
  title: string;
  channel?: string;
  locale?: string;
  required?: boolean;
  placement?: string;
  status?: string;
  lastUpdated: string;
}
export interface CopyGuideline {
  id: string;
  name: string;
  status?: string;
  lastUpdated: string;
  category?: string;
  severity?: string;
  description?: string;
  forbiddenTerms?: { term: string; severity: string; reason: string }[];
  toneRules?: { dos?: string[]; donts?: string[] };
  examples?: { good: string; bad: string }[];
}
export interface BrandAsset {
  id: string;
  name: string;
  uri: string;
  hash?: string;
  assetType?: string;
  status?: string;
  lastUpdated: string;
  formats?: string[];
  usedIn?: number;
}
export interface BrandPublishEvent {
  id: string;
  workspaceId: string;
  objectRef: string;
  objectKind: string;
  fromVersion?: number | null;
  toVersion: number;
  publishedBy: string;
  publishedAt: string;
  status: string;
  reasonCode?: string | null;
}

// ---------- Create/Update request types ----------
export interface CreateWorkspaceRequest {
  name: string;
  edition: string;
  /** Organization (tenant) ID the workspace belongs to (optional; server may resolve from context). */
  organizationId?: string | null;
  timezone?: string;
  defaultEnv?: string;
  defaultPolicyPackId?: string | null;
  defaultBrandKitId?: string | null;
  productionLock?: boolean;
}
export interface UpdateWorkspaceRequest {
  name?: string;
  timezone?: string;
  defaultEnv?: string;
  defaultPolicyPackId?: string | null;
  defaultBrandKitId?: string | null;
  productionLock?: boolean;
  status?: string; // 'active' | 'archived' (archive workspace)
}
export interface DuplicateWorkspaceRequest {
  name?: string; // optional override; default source name + " (Copy)"
}
export interface CreateEnterpriseAdminRequest {
  name: string;
  status?: string;
  slug?: string | null;
}
export interface UpdateEnterpriseAdminRequest {
  name?: string;
  status?: string;
  slug?: string | null;
}
export interface CreateTenantAdminRequest {
  name: string;
  enterpriseId?: string | null;
  status?: string;
  slug?: string | null;
}
export interface UpdateTenantAdminRequest {
  name?: string;
  status?: string;
  slug?: string | null;
}
export interface CreateTeamRequest {
  name: string;
  workspaceId: string;
  teamType?: string;
  defaultRoles?: Record<string, unknown>;
}
export interface UpdateTeamRequest {
  name?: string;
  teamType?: string;
  defaultRoles?: Record<string, unknown>;
}
export interface CreateRoleRequest {
  name: string;
  scope?: string;
  workspaceId?: string | null;
  permissions?: Record<string, unknown>;
}
export interface UpdateRoleRequest {
  name?: string;
  permissions?: Record<string, unknown>;
}
export interface CreateConnectorInstanceRequest {
  connectorId: string;
  workspaceId: string;
  env?: string;
  config?: Record<string, unknown>;
  secrets?: Record<string, unknown>;
}
export interface InstallSkillRequest {
  skillId: string;
  version?: string;
  workspaceIds?: string[];
}
export interface UpsertBudgetCapRequest {
  workspaceId: string;
  limit: number;
  alertThreshold?: number | null;
  enforcement?: string;
  config?: BudgetCapConfig | null;
}
export interface CreatePolicyPackRequest {
  name: string;
  mode?: string;
  channelsAllowed?: string[];
  consentRequired?: boolean;
  description?: string | null;
  owner?: string | null;
  ownerRef?: AssetOwnerRef | null;
  forbiddenTerms?: string[];
  requiredDisclaimers?: string[];
  approvalRules?: Record<string, string> | null;
  workspaceId?: string | null;
}
export interface UpdatePolicyPackRequest {
  name?: string;
  mode?: string;
  channelsAllowed?: string[];
  consentRequired?: boolean;
  description?: string | null;
  owner?: string | null;
  ownerRef?: AssetOwnerRef | null;
  forbiddenTerms?: string[];
  requiredDisclaimers?: string[];
  approvalRules?: Record<string, string> | null;
}
export interface CreateBrandKitRequest {
  name: string;
  workspaceId?: string | null;
  ownerRef?: AssetOwnerRef | null;
}
export interface UpdateBrandKitRequest {
  name?: string;
  tokens?: Record<string, unknown>;
  typography?: Record<string, unknown>;
  components?: Record<string, unknown>;
  owner?: string;
  ownerRef?: AssetOwnerRef | null;
  scope?: string;
  notes?: string;
  appliesToWorkspaces?: string[];
  defaultForEditions?: string[];
  /** BrandKit spec.status (IR): draft | in_review (org publish pending approval) | published | archived */
  status?: string;
}

export interface AssetOwnerRef {
  ownerType: 'workspace' | 'organization';
  workspaceId?: string | null;
  organizationId?: string | null;
}
export interface UpdateRetentionPolicyRequest {
  evidencePacksDays?: number;
  auditLogDays?: number;
  toolCallLogDays?: number;
  reason?: string;
}

// ---------- Query keys (exported for cache invalidation from views) ----------
export const adminQueryKeys = {
  all: ['admin'] as const,
  workspaces: {
    list: () => [...adminQueryKeys.all, 'workspaces', 'list'] as const,
    detail: (id: string) => [...adminQueryKeys.all, 'workspaces', 'detail', id] as const,
  },
  enterprises: {
    list: () => [...adminQueryKeys.all, 'enterprises', 'list'] as const,
    detail: (id: string) => [...adminQueryKeys.all, 'enterprises', 'detail', id] as const,
  },
  tenants: {
    list: () => [...adminQueryKeys.all, 'tenants', 'list'] as const,
    detail: (id: string) => [...adminQueryKeys.all, 'tenants', 'detail', id] as const,
  },
  teams: {
    list: () => [...adminQueryKeys.all, 'teams', 'list'] as const,
    detail: (id: string) => [...adminQueryKeys.all, 'teams', 'detail', id] as const,
  },
  roles: {
    list: () => [...adminQueryKeys.all, 'roles', 'list'] as const,
    detail: (id: string) => [...adminQueryKeys.all, 'roles', 'detail', id] as const,
  },
  connectorInstances: {
    list: () => [...adminQueryKeys.all, 'connectors', 'instances', 'list'] as const,
    detail: (id: string) => [...adminQueryKeys.all, 'connectors', 'instances', 'detail', id] as const,
  },
  workspaceMembers: (workspaceId: string) =>
    [...adminQueryKeys.all, 'workspaces', 'members', workspaceId] as const,
  connectorsCatalog: () => [...adminQueryKeys.all, 'connectors', 'catalog'] as const,
  credentials: {
    list: (filters?: CredentialsListFilters) =>
      [...adminQueryKeys.all, 'credentials', 'list', filters ?? {}] as const,
    detail: (id: string) => [...adminQueryKeys.all, 'credentials', 'detail', id] as const,
  },
  marketplace: () => [...adminQueryKeys.all, 'marketplace'] as const,
  marketplaceInstalled: () => [...adminQueryKeys.all, 'marketplace', 'installed'] as const,
  marketplaceInstalledDetail: (id: string) => [...adminQueryKeys.all, 'marketplace', 'installed', id] as const,
  billingUsage: (workspaceId?: string) => [...adminQueryKeys.all, 'billing', 'usage', workspaceId ?? 'all'] as const,
  billingUsageHistory: (workspaceId?: string) => [...adminQueryKeys.all, 'billing', 'usage-history', workspaceId ?? 'all'] as const,
  billingBudgets: {
    list: () => [...adminQueryKeys.all, 'billing', 'budgets', 'list'] as const,
    detail: (id: string) => [...adminQueryKeys.all, 'billing', 'budgets', 'detail', id] as const,
  },
  billingPaymentMethods: () => [...adminQueryKeys.all, 'billing', 'payment-methods'] as const,
  policyPacks: {
    list: () => [...adminQueryKeys.all, 'policy-packs', 'list'] as const,
    detail: (id: string) => [...adminQueryKeys.all, 'policy-packs', 'detail', id] as const,
  },
  auditEvents: (filters?: Record<string, unknown>) => [...adminQueryKeys.all, 'audit', 'events', filters ?? {}] as const,
  auditRetention: () => [...adminQueryKeys.all, 'audit', 'retention'] as const,
  auditStorageUsage: () => [...adminQueryKeys.all, 'audit', 'storage-usage'] as const,
  brandKits: {
    list: () => [...adminQueryKeys.all, 'brand', 'brandkits', 'list'] as const,
    detail: (id: string) => [...adminQueryKeys.all, 'brand', 'brandkits', 'detail', id] as const,
  },
  brandTemplates: {
    list: () => [...adminQueryKeys.all, 'brand', 'templates', 'list'] as const,
    detail: (id: string) => [...adminQueryKeys.all, 'brand', 'templates', 'detail', id] as const,
  },
  disclaimers: {
    list: () => [...adminQueryKeys.all, 'brand', 'disclaimers', 'list'] as const,
    detail: (id: string) => [...adminQueryKeys.all, 'brand', 'disclaimers', 'detail', id] as const,
  },
  copyGuidelines: {
    list: () => [...adminQueryKeys.all, 'brand', 'copy-guidelines', 'list'] as const,
    detail: (id: string) => [...adminQueryKeys.all, 'brand', 'copy-guidelines', 'detail', id] as const,
  },
  brandAssets: {
    list: () => [...adminQueryKeys.all, 'brand', 'assets', 'list'] as const,
    detail: (id: string) => [...adminQueryKeys.all, 'brand', 'assets', 'detail', id] as const,
  },
  publishEvents: (filters?: PublishEventsFilters) =>
    [...adminQueryKeys.all, 'brand', 'publish-events', filters ?? {}] as const,
};
const adminCredentialsListQueryKey = [...adminQueryKeys.all, 'credentials', 'list'] as const;

function adminRetry(failureCount: number, error: unknown) {
  if (error instanceof Error && (error.message.includes('403') || error.message.includes('401'))) return false;
  return failureCount < 1;
}

// ---------- Workspaces ----------
/**
 * Lists all admin workspaces. Requires admin role.
 * Use when: loading the admin workspaces table or dropdown of workspaces.
 * **Route:** GET /v1/admin/workspaces
 *
 * @returns React Query result with data: { items: AdminWorkspace[] }.
 */
export function useAdminWorkspaces() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.workspaces.list(),
    queryFn: async () => apiClient.get<{ items: AdminWorkspace[] }>('/v1/admin/workspaces'),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

/**
 * Fetches a single admin workspace by ID. Requires admin role.
 * Use when: opening the workspace detail drawer or need current workspace data for edit form.
 * **Route:** GET /v1/admin/workspaces/{workspaceId}
 *
 * @param workspaceId - Workspace UUID; undefined disables the query.
 * @returns React Query result with data: AdminWorkspace.
 */
export function useAdminWorkspace(workspaceId: string | undefined) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.workspaces.detail(workspaceId ?? ''),
    queryFn: async () => apiClient.get<AdminWorkspace>(`/v1/admin/workspaces/${workspaceId}`),
    enabled: isAuthenticated && isAdmin && !!workspaceId,
    retry: (_, err) => !(err instanceof Error && (err.message.includes('403') || err.message.includes('404') || err.message.includes('401'))),
  });
}

/**
 * Creates a new admin workspace. Requires admin role.
 * Use when: submitting the create-workspace form in the admin drawer.
 * **Route:** POST /v1/admin/workspaces
 *
 * @returns Mutation; mutationFn accepts CreateWorkspaceRequest. Data: AdminWorkspace.
 */
export function useAdminCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateWorkspaceRequest) =>
      apiClient.post<AdminWorkspace>('/v1/admin/workspaces', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.workspaces.list() });
    },
  });
}

/**
 * Updates an admin workspace by ID. Requires admin role.
 * Use when: saving edits from the workspace detail drawer.
 * **Route:** PATCH /v1/admin/workspaces/{workspaceId}
 *
 * @param workspaceId - Workspace UUID to update.
 * @returns Mutation; mutationFn accepts UpdateWorkspaceRequest. Data: AdminWorkspace.
 */
export function useAdminUpdateWorkspace(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateWorkspaceRequest) =>
      apiClient.patch<AdminWorkspace>(`/v1/admin/workspaces/${workspaceId}`, body),
    onSuccess: (_, __, ___) => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.workspaces.list() });
      qc.invalidateQueries({ queryKey: adminQueryKeys.workspaces.detail(workspaceId) });
    },
  });
}

/**
 * Updates any workspace by id (e.g. row-level Archive without opening drawer). Requires admin role.
 * Use when: archiving or updating a workspace from the table row without opening the drawer.
 * **Route:** PATCH /v1/admin/workspaces/{workspaceId}
 *
 * @returns Mutation; mutationFn accepts UpdateWorkspaceRequest & { workspaceId: string }. Data: AdminWorkspace.
 */
export function useAdminUpdateWorkspaceById() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, ...body }: UpdateWorkspaceRequest & { workspaceId: string }) =>
      apiClient.patch<AdminWorkspace>(`/v1/admin/workspaces/${workspaceId}`, body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.workspaces.list() });
      qc.invalidateQueries({ queryKey: adminQueryKeys.workspaces.detail(data.id) });
    },
  });
}

/**
 * Deletes an admin workspace. Requires admin role.
 * Use when: confirming delete from the workspace drawer or row actions.
 * **Route:** DELETE /v1/admin/workspaces/{workspaceId}
 *
 * @param workspaceId - Workspace UUID to delete.
 * @returns Mutation; no body. Invalidates workspaces list and detail.
 */
export function useAdminDeleteWorkspace(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.delete(`/v1/admin/workspaces/${workspaceId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.workspaces.list() });
      qc.removeQueries({ queryKey: adminQueryKeys.workspaces.detail(workspaceId) });
      qc.invalidateQueries({ queryKey: adminQueryKeys.roles.list() });
      qc.invalidateQueries({ queryKey: adminQueryKeys.teams.list() });
    },
  });
}

/**
 * Duplicates an admin workspace. Requires admin role.
 * Use when: user triggers duplicate from workspace row or drawer; creates a new workspace from template.
 * **Route:** POST /v1/admin/workspaces/{sourceWorkspaceId}/duplicate
 *
 * @param sourceWorkspaceId - Workspace UUID to duplicate.
 * @returns Mutation; mutationFn accepts optional DuplicateWorkspaceRequest. Data: AdminWorkspace (new workspace).
 */
export function useAdminDuplicateWorkspace(sourceWorkspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body?: DuplicateWorkspaceRequest) =>
      apiClient.post<AdminWorkspace>(
        `/v1/admin/workspaces/${sourceWorkspaceId}/duplicate`,
        body ?? {}
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.workspaces.list() });
      qc.invalidateQueries({ queryKey: adminQueryKeys.workspaces.detail(data.id) });
    },
  });
}

// ---------- Enterprises (admin) ----------
/**
 * Lists enterprises. **Route:** GET /v1/admin/enterprises
 */
export function useAdminEnterprises() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.enterprises.list(),
    queryFn: async () => apiClient.get<{ items: AdminEnterprise[] }>('/v1/admin/enterprises'),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

/**
 * Fetches a single enterprise. **Route:** GET /v1/admin/enterprises/{enterpriseId}
 */
export function useAdminEnterprise(enterpriseId: string | undefined) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.enterprises.detail(enterpriseId ?? ''),
    queryFn: async () => apiClient.get<AdminEnterprise>(`/v1/admin/enterprises/${enterpriseId}`),
    enabled: isAuthenticated && isAdmin && !!enterpriseId,
    retry: adminRetry,
  });
}

/**
 * Creates an enterprise. **Route:** POST /v1/admin/enterprises
 */
export function useAdminCreateEnterprise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateEnterpriseAdminRequest) =>
      apiClient.post<AdminEnterprise>('/v1/admin/enterprises', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.enterprises.list() });
    },
  });
}

/**
 * Updates an enterprise. **Route:** PATCH /v1/admin/enterprises/{enterpriseId}
 */
export function useAdminUpdateEnterprise(enterpriseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateEnterpriseAdminRequest) =>
      apiClient.patch<AdminEnterprise>(`/v1/admin/enterprises/${enterpriseId}`, body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.enterprises.list() });
      qc.invalidateQueries({ queryKey: adminQueryKeys.enterprises.detail(data.id) });
    },
  });
}

/**
 * Deletes an enterprise. **Route:** DELETE /v1/admin/enterprises/{enterpriseId}
 */
export function useAdminDeleteEnterprise(enterpriseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.delete(`/v1/admin/enterprises/${enterpriseId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.enterprises.list() });
      qc.removeQueries({ queryKey: adminQueryKeys.enterprises.detail(enterpriseId) });
    },
  });
}

// ---------- Tenants / Organizations (admin) ----------
/**
 * Lists tenants (organizations). **Route:** GET /v1/admin/tenants
 */
export function useAdminTenants(params?: { organizationId?: string }) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  const search = params?.organizationId
    ? `?filter.organizationId=${encodeURIComponent(params.organizationId)}`
    : '';
  return useQuery({
    queryKey: [...adminQueryKeys.tenants.list(), params ?? {}],
    queryFn: async () =>
      apiClient.get<{ items: AdminTenant[] }>(`/v1/admin/tenants${search}`),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

/**
 * Fetches a single tenant. **Route:** GET /v1/admin/tenants/{organizationId}
 */
export function useAdminTenant(organizationId: string | undefined) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.tenants.detail(organizationId ?? ''),
    queryFn: async () =>
      apiClient.get<AdminTenant>(`/v1/admin/tenants/${organizationId}`),
    enabled: isAuthenticated && isAdmin && !!organizationId,
    retry: adminRetry,
  });
}

/**
 * Creates a tenant (organization). **Route:** POST /v1/admin/tenants
 */
export function useAdminCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateTenantAdminRequest) =>
      apiClient.post<AdminTenant>('/v1/admin/tenants', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.tenants.list() });
    },
  });
}

/**
 * Updates a tenant. **Route:** PATCH /v1/admin/tenants/{organizationId}
 */
export function useAdminUpdateTenant(organizationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateTenantAdminRequest) =>
      apiClient.patch<AdminTenant>(`/v1/admin/tenants/${organizationId}`, body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.tenants.list() });
      qc.invalidateQueries({ queryKey: adminQueryKeys.tenants.detail(data.id) });
    },
  });
}

/**
 * Deletes a tenant. **Route:** DELETE /v1/admin/tenants/{organizationId}
 */
export function useAdminDeleteTenant(organizationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.delete(`/v1/admin/tenants/${organizationId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.tenants.list() });
      qc.removeQueries({ queryKey: adminQueryKeys.tenants.detail(organizationId) });
    },
  });
}

// ---------- Teams ----------
/**
 * Lists all admin teams. Requires admin role.
 * Use when: loading the admin teams table or workspace-scoped team dropdown.
 * **Route:** GET /v1/admin/teams
 *
 * @returns React Query result with data: { items: AdminTeam[] }.
 */
export function useAdminTeams() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.teams.list(),
    queryFn: async () => apiClient.get<{ items: AdminTeam[] }>('/v1/admin/teams'),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

/**
 * Fetches a single admin team by ID. Requires admin role.
 * Use when: opening the team detail drawer or need current team for edit form.
 * **Route:** GET /v1/admin/teams/{teamId}
 *
 * @param teamId - Team UUID; undefined disables the query.
 * @returns React Query result with data: AdminTeam.
 */
export function useAdminTeam(teamId: string | undefined) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.teams.detail(teamId ?? ''),
    queryFn: async () => apiClient.get<AdminTeam>(`/v1/admin/teams/${teamId}`),
    enabled: isAuthenticated && isAdmin && !!teamId,
    retry: adminRetry,
  });
}

/**
 * Creates a new admin team. Requires admin role.
 * Use when: submitting the create-team form in the admin teams drawer.
 * **Route:** POST /v1/admin/teams
 *
 * @returns Mutation; mutationFn accepts CreateTeamRequest. Data: AdminTeam.
 */
export function useAdminCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateTeamRequest) =>
      apiClient.post<AdminTeam>('/v1/admin/teams', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminQueryKeys.teams.list() }),
  });
}

/**
 * Updates an admin team by ID. Requires admin role.
 * Use when: saving edits from the team detail drawer.
 * **Route:** PATCH /v1/admin/teams/{teamId}
 *
 * @param teamId - Team UUID to update.
 * @returns Mutation; mutationFn accepts UpdateTeamRequest. Data: AdminTeam.
 */
export function useAdminUpdateTeam(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateTeamRequest) =>
      apiClient.patch<AdminTeam>(`/v1/admin/teams/${teamId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.teams.list() });
      qc.invalidateQueries({ queryKey: adminQueryKeys.teams.detail(teamId) });
    },
  });
}

/**
 * Deletes an admin team. Requires admin role.
 * Use when: confirming delete from the team drawer or row actions.
 * **Route:** DELETE /v1/admin/teams/{teamId}
 *
 * @param teamId - Team UUID to delete.
 * @returns Mutation; no body. Invalidates teams list and detail.
 */
export function useAdminDeleteTeam(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.delete(`/v1/admin/teams/${teamId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.teams.list() });
      qc.removeQueries({ queryKey: adminQueryKeys.teams.detail(teamId) });
    },
  });
}

// ---------- Roles ----------
/**
 * Lists all admin roles. Requires admin role.
 * Use when: loading the admin roles table or workspace/org role dropdown.
 * **Route:** GET /v1/admin/roles
 *
 * @returns React Query result with data: { items: AdminRole[] }.
 */
export function useAdminRoles() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.roles.list(),
    queryFn: async () => apiClient.get<{ items: AdminRole[] }>('/v1/admin/roles'),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

/**
 * Fetches all roles available for assignment in a workspace: system roles + workspace-specific custom roles.
 * Use this to populate role-picker dropdowns in member management UI.
 * **Route:** GET /v1/admin/workspaces/{workspaceId}/available-roles
 *
 * @param workspaceId - Workspace ID; undefined disables the query.
 * @returns React Query result with data: { items: AdminRole[] }, system roles listed first.
 */
export function useAvailableRoles(workspaceId: string | undefined) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: ['admin', 'workspaces', workspaceId, 'available-roles'],
    queryFn: async () =>
      apiClient.get<{ items: AdminRole[] }>(`/v1/admin/workspaces/${workspaceId}/available-roles`),
    enabled: isAuthenticated && isAdmin && !!workspaceId,
    staleTime: 60_000,
    retry: adminRetry,
  });
}

/**
 * Fetches a single admin role by ID. Requires admin role.
 * Use when: opening the role detail drawer or need current role for edit form.
 * **Route:** GET /v1/admin/roles/{roleId}
 *
 * @param roleId - Role UUID; undefined disables the query.
 * @returns React Query result with data: AdminRole.
 */
export function useAdminRole(roleId: string | undefined) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.roles.detail(roleId ?? ''),
    queryFn: async () => apiClient.get<AdminRole>(`/v1/admin/roles/${roleId}`),
    enabled: isAuthenticated && isAdmin && !!roleId,
    retry: adminRetry,
  });
}

/**
 * Creates a new admin role. Requires admin role.
 * Use when: submitting the create-role form in the admin roles drawer.
 * **Route:** POST /v1/admin/roles
 *
 * @returns Mutation; mutationFn accepts CreateRoleRequest. Data: AdminRole.
 */
export function useAdminCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateRoleRequest) =>
      apiClient.post<AdminRole>('/v1/admin/roles', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminQueryKeys.roles.list() }),
  });
}

/**
 * Updates an admin role by ID. Requires admin role.
 * Use when: saving edits from the role detail drawer.
 * **Route:** PATCH /v1/admin/roles/{roleId}
 *
 * @param roleId - Role UUID to update.
 * @returns Mutation; mutationFn accepts UpdateRoleRequest. Data: AdminRole.
 */
export function useAdminUpdateRole(roleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateRoleRequest) =>
      apiClient.patch<AdminRole>(`/v1/admin/roles/${roleId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.roles.list() });
      qc.invalidateQueries({ queryKey: adminQueryKeys.roles.detail(roleId) });
    },
  });
}

/**
 * Deletes an admin role. Requires admin role.
 * Use when: confirming delete from the role drawer or row actions.
 * **Route:** DELETE /v1/admin/roles/{roleId}
 *
 * @param roleId - Role UUID to delete.
 * @returns Mutation; no body. Invalidates roles list and detail.
 */
export function useAdminDeleteRole(roleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.delete(`/v1/admin/roles/${roleId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.roles.list() });
      qc.removeQueries({ queryKey: adminQueryKeys.roles.detail(roleId) });
    },
  });
}

// ---------- Connector instances ----------
/**
 * Lists all connector instances. Requires admin role.
 * Use when: loading the admin connectors table or connector dropdown.
 * **Route:** GET /v1/admin/connectors/instances
 *
 * @returns React Query result with data: { items: ConnectorInstance[] }.
 */
export function useAdminConnectorInstances() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.connectorInstances.list(),
    queryFn: async () => apiClient.get<{ items: ConnectorInstance[] }>('/v1/admin/connectors/instances'),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

/**
 * Fetches a single connector instance by ID. Requires admin role.
 * Use when: opening the connector detail drawer or need instance config for edit/preflight.
 * **Route:** GET /v1/admin/connectors/instances/{instanceId}
 *
 * @param instanceId - Instance UUID; undefined disables the query.
 * @returns React Query result with data: ConnectorInstance.
 */
export function useAdminConnectorInstance(instanceId: string | undefined) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.connectorInstances.detail(instanceId ?? ''),
    queryFn: async () => apiClient.get<ConnectorInstance>(`/v1/admin/connectors/instances/${instanceId}`),
    enabled: isAuthenticated && isAdmin && !!instanceId,
    retry: adminRetry,
  });
}

/**
 * Creates a new connector instance. Requires admin role.
 * Use when: submitting the create-connector form in the admin connectors drawer.
 * **Route:** POST /v1/admin/connectors/instances
 *
 * @returns Mutation; mutationFn accepts CreateConnectorInstanceRequest. Data: ConnectorInstance.
 */
export function useAdminCreateConnectorInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateConnectorInstanceRequest) =>
      apiClient.post<ConnectorInstance>('/v1/admin/connectors/instances', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminQueryKeys.connectorInstances.list() }),
  });
}

/**
 * Deletes a connector instance. Requires admin role.
 * Use when: confirming delete from the connector drawer.
 * **Route:** DELETE /v1/admin/connectors/instances/{instanceId}
 *
 * @param instanceId - Instance UUID to delete.
 * @returns Mutation; no body. Invalidates instances list and detail.
 */
export function useAdminDeleteConnectorInstance(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.delete(`/v1/admin/connectors/instances/${instanceId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.connectorInstances.list() });
      qc.removeQueries({ queryKey: adminQueryKeys.connectorInstances.detail(instanceId) });
    },
  });
}

/**
 * Deletes any connector instance by id (for use in lists). Requires admin role.
 * Use when: row-level delete in the connectors table (instanceId from row).
 * **Route:** DELETE /v1/admin/connectors/instances/{instanceId}
 *
 * @returns Mutation; mutationFn accepts instanceId: string. Invalidates instances list and detail.
 */
export function useAdminDeleteConnectorInstanceById() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (instanceId: string) => apiClient.delete(`/v1/admin/connectors/instances/${instanceId}`),
    onSuccess: (_data, instanceId) => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.connectorInstances.list() });
      qc.removeQueries({ queryKey: adminQueryKeys.connectorInstances.detail(instanceId) });
    },
  });
}

// ---------- Workspace members (RBAC) ----------
/**
 * Lists workspace members (RBAC). Requires admin, maker, or checker role.
 * Use when: loading the workspace members list or role assignment UI.
 * **Route:** GET /v1/workspaces/{workspaceId}/members
 *
 * @param workspaceId - Workspace UUID; undefined disables the query.
 * @returns React Query result with data: PaginatedWorkspaceMembers.
 */
export function useWorkspaceMembers(workspaceId: string | undefined) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.workspaceMembers(workspaceId ?? ''),
    queryFn: async () => {
      const res = await apiClient.get<PaginatedWorkspaceMembers>(
        `/v1/workspaces/${workspaceId}/members?limit=100`
      );
      return res;
    },
    enabled: isAuthenticated && (isAdmin || roles.includes('maker') || roles.includes('checker')) && !!workspaceId,
    retry: adminRetry,
  });
}

/**
 * Adds a member to a workspace. Requires admin role.
 * Use when: inviting a user to the workspace from the members tab.
 * **Route:** POST /v1/workspaces/{workspaceId}/members
 *
 * @param workspaceId - Workspace UUID.
 * @returns Mutation; mutationFn accepts AddWorkspaceMemberRequest. Data: WorkspaceMember.
 */
export function useAddWorkspaceMember(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: AddWorkspaceMemberRequest) =>
      apiClient.post<WorkspaceMember>(`/v1/workspaces/${workspaceId}/members`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.workspaceMembers(workspaceId) });
    },
  });
}

/**
 * Removes a member from a workspace. Requires admin role.
 * Use when: removing a user from the workspace in the members tab.
 * **Route:** DELETE /v1/workspaces/{workspaceId}/members/{userId}
 *
 * @param workspaceId - Workspace UUID.
 * @returns Mutation; mutationFn accepts userId: string. No response body.
 */
export function useRemoveWorkspaceMember(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      apiClient.delete(`/v1/workspaces/${workspaceId}/members/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.workspaceMembers(workspaceId) });
    },
  });
}

/**
 * Updates a user's roles in a workspace. Requires admin role.
 * Use when: saving role changes for a member in the workspace members UI.
 * **Route:** PUT /v1/workspaces/{workspaceId}/roles?userId=
 *
 * @param workspaceId - Workspace UUID.
 * @param userId - User ID to update.
 * @returns Mutation; mutationFn accepts UpdateUserRolesRequest. Data: UserRoles.
 */
export function useUpdateWorkspaceUserRoles(workspaceId: string, userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateUserRolesRequest) =>
      apiClient.put<UserRoles>(`/v1/workspaces/${workspaceId}/roles?userId=${encodeURIComponent(userId)}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.workspaceMembers(workspaceId) });
    },
  });
}

// ---------- Connectors catalog (for Add integration) ----------
/**
 * Lists available connectors catalog. Requires admin role.
 * Use when: populating the connector type dropdown in create-connector form.
 * **Route:** GET /v1/connectors
 *
 * @returns React Query result with data: { items: Connector[] }.
 */
export function useConnectorsCatalog() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.connectorsCatalog(),
    queryFn: async () => {
      const res = await apiClient.get<{ items: Connector[] }>('/v1/connectors');
      return res;
    },
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

// ---------- Credentials (ADR 0017) ----------
function buildCredentialsListParams(filters?: CredentialsListFilters): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.namespace) params.set('namespace', filters.namespace);
  if (filters.env) params.set('env', filters.env);
  if (filters.subjectType) params.set('subjectType', filters.subjectType);
  if (filters.subjectId) params.set('subjectId', filters.subjectId);
  if (filters.workspaceId) params.set('workspaceId', filters.workspaceId);
  if (filters.teamId) params.set('teamId', filters.teamId);
  if (filters.status) params.set('status', filters.status);
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.limit != null) params.set('limit', String(filters.limit));
  const q = params.toString();
  return q ? `?${q}` : '';
}

/**
 * Lists admin credentials with optional filters. Requires admin role.
 * Use when: loading the admin credentials table or credential dropdown.
 * **Route:** GET /v1/admin/credentials
 *
 * @param filters - Optional namespace, status, cursor, limit.
 * @returns React Query result with data: { items: Credential[], nextCursor, hasMore }.
 */
export function useAdminCredentials(filters?: CredentialsListFilters) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.credentials.list(filters),
    queryFn: async () =>
      apiClient.get<{ items: Credential[]; nextCursor: string | null; hasMore: boolean }>(
        `/v1/admin/credentials${buildCredentialsListParams(filters)}`
      ),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

/**
 * Fetches a single admin credential by ID. Requires admin role.
 * Use when: opening the credential detail drawer or edit form (metadata only).
 * **Route:** GET /v1/admin/credentials/{credentialId}
 *
 * @param credentialId - Credential UUID; undefined disables the query.
 * @returns React Query result with data: Credential.
 */
export function useAdminCredential(credentialId: string | undefined) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.credentials.detail(credentialId ?? ''),
    queryFn: async () => apiClient.get<Credential>(`/v1/admin/credentials/${credentialId}`),
    enabled: isAuthenticated && isAdmin && !!credentialId,
    retry: adminRetry,
  });
}

/**
 * Creates a new admin credential. Requires admin role.
 * Use when: submitting the create-credential form (secret write-once).
 * **Route:** POST /v1/admin/credentials
 *
 * @returns Mutation; mutationFn accepts CreateCredentialRequest. Data: Credential.
 */
export function useAdminCreateCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCredentialRequest) =>
      apiClient.post<Credential>('/v1/admin/credentials', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminCredentialsListQueryKey });
    },
  });
}

/**
 * Rotates an admin credential. Requires admin role.
 * Use when: user triggers rotate in the credential drawer (new secret write-once).
 * **Route:** POST /v1/admin/credentials/{credentialId}
 *
 * @param credentialId - Credential UUID to rotate.
 * @returns Mutation; mutationFn accepts RotateCredentialRequest. Data: Credential.
 */
export function useAdminRotateCredential(credentialId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: RotateCredentialRequest) =>
      apiClient.post<Credential>(`/v1/admin/credentials/${credentialId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminCredentialsListQueryKey });
      qc.invalidateQueries({ queryKey: adminQueryKeys.credentials.detail(credentialId) });
    },
  });
}

/**
 * Updates admin credential metadata. Requires admin role.
 * Use when: saving display name or other non-secret fields in the credential drawer.
 * **Route:** PATCH /v1/admin/credentials/{credentialId}
 *
 * @param credentialId - Credential UUID to update.
 * @returns Mutation; mutationFn accepts metadata body. Data: Credential.
 */
export function useAdminUpdateCredentialMetadata(credentialId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateCredentialMetadataRequest) =>
      apiClient.patch<Credential>(`/v1/admin/credentials/${credentialId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminCredentialsListQueryKey });
      qc.invalidateQueries({ queryKey: adminQueryKeys.credentials.detail(credentialId) });
    },
  });
}

/**
 * Deletes an admin credential. Requires admin role.
 * Use when: confirming delete from the credential drawer or row actions.
 * **Route:** DELETE /v1/admin/credentials/{credentialId}
 *
 * @param credentialId - Credential UUID to delete.
 * @returns Mutation; no body. Invalidates credentials list and detail.
 */
export function useAdminDeleteCredential(credentialId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.delete(`/v1/admin/credentials/${credentialId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminCredentialsListQueryKey });
      qc.removeQueries({ queryKey: adminQueryKeys.credentials.detail(credentialId) });
    },
  });
}

/** Lists MCP OAuth providers and profile options from backend contracts. */
export function useAdminMcpOAuthProviders() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: ['admin', 'mcp-oauth', 'providers'] as const,
    queryFn: async () => apiClient.get<{ items: McpOAuthProviderProfilesItem[] }>('/v1/admin/mcp/oauth/providers'),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

// ---------- Me credentials (ADR 0017) ----------
export const meCredentialsQueryKeys = {
  list: (filters?: { namespace?: string; status?: string; cursor?: string; limit?: number }) =>
    ['me', 'credentials', 'list', filters ?? {}] as const,
};

/**
 * Lists current user's credentials (me). Authenticated user.
 * Use when: loading the My Credentials workspace page or credential list for the current user.
 * **Route:** GET /v1/me/credentials
 *
 * @param filters - Optional namespace, status, cursor, limit.
 * @returns React Query result with data: { items: Credential[], nextCursor, hasMore }.
 */
export function useMeCredentials(filters?: { namespace?: string; status?: string; cursor?: string; limit?: number }) {
  const { isAuthenticated } = useAuth();
  const params = new URLSearchParams();
  if (filters?.namespace) params.set('namespace', filters.namespace);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.cursor) params.set('cursor', filters.cursor);
  if (filters?.limit != null) params.set('limit', String(filters.limit));
  const query = params.toString();
  return useQuery({
    queryKey: meCredentialsQueryKeys.list(filters),
    queryFn: async () =>
      apiClient.get<{ items: Credential[]; nextCursor: string | null; hasMore: boolean }>(
        `/v1/me/credentials${query ? `?${query}` : ''}`
      ),
    enabled: isAuthenticated,
    retry: (_count, err) => !(err instanceof Error && (err.message.includes('401') || err.message.includes('403'))),
  });
}

/**
 * Revokes current user's credential. Authenticated user.
 * Use when: user confirms revoke from the My Credentials list.
 * **Route:** DELETE /v1/me/credentials/{credentialId}
 *
 * @param credentialId - Credential UUID to revoke.
 * @returns Mutation; no body. Invalidates me credentials list.
 */
export function useMeRevokeCredential(credentialId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.delete(`/v1/me/credentials/${credentialId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meCredentialsQueryKeys.list() });
    },
  });
}

// ---------- Marketplace ----------
/**
 * Lists marketplace skill catalog. Requires admin role.
 * Use when: loading the marketplace catalog tab or skill picker for install.
 * **Route:** GET /v1/admin/marketplace
 *
 * @returns React Query result with data: { items: SkillCatalogItem[] }.
 */
export function useAdminMarketplace() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.marketplace(),
    queryFn: async () => apiClient.get<{ items: SkillCatalogItem[] }>('/v1/admin/marketplace'),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

/**
 * Lists installed marketplace skills. Requires admin role.
 * Use when: loading the installed skills tab or table in admin marketplace.
 * **Route:** GET /v1/admin/marketplace/installed
 *
 * @returns React Query result with data: { items: InstalledSkill[] }.
 */
export function useAdminMarketplaceInstalled() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.marketplaceInstalled(),
    queryFn: async () => apiClient.get<{ items: InstalledSkill[] }>('/v1/admin/marketplace/installed'),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

/**
 * Fetches a single installed skill by ID. Requires admin role.
 * Use when: opening the installed skill detail drawer or edit form.
 * **Route:** GET /v1/admin/marketplace/installed/{installedId}
 *
 * @param installedId - Installed skill UUID; undefined disables the query.
 * @returns React Query result with data: InstalledSkill.
 */
export function useAdminInstalledSkill(installedId: string | undefined) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.marketplaceInstalledDetail(installedId ?? ''),
    queryFn: async () => apiClient.get<InstalledSkill>(`/v1/admin/marketplace/installed/${installedId}`),
    enabled: isAuthenticated && isAdmin && !!installedId,
    retry: adminRetry,
  });
}

/**
 * Installs a skill from marketplace. Requires admin role.
 * Use when: user confirms install from the marketplace catalog (with workspace/env selection).
 * **Route:** POST /v1/admin/marketplace/installed
 *
 * @returns Mutation; mutationFn accepts body. Data: InstalledSkill.
 */
export function useAdminInstallSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: InstallSkillRequest) =>
      apiClient.post<InstalledSkill>('/v1/admin/marketplace/installed', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminQueryKeys.marketplaceInstalled() }),
  });
}

/**
 * Uninstalls a marketplace skill. Requires admin role.
 * Use when: user confirms uninstall from the installed skill drawer or row actions.
 * **Route:** DELETE /v1/admin/marketplace/installed/{installedId}
 *
 * @param installedId - Installed skill UUID to uninstall.
 * @returns Mutation; no body. Invalidates installed list and detail.
 */
export function useAdminUninstallSkill(installedId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.delete(`/v1/admin/marketplace/installed/${installedId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.marketplaceInstalled() });
      qc.removeQueries({ queryKey: adminQueryKeys.marketplaceInstalledDetail(installedId) });
    },
  });
}

// ---------- Billing ----------
/**
 * Fetches billing usage meters. Requires admin role.
 * Use when: loading the admin billing usage summary or dashboard.
 * **Route:** GET /v1/admin/billing/usage
 *
 * @param workspaceId - Optional workspace filter.
 * @returns React Query result with data: UsageMetersResponse.
 */
export function useAdminBillingUsage(workspaceId?: string) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.billingUsage(workspaceId),
    queryFn: async () =>
      apiClient.get<UsageMetersResponse>(`/v1/admin/billing/usage${workspaceId ? `?workspace_id=${workspaceId}` : ''}`),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

/**
 * Fetches billing usage history. Requires admin role.
 * Use when: loading the billing usage history table or export.
 * **Route:** GET /v1/admin/billing/usage-history
 *
 * @param workspaceId - Optional workspace filter.
 * @returns React Query result with data: UsageHistoryResponse.
 */
export function useAdminBillingUsageHistory(workspaceId?: string) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.billingUsageHistory(workspaceId),
    queryFn: async () =>
      apiClient.get<UsageHistoryResponse>(`/v1/admin/billing/usage-history${workspaceId ? `?workspace_id=${workspaceId}` : ''}`),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

/**
 * Lists billing budget caps. Requires admin role.
 * Use when: loading the admin billing budgets table or budget drawer.
 * **Route:** GET /v1/admin/billing/budgets
 *
 * @returns React Query result with data: { items: BudgetCap[] }.
 */
export function useAdminBillingBudgets() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.billingBudgets.list(),
    queryFn: async () => apiClient.get<{ items: BudgetCap[] }>('/v1/admin/billing/budgets'),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

/**
 * Creates or updates a budget cap. Requires admin role.
 * Use when: saving the budget cap form in the billing drawer.
 * **Route:** POST /v1/admin/billing/budgets
 *
 * @returns Mutation; mutationFn accepts UpsertBudgetCapRequest. Data: BudgetCap.
 */
export function useAdminUpsertBudgetCap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpsertBudgetCapRequest) =>
      apiClient.post<BudgetCap>('/v1/admin/billing/budgets', body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminQueryKeys.billingBudgets.list() });
    },
  });
}

/**
 * Deletes a budget cap. Requires admin role.
 * Use when: confirming delete from the billing budgets table or drawer.
 * **Route:** DELETE /v1/admin/billing/budgets/{budgetId}
 *
 * @param budgetId - Budget UUID to delete.
 * @returns Mutation; no body. Invalidates budgets list.
 */
export function useAdminDeleteBudgetCap(budgetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.delete(`/v1/admin/billing/budgets/${budgetId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.billingBudgets.list() });
      qc.removeQueries({ queryKey: adminQueryKeys.billingBudgets.detail(budgetId) });
    },
  });
}

/**
 * Lists payment methods. Requires admin role.
 * Use when: loading the admin billing payment methods section.
 * **Route:** GET /v1/admin/billing/payment-methods
 *
 * @returns React Query result with data: { items: AdminPaymentMethod[] }.
 */
export function useAdminPaymentMethods() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.billingPaymentMethods(),
    queryFn: async () =>
      apiClient.get<{ items: AdminPaymentMethod[] }>('/v1/admin/billing/payment-methods'),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

export interface CreatePaymentMethodApiRequest {
  providerCustomerId: string;
  paymentToken: string;
  setPrimary?: boolean;
  displayName?: string | null;
}

export interface UpdatePaymentMethodApiRequest {
  displayName?: string | null;
  isDefault?: boolean | null;
}

/**
 * Adds a payment method. Requires admin role.
 * Use when: user submits add payment method form (e.g. card/bank) in billing.
 * **Route:** POST /v1/admin/billing/payment-methods
 *
 * @returns Mutation; mutationFn accepts AddPaymentMethodRequest. Data: AdminPaymentMethod.
 */
export function useAdminAddPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreatePaymentMethodApiRequest) =>
      apiClient.post<AdminPaymentMethod>('/v1/admin/billing/payment-methods', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminQueryKeys.billingPaymentMethods() }),
  });
}

/**
 * Updates a payment method. Requires admin role.
 * Use when: saving set-primary or display name for a payment method in billing.
 * **Route:** PATCH /v1/admin/billing/payment-methods/{id}
 *
 * @returns Mutation; mutationFn accepts { id, ...body }. Data: AdminPaymentMethod.
 */
export function useAdminUpdatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdatePaymentMethodApiRequest & { id: string }) =>
      apiClient.patch<AdminPaymentMethod>(`/v1/admin/billing/payment-methods/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminQueryKeys.billingPaymentMethods() }),
  });
}

/**
 * Deletes a payment method. Requires admin role.
 * Use when: user confirms remove payment method in the billing section.
 * **Route:** DELETE /v1/admin/billing/payment-methods/{paymentMethodId}
 *
 * @param paymentMethodId - Payment method ID to delete.
 * @returns Mutation; no body. Invalidates payment methods list.
 */
export function useAdminDeletePaymentMethod(paymentMethodId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      apiClient.delete(`/v1/admin/billing/payment-methods/${paymentMethodId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminQueryKeys.billingPaymentMethods() }),
  });
}

// ---------- Policy packs ----------
/**
 * Lists policy packs. Requires admin role.
 * Use when: loading the admin policy packs table or policy pack dropdown.
 * **Route:** GET /v1/admin/policy-packs
 *
 * @returns React Query result with data: { items: AdminPolicyPack[] }.
 */
export function useAdminPolicyPacks() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.policyPacks.list(),
    queryFn: async () => apiClient.get<{ items: AdminPolicyPack[] }>('/v1/admin/policy-packs'),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

/**
 * Fetches a single policy pack by ID. Requires admin role.
 * Use when: opening the policy pack detail drawer or edit form.
 * **Route:** GET /v1/admin/policy-packs/{policyPackId}
 *
 * @param policyPackId - Policy pack UUID; undefined disables the query.
 * @returns React Query result with data: AdminPolicyPack.
 */
export function useAdminPolicyPack(policyPackId: string | undefined) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.policyPacks.detail(policyPackId ?? ''),
    queryFn: async () => apiClient.get<AdminPolicyPack>(`/v1/admin/policy-packs/${policyPackId}`),
    enabled: isAuthenticated && isAdmin && !!policyPackId,
    retry: adminRetry,
  });
}

/**
 * Creates a policy pack. Requires admin role.
 * Use when: submitting the create policy pack form in the admin drawer.
 * **Route:** POST /v1/admin/policy-packs
 *
 * @returns Mutation; mutationFn accepts CreatePolicyPackRequest. Data: AdminPolicyPack.
 */
export function useAdminCreatePolicyPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreatePolicyPackRequest) =>
      apiClient.post<AdminPolicyPack>('/v1/admin/policy-packs', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminQueryKeys.policyPacks.list() }),
  });
}

/**
 * Updates a policy pack. Requires admin role.
 * Use when: saving edits from the policy pack detail drawer.
 * **Route:** PATCH /v1/admin/policy-packs/{policyPackId}
 *
 * @param policyPackId - Policy pack UUID to update.
 * @returns Mutation; mutationFn accepts UpdatePolicyPackRequest. Data: AdminPolicyPack.
 */
export function useAdminUpdatePolicyPack(policyPackId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdatePolicyPackRequest) =>
      apiClient.patch<AdminPolicyPack>(`/v1/admin/policy-packs/${policyPackId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.policyPacks.list() });
      qc.invalidateQueries({ queryKey: adminQueryKeys.policyPacks.detail(policyPackId) });
    },
  });
}

/**
 * Deletes a policy pack. Requires admin role.
 * Use when: confirming delete from the policy pack drawer or row actions.
 * **Route:** DELETE /v1/admin/policy-packs/{policyPackId}
 *
 * @param policyPackId - Policy pack UUID to delete.
 * @returns Mutation; no body. Invalidates policy-packs list and detail.
 */
export function useAdminDeletePolicyPack(policyPackId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.delete(`/v1/admin/policy-packs/${policyPackId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.policyPacks.list() });
      qc.removeQueries({ queryKey: adminQueryKeys.policyPacks.detail(policyPackId) });
    },
  });
}

// ---------- Audit ----------
/**
 * Lists admin audit events with optional filters. Requires admin role.
 * Use when: loading the admin audit events table or event list with filters.
 * **Route:** GET /v1/admin/audit/events
 *
 * @param filters - Optional query params (workspaceId, actorId, action, from, to, etc.).
 * @param options - Optional { enabled } to disable the query.
 * @returns React Query result with data: { items: AuditEventItem[] }.
 */
export function useAdminAuditEvents(
  filters?: Record<string, string>,
  options?: { enabled?: boolean }
) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  const search = filters && Object.keys(filters).length ? `?${new URLSearchParams(filters).toString()}` : '';
  const enabled = options?.enabled !== false && isAuthenticated && isAdmin;
  return useQuery({
    queryKey: adminQueryKeys.auditEvents(filters),
    queryFn: async () => apiClient.get<{ items: AuditEventItem[] }>(`/v1/admin/audit/events${search}`),
    enabled,
    retry: adminRetry,
  });
}

/**
 * Fetches audit retention policy. Requires admin role.
 * Use when: loading the audit retention drawer or retention config.
 * **Route:** GET /v1/admin/audit/retention
 *
 * @returns React Query result with data: RetentionPolicy.
 */
export function useAdminAuditRetention() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.auditRetention(),
    queryFn: async () => apiClient.get<RetentionPolicy>('/v1/admin/audit/retention'),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

/**
 * Updates audit retention policy. Requires admin role.
 * Use when: saving retention policy from the audit retention drawer.
 * **Route:** PATCH /v1/admin/audit/retention
 *
 * @returns Mutation; mutationFn accepts RetentionPolicy body. Data: RetentionPolicy.
 */
export function useAdminUpdateAuditRetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateRetentionPolicyRequest) =>
      apiClient.patch<RetentionPolicy>('/v1/admin/audit/retention', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminQueryKeys.auditRetention() }),
  });
}

/**
 * Fetches audit storage usage. Requires admin role.
 * Use when: showing storage/archive stats in the audit retention drawer.
 * **Route:** GET /v1/admin/audit/storage-usage
 *
 * @param enabled - If false, query is disabled.
 * @returns React Query result with data: AuditStorageUsage.
 */
export function useAdminAuditStorageUsage(enabled = true) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.auditStorageUsage(),
    queryFn: async () => apiClient.get<AuditStorageUsage>('/v1/admin/audit/storage-usage'),
    enabled: isAuthenticated && isAdmin && enabled,
    retry: adminRetry,
  });
}

// ---------- Brand kits ----------
/**
 * Lists brand kits. Requires admin role.
 * Use when: loading the admin brand center brand kits tab or dropdown.
 * **Route:** GET /v1/admin/brand/brandkits
 *
 * @returns React Query result with data: { items: BrandKit[] }.
 */
export function useAdminBrandKits() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.brandKits.list(),
    queryFn: async () => apiClient.get<{ items: BrandKit[] }>('/v1/admin/brand/brandkits'),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

/**
 * Fetches a single brand kit by ID. Requires admin role.
 * Use when: opening the brand kit detail drawer or edit form.
 * **Route:** GET /v1/admin/brand/brandkits/{brandKitId}
 *
 * @param brandKitId - Brand kit UUID; undefined disables the query.
 * @returns React Query result with data: BrandKit.
 */
export function useAdminBrandKit(brandKitId: string | undefined) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.brandKits.detail(brandKitId ?? ''),
    queryFn: async () => apiClient.get<BrandKit>(`/v1/admin/brand/brandkits/${brandKitId}`),
    enabled: isAuthenticated && isAdmin && !!brandKitId,
    retry: adminRetry,
  });
}

/**
 * Creates a brand kit. Requires admin role.
 * Use when: submitting the create brand kit form in the admin brand center.
 * **Route:** POST /v1/admin/brand/brandkits
 *
 * @returns Mutation; mutationFn accepts CreateBrandKitRequest. Data: BrandKit.
 */
export function useAdminCreateBrandKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateBrandKitRequest) =>
      apiClient.post<BrandKit>('/v1/admin/brand/brandkits', body),
    onSuccess: (created) => {
      qc.setQueryData(
        adminQueryKeys.brandKits.list(),
        (old: { items: BrandKit[] } | undefined) => {
          if (!old?.items) return { items: [created] };
          if (old.items.some((k) => k.id === created.id)) {
            return { items: old.items.map((k) => (k.id === created.id ? { ...k, ...created } : k)) };
          }
          return { items: [...old.items, created] };
        }
      );
    },
  });
}

/**
 * Updates a brand kit. Requires admin role.
 * Use when: saving edits from the brand kit detail drawer.
 * **Route:** PATCH /v1/admin/brand/brandkits/{brandKitId}
 *
 * @param brandKitId - Brand kit UUID to update.
 * @returns Mutation; mutationFn accepts UpdateBrandKitRequest. Data: BrandKit.
 */
export function useAdminUpdateBrandKit(brandKitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateBrandKitRequest) =>
      apiClient.patch<BrandKit>(`/v1/admin/brand/brandkits/${brandKitId}`, body),
    onSuccess: (data) => {
      qc.setQueryData(adminQueryKeys.brandKits.detail(brandKitId), data);
      qc.setQueryData(
        adminQueryKeys.brandKits.list(),
        (old: { items: BrandKit[] } | undefined) => {
          if (!old?.items) return old;
          return {
            items: old.items.map((k) => (k.id === brandKitId ? { ...k, ...data } : k)),
          };
        }
      );
    },
  });
}

/**
 * PATCH brand kit with explicit id (avoids empty id when `selectedKit` is briefly null).
 * **Route:** PATCH /v1/admin/brand/brandkits/{brandKitId}
 */
export function useAdminPatchBrandKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateBrandKitRequest }) =>
      apiClient.patch<BrandKit>(`/v1/admin/brand/brandkits/${id}`, body),
    onSuccess: (data, { id }) => {
      qc.setQueryData(adminQueryKeys.brandKits.detail(id), data);
      qc.setQueryData(
        adminQueryKeys.brandKits.list(),
        (old: { items: BrandKit[] } | undefined) => {
          if (!old?.items) return old;
          return {
            items: old.items.map((k) => (k.id === id ? { ...k, ...data } : k)),
          };
        }
      );
    },
  });
}

/**
 * Deletes a brand kit. Requires admin role.
 * Use when: confirming delete from the brand kit drawer or row actions.
 * **Route:** DELETE /v1/admin/brand/brandkits/{brandKitId}
 *
 * @param brandKitId - Brand kit UUID to delete.
 * @returns Mutation; no body. Invalidates brandkits list and detail.
 */
export function useAdminDeleteBrandKit(brandKitId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.delete(`/v1/admin/brand/brandkits/${brandKitId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.brandKits.list() });
      qc.removeQueries({ queryKey: adminQueryKeys.brandKits.detail(brandKitId) });
    },
  });
}

// ---------- Brand Templates ----------
export interface CreateBrandTemplateRequest {
  name: string;
  brandKitId?: string | null;
}
export interface UpdateBrandTemplateRequest {
  name?: string;
  brandKitId?: string | null;
}
/**
 * Lists brand templates. Requires admin role.
 * Use when: loading the admin brand center templates tab or template dropdown.
 * **Route:** GET /v1/admin/brand/templates
 *
 * @returns React Query result with data: { items: BrandTemplate[] }.
 */
export function useAdminBrandTemplates() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.brandTemplates.list(),
    queryFn: async () => apiClient.get<{ items: BrandTemplate[] }>('/v1/admin/brand/templates'),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}

/**
 * Fetches a single brand template by ID. Requires admin role.
 * Use when: opening the template detail drawer or edit form.
 * **Route:** GET /v1/admin/brand/templates/{templateId}
 *
 * @param templateId - Template UUID; undefined disables the query.
 * @returns React Query result with data: BrandTemplate.
 */
export function useAdminBrandTemplate(templateId: string | undefined) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.brandTemplates.detail(templateId ?? ''),
    queryFn: async () => apiClient.get<BrandTemplate>(`/v1/admin/brand/templates/${templateId}`),
    enabled: isAuthenticated && isAdmin && !!templateId,
    retry: adminRetry,
  });
}
/**
 * Creates a brand template. Requires admin role.
 * Use when: submitting the create template form in the admin brand center.
 * **Route:** POST /v1/admin/brand/templates
 *
 * @returns Mutation; mutationFn accepts CreateBrandTemplateRequest. Data: BrandTemplate.
 */
export function useAdminCreateBrandTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateBrandTemplateRequest) =>
      apiClient.post<BrandTemplate>('/v1/admin/brand/templates', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminQueryKeys.brandTemplates.list() }),
  });
}
/**
 * Updates a brand template. Requires admin role.
 * Use when: saving edits from the template detail drawer.
 * **Route:** PATCH /v1/admin/brand/templates/{templateId}
 *
 * @param templateId - Template UUID to update.
 * @returns Mutation; mutationFn accepts UpdateBrandTemplateRequest. Data: BrandTemplate.
 */
export function useAdminUpdateBrandTemplate(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateBrandTemplateRequest) =>
      apiClient.patch<BrandTemplate>(`/v1/admin/brand/templates/${templateId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.brandTemplates.list() });
      qc.invalidateQueries({ queryKey: adminQueryKeys.brandTemplates.detail(templateId) });
    },
  });
}
/**
 * Deletes a brand template. Requires admin role.
 * Use when: confirming delete from the template drawer or row actions.
 * **Route:** DELETE /v1/admin/brand/templates/{templateId}
 *
 * @param templateId - Template UUID to delete.
 * @returns Mutation; no body. Invalidates templates list and detail.
 */
export function useAdminDeleteBrandTemplate(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.delete(`/v1/admin/brand/templates/${templateId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.brandTemplates.list() });
      qc.removeQueries({ queryKey: adminQueryKeys.brandTemplates.detail(templateId) });
    },
  });
}

// ---------- Brand Disclaimers ----------
export interface CreateLegalDisclaimerRequest {
  title: string;
  channel?: string;
}
export interface UpdateLegalDisclaimerRequest {
  title?: string;
  channel?: string;
}
/**
 * Lists brand disclaimers. Requires admin role.
 * Use when: loading the admin brand center disclaimers tab.
 * **Route:** GET /v1/admin/brand/disclaimers
 *
 * @returns React Query result with data: { items: LegalDisclaimer[] }.
 */
export function useAdminDisclaimers() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.disclaimers.list(),
    queryFn: async () => apiClient.get<{ items: LegalDisclaimer[] }>('/v1/admin/brand/disclaimers'),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}
/**
 * Fetches a single disclaimer by ID. Requires admin role.
 * Use when: opening the disclaimer detail drawer or edit form.
 * **Route:** GET /v1/admin/brand/disclaimers/{disclaimerId}
 *
 * @param disclaimerId - Disclaimer UUID; undefined disables the query.
 * @returns React Query result with data: LegalDisclaimer.
 */
export function useAdminDisclaimer(disclaimerId: string | undefined) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.disclaimers.detail(disclaimerId ?? ''),
    queryFn: async () => apiClient.get<LegalDisclaimer>(`/v1/admin/brand/disclaimers/${disclaimerId}`),
    enabled: isAuthenticated && isAdmin && !!disclaimerId,
    retry: adminRetry,
  });
}
/**
 * Creates a brand disclaimer. Requires admin role.
 * Use when: submitting the create disclaimer form in the admin brand center.
 * **Route:** POST /v1/admin/brand/disclaimers
 *
 * @returns Mutation; mutationFn accepts CreateDisclaimerRequest. Data: LegalDisclaimer.
 */
export function useAdminCreateDisclaimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateLegalDisclaimerRequest) =>
      apiClient.post<LegalDisclaimer>('/v1/admin/brand/disclaimers', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminQueryKeys.disclaimers.list() }),
  });
}
/**
 * Updates a brand disclaimer. Requires admin role.
 * Use when: saving edits from the disclaimer detail drawer.
 * **Route:** PATCH /v1/admin/brand/disclaimers/{disclaimerId}
 *
 * @param disclaimerId - Disclaimer UUID to update.
 * @returns Mutation; mutationFn accepts UpdateDisclaimerRequest. Data: LegalDisclaimer.
 */
export function useAdminUpdateDisclaimer(disclaimerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateLegalDisclaimerRequest) =>
      apiClient.patch<LegalDisclaimer>(`/v1/admin/brand/disclaimers/${disclaimerId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.disclaimers.list() });
      qc.invalidateQueries({ queryKey: adminQueryKeys.disclaimers.detail(disclaimerId) });
    },
  });
}
/**
 * Deletes a brand disclaimer. Requires admin role.
 * Use when: confirming delete from the disclaimer drawer or row actions.
 * **Route:** DELETE /v1/admin/brand/disclaimers/{disclaimerId}
 *
 * @param disclaimerId - Disclaimer UUID to delete.
 * @returns Mutation; no body. Invalidates disclaimers list and detail.
 */
export function useAdminDeleteDisclaimer(disclaimerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.delete(`/v1/admin/brand/disclaimers/${disclaimerId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.disclaimers.list() });
      qc.removeQueries({ queryKey: adminQueryKeys.disclaimers.detail(disclaimerId) });
    },
  });
}

// ---------- Brand Copy Guidelines ----------
export interface CreateCopyGuidelineRequest {
  name: string;
  category?: string;
  severity?: string;
  description?: string;
  forbiddenTerms?: { term: string; severity: string; reason: string }[];
  toneRules?: { dos?: string[]; donts?: string[] };
  examples?: { good: string; bad: string }[];
}
export interface UpdateCopyGuidelineRequest {
  name?: string;
  category?: string;
  severity?: string;
  description?: string;
  forbiddenTerms?: { term: string; severity: string; reason: string }[];
  toneRules?: { dos?: string[]; donts?: string[] };
  examples?: { good: string; bad: string }[];
}
/**
 * Lists brand copy guidelines. Requires admin role.
 * Use when: loading the admin brand center copy guidelines tab.
 * **Route:** GET /v1/admin/brand/copy-guidelines
 *
 * @returns React Query result with data: { items: CopyGuideline[] }.
 */
export function useAdminCopyGuidelines() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.copyGuidelines.list(),
    queryFn: async () => apiClient.get<{ items: CopyGuideline[] }>('/v1/admin/brand/copy-guidelines'),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}
/**
 * Fetches a single copy guideline by ID. Requires admin role.
 * Use when: opening the copy guideline detail drawer or edit form.
 * **Route:** GET /v1/admin/brand/copy-guidelines/{guidelineId}
 *
 * @param guidelineId - Guideline UUID; undefined disables the query.
 * @returns React Query result with data: CopyGuideline.
 */
export function useAdminCopyGuideline(guidelineId: string | undefined) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.copyGuidelines.detail(guidelineId ?? ''),
    queryFn: async () => apiClient.get<CopyGuideline>(`/v1/admin/brand/copy-guidelines/${guidelineId}`),
    enabled: isAuthenticated && isAdmin && !!guidelineId,
    retry: adminRetry,
  });
}
/**
 * Creates a copy guideline. Requires admin role.
 * Use when: submitting the create copy guideline form in the admin brand center.
 * **Route:** POST /v1/admin/brand/copy-guidelines
 *
 * @returns Mutation; mutationFn accepts CreateCopyGuidelineRequest. Data: CopyGuideline.
 */
export function useAdminCreateCopyGuideline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCopyGuidelineRequest) =>
      apiClient.post<CopyGuideline>('/v1/admin/brand/copy-guidelines', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminQueryKeys.copyGuidelines.list() }),
  });
}
/**
 * Updates a copy guideline. Requires admin role.
 * Use when: saving edits from the copy guideline detail drawer.
 * **Route:** PATCH /v1/admin/brand/copy-guidelines/{guidelineId}
 *
 * @param guidelineId - Guideline UUID to update.
 * @returns Mutation; mutationFn accepts UpdateCopyGuidelineRequest. Data: CopyGuideline.
 */
export function useAdminUpdateCopyGuideline(guidelineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateCopyGuidelineRequest) =>
      apiClient.patch<CopyGuideline>(`/v1/admin/brand/copy-guidelines/${guidelineId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.copyGuidelines.list() });
      qc.invalidateQueries({ queryKey: adminQueryKeys.copyGuidelines.detail(guidelineId) });
    },
  });
}
/**
 * Deletes a copy guideline. Requires admin role.
 * Use when: confirming delete from the copy guideline drawer or row actions.
 * **Route:** DELETE /v1/admin/brand/copy-guidelines/{guidelineId}
 *
 * @param guidelineId - Guideline UUID to delete.
 * @returns Mutation; no body. Invalidates copy-guidelines list and detail.
 */
export function useAdminDeleteCopyGuideline(guidelineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.delete(`/v1/admin/brand/copy-guidelines/${guidelineId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.copyGuidelines.list() });
      qc.removeQueries({ queryKey: adminQueryKeys.copyGuidelines.detail(guidelineId) });
    },
  });
}

// ---------- Brand Assets ----------
export interface CreateBrandAssetRequest {
  name: string;
  uri: string;
  assetType?: string;
  formats?: string[];
}
export interface UpdateBrandAssetRequest {
  name?: string;
  uri?: string;
  assetType?: string;
  formats?: string[];
}
/**
 * Lists brand assets. Requires admin role.
 * Use when: loading the admin brand center asset library tab.
 * **Route:** GET /v1/admin/brand/assets
 *
 * @returns React Query result with data: { items: BrandAsset[] }.
 */
export function useAdminBrandAssets() {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.brandAssets.list(),
    queryFn: async () => apiClient.get<{ items: BrandAsset[] }>('/v1/admin/brand/assets'),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}
/**
 * Fetches a single brand asset by ID. Requires admin role.
 * Use when: opening the asset detail drawer or edit form.
 * **Route:** GET /v1/admin/brand/assets/{assetId}
 *
 * @param assetId - Asset UUID; undefined disables the query.
 * @returns React Query result with data: BrandAsset.
 */
export function useAdminBrandAsset(assetId: string | undefined) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  return useQuery({
    queryKey: adminQueryKeys.brandAssets.detail(assetId ?? ''),
    queryFn: async () => apiClient.get<BrandAsset>(`/v1/admin/brand/assets/${assetId}`),
    enabled: isAuthenticated && isAdmin && !!assetId,
    retry: adminRetry,
  });
}
/**
 * Creates a brand asset. Requires admin role.
 * Use when: submitting the create asset form in the asset library.
 * **Route:** POST /v1/admin/brand/assets
 *
 * @returns Mutation; mutationFn accepts CreateBrandAssetRequest. Data: BrandAsset.
 */
export function useAdminCreateBrandAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateBrandAssetRequest) =>
      apiClient.post<BrandAsset>('/v1/admin/brand/assets', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminQueryKeys.brandAssets.list() }),
  });
}
/**
 * Updates a brand asset. Requires admin role.
 * Use when: saving edits from the asset detail drawer.
 * **Route:** PATCH /v1/admin/brand/assets/{assetId}
 *
 * @param assetId - Asset UUID to update.
 * @returns Mutation; mutationFn accepts UpdateBrandAssetRequest. Data: BrandAsset.
 */
export function useAdminUpdateBrandAsset(assetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateBrandAssetRequest) =>
      apiClient.patch<BrandAsset>(`/v1/admin/brand/assets/${assetId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.brandAssets.list() });
      qc.invalidateQueries({ queryKey: adminQueryKeys.brandAssets.detail(assetId) });
    },
  });
}
/**
 * Deletes a brand asset. Requires admin role.
 * Use when: confirming delete from the asset library drawer or row actions.
 * **Route:** DELETE /v1/admin/brand/assets/{assetId}
 *
 * @param assetId - Asset UUID to delete.
 * @returns Mutation; no body. Invalidates assets list and detail.
 */
export function useAdminDeleteBrandAsset(assetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.delete(`/v1/admin/brand/assets/${assetId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.brandAssets.list() });
      qc.removeQueries({ queryKey: adminQueryKeys.brandAssets.detail(assetId) });
    },
  });
}

export interface UploadBrandAssetResponse {
  uri: string;
}

/**
 * Uploads a brand asset (multipart). Requires admin role.
 * Use when: user uploads a file in the asset library (create asset flow).
 * **Route:** POST /v1/admin/brand/assets/upload
 *
 * @returns Mutation; mutationFn accepts FormData. Data: UploadBrandAssetResponse.
 */
export function useAdminUploadBrandAsset() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiClient.postFormData<UploadBrandAssetResponse>('/v1/admin/brand/assets/upload', formData);
    },
  });
}

// ---------- Brand Publish Events ----------
export interface PublishEventsFilters {
  workspaceId?: string;
  objectRef?: string;
  objectKind?: string;
  from?: string;
  to?: string;
}
/**
 * Lists brand publish events with optional filters. Requires admin role.
 * Use when: loading the publish history tab in the admin brand center.
 * **Route:** GET /v1/admin/brand/publish-events
 *
 * @param filters - Optional filters for publish events.
 * @returns React Query result with data: { items: BrandPublishEvent[] }.
 */
export function useAdminPublishEvents(filters?: PublishEventsFilters) {
  const { isAuthenticated, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  const search = filters
    ? '?' +
      Object.entries(filters)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  return useQuery({
    queryKey: adminQueryKeys.publishEvents(filters),
    queryFn: async () =>
      apiClient.get<{ items: BrandPublishEvent[] }>(`/v1/admin/brand/publish-events${search}`),
    enabled: isAuthenticated && isAdmin,
    retry: adminRetry,
  });
}
