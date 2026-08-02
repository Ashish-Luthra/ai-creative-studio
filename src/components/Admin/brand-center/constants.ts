/** Structural constants + i18n key paths (admin namespace). Use `t(labelKey)` with useTranslation('admin'). */

/** Client-only id until the kit row exists on the server (first source add or Save draft creates the row). */
export const BRAND_KIT_SOURCES_DRAFT_ID = '__sources_draft__';

export function isBrandKitSourcesDraftId(id: string | null | undefined): boolean {
  return id === BRAND_KIT_SOURCES_DRAFT_ID;
}

export const PAGE_SIZE = 25;

export const PRIMARY_BUTTON_CLASS = 'bg-[#0d0d0d] text-white hover:bg-[#262626]';

export type TabDef = { id: string; labelKey: string };

export const BRAND_TABS: readonly TabDef[] = [
  { id: 'brandkits', labelKey: 'brand.tabs.brandkits' },
  { id: 'templates', labelKey: 'brand.tabs.templates' },
  { id: 'disclaimers', labelKey: 'brand.tabs.disclaimers' },
  { id: 'copy-guidelines', labelKey: 'brand.tabs.copyGuidelines' },
  { id: 'assets', labelKey: 'brand.tabs.assets' },
  { id: 'publish-history', labelKey: 'brand.tabs.publishHistory' },
] as const;

export const TAB_ADD_LABEL_KEYS: Record<string, string> = {
  brandkits: 'brand.addActions.createBrandKit',
  disclaimers: 'brand.addActions.createDisclaimer',
  'copy-guidelines': 'brand.addActions.addGuideline',
  templates: 'brand.addActions.createTemplate',
};

export const BRAND_KIT_OWNER_OPTIONS = [
  { value: 'brand-marketing', labelKey: 'brand.ownerLabels.brandMarketing' },
  { value: 'product-marketing', labelKey: 'brand.ownerLabels.productMarketing' },
  { value: 'design-team', labelKey: 'brand.ownerLabels.designTeam' },
  { value: 'creative-services', labelKey: 'brand.ownerLabels.creativeServices' },
] as const;

export const BRAND_KIT_DRAWER_TABS: readonly TabDef[] = [
  { id: 'overview', labelKey: 'brand.brandKitDrawerTabs.overview' },
  { id: 'sources', labelKey: 'brand.brandKitDrawerTabs.sources' },
  { id: 'extraction-review', labelKey: 'brand.brandKitDrawerTabs.extractionReview' },
  { id: 'logos', labelKey: 'brand.brandKitDrawerTabs.logos' },
  { id: 'guidelines', labelKey: 'brand.brandKitDrawerTabs.guidelines' },
  { id: 'tokens', labelKey: 'brand.brandKitDrawerTabs.tokens' },
  { id: 'typography', labelKey: 'brand.brandKitDrawerTabs.typography' },
  { id: 'components', labelKey: 'brand.brandKitDrawerTabs.components' },
  { id: 'preview', labelKey: 'brand.brandKitDrawerTabs.preview' },
  { id: 'audit', labelKey: 'brand.brandKitDrawerTabs.audit' },
] as const;

export const DISCLAIMER_DRAWER_TABS: readonly TabDef[] = [
  { id: 'overview', labelKey: 'brand.disclaimerDrawerTabs.overview' },
  { id: 'applies-to', labelKey: 'brand.disclaimerDrawerTabs.appliesTo' },
  { id: 'localization', labelKey: 'brand.disclaimerDrawerTabs.localization' },
  { id: 'audit', labelKey: 'brand.disclaimerDrawerTabs.audit' },
] as const;

export const COPY_GUIDELINE_DRAWER_TABS: readonly TabDef[] = [
  { id: 'overview', labelKey: 'brand.copyGuidelineDrawerTabs.overview' },
  { id: 'forbidden-terms', labelKey: 'brand.copyGuidelineDrawerTabs.forbiddenTerms' },
  { id: 'tone-rules', labelKey: 'brand.copyGuidelineDrawerTabs.toneRules' },
  { id: 'examples', labelKey: 'brand.copyGuidelineDrawerTabs.examples' },
  { id: 'audit', labelKey: 'brand.copyGuidelineDrawerTabs.audit' },
] as const;

export const TEMPLATE_DRAWER_TABS: readonly TabDef[] = [
  { id: 'overview', labelKey: 'brand.templateDrawerTabs.overview' },
  { id: 'layout', labelKey: 'brand.templateDrawerTabs.layout' },
  { id: 'tokens', labelKey: 'brand.templateDrawerTabs.tokens' },
  { id: 'channels', labelKey: 'brand.templateDrawerTabs.channels' },
  { id: 'preview', labelKey: 'brand.templateDrawerTabs.preview' },
  { id: 'audit', labelKey: 'brand.templateDrawerTabs.audit' },
] as const;

export const PUBLISH_HISTORY_DRAWER_TABS: readonly TabDef[] = [
  { id: 'summary', labelKey: 'brand.publishHistoryDrawerTabs.summary' },
  { id: 'changes', labelKey: 'brand.publishHistoryDrawerTabs.changes' },
  { id: 'approvals', labelKey: 'brand.publishHistoryDrawerTabs.approvals' },
  { id: 'audit', labelKey: 'brand.publishHistoryDrawerTabs.audit' },
] as const;

export const COPY_GUIDELINE_CATEGORY_LABEL_KEYS: Record<string, string> = {
  tone: 'brand.copyGuidelineCategory.tone',
  'forbidden-terms': 'brand.copyGuidelineCategory.forbiddenTerms',
  'required-phrases': 'brand.copyGuidelineCategory.requiredPhrases',
  formatting: 'brand.copyGuidelineCategory.formatting',
};

export const COPY_GUIDELINE_SEVERITY_LABEL_KEYS: Record<string, string> = {
  critical: 'brand.copyGuidelineSeverity.critical',
  high: 'brand.copyGuidelineSeverity.high',
  medium: 'brand.copyGuidelineSeverity.medium',
  low: 'brand.copyGuidelineSeverity.low',
};

export const DISCLAIMER_CHANNEL_LABEL_KEYS: Record<string, string> = {
  push: 'brand.disclaimerChannel.push',
  email: 'brand.disclaimerChannel.email',
  ads: 'brand.disclaimerChannel.ads',
  whatsapp: 'brand.disclaimerChannel.whatsapp',
  inapp: 'brand.disclaimerChannel.inapp',
};

export const DISCLAIMER_PLACEMENT_LABEL_KEYS: Record<string, string> = {
  header: 'brand.disclaimerPlacement.header',
  footer: 'brand.disclaimerPlacement.footer',
  inline: 'brand.disclaimerPlacement.inline',
};

export const DISCLAIMER_LOCALE_LABEL_KEYS: Record<string, string> = {
  'en-US': 'brand.disclaimerLocale.enUS',
  'es-MX': 'brand.disclaimerLocale.esMX',
  'pt-BR': 'brand.disclaimerLocale.ptBR',
  'fr-FR': 'brand.disclaimerLocale.frFR',
  'de-DE': 'brand.disclaimerLocale.deDE',
  'en-GB': 'brand.disclaimerLocale.enGB',
  'hi-IN': 'brand.disclaimerLocale.hiIN',
  'ta-IN': 'brand.disclaimerLocale.taIN',
  'te-IN': 'brand.disclaimerLocale.teIN',
};

export const TEMPLATE_TYPE_LABEL_KEYS: Record<string, string> = {
  push: 'brand.templateType.push',
  email: 'brand.templateType.email',
  ads: 'brand.templateType.ads',
  inapp: 'brand.templateType.inapp',
  whatsapp: 'brand.templateType.whatsapp',
  'ad-creative': 'brand.templateType.adCreative',
  'in-app-card': 'brand.templateType.inAppCard',
};

export const ASSET_TYPE_LABEL_KEYS: Record<string, string> = {
  logo: 'brand.assetType.logo',
  legal_footer: 'brand.assetType.legalFooter',
  image: 'brand.assetType.image',
  font: 'brand.assetType.font',
  other: 'brand.assetType.other',
};
