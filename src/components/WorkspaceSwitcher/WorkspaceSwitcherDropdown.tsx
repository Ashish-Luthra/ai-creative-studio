/**
 * Workspace switcher dropdown: trigger button + panel (portal). Used in app shell.
 * Data source: GET /v1/authz/organizations and GET /v1/authz/workspaces only.
 * On switch: setWorkspace + invalidate authz and workspace-scoped queries.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../components/Providers/AuthContext';
import { useAuthzOrganizations, useAuthzWorkspaces } from '../../hooks/useAuthz';
import { ApiClientError } from '../../lib/api-client';
import { WorkspaceSwitcherTrigger } from './WorkspaceSwitcherTrigger';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

export interface WorkspaceSwitcherDropdownProps {
  onCreateOrganization?: () => void;
  onCreateWorkspace?: () => void;
  canCreateWorkspace?: boolean;
  /** Shown inline in the trigger subtitle */
  environment?: string;
  /** Optional class for the trigger wrapper */
  className?: string;
}

export function WorkspaceSwitcherDropdown({
  onCreateOrganization,
  onCreateWorkspace,
  canCreateWorkspace = true,
  environment,
  className,
}: WorkspaceSwitcherDropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const { workspaceId, setWorkspace } = useAuth();
  const { data: orgsData, isError: orgsError, error: orgsErrorDetail } = useAuthzOrganizations({ limit: 200 });
  const { data: workspacesData, isError: workspacesError, error: workspacesErrorDetail } = useAuthzWorkspaces({ limit: 200 });

  const organizations = orgsData?.items ?? [];
  const workspaces = workspacesData?.items ?? [];
  const currentWorkspace = workspaces.find((w) => w.workspaceId === workspaceId);
  const currentOrgId = currentWorkspace?.organizationId ?? null;
  const currentOrg = organizations.find((o) => o.organizationId === currentOrgId);

  // Display: prefer slug when API returns it, else name, else id (authz-only; no legacy workspace list)
  const organizationName =
    (currentOrg ? (currentOrg.slug ?? currentOrg.name ?? currentOrgId) : currentOrgId) ?? t('workspaceSwitcher.organizationFallback');
  const workspaceName =
    (currentWorkspace ? (currentWorkspace.slug ?? currentWorkspace.workspaceName ?? workspaceId) : workspaceId) ?? t('workspaceSwitcher.workspaceFallback');
  const authzError = orgsError || workspacesError;

  function friendlyErrorMessage(err: unknown): { message: string; sugggestSignIn: boolean } {
    if (err instanceof ApiClientError) {
      if (err.status === 401 || err.status === 403) {
        return { message: t('workspaceSwitcher.permissionError'), sugggestSignIn: true };
      }
      if (err.status === 422) {
        return { message: t('workspaceSwitcher.requestError'), sugggestSignIn: false };
      }
      if (err.status >= 500) {
        return { message: t('workspaceSwitcher.serverError'), sugggestSignIn: false };
      }
    }
    return { message: t('workspaceSwitcher.unableToLoadWorkspaces'), sugggestSignIn: false };
  }

  const errorInfo = authzError
    ? friendlyErrorMessage(orgsErrorDetail ?? workspacesErrorDetail)
    : null;

  const handleWorkspaceChange = useCallback(
    (id: string) => {
      setWorkspace(id);
      setOpen(false);
      // Refetch authz and workspace-scoped data so UI shows data for the selected workspace
      queryClient.invalidateQueries({ queryKey: ['authz'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      if (id) {
        queryClient.invalidateQueries({ queryKey: ['goals', id] });
        queryClient.invalidateQueries({ queryKey: ['initiatives', id] });
        queryClient.invalidateQueries({ queryKey: ['workstreams', id] });
        queryClient.invalidateQueries({ queryKey: ['teams', id] });
        queryClient.invalidateQueries({ queryKey: ['executions'] });
        queryClient.invalidateQueries({ queryKey: ['reviews'] });
        queryClient.invalidateQueries({ queryKey: ['studio-conversation', id] });
        queryClient.invalidateQueries({ queryKey: ['planner-runs', id] });
      }
    },
    [setWorkspace, queryClient]
  );

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  return (
    <div className={className} ref={triggerRef}>
      <WorkspaceSwitcherTrigger
        organizationName={organizationName}
        workspaceName={workspaceName}
        onClick={() => setOpen((v) => !v)}
        isOpen={open}
        environment={environment}
        aria-expanded={open}
        aria-haspopup="listbox"
      />
      {open &&
        createPortal(
          <WorkspaceSwitcher
            currentOrganizationId={currentOrgId}
            currentWorkspaceId={workspaceId}
            onWorkspaceChange={handleWorkspaceChange}
            onClose={() => setOpen(false)}
            onCreateOrganization={onCreateOrganization}
            onCreateWorkspace={onCreateWorkspace}
            canCreateWorkspace={canCreateWorkspace}
            variant="modal"
            authzError={errorInfo?.message}
            authzSuggestSignIn={errorInfo?.sugggestSignIn}
          />,
          document.body
        )}
    </div>
  );
}
