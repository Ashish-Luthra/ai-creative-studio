/**
 * Brand Kit drawer — Guidelines tab: list, generate, preview, and download PDFs via `/v1/brand/guidelines`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Download, RefreshCw, Eye, FileText, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import type { BrandKit } from '../../../hooks/useAdmin';
import type { BrandKitDrawerOperationalBinding } from '../../../brand/brandCenterOperationalTypes';
import { apiClient, ApiClientError } from '../../../lib/api-client';
import type { components } from '../../../generated/openapi-types';

type BrandGuidelinesDocument = components['schemas']['BrandGuidelinesDocument'];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  return d || iso;
}

function guidelinesFilePath(guidelinesId: string): string {
  return `/v1/brand/guidelines/${encodeURIComponent(guidelinesId)}/file`;
}

function saveBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

type GuidelineUiStatus = 'published' | 'generated' | 'draft' | 'failed' | 'archived';

function toUiStatus(doc: BrandGuidelinesDocument): GuidelineUiStatus {
  const s = doc.status;
  if (s === 'published' || s === 'generated' || s === 'failed' || s === 'draft') return s;
  return 'draft';
}

export interface BrandKitGuidelinesTabContentProps {
  brandKit: BrandKit;
  operational: BrandKitDrawerOperationalBinding | null;
  t: (key: string, options?: Record<string, unknown>) => string;
}

type LoadPhase = 'idle' | 'loading' | 'success' | 'error';

type PreviewLoad = 'idle' | 'loading' | 'ready' | 'error';

export function BrandKitGuidelinesTabContent({ brandKit, operational, t }: BrandKitGuidelinesTabContentProps) {
  const [loadPhase, setLoadPhase] = useState<LoadPhase>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<BrandGuidelinesDocument[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<BrandGuidelinesDocument | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoad, setPreviewLoad] = useState<PreviewLoad>('idle');
  const [previewErrorDetail, setPreviewErrorDetail] = useState<string | null>(null);
  const [fileActionError, setFileActionError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const currentBrandKitVersion = Number(brandKit.version ?? 1) || 1;

  const g = operational?.state.guidelinesTab.generate;

  const fetchList = useCallback(async () => {
    setLoadError(null);
    setLoadPhase('loading');
    try {
      const res = await apiClient.get<{ items?: BrandGuidelinesDocument[] }>(
        `/v1/brand/guidelines?brandKitId=${encodeURIComponent(brandKit.id)}&limit=50`
      );
      setDocuments(res.items ?? []);
      setLoadPhase('success');
    } catch (e) {
      setLoadPhase('error');
      const msg =
        e instanceof ApiClientError
          ? e.error.message
          : t('brand.brandKitDrawerContent.brandGuidelines.loadError');
      setLoadError(msg);
    }
  }, [brandKit.id, t]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const sortedDocs = useMemo(() => {
    return [...documents].sort((a, b) => {
      const ta = (a.generatedAt as string | null | undefined) ?? '';
      const tb = (b.generatedAt as string | null | undefined) ?? '';
      return tb.localeCompare(ta);
    });
  }, [documents]);

  const latest = sortedDocs[0];
  const history = sortedDocs.slice(1);
  const hasHistory = history.length > 0;

  const handleGenerateClick = async () => {
    operational?.act.startGuidelineGenerate(null);
    setGenerating(true);
    setFileActionError(null);
    try {
      const created = await apiClient.post<BrandGuidelinesDocument>('/v1/brand/guidelines/generate', {
        brandKitId: brandKit.id,
        formats: ['pdf'],
        allowDraftPreview: true,
      });
      operational?.act.completeGuidelineGenerate(created.guidelinesId);
      await fetchList();
    } catch (e) {
      const msg =
        e instanceof ApiClientError
          ? e.error.message
          : t('brand.brandKitDrawerContent.operational.generateErrorMessage');
      operational?.act.failGuidelineGenerate(msg);
    } finally {
      setGenerating(false);
    }
  };

  const inFlight = generating || Boolean(g?.inFlight);

  const statusBadge = (doc: BrandGuidelinesDocument) => {
    const ui = toUiStatus(doc);
    const map: Record<
      GuidelineUiStatus,
      { bg: string; text: string; icon: typeof CheckCircle2 | typeof AlertCircle | null; labelKey: string }
    > = {
      published: { bg: 'bg-[#ecfdf5]', text: 'text-[#059669]', icon: CheckCircle2, labelKey: 'published' },
      generated: { bg: 'bg-[#ecfdf5]', text: 'text-[#059669]', icon: CheckCircle2, labelKey: 'generated' },
      draft: { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]', icon: AlertCircle, labelKey: 'draft' },
      failed: { bg: 'bg-[#fef2f2]', text: 'text-[#991b1b]', icon: AlertCircle, labelKey: 'failed' },
      archived: { bg: 'bg-[#f5f5f5]', text: 'text-[#666]', icon: null, labelKey: 'archived' },
    };
    const cfg = map[ui];
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${cfg.bg} ${cfg.text}`}>
        {Icon ? <Icon className="w-3 h-3" aria-hidden /> : null}
        {t(`brand.brandKitDrawerContent.brandGuidelines.status.${cfg.labelKey}`)}
      </span>
    );
  };

  const sectionCount = (doc: BrandGuidelinesDocument) => (Array.isArray(doc.sections) ? doc.sections.length : 0);

  const openPreview = (doc: BrandGuidelinesDocument) => {
    setPreviewDoc(doc);
    setPreviewBlobUrl(null);
    setPreviewLoad('idle');
    setPreviewErrorDetail(null);
    setShowPreview(true);
  };

  const closePreview = () => {
    setPreviewBlobUrl(null);
    setPreviewDoc(null);
    setPreviewLoad('idle');
    setPreviewErrorDetail(null);
    setShowPreview(false);
  };

  const previewGuidelinesId = previewDoc?.guidelinesId;

  useEffect(() => {
    if (!showPreview || !previewGuidelinesId) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setPreviewLoad('loading');
    setPreviewErrorDetail(null);
    (async () => {
      try {
        const blob = await apiClient.getBlob(guidelinesFilePath(previewGuidelinesId));
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewBlobUrl(objectUrl);
        setPreviewLoad('ready');
      } catch (e) {
        if (cancelled) return;
        setPreviewLoad('error');
        const msg =
          e instanceof ApiClientError
            ? e.error.message
            : t('brand.brandKitDrawerContent.brandGuidelines.previewLoadError');
        setPreviewErrorDetail(msg);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [showPreview, previewGuidelinesId]);

  const downloadPdf = async (doc: BrandGuidelinesDocument) => {
    setFileActionError(null);
    try {
      const blob = await apiClient.getBlob(guidelinesFilePath(doc.guidelinesId));
      const safe = doc.guidelinesId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'guidelines';
      saveBlobAsFile(blob, `brand-guidelines-${safe}.pdf`);
    } catch (e) {
      const msg =
        e instanceof ApiClientError
          ? e.error.message
          : t('brand.brandKitDrawerContent.brandGuidelines.downloadFailed');
      setFileActionError(msg);
    }
  };

  const fileActionsDisabled = (doc: BrandGuidelinesDocument) => toUiStatus(doc) === 'failed';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-medium text-[#0d0d0d] mb-1">{t('brand.brandKitDrawerContent.brandGuidelines.title')}</h3>
        <p className="text-[12px] text-[#666]">{t('brand.brandKitDrawerContent.brandGuidelines.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void fetchList()}
          disabled={loadPhase === 'loading'}
          className="h-7 px-2 rounded text-[11px] border border-[#e5e5e5] hover:bg-[#fafafa] disabled:opacity-50"
        >
          {t('brand.brandKitDrawerContent.brandGuidelines.reload')}
        </button>
      </div>

      {loadPhase === 'loading' ? (
        <div className="space-y-2" aria-busy="true">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-[#f5f5f5] animate-pulse border border-[#e5e5e5]" />
          ))}
        </div>
      ) : null}

      {loadPhase === 'error' && loadError ? (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-[12px] text-[#991b1b] space-y-2">
          <div className="font-medium">{t('brand.brandKitDrawerContent.brandGuidelines.loadFailedTitle')}</div>
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void fetchList()}
            className="h-8 px-3 rounded-md text-[12px] bg-white border border-[#e5e5e5] hover:bg-[#fafafa]"
          >
            {t('brand.brandKitDrawerContent.sources.retry')}
          </button>
        </div>
      ) : null}

      {g?.error ? (
        <div className="text-[12px] text-[#991b1b] bg-[#fef2f2] border border-[#fecaca] rounded-md p-2 flex justify-between gap-2">
          <span>{g.error}</span>
          {operational ? (
            <button
              type="button"
              className="text-[11px] underline shrink-0"
              onClick={() => operational.act.clearGuidelineGenerateError()}
            >
              {t('brand.brandKitDrawerContent.brandGuidelines.dismissError')}
            </button>
          ) : null}
        </div>
      ) : null}

      {loadPhase === 'success' ? (
        <>
          {fileActionError ? (
            <div
              className="rounded-md border border-[#fecaca] bg-[#fef2f2] p-3 text-[12px] text-[#991b1b] flex justify-between gap-2 items-start"
              role="alert"
            >
              <span className="min-w-0">{fileActionError}</span>
              <button
                type="button"
                className="text-[11px] underline shrink-0"
                onClick={() => setFileActionError(null)}
              >
                {t('brand.brandKitDrawerContent.brandGuidelines.dismissError')}
              </button>
            </div>
          ) : null}

          <div className="border border-[#e5e5e5] rounded-lg p-4">
            <div className="mb-3">
              <div className="text-[13px] font-medium text-[#0d0d0d] mb-1">
                {t('brand.brandKitDrawerContent.brandGuidelines.generateSectionTitle')}
              </div>
              <div className="text-[11px] text-[#666]">
                {t('brand.brandKitDrawerContent.brandGuidelines.generateSectionHelp', { version: currentBrandKitVersion })}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={inFlight}
                onClick={() => void handleGenerateClick()}
                className="flex-1 min-w-[12rem] h-9 px-4 bg-[#0d0d0d] text-white rounded text-[13px] hover:bg-[#262626] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {inFlight ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
                    {t('brand.brandKitDrawerContent.operational.generateRunning')}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" aria-hidden />
                    {sortedDocs.length > 0
                      ? t('brand.brandKitDrawerContent.brandGuidelines.regenerateCta')
                      : t('brand.brandKitDrawerContent.operational.generateGuidelines')}
                  </>
                )}
              </button>
            </div>
            {inFlight ? (
              <div className="mt-3 p-3 bg-[#f0f0ff] border border-[#e0e0f0] rounded">
                <div className="text-[11px] text-[#5e6ad2] mb-2 font-medium">
                  {t('brand.brandKitDrawerContent.brandGuidelines.progressTitle')}
                </div>
                <ul className="space-y-1 text-[10px] text-[#666]">
                  <li>{t('brand.brandKitDrawerContent.brandGuidelines.progressStep1')}</li>
                  <li>{t('brand.brandKitDrawerContent.brandGuidelines.progressStep2')}</li>
                  <li>{t('brand.brandKitDrawerContent.brandGuidelines.progressStep3')}</li>
                </ul>
              </div>
            ) : null}
          </div>

          {latest ? (
            <div className="border border-[#e5e5e5] rounded-lg p-4 bg-gradient-to-br from-[#f0f0ff] to-white">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded bg-gradient-to-br from-[#5e6ad2] to-[#8b5cf6] flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-white" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="text-[14px] font-medium text-[#0d0d0d] mb-1">
                        {t('brand.brandKitDrawerContent.brandGuidelines.currentDocTitle', {
                          version: formatDate(latest.generatedAt as string | null | undefined),
                        })}
                      </div>
                      <div className="text-[11px] text-[#666]">
                        {t('brand.brandKitDrawerContent.brandGuidelines.currentMeta', {
                          date: formatDate(latest.generatedAt as string | null | undefined),
                          sections: sectionCount(latest),
                          kitVer: currentBrandKitVersion,
                        })}
                      </div>
                    </div>
                    {statusBadge(latest)}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={fileActionsDisabled(latest)}
                      onClick={() => {
                        setFileActionError(null);
                        openPreview(latest);
                      }}
                      className="h-7 px-3 bg-white border border-[#e5e5e5] text-[#0d0d0d] rounded text-[12px] hover:bg-[#fafafa] flex items-center gap-1 disabled:opacity-50"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden />
                      {t('brand.brandKitDrawerContent.brandGuidelines.preview')}
                    </button>
                    <button
                      type="button"
                      disabled={fileActionsDisabled(latest)}
                      onClick={() => void downloadPdf(latest)}
                      className="h-7 px-3 bg-white border border-[#e5e5e5] text-[#0d0d0d] rounded text-[12px] hover:bg-[#fafafa] flex items-center gap-1 disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden />
                      {t('brand.brandKitDrawerContent.brandGuidelines.downloadPdf')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-[#e5e5e5] border-dashed rounded-lg p-8 text-center">
              <BookOpen className="w-8 h-8 text-[#e5e5e5] mx-auto mb-2" aria-hidden />
              <div className="text-[13px] text-[#666]">{t('brand.brandKitDrawerContent.brandGuidelines.empty')}</div>
            </div>
          )}

          {hasHistory ? (
            <div>
              <div className="text-[12px] font-medium text-[#0d0d0d] mb-2">
                {t('brand.brandKitDrawerContent.brandGuidelines.historyTitle')}
              </div>
              <div className="space-y-2">
                {history.map((doc) => (
                  <div key={doc.guidelinesId} className="border border-[#e5e5e5] rounded p-3 hover:bg-[#fafafa] transition-colors">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-[#999] shrink-0" aria-hidden />
                        <span className="text-[13px] font-medium text-[#0d0d0d] truncate">
                          {t('brand.brandKitDrawerContent.brandGuidelines.historyRowTitle', {
                            version: formatDate(doc.generatedAt as string | null | undefined),
                          })}
                        </span>
                        {statusBadge(doc)}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          title={t('brand.brandKitDrawerContent.brandGuidelines.preview')}
                          disabled={fileActionsDisabled(doc)}
                          onClick={() => {
                            setFileActionError(null);
                            openPreview(doc);
                          }}
                          className="w-7 h-7 flex items-center justify-center hover:bg-[#f5f5f5] rounded transition-colors disabled:opacity-40"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#666]" aria-hidden />
                        </button>
                        <button
                          type="button"
                          title={t('brand.brandKitDrawerContent.brandGuidelines.downloadPdf')}
                          disabled={fileActionsDisabled(doc)}
                          onClick={() => void downloadPdf(doc)}
                          className="w-7 h-7 flex items-center justify-center hover:bg-[#f5f5f5] rounded transition-colors disabled:opacity-40"
                        >
                          <Download className="w-3.5 h-3.5 text-[#666]" aria-hidden />
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-[#666]">
                      {t('brand.brandKitDrawerContent.brandGuidelines.historyRowMeta', {
                        date: formatDate(doc.generatedAt as string | null | undefined),
                        sections: sectionCount(doc),
                        kitVer: currentBrandKitVersion,
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p className="text-[11px] text-[#666]">{t('brand.brandKitDrawerContent.operational.guidelinesFooterNote')}</p>
        </>
      ) : null}

      {showPreview && previewDoc
        ? createPortal(
            <div
              className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-8"
              role="dialog"
              aria-modal="true"
            >
              <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
                <div className="px-6 py-4 border-b border-[#e5e5e5] flex items-center justify-between">
                  <div className="text-[15px] font-medium text-[#0d0d0d]">
                    {t('brand.brandKitDrawerContent.brandGuidelines.previewModalTitle')}
                  </div>
                  <button
                    type="button"
                    onClick={closePreview}
                    className="w-8 h-8 flex items-center justify-center hover:bg-[#f5f5f5] rounded transition-colors"
                    aria-label={t('brand.brandKitDrawerContent.brandGuidelines.closePreview')}
                  >
                    <X className="w-4 h-4 text-[#666]" aria-hidden />
                  </button>
                </div>
                <div className="flex-1 min-h-0 bg-[#fafafa]">
                  {previewLoad === 'loading' ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[240px] gap-3 text-[#666]">
                      <Loader2 className="w-8 h-8 animate-spin" aria-hidden />
                      <p className="text-[13px]">{t('brand.brandKitDrawerContent.brandGuidelines.previewLoading')}</p>
                    </div>
                  ) : null}
                  {previewLoad === 'error' ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[240px] gap-2 p-6 text-center text-[#991b1b]">
                      <AlertCircle className="w-8 h-8 shrink-0" aria-hidden />
                      <p className="text-[13px] font-medium">{t('brand.brandKitDrawerContent.brandGuidelines.previewLoadError')}</p>
                      {previewErrorDetail ? (
                        <p className="text-[12px] text-[#b91c1c] max-w-md break-words">{previewErrorDetail}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {previewLoad === 'ready' && previewBlobUrl ? (
                    <iframe
                      title={t('brand.brandKitDrawerContent.brandGuidelines.preview')}
                      src={previewBlobUrl}
                      className="w-full h-full min-h-[70vh] border-0 bg-white"
                    />
                  ) : null}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
