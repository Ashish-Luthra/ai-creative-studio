import { useCallback } from 'react';
import { useAuth } from '../Providers/AuthContext';
import { useSubmitWorkspaceSetup, useWorkspaceSetupState } from '../../hooks/useWorkspaceSetup';
import type { WorkspaceSetupRole } from '../../types/signup-onboarding';
import { WorkspaceSetupModal } from './WorkspaceSetupModal';
import type { WorkspaceSetupValues } from './WorkspaceSetupModal';

/**
 * Shows the one-time workspace setup dialog after login until the user submits it.
 *
 * Completion state is hydrated from GET /v1/me/workspace-setup; submitting PUTs the
 * profile and updates the cached state, which hides the dialog. While the state is
 * loading — or if the fetch fails — nothing is rendered, so a backend outage never
 * blocks the app behind a modal or re-prompts a user who already completed setup.
 */
export function WorkspaceSetupController() {
  const { userId, isAuthenticated } = useAuth();
  const enabled = isAuthenticated && !!userId;
  const { data: setupState } = useWorkspaceSetupState(enabled ? userId : null);
  const submitSetup = useSubmitWorkspaceSetup(userId);

  const handleSubmit = useCallback(
    async (values: WorkspaceSetupValues) => {
      await submitSetup.mutateAsync({
        // Modal options are exactly the WorkspaceSetupRole values; its form state is just typed string.
        role: values.role as WorkspaceSetupRole,
        website: values.website || null,
      });
    },
    [submitSetup]
  );

  if (!enabled) return null;
  if (!setupState || setupState.completed) return null;

  return <WorkspaceSetupModal onSubmit={handleSubmit} />;
}
