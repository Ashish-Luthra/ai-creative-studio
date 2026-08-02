/**
 * Compact operational indicators for Brand Kit drawer (sync, review gate, conflicts).
 */
import { RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { BrandKitDrawerOperationalBinding } from '../../../brand/brandCenterOperationalTypes';

export interface BrandKitOperationalStatusBarProps {
  operational: BrandKitDrawerOperationalBinding;
  t: TFunction<'admin'>;
}

export function BrandKitOperationalStatusBar({ operational, t }: BrandKitOperationalStatusBarProps) {
  const { state, reviewGate } = operational;
  const sync = state.sourcesTab.sync;
  const g = state.guidelinesTab.generate;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-[#f0f0f0]">
      {sync.inFlight ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-[#dbeafe] text-[#1e40af]">
          <RefreshCw className="w-3 h-3 animate-spin" aria-hidden />
          {t('brand.brandKitDrawerContent.operational.statusBar.syncing')}
        </span>
      ) : sync.error ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-[#fee2e2] text-[#991b1b]">
          <AlertTriangle className="w-3 h-3" aria-hidden />
          {t('brand.brandKitDrawerContent.operational.statusBar.syncError')}
        </span>
      ) : state.overview.lastSuccessfulSyncAt ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-[#ecfdf5] text-[#059669]">
          <CheckCircle2 className="w-3 h-3" aria-hidden />
          {t('brand.brandKitDrawerContent.operational.statusBar.synced')}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-[#f5f5f5] text-[#666]">
          <Clock className="w-3 h-3" aria-hidden />
          {t('brand.brandKitDrawerContent.operational.statusBar.neverSynced')}
        </span>
      )}

      {reviewGate.requiresReview ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-[#fffbeb] text-[#92400e]">
          <AlertTriangle className="w-3 h-3" aria-hidden />
          {t('brand.brandKitDrawerContent.operational.statusBar.reviewRequired')}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-[#f0fdf4] text-[#166534]">
          <CheckCircle2 className="w-3 h-3" aria-hidden />
          {t('brand.brandKitDrawerContent.operational.statusBar.noBlockers')}
        </span>
      )}

      {state.overview.conflictCount > 0 ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-[#fef2f2] text-[#991b1b]">
          {t('brand.brandKitDrawerContent.operational.statusBar.conflicts', { count: state.overview.conflictCount })}
        </span>
      ) : null}

      {g.inFlight ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-[#f0f0ff] text-[#5e6ad2]">
          <RefreshCw className="w-3 h-3 animate-spin" aria-hidden />
          {t('brand.brandKitDrawerContent.operational.statusBar.guidelinesGenerating')}
        </span>
      ) : null}
    </div>
  );
}
