import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Palette, Users, Calendar } from 'lucide-react';
import { BrandKitTableStatusPill, brandKitStatusToPill } from './BrandKitTableStatusPill';
import { AdminRowActionsMenu } from '../AdminRowActionsMenu';
import { PAGE_SIZE, TAB_ADD_LABEL_KEYS, PRIMARY_BUTTON_CLASS } from './constants';
import { brandKitOwnerLabel } from './brandCenterI18n';
import { formatDateBrand } from './utils';
import type { BrandKit } from '../../../hooks/useAdmin';
import type { BrandKitsListFilterStatus } from '../../../brand/brandCenterOperationalReducer';
import type { BrandKitsViewOperationalBinding } from '../../../brand/brandCenterOperationalTypes';

function kitMatchesStatusFilter(kit: BrandKit, statusFilter: BrandKitsListFilterStatus): boolean {
  if (statusFilter === 'all') return true;
  const s = (kit.status ?? '').toLowerCase();
  if (!s) return statusFilter === 'draft';
  if (statusFilter === 'draft') return s === 'draft' || s === 'in_progress' || s === 'in review';
  if (statusFilter === 'published') return s === 'published' || s === 'approved';
  if (statusFilter === 'archived') return s === 'archived';
  return true;
}

export interface BrandKitsViewProps {
  items: BrandKit[];
  isLoading: boolean;
  onOpenKit: (kit: BrandKit | null) => void;
  onOpenAudit: (kit: BrandKit) => void;
  onDeleteKit: (kit: BrandKit) => void;
  onClearCreateError?: () => void;
  selectedKitId?: string | null;
  workspaceLabelById?: Record<string, string>;
  /** Lifted Brand Center operational state (list filters, create-from-sources). */
  operational?: BrandKitsViewOperationalBinding | null;
}

function scopeLabelForKit(kit: BrandKit): 'org-wide' | 'workspace-specific' {
  return kit.scope === 'org' ? 'org-wide' : 'workspace-specific';
}

export function BrandKitsView({
  items,
  isLoading,
  onOpenKit,
  onOpenAudit,
  onDeleteKit,
  onClearCreateError,
  selectedKitId = null,
  workspaceLabelById = {},
  operational = null,
}: BrandKitsViewProps) {
  const { t } = useTranslation('admin');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const searchQuery = operational?.kitsList.filterQuery ?? localSearchQuery;
  const statusFilter = operational?.kitsList.statusFilter ?? 'all';

  const setSearchQuery = (q: string) => {
    if (operational) operational.act.setKitsFilterQuery(q);
    else setLocalSearchQuery(q);
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = items.filter((kit) => kitMatchesStatusFilter(kit, statusFilter));
    if (!q) return list;
    return list.filter((kit) => {
      const idMatch = kit.id.toLowerCase().includes(q);
      const nameMatch = kit.name.toLowerCase().includes(q);
      return idMatch || nameMatch;
    });
  }, [items, searchQuery, statusFilter]);

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="h-24 w-full animate-pulse rounded-md bg-[#f5f5f5]" aria-hidden />
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <Palette className="w-12 h-12 text-[#e5e5e5] mb-3" aria-hidden />
        <div className="text-[15px] font-medium text-[#0d0d0d] mb-1">{t('brand.kitsView.emptyTitle')}</div>
        <div className="text-[13px] text-[#666] mb-4 text-center">{t('brand.kitsView.emptyDescription')}</div>
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onClearCreateError?.();
              onOpenKit(null);
            }}
            className={`h-8 px-3 rounded-md text-[13px] transition-colors ${PRIMARY_BUTTON_CLASS}`}
          >
            {t(TAB_ADD_LABEL_KEYS.brandkits)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[480px] flex-col">
      <div className="bg-white border-b border-[#e5e5e5] px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="relative w-full max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" aria-hidden />
          <input
            type="search"
            placeholder={t('brand.kitsView.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full h-8 pl-9 pr-3 bg-[#fafafa] border border-[#e5e5e5] rounded-md text-[13px] placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d]"
            aria-label={t('brand.kitsView.searchAria')}
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {operational ? (
            <select
              value={statusFilter}
              onChange={(e) => {
                operational.act.setKitsStatusFilter(e.target.value as BrandKitsListFilterStatus);
                setPage(1);
              }}
              className="h-8 px-2 border border-[#e5e5e5] rounded-md text-[13px] bg-white text-[#0d0d0d]"
              aria-label={t('brand.kitsView.statusFilterLabel')}
            >
              <option value="all">{t('brand.kitsView.statusAll')}</option>
              <option value="draft">{t('brand.kitsView.statusDraft')}</option>
              <option value="published">{t('brand.kitsView.statusPublished')}</option>
              <option value="archived">{t('brand.kitsView.statusArchived')}</option>
            </select>
          ) : null}
          <button
            type="button"
            onClick={() => {
              onClearCreateError?.();
              onOpenKit(null);
            }}
            className={`h-8 px-3 rounded-md text-[13px] transition-colors flex items-center gap-2 ${PRIMARY_BUTTON_CLASS}`}
          >
            <Plus className="w-4 h-4" aria-hidden />
            {t(TAB_ADD_LABEL_KEYS.brandkits)}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[13px] text-[#666]">{t('brand.kitsView.noMatches')}</div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-[#fafafa] border-b border-[#e5e5e5] z-[1]">
              <tr>
                <th className="text-left px-6 py-2 text-[11px] font-medium text-[#666] uppercase tracking-wide">{t('brand.kitsView.colBrandKit')}</th>
                <th className="text-left px-6 py-2 text-[11px] font-medium text-[#666] uppercase tracking-wide">{t('brand.kitsView.colVersion')}</th>
                <th className="text-left px-6 py-2 text-[11px] font-medium text-[#666] uppercase tracking-wide">{t('brand.kitsView.colStatus')}</th>
                <th className="text-left px-6 py-2 text-[11px] font-medium text-[#666] uppercase tracking-wide">{t('brand.kitsView.colScope')}</th>
                <th className="text-left px-6 py-2 text-[11px] font-medium text-[#666] uppercase tracking-wide">{t('brand.kitsView.colWorkspacesUsing')}</th>
                <th className="text-left px-6 py-2 text-[11px] font-medium text-[#666] uppercase tracking-wide">{t('brand.kitsView.colOwner')}</th>
                <th className="text-left px-6 py-2 text-[11px] font-medium text-[#666] uppercase tracking-wide">{t('brand.kitsView.colLastUpdated')}</th>
                <th className="w-12" aria-hidden />
              </tr>
            </thead>
            <tbody className="bg-white">
              {paginated.map((kit, index) => {
                const scope = scopeLabelForKit(kit);
                const ws = kit.workspacesUsing ?? [];
                const wsLabel =
                  ws.length === 0
                    ? '—'
                    : ws.length === 1
                      ? workspaceLabelById[ws[0]] ?? ws[0]
                      : String(ws.length);
                const pillStatus = brandKitStatusToPill(kit.status);
                return (
                  <tr
                    key={kit.id}
                    onClick={() => onOpenKit(kit)}
                    className={`border-b border-[#e5e5e5] hover:bg-[#fafafa] transition-colors cursor-pointer ${
                      index % 2 === 1 ? 'bg-[#fcfcfc]' : ''
                    } ${selectedKitId === kit.id ? 'bg-[#f0f0f0]' : ''}`}
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-[#ec4899] to-[#f97316] flex items-center justify-center flex-shrink-0">
                          <Palette className="w-4 h-4 text-white" aria-hidden />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-medium text-[#0d0d0d] truncate">{kit.name}</span>
                          <span className="text-[11px] text-[#666] font-mono truncate">
                            {kit.id}@v{kit.version ?? '1'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-[13px] font-mono text-[#666]">v{kit.version ?? '1'}</span>
                    </td>
                    <td className="px-6 py-3">
                      <BrandKitTableStatusPill status={pillStatus} size="sm" />
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center justify-center px-2 h-5 rounded text-[11px] font-medium ${
                          scope === 'org-wide' ? 'bg-[#dbeafe] text-[#1e40af]' : 'bg-[#fef3c7] text-[#92400e]'
                        }`}
                      >
                        {scope === 'org-wide' ? t('brand.common.orgWide') : t('brand.common.workspace')}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Users className="w-3.5 h-3.5 text-[#666] flex-shrink-0" aria-hidden />
                        <span className="text-[13px] text-[#0d0d0d] truncate">{wsLabel}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-[13px] text-[#0d0d0d]">{brandKitOwnerLabel(kit.owner, t)}</span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-[#666]" aria-hidden />
                        <span className="text-[13px] text-[#0d0d0d]">{formatDateBrand(kit.lastUpdated)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                      <AdminRowActionsMenu
                        actions={[
                          { label: t('brand.kitsView.actionOpen'), onClick: () => onOpenKit(kit) },
                          { label: t('brand.kitsView.actionViewAudit'), onClick: () => onOpenAudit(kit) },
                          { label: t('brand.kitsView.actionDeleteBrandKit'), onClick: () => onDeleteKit(kit), destructive: true },
                        ]}
                        aria-label={t('brand.kitsView.actionsFor', { name: kit.name })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between py-2 px-6 border-t border-[#e5e5e5] bg-white flex-shrink-0">
          <span className="text-xs text-[#666]">
            {t('brand.kitsView.paginationRange', {
              from: (page - 1) * PAGE_SIZE + 1,
              to: Math.min(page * PAGE_SIZE, totalFiltered),
              total: totalFiltered,
            })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-8 px-3 text-[13px] border border-[#e5e5e5] rounded-md hover:bg-[#fafafa] disabled:opacity-50"
            >
              {t('common.previous')}
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-8 px-3 text-[13px] border border-[#e5e5e5] rounded-md hover:bg-[#fafafa] disabled:opacity-50"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
