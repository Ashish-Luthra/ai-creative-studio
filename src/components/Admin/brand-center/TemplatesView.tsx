import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Skeleton, StatusPill } from '@martechos/ui';
import { Layout, Plus, Search, Calendar, Smartphone, Mail, Target, MessageCircle } from 'lucide-react';
import type { BrandTemplate } from '../../../hooks/useAdmin';
import { AdminRowActionsMenu } from '../AdminRowActionsMenu';
import { formatDateBrand } from './utils';
import { TAB_ADD_LABEL_KEYS, PRIMARY_BUTTON_CLASS, TEMPLATE_TYPE_LABEL_KEYS } from './constants';
import { translateLabelKeyMap } from './brandCenterI18n';

export interface TemplatesViewProps {
  templates: BrandTemplate[];
  isLoading: boolean;
  onOpenTemplate: (template: BrandTemplate | null) => void;
  onOpenAudit: (template: BrandTemplate) => void;
  onDeleteTemplate: (template: BrandTemplate) => void;
}

export function TemplatesView({
  templates,
  isLoading,
  onOpenTemplate,
  onOpenAudit,
  onDeleteTemplate,
}: TemplatesViewProps) {
  const { t } = useTranslation('admin');
  const [search, setSearch] = useState('');
  const filtered = templates.filter(
    (tmpl) =>
      (tmpl.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (tmpl.id ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const plusIcon = <Plus size={16} />;

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Layout className="w-10 h-10 text-[#e5e5e5] mb-3" />
        <p className="text-sm text-[#666]">{t('brand.templatesView.emptySubtitle')}</p>
        <Button
          variant="primary"
          size="sm"
          icon={plusIcon}
          className={`mt-4 ${PRIMARY_BUTTON_CLASS}`}
          onClick={() => onOpenTemplate(null)}
        >
          {t(TAB_ADD_LABEL_KEYS.templates)}
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
            placeholder={t('brand.templatesView.searchPlaceholder')}
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
          onClick={() => onOpenTemplate(null)}
        >
          {t(TAB_ADD_LABEL_KEYS.templates)}
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>{t('brand.templatesView.colTemplate')}</TableHead>
              <TableHead className="min-w-[80px]">{t('brand.templatesView.colType')}</TableHead>
              <TableHead className="min-w-[120px]">{t('brand.templatesView.colFormats')}</TableHead>
              <TableHead className="min-w-[90px]">{t('brand.templatesView.colLocales')}</TableHead>
              <TableHead>{t('brand.templatesView.colStatus')}</TableHead>
              <TableHead className="min-w-[80px]">{t('brand.templatesView.colUsedIn')}</TableHead>
              <TableHead>{t('brand.templatesView.colLastUpdated')}</TableHead>
              <TableHead className="w-12" aria-label={t('brand.templatesView.colOverflow')}>
                {t('brand.templatesView.colOverflow')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((tmpl, index) => {
              const templateType = (tmpl.type ?? 'push').toLowerCase();
              const TemplateIcon =
                templateType === 'push'
                  ? Smartphone
                  : templateType === 'email'
                    ? Mail
                    : templateType === 'ads' || templateType === 'ad-creative'
                      ? Target
                      : templateType === 'inapp' || templateType === 'in-app-card'
                        ? MessageCircle
                        : Layout;
              const formatList = tmpl.formats ?? [];
              const localeCount = (tmpl.locales ?? []).length;
              const usedIn = tmpl.usedIn ?? 0;
              const typeLabel =
                translateLabelKeyMap(templateType, TEMPLATE_TYPE_LABEL_KEYS, t) || templateType || t('brand.common.emDash');
              return (
                <TableRow
                  key={tmpl.id}
                  onClick={() => onOpenTemplate(tmpl)}
                  className={`cursor-pointer ${index % 2 === 1 ? 'bg-[#fcfcfc]' : ''}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-gradient-to-br from-[#5e6ad2] to-[#4f46e5] flex items-center justify-center flex-shrink-0">
                        <TemplateIcon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[13px] font-medium text-[#0d0d0d] truncate max-w-[300px]">
                          {tmpl.name ?? t('brand.common.emDash')}
                        </span>
                        <span className="text-[11px] text-[#666] font-mono">{tmpl.id}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] text-[#0d0d0d]">{typeLabel}</TableCell>
                  <TableCell>
                    {formatList.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {formatList.slice(0, 4).map((f) => (
                          <span
                            key={f}
                            className="inline-flex items-center px-2 h-5 rounded text-[11px] font-medium bg-[#f5f5f5] text-[#666] border border-[#e5e5e5]"
                          >
                            {f}
                          </span>
                        ))}
                        {formatList.length > 4 && (
                          <span className="text-[11px] text-[#666]">+{formatList.length - 4}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[13px] text-[#666]">{t('brand.common.emDash')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] text-[#666]">
                    {localeCount === 0
                      ? t('brand.templatesView.localeCountZero')
                      : t('brand.templatesView.localeCount', { count: localeCount })}
                  </TableCell>
                  <TableCell>
                    {tmpl.status ? (
                      <StatusPill
                        status={tmpl.status as 'draft' | 'in_review' | 'approved' | 'in_progress' | 'completed'}
                        size="sm"
                      />
                    ) : (
                      <span className="text-[13px] text-[#666]">{t('brand.common.emDash')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] text-[#0d0d0d]">
                    {usedIn === 1 ? t('brand.templatesView.usedInPrOne') : t('brand.templatesView.usedInPrMany', { count: usedIn })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[#666] flex-shrink-0" />
                      <span className="text-[13px] text-[#0d0d0d]">{formatDateBrand(tmpl.lastUpdated)}</span>
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <AdminRowActionsMenu
                      actions={[
                        { label: t('brand.templatesView.actionOpen'), onClick: () => onOpenTemplate(tmpl) },
                        { label: t('brand.templatesView.actionViewAudit'), onClick: () => onOpenAudit(tmpl) },
                        { label: t('brand.templatesView.actionDelete'), onClick: () => onDeleteTemplate(tmpl), destructive: true },
                      ]}
                      aria-label={t('brand.templatesView.actionsFor', { name: tmpl.name ?? '' })}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
