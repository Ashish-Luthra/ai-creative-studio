import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Skeleton } from '@martechos/ui';
import { CheckCircle2, Search } from 'lucide-react';
import type { BrandPublishEvent } from '../../../hooks/useAdmin';
import { AdminRowActionsMenu } from '../AdminRowActionsMenu';
import { formatDateBrand } from './utils';

export interface PublishHistoryViewProps {
  events: BrandPublishEvent[];
  isLoading: boolean;
  onOpenEvent: (event: BrandPublishEvent) => void;
}

export function PublishHistoryView({ events, isLoading, onOpenEvent }: PublishHistoryViewProps) {
  const [search, setSearch] = useState('');
  const { t } = useTranslation('admin');
  const filtered = events.filter(
    (event) =>
      (event.objectRef ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (event.objectKind ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-center">
        <CheckCircle2 className="w-10 h-10 text-[#e5e5e5] mb-3" />
        <p className="text-sm text-[#666]">{t('brand.publishHistoryView.empty')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border border-[#e5e5e5] rounded-md">
        <div className="h-12 px-4 flex items-center justify-between border-b border-[#e5e5e5]">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium text-[#0d0d0d]">{t('brand.publishHistoryView.title')}</span>
            <span className="text-[13px] text-[#666]">{t('brand.publishHistoryView.eventsCount', { count: filtered.length })}</span>
          </div>
        </div>
        <div className="px-4 py-3 border-b border-[#e5e5e5]">
          <div className="relative w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
            <input
              type="text"
              placeholder={t('brand.publishHistoryView.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-9 pr-3 bg-[#fafafa] border border-[#e5e5e5] rounded-md text-[13px] placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d]"
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow hover={false} className="bg-[#fafafa] border-b border-[#e5e5e5]">
              <TableHead className="text-[11px] font-medium text-[#666] uppercase tracking-wide px-4 py-2">
                {t('brand.publishHistoryView.table.version')}
              </TableHead>
              <TableHead className="text-[11px] font-medium text-[#666] uppercase tracking-wide px-4 py-2">
                {t('brand.publishHistoryView.table.dateTime')}
              </TableHead>
              <TableHead className="text-[11px] font-medium text-[#666] uppercase tracking-wide px-4 py-2">
                {t('brand.publishHistoryView.table.object')}
              </TableHead>
              <TableHead className="text-[11px] font-medium text-[#666] uppercase tracking-wide px-4 py-2">
                {t('brand.publishHistoryView.table.type')}
              </TableHead>
              <TableHead className="text-[11px] font-medium text-[#666] uppercase tracking-wide px-4 py-2">
                {t('brand.publishHistoryView.table.publishedBy')}
              </TableHead>
              <TableHead className="text-[11px] font-medium text-[#666] uppercase tracking-wide px-4 py-2">
                {t('brand.publishHistoryView.table.workspace')}
              </TableHead>
              <TableHead className="text-[11px] font-medium text-[#666] uppercase tracking-wide px-4 py-2">
                {t('brand.publishHistoryView.table.status')}
              </TableHead>
              <TableHead className="w-12 px-4 py-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((event) => (
              <TableRow
                key={event.id}
                className="border-b border-[#e5e5e5] cursor-pointer hover:bg-[#fafafa]"
                onClick={() => onOpenEvent(event)}
              >
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
                    <span className="text-[13px] text-[#666] font-mono">v{event.toVersion}</span>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3 text-[12px] text-[#666] font-mono">
                  {formatDateBrand(event.publishedAt)}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-medium text-[#0d0d0d]">{event.objectRef}</span>
                    <span className="text-[11px] text-[#666] font-mono">{event.id}</span>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <span className="inline-flex items-center justify-center px-2 h-5 rounded text-[11px] font-medium bg-[#f5f5f5] text-[#666]">
                    {event.objectKind}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3 text-[13px] text-[#666]">{event.publishedBy}</TableCell>
                <TableCell className="px-4 py-3 text-[13px] text-[#666]">{event.workspaceId}</TableCell>
                <TableCell className="px-4 py-3 text-[13px] text-[#666]">
                  {event.status ?? t('brand.common.emDash')}
                </TableCell>
                <TableCell className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <AdminRowActionsMenu
                    actions={[{ label: t('brand.publishHistoryView.open'), onClick: () => onOpenEvent(event) }]}
                    aria-label={t('brand.publishHistoryView.actionsAria', {
                      objectRef: event.objectRef,
                      version: event.toVersion,
                    })}
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
