/**
 * Publish History drawer content — Figma Make PublishHistoryDrawerContent.
 * Tabs: Summary, Changes, Approvals, Audit. Read-only style.
 */
import { useTranslation } from 'react-i18next';
import { DrawerAuditTab } from '../DrawerAuditTab';
import { TabUnavailable } from '../TabUnavailable';

export interface PublishHistoryFormState {
  version?: string;
  date?: string;
  objectName?: string;
  objectId?: string;
  affectedWorkspaces?: string[];
  changesSummary?: string;
  changes?: { field: string; oldValue: string; newValue: string }[];
  approvers?: { name: string; role: string; timestamp: string }[];
  id?: string;
  publishedBy?: string;
  ipAddress?: string;
}

export interface PublishHistoryDrawerContentProps {
  data: PublishHistoryFormState;
  onDataChange?: (data: PublishHistoryFormState) => void;
  activeTab: string;
}

export function PublishHistoryDrawerContent({ data, activeTab }: PublishHistoryDrawerContentProps) {
  const { t } = useTranslation('admin');
  const affectedWorkspaces = data.affectedWorkspaces ?? [];
  const changes = data.changes ?? [];
  const approvers = data.approvers ?? [];

  if (activeTab === 'summary') {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-[11px] text-[#666] uppercase tracking-wide mb-1">{t('brand.drawer.publishHistory.version')}</div>
          <div className="text-[15px] font-medium text-[#0d0d0d] font-mono">{data.version ?? '—'}</div>
        </div>
        <div>
          <div className="text-[11px] text-[#666] uppercase tracking-wide mb-1">{t('brand.drawer.publishHistory.published')}</div>
          <div className="text-[13px] text-[#0d0d0d] font-mono">{data.date ?? '—'}</div>
        </div>
        <div>
          <div className="text-[11px] text-[#666] uppercase tracking-wide mb-1">{t('brand.drawer.publishHistory.object')}</div>
          <div className="text-[13px] font-medium text-[#0d0d0d]">{data.objectName ?? '—'}</div>
          <div className="text-[12px] text-[#666] font-mono mt-0.5">{data.objectId ?? '—'}</div>
        </div>
        <div>
          <div className="text-[11px] text-[#666] uppercase tracking-wide mb-2">{t('brand.drawer.publishHistory.affectedWorkspaces')}</div>
          <div className="space-y-1">
            {affectedWorkspaces.length === 0 ? (
              <div className="text-[13px] text-[#666]">{t('common.none')}</div>
            ) : (
              affectedWorkspaces.map((workspace, i) => (
                <div key={i} className="text-[13px] text-[#0d0d0d]">• {workspace}</div>
              ))
            )}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#666] uppercase tracking-wide mb-1">{t('brand.drawer.publishHistory.changesSummary')}</div>
          <div className="text-[13px] text-[#0d0d0d]">{data.changesSummary ?? '—'}</div>
        </div>
      </div>
    );
  }

  if (activeTab === 'changes') {
    return (
      <div className="space-y-4">
        <div className="text-[13px] font-medium text-[#0d0d0d] mb-3">{t('brand.drawer.publishHistory.fieldChanges')}</div>
        {changes.length === 0 ? (
          <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-md p-4 text-center text-[13px] text-[#666]">{t('brand.drawer.publishHistory.noChanges')}</div>
        ) : (
          changes.map((change, index) => (
            <div key={index} className="p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-md">
              <div className="text-[12px] font-medium text-[#666] uppercase mb-2">{change.field}</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-2 bg-[#fee2e2] border border-[#fecaca] rounded text-[12px] font-mono">{change.oldValue}</div>
                <div className="text-[#666]">→</div>
                <div className="flex-1 p-2 bg-[#d1fae5] border border-[#a7f3d0] rounded text-[12px] font-mono">{change.newValue}</div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  if (activeTab === 'approvals') {
    return (
      <div className="space-y-4">
        <div className="text-[13px] font-medium text-[#0d0d0d] mb-3">{t('brand.drawer.publishHistory.approvalTimeline')}</div>
        {approvers.length === 0 ? (
          <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-md p-4 text-center text-[13px] text-[#666]">{t('brand.drawer.publishHistory.noApprovers')}</div>
        ) : (
          approvers.map((approver, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[#10b981] mt-1.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-[13px] font-medium text-[#0d0d0d]">{approver.name}</div>
                <div className="text-[12px] text-[#666]">{approver.role}</div>
                <div className="text-[11px] text-[#999] font-mono mt-0.5">{approver.timestamp}</div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  if (activeTab === 'audit') {
    const filters: Record<string, string> = {};
    if (data.objectId) filters.object_ref = data.objectId;
    return (
      <DrawerAuditTab
        filters={Object.keys(filters).length > 0 ? filters : undefined}
        description={t('brand.drawer.publishHistory.auditDescription')}
        emptyMessage={t('brand.drawer.publishHistory.auditEmpty')}
        enabled={true}
      />
    );
  }

  return <TabUnavailable />;
}
