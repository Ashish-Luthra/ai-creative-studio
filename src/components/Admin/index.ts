/**
 * Trimmed Admin barrel for salesdemo-ui: only the pieces the Brand Center
 * screens use (drawers, confirmation modal, row menu, audit tab, and the whole
 * brand-center component family). The rest of the Admin console stayed behind
 * in the Allyvatemarketingos repo.
 */
export { AdminRowActionsMenu, type AdminRowAction, type AdminRowActionsMenuProps } from './AdminRowActionsMenu';
export {
  AdminDetailDrawer,
  type AdminDetailDrawerProps,
  type AdminDetailDrawerTab,
  type AdminDrawerStatus,
  type ReasonCodeBanner,
} from './AdminDetailDrawer';
export { ConfirmationModal, type ConfirmationModalProps } from './ConfirmationModal';
export {
  DrawerAuditTab,
  type DrawerAuditTabProps,
} from './DrawerAuditTab';
export { TabUnavailable } from './TabUnavailable';
export {
  BrandKitDrawerShell,
  type BrandKitDrawerShellProps,
  BrandKitDrawerContent,
  BrandKitLogosTabContent,
  CopyGuidelineDrawerContent,
  DisclaimerDrawerContent,
  TemplateDrawerContent,
  PublishHistoryDrawerContent,
  BrandKitsView,
  TemplatesView,
  DisclaimersView,
  CopyGuidelinesView,
  AssetLibraryView,
  PublishHistoryView,
  formatDateBrand,
  BRAND_TABS,
  BRAND_KIT_SOURCES_DRAFT_ID,
  isBrandKitSourcesDraftId,
  PAGE_SIZE,
  TAB_ADD_LABEL_KEYS,
  PRIMARY_BUTTON_CLASS,
  BRAND_KIT_DRAWER_TABS,
  BRAND_KIT_OWNER_OPTIONS,
  DISCLAIMER_DRAWER_TABS,
  COPY_GUIDELINE_DRAWER_TABS,
  TEMPLATE_DRAWER_TABS,
  PUBLISH_HISTORY_DRAWER_TABS,
  ASSET_TYPE_LABEL_KEYS,
  mapTabDefsToDrawerTabs,
  translateLabelKeyMap,
  brandKitOwnerLabel,
  type TabDef,
  type BrandKitDrawerContentProps,
  type BrandKitFormState,
  type BrandKitCanonicalLogo,
  type BrandKitLogoVariant,
  type CopyGuidelineDrawerContentProps,
  type CopyGuidelineFormState,
  type DisclaimerDrawerContentProps,
  type DisclaimerFormState,
  type TemplateDrawerContentProps,
  type TemplateFormState,
  type PublishHistoryDrawerContentProps,
  type PublishHistoryFormState,
  type BrandKitsViewProps,
  type TemplatesViewProps,
  type DisclaimersViewProps,
  type CopyGuidelinesViewProps,
  type AssetLibraryViewProps,
  type PublishHistoryViewProps,
} from './brand-center';
