/**
 * Default workspace for admin create flows: prefer the user's current workspace when it exists in the list.
 */
export function preferredWorkspaceInList(
  authWorkspaceId: string | null | undefined,
  workspaceList: { id: string }[],
): string | null {
  if (!authWorkspaceId?.trim()) return null;
  return workspaceList.some((w) => w.id === authWorkspaceId) ? authWorkspaceId : null;
}
