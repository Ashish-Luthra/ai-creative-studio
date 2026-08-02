import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Skeleton, StatusPill } from '@martechos/ui';
import { Image, Plus, Search, Calendar } from 'lucide-react';
import type { BrandAsset } from '../../../hooks/useAdmin';
import { AdminRowActionsMenu } from '../AdminRowActionsMenu';
import { formatDateBrand } from './utils';
import { PRIMARY_BUTTON_CLASS, ASSET_TYPE_LABEL_KEYS } from './constants';
import { translateLabelKeyMap } from './brandCenterI18n';

export interface AssetLibraryViewProps {
  assets: BrandAsset[];
  isLoading: boolean;
  onOpenAsset: (asset: BrandAsset | null) => void;
  onDeleteAsset: (asset: BrandAsset) => void;
}

export function AssetLibraryView({
  assets,
  isLoading,
  onOpenAsset,
  onDeleteAsset,
}: AssetLibraryViewProps) {
  const { t } = useTranslation('admin');
  const [search, setSearch] = useState('');
  const filtered = assets.filter(
    (a) =>
      (a.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (a.id ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const plusIcon = <Plus size={16} />;

  const handleOpen = (asset: BrandAsset | null) => {
    onOpenAsset(asset);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-center">
        <Image className="w-10 h-10 text-[#e5e5e5] mb-3" />
        <p className="text-sm text-[#666]">{t('brand.assetsView.emptyDescription')}</p>
        <Button
          variant="primary"
          size="sm"
          icon={plusIcon}
          className={`mt-4 ${PRIMARY_BUTTON_CLASS}`}
          onClick={() => handleOpen(null)}
        >
          {t('brand.addActions.uploadAsset')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border border-[#e5e5e5] rounded-md">
        <div className="px-4 py-3 border-b border-[#e5e5e5] flex items-center justify-between">
          <div className="relative w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
            <input
              type="text"
              placeholder={t('brand.assetsView.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-9 pr-3 bg-[#fafafa] border border-[#e5e5e5] rounded-md text-[13px] placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d]"
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={plusIcon}
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => handleOpen(null)}
          >
            {t('brand.addActions.uploadAsset')}
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow hover={false} className="bg-[#fafafa] border-b border-[#e5e5e5]">
              <TableHead className="text-[11px] font-medium text-[#666] uppercase tracking-wide px-4 py-2">
                {t('brand.assetsView.colAsset')}
              </TableHead>
              <TableHead className="text-[11px] font-medium text-[#666] uppercase tracking-wide px-4 py-2">
                {t('brand.assetsView.colType')}
              </TableHead>
              <TableHead className="text-[11px] font-medium text-[#666] uppercase tracking-wide px-4 py-2">
                {t('brand.assetsView.colFormats')}
              </TableHead>
              <TableHead className="text-[11px] font-medium text-[#666] uppercase tracking-wide px-4 py-2">
                {t('brand.assetsView.colStatus')}
              </TableHead>
              <TableHead className="text-[11px] font-medium text-[#666] uppercase tracking-wide px-4 py-2">
                {t('brand.assetsView.colUsedIn')}
              </TableHead>
              <TableHead className="text-[11px] font-medium text-[#666] uppercase tracking-wide px-4 py-2">
                {t('brand.assetsView.colHash')}
              </TableHead>
              <TableHead className="text-[11px] font-medium text-[#666] uppercase tracking-wide px-4 py-2">
                {t('brand.assetsView.colLastUpdate')}
              </TableHead>
              <TableHead className="text-[11px] font-medium text-[#666] uppercase tracking-wide px-4 py-2 w-12">
                {t('brand.assetsView.colOverflow')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((asset) => {
              const typeVal = (asset.assetType ?? '').toLowerCase();
              const formatList = Array.isArray(asset.formats) ? asset.formats : [];
              const usedIn = asset.usedIn ?? 0;
              const hashShort = asset.hash ? `#${String(asset.hash).slice(0, 8)}` : t('brand.common.emDash');
              const typeLabel =
                translateLabelKeyMap(typeVal, ASSET_TYPE_LABEL_KEYS, t) || (asset.assetType ?? t('brand.common.emDash'));
              return (
                <TableRow
                  key={asset.id}
                  className="border-b border-[#e5e5e5] cursor-pointer hover:bg-[#fafafa] even:bg-[#fcfcfc]"
                  onClick={() => handleOpen(asset)}
                >
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-gradient-to-br from-[#06b6d4] to-[#0891b2] flex items-center justify-center shrink-0">
                        <Image className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-[#0d0d0d] truncate">{asset.name}</div>
                        <div className="text-[11px] text-[#666] font-mono">{asset.id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-[13px] text-[#0d0d0d]">{typeLabel}</TableCell>
                  <TableCell className="px-4 py-3">
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
                  <TableCell className="px-4 py-3">
                    <StatusPill
                      status={
                        (asset.status === 'active'
                          ? 'in_progress'
                          : asset.status === 'archived'
                            ? 'blocked'
                            : 'draft') as 'draft' | 'in_progress' | 'blocked'
                      }
                    />
                  </TableCell>
                  <TableCell className="px-4 py-3 text-[13px] text-[#0d0d0d]">
                    {usedIn === 1
                      ? t('brand.assetsView.templatesUsedOne')
                      : t('brand.assetsView.templatesUsedMany', { count: usedIn })}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span className="text-[12px] text-[#666] font-mono">{hashShort}</span>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[#666] shrink-0" />
                      <span className="text-[13px] text-[#0d0d0d]">{formatDateBrand(asset.lastUpdated)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 w-12" onClick={(e) => e.stopPropagation()}>
                    <AdminRowActionsMenu
                      actions={[
                        { label: t('brand.assetsView.actionOpen'), onClick: () => handleOpen(asset) },
                        { label: t('brand.assetsView.actionDelete'), onClick: () => onDeleteAsset(asset), destructive: true },
                      ]}
                      aria-label={t('brand.assetsView.actionsFor', { name: asset.name })}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
