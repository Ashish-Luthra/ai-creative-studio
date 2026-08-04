/**
 * Signup and onboarding types aligned with contracts/openapi/openapi.yaml
 * (SignupRoleSelection, SignupResult, OnboardingSession, SetupProgressResponse, etc.)
 */

export type AccountType = 'brand' | 'agency';
export type AuthProvider = 'google' | 'microsoft' | 'sso' | 'email_password';

export interface SignupRoleSelectionRequest {
  accountType: AccountType;
}

export interface SignupRoleSelectionResponse {
  signupSessionId: string;
  accountType: AccountType;
}

export interface SignupEmailPasswordRequest {
  signupSessionId: string;
  accountType: AccountType;
  email: string;
  password: string;
  /** URL-safe username slug (required); stored as users.slug. */
  slug: string;
  inviteToken?: string | null;
  ssoOrgHint?: string | null;
}

export interface SignupOAuthStartRequest {
  signupSessionId: string;
  accountType: AccountType;
  authProvider: Extract<AuthProvider, 'google' | 'microsoft'>;
  inviteToken?: string | null;
}

export interface SignupSSOStartRequest {
  signupSessionId: string;
  accountType: AccountType;
  ssoOrgHint?: string | null;
  inviteToken?: string | null;
}

/** Response for OAuth/SSO start: URL to redirect the browser to (provider or IdP). */
export interface OAuthStartResponse {
  redirectUrl: string;
}

export interface SignupValidationState {
  code?:
    | 'MISSING_REQUIRED_FIELD'
    | 'INVALID_EMAIL'
    | 'WEAK_PASSWORD'
    | 'INVALID_SLUG'
    | 'SLUG_ALREADY_IN_USE'
    | 'ACCOUNT_ALREADY_EXISTS'
    | 'AUTH_FAILED'
    | 'SSO_DOMAIN_NOT_FOUND'
    | 'OAUTH_FAILED';
  message?: string;
}

export interface SignupResult {
  userId: string;
  email: string;
  emailVerified: boolean;
  authProvider: AuthProvider;
  accountType: AccountType;
  nextStep: 'onboarding_welcome' | 'join_existing_workspace' | 'workspace_home';
  orgId?: string | null;
  workspaceId?: string | null;
  isFirstVerifiedUserFromDomain?: boolean | null;
  validationState?: SignupValidationState | null;
  /** Set by backend when returning a session token after signup */
  token?: string;
}

export type OnboardingStep =
  | 'onboarding_welcome'
  | 'business_context'
  | 'tools_connectors'
  | 'setup_progress'
  | 'pricing_payment'
  | 'invites'
  | 'activation_home'
  | 'completed';

export type IndustryVertical =
  | 'BFSI'
  | 'E-commerce / Retail'
  | 'Healthcare'
  | 'Gaming'
  | 'Travel & Hospitality'
  | 'Telecom'
  | 'Media & Entertainment'
  | 'Education / EdTech'
  | 'SaaS / B2B'
  | 'Food Delivery / Quick Commerce'
  | 'Real Estate'
  | 'Automotive'
  | 'Consumer Subscription Apps'
  | 'Superapp / Marketplace';

export type ToolCategory =
  | 'analytics_attribution'
  | 'cdp_events'
  | 'crm_support'
  | 'creative_collaboration'
  | 'data_warehouse_bi'
  | 'messaging_delivery';

export interface ConnectorPreference {
  category: ToolCategory;
  toolName: string;
  priority?: number | null;
  source?: 'catalog' | 'other';
}

export interface BusinessContextStepRequest {
  accountType: AccountType;
  vertical?: IndustryVertical | null;
  websiteUrl?: string | null;
  appStoreUrl?: string | null;
  playStoreUrl?: string | null;
  socialHandles?: string[] | null;
  uploads?: string[] | null;
  description?: string | null;
  servedVerticals?: IndustryVertical[] | null;
  firstClientName?: string | null;
}

export interface ToolsConnectorsStepRequest {
  connectorPreferences?: ConnectorPreference[] | null;
  otherToolsText?: string | null;
  connectLater?: boolean;
}

/** Benefit item: string or { label, description } for plan comparison UI */
export type PlanBenefit = string | { label: string; description?: string };

/** Feature item for gating/display (id?, name, description?, limit?) */
export interface PlanFeature {
  id?: string;
  name: string;
  description?: string;
  limit?: string;
}

/** Plan from GET /v1/plans (plans catalog) */
export interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  displayOrder?: number;
  isActive?: boolean;
  minSeats?: number | null;
  maxSeats?: number | null;
  benefits?: PlanBenefit[] | null;
  features?: PlanFeature[] | null;
  currency?: string;
  monthlyAmountCents?: number | null;
  annualAmountCents?: number | null;
  annualSavingsPercent?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PricingPaymentStepRequest {
  planCode: string;
  billingCadence: 'monthly' | 'annual';
  seatEstimate?: number | null;
  paymentMethodRef?: string | null;
  sandboxFirst?: boolean;
}

export interface InvitesStepRequest {
  inviteEmails?: string[] | null;
  inviteAgency?: boolean | null;
  createFirstClientWorkspace?: boolean | null;
  skip?: boolean;
}

export interface CreateOnboardingSessionRequest {
  userId: string;
  accountType: AccountType;
  authProvider: AuthProvider;
  signupSessionId?: string | null;
}

export interface OnboardingBootstrapResult {
  workspaceId: string;
  accountType: AccountType;
  userRoleAssigned: 'admin' | 'member';
  brandRef?: string | null;
  agencyRef?: string | null;
  brandKitRef?: string | null;
  businessContextRef?: string | null;
  policyPackRef?: string | null;
  starterWorkstreamRefs?: string[] | null;
  connectorOnboardingRef?: string | null;
}

export type SetupChecklistStatus = 'todo' | 'in_progress' | 'done' | 'blocked';

export interface SetupChecklistItem {
  id: string;
  label: string;
  category: string;
  status: SetupChecklistStatus;
  reasonCode?: string | null;
}

export interface SetupProgressResponse {
  sessionId: string;
  currentStep: OnboardingStep;
  setupChecklist: SetupChecklistItem[];
  bootstrapResult?: OnboardingBootstrapResult | null;
}

export interface OnboardingSession {
  id: string;
  userId: string;
  accountType: AccountType;
  authProvider: AuthProvider;
  currentStep: OnboardingStep;
  status: 'in_progress' | 'waiting_background_jobs' | 'ready_for_activation' | 'completed';
  businessContext?: BusinessContextStepRequest | null;
  connectorPreferences?: ConnectorPreference[] | null;
  setupChecklist?: SetupChecklistItem[] | null;
  bootstrapResult?: OnboardingBootstrapResult | null;
  completedAt?: string | null;
}

export interface ActivationHomeSummaryCard {
  id: string;
  label: string;
  description?: string | null;
  type?: 'summary' | 'checklist' | 'recommendation';
}

export interface ActivationHomeCtaItem {
  id: string;
  label: string;
  href?: string | null;
  type?: 'primary' | 'secondary' | 'link';
}

export interface ActivationHomeResponse {
  sessionId: string;
  accountType: AccountType;
  summaryCards: ActivationHomeSummaryCard[];
  ctaItems: ActivationHomeCtaItem[];
}

/** POST /v1/auth/magic-link/request body. */
export interface MagicLinkRequest {
  email: string;
}

/** POST /v1/auth/magic-link/request response — always "sent" (no account enumeration). */
export interface MagicLinkRequestResult {
  status: 'sent';
}

/** POST /v1/auth/magic-link/verify body. */
export interface MagicLinkVerifyRequest {
  token: string;
}

/** POST /v1/auth/magic-link/verify response. */
export interface MagicLinkVerifyResult {
  /** App JWT (sub, workspaceId, roles, iss, exp). */
  token: string;
  userId: string;
  email: string;
  /** onboarding_welcome for newly created users, workspace_home for returning users. */
  nextStep: 'onboarding_welcome' | 'workspace_home';
}

/** How the user works — captured in the post-login workspace setup dialog. */
export type WorkspaceSetupRole = 'brand' | 'agency' | 'freelancer' | 'other';

/** PUT /v1/me/workspace-setup request body. */
export interface WorkspaceSetupRequest {
  role: WorkspaceSetupRole;
  website?: string | null;
}

/** Stored workspace setup profile for a user. */
export interface WorkspaceSetupProfile {
  role: WorkspaceSetupRole;
  website?: string | null;
  /** When setup was first completed (preserved across resubmissions). */
  completedAt: string;
}

/** GET/PUT /v1/me/workspace-setup response. */
export interface WorkspaceSetupState {
  completed: boolean;
  profile?: WorkspaceSetupProfile | null;
}
