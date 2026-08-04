/**
 * Brand Kit detail/create drawer content — Figma Make BrandKitDrawerContent.
 * Tabs: Overview, Sources, Extraction review, Logos, Guidelines, Tokens, Typography, Components, Preview, Audit.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@martechos/ui';
import { ExternalLink, FileCheck, Layout, Plus, Trash2, Upload, Download, Zap } from 'lucide-react';
import { BRAND_KIT_COMPONENT_DEFS, generateBrandKitComponentStyles } from '../../../utils/brandKitComponentStyles';
import { BRAND_KIT_FONT_OPTIONS, brandKitFontStack } from '../../../utils/brandKitFonts';
import { BRAND_KIT_OWNER_OPTIONS, isBrandKitSourcesDraftId } from './constants';

/** Preview / sample text: heading slots use extracted heading stack when present. */
function brandKitPreviewFontStack(typography: Record<string, string>, role: 'heading' | 'body'): string | undefined {
  if (role === 'heading') {
    return brandKitFontStack(typography.fontFamilyHeading ?? typography.fontFamily);
  }
  return brandKitFontStack(typography.fontFamilyBody ?? typography.fontFamily);
}
import { DrawerAuditTab } from '../DrawerAuditTab';
import { TabUnavailable } from '../TabUnavailable';
import type { BrandKit, UpdateBrandKitRequest } from '../../../hooks/useAdmin';
import type { BrandKitDrawerOperationalBinding } from '../../../brand/brandCenterOperationalTypes';
import type { ExtractionCandidateRow } from '../../../utils/mapBrandExtractionResultToReviewRows';
import { BrandKitOperationalStatusBar } from './BrandKitOperationalStatusBar';
import { BrandKitSourcesTabContent } from './BrandKitSourcesTabContent';
import { BrandKitExtractionReviewTabContent } from './BrandKitExtractionReviewTabContent';
import { BrandKitGuidelinesTabContent } from './BrandKitGuidelinesTabContent';
import { BrandKitLogosTabContent, type BrandKitCanonicalLogo } from './BrandKitLogosTabContent';

function FormField({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium text-[#0d0d0d] flex items-center gap-1">
        {label}
        {required && <span className="text-[#dc2626]" aria-hidden>*</span>}
      </label>
      <div>{children}</div>
      {help && <span className="text-[11px] text-[#666] block">{help}</span>}
    </div>
  );
}

const SELECT_CLASS =
  'w-full h-9 px-3 bg-white border border-[#e5e5e5] rounded-md text-[13px] text-[#0d0d0d] focus:outline-none focus:border-[#0d0d0d] disabled:bg-[#fafafa] disabled:text-[#999] disabled:cursor-not-allowed';

export type BrandKitFormState = UpdateBrandKitRequest & {
  name: string;
  scope?: string;
  owner?: string;
  workspaces?: string[];
  edition?: string;
  notes?: string;
  colors?: { name: string; value: string }[];
  spacing?: { name: string; value: string }[];
  radius?: { name: string; value: string }[];
  shadows?: { name: string; value: string }[];
  /** Typography scale + font (Figma nested shape) */
  typography?: Record<string, string>;
  /** Resolved token → value per component id (persisted under spec.components.mappings). */
  componentStyleMappings?: Record<string, Record<string, string>>;
  componentStylesGeneratedAt?: string;
  customComponents?: { name: string; type: string; status: string }[];
  /** Canonical logo variants for this kit (client form state until API persists a dedicated shape). */
  canonicalLogos?: BrandKitCanonicalLogo[];
};

export interface BrandKitDrawerContentProps {
  brandKit: BrandKit | null;
  formState: BrandKitFormState;
  onEditChange: (patch: Partial<BrandKitFormState>) => void;
  activeTab: string;
  workspaceOptions?: { value: string; label: string }[];
  /** BrandKit API operational UI state (sources, extraction review, guidelines, sync). */
  operational?: BrandKitDrawerOperationalBinding | null;
  /**
   * Create the kit row on the server when the user adds the first source while still on the client draft id
   * (same validation as Save draft). Save draft remains for persisting kit form only.
   */
  onEnsurePersistedKit?: () => Promise<{ kitId: string } | { error: string }>;
  /** Switch drawer tab from embedded Overview actions (e.g. continue to extraction review). */
  onNavigateTab?: (tabId: string) => void;
  /** When extraction review rows change, parent can merge accepted colors/typography into the kit form. */
  onExtractionReviewRowsChange?: (rows: ExtractionCandidateRow[]) => void;
  /** Counts for Overview “linked modules” summaries (dedicated Brand Center tabs). */
  linkedTemplateCount?: number;
  brandCenterDisclaimerCount?: number;
  /** Switch main Brand Center tab (e.g. from Overview linked-module CTAs or Logos → Asset Library). */
  onOpenBrandCenterModule?: (module: 'templates' | 'disclaimers' | 'assets') => void;
}

type TokenCategory = 'colors' | 'spacing' | 'radius' | 'shadows';

export function BrandKitDrawerContent({
  brandKit,
  formState,
  onEditChange,
  activeTab,
  workspaceOptions = [],
  operational = null,
  onEnsurePersistedKit,
  onNavigateTab,
  onExtractionReviewRowsChange,
  linkedTemplateCount = 0,
  brandCenterDisclaimerCount = 0,
  onOpenBrandCenterModule,
}: BrandKitDrawerContentProps) {
  const { t } = useTranslation('admin');
  const d = (key: string) => t(`brand.drawer.${key}`);
  const [activeTokenType, setActiveTokenType] = useState<TokenCategory>('colors');
  const scopeOptions = useMemo(
    () => [
      { value: 'org-wide', label: t('brand.brandKitForm.scopeOrgWide') },
      { value: 'workspace-specific', label: t('brand.brandKitForm.scopeWorkspace') },
    ],
    [t]
  );
  const editionOptions = useMemo(
    () => [
      { value: 'bfsi', label: t('brand.brandKitForm.editionBfsi') },
      { value: 'ecommerce', label: t('brand.brandKitForm.editionEcommerce') },
      { value: 'superapp', label: t('brand.brandKitForm.editionSuperapp') },
      { value: 'none', label: t('brand.brandKitForm.editionNone') },
    ],
    [t]
  );
  const typeScaleRows = useMemo(
    () => [
      { id: 'h1', label: t('brand.brandKitForm.typeScaleH1'), defaultSize: '32px', defaultWeight: '600' },
      { id: 'h2', label: t('brand.brandKitForm.typeScaleH2'), defaultSize: '24px', defaultWeight: '600' },
      { id: 'h3', label: t('brand.brandKitForm.typeScaleH3'), defaultSize: '20px', defaultWeight: '600' },
      { id: 'body', label: t('brand.brandKitForm.typeScaleBody'), defaultSize: '15px', defaultWeight: '400' },
      { id: 'caption', label: t('brand.brandKitForm.typeScaleCaption'), defaultSize: '13px', defaultWeight: '400' },
    ],
    [t]
  );
  const update = (field: keyof BrandKitFormState, value: unknown) => {
    onEditChange({ [field]: value });
  };

  const updateTypography = (field: string, value: string) => {
    onEditChange({
      typography: { ...(formState.typography ?? {}), [field]: value },
    });
  };

  const [componentGenerateNotice, setComponentGenerateNotice] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'components') setComponentGenerateNotice(null);
  }, [activeTab]);

  const addToken = (category: TokenCategory) => {
    const current = (formState[category] ?? []) as { name: string; value: string }[];
    update(category, [...current, { name: '', value: '' }]);
  };

  const removeToken = (category: TokenCategory, index: number) => {
    const current = (formState[category] ?? []) as { name: string; value: string }[];
    update(category, current.filter((_, i) => i !== index));
  };

  const updateToken = (category: TokenCategory, index: number, field: 'name' | 'value', value: string) => {
    const tokens = [...((formState[category] ?? []) as { name: string; value: string }[])];
    tokens[index] = { ...tokens[index], [field]: value };
    update(category, tokens);
  };

  const data = { ...formState, name: formState.name ?? brandKit?.name ?? '' };
  const scopeValue = data.scope && scopeOptions.some((o) => o.value === data.scope) ? data.scope : '';
  const editionValue = data.edition && editionOptions.some((o) => o.value === data.edition) ? data.edition : '';
  const ownerValue =
    data.owner && BRAND_KIT_OWNER_OPTIONS.some((o) => o.value === data.owner) ? data.owner : '';

  const colors = (data.colors ?? []) as { name: string; value: string }[];
  const typo = data.typography ?? {};
  const customComponents = (data.customComponents ?? []) as { name: string; type: string; status: string }[];
  const componentStyleMappings = data.componentStyleMappings ?? {};
  const canonicalLogos = (data.canonicalLogos ?? []) as BrandKitCanonicalLogo[];

  const selectedWorkspaceIds = data.workspaces ?? [];
  const isWorkspaceSpecific = scopeValue === 'workspace-specific';

  const toggleWorkspace = (workspaceId: string) => {
    const set = new Set(selectedWorkspaceIds);
    if (set.has(workspaceId)) set.delete(workspaceId);
    else set.add(workspaceId);
    const ordered = workspaceOptions.filter((o) => set.has(o.value)).map((o) => o.value);
    update('workspaces', ordered);
  };

  const tokenTypes: { id: TokenCategory; labelKey: string }[] = [
    { id: 'colors', labelKey: 'brand.brandKitDrawerContent.tokens.tokenTypes.colors' },
    { id: 'spacing', labelKey: 'brand.brandKitDrawerContent.tokens.tokenTypes.spacing' },
    { id: 'radius', labelKey: 'brand.brandKitDrawerContent.tokens.tokenTypes.radius' },
    { id: 'shadows', labelKey: 'brand.brandKitDrawerContent.tokens.tokenTypes.shadows' },
  ];

  const renderTokenTable = (type: TokenCategory) => {
    const tokens = (formState[type] ?? []) as { name: string; value: string }[];
    const placeholderValue =
      type === 'colors' ? '#000000' : type === 'spacing' ? '16px' : type === 'radius' ? '4px' : '0 1px 2px rgb(0 0 0 / 0.05)';
    const typeLabel = t(`brand.brandKitDrawerContent.tokens.tokenTypes.${type}`);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-medium text-[#0d0d0d]">
            {t('brand.brandKitDrawerContent.tokens.sectionTitle', { label: typeLabel })}
          </h3>
          <button
            type="button"
            onClick={() => addToken(type)}
            className="text-[13px] text-[#5e6ad2] hover:text-[#4c5bc7] transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('brand.brandKitDrawerContent.tokens.addToken')}
          </button>
        </div>

        {tokens.length === 0 ? (
          <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-md p-4 text-center">
            <div className="text-[13px] text-[#666]">{t('brand.brandKitDrawerContent.tokens.empty', { type })}</div>
          </div>
        ) : (
          <div className="bg-white border border-[#e5e5e5] rounded-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#fafafa] border-b border-[#e5e5e5]">
                <tr>
                  <th className="text-left px-3 py-2 text-[11px] font-medium text-[#666] uppercase tracking-wide">
                    {t('brand.brandKitDrawerContent.tokens.table.tokenName')}
                  </th>
                  <th className="text-left px-3 py-2 text-[11px] font-medium text-[#666] uppercase tracking-wide">
                    {t('brand.brandKitDrawerContent.tokens.table.value')}
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {tokens.map((token, index) => (
                  <tr key={index} className="border-b border-[#e5e5e5] last:border-0">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={token.name}
                        onChange={(e) => updateToken(type, index, 'name', e.target.value)}
                        placeholder={t('brand.brandKitDrawerContent.tokens.table.tokenNamePlaceholder')}
                        className="w-full h-7 px-2 bg-white border border-[#e5e5e5] rounded text-[13px] font-mono placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={token.value}
                          onChange={(e) => updateToken(type, index, 'value', e.target.value)}
                          placeholder={placeholderValue}
                          className="flex-1 min-w-0 h-7 px-2 bg-white border border-[#e5e5e5] rounded text-[13px] font-mono placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d]"
                        />
                        {type === 'colors' ? (
                          <div
                            className="w-7 h-7 rounded border border-[#e5e5e5] flex-shrink-0"
                            style={{ backgroundColor: token.value || 'transparent' }}
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeToken(type, index)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-[#fee2e2] rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#dc2626]" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  if (activeTab === 'overview') {
    const op = operational;
    return (
      <div className="space-y-6">
        {op ? (
          <div
            className={`rounded-md border p-3 text-[12px] ${
              op.reviewGate.requiresReview
                ? 'bg-[#fff7ed] border-[#fed7aa] text-[#9a3412]'
                : 'bg-[#f0fdf4] border-[#bbf7d0] text-[#166534]'
            }`}
          >
            <div className="font-medium mb-1">{t('brand.brandKitDrawerContent.operational.bannerTitle')}</div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>
                {t('brand.brandKitDrawerContent.operational.pendingExtractions', {
                  count: op.state.overview.pendingExtractionCount,
                })}
              </li>
              <li>
                {t('brand.brandKitDrawerContent.operational.pendingReviews', {
                  count: op.state.overview.pendingReviewCount,
                })}
              </li>
              <li>
                {t('brand.brandKitDrawerContent.operational.conflicts', { count: op.state.overview.conflictCount })}
              </li>
              <li>
                {op.reviewGate.hasManualOverride
                  ? t('brand.brandKitDrawerContent.operational.overridesYes')
                  : t('brand.brandKitDrawerContent.operational.overridesNo')}
              </li>
              <li>
                {op.state.sourcesTab.sync.inFlight
                  ? t('brand.brandKitDrawerContent.operational.syncInFlight')
                  : op.state.overview.lastSuccessfulSyncAt
                    ? t('brand.brandKitDrawerContent.operational.lastSync', {
                        time: new Date(op.state.overview.lastSuccessfulSyncAt).toLocaleString(),
                      })
                    : t('brand.brandKitDrawerContent.operational.neverSynced')}
              </li>
            </ul>
            {op.reviewGate.requiresReview ? (
              <p className="mt-2 text-[11px]">{t('brand.brandKitDrawerContent.operational.reviewHint')}</p>
            ) : null}
          </div>
        ) : null}
        <FormField label={d('brandKitName')} required help={d('brandKitNameHelp')}>
          <Input
            value={data.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder={d('brandKitNamePlaceholder')}
            className="text-sm h-9 bg-[#fafafa] border-[#e5e5e5]"
            aria-label={d('brandKitName')}
          />
        </FormField>
        <FormField label={t('brand.brandKitForm.scopeLabel')} required help={t('brand.brandKitForm.scopeHelp')}>
          <select
            value={scopeValue}
            onChange={(e) => update('scope', e.target.value)}
            className={SELECT_CLASS}
            aria-label={t('brand.brandKitForm.scopeLabel')}
          >
            <option value="">{t('brand.brandKitForm.selectScopePlaceholder')}</option>
            {scopeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label={t('brand.brandKitForm.ownerLabel')} required help={t('brand.brandKitForm.ownerHelp')}>
          <select
            value={ownerValue}
            onChange={(e) => update('owner', e.target.value)}
            className={SELECT_CLASS}
            aria-label={t('brand.brandKitForm.ownerLabel')}
          >
            <option value="">{t('brand.brandKitForm.selectOwnerPlaceholder')}</option>
            {BRAND_KIT_OWNER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey)}
              </option>
            ))}
          </select>
        </FormField>

        {isWorkspaceSpecific && (
          <>
            {workspaceOptions.length > 0 ? (
              <FormField
                label={t('brand.brandKitForm.appliesToWorkspacesLabel')}
                required
                help={t('brand.brandKitForm.appliesToWorkspacesHelp')}
              >
                <div className="space-y-2">
                  {workspaceOptions.map((w) => (
                    <label key={w.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedWorkspaceIds.includes(w.value)}
                        onChange={() => toggleWorkspace(w.value)}
                        className="w-4 h-4 rounded border-[#e5e5e5]"
                      />
                      <span className="text-[13px] text-[#0d0d0d]">{w.label}</span>
                    </label>
                  ))}
                </div>
              </FormField>
            ) : (
              <FormField label={t('brand.brandKitForm.noWorkspacesLabel')} help={t('brand.brandKitForm.noWorkspacesHelp')}>
                <p className="text-[13px] text-[#991b1b]">{t('brand.brandKitForm.noWorkspacesCta')}</p>
              </FormField>
            )}
          </>
        )}

        {scopeValue === 'org-wide' && (
          <FormField
            label={t('brand.brandKitForm.primaryWorkspaceLabel')}
            required
            help={t('brand.brandKitForm.primaryWorkspaceHelp')}
          >
            <select
              value={selectedWorkspaceIds[0] ?? ''}
              onChange={(e) => {
                const v = e.target.value.trim();
                update('workspaces', v ? [v] : []);
              }}
              disabled={workspaceOptions.length === 0}
              className={SELECT_CLASS}
              aria-label={t('brand.brandKitForm.primaryWorkspaceLabel')}
            >
              <option value="">
                {workspaceOptions.length === 0
                  ? t('brand.brandKitForm.noWorkspacesAvailable')
                  : t('brand.brandKitForm.selectWorkspacePlaceholder')}
              </option>
              {workspaceOptions.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </FormField>
        )}

        <FormField label={t('brand.brandKitForm.editionLabel')} help={t('brand.brandKitForm.editionHelp')}>
          <select
            value={editionValue}
            onChange={(e) => update('edition', e.target.value)}
            className={SELECT_CLASS}
            aria-label={t('brand.brandKitForm.editionLabel')}
          >
            <option value="">{t('brand.brandKitForm.selectEditionPlaceholder')}</option>
            {editionOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label={t('brand.brandKitForm.notesLabel')} help={t('brand.brandKitForm.notesHelp')}>
          <textarea
            value={data.notes ?? ''}
            onChange={(e) => update('notes', e.target.value)}
            placeholder={t('brand.brandKitForm.notesPlaceholder')}
            rows={3}
            className="w-full min-h-[100px] px-3 py-2 bg-white border border-[#e5e5e5] rounded-md text-[13px] placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d] resize-none"
          />
        </FormField>

        {brandKit && !isBrandKitSourcesDraftId(brandKit.id) ? (
          <div className="pt-6 border-t border-[#e5e5e5]">
            <div className="text-[12px] font-medium text-[#0d0d0d] mb-3">{t('brand.brandKitDrawerContent.linkedModules.sectionTitle')}</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 p-3 border border-[#e5e5e5] rounded-lg bg-white hover:bg-[#fafafa] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                    <Layout className="w-4 h-4 text-[#666]" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[#0d0d0d]">{t('brand.brandKitDrawerContent.linkedModules.templatesTitle')}</div>
                    <div className="text-[11px] text-[#666]">
                      {linkedTemplateCount === 0
                        ? t('brand.brandKitDrawerContent.linkedModules.templatesNone')
                        : t('brand.brandKitDrawerContent.linkedModules.templatesLinked', { count: linkedTemplateCount })}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenBrandCenterModule?.('templates')}
                  className="flex items-center gap-1 px-3 h-7 text-[11px] text-[#5e6ad2] hover:bg-[#f0f0ff] rounded transition-colors flex-shrink-0"
                >
                  {t('brand.brandKitDrawerContent.linkedModules.manage')}
                  <ExternalLink className="w-3 h-3" aria-hidden />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 p-3 border border-[#e5e5e5] rounded-lg bg-white hover:bg-[#fafafa] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded bg-[#f5f5f5] flex items-center justify-center flex-shrink-0">
                    <FileCheck className="w-4 h-4 text-[#666]" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[#0d0d0d]">{t('brand.brandKitDrawerContent.linkedModules.disclaimersTitle')}</div>
                    <div className="text-[11px] text-[#666]">
                      {t('brand.brandKitDrawerContent.linkedModules.disclaimersSummary', { count: brandCenterDisclaimerCount })}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenBrandCenterModule?.('disclaimers')}
                  className="flex items-center gap-1 px-3 h-7 text-[11px] text-[#5e6ad2] hover:bg-[#f0f0ff] rounded transition-colors flex-shrink-0"
                >
                  {t('brand.brandKitDrawerContent.linkedModules.manage')}
                  <ExternalLink className="w-3 h-3" aria-hidden />
                </button>
              </div>
            </div>
            <p className="mt-3 p-2 bg-[#fafafa] rounded text-[10px] text-[#666]">{t('brand.brandKitDrawerContent.linkedModules.footnote')}</p>
          </div>
        ) : null}

        {brandKit && isBrandKitSourcesDraftId(brandKit.id) ? (
          <div className="rounded-lg border border-[#e5e5e5] bg-white p-4 space-y-3">
            <BrandKitSourcesTabContent
              brandKit={brandKit}
              operational={op}
              t={t}
              onEnsurePersistedKit={onEnsurePersistedKit}
              embeddedInOverview
              onContinueToExtractionReview={() => onNavigateTab?.('extraction-review')}
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (activeTab === 'sources') {
    if (!brandKit) {
      return (
        <p className="text-[13px] text-[#666]">{t('brand.brandKitDrawerContent.operational.needKitForTab')}</p>
      );
    }
    return (
      <div className="space-y-4">
        {operational ? <BrandKitOperationalStatusBar operational={operational} t={t} /> : null}
        <BrandKitSourcesTabContent
          brandKit={brandKit}
          operational={operational ?? null}
          t={t}
          onEnsurePersistedKit={onEnsurePersistedKit}
          onContinueToExtractionReview={() => onNavigateTab?.('extraction-review')}
        />
      </div>
    );
  }

  if (activeTab === 'extraction-review') {
    if (!brandKit) {
      return (
        <p className="text-[13px] text-[#666]">{t('brand.brandKitDrawerContent.operational.needKitForTab')}</p>
      );
    }
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-[#666]">{t('brand.brandKitDrawerContent.operational.extractionIntro')}</p>
        {operational ? <BrandKitOperationalStatusBar operational={operational} t={t} /> : null}
        <BrandKitExtractionReviewTabContent
          brandKit={brandKit}
          operational={operational ?? null}
          scopeIsOrgWide={scopeValue === 'org-wide'}
          t={t}
          onAcceptedRowsForForm={onExtractionReviewRowsChange}
        />
      </div>
    );
  }

  if (activeTab === 'logos') {
    if (!brandKit) {
      return (
        <p className="text-[13px] text-[#666]">{t('brand.brandKitDrawerContent.operational.needKitForTab')}</p>
      );
    }
    return (
      <div className="space-y-4">
        {operational ? <BrandKitOperationalStatusBar operational={operational} t={t} /> : null}
        <BrandKitLogosTabContent
          logos={canonicalLogos}
          onLogosChange={(next) => onEditChange({ canonicalLogos: next })}
          onOpenAssetsTab={onOpenBrandCenterModule ? () => onOpenBrandCenterModule('assets') : undefined}
          t={t}
        />
      </div>
    );
  }

  if (activeTab === 'guidelines') {
    if (!brandKit) {
      return (
        <p className="text-[13px] text-[#666]">{t('brand.brandKitDrawerContent.operational.needKitForTab')}</p>
      );
    }
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-[#666]">{t('brand.brandKitDrawerContent.operational.guidelinesIntro')}</p>
        {operational ? <BrandKitOperationalStatusBar operational={operational} t={t} /> : null}
        <BrandKitGuidelinesTabContent brandKit={brandKit} operational={operational ?? null} t={t} />
      </div>
    );
  }

  if (activeTab === 'tokens') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-8 px-3 border border-[#e5e5e5] text-[#0d0d0d] rounded-md text-[13px] hover:bg-[#f5f5f5] transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {t('brand.brandKitDrawerContent.tokens.actions.importTokens')}
          </button>
          <button
            type="button"
            className="h-8 px-3 border border-[#e5e5e5] text-[#0d0d0d] rounded-md text-[13px] hover:bg-[#f5f5f5] transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {t('brand.brandKitDrawerContent.tokens.actions.exportJson')}
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-[#e5e5e5]">
          {tokenTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setActiveTokenType(type.id)}
              className={`px-3 h-8 text-[13px] border-b-2 transition-colors ${
                activeTokenType === type.id
                  ? 'border-[#0d0d0d] text-[#0d0d0d] font-medium'
                  : 'border-transparent text-[#666] hover:text-[#0d0d0d]'
              }`}
            >
              {t(type.labelKey)}
            </button>
          ))}
        </div>

        {renderTokenTable(activeTokenType)}

        <div className="bg-[#dbeafe] border border-[#bfdbfe] rounded-md p-3">
          <div className="text-[12px] text-[#1e40af]">
            <div className="font-medium mb-1">{t('brand.brandKitDrawerContent.tokens.namingConvention.title')}</div>
            <ul className="space-y-0.5">
              <li>• {t('brand.brandKitDrawerContent.tokens.namingConvention.ruleKebab')}</li>
              <li>• {t('brand.brandKitDrawerContent.tokens.namingConvention.ruleNoSpaces')}</li>
              <li>• {t('brand.brandKitDrawerContent.tokens.namingConvention.ruleNoDuplicates')}</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'typography') {
    return (
      <div className="space-y-6">
        <FormField label={t('brand.brandKitForm.fontFamilyLabel')} help={t('brand.brandKitForm.fontFamilyHelp')}>
          <select
            value={typo.fontFamily ?? ''}
            onChange={(e) => updateTypography('fontFamily', e.target.value)}
            className={SELECT_CLASS}
            aria-label={t('brand.brandKitForm.fontFamilyAria')}
          >
            <option value="">{t('brand.brandKitForm.selectFontPlaceholder')}</option>
            {BRAND_KIT_FONT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey)}
              </option>
            ))}
          </select>
        </FormField>

        <div className="space-y-3">
          <h3 className="text-[13px] font-medium text-[#0d0d0d]">{t('brand.brandKitDrawerContent.typography.typeScaleTitle')}</h3>
          <div className="bg-white border border-[#e5e5e5] rounded-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#fafafa] border-b border-[#e5e5e5]">
                <tr>
                  <th className="text-left px-3 py-2 text-[11px] font-medium text-[#666] uppercase tracking-wide">
                    {t('brand.brandKitDrawerContent.typography.table.element')}
                  </th>
                  <th className="text-left px-3 py-2 text-[11px] font-medium text-[#666] uppercase tracking-wide">
                    {t('brand.brandKitDrawerContent.typography.table.size')}
                  </th>
                  <th className="text-left px-3 py-2 text-[11px] font-medium text-[#666] uppercase tracking-wide">
                    {t('brand.brandKitDrawerContent.typography.table.weight')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {typeScaleRows.map((item) => (
                  <tr key={item.id} className="border-b border-[#e5e5e5] last:border-0">
                    <td className="px-3 py-2">
                      <span className="text-[13px] text-[#0d0d0d]">{item.label}</span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={typo[`${item.id}Size`] ?? item.defaultSize}
                        onChange={(e) => updateTypography(`${item.id}Size`, e.target.value)}
                        placeholder={item.defaultSize}
                        className="w-20 h-7 px-2 bg-white border border-[#e5e5e5] rounded text-[13px] font-mono placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={typo[`${item.id}Weight`] ?? item.defaultWeight}
                        onChange={(e) => updateTypography(`${item.id}Weight`, e.target.value)}
                        placeholder={item.defaultWeight}
                        className="w-20 h-7 px-2 bg-white border border-[#e5e5e5] rounded text-[13px] font-mono placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-md p-4">
          <div className="text-[11px] text-[#666] uppercase tracking-wide mb-3">{t('brand.brandKitDrawerContent.typography.previewLabel')}</div>
          <div className="space-y-2">
            <div
              style={{
                fontFamily: brandKitPreviewFontStack(typo, 'heading') ?? 'inherit',
                fontSize: typo.h1Size ?? '32px',
                fontWeight: typo.h1Weight ?? '600',
              }}
            >
              {t('brand.brandKitDrawerContent.typography.sample.h1')}
            </div>
            <div
              style={{
                fontFamily: brandKitPreviewFontStack(typo, 'heading') ?? 'inherit',
                fontSize: typo.h2Size ?? '24px',
                fontWeight: typo.h2Weight ?? '600',
              }}
            >
              {t('brand.brandKitDrawerContent.typography.sample.h2')}
            </div>
            <div
              style={{
                fontFamily: brandKitPreviewFontStack(typo, 'heading') ?? 'inherit',
                fontSize: typo.h3Size ?? '20px',
                fontWeight: typo.h3Weight ?? '600',
              }}
            >
              {t('brand.brandKitDrawerContent.typography.sample.h3')}
            </div>
            <div
              style={{
                fontFamily: brandKitPreviewFontStack(typo, 'body') ?? 'inherit',
                fontSize: typo.bodySize ?? '15px',
                fontWeight: typo.bodyWeight ?? '400',
              }}
            >
              {t('brand.brandKitDrawerContent.typography.sample.body')}
            </div>
            <div
              style={{
                fontFamily: brandKitPreviewFontStack(typo, 'body') ?? 'inherit',
                fontSize: typo.captionSize ?? '13px',
                fontWeight: typo.captionWeight ?? '400',
              }}
              className="text-[#666]"
            >
              {t('brand.brandKitDrawerContent.typography.sample.caption')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'components') {
    const handleGenerateStyles = () => {
      const result = generateBrandKitComponentStyles({
        colors: formState.colors ?? [],
        spacing: formState.spacing ?? [],
        radius: formState.radius ?? [],
        shadows: formState.shadows ?? [],
      });
      onEditChange({
        componentStyleMappings: result.mappings,
        componentStylesGeneratedAt: result.generatedAt,
      });
      const unresolved = Object.values(result.mappings).some((slot) =>
        Object.values(slot).some((v) => !v || v.trim() === '')
      );
      setComponentGenerateNotice(
        unresolved
          ? t('brand.brandKitDrawerContent.components.stylesGeneratedMissingSlots')
          : t('brand.brandKitDrawerContent.components.stylesGeneratedDraftHelp')
      );
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[13px] text-[#666] min-w-0">{t('brand.brandKitDrawerContent.components.mappingHelp')}</div>
          <button
            type="button"
            onClick={handleGenerateStyles}
            className="h-8 shrink-0 px-3 bg-[#5e6ad2] text-white rounded-md text-[13px] hover:bg-[#4c5bc7] transition-colors flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {t('brand.brandKitDrawerContent.components.generateStyles')}
          </button>
        </div>

        {formState.componentStylesGeneratedAt ? (
          <p className="text-[11px] text-[#666]">
            {t('brand.brandKitDrawerContent.components.lastGenerated', {
              timestamp: new Date(formState.componentStylesGeneratedAt).toLocaleString(),
            })}
          </p>
        ) : null}

        {componentGenerateNotice ? (
          <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-md p-3 text-[12px] text-[#065f46]">{componentGenerateNotice}</div>
        ) : null}

        <div className="space-y-3">
          {BRAND_KIT_COMPONENT_DEFS.map((component) => {
            const slot = componentStyleMappings[component.id] ?? {};
            return (
              <div key={component.id} className="bg-white border border-[#e5e5e5] rounded-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-medium text-[#0d0d0d]">{t(component.labelKey)}</h3>
                  <span className="text-[11px] text-[#666]">{component.tokenKeys.length} slots</span>
                </div>
                <div className="space-y-2">
                  {component.tokenKeys.map((tokenKey) => {
                    const val = slot[tokenKey] ?? '';
                    const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(val.trim());
                    return (
                      <div key={tokenKey} className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono text-[#666] min-w-[7rem]">{tokenKey}</span>
                        <span
                          className={`text-[12px] font-mono px-2 py-0.5 rounded border border-[#e5e5e5] ${
                            val ? 'text-[#0d0d0d] bg-[#fafafa]' : 'text-[#999] bg-[#fafafa] italic'
                          }`}
                        >
                          {val || t('brand.brandKitDrawerContent.components.unresolved')}
                        </span>
                        {isHex ? (
                          <span
                            className="w-6 h-6 rounded border border-[#e5e5e5] flex-shrink-0"
                            style={{ backgroundColor: val }}
                            title={val}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {customComponents.length > 0 ? (
          <div className="space-y-2">
            <div className="text-[13px] font-medium text-[#0d0d0d]">{t('brand.brandKitDrawerContent.components.customComponentsTitle')}</div>
            {customComponents.map((component, index) => (
              <div key={index} className="p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-medium text-[#0d0d0d]">{component.name}</div>
                    <div className="text-[11px] text-[#666] mt-0.5">{component.type}</div>
                  </div>
                  <span className="px-2 h-5 rounded text-[11px] font-medium bg-[#dbeafe] text-[#1e40af]">{component.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="bg-[#dbeafe] border border-[#bfdbfe] rounded-md p-3">
          <div className="text-[12px] text-[#1e40af]">
            <div className="font-medium mb-1">{t('brand.brandKitDrawerContent.components.autoGenerationTitle')}</div>
            <div>
              {t('brand.brandKitDrawerContent.components.autoGenerationHelp', {
                examples: 'primary-color, radius',
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'preview') {
    return (
      <div className="space-y-6">
        <div className="text-[13px] font-medium text-[#0d0d0d] mb-3">{t('brand.brandKitDrawerContent.preview.colorPaletteTitle')}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 gap-y-4">
          {colors.map((color, index) => (
            <div key={index} className="min-w-0 flex flex-col gap-1">
              <div
                className="w-full h-16 rounded border border-[#e5e5e5] shrink-0"
                style={{ backgroundColor: color.value }}
                title={`${color.name} ${color.value}`}
              />
              <div
                className="text-[10px] text-[#666] font-mono leading-snug break-all"
                title={color.name}
              >
                {color.name}
              </div>
              <div className="text-[10px] text-[#999] font-mono truncate" title={color.value}>
                {color.value}
              </div>
            </div>
          ))}
        </div>
        <div className="text-[13px] font-medium text-[#0d0d0d] mb-3 mt-6">{t('brand.brandKitDrawerContent.preview.typographyTitle')}</div>
        <div className="space-y-3">
          {typeScaleRows.map((item) => {
            const role = item.id === 'body' || item.id === 'caption' ? 'body' : 'heading';
            const fontStack = brandKitPreviewFontStack(typo, role);
            return (
              <div
                key={item.id}
                className="p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-md min-w-0"
                style={{
                  fontFamily: fontStack,
                  fontSize: typo[`${item.id}Size`] ?? item.defaultSize,
                  fontWeight: typo[`${item.id}Weight`] ?? item.defaultWeight,
                }}
              >
                {t('brand.brandKitDrawerContent.typography.sample.pangram', { label: item.label })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (activeTab === 'audit') {
    const workspaceId = brandKit?.workspacesUsing?.[0];
    return (
      <DrawerAuditTab
        filters={workspaceId ? { workspace_id: workspaceId } : undefined}
        objectRefFilter={brandKit?.id ? { resourceTypes: ['artifact'], entityId: brandKit.id } : undefined}
        description={t('brand.brandKitDrawerContent.audit.description')}
        emptyMessage={t('brand.brandKitDrawerContent.audit.empty')}
        enabled={true}
      />
    );
  }

  return <TabUnavailable />;
}

export type { BrandKitCanonicalLogo, BrandKitLogoVariant } from './BrandKitLogosTabContent';
