/**
 * Brand Kit drawer — Logos tab: canonical approved logo variants (UI-first; persist via BrandKit API later).
 */
import { useCallback, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, Image as ImageIcon, Loader2, Star, Trash2, Upload } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';

export type BrandKitLogoVariant = 'primary' | 'icon' | 'wordmark' | 'secondary';

export type BrandKitCanonicalLogo = {
  id: string;
  variant: BrandKitLogoVariant;
  fileName: string;
  /** http(s) or data URL for preview */
  previewUrl: string;
  width?: number;
  height?: number;
  format: string;
  source?: 'extracted' | 'uploaded' | 'asset-library';
  isPrimary?: boolean;
};

export interface BrandKitLogosTabContentProps {
  logos: BrandKitCanonicalLogo[];
  onLogosChange: (next: BrandKitCanonicalLogo[]) => void;
  onOpenAssetsTab?: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function variantLabel(variant: BrandKitLogoVariant, t: BrandKitLogosTabContentProps['t']): string {
  return t(`brand.brandKitDrawerContent.logos.variants.${variant}`);
}

function sourceBadge(source: BrandKitCanonicalLogo['source'], t: BrandKitLogosTabContentProps['t']) {
  if (!source) return null;
  const key = `brand.brandKitDrawerContent.logos.source.${source}`;
  const map = {
    extracted: 'bg-[#ecfdf5] text-[#059669]',
    uploaded: 'bg-[#dbeafe] text-[#1e40af]',
    'asset-library': 'bg-[#fef3c7] text-[#92400e]',
  } as const;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${map[source]}`}>
      {t(key)}
    </span>
  );
}

function buildLogoDownloadFileName(logo: BrandKitCanonicalLogo): string {
  const safeName = (logo.fileName?.trim() || `logo-${logo.id}`).replace(/[/\\]/g, '_');
  const hasExt = /\.[a-z0-9]+$/i.test(safeName);
  if (hasExt) return safeName;
  const ext = (logo.format || 'png').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
  return `${safeName}.${ext}`;
}

function saveBlobAsFile(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export function BrandKitLogosTabContent({ logos, onLogosChange, onOpenAssetsTab, t }: BrandKitLogosTabContentProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadHintId, setDownloadHintId] = useState<string | null>(null);

  const remove = useCallback(
    (id: string) => {
      onLogosChange(logos.filter((l) => l.id !== id));
    },
    [logos, onLogosChange]
  );

  const makeLogoPrimary = useCallback(
    (id: string) => {
      onLogosChange(
        logos.map((l) => ({
          ...l,
          isPrimary: l.id === id,
        }))
      );
    },
    [logos, onLogosChange]
  );

  const downloadLogo = useCallback(async (logo: BrandKitCanonicalLogo) => {
    const raw = logo.previewUrl.trim();
    const isHttp = /^https?:\/\//i.test(raw);
    const isHttps = /^https:\/\//i.test(raw);
    const isData = /^data:/i.test(raw);
    if (!isHttp && !isData) return;

    const filename = buildLogoDownloadFileName(logo);
    setDownloadingId(logo.id);
    setDownloadHintId(null);

    try {
      if (isData) {
        const res = await fetch(raw);
        if (!res.ok) throw new Error(String(res.status));
        saveBlobAsFile(await res.blob(), filename);
        return;
      }

      if (isHttps) {
        try {
          const params = new URLSearchParams({ url: raw, filename });
          const blob = await apiClient.getBlob(`/v1/admin/brand/proxy-image?${params.toString()}`);
          if (blob.size < 1) throw new Error('empty');
          saveBlobAsFile(blob, filename);
          return;
        } catch {
          /* fall through to direct fetch */
        }
      }

      const res = await fetch(raw, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      if (blob.size < 1) throw new Error('empty');
      saveBlobAsFile(blob, filename);
    } catch {
      setDownloadHintId(logo.id);
    } finally {
      setDownloadingId(null);
    }
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-medium text-[#0d0d0d] mb-1">{t('brand.brandKitDrawerContent.logos.title')}</h3>
        <p className="text-[12px] text-[#666]">{t('brand.brandKitDrawerContent.logos.subtitle')}</p>
      </div>

      <div className="bg-[#f0f0ff] border border-[#e0e0f0] rounded-lg p-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#5e6ad2] flex-shrink-0 mt-0.5" aria-hidden />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-[#5e6ad2] mb-1">{t('brand.brandKitDrawerContent.logos.bannerTitle')}</div>
            <p className="text-[11px] text-[#666]">
              {t('brand.brandKitDrawerContent.logos.bannerBody')}{' '}
              {onOpenAssetsTab ? (
                <button
                  type="button"
                  onClick={() => onOpenAssetsTab()}
                  className="text-[#5e6ad2] hover:underline font-medium"
                >
                  {t('brand.brandKitDrawerContent.logos.bannerAssetsCta')}
                </button>
              ) : (
                <span className="text-[#5e6ad2] font-medium">{t('brand.brandKitDrawerContent.logos.bannerAssetsCta')}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {logos.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {logos.map((logo) => (
            <div
              key={logo.id}
              className={`relative border rounded-lg overflow-hidden transition-colors ${
                logo.isPrimary ? 'border-[#5e6ad2] bg-[#f0f0ff]' : 'border-[#e5e5e5] bg-white'
              }`}
            >
              <button
                type="button"
                title={t('brand.brandKitDrawerContent.logos.remove')}
                aria-label={t('brand.brandKitDrawerContent.logos.remove')}
                onClick={() => remove(logo.id)}
                className="absolute top-2 right-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e5e5] bg-white/95 text-[#dc2626] shadow-sm hover:bg-[#fee2e2] hover:border-[#fecaca] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden />
              </button>
              <div className="aspect-video bg-white border-b border-[#f0f0f0] flex items-center justify-center p-4">
                <div className="w-full h-full flex items-center justify-center bg-[#fafafa] rounded overflow-hidden">
                  {/^https?:\/\//i.test(logo.previewUrl) || /^data:/i.test(logo.previewUrl) ? (
                    <img src={logo.previewUrl} alt={logo.fileName} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-[#d0d0d0]" aria-hidden />
                  )}
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2 pr-9">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[12px] font-medium text-[#0d0d0d]">{variantLabel(logo.variant, t)}</span>
                      {logo.isPrimary ? (
                        <Star className="w-3 h-3 text-[#f59e0b] fill-current shrink-0" aria-label={t('brand.brandKitDrawerContent.logos.primaryBadge')} />
                      ) : null}
                    </div>
                    <div className="text-[10px] text-[#666] truncate">{logo.fileName}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {sourceBadge(logo.source, t)}
                  {logo.width != null && logo.height != null ? (
                    <span className="text-[10px] text-[#999]">
                      {logo.width} × {logo.height}
                    </span>
                  ) : null}
                  <span className="text-[10px] text-[#999]">{logo.format}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={!!logo.isPrimary}
                      title={
                        logo.isPrimary
                          ? t('brand.brandKitDrawerContent.logos.currentPrimaryHelp')
                          : t('brand.brandKitDrawerContent.logos.setPrimaryHelp')
                      }
                      onClick={() => makeLogoPrimary(logo.id)}
                      className={`min-h-9 px-2 py-1.5 rounded border text-[11px] leading-snug text-center transition-colors ${
                        logo.isPrimary
                          ? 'border-[#c7d2fe] bg-[#eef2ff] text-[#4338ca] cursor-default font-medium'
                          : 'border-[#e5e5e5] bg-white text-[#374151] hover:bg-[#fafafa]'
                      }`}
                    >
                      {logo.isPrimary
                        ? t('brand.brandKitDrawerContent.logos.currentPrimary')
                        : t('brand.brandKitDrawerContent.logos.setPrimary')}
                    </button>
                    <button
                      type="button"
                      disabled={
                        (!/^https?:\/\//i.test(logo.previewUrl) && !/^data:/i.test(logo.previewUrl)) ||
                        downloadingId === logo.id
                      }
                      title={t('brand.brandKitDrawerContent.logos.download')}
                      onClick={() => void downloadLogo(logo)}
                      className={`min-h-9 px-2 py-1.5 bg-white border border-[#e5e5e5] rounded text-[11px] text-[#666] hover:bg-[#fafafa] flex items-center justify-center gap-1.5 ${
                        !/^https?:\/\//i.test(logo.previewUrl) && !/^data:/i.test(logo.previewUrl)
                          ? 'opacity-50 cursor-not-allowed'
                          : ''
                      }`}
                    >
                      {downloadingId === logo.id ? (
                        <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" aria-hidden />
                      ) : (
                        <Download className="w-3.5 h-3.5 shrink-0" aria-hidden />
                      )}
                      <span className="truncate">
                        {downloadingId === logo.id
                          ? t('brand.brandKitDrawerContent.logos.downloading')
                          : t('brand.brandKitDrawerContent.logos.download')}
                      </span>
                    </button>
                  </div>
                  {downloadHintId === logo.id ? (
                    <p className="text-[10px] leading-snug text-[#b45309]" role="status">
                      {t('brand.brandKitDrawerContent.logos.downloadCorsHint')}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-[#e5e5e5] border-dashed rounded-lg p-8 text-center">
          <ImageIcon className="w-8 h-8 text-[#e5e5e5] mx-auto mb-2" aria-hidden />
          <div className="text-[13px] text-[#666]">{t('brand.brandKitDrawerContent.logos.empty')}</div>
        </div>
      )}

      <div className="space-y-2">
        <button
          type="button"
          disabled
          className="w-full h-9 border border-[#e5e5e5] border-dashed rounded text-[12px] text-[#999] flex items-center justify-center gap-2 cursor-not-allowed"
          title={t('brand.brandKitDrawerContent.logos.comingSoonTitle')}
        >
          <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden />
          {t('brand.brandKitDrawerContent.logos.uploadCta')}
        </button>
        <button
          type="button"
          disabled
          className="w-full h-9 border border-[#e5e5e5] border-dashed rounded text-[12px] text-[#999] flex items-center justify-center gap-2 cursor-not-allowed"
          title={t('brand.brandKitDrawerContent.logos.comingSoonTitle')}
        >
          <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden />
          {t('brand.brandKitDrawerContent.logos.promoteFromLibrary')}
        </button>
      </div>

      <div className="pt-4 border-t border-[#e5e5e5]">
        <div className="text-[12px] font-medium text-[#0d0d0d] mb-2">{t('brand.brandKitDrawerContent.logos.usageTitle')}</div>
        <div className="space-y-2">
          <div className="p-3 bg-[#fafafa] rounded text-[11px] text-[#666]">
            <div className="font-medium text-[#0d0d0d] mb-1">{t('brand.brandKitDrawerContent.logos.usagePrimaryTitle')}</div>
            {t('brand.brandKitDrawerContent.logos.usagePrimaryBody')}
          </div>
          <div className="p-3 bg-[#fafafa] rounded text-[11px] text-[#666]">
            <div className="font-medium text-[#0d0d0d] mb-1">{t('brand.brandKitDrawerContent.logos.usageIconTitle')}</div>
            {t('brand.brandKitDrawerContent.logos.usageIconBody')}
          </div>
        </div>
      </div>
    </div>
  );
}
