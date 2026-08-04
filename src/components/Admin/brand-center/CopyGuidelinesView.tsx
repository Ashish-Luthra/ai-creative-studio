import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Skeleton, StatusPill } from '@martechos/ui';
import { Type, Plus, Search, MessageCircle, AlertTriangle } from 'lucide-react';
import type { CopyGuideline } from '../../../hooks/useAdmin';
import { AdminRowActionsMenu } from '../AdminRowActionsMenu';
import { formatDateBrand } from './utils';
import {
  TAB_ADD_LABEL_KEYS,
  PRIMARY_BUTTON_CLASS,
  COPY_GUIDELINE_CATEGORY_LABEL_KEYS,
  COPY_GUIDELINE_SEVERITY_LABEL_KEYS,
} from './constants';
import { translateLabelKeyMap } from './brandCenterI18n';

export interface CopyGuidelinesViewProps {
  copyGuidelines: CopyGuideline[];
  isLoading: boolean;
  onOpenCopyGuideline: (guideline: CopyGuideline | null) => void;
  onOpenAudit: (guideline: CopyGuideline) => void;
  onDeleteCopyGuideline: (guideline: CopyGuideline) => void;
}

export function CopyGuidelinesView({
  copyGuidelines,
  isLoading,
  onOpenCopyGuideline,
  onOpenAudit,
  onDeleteCopyGuideline,
}: CopyGuidelinesViewProps) {
  const { t } = useTranslation('admin');
  const [search, setSearch] = useState('');
  const filtered = copyGuidelines.filter(
    (c) =>
      (c.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.id ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const plusIcon = <Plus size={16} />;

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (copyGuidelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Type className="w-10 h-10 text-[#e5e5e5] mb-3" />
        <p className="text-sm text-[#666]">{t('brand.copyGuidelinesView.emptySubtitle')}</p>
        <Button
          variant="primary"
          size="sm"
          icon={plusIcon}
          className={`mt-4 ${PRIMARY_BUTTON_CLASS}`}
          onClick={() => onOpenCopyGuideline(null)}
        >
          {t(TAB_ADD_LABEL_KEYS['copy-guidelines'])}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border-b border-[#e5e5e5] px-0 py-3 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="relative w-[320px] flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
          <input
            type="text"
            placeholder={t('brand.copyGuidelinesView.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-9 pr-3 bg-[#fafafa] border border-[#e5e5e5] rounded-md text-[13px] placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d]"
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={plusIcon}
          className={`${PRIMARY_BUTTON_CLASS} flex-shrink-0`}
          onClick={() => onOpenCopyGuideline(null)}
        >
          {t(TAB_ADD_LABEL_KEYS['copy-guidelines'])}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow hover={false}>
            <TableHead>{t('brand.copyGuidelinesView.colTermRule')}</TableHead>
            <TableHead className="min-w-[90px]">{t('brand.copyGuidelinesView.colSeverity')}</TableHead>
            <TableHead className="min-w-[120px]">{t('brand.copyGuidelinesView.colCategory')}</TableHead>
            <TableHead>{t('brand.copyGuidelinesView.colStatus')}</TableHead>
            <TableHead>{t('brand.copyGuidelinesView.colLastUpdated')}</TableHead>
            <TableHead className="w-12" aria-label={t('brand.copyGuidelinesView.colOverflow')}>
              {t('brand.copyGuidelinesView.colOverflow')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((c) => (
            <TableRow key={c.id} onClick={() => onOpenCopyGuideline(c)} className="cursor-pointer">
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-gradient-to-br from-[#10b981] to-[#059669] flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-medium text-[#0d0d0d] truncate max-w-[300px]">
                      {c.name ?? t('brand.common.emDash')}
                    </span>
                    <span className="text-[11px] text-[#666] font-mono">{c.id}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="min-w-[90px]">
                {(c.severity ?? '').trim() ? (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 h-5 rounded text-[11px] font-medium uppercase tracking-wide ${
                      (c.severity ?? '') === 'critical'
                        ? 'bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]'
                        : (c.severity ?? '') === 'high'
                          ? 'bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]'
                          : (c.severity ?? '') === 'medium'
                            ? 'bg-[#fef9c3] text-[#854d0e] border border-[#fde047]'
                            : 'bg-[#dcfce7] text-[#166534] border border-[#86efac]'
                    }`}
                  >
                    {(c.severity ?? '') === 'critical' || (c.severity ?? '') === 'high' ? (
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    ) : null}
                    {translateLabelKeyMap(c.severity ?? '', COPY_GUIDELINE_SEVERITY_LABEL_KEYS, t) || (c.severity ?? '')}
                  </span>
                ) : (
                  <span className="text-[13px] text-[#666]">{t('brand.common.emDash')}</span>
                )}
              </TableCell>
              <TableCell className="min-w-[120px] text-[13px] text-[#0d0d0d]">
                {(c.category ?? '').trim()
                  ? translateLabelKeyMap(c.category ?? '', COPY_GUIDELINE_CATEGORY_LABEL_KEYS, t) || (c.category ?? '')
                  : t('brand.common.emDash')}
              </TableCell>
              <TableCell>
                {c.status ? (
                  <StatusPill
                    status={c.status as 'draft' | 'in_review' | 'approved' | 'in_progress' | 'completed'}
                    size="sm"
                  />
                ) : (
                  <span className="text-[13px] text-[#666]">{t('brand.common.emDash')}</span>
                )}
              </TableCell>
              <TableCell className="text-[13px] text-[#0d0d0d]">{formatDateBrand(c.lastUpdated)}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <AdminRowActionsMenu
                  actions={[
                    { label: t('brand.copyGuidelinesView.actionOpen'), onClick: () => onOpenCopyGuideline(c) },
                    { label: t('brand.copyGuidelinesView.actionViewAudit'), onClick: () => onOpenAudit(c) },
                    { label: t('brand.copyGuidelinesView.actionDelete'), onClick: () => onDeleteCopyGuideline(c), destructive: true },
                  ]}
                  aria-label={t('brand.copyGuidelinesView.actionsFor', { name: c.name ?? '' })}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
