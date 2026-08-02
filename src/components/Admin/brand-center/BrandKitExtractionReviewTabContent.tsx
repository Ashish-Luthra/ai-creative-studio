/**
 * Brand Kit drawer — Extraction review tab (Figma Make BrandKitExtractionReview alignment).
 * Loads candidates from GET /v1/brand/extraction-jobs + GET .../result; decisions POST to review-decisions.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Palette as PaletteIcon,
  Type,
  Image as ImageIcon,
  MessageSquare,
  Check,
  X,
  Edit3,
  FileCheck,
} from 'lucide-react';
import type { BrandKit } from '../../../hooks/useAdmin';
import type { BrandKitDrawerOperationalBinding } from '../../../brand/brandCenterOperationalTypes';
import type { ExtractionReviewDecision } from '../../../brand/brandCenterOperationalReducer';
import { apiClient, ApiClientError } from '../../../lib/api-client';
import type { components } from '../../../generated/openapi-types';
import {
  mapBrandExtractionResultToReviewRows,
  manualValueForAlternate,
  extractHttpImageUrl,
  type ExtractionCandidateRow,
  type ExtractionReviewSection,
} from '../../../utils/mapBrandExtractionResultToReviewRows';
import { isBrandKitSourcesDraftId } from './constants';

type Section = ExtractionReviewSection;
type UiStatus = ExtractionCandidateRow['uiStatus'];
type LoadPhase = 'idle' | 'loading' | 'success' | 'error' | 'partial';

type BrandExtractionJob = components['schemas']['BrandExtractionJob'];
type BrandExtractionResult = components['schemas']['BrandExtractionResult'];

const REVIEWABLE_STATUSES = new Set([
  'awaiting_review',
  'partially_completed',
  'completed',
  'generating_guidelines',
  'persisting',
]);

export interface BrandKitExtractionReviewTabContentProps {
  brandKit: BrandKit;
  operational: BrandKitDrawerOperationalBinding | null;
  /** Org-wide kits may require an approval handoff after review. */
  scopeIsOrgWide: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  /** Push accepted extraction rows to the parent so Tokens/Typography can reflect review decisions. */
  onAcceptedRowsForForm?: (rows: ExtractionCandidateRow[]) => void;
}

export type { ExtractionCandidateRow };

export function BrandKitExtractionReviewTabContent({
  brandKit,
  operational,
  scopeIsOrgWide,
  t,
  onAcceptedRowsForForm,
}: BrandKitExtractionReviewTabContentProps) {
  const [loadPhase, setLoadPhase] = useState<LoadPhase>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ExtractionCandidateRow[]>([]);
  const [activeSection, setActiveSection] = useState<Section | 'all'>('all');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [hasNoJobs, setHasNoJobs] = useState(false);
  const [hasJobsButNoReviewable, setHasJobsButNoReviewable] = useState(false);
  const [startingJob, setStartingJob] = useState(false);

  const kitNotPersisted = isBrandKitSourcesDraftId(brandKit.id);

  useEffect(() => {
    onAcceptedRowsForForm?.(candidates);
  }, [candidates, onAcceptedRowsForForm]);

  const fetchExtraction = useCallback(async () => {
    setLoadError(null);
    setReviewSubmitted(false);
    setHasNoJobs(false);
    setHasJobsButNoReviewable(false);
    setLoadPhase('loading');
    setJobId(null);
    try {
      if (isBrandKitSourcesDraftId(brandKit.id)) {
        setCandidates([]);
        setJobId(null);
        setLoadPhase('success');
        return;
      }

      const list = await apiClient.get<{ items?: BrandExtractionJob[]; page?: unknown }>(
        `/v1/brand/extraction-jobs?brandKitId=${encodeURIComponent(brandKit.id)}&limit=30`
      );
      const items = list.items ?? [];
      let chosenId: string | null = null;
      let partial = false;
      let result: BrandExtractionResult | null = null;

      for (const j of items) {
        const st = j.status;
        const rawJobId = (j as Record<string, unknown>).jobId ?? (j as Record<string, unknown>).job_id;
        const jid = typeof rawJobId === 'string' ? rawJobId.trim() : '';
        if (!jid) continue;
        if (typeof st === 'string' && REVIEWABLE_STATUSES.has(st)) {
          try {
            const r = await apiClient.get<BrandExtractionResult>(
              `/v1/brand/extraction-jobs/${encodeURIComponent(jid)}/result`
            );
            chosenId = jid;
            result = r;
            if (st === 'partially_completed') partial = true;
            break;
          } catch {
            /* try next job */
          }
        }
      }

      if (!chosenId || !result) {
        setCandidates([]);
        setJobId(null);
        setHasNoJobs(items.length === 0);
        setHasJobsButNoReviewable(items.length > 0);
        setLoadPhase('success');
        return;
      }

      setJobId(chosenId);
      setCandidates(mapBrandExtractionResultToReviewRows(result));
      setLoadPhase(partial ? 'partial' : 'success');
    } catch (e) {
      setLoadPhase('error');
      const msg =
        e instanceof ApiClientError ? e.error.message : e instanceof Error ? e.message : t('brand.brandKitDrawerContent.extractionReview.loadError');
      setLoadError(msg);
    }
  }, [brandKit.id, t]);

  useEffect(() => {
    void fetchExtraction();
  }, [brandKit.id, fetchExtraction]);

  const mergeServerOverview = operational?.mergeServerOverview;
  useEffect(() => {
    if (!mergeServerOverview || (loadPhase !== 'success' && loadPhase !== 'partial')) return;
    const pending = candidates.filter((c) => c.uiStatus === 'pending').length;
    const conflicts = candidates.filter((c) => c.conflict && c.uiStatus === 'pending').length;
    mergeServerOverview({
      pendingReviewCount: pending,
      conflictCount: conflicts,
      pendingExtractionCount: loadPhase === 'partial' ? 1 : 0,
    });
  }, [mergeServerOverview, candidates, loadPhase]);

  const filtered = useMemo(
    () => (activeSection === 'all' ? candidates : candidates.filter((c) => c.section === activeSection)),
    [candidates, activeSection]
  );

  const stats = useMemo(() => {
    const total = candidates.length;
    const pending = candidates.filter((c) => c.uiStatus === 'pending').length;
    const conflicts = candidates.filter((c) => c.conflict && c.uiStatus === 'pending').length;
    const accepted = candidates.filter((c) => c.uiStatus === 'accepted').length;
    return { total, pending, conflicts, accepted };
  }, [candidates]);

  const pendingForBulkActions = useMemo(() => {
    if (activeSection === 'all') {
      return candidates.filter((c) => c.uiStatus === 'pending').length;
    }
    return candidates.filter((c) => c.section === activeSection && c.uiStatus === 'pending').length;
  }, [candidates, activeSection]);

  const candidatesInActiveBulkScope = useCallback(
    (list: ExtractionCandidateRow[]) => {
      if (activeSection === 'all') return list;
      return list.filter((c) => c.section === activeSection);
    },
    [activeSection]
  );

  const decisionFor = useCallback(
    (key: string): ExtractionReviewDecision | undefined => operational?.state.extractionReview.decisionsByKey[key],
    [operational]
  );

  const postReview = useCallback(
    async (body: Record<string, unknown>) => {
      if (!jobId) return;
      await apiClient.post(`/v1/brand/extraction-jobs/${encodeURIComponent(jobId)}/review-decisions`, body);
    },
    [jobId]
  );

  const applyDecision = async (id: string, decision: ExtractionReviewDecision, nextStatus: UiStatus, apiBody: Record<string, unknown>) => {
    try {
      await postReview(apiBody);
      operational?.act.setExtractionDecision(id, decision);
      setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, uiStatus: nextStatus } : c)));
    } catch {
      /* surface via toast later */
    }
  };

  const handleAccept = (id: string) =>
    applyDecision(id, 'accept_extracted', 'accepted', { action: 'approve', candidateId: id });

  const handleReject = (id: string) =>
    applyDecision(id, 'keep_current', 'rejected', { action: 'reject', candidateId: id });

  const handleOverride = (id: string) =>
    applyDecision(id, 'manual_override', 'accepted', { action: 'override', candidateId: id });

  const handleAlternate = async (id: string, value: string) => {
    const row = candidates.find((c) => c.id === id);
    if (!row || !jobId) return;
    try {
      await apiClient.post(`/v1/brand/extraction-jobs/${encodeURIComponent(jobId)}/review-decisions`, {
        action: 'override',
        candidateId: id,
        manualValue: manualValueForAlternate(row, value),
      });
      operational?.act.setExtractionDecision(id, 'accept_extracted');
      setCandidates((prev) =>
        prev.map((c) => (c.id === id ? { ...c, recommended: value, uiStatus: 'accepted' as const } : c))
      );
    } catch {
      /* noop */
    }
  };

  const handleUndo = async (id: string) => {
    if (!jobId) return;
    try {
      await apiClient.post(`/v1/brand/extraction-jobs/${encodeURIComponent(jobId)}/review-decisions`, {
        action: 'defer',
        candidateId: id,
      });
      operational?.act.unsetExtractionDecision(id);
      setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, uiStatus: 'pending' as const } : c)));
    } catch {
      /* noop */
    }
  };

  const selectedKeys = operational?.state.extractionReview.selectedKeys ?? [];
  const batchMode = operational?.state.extractionReview.batchMode ?? false;

  const postBatch = useCallback(
    async (decisions: { action: string; candidateId: string }[]) => {
      if (!jobId || decisions.length === 0) return;
      await apiClient.post(`/v1/brand/extraction-jobs/${encodeURIComponent(jobId)}/review-decisions/batch`, {
        decisions,
      });
    },
    [jobId]
  );

  const bulkAcceptSelected = async () => {
    const pendingIds = selectedKeys.filter((id) => {
      const c = candidates.find((x) => x.id === id);
      if (!c || c.uiStatus !== 'pending') return false;
      if (activeSection === 'all') return true;
      return c.section === activeSection;
    });
    try {
      await postBatch(pendingIds.map((id) => ({ action: 'approve', candidateId: id })));
      for (const id of pendingIds) {
        operational?.act.setExtractionDecision(id, 'accept_extracted');
      }
      setCandidates((prev) => prev.map((c) => (pendingIds.includes(c.id) ? { ...c, uiStatus: 'accepted' as const } : c)));
    } catch {
      /* noop */
    }
  };

  const bulkRejectSelected = async () => {
    const pendingIds = selectedKeys.filter((id) => {
      const c = candidates.find((x) => x.id === id);
      if (!c || c.uiStatus !== 'pending') return false;
      if (activeSection === 'all') return true;
      return c.section === activeSection;
    });
    try {
      await postBatch(pendingIds.map((id) => ({ action: 'reject', candidateId: id })));
      for (const id of pendingIds) {
        operational?.act.setExtractionDecision(id, 'keep_current');
      }
      setCandidates((prev) => prev.map((c) => (pendingIds.includes(c.id) ? { ...c, uiStatus: 'rejected' as const } : c)));
    } catch {
      /* noop */
    }
  };

  const rejectAllPending = async () => {
    const scope = candidatesInActiveBulkScope(candidates);
    const pendingIds = scope.filter((c) => c.uiStatus === 'pending').map((c) => c.id);
    try {
      await postBatch(pendingIds.map((id) => ({ action: 'reject', candidateId: id })));
      for (const id of pendingIds) {
        operational?.act.setExtractionDecision(id, 'keep_current');
      }
      setCandidates((prev) => prev.map((c) => (pendingIds.includes(c.id) ? { ...c, uiStatus: 'rejected' as const } : c)));
    } catch {
      /* noop */
    }
  };

  const acceptAllPending = async () => {
    const scope = candidatesInActiveBulkScope(candidates);
    const pendingIds = scope.filter((c) => c.uiStatus === 'pending').map((c) => c.id);
    try {
      await postBatch(pendingIds.map((id) => ({ action: 'approve', candidateId: id })));
      for (const id of pendingIds) {
        operational?.act.setExtractionDecision(id, 'accept_extracted');
      }
      setCandidates((prev) => prev.map((c) => (pendingIds.includes(c.id) ? { ...c, uiStatus: 'accepted' as const } : c)));
    } catch {
      /* noop */
    }
  };

  const startExtraction = async () => {
    if (isBrandKitSourcesDraftId(brandKit.id)) {
      setLoadError(t('brand.brandKitDrawerContent.extractionReview.saveKitFirstBody'));
      setLoadPhase('error');
      return;
    }
    setStartingJob(true);
    setLoadError(null);
    try {
      const listRes = await apiClient.get<{ items?: components['schemas']['BrandSource'][] }>(
        `/v1/brand/sources?brandKitId=${encodeURIComponent(brandKit.id)}&limit=100`
      );
      const items = listRes.items ?? [];
      const activeSourceIds = items.filter((s) => s.status === 'active').map((s) => s.sourceId).filter(Boolean);
      if (activeSourceIds.length === 0) {
        setLoadPhase('error');
        setLoadError(t('brand.brandKitDrawerContent.extractionReview.noActiveSourcesBody'));
        return;
      }
      await apiClient.post<BrandExtractionJob>('/v1/brand/extraction-jobs', {
        jobType: 'initial_extract',
        sourceIds: activeSourceIds,
        brandKitId: brandKit.id,
      });
      await fetchExtraction();
    } catch (e) {
      setLoadPhase('error');
      setLoadError(
        e instanceof ApiClientError
          ? e.error.message
          : e instanceof Error
            ? e.message
            : t('brand.brandKitDrawerContent.extractionReview.loadError')
      );
    } finally {
      setStartingJob(false);
    }
  };

  const sections: { id: Section | 'all'; labelKey: string; icon: typeof Sparkles }[] = [
    { id: 'all', labelKey: 'brand.brandKitDrawerContent.extractionReview.sections.all', icon: Sparkles },
    { id: 'logos', labelKey: 'brand.brandKitDrawerContent.extractionReview.sections.logos', icon: ImageIcon },
    { id: 'colors', labelKey: 'brand.brandKitDrawerContent.extractionReview.sections.colors', icon: PaletteIcon },
    { id: 'typography', labelKey: 'brand.brandKitDrawerContent.extractionReview.sections.typography', icon: Type },
    { id: 'voice', labelKey: 'brand.brandKitDrawerContent.extractionReview.sections.voice', icon: MessageSquare },
    { id: 'imagery', labelKey: 'brand.brandKitDrawerContent.extractionReview.sections.imagery', icon: ImageIcon },
  ];

  const renderCandidate = (candidate: ExtractionCandidateRow) => {
    const isAccepted = candidate.uiStatus === 'accepted';
    const isRejected = candidate.uiStatus === 'rejected';
    const decided = decisionFor(candidate.id);
    const previewUrl =
      candidate.imagePreviewUrl ?? extractHttpImageUrl(undefined, candidate.recommended);

    return (
      <div
        key={candidate.id}
        className={`border rounded-lg p-4 transition-colors ${
          candidate.conflict && candidate.uiStatus === 'pending'
            ? 'border-[#f59e0b] bg-[#fffbeb]'
            : isAccepted
              ? 'border-[#059669] bg-[#ecfdf5]'
              : isRejected
                ? 'border-[#e5e5e5] bg-[#fafafa] opacity-60'
                : 'border-[#e5e5e5] bg-white'
        }`}
      >
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[13px] font-medium text-[#0d0d0d] capitalize">
                {candidate.type.replace(/-/g, ' ')}
              </span>
              <span className="text-[10px] font-mono text-[#666] truncate">{candidate.id}</span>
              {candidate.conflict && candidate.uiStatus === 'pending' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[#fef3c7] text-[#92400e]">
                  <AlertTriangle className="w-3 h-3" aria-hidden />
                  {t('brand.brandKitDrawerContent.extractionReview.conflictBadge')}
                </span>
              ) : null}
              {isAccepted ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[#d1fae5] text-[#059669]">
                  <CheckCircle2 className="w-3 h-3" aria-hidden />
                  {t('brand.brandKitDrawerContent.extractionReview.acceptedBadge')}
                </span>
              ) : null}
              {isRejected ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-[#f5f5f5] text-[#666]">
                  {t('brand.brandKitDrawerContent.extractionReview.rejectedBadge')}
                </span>
              ) : null}
              {decided && !isRejected ? (
                <span className="text-[10px] text-[#666]">
                  {t(`brand.brandKitDrawerContent.operational.decision.${decided}`)}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#666] flex-wrap">
              {candidate.sources.map((src, i) => (
                <span key={i} className="flex items-center gap-1">
                  {src.source}
                  <span className="text-[#999]">{Math.round(src.confidence * 100)}%</span>
                  {src.explicit ? <span className="text-[10px] text-[#059669]">✓</span> : null}
                </span>
              ))}
            </div>
          </div>
          {operational && batchMode ? (
            <label className="flex items-center gap-1 text-[11px] text-[#666] shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedKeys.includes(candidate.id)}
                onChange={() => operational.act.toggleExtractionKey(candidate.id)}
                className="w-3.5 h-3.5 rounded border-[#e5e5e5]"
              />
              {t('brand.brandKitDrawerContent.operational.selectForBatch')}
            </label>
          ) : null}
        </div>

        <div className="mb-3">
          <div className="text-[11px] text-[#666] mb-1">{t('brand.brandKitDrawerContent.extractionReview.recommended')}</div>
          <div className="p-3 bg-white border border-[#e5e5e5] rounded space-y-2">
            {candidate.section === 'colors' ? (
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded border border-[#e5e5e5]"
                  style={{ backgroundColor: candidate.recommended }}
                />
                <span className="text-[13px] font-mono text-[#0d0d0d]">{candidate.recommended}</span>
              </div>
            ) : previewUrl ? (
              <div className="space-y-2">
                <div className="rounded-md overflow-hidden border border-[#e5e5e5] bg-[#fafafa] flex justify-center p-2">
                  <img
                    src={previewUrl}
                    alt=""
                    className="max-h-48 max-w-full object-contain"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="text-[12px] font-mono text-[#0d0d0d] break-all block">{candidate.recommended}</span>
              </div>
            ) : candidate.section === 'logos' ? (
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#999]" aria-hidden />
                <span className="text-[13px] text-[#0d0d0d]">{candidate.recommended}</span>
              </div>
            ) : (
              <span className="text-[13px] text-[#0d0d0d]">{candidate.recommended}</span>
            )}
          </div>
        </div>

        {candidate.alternates.length > 0 && candidate.uiStatus === 'pending' ? (
          <div className="mb-3">
            <div className="text-[11px] text-[#666] mb-1">{t('brand.brandKitDrawerContent.extractionReview.alternates')}</div>
            <div className="flex flex-wrap gap-2">
              {candidate.alternates.map((alt, i) => {
                const altUrl = extractHttpImageUrl(undefined, alt);
                return (
                <button
                  key={i}
                  type="button"
                  onClick={() => void handleAlternate(candidate.id, alt)}
                  className="p-2 border border-[#e5e5e5] rounded hover:border-[#5e6ad2] hover:bg-[#f0f0ff] transition-colors text-[12px]"
                >
                  {candidate.section === 'colors' ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded border border-[#e5e5e5]" style={{ backgroundColor: alt }} />
                      <span className="font-mono">{alt}</span>
                    </div>
                  ) : altUrl ? (
                    <span className="inline-flex flex-col items-center gap-1 max-w-[140px]">
                      <img
                        src={altUrl}
                        alt=""
                        className="h-14 w-auto max-w-full object-contain rounded border border-[#e5e5e5] bg-white"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <span className="font-mono text-[10px] text-[#666] truncate max-w-full">{alt}</span>
                    </span>
                  ) : (
                    alt
                  )}
                </button>
              );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2 pt-3 border-t border-[#f0f0f0] flex-wrap">
          {!isAccepted && !isRejected ? (
            <>
              <button
                type="button"
                disabled={!operational || !jobId}
                onClick={() => void handleAccept(candidate.id)}
                className="flex-1 min-w-[6rem] h-7 px-3 bg-[#059669] text-white rounded text-[12px] hover:bg-[#047857] transition-colors flex items-center justify-center gap-1 disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" aria-hidden />
                {t('brand.brandKitDrawerContent.extractionReview.accept')}
              </button>
              <button
                type="button"
                disabled={!operational || !jobId}
                onClick={() => void handleReject(candidate.id)}
                className="h-7 px-3 border border-[#e5e5e5] text-[#666] rounded text-[12px] hover:bg-[#f5f5f5] transition-colors flex items-center gap-1 disabled:opacity-40"
              >
                <X className="w-3.5 h-3.5" aria-hidden />
                {t('brand.brandKitDrawerContent.extractionReview.reject')}
              </button>
              <button
                type="button"
                disabled={!operational || !jobId}
                onClick={() => void handleOverride(candidate.id)}
                className="h-7 px-3 border border-[#e5e5e5] text-[#666] rounded text-[12px] hover:bg-[#f5f5f5] transition-colors flex items-center gap-1 disabled:opacity-40"
              >
                <Edit3 className="w-3.5 h-3.5" aria-hidden />
                {t('brand.brandKitDrawerContent.extractionReview.override')}
              </button>
            </>
          ) : isAccepted ? (
            <button
              type="button"
              disabled={!operational || !jobId}
              onClick={() => void handleUndo(candidate.id)}
              className="text-[12px] text-[#666] hover:text-[#0d0d0d] disabled:opacity-40"
            >
              {t('brand.brandKitDrawerContent.extractionReview.undo')}
            </button>
          ) : (
            <button
              type="button"
              disabled={!operational || !jobId}
              onClick={() => void handleUndo(candidate.id)}
              className="text-[12px] text-[#5e6ad2] hover:underline disabled:opacity-40"
            >
              {t('brand.brandKitDrawerContent.extractionReview.reopen')}
            </button>
          )}
        </div>
      </div>
    );
  };

  const showApprovalCallout =
    scopeIsOrgWide && stats.pending === 0 && stats.accepted > 0 && !reviewSubmitted;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-medium text-[#0d0d0d] mb-1">
          {t('brand.brandKitDrawerContent.extractionReview.title')}
        </h3>
        <p className="text-[12px] text-[#666]">{t('brand.brandKitDrawerContent.extractionReview.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => void fetchExtraction()}
          disabled={loadPhase === 'loading'}
          className="h-7 px-2 rounded text-[11px] border border-[#e5e5e5] hover:bg-[#fafafa] disabled:opacity-50"
        >
          {t('brand.brandKitDrawerContent.sources.retry')}
        </button>
        <button
          type="button"
          onClick={() => void startExtraction()}
          disabled={startingJob || loadPhase === 'loading' || kitNotPersisted}
          className="h-7 px-2 rounded text-[11px] bg-[#0d0d0d] text-white hover:bg-[#262626] disabled:opacity-50"
        >
          {startingJob
            ? t('brand.brandKitDrawerContent.extractionReview.startingExtraction')
            : t('brand.brandKitDrawerContent.extractionReview.startExtraction')}
        </button>
      </div>

      {loadPhase === 'loading' ? (
        <div className="space-y-2" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-lg bg-[#f5f5f5] animate-pulse border border-[#e5e5e5]" />
          ))}
        </div>
      ) : null}

      {loadPhase === 'error' && loadError ? (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-[12px] text-[#991b1b] space-y-2">
          <div className="font-medium">{t('brand.brandKitDrawerContent.extractionReview.loadFailedTitle')}</div>
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void fetchExtraction()}
            className="h-8 px-3 rounded-md text-[12px] bg-white border border-[#e5e5e5] hover:bg-[#fafafa]"
          >
            {t('brand.brandKitDrawerContent.sources.retry')}
          </button>
        </div>
      ) : null}

      {loadPhase === 'partial' && !kitNotPersisted ? (
        <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3 text-[12px] text-[#92400e] flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
          <div>
            <div className="font-medium mb-0.5">{t('brand.brandKitDrawerContent.extractionReview.partialTitle')}</div>
            <p>{t('brand.brandKitDrawerContent.extractionReview.partialBody')}</p>
          </div>
        </div>
      ) : null}

      {loadPhase === 'success' && kitNotPersisted ? (
        <div className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-4 text-[12px] text-[#1e3a8a] space-y-2">
          <div className="font-medium text-[#0d0d0d]">{t('brand.brandKitDrawerContent.extractionReview.saveKitFirstTitle')}</div>
          <p>{t('brand.brandKitDrawerContent.extractionReview.saveKitFirstBody')}</p>
        </div>
      ) : null}

      {loadPhase === 'success' && !kitNotPersisted && hasJobsButNoReviewable && candidates.length === 0 ? (
        <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-4 text-[12px] text-[#78350f] space-y-2">
          <div className="font-medium text-[#0d0d0d]">{t('brand.brandKitDrawerContent.extractionReview.jobsUnreviewableTitle')}</div>
          <p>{t('brand.brandKitDrawerContent.extractionReview.jobsUnreviewableBody')}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => void fetchExtraction()}
              className="h-8 px-3 rounded-md text-[12px] bg-white border border-[#e5e5e5] hover:bg-[#fafafa]"
            >
              {t('brand.brandKitDrawerContent.extractionReview.reload')}
            </button>
            <button
              type="button"
              onClick={() => void startExtraction()}
              disabled={startingJob || kitNotPersisted}
              className="h-8 px-3 rounded-md text-[12px] bg-[#0d0d0d] text-white hover:bg-[#262626] disabled:opacity-50"
            >
              {t('brand.brandKitDrawerContent.extractionReview.startExtraction')}
            </button>
          </div>
        </div>
      ) : null}

      {loadPhase === 'success' && !kitNotPersisted && hasNoJobs && candidates.length === 0 && !hasJobsButNoReviewable ? (
        <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-4 text-[12px] text-[#444] space-y-2">
          <div className="font-medium text-[#0d0d0d]">{t('brand.brandKitDrawerContent.extractionReview.noJobsTitle')}</div>
          <p>{t('brand.brandKitDrawerContent.extractionReview.noJobsBody')}</p>
        </div>
      ) : null}

      {(loadPhase === 'success' || loadPhase === 'partial') && !kitNotPersisted && !hasNoJobs && !hasJobsButNoReviewable ? (
        <>
          {operational ? (
            <label className="flex items-center gap-2 text-[13px] cursor-pointer">
              <input
                type="checkbox"
                checked={batchMode}
                onChange={(e) => operational.act.setExtractionBatchMode(e.target.checked)}
                className="w-4 h-4 rounded border-[#e5e5e5]"
              />
              {t('brand.brandKitDrawerContent.operational.batchMode')}
            </label>
          ) : null}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 bg-[#fafafa] rounded">
              <div className="text-[11px] text-[#666]">{t('brand.brandKitDrawerContent.extractionReview.statTotal')}</div>
              <div className="text-[18px] font-medium text-[#0d0d0d]">{stats.total}</div>
            </div>
            <div className="p-2 bg-[#fffbeb] rounded">
              <div className="text-[11px] text-[#92400e]">{t('brand.brandKitDrawerContent.extractionReview.statPending')}</div>
              <div className="text-[18px] font-medium text-[#92400e]">{stats.pending}</div>
            </div>
            <div className="p-2 bg-[#fef2f2] rounded">
              <div className="text-[11px] text-[#991b1b]">{t('brand.brandKitDrawerContent.extractionReview.statConflicts')}</div>
              <div className="text-[18px] font-medium text-[#991b1b]">{stats.conflicts}</div>
            </div>
            <div className="p-2 bg-[#ecfdf5] rounded">
              <div className="text-[11px] text-[#059669]">{t('brand.brandKitDrawerContent.extractionReview.statAccepted')}</div>
              <div className="text-[18px] font-medium text-[#059669]">{stats.accepted}</div>
            </div>
          </div>

          {showApprovalCallout ? (
            <div className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-3 text-[12px] text-[#1e40af] flex gap-2">
              <FileCheck className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
              <div className="flex-1">
                <div className="font-medium mb-0.5">{t('brand.brandKitDrawerContent.extractionReview.approvalReadyTitle')}</div>
                <p className="text-[11px] mb-2">{t('brand.brandKitDrawerContent.extractionReview.approvalReadyBody')}</p>
                <button
                  type="button"
                  onClick={() => setReviewSubmitted(true)}
                  className="h-7 px-3 rounded-md bg-[#1e40af] text-white text-[12px] hover:bg-[#1d4ed8]"
                >
                  {t('brand.brandKitDrawerContent.extractionReview.submitReview')}
                </button>
              </div>
            </div>
          ) : null}

          {reviewSubmitted ? (
            <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-[12px] text-[#166534]">
              {t('brand.brandKitDrawerContent.extractionReview.reviewSubmitted')}
            </div>
          ) : null}

          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-1.5 px-3 h-7 rounded text-[12px] transition-colors flex-shrink-0 ${
                    isActive ? 'bg-[#0d0d0d] text-white' : 'bg-[#f5f5f5] text-[#666] hover:bg-[#e5e5e5]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden />
                  {t(section.labelKey)}
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {filtered.length > 0 ? (
              filtered.map(renderCandidate)
            ) : (
              <div className="border border-[#e5e5e5] border-dashed rounded-lg p-8 text-center">
                <Sparkles className="w-8 h-8 text-[#e5e5e5] mx-auto mb-2" aria-hidden />
                <div className="text-[13px] text-[#666]">{t('brand.brandKitDrawerContent.extractionReview.sectionEmpty')}</div>
              </div>
            )}
          </div>

          {batchMode && selectedKeys.length > 0 && stats.pending > 0 ? (
            <div className="sticky bottom-0 pt-3 pb-1 bg-white border-t border-[#e5e5e5] -mx-1 px-1">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[12px] text-[#666]">
                  {t('brand.brandKitDrawerContent.extractionReview.batchSelected', { count: selectedKeys.length })}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void bulkRejectSelected()}
                    className="h-7 px-3 border border-[#e5e5e5] text-[#666] rounded text-[12px] hover:bg-[#f5f5f5]"
                  >
                    {t('brand.brandKitDrawerContent.extractionReview.rejectSelected')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void bulkAcceptSelected()}
                    className="h-7 px-3 bg-[#059669] text-white rounded text-[12px] hover:bg-[#047857]"
                  >
                    {t('brand.brandKitDrawerContent.extractionReview.acceptSelected')}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {pendingForBulkActions > 0 && !batchMode ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-[#f0f0f0]">
              <span className="text-[12px] text-[#666]">
                {t('brand.brandKitDrawerContent.extractionReview.pendingFooter', { count: pendingForBulkActions })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void rejectAllPending()}
                  className="h-7 px-3 border border-[#e5e5e5] text-[#666] rounded text-[12px] hover:bg-[#f5f5f5]"
                >
                  {t('brand.brandKitDrawerContent.extractionReview.rejectAllPending')}
                </button>
                <button
                  type="button"
                  onClick={() => void acceptAllPending()}
                  className="h-7 px-3 bg-[#059669] text-white rounded text-[12px] hover:bg-[#047857]"
                >
                  {t('brand.brandKitDrawerContent.extractionReview.acceptAllPending')}
                </button>
              </div>
            </div>
          ) : null}

          {operational ? (
            <button
              type="button"
              onClick={() => {
                operational.act.clearExtractionDecisions();
                void fetchExtraction();
              }}
              className="text-[12px] text-[#5e6ad2] hover:underline"
            >
              {t('brand.brandKitDrawerContent.operational.clearDecisions')}
            </button>
          ) : null}

          <p className="text-[11px] text-[#666]">{t('brand.brandKitDrawerContent.extractionReview.decisionsFooterNote')}</p>
        </>
      ) : null}
    </div>
  );
}
