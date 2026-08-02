import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Skeleton, StatusPill } from '@martechos/ui';
import { FileText, Plus, Search, Calendar, Globe } from 'lucide-react';
import type { LegalDisclaimer } from '../../../hooks/useAdmin';
import { AdminRowActionsMenu } from '../AdminRowActionsMenu';
import { formatDateBrand } from './utils';
import {
  TAB_ADD_LABEL_KEYS,
  PRIMARY_BUTTON_CLASS,
  DISCLAIMER_CHANNEL_LABEL_KEYS,
  DISCLAIMER_PLACEMENT_LABEL_KEYS,
  DISCLAIMER_LOCALE_LABEL_KEYS,
} from './constants';
import { translateLabelKeyMap } from './brandCenterI18n';

export interface DisclaimersViewProps {
  disclaimers: LegalDisclaimer[];
  isLoading: boolean;
  onOpenDisclaimer: (disclaimer: LegalDisclaimer | null) => void;
  onOpenAudit: (disclaimer: LegalDisclaimer) => void;
  onDeleteDisclaimer: (disclaimer: LegalDisclaimer) => void;
}

export function DisclaimersView({
  disclaimers,
  isLoading,
  onOpenDisclaimer,
  onOpenAudit,
  onDeleteDisclaimer,
}: DisclaimersViewProps) {
  const { t } = useTranslation('admin');
  const [search, setSearch] = useState('');
  const filtered = disclaimers.filter(
    (d) =>
      (d.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (d.channel ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const plusIcon = <Plus size={16} />;

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (disclaimers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FileText className="w-12 h-12 text-[#e5e5e5] mb-3" />
        <p className="text-[15px] font-medium text-[#0d0d0d] mb-1">{t('brand.disclaimersView.emptyTitle')}</p>
        <Button
          variant="primary"
          size="sm"
          icon={plusIcon}
          className={`mt-4 ${PRIMARY_BUTTON_CLASS}`}
          onClick={() => onOpenDisclaimer(null)}
        >
          {t(TAB_ADD_LABEL_KEYS.disclaimers)}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-[#e5e5e5] px-0 py-3 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="relative w-[320px] flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
          <input
            type="text"
            placeholder={t('brand.disclaimersView.searchPlaceholder')}
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
          onClick={() => onOpenDisclaimer(null)}
        >
          {t(TAB_ADD_LABEL_KEYS.disclaimers)}
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>{t('brand.disclaimersView.colDisclaimer')}</TableHead>
              <TableHead>{t('brand.disclaimersView.colChannel')}</TableHead>
              <TableHead>{t('brand.disclaimersView.colLocale')}</TableHead>
              <TableHead>{t('brand.disclaimersView.colRequired')}</TableHead>
              <TableHead>{t('brand.disclaimersView.colPlacement')}</TableHead>
              <TableHead>{t('brand.disclaimersView.colStatus')}</TableHead>
              <TableHead>{t('brand.disclaimersView.colLastUpdated')}</TableHead>
              <TableHead className="w-12" aria-label={t('brand.disclaimersView.colOverflow')}>
                {t('brand.disclaimersView.colOverflow')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d, index) => (
              <TableRow
                key={d.id}
                onClick={() => onOpenDisclaimer(d)}
                className={`cursor-pointer ${index % 2 === 1 ? 'bg-[#fcfcfc]' : ''}`}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-[#f59e0b] to-[#ea580c] flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] text-[#0d0d0d] truncate max-w-[300px]">{d.title ?? t('brand.common.emDash')}</span>
                      <span className="text-[11px] text-[#666] font-mono">{d.id}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-[13px] text-[#0d0d0d]">
                  {d.channel ? translateLabelKeyMap(d.channel, DISCLAIMER_CHANNEL_LABEL_KEYS, t) || d.channel : t('brand.common.emDash')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-[#666] flex-shrink-0" />
                    <span className="text-[13px] text-[#0d0d0d]">
                      {d.locale ? translateLabelKeyMap(d.locale, DISCLAIMER_LOCALE_LABEL_KEYS, t) || d.locale : t('brand.common.emDash')}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center justify-center px-2 h-5 rounded text-[11px] font-medium ${
                      d.required ? 'bg-[#fee2e2] text-[#991b1b]' : 'bg-[#f5f5f5] text-[#666]'
                    }`}
                  >
                    {d.required ? t('brand.disclaimersView.required') : t('brand.disclaimersView.optional')}
                  </span>
                </TableCell>
                <TableCell className="text-[13px] text-[#666]">
                  {d.placement ? translateLabelKeyMap(d.placement, DISCLAIMER_PLACEMENT_LABEL_KEYS, t) || d.placement : t('brand.common.emDash')}
                </TableCell>
                <TableCell>
                  {d.status ? (
                    <StatusPill
                      status={d.status as 'draft' | 'in_review' | 'approved' | 'in_progress' | 'completed'}
                      size="sm"
                    />
                  ) : (
                    <span className="text-[13px] text-[#666]">{t('brand.common.emDash')}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#666] flex-shrink-0" />
                    <span className="text-[13px] text-[#0d0d0d]">{formatDateBrand(d.lastUpdated)}</span>
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <AdminRowActionsMenu
                    actions={[
                      { label: t('brand.disclaimersView.actionOpen'), onClick: () => onOpenDisclaimer(d) },
                      { label: t('brand.disclaimersView.actionViewAudit'), onClick: () => onOpenAudit(d) },
                      { label: t('brand.disclaimersView.actionDelete'), onClick: () => onDeleteDisclaimer(d), destructive: true },
                    ]}
                    aria-label={t('brand.disclaimersView.actionsFor', { name: d.title ?? '' })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
