/**
 * Brand Center page (workspace-level, main left-nav tab). Overview kit boards plus
 * brand kits, templates, disclaimers, copy guidelines, assets, publish history;
 * uses useAdminBrandKits, useAdminBrandTemplates, useAdminDisclaimers, etc.
 * Moved wholesale from the Admin console; /admin/brand redirects here.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandBoardsOverview } from '../../components/BrandCenter/BrandBoardsOverview';
import {
  useAdminBrandKits,
  useAdminWorkspaces,
  useAdminCreateBrandKit,
  useAdminPatchBrandKit,
  useAdminDeleteBrandKit,
  useAdminBrandTemplates,
  useAdminCreateBrandTemplate,
  useAdminUpdateBrandTemplate,
  useAdminDeleteBrandTemplate,
  useAdminDisclaimers,
  useAdminCreateDisclaimer,
  useAdminUpdateDisclaimer,
  useAdminDeleteDisclaimer,
  useAdminCopyGuidelines,
  useAdminCopyGuideline,
  useAdminCreateCopyGuideline,
  useAdminUpdateCopyGuideline,
  useAdminDeleteCopyGuideline,
  useAdminBrandAssets,
  useAdminCreateBrandAsset,
  useAdminUpdateBrandAsset,
  useAdminDeleteBrandAsset,
  useAdminUploadBrandAsset,
  useAdminPublishEvents,
  useAdminBrandKit,
  type BrandKit,
  type BrandTemplate,
  type LegalDisclaimer,
  type CopyGuideline,
  type BrandAsset,
  type BrandPublishEvent,
} from '../../hooks/useAdmin';
import {
  AdminDetailDrawer,
  ConfirmationModal,
  BrandKitDrawerShell,
  BrandKitDrawerContent,
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
  BRAND_KIT_DRAWER_TABS,
  DISCLAIMER_DRAWER_TABS,
  COPY_GUIDELINE_DRAWER_TABS,
  TEMPLATE_DRAWER_TABS,
  PUBLISH_HISTORY_DRAWER_TABS,
  ASSET_TYPE_LABEL_KEYS,
  type BrandKitFormState,
  type CopyGuidelineFormState,
  type DisclaimerFormState,
  type TemplateFormState,
} from '../../components/Admin';
import {
  brandKitDetailToFormPatch,
  brandKitFormToUpdateRequest,
  mergeAcceptedExtractionIntoBrandKitForm,
  resolveBrandKitWorkspaceIds,
} from '../../utils/brandKitFormMapping';
import type { ExtractionCandidateRow } from '../../utils/mapBrandExtractionResultToReviewRows';
import { preferredWorkspaceInList } from '../../utils/preferredAdminWorkspace';
import { useAuth } from '../../components/Providers/AuthContext';
import { Upload } from 'lucide-react';
import { useToast } from '../../components/Providers/ToastContext';
import { mapTabDefsToDrawerTabs } from '../../components/Admin/brand-center/brandCenterI18n';
import { useBrandCenterOperationalState } from '../../brand/useBrandCenterOperationalState';
function defaultBrandKitFormState(kit: BrandKit | null, preferredWorkspaceId: string | null): BrandKitFormState {
  if (kit) {
    return {
      name: kit.name,
      scope: '',
      edition: '',
      owner: '',
      workspaces: resolveBrandKitWorkspaceIds(kit),
      typography: {},
      componentStyleMappings: {},
      notes: '',
    };
  }
  return {
    name: '',
    scope: '',
    edition: '',
    owner: '',
    workspaces: preferredWorkspaceId ? [preferredWorkspaceId] : [],
    typography: {},
    componentStyleMappings: {},
    notes: '',
  };
}
const defaultDisclaimerForm: DisclaimerFormState = {
  text: '',
  required: false,
  placement: 'footer',
  channels: [],
  locales: [],
  title: '',
  channel: '',
  locale: 'en-US',
};
const defaultCopyGuidelineForm: CopyGuidelineFormState = {};
const defaultTemplateForm: TemplateFormState = {};

function getOtherDrawerTabs(section: 'disclaimers' | 'copy-guidelines' | 'templates' | null) {
  switch (section) {
    case 'disclaimers':
      return DISCLAIMER_DRAWER_TABS;
    case 'copy-guidelines':
      return COPY_GUIDELINE_DRAWER_TABS;
    case 'templates':
      return TEMPLATE_DRAWER_TABS;
    default:
      return [];
  }
}

function brandKitSourcesDraftPlaceholder(): BrandKit {
  return {
    id: BRAND_KIT_SOURCES_DRAFT_ID,
    name: '',
    lastUpdated: '',
    status: 'draft',
  };
}

function getOtherDrawerTitle(t: (key: string) => string, section: 'disclaimers' | 'copy-guidelines' | 'templates' | null) {
  switch (section) {
    case 'disclaimers':
      return t('brand.disclaimer');
    case 'copy-guidelines':
      return t('brand.copyGuideline');
    case 'templates':
      return t('brand.template');
    default:
      return t('brand.detail');
  }
}

/** All Brand Center tabs: kit summary boards (Overview) + the management tabs. */
const HUB_TABS: readonly { id: string; labelKey: string }[] = [
  { id: 'overview', labelKey: 'brand.tabs.overview' },
  ...BRAND_TABS,
];

/**
 * Brand Center (workspace-level): Overview boards plus kits, templates,
 * disclaimers, copy guidelines, assets, and publish history. Moved wholesale
 * from the Admin console (/admin/brand redirects here).
 * @component
 */
export function BrandCenter() {
  const { t } = useTranslation('admin');
  const { showSuccess } = useToast();
  const brandKitDrawerTabsResolved = useMemo(() => mapTabDefsToDrawerTabs(BRAND_KIT_DRAWER_TABS, t), [t]);
  const publishHistoryDrawerTabsResolved = useMemo(() => mapTabDefsToDrawerTabs(PUBLISH_HISTORY_DRAWER_TABS, t), [t]);
  const [activeTab, setActiveTab] = useState('overview');

  const [selectedKit, setSelectedKit] = useState<BrandKit | null>(null);
  const [brandKitDrawerOpen, setBrandKitDrawerOpen] = useState(false);
  const [brandKitDrawerTab, setBrandKitDrawerTab] = useState('overview');
  const [brandKitFormState, setBrandKitFormState] = useState<BrandKitFormState>({ name: '' });
  const [brandKitHydrateSession, setBrandKitHydrateSession] = useState(0);
  const brandKitSpecHydratedForSessionRef = useRef<number | null>(null);
  const [isBrandKitCreateMode, setIsBrandKitCreateMode] = useState(false);
  const validBrandKitDrawerTabIds = useMemo(() => new Set(BRAND_KIT_DRAWER_TABS.map((tab) => tab.id)), []);

  useEffect(() => {
    if (brandKitDrawerOpen && !validBrandKitDrawerTabIds.has(brandKitDrawerTab)) {
      setBrandKitDrawerTab('overview');
    }
  }, [brandKitDrawerOpen, brandKitDrawerTab, validBrandKitDrawerTabIds]);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [otherDrawerOpen, setOtherDrawerOpen] = useState(false);
  const [otherDrawerSection, setOtherDrawerSection] = useState<'disclaimers' | 'copy-guidelines' | 'templates' | null>(null);
  const [otherDrawerTab, setOtherDrawerTab] = useState('overview');
  const [disclaimerData, setDisclaimerData] = useState<DisclaimerFormState>(defaultDisclaimerForm);
  const [copyGuidelineData, setCopyGuidelineData] = useState<CopyGuidelineFormState>(defaultCopyGuidelineForm);
  const [templateData, setTemplateData] = useState<TemplateFormState>(defaultTemplateForm);
  const [publishDrawerTab, setPublishDrawerTab] = useState('summary');

  const [selectedTemplate, setSelectedTemplate] = useState<BrandTemplate | null>(null);
  const [selectedDisclaimer, setSelectedDisclaimer] = useState<LegalDisclaimer | null>(null);
  const [selectedCopyGuideline, setSelectedCopyGuideline] = useState<CopyGuideline | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<BrandAsset | null>(null);
  const [selectedPublishEvent, setSelectedPublishEvent] = useState<BrandPublishEvent | null>(null);
  const [assetDrawerOpen, setAssetDrawerOpen] = useState(false);
  const [assetFormState, setAssetFormState] = useState<{ name: string; uri: string; assetType: string; formats: string[] }>({
    name: '',
    uri: '',
    assetType: 'image',
    formats: [],
  });
  const [assetUploadError, setAssetUploadError] = useState<string | null>(null);
  const assetFileInputRef = useRef<HTMLInputElement>(null);
  const [otherSaveError, setOtherSaveError] = useState<string | null>(null);
  const [deleteOtherConfirm, setDeleteOtherConfirm] = useState<'template' | 'disclaimer' | 'copy-guideline' | 'asset' | null>(null);

  const { data, isLoading, error } = useAdminBrandKits();
  const { data: brandKitDetail } = useAdminBrandKit(
    brandKitDrawerOpen && selectedKit && !isBrandKitCreateMode ? selectedKit.id : undefined
  );
  const { data: workspaces } = useAdminWorkspaces();
  const patchBrandKit = useAdminPatchBrandKit();
  const deleteKit = useAdminDeleteBrandKit(
    selectedKit && !isBrandKitSourcesDraftId(selectedKit.id) ? selectedKit.id : '',
  );
  const createKit = useAdminCreateBrandKit();

  const { data: templatesData, isLoading: templatesLoading } = useAdminBrandTemplates();
  const { data: disclaimersData, isLoading: disclaimersLoading } = useAdminDisclaimers();
  const { data: copyGuidelinesData, isLoading: copyGuidelinesLoading } = useAdminCopyGuidelines();
  const { data: copyGuidelineDetail } = useAdminCopyGuideline(selectedCopyGuideline?.id);
  const { data: assetsData, isLoading: assetsLoading } = useAdminBrandAssets();
  const { data: publishEventsData, isLoading: publishEventsLoading } = useAdminPublishEvents();

  const createTemplate = useAdminCreateBrandTemplate();
  const updateTemplate = useAdminUpdateBrandTemplate(selectedTemplate?.id ?? '');
  const deleteTemplate = useAdminDeleteBrandTemplate(selectedTemplate?.id ?? '');
  const createDisclaimer = useAdminCreateDisclaimer();
  const updateDisclaimer = useAdminUpdateDisclaimer(selectedDisclaimer?.id ?? '');
  const deleteDisclaimer = useAdminDeleteDisclaimer(selectedDisclaimer?.id ?? '');
  const createCopyGuideline = useAdminCreateCopyGuideline();
  const updateCopyGuideline = useAdminUpdateCopyGuideline(selectedCopyGuideline?.id ?? '');
  const deleteCopyGuideline = useAdminDeleteCopyGuideline(selectedCopyGuideline?.id ?? '');
  const createAsset = useAdminCreateBrandAsset();
  const updateAsset = useAdminUpdateBrandAsset(selectedAsset?.id ?? '');
  const deleteAsset = useAdminDeleteBrandAsset(selectedAsset?.id ?? '');
  const uploadAsset = useAdminUploadBrandAsset();

  const items = data?.items ?? [];
  const workspaceList = workspaces?.items ?? [];
  const { workspaceId: authWorkspaceId } = useAuth();
  const preferredWorkspaceId = useMemo(
    () => preferredWorkspaceInList(authWorkspaceId, workspaceList),
    [authWorkspaceId, workspaceList],
  );
  const workspaceOptions = workspaceList.map((w) => ({ value: w.id, label: w.name }));
  const brandKitOperational = useBrandCenterOperationalState({
    activeBrandKitId: brandKitDrawerOpen && selectedKit ? selectedKit.id : null,
  });

  const ensurePersistedKitForSources = useCallback(async (): Promise<{ kitId: string } | { error: string }> => {
    if (selectedKit && !isBrandKitSourcesDraftId(selectedKit.id)) {
      return { kitId: selectedKit.id };
    }
    const name = (brandKitFormState.name ?? '').trim();
    const workspaceIdFromState = (brandKitFormState.workspaces ?? [])[0];
    const isOrgWide = brandKitFormState.scope === 'org-wide';
    if (!name || (!isOrgWide && !workspaceIdFromState)) {
      const err =
        workspaceList.length === 0
          ? t('brand.errors.noWorkspacesForCreate', {
              defaultValue: 'No workspaces exist yet. Create a workspace under Admin -> Workspaces, then try again.',
            })
          : isOrgWide
            ? t('brand.errors.missingRequiredOrgWide', {
                defaultValue: 'Complete required fields (name, scope, owner) for org-wide kit.',
              })
            : t('brand.errors.missingRequiredWorkspaceScoped', {
                defaultValue: 'Choose a workspace and complete required fields (name, scope, owner).',
              });
      setCreateError(err);
      return { error: err };
    }
    setCreateError(null);
    setUpdateError(null);
    try {
      const created = await createKit.mutateAsync({
        name,
        workspaceId: isOrgWide ? undefined : workspaceIdFromState,
        ownerRef: isOrgWide ? { ownerType: 'organization' } : { ownerType: 'workspace', workspaceId: workspaceIdFromState },
      });
      const updated = await patchBrandKit.mutateAsync({
        id: created.id,
        body: brandKitFormToUpdateRequest(brandKitFormState),
      });
      setSelectedKit(updated);
      setIsBrandKitCreateMode(false);
      brandKitSpecHydratedForSessionRef.current = null;
      setBrandKitHydrateSession((s) => s + 1);
      return { kitId: updated.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setCreateError(msg);
      return { error: msg };
    }
  }, [selectedKit, brandKitFormState, workspaceList.length, createKit, patchBrandKit, t]);
  const templates = templatesData?.items ?? [];
  const disclaimers = disclaimersData?.items ?? [];
  const linkedTemplateCountForSelectedKit = useMemo(() => {
    if (!selectedKit?.id || isBrandKitSourcesDraftId(selectedKit.id)) return 0;
    return templates.filter((tm) => (tm.brandKitId ?? '') === selectedKit.id).length;
  }, [templates, selectedKit]);

  const openBrandCenterModule = useCallback((module: 'templates' | 'disclaimers' | 'assets') => {
    setActiveTab(module);
  }, []);
  const copyGuidelines = copyGuidelinesData?.items ?? [];
  const assets = assetsData?.items ?? [];
  const publishEvents = publishEventsData?.items ?? [];

  const handleAssetFile = useCallback(
    async (file: File) => {
      setAssetUploadError(null);
      try {
        const { uri } = await uploadAsset.mutateAsync(file);
        setAssetFormState((prev) => {
          const name = prev.name.trim() ? prev.name : file.name.replace(/\.[^.]+$/, '') || file.name;
          return { ...prev, uri, name: prev.name.trim() || name };
        });
      } catch (e) {
        setAssetUploadError(e instanceof Error ? e.message : String(e));
      }
    },
    [uploadAsset]
  );

  useEffect(() => {
    if (!selectedKit || !data?.items || brandKitDrawerOpen) return;
    const updated = data.items.find((b) => b.id === selectedKit.id);
    if (updated) setSelectedKit((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : updated));
  }, [data?.items, selectedKit?.id, brandKitDrawerOpen]);

  useEffect(() => {
    if (!brandKitDrawerOpen || !selectedKit || isBrandKitCreateMode) return;
    if (!brandKitDetail || brandKitDetail.id !== selectedKit.id) return;
    if (brandKitSpecHydratedForSessionRef.current === brandKitHydrateSession) return;
    brandKitSpecHydratedForSessionRef.current = brandKitHydrateSession;
    setBrandKitFormState((prev) => ({
      ...defaultBrandKitFormState(selectedKit, preferredWorkspaceId),
      ...brandKitDetailToFormPatch(brandKitDetail),
      name: brandKitDetail.name ?? prev.name,
    }));
  }, [brandKitDrawerOpen, selectedKit, isBrandKitCreateMode, brandKitDetail, brandKitHydrateSession, preferredWorkspaceId]);

  useEffect(() => {
    if (
      otherDrawerSection === 'copy-guidelines' &&
      selectedCopyGuideline &&
      copyGuidelineDetail &&
      copyGuidelineDetail.id === selectedCopyGuideline.id
    ) {
      setCopyGuidelineData({
        name: copyGuidelineDetail.name,
        category: copyGuidelineDetail.category,
        severity: copyGuidelineDetail.severity,
        description: copyGuidelineDetail.description,
        forbiddenTerms: copyGuidelineDetail.forbiddenTerms ?? [],
        toneRules: copyGuidelineDetail.toneRules,
        examples: copyGuidelineDetail.examples ?? [],
      });
    }
  }, [otherDrawerSection, selectedCopyGuideline?.id, copyGuidelineDetail]);

  const openBrandKitDrawer = (kit: BrandKit | null) => {
    setCreateError(null);
    if (kit) {
      setSelectedKit(kit);
      setBrandKitFormState(defaultBrandKitFormState(kit, preferredWorkspaceId));
      setIsBrandKitCreateMode(false);
      setBrandKitDrawerTab('overview');
      brandKitSpecHydratedForSessionRef.current = null;
      setBrandKitHydrateSession((s) => s + 1);
    } else {
      setSelectedKit(brandKitSourcesDraftPlaceholder());
      setBrandKitFormState(defaultBrandKitFormState(null, preferredWorkspaceId));
      setIsBrandKitCreateMode(true);
      setBrandKitDrawerTab('overview');
    }
    setBrandKitDrawerOpen(true);
  };

  const handleSaveBrandKit = async () => {
    const id = selectedKit?.id;
    if (!id || isBrandKitSourcesDraftId(id)) {
      setUpdateError('No brand kit selected.');
      return;
    }
    setUpdateError(null);
    try {
      const updated = await patchBrandKit.mutateAsync({
        id,
        body: brandKitFormToUpdateRequest(brandKitFormState),
      });
      setSelectedKit(updated);
      showSuccess(t('brand.brandKitDraftSaved', { defaultValue: 'Draft saved' }));
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : String(e));
    }
  };

  const handlePublishBrandKit = async (ctx?: { approvalReason?: string }) => {
    const id = selectedKit?.id;
    if (!id || isBrandKitSourcesDraftId(id)) {
      const msg = 'No brand kit selected.';
      setUpdateError(msg);
      throw new Error(msg);
    }
    setUpdateError(null);
    try {
      const updated = await patchBrandKit.mutateAsync({
        id,
        body: brandKitFormToUpdateRequest(brandKitFormState, {
          publish: true,
          publishApprovalReason: ctx?.approvalReason,
        }),
      });
      setSelectedKit(updated);
      showSuccess(t('brand.brandKitPublished', { defaultValue: 'Brand kit published' }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setUpdateError(msg);
      throw e instanceof Error ? e : new Error(msg);
    }
  };

  const handleCreateSaveDraft = async () => {
    const name = (brandKitFormState.name ?? '').trim();
    const workspaceIdFromState = (brandKitFormState.workspaces ?? [])[0];
    const isOrgWide = brandKitFormState.scope === 'org-wide';
    if (!name || (!isOrgWide && !workspaceIdFromState)) {
      setCreateError(
        workspaceList.length === 0
          ? t('brand.errors.noWorkspacesForCreate', {
              defaultValue: 'No workspaces exist yet. Create a workspace under Admin -> Workspaces, then try again.',
            })
          : isOrgWide
            ? t('brand.errors.missingRequiredOrgWide', {
                defaultValue: 'Complete required fields (name, scope, owner) for org-wide kit.',
              })
            : t('brand.errors.missingRequiredWorkspaceScoped', {
                defaultValue: 'Choose a workspace and complete required fields (name, scope, owner).',
              })
      );
      return;
    }
    setCreateError(null);
    setUpdateError(null);
    try {
      const created = await createKit.mutateAsync({
        name,
        workspaceId: isOrgWide ? undefined : workspaceIdFromState,
        ownerRef: isOrgWide ? { ownerType: 'organization' } : { ownerType: 'workspace', workspaceId: workspaceIdFromState },
      });
      const updated = await patchBrandKit.mutateAsync({
        id: created.id,
        body: brandKitFormToUpdateRequest(brandKitFormState),
      });
      setSelectedKit(updated);
      setIsBrandKitCreateMode(false);
      brandKitSpecHydratedForSessionRef.current = null;
      setBrandKitHydrateSession((s) => s + 1);
      showSuccess(t('brand.brandKitDraftSaved', { defaultValue: 'Draft saved' }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setCreateError(msg);
    }
  };

  const handleCreatePublish = async (ctx?: { approvalReason?: string }) => {
    const name = (brandKitFormState.name ?? '').trim();
    const workspaceIdFromState = (brandKitFormState.workspaces ?? [])[0];
    const isOrgWide = brandKitFormState.scope === 'org-wide';
    if (!name || (!isOrgWide && !workspaceIdFromState)) {
      const msg =
        workspaceList.length === 0
          ? t('brand.errors.noWorkspacesForCreate', {
              defaultValue: 'No workspaces exist yet. Create a workspace under Admin -> Workspaces, then try again.',
            })
          : isOrgWide
            ? t('brand.errors.missingRequiredOrgWide', {
                defaultValue: 'Complete required fields (name, scope, owner) for org-wide kit.',
              })
            : t('brand.errors.missingRequiredWorkspaceScoped', {
                defaultValue: 'Choose a workspace and complete required fields (name, scope, owner).',
              });
      setCreateError(msg);
      throw new Error(msg);
    }
    setCreateError(null);
    setUpdateError(null);
    try {
      const created = await createKit.mutateAsync({
        name,
        workspaceId: isOrgWide ? undefined : workspaceIdFromState,
        ownerRef: isOrgWide ? { ownerType: 'organization' } : { ownerType: 'workspace', workspaceId: workspaceIdFromState },
      });
      const updated = await patchBrandKit.mutateAsync({
        id: created.id,
        body: brandKitFormToUpdateRequest(brandKitFormState, {
          publish: true,
          publishApprovalReason: ctx?.approvalReason,
        }),
      });
      setSelectedKit(updated);
      setIsBrandKitCreateMode(false);
      brandKitSpecHydratedForSessionRef.current = null;
      setBrandKitHydrateSession((s) => s + 1);
      showSuccess(t('brand.brandKitPublished', { defaultValue: 'Brand kit published' }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setCreateError(msg);
      throw e instanceof Error ? e : new Error(msg);
    }
  };

  const handleFooterSaveDraft = async () => {
    if (isBrandKitCreateMode) {
      await handleCreateSaveDraft();
    } else {
      await handleSaveBrandKit();
    }
  };

  const handleFooterPublish = async (ctx?: { approvalReason?: string }) => {
    if (isBrandKitCreateMode) {
      await handleCreatePublish(ctx);
    } else {
      await handlePublishBrandKit(ctx);
    }
  };

  const mergeExtractionAcceptedIntoForm = useCallback((rows: ExtractionCandidateRow[]) => {
    setBrandKitFormState((prev) => ({ ...prev, ...mergeAcceptedExtractionIntoBrandKitForm(prev, rows) }));
  }, []);

  const handleDeleteBrandKit = async () => {
    if (!selectedKit || isBrandKitSourcesDraftId(selectedKit.id)) return;
    setDeleteError(null);
    try {
      await deleteKit.mutateAsync();
      setDeleteConfirmOpen(false);
      setBrandKitDrawerOpen(false);
      setSelectedKit(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    }
  };

  const openOtherDrawer = (
    section: 'disclaimers' | 'copy-guidelines' | 'templates',
    item?: BrandTemplate | LegalDisclaimer | CopyGuideline | null
  ) => {
    setOtherDrawerSection(section);
    setOtherDrawerTab('overview');
    setOtherSaveError(null);
    if (section === 'templates') {
      const template = item as BrandTemplate | null | undefined;
      setSelectedTemplate(template ?? null);
      setTemplateData(template ? { name: template.name } : defaultTemplateForm);
    } else if (section === 'disclaimers') {
      const disclaimer = item as LegalDisclaimer | null | undefined;
      setSelectedDisclaimer(disclaimer ?? null);
      setDisclaimerData(disclaimer ? { title: disclaimer.title, channel: disclaimer.channel, text: disclaimer.title } : defaultDisclaimerForm);
    } else if (section === 'copy-guidelines') {
      const guideline = item as CopyGuideline | null | undefined;
      setSelectedCopyGuideline(guideline ?? null);
      setCopyGuidelineData(
        guideline
          ? {
              name: guideline.name,
              category: guideline.category,
              severity: guideline.severity,
              description: guideline.description,
              forbiddenTerms: guideline.forbiddenTerms,
              toneRules: guideline.toneRules,
              examples: guideline.examples,
            }
          : defaultCopyGuidelineForm
      );
    }
    setOtherDrawerOpen(true);
  };

  const closeOtherDrawer = () => {
    setOtherDrawerOpen(false);
    setOtherDrawerSection(null);
    setSelectedTemplate(null);
    setSelectedDisclaimer(null);
    setSelectedCopyGuideline(null);
    setOtherSaveError(null);
  };

  const handleSaveOther = async () => {
    setOtherSaveError(null);
    try {
      if (otherDrawerSection === 'templates') {
        const name = (templateData.name ?? '').trim();
        if (!name) return;
        if (selectedTemplate) {
          await updateTemplate.mutateAsync({ name });
        } else {
          await createTemplate.mutateAsync({ name });
        }
      } else if (otherDrawerSection === 'disclaimers') {
        const title = (disclaimerData.title ?? disclaimerData.text ?? '').trim();
        if (!title) return;
        if (selectedDisclaimer) {
          await updateDisclaimer.mutateAsync({ title, channel: disclaimerData.channel || undefined });
        } else {
          await createDisclaimer.mutateAsync({ title, channel: disclaimerData.channel || undefined });
        }
      } else if (otherDrawerSection === 'copy-guidelines') {
        const name = (copyGuidelineData.name ?? '').trim();
        if (!name) return;
        const payload = {
          name,
          category: copyGuidelineData.category ?? '',
          severity: copyGuidelineData.severity ?? '',
          description: copyGuidelineData.description ?? '',
          forbiddenTerms: copyGuidelineData.forbiddenTerms ?? [],
          toneRules: copyGuidelineData.toneRules ?? { dos: [], donts: [] },
          examples: copyGuidelineData.examples ?? [],
        };
        if (selectedCopyGuideline) {
          await updateCopyGuideline.mutateAsync(payload);
        } else {
          await createCopyGuideline.mutateAsync(payload);
        }
      }
      closeOtherDrawer();
    } catch (e) {
      setOtherSaveError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDeleteOther = async () => {
    if (!deleteOtherConfirm) return;
    setOtherSaveError(null);
    try {
      if (deleteOtherConfirm === 'template' && selectedTemplate) {
        await deleteTemplate.mutateAsync();
        setDeleteOtherConfirm(null);
        closeOtherDrawer();
      } else if (deleteOtherConfirm === 'disclaimer' && selectedDisclaimer) {
        await deleteDisclaimer.mutateAsync();
        setDeleteOtherConfirm(null);
        closeOtherDrawer();
      } else if (deleteOtherConfirm === 'copy-guideline' && selectedCopyGuideline) {
        await deleteCopyGuideline.mutateAsync();
        setDeleteOtherConfirm(null);
        closeOtherDrawer();
      } else if (deleteOtherConfirm === 'asset' && selectedAsset) {
        await deleteAsset.mutateAsync();
        setDeleteOtherConfirm(null);
        setAssetDrawerOpen(false);
        setSelectedAsset(null);
      }
    } catch (e) {
      setOtherSaveError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleOpenAsset = (asset: BrandAsset | null) => {
    setSelectedAsset(asset);
    setAssetFormState(
      asset
        ? { name: asset.name, uri: asset.uri, assetType: asset.assetType ?? 'image', formats: asset.formats ?? [] }
        : { name: '', uri: '', assetType: 'image', formats: [] }
    );
    setAssetDrawerOpen(true);
  };

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-600">Failed to load brand data.</p>
        <p className="text-sm text-[#666] mt-1">{error instanceof Error ? error.message : String(error)}</p>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="flex flex-col h-full min-h-0 -mx-6 -mt-1 -mb-6">
            <BrandBoardsOverview />
          </div>
        );
      case 'brandkits':
        return (
          <div className="flex flex-col h-full min-h-0 -mx-6 -mt-1 -mb-6">
            <BrandKitsView
              items={items}
              isLoading={isLoading}
              onOpenKit={openBrandKitDrawer}
              onOpenAudit={(kit) => {
                setSelectedKit(kit);
                setIsBrandKitCreateMode(false);
                setBrandKitDrawerTab('audit');
                setBrandKitDrawerOpen(true);
              }}
              onDeleteKit={(kit) => {
                setSelectedKit(kit);
                setDeleteConfirmOpen(true);
              }}
              onClearCreateError={() => setCreateError(null)}
              selectedKitId={
                selectedKit && !isBrandKitSourcesDraftId(selectedKit.id) ? selectedKit.id : null
              }
              workspaceLabelById={Object.fromEntries(workspaceOptions.map((o) => [o.value, o.label]))}
              operational={{
                kitsList: brandKitOperational.state.kitsList,
                createFromSources: brandKitOperational.state.createFromSources,
                act: brandKitOperational.act,
              }}
            />
          </div>
        );
      case 'templates':
        return (
          <TemplatesView
            templates={templates}
            isLoading={templatesLoading}
            onOpenTemplate={(t) => openOtherDrawer('templates', t)}
            onOpenAudit={(t) => {
              setSelectedTemplate(t);
              setOtherDrawerSection('templates');
              setOtherDrawerTab('audit');
              setTemplateData({ name: t.name });
              setOtherDrawerOpen(true);
            }}
            onDeleteTemplate={(t) => {
              setSelectedTemplate(t);
              setDeleteOtherConfirm('template');
            }}
          />
        );
      case 'disclaimers':
        return (
          <DisclaimersView
            disclaimers={disclaimers}
            isLoading={disclaimersLoading}
            onOpenDisclaimer={(d) => openOtherDrawer('disclaimers', d)}
            onOpenAudit={(d) => {
              setSelectedDisclaimer(d);
              setOtherDrawerSection('disclaimers');
              setOtherDrawerTab('audit');
              setDisclaimerData({ ...defaultDisclaimerForm, title: d.title, channel: d.channel ?? '', locale: d.locale ?? 'en-US' });
              setOtherDrawerOpen(true);
            }}
            onDeleteDisclaimer={(d) => {
              setSelectedDisclaimer(d);
              setDeleteOtherConfirm('disclaimer');
            }}
          />
        );
      case 'copy-guidelines':
        return (
          <CopyGuidelinesView
            copyGuidelines={copyGuidelines}
            isLoading={copyGuidelinesLoading}
            onOpenCopyGuideline={(c) => openOtherDrawer('copy-guidelines', c)}
            onOpenAudit={(c) => {
              setSelectedCopyGuideline(c);
              setOtherDrawerSection('copy-guidelines');
              setOtherDrawerTab('audit');
              setCopyGuidelineData({ name: c.name });
              setOtherDrawerOpen(true);
            }}
            onDeleteCopyGuideline={(c) => {
              setSelectedCopyGuideline(c);
              setDeleteOtherConfirm('copy-guideline');
            }}
          />
        );
      case 'assets':
        return (
          <AssetLibraryView
            assets={assets}
            isLoading={assetsLoading}
            onOpenAsset={handleOpenAsset}
            onDeleteAsset={(a) => {
              setSelectedAsset(a);
              setDeleteOtherConfirm('asset');
            }}
          />
        );
      case 'publish-history':
        return (
          <PublishHistoryView
            events={publishEvents}
            isLoading={publishEventsLoading}
            onOpenEvent={(e) => {
              setSelectedPublishEvent(e);
              setPublishDrawerTab('summary');
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#fafafa]">
      <div className="h-16 bg-white border-b border-[#e5e5e5] flex items-center justify-between px-6 flex-shrink-0">
        <h1 className="text-[15px] font-medium text-[#0d0d0d]">{t('brand.title')}</h1>
      </div>

      <div className="bg-white border-b border-[#e5e5e5] flex-shrink-0">
        <div className="flex items-center px-6 gap-1">
          {HUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 h-10 text-[13px] border-b-2 transition-colors flex-shrink-0 ${
                activeTab === tab.id
                  ? 'border-[#0d0d0d] text-[#0d0d0d] font-medium'
                  : 'border-transparent text-[#666] hover:text-[#0d0d0d]'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-h-0">
        <div className="h-full overflow-auto px-6 pt-1 pb-6 bg-white">
          {renderContent()}
        </div>
      </div>

      {/* Brand Kit drawer — Figma BrandKitDrawer (480px shell) */}
      <BrandKitDrawerShell
        isOpen={brandKitDrawerOpen}
        onClose={() => {
          setBrandKitDrawerOpen(false);
          setSelectedKit(null);
          setDeleteConfirmOpen(false);
          setUpdateError(null);
          setCreateError(null);
          setIsBrandKitCreateMode(false);
          brandKitSpecHydratedForSessionRef.current = null;
        }}
        isCreating={isBrandKitCreateMode}
        selectedKit={selectedKit}
        formState={brandKitFormState}
        tabs={brandKitDrawerTabsResolved}
        activeTab={brandKitDrawerTab}
        onTabChange={setBrandKitDrawerTab}
        onSaveDraft={handleFooterSaveDraft}
        onPublish={handleFooterPublish}
        onArchiveConfirm={() => setDeleteConfirmOpen(true)}
        createPending={createKit.isPending}
        updatePending={patchBrandKit.isPending}
        errorMessage={updateError ?? createError}
      >
        <BrandKitDrawerContent
          brandKit={selectedKit}
          formState={brandKitFormState}
          onEditChange={(patch) => setBrandKitFormState((prev) => ({ ...prev, ...patch }))}
          activeTab={brandKitDrawerTab}
          workspaceOptions={workspaceOptions}
          operational={brandKitOperational}
          onEnsurePersistedKit={ensurePersistedKitForSources}
          onNavigateTab={setBrandKitDrawerTab}
          onExtractionReviewRowsChange={mergeExtractionAcceptedIntoForm}
          linkedTemplateCount={linkedTemplateCountForSelectedKit}
          brandCenterDisclaimerCount={disclaimers.length}
          onOpenBrandCenterModule={openBrandCenterModule}
        />
      </BrandKitDrawerShell>

      {/* Other section drawer */}
      <AdminDetailDrawer
        isOpen={otherDrawerOpen}
        onClose={closeOtherDrawer}
        title={
          otherDrawerSection === 'templates'
            ? (selectedTemplate?.name ?? 'New Template')
            : otherDrawerSection === 'disclaimers'
              ? (selectedDisclaimer?.title ?? 'New Disclaimer')
              : otherDrawerSection === 'copy-guidelines'
                ? (selectedCopyGuideline?.name ?? 'New Copy Guideline')
                : getOtherDrawerTitle(t, otherDrawerSection)
        }
        subtitle={otherDrawerSection === 'templates' ? selectedTemplate?.id : otherDrawerSection === 'disclaimers' ? selectedDisclaimer?.id : otherDrawerSection === 'copy-guidelines' ? selectedCopyGuideline?.id : undefined}
        objectType={otherDrawerSection === 'disclaimers' ? 'Disclaimer' : otherDrawerSection ?? ''}
        status={
          otherDrawerSection === 'disclaimers' && selectedDisclaimer?.status
            ? (selectedDisclaimer.status as 'draft' | 'in_review' | 'approved' | 'in_progress' | 'completed')
            : undefined
        }
        tabs={getOtherDrawerTabs(otherDrawerSection).map((tab) => ({ id: tab.id, label: t(tab.labelKey) }))}
        activeTab={otherDrawerTab}
        onTabChange={setOtherDrawerTab}
        primaryAction={{
          label: t('common.save'),
          onClick: handleSaveOther,
          disabled: Boolean(
            (otherDrawerSection === 'templates' && !(templateData.name ?? '').trim()) ||
            (otherDrawerSection === 'disclaimers' && !(disclaimerData.title ?? disclaimerData.text ?? '').trim()) ||
            (otherDrawerSection === 'copy-guidelines' && (!(copyGuidelineData.name ?? '').trim() || !(copyGuidelineData.category ?? '').trim() || !(copyGuidelineData.severity ?? '').trim())) ||
            (otherDrawerSection === 'templates' && createTemplate.isPending) ||
            (otherDrawerSection === 'templates' && selectedTemplate && updateTemplate.isPending) ||
            (otherDrawerSection === 'disclaimers' && createDisclaimer.isPending) ||
            (otherDrawerSection === 'disclaimers' && selectedDisclaimer && updateDisclaimer.isPending) ||
            (otherDrawerSection === 'copy-guidelines' && createCopyGuideline.isPending) ||
            (otherDrawerSection === 'copy-guidelines' && selectedCopyGuideline && updateCopyGuideline.isPending)
          ),
        }}
        secondaryAction={{ label: 'Cancel', onClick: closeOtherDrawer }}
        overflowActions={
          (otherDrawerSection === 'templates' && selectedTemplate) ||
          (otherDrawerSection === 'disclaimers' && selectedDisclaimer) ||
          (otherDrawerSection === 'copy-guidelines' && selectedCopyGuideline)
            ? [
                {
                  label: otherDrawerSection === 'templates' ? 'Delete template' : otherDrawerSection === 'disclaimers' ? 'Delete disclaimer' : 'Delete copy guideline',
                  onClick: () =>
                    setDeleteOtherConfirm(
                      otherDrawerSection === 'templates' ? 'template' : otherDrawerSection === 'disclaimers' ? 'disclaimer' : 'copy-guideline'
                    ),
                  destructive: true,
                },
              ]
            : undefined
        }
      >
        {otherDrawerSection === 'disclaimers' && (
          <DisclaimerDrawerContent data={disclaimerData} onDataChange={setDisclaimerData} activeTab={otherDrawerTab} objectRef={selectedDisclaimer?.id} />
        )}
        {otherDrawerSection === 'copy-guidelines' && (
          <CopyGuidelineDrawerContent data={copyGuidelineData} onDataChange={setCopyGuidelineData} activeTab={otherDrawerTab} objectRef={selectedCopyGuideline?.id} />
        )}
        {otherDrawerSection === 'templates' && (
          <TemplateDrawerContent data={templateData} onDataChange={setTemplateData} activeTab={otherDrawerTab} objectRef={selectedTemplate?.id} />
        )}
        {otherSaveError && (
          <div className="mt-4 p-3 bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] rounded text-sm" role="alert">
            {otherSaveError}
          </div>
        )}
      </AdminDetailDrawer>

      {/* Asset drawer */}
      <AdminDetailDrawer
        isOpen={assetDrawerOpen}
        onClose={() => {
          setAssetDrawerOpen(false);
          setSelectedAsset(null);
          setOtherSaveError(null);
          setAssetUploadError(null);
          setAssetFormState({ name: '', uri: '', assetType: 'image', formats: [] });
          if (assetFileInputRef.current) assetFileInputRef.current.value = '';
        }}
        title={selectedAsset?.name ?? 'Upload Asset'}
        subtitle={selectedAsset?.id}
        objectType="Asset"
        primaryAction={{
          label: selectedAsset ? 'Save' : 'Create',
          onClick: async () => {
            const name = assetFormState.name.trim();
            const uri = assetFormState.uri.trim();
            if (!name || !uri) return;
            setOtherSaveError(null);
            const assetType = assetFormState.assetType || 'image';
            const formats = Array.isArray(assetFormState.formats) ? assetFormState.formats : [];
            try {
              if (selectedAsset) {
                await updateAsset.mutateAsync({ name, uri, assetType, formats });
              } else {
                await createAsset.mutateAsync({ name, uri, assetType, formats });
              }
              setAssetDrawerOpen(false);
              setSelectedAsset(null);
              setAssetFormState({ name: '', uri: '', assetType: 'image', formats: [] });
            } catch (e) {
              setOtherSaveError(e instanceof Error ? e.message : String(e));
            }
          },
          disabled: !assetFormState.name.trim() || !assetFormState.uri.trim() || createAsset.isPending || uploadAsset.isPending || (selectedAsset != null && updateAsset.isPending),
        }}
        secondaryAction={{ label: 'Cancel', onClick: () => { setAssetDrawerOpen(false); setSelectedAsset(null); } }}
        overflowActions={selectedAsset ? [{ label: 'Delete asset', onClick: () => setDeleteOtherConfirm('asset'), destructive: true }] : undefined}
      >
        <div className="space-y-6">
          <div>
            <label className="text-[13px] font-medium text-[#0d0d0d] block mb-1.5">{t('brand.assetsDrawer.name')}</label>
            <input
              type="text"
              value={assetFormState.name}
              onChange={(e) => setAssetFormState((s) => ({ ...s, name: e.target.value }))}
              placeholder={t('brand.assetsDrawer.namePlaceholder')}
              className="w-full h-9 px-3 bg-white border border-[#e5e5e5] rounded-md text-[13px] focus:outline-none focus:border-[#0d0d0d]"
            />
          </div>
          <div>
            <label className="text-[13px] font-medium text-[#0d0d0d] block mb-1.5">{t('brand.assetsDrawer.type')}</label>
            <select
              value={assetFormState.assetType || 'image'}
              onChange={(e) => setAssetFormState((s) => ({ ...s, assetType: e.target.value }))}
              className="w-full h-9 px-3 bg-white border border-[#e5e5e5] rounded-md text-[13px] focus:outline-none focus:border-[#0d0d0d]"
            >
              <option value="">{t('brand.assetsDrawer.selectType')}</option>
              {Object.entries(ASSET_TYPE_LABEL_KEYS).map(([value, labelKey]) => (
                <option key={value} value={value}>{t(labelKey)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[13px] font-medium text-[#0d0d0d] block mb-1.5">{t('brand.assetsDrawer.formats')}</label>
            <input
              type="text"
              value={(assetFormState.formats ?? []).join(', ')}
              onChange={(e) =>
                setAssetFormState((s) => ({
                  ...s,
                  formats: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
                }))
              }
              placeholder="e.g. SVG, PNG, PDF"
              className="w-full h-9 px-3 bg-white border border-[#e5e5e5] rounded-md text-[13px] focus:outline-none focus:border-[#0d0d0d]"
            />
            <p className="text-[11px] text-[#666] mt-1">{t('brand.assetsDrawer.formatsHelp')}</p>
          </div>
          {!selectedAsset && (
            <div>
              <label className="text-[13px] font-medium text-[#0d0d0d] block mb-1.5">Upload file</label>
              <p className="text-[11px] text-[#666] mb-2">Drag and drop a file here, or click to browse. File will be stored in object storage and the URL saved with the asset.</p>
              <input
                ref={assetFileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAssetFile(file);
                  e.target.value = '';
                }}
              />
              <div
                role="button"
                tabIndex={0}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleAssetFile(file);
                }}
                onClick={() => assetFileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); assetFileInputRef.current?.click(); } }}
                className="border-2 border-dashed border-[#e5e5e5] rounded-lg p-6 text-center cursor-pointer hover:border-[#5e6ad2] hover:bg-[#fafafa] transition-colors focus:outline-none focus:ring-2 focus:ring-[#5e6ad2] focus:ring-offset-1"
              >
                {uploadAsset.isPending ? (
                  <span className="text-[13px] text-[#666]">Uploading…</span>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-[#999] mx-auto mb-2" aria-hidden />
                    <span className="text-[13px] text-[#666]">{t('brand.assetsDrawer.dropzone')}</span>
                  </>
                )}
              </div>
            </div>
          )}
          <div>
            <label className="text-[13px] font-medium text-[#0d0d0d] block mb-1.5">{t('brand.assetsDrawer.uri')}</label>
            <input
              type="text"
              value={assetFormState.uri}
              onChange={(e) => setAssetFormState((s) => ({ ...s, uri: e.target.value }))}
              placeholder={t('brand.assetsDrawer.uriPlaceholder')}
              className="w-full h-9 px-3 bg-white border border-[#e5e5e5] rounded-md text-[13px] focus:outline-none focus:border-[#0d0d0d]"
            />
          </div>
        </div>
        {assetUploadError && (
          <div className="mt-4 p-3 bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] rounded text-sm" role="alert">
            {assetUploadError}
          </div>
        )}
        {otherSaveError && (
          <div className="mt-4 p-3 bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] rounded text-sm" role="alert">
            {otherSaveError}
          </div>
        )}
      </AdminDetailDrawer>

      {selectedPublishEvent && (
        <AdminDetailDrawer
          isOpen={!!selectedPublishEvent}
          onClose={() => {
            setSelectedPublishEvent(null);
            setPublishDrawerTab('summary');
          }}
          title={`${selectedPublishEvent.objectRef} v${selectedPublishEvent.toVersion}`}
          subtitle={formatDateBrand(selectedPublishEvent.publishedAt)}
          objectType="Publish event"
          tabs={publishHistoryDrawerTabsResolved}
          activeTab={publishDrawerTab}
          onTabChange={setPublishDrawerTab}
        >
          <PublishHistoryDrawerContent
            data={{
              version: `v${selectedPublishEvent.toVersion}`,
              date: formatDateBrand(selectedPublishEvent.publishedAt),
              objectName: selectedPublishEvent.objectRef,
              objectId: selectedPublishEvent.id,
              affectedWorkspaces: [selectedPublishEvent.workspaceId],
              changesSummary: selectedPublishEvent.reasonCode ?? '—',
              changes: [],
              approvers: [{ name: selectedPublishEvent.publishedBy, role: 'Publisher', timestamp: formatDateBrand(selectedPublishEvent.publishedAt) }],
              id: selectedPublishEvent.id,
              publishedBy: selectedPublishEvent.publishedBy,
            }}
            activeTab={publishDrawerTab}
          />
        </AdminDetailDrawer>
      )}

      <ConfirmationModal
        isOpen={deleteConfirmOpen}
        onClose={() => { setDeleteConfirmOpen(false); setDeleteError(null); }}
        onConfirm={handleDeleteBrandKit}
        title="Delete brand kit"
        message="This will permanently delete the brand kit."
        variant="danger"
        confirmText="Delete"
        disabled={deleteKit.isPending}
        error={deleteError}
      />

      <ConfirmationModal
        isOpen={!!deleteOtherConfirm}
        onClose={() => { setDeleteOtherConfirm(null); setOtherSaveError(null); }}
        onConfirm={handleDeleteOther}
        title={
          deleteOtherConfirm === 'template'
            ? 'Delete template'
            : deleteOtherConfirm === 'disclaimer'
              ? 'Delete disclaimer'
              : deleteOtherConfirm === 'copy-guideline'
                ? 'Delete copy guideline'
                : deleteOtherConfirm === 'asset'
                  ? 'Delete asset'
                  : 'Delete'
        }
        message="This action cannot be undone."
        variant="danger"
        confirmText="Delete"
        disabled={
          (deleteOtherConfirm === 'template' && deleteTemplate.isPending) ||
          (deleteOtherConfirm === 'disclaimer' && deleteDisclaimer.isPending) ||
          (deleteOtherConfirm === 'copy-guideline' && deleteCopyGuideline.isPending) ||
          (deleteOtherConfirm === 'asset' && deleteAsset.isPending)
        }
        error={otherSaveError}
      />
    </div>
  );
}
