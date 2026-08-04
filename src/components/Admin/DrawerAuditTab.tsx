/**
 * Shared Audit tab for admin detail drawers.
 * Wires to GET /v1/admin/audit/events with optional filters; shows only events for this entity when objectRefFilter is set.
 */
import { useAdminAuditEvents, type AuditEventItem } from '../../hooks/useAdmin';

export interface DrawerAuditTabProps {
  /** Optional query filters (workspace_id, actor, action, from, to). */
  filters?: Record<string, string>;
  /**
   * When set, only events whose objectRef matches one of resourceTypes + entityId are shown (e.g. role + role-123 → "role:role-123", "admin_role:role-123").
   * Backend stores objectRef as "resource_type:resource_id"; this filters client-side so each drawer shows only that entity's audit trail.
   */
  objectRefFilter?: { resourceTypes: string[]; entityId: string };
  /** Short description above the list. */
  description?: string;
  /** Message when API returns no events. */
  emptyMessage?: string;
  /** Whether the tab is active (skip fetch when drawer tab not visible). */
  enabled?: boolean;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function matchesObjectRef(event: AuditEventItem, resourceTypes: string[], entityId: string): boolean {
  const ref = event.objectRef ?? '';
  return resourceTypes.some((t) => ref === `${t}:${entityId}` || ref.startsWith(`${t}:${entityId}/`));
}

export function DrawerAuditTab({
  filters,
  objectRefFilter,
  description = 'Recent activity and change history.',
  emptyMessage = 'No events yet.',
  enabled = true,
}: DrawerAuditTabProps) {
  const { data, isLoading, error } = useAdminAuditEvents(filters ?? undefined, { enabled });
  const rawItems = (data?.items ?? []) as AuditEventItem[];
  const items = objectRefFilter
    ? rawItems.filter((ev) => matchesObjectRef(ev, objectRefFilter.resourceTypes, objectRefFilter.entityId))
    : rawItems;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-48 bg-[#e5e5e5] rounded animate-pulse" />
        <div className="space-y-2">
          <div className="h-14 w-full bg-[#fafafa] border border-[#e5e5e5] rounded-md animate-pulse" />
          <div className="h-14 w-full bg-[#fafafa] border border-[#e5e5e5] rounded-md animate-pulse" />
          <div className="h-14 w-full bg-[#fafafa] border border-[#e5e5e5] rounded-md animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-md bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-sm" role="alert">
        Failed to load audit events. {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        {description && <p className="text-[13px] text-[#666]">{description}</p>}
        <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-md p-6 text-center">
          <p className="text-[13px] text-[#666]">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {description && <p className="text-[13px] text-[#666]">{description}</p>}
      <div className="space-y-2">
        {items.map((ev) => (
          <div
            key={ev.id}
            className="bg-white border border-[#e5e5e5] rounded-md p-3"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[13px] font-medium text-[#0d0d0d]">{ev.action}</span>
              <span className="text-[12px] text-[#666] whitespace-nowrap">{formatTime(ev.time)}</span>
            </div>
            <div className="text-[12px] text-[#666] space-y-0.5">
              <div>Actor: {ev.actor}</div>
              {ev.objectRef && <div>Resource: {ev.objectRef}</div>}
              {ev.result != null && <div>Result: {ev.result}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
