/**
 * Workspace switcher panel: lists organizations and workspaces from GET /v1/authz/organizations
 * and GET /v1/authz/workspaces, allows switching current workspace. Ported from .figma-make-extract.
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  X,
  Plus,
  Building2,
  Users,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { useAuthzOrganizations, useAuthzWorkspaces } from '../../hooks/useAuthz';
import type { AccessibleOrganization, AccessibleWorkspace } from '../../hooks/useAuthz';

interface OrgForSwitcher {
  id: string;
  name: string;
  avatar?: string;
  role: string;
}

interface WorkspaceForSwitcher {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  type?: string;
  description?: string;
  isPinned?: boolean;
}

export interface WorkspaceSwitcherProps {
  currentOrganizationId: string | null;
  currentWorkspaceId: string | null;
  onWorkspaceChange: (workspaceId: string) => void;
  onOrganizationChange?: (organizationId: string) => void;
  onCreateOrganization?: () => void;
  onCreateWorkspace?: () => void;
  onClose: () => void;
  canCreateWorkspace?: boolean;
  variant?: 'dropdown' | 'modal';
  isLoading?: boolean;
  /** When authz endpoints return an error, show this message; keep previous workspace selected. */
  authzError?: string;
  /** When true, show a "sign in again" hint alongside the error */
  authzSuggestSignIn?: boolean;
}

/** Prefer slug for display when API returns it; otherwise name or id. */
function orgDisplayName(o: AccessibleOrganization): string {
  return (o.slug ?? o.name ?? o.organizationId) || o.organizationId;
}

function mapOrgs(orgs: AccessibleOrganization[]): OrgForSwitcher[] {
  return orgs.map((o) => ({
    id: o.organizationId,
    name: orgDisplayName(o),
    role: o.effectivePermission === 'admin' || o.effectivePermission?.includes('admin') ? 'Admin' : 'Member',
  }));
}

function mapWorkspaces(
  workspaces: AccessibleWorkspace[],
  orgs: AccessibleOrganization[]
): WorkspaceForSwitcher[] {
  const orgMap = new Map(orgs.map((o) => [o.organizationId, orgDisplayName(o)]));
  return workspaces.map((w) => ({
    id: w.workspaceId,
    name: (w.slug ?? w.workspaceName) || w.workspaceId,
    organizationId: w.organizationId,
    organizationName: orgMap.get(w.organizationId) ?? w.organizationId,
  }));
}

export function WorkspaceSwitcher({
  currentOrganizationId,
  currentWorkspaceId,
  onWorkspaceChange,
  onOrganizationChange,
  onCreateOrganization,
  onCreateWorkspace,
  onClose,
  canCreateWorkspace = true,
  variant = 'dropdown',
  isLoading: externalLoading,
  authzError,
  authzSuggestSignIn = false,
}: WorkspaceSwitcherProps) {
  const { t } = useTranslation('common');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(currentOrganizationId);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: orgsData, isLoading: orgsLoading } = useAuthzOrganizations({ limit: 200 });
  const { data: workspacesData, isLoading: workspacesLoading } = useAuthzWorkspaces({ limit: 200 });

  const isLoading = externalLoading ?? orgsLoading ?? workspacesLoading;
  const organizations = orgsData?.items ? mapOrgs(orgsData.items) : [];
  const workspaces = workspacesData?.items && orgsData?.items
    ? mapWorkspaces(workspacesData.items, orgsData.items)
    : [];

  useEffect(() => {
    if (searchInputRef.current) searchInputRef.current.focus();
  }, []);

  useEffect(() => {
    setSelectedOrgId((prev) => prev ?? currentOrganizationId ?? organizations[0]?.id ?? null);
  }, [currentOrganizationId, organizations]);

  const currentOrganization = organizations.find((o) => o.id === currentOrganizationId);
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);
  const orgWorkspaces = workspaces.filter((w) => w.organizationId === selectedOrgId);
  const filteredWorkspaces = orgWorkspaces.filter(
    (w) =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.organizationName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );
  const filteredOrganizations = organizations.filter((o) =>
    o.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const recentWorkspaces = workspaces.slice(0, 5);
  const filteredRecent = recentWorkspaces.filter(
    (w) =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.organizationName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasSearchResults =
    filteredWorkspaces.length > 0 ||
    filteredOrganizations.length > 0 ||
    filteredRecent.length > 0;

  const handleWorkspaceClick = (workspaceId: string) => {
    onWorkspaceChange(workspaceId);
    onClose();
  };

  const handleOrganizationClick = (organizationId: string) => {
    setSelectedOrgId(organizationId);
    onOrganizationChange?.(organizationId);
  };

  const panelClasses =
    variant === 'modal'
      ? 'w-full max-w-[600px] bg-white rounded-lg shadow-2xl border border-[#e5e5e5]'
      : 'w-[400px] bg-white rounded-lg shadow-xl border border-[#e5e5e5]';

  const content = (
    <div className={panelClasses} role="listbox" aria-label={t('workspaceSwitcher.switchWorkspace')}>
      <div className="px-4 py-3 border-b border-[#e5e5e5]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold text-[#0d0d0d]">{t('workspaceSwitcher.switchWorkspace')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f5f5f5] transition-colors"
            aria-label={t('workspaceSwitcher.close')}
          >
            <X className="w-4 h-4 text-[#666]" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999]" aria-hidden />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('workspaceSwitcher.searchPlaceholder')}
            className="w-full h-8 pl-8 pr-3 bg-[#fafafa] border border-[#e5e5e5] rounded-md text-[13px] placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d] focus:bg-white transition-colors"
            aria-label={t('workspaceSwitcher.searchPlaceholder')}
          />
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {authzError ? (
          <div className="px-4 py-3 border-b border-[#fde68a] bg-[#fffbeb]">
            <p className="text-[12px] text-[#92400e]">{authzError}</p>
            {authzSuggestSignIn && (
              <p className="text-[11px] text-[#b45309] mt-1">{t('workspaceSwitcher.signInHint')}</p>
            )}
          </div>
        ) : null}
        {isLoading ? (
          <div className="px-4 py-12 flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 text-[#999] animate-spin mb-3" aria-hidden />
            <span className="text-[13px] text-[#999]">{t('workspaceSwitcher.loadingWorkspaces')}</span>
          </div>
        ) : !hasSearchResults && searchQuery ? (
          <div className="px-4 py-12 flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-[#fafafa] border border-[#e5e5e5] flex items-center justify-center mb-3">
              <Search className="w-5 h-5 text-[#999]" />
            </div>
            <p className="text-[13px] font-medium text-[#0d0d0d] mb-1">{t('workspaceSwitcher.noResults')}</p>
            <p className="text-[12px] text-[#999] text-center max-w-[260px]">
              {t('workspaceSwitcher.noResultsFor', { query: searchQuery })}
            </p>
          </div>
        ) : (
          <>
            {!searchQuery && currentOrganization && currentWorkspace && (
              <div className="px-2 py-2 border-b border-[#e5e5e5]">
                <div className="px-2 py-1">
                  <span className="text-[11px] font-medium text-[#999] uppercase tracking-wide">{t('workspaceSwitcher.current')}</span>
                </div>
                <div className="px-2 py-2 bg-[#fafafa] rounded-md">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 rounded bg-gradient-to-br from-[#5e6ad2] to-[#4c5bc7] flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-semibold text-white">
                        {currentOrganization.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[13px] font-medium text-[#0d0d0d]">{currentOrganization.name}</span>
                    <span className="ml-auto px-1.5 py-0.5 bg-[#e5e5e5] rounded text-[10px] font-medium text-[#666]">
                      {currentOrganization.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    <span className="text-[12px] text-[#0d0d0d]">{currentWorkspace.name}</span>
                  </div>
                </div>
              </div>
            )}

            {!searchQuery && filteredRecent.length > 0 && (
              <div className="px-2 py-2 border-b border-[#e5e5e5]">
                <div className="px-2 py-1">
                  <span className="text-[11px] font-medium text-[#999] uppercase tracking-wide">{t('workspaceSwitcher.recent')}</span>
                </div>
                <div className="space-y-0.5">
                  {filteredRecent.slice(0, 5).map((ws) => (
                    <WorkspaceRow
                      key={ws.id}
                      workspace={ws}
                      isCurrent={ws.id === currentWorkspaceId}
                      onClick={() => handleWorkspaceClick(ws.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredWorkspaces.length > 0 && (
              <div className="px-2 py-2 border-b border-[#e5e5e5]">
                <div className="px-2 py-1">
                  <span className="text-[11px] font-medium text-[#999] uppercase tracking-wide">
                    {searchQuery ? t('workspaceSwitcher.workspaces') : t('workspaceSwitcher.allWorkspaces')}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {filteredWorkspaces.map((ws) => (
                    <WorkspaceRow
                      key={ws.id}
                      workspace={ws}
                      isCurrent={ws.id === currentWorkspaceId}
                      onClick={() => handleWorkspaceClick(ws.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredOrganizations.length > 0 && (
              <div className="px-2 py-2 border-b border-[#e5e5e5]">
                <div className="px-2 py-1">
                  <span className="text-[11px] font-medium text-[#999] uppercase tracking-wide">
                    {t('workspaceSwitcher.yourOrganizations')}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {filteredOrganizations.map((org) => (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => handleOrganizationClick(org.id)}
                      className={`w-full px-2 py-1.5 rounded-md text-left transition-colors flex items-center gap-2 ${
                        org.id === selectedOrgId ? 'bg-[#f0f0ff]' : 'hover:bg-[#fafafa]'
                      }`}
                    >
                      <div className="w-5 h-5 rounded bg-gradient-to-br from-[#5e6ad2] to-[#4c5bc7] flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-semibold text-white">
                          {org.name.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <span className="flex-1 min-w-0 text-[13px] truncate text-[#0d0d0d]">{org.name}</span>
                      <span className="px-1.5 py-0.5 bg-[#f5f5f5] border border-[#e5e5e5] rounded text-[10px] text-[#666] flex-shrink-0">
                        {org.role}
                      </span>
                      {org.id === selectedOrgId && (
                        <ChevronRight className="w-3.5 h-3.5 text-[#999] flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {organizations.length === 0 && workspaces.length === 0 && !searchQuery && (
              <div className="px-4 py-12 flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-[#fafafa] border border-[#e5e5e5] flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-[#999]" />
                </div>
                <p className="text-[13px] font-medium text-[#0d0d0d] mb-1">{t('workspaceSwitcher.noWorkspacesYet')}</p>
                <p className="text-[12px] text-[#999] text-center max-w-[260px]">
                  {t('workspaceSwitcher.noWorkspacesDescription')}
                </p>
              </div>
            )}

            {!searchQuery && (onCreateWorkspace || onCreateOrganization) && (
              <div className="px-2 py-2">
                <div className="space-y-0.5">
                  {onCreateWorkspace && (
                    <CreateActionRow
                      icon={<Plus className="w-4 h-4" />}
                      label={t('workspaceSwitcher.createWorkspace')}
                      onClick={canCreateWorkspace ? onCreateWorkspace : undefined}
                      disabled={!canCreateWorkspace}
                      tooltip={!canCreateWorkspace ? t('workspaceSwitcher.noCreatePermission') : undefined}
                    />
                  )}
                  {onCreateOrganization && (
                    <CreateActionRow
                      icon={<Building2 className="w-4 h-4" />}
                      label={t('workspaceSwitcher.createOrganization')}
                      onClick={onCreateOrganization}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (variant === 'modal') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/20"
        onClick={onClose}
        role="presentation"
      >
        <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Switch workspace">
          {content}
        </div>
      </div>
    );
  }

  return content;
}

function WorkspaceRow({
  workspace,
  isCurrent,
  onClick,
}: {
  workspace: WorkspaceForSwitcher;
  isCurrent: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-2 py-1.5 rounded-md text-left transition-colors flex items-center gap-2 ${
        isCurrent ? 'bg-[#f0f0ff]' : 'hover:bg-[#fafafa]'
      }`}
      aria-current={isCurrent ? 'true' : undefined}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={`text-[13px] truncate ${isCurrent ? 'font-medium text-[#0d0d0d]' : 'text-[#0d0d0d]'}`}
          >
            {workspace.name}
          </span>
        </div>
        {workspace.organizationName && (
          <div className="text-[11px] text-[#999] truncate">{workspace.organizationName}</div>
        )}
      </div>
      {isCurrent && (
        <div className="w-1.5 h-1.5 rounded-full bg-[#5e6ad2] flex-shrink-0" aria-hidden />
      )}
    </button>
  );
}

function CreateActionRow({
  icon,
  label,
  onClick,
  disabled,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  tooltip?: string;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-2 py-1.5 rounded-md text-left transition-colors flex items-center gap-2 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#fafafa]'
      }`}
    >
      <div className={disabled ? 'text-[#999]' : 'text-[#5e6ad2]'}>{icon}</div>
      <span className={`text-[13px] ${disabled ? 'text-[#999]' : 'text-[#5e6ad2] font-medium'}`}>
        {label}
      </span>
    </button>
  );
  if (disabled && tooltip) {
    return (
      <div className="relative group/tooltip">
        {button}
        <div
          className="absolute left-0 top-full mt-1 px-2 py-1 bg-[#0d0d0d] text-white text-[11px] rounded whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10"
          role="tooltip"
        >
          {tooltip}
        </div>
      </div>
    );
  }
  return button;
}
