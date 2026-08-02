/**
 * Brand Kit drawer — Sources tab. Lists and manages brand sources via GET/POST/PATCH /v1/brand/sources.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Globe,
  Github,
  Smartphone,
  FileText,
  Figma,
  Palette,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import type { BrandKit } from '../../../hooks/useAdmin';
import type { BrandKitDrawerOperationalBinding } from '../../../brand/brandCenterOperationalTypes';
import { apiClient, ApiClientError } from '../../../lib/api-client';
import type { components } from '../../../generated/openapi-types';
import { isBrandKitSourcesDraftId } from './constants';

type BrandSource = components['schemas']['BrandSource'];
type BrandExtractionJob = components['schemas']['BrandExtractionJob'];
type SourceTypeForm = 'website' | 'github' | 'app_store' | 'play_store' | 'pdf' | 'figma' | 'canva' | '';

type ListPhase = 'idle' | 'loading' | 'success' | 'error';

const UI_TYPE_TO_API: Record<string, NonNullable<BrandSource['sourceType']>> = {
  website: 'website',
  github: 'github',
  'app-store': 'app_store',
  app_store: 'app_store',
  'play-store': 'play_store',
  play_store: 'play_store',
  pdf: 'pdf',
  figma: 'figma',
  canva: 'canva',
};

type RowStatus = 'connected' | 'error' | 'disconnected';

function mapSourceStatus(api?: string): RowStatus {
  if (api === 'active') return 'connected';
  if (api === 'disabled') return 'disconnected';
  return 'error';
}

function iconForSourceType(t: string) {
  switch (t) {
    case 'website':
      return Globe;
    case 'github':
      return Github;
    case 'app_store':
    case 'play_store':
      return Smartphone;
    case 'pdf':
      return FileText;
    case 'figma':
      return Figma;
    case 'canva':
      return Palette;
    default:
      return Globe;
  }
}

function formatFetchedAt(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(locale);
}

type EnsurePersistedKitResult = { kitId: string } | { error: string };

export interface BrandKitSourcesTabContentProps {
  brandKit: BrandKit;
  operational: BrandKitDrawerOperationalBinding | null;
  t: (key: string, options?: Record<string, unknown>) => string;
  /**
   * When the drawer still uses the client-only draft id, adding a source creates the kit row
   * on the server first (same rules as Save draft), then the source is POSTed and sync runs.
   */
  onEnsurePersistedKit?: () => Promise<EnsurePersistedKitResult>;
  /** Overview create flow: compact block above the fold. */
  embeddedInOverview?: boolean;
  onContinueToExtractionReview?: () => void;
}

export function BrandKitSourcesTabContent({
  brandKit,
  operational,
  t,
  onEnsurePersistedKit,
  embeddedInOverview = false,
  onContinueToExtractionReview,
}: BrandKitSourcesTabContentProps) {
  const [listPhase, setListPhase] = useState<ListPhase>('idle');
  const [listError, setListError] = useState<string | null>(null);
  const [sources, setSources] = useState<BrandSource[]>([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceType, setNewSourceType] = useState<SourceTypeForm>('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const kitNotPersisted = isBrandKitSourcesDraftId(brandKit.id);

  const loadSources = useCallback(
    async (kitIdOverride?: string) => {
      const id = kitIdOverride ?? brandKit.id;
      const draft = isBrandKitSourcesDraftId(id);
      if (draft) {
        setSources([]);
        setListPhase('success');
        setListError(null);
        return;
      }
      setListError(null);
      setListPhase('loading');
      try {
        const res = await apiClient.get<{ items?: BrandSource[] }>(
          `/v1/brand/sources?brandKitId=${encodeURIComponent(id)}&limit=100`
        );
        setSources(res.items ?? []);
        setListPhase('success');
      } catch (e) {
        setListPhase('error');
        setSources([]);
        setListError(
          e instanceof ApiClientError ? e.error.message : e instanceof Error ? e.message : t('brand.brandKitDrawerContent.sources.loadError')
        );
      }
    },
    [brandKit.id, t]
  );

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  useEffect(() => {
    if (!kitNotPersisted) return;
    setShowAddSource(true);
  }, [kitNotPersisted]);

  useEffect(() => {
    if (!embeddedInOverview) return;
    if (kitNotPersisted) return;
    if (listPhase !== 'success') return;
    if (sources.length > 0) return;
    setShowAddSource(true);
  }, [embeddedInOverview, kitNotPersisted, listPhase, sources.length]);

  const statusBadge = (row: RowStatus) => {
    const map = {
      connected: {
        bg: 'bg-[#ecfdf5]',
        text: 'text-[#059669]',
        icon: CheckCircle2,
        labelKey: 'brand.brandKitDrawerContent.sources.badge.connected' as const,
      },
      error: {
        bg: 'bg-[#fee2e2]',
        text: 'text-[#dc2626]',
        icon: AlertTriangle,
        labelKey: 'brand.brandKitDrawerContent.sources.badge.error' as const,
      },
      disconnected: {
        bg: 'bg-[#f5f5f5]',
        text: 'text-[#666]',
        icon: AlertTriangle,
        labelKey: 'brand.brandKitDrawerContent.sources.badge.disconnected' as const,
      },
    } as const;
    const cfg = map[row];
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${cfg.bg} ${cfg.text}`}>
        <Icon className="w-3 h-3" aria-hidden />
        {t(cfg.labelKey)}
      </span>
    );
  };

  const handleAddSource = async () => {
    if (!newSourceType || !newSourceUrl.trim()) return;
    const trimmed = newSourceUrl.trim();
    const apiType = UI_TYPE_TO_API[newSourceType] ?? 'website';
    setSubmitting(true);
    setListError(null);
    try {
      let kitId = brandKit.id;
      if (kitNotPersisted) {
        if (!onEnsurePersistedKit) {
          setListError(t('brand.brandKitDrawerContent.sources.loadError'));
          return;
        }
        const ensured = await onEnsurePersistedKit();
        if ('error' in ensured) {
          setListError(ensured.error);
          return;
        }
        kitId = ensured.kitId;
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      }

      await apiClient.post<BrandSource>('/v1/brand/sources', {
        brandKitId: kitId,
        sourceType: apiType,
        locator: trimmed,
        displayName: trimmed,
      });
      setShowAddSource(false);
      setNewSourceType('');
      setNewSourceUrl('');

      operational?.act.startSync();
      try {
        const listRes = await apiClient.get<{ items?: BrandSource[] }>(
          `/v1/brand/sources?brandKitId=${encodeURIComponent(kitId)}&limit=100`
        );
        const items = listRes.items ?? [];
        const activeSourceIds = items.filter((s) => s.status === 'active').map((s) => s.sourceId).filter(Boolean);
        if (activeSourceIds.length > 0) {
          await apiClient.post<BrandExtractionJob>('/v1/brand/extraction-jobs', {
            jobType: 'initial_extract',
            sourceIds: activeSourceIds,
            brandKitId: kitId,
          });
        }
        operational?.act.completeSync(new Date().toISOString());
      } catch (e2) {
        const msg =
          e2 instanceof ApiClientError
            ? e2.error.message
            : e2 instanceof Error
              ? e2.message
              : t('brand.brandKitDrawerContent.sources.extractionStartFailed');
        operational?.act.failSync(msg);
        setListError(msg);
      }

      await loadSources(kitId);
    } catch (e) {
      setListError(
        e instanceof ApiClientError ? e.error.message : e instanceof Error ? e.message : t('brand.brandKitDrawerContent.sources.loadError')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisableSource = async (sourceId: string) => {
    if (kitNotPersisted) return;
    try {
      await apiClient.patch<BrandSource>(`/v1/brand/sources/${encodeURIComponent(sourceId)}`, { status: 'disabled' });
      await loadSources();
    } catch {
      /* keep list; error surfaced on next refresh */
    }
  };

  const persistedSourceCount = sources.length;
  const showEmptySourcesHero = listPhase === 'success' && persistedSourceCount === 0;
  const showAddFormCard = showAddSource;
  const formCardTitleKey =
    persistedSourceCount === 0
      ? 'brand.brandKitDrawerContent.sources.addTitleFirst'
      : 'brand.brandKitDrawerContent.sources.addTitle';

  return (
    <div className="space-y-4">
      {embeddedInOverview ? (
        <div>
          <h3 className="text-[13px] font-semibold text-[#0d0d0d]">{t('brand.overviewEmbeddedSources.sectionTitle')}</h3>
        </div>
      ) : (
        <div>
          <h3 className="text-[13px] font-medium text-[#0d0d0d] mb-1">
            {t('brand.brandKitDrawerContent.sources.managementTitle')}
          </h3>
          <p className="text-[12px] text-[#666]">{t('brand.brandKitDrawerContent.sources.managementSubtitle')}</p>
        </div>
      )}

      {listPhase === 'loading' ? (
        <div className="space-y-2" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-[#f5f5f5] animate-pulse border border-[#e5e5e5]" />
          ))}
        </div>
      ) : null}

      {listPhase === 'error' && listError ? (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-[12px] text-[#991b1b] flex flex-col gap-2">
          <div className="font-medium">{t('brand.brandKitDrawerContent.sources.loadFailedTitle')}</div>
          <p>{listError}</p>
          <button
            type="button"
            onClick={() => void loadSources()}
            className="self-start h-8 px-3 rounded-md text-[12px] bg-white border border-[#e5e5e5] hover:bg-[#fafafa]"
          >
            {t('brand.brandKitDrawerContent.sources.retry')}
          </button>
        </div>
      ) : null}

      {!kitNotPersisted ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={listPhase === 'loading'}
            onClick={() => void loadSources()}
            className="h-8 px-3 rounded-md text-[13px] bg-[#0d0d0d] text-white hover:bg-[#262626] disabled:opacity-50 inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${listPhase === 'loading' ? 'animate-spin' : ''}`} aria-hidden />
            {t('brand.brandKitDrawerContent.sources.refreshAll')}
          </button>
          {sources.length > 0 && onContinueToExtractionReview ? (
            <button
              type="button"
              onClick={onContinueToExtractionReview}
              className="h-8 px-3 rounded-md text-[13px] border border-[#5e6ad2] text-[#5e6ad2] hover:bg-[#f0f0ff]"
            >
              {t('brand.overviewEmbeddedSources.continueExtraction')}
            </button>
          ) : null}
        </div>
      ) : null}

      {listPhase === 'success' && !kitNotPersisted && sources.length > 0 ? (
        <div className="space-y-2">
          {sources.map((source) => {
            const Icon = iconForSourceType(source.sourceType ?? 'website');
            const rowStatus = mapSourceStatus(source.status);
            const ext = source as BrandSource & { displayName?: string | null; brandKitId?: string | null; createdAt?: string | null };
            const label = ext.displayName || source.locator || source.sourceId;
            const last = formatFetchedAt(source.lastFetchedAt ?? null, typeof navigator !== 'undefined' ? navigator.language : 'en-US');
            const href =
              typeof source.locator === 'string' && /^https?:\/\//i.test(source.locator) ? source.locator : undefined;
            return (
              <div
                key={source.sourceId}
                className="border border-[#e5e5e5] rounded-lg p-3 hover:border-[#d0d0d0] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-gradient-to-br from-[#5e6ad2] to-[#8b5cf6] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-white" aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-[#0d0d0d] mb-0.5 truncate">{label}</div>
                        <div className="text-[11px] text-[#666] truncate font-mono">{source.locator}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={t('brand.brandKitDrawerContent.sources.openExternal')}
                            className="w-7 h-7 flex items-center justify-center hover:bg-[#f5f5f5] rounded transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-[#666]" aria-hidden />
                          </a>
                        ) : (
                          <span className="w-7 h-7 flex items-center justify-center opacity-30" aria-hidden>
                            <ExternalLink className="w-3.5 h-3.5 text-[#666]" />
                          </span>
                        )}
                        {source.status === 'active' ? (
                          <button
                            type="button"
                            title={t('brand.brandKitDrawerContent.sources.remove')}
                            className="w-7 h-7 flex items-center justify-center hover:bg-[#fee2e2] rounded transition-colors"
                            onClick={() => void handleDisableSource(source.sourceId)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-[#dc2626]" aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {statusBadge(rowStatus)}
                      {last ? (
                        <span className="text-[11px] text-[#666]">
                          {t('brand.brandKitDrawerContent.sources.lastFetched', { time: last })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {showEmptySourcesHero ? (
        <div className="border-2 border-[#5e6ad2] border-dashed rounded-lg p-6 text-center bg-gradient-to-br from-[#f0f0ff] to-white">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5e6ad2] to-[#8b5cf6] flex items-center justify-center mx-auto mb-2">
            <Sparkles className="w-5 h-5 text-white" aria-hidden />
          </div>
          <div className="text-[13px] font-medium text-[#0d0d0d] mb-1">
            {t('brand.overviewEmbeddedSources.heroTitle')}
          </div>
          <div className="text-[11px] text-[#666] mb-0 max-w-sm mx-auto leading-relaxed">
            {t('brand.overviewEmbeddedSources.heroBody')}
          </div>
        </div>
      ) : null}

      {showAddFormCard ? (
        <div className="border border-[#5e6ad2] rounded-lg p-4 bg-[#f0f0ff]">
          <div className="text-[13px] font-medium text-[#0d0d0d] mb-3">{t(formCardTitleKey)}</div>
          <div className="space-y-3">
            <div>
              <label className="text-[12px] text-[#666] mb-1 block">{t('brand.brandKitDrawerContent.sources.sourceType')}</label>
              <select
                value={newSourceType}
                onChange={(e) => setNewSourceType(e.target.value as SourceTypeForm)}
                className="w-full h-8 px-2 border border-[#e5e5e5] rounded text-[13px] bg-white"
              >
                <option value="">{t('brand.brandKitDrawerContent.sources.selectTypePlaceholder')}</option>
                <option value="website">{t('brand.brandKitDrawerContent.sources.type.website')}</option>
                <option value="github">{t('brand.brandKitDrawerContent.sources.type.github')}</option>
                <option value="app-store">{t('brand.brandKitDrawerContent.sources.type.appStore')}</option>
                <option value="play-store">{t('brand.brandKitDrawerContent.sources.type.playStore')}</option>
                <option value="pdf">{t('brand.brandKitDrawerContent.sources.type.pdf')}</option>
                <option value="figma">{t('brand.brandKitDrawerContent.sources.type.figma')}</option>
                <option value="canva">{t('brand.brandKitDrawerContent.sources.type.canva')}</option>
              </select>
            </div>
            <div>
              <label className="text-[12px] text-[#666] mb-1 block">
                {newSourceType === 'pdf'
                  ? t('brand.brandKitDrawerContent.sources.urlLabelPdf')
                  : t('brand.brandKitDrawerContent.sources.urlLabel')}
              </label>
              <input
                type="text"
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                placeholder={t('brand.brandKitDrawerContent.sources.urlPlaceholder')}
                className="w-full h-8 px-3 border border-[#e5e5e5] rounded text-[13px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleAddSource()}
                disabled={!newSourceType || !newSourceUrl.trim() || submitting}
                className="h-7 px-3 bg-[#0d0d0d] text-white rounded text-[12px] disabled:opacity-50"
              >
                {t('brand.brandKitDrawerContent.sources.addSubmit')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewSourceType('');
                  setNewSourceUrl('');
                  if (!kitNotPersisted) {
                    setShowAddSource(false);
                  }
                }}
                className="h-7 px-3 text-[12px] text-[#666]"
              >
                {t('brand.brandKitDrawerContent.sources.addCancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!kitNotPersisted && listPhase === 'success' && sources.length === 0 && !showAddSource ? (
        <button
          type="button"
          onClick={() => setShowAddSource(true)}
          className="w-full h-8 border border-[#e5e5e5] border-dashed rounded-lg text-[12px] text-[#666] hover:text-[#0d0d0d] hover:border-[#0d0d0d] transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden />
          {t('brand.brandKitDrawerContent.sources.addFirst')}
        </button>
      ) : null}

      {!kitNotPersisted && listPhase === 'success' && sources.length > 0 && !showAddSource ? (
        <button
          type="button"
          onClick={() => setShowAddSource(true)}
          className="w-full h-10 border border-[#e5e5e5] border-dashed rounded-lg text-[13px] text-[#666] hover:text-[#0d0d0d] hover:border-[#0d0d0d] transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" aria-hidden />
          {t('brand.brandKitDrawerContent.sources.addSource')}
        </button>
      ) : null}

      {embeddedInOverview ? (
        <p className="text-[11px] text-[#666]">
          {persistedSourceCount > 0
            ? t('brand.overviewEmbeddedSources.tabHint')
            : t('brand.overviewEmbeddedSources.footerAiHint')}
        </p>
      ) : (
        <p className="text-[11px] text-[#666]">{t('brand.brandKitDrawerContent.operational.sourcesFooterNote')}</p>
      )}
    </div>
  );
}
