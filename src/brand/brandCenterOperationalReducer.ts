/**
 * Brand Center operational UI state (sources, extraction review, guidelines, sync).
 * Server-backed counts are merged via actions; drawer shell/tabs stay in BrandCenter (pages/workspace) + BrandKitDrawerShell.
 */

export type BrandKitsListFilterStatus = 'all' | 'draft' | 'published' | 'archived';

export type CreateFromSourcesStep = 'idle' | 'pick_sources' | 'confirm' | 'submitted';

export type ExtractionReviewDecision = 'accept_extracted' | 'keep_current' | 'manual_override';

export type BrandCenterOperationalState = {
  kitsList: {
    filterQuery: string;
    statusFilter: BrandKitsListFilterStatus;
  };
  createFromSources: {
    isOpen: boolean;
    step: CreateFromSourcesStep;
    provisionalBrandKitName: string;
    selectedSourceIds: string[];
  };
  sourcesTab: {
    selectedSourceId: string | null;
    /** Client-side draft edits keyed by source id (shape filled when wiring PATCH). */
    inlineEditsBySourceId: Record<string, Record<string, unknown>>;
    sync: {
      inFlight: boolean;
      lastStartedAt: string | null;
      lastCompletedAt: string | null;
      error: string | null;
    };
  };
  extractionReview: {
    /** Stable keys for extracted fields / rows awaiting review (API-defined when wired). */
    selectedKeys: string[];
    decisionsByKey: Record<string, ExtractionReviewDecision>;
    batchMode: boolean;
  };
  guidelinesTab: {
    selectedGuidelineId: string | null;
    generate: {
      inFlight: boolean;
      lastJobId: string | null;
      error: string | null;
    };
  };
  /** Rollups; prefer patching from list/job queries when available. */
  overview: {
    pendingExtractionCount: number;
    pendingReviewCount: number;
    conflictCount: number;
    lastSuccessfulSyncAt: string | null;
  };
};

export type BrandCenterOperationalAction =
  | { type: 'kitsList.setFilterQuery'; query: string }
  | { type: 'kitsList.setStatusFilter'; status: BrandKitsListFilterStatus }
  | { type: 'createFromSources.open' }
  | { type: 'createFromSources.close' }
  | { type: 'createFromSources.setStep'; step: CreateFromSourcesStep }
  | { type: 'createFromSources.setProvisionalName'; name: string }
  | { type: 'createFromSources.setSelectedSourceIds'; ids: string[] }
  | { type: 'createFromSources.toggleSourceId'; id: string }
  | { type: 'sources.selectSource'; id: string | null }
  | { type: 'sources.patchInlineEdit'; sourceId: string; patch: Record<string, unknown> }
  | { type: 'sources.clearInlineEdit'; sourceId: string }
  | { type: 'sources.syncStart' }
  | { type: 'sources.syncSuccess'; completedAt: string }
  | { type: 'sources.syncFailure'; error: string }
  | { type: 'sources.syncResetError' }
  | { type: 'extraction.selectKeys'; keys: string[] }
  | { type: 'extraction.toggleKey'; key: string }
  | { type: 'extraction.setDecision'; key: string; decision: ExtractionReviewDecision }
  | { type: 'extraction.unsetDecision'; key: string }
  | { type: 'extraction.clearDecisions' }
  | { type: 'extraction.setBatchMode'; on: boolean }
  | { type: 'guidelines.select'; id: string | null }
  | { type: 'guidelines.generateStart'; jobId: string | null }
  | { type: 'guidelines.generateSuccess'; jobId: string }
  | { type: 'guidelines.generateFailure'; error: string }
  | { type: 'guidelines.generateClearError' }
  | { type: 'overview.patch'; patch: Partial<BrandCenterOperationalState['overview']> }
  | { type: 'session.resetForBrandKit' };

export function initialBrandCenterOperationalState(): BrandCenterOperationalState {
  return {
    kitsList: { filterQuery: '', statusFilter: 'all' },
    createFromSources: {
      isOpen: false,
      step: 'idle',
      provisionalBrandKitName: '',
      selectedSourceIds: [],
    },
    sourcesTab: {
      selectedSourceId: null,
      inlineEditsBySourceId: {},
      sync: { inFlight: false, lastStartedAt: null, lastCompletedAt: null, error: null },
    },
    extractionReview: { selectedKeys: [], decisionsByKey: {}, batchMode: false },
    guidelinesTab: {
      selectedGuidelineId: null,
      generate: { inFlight: false, lastJobId: null, error: null },
    },
    overview: {
      pendingExtractionCount: 0,
      pendingReviewCount: 0,
      conflictCount: 0,
      lastSuccessfulSyncAt: null,
    },
  };
}

export function brandCenterOperationalReducer(
  state: BrandCenterOperationalState,
  action: BrandCenterOperationalAction
): BrandCenterOperationalState {
  switch (action.type) {
    case 'kitsList.setFilterQuery':
      return { ...state, kitsList: { ...state.kitsList, filterQuery: action.query } };
    case 'kitsList.setStatusFilter':
      return { ...state, kitsList: { ...state.kitsList, statusFilter: action.status } };
    case 'createFromSources.open':
      return {
        ...state,
        createFromSources: {
          ...state.createFromSources,
          isOpen: true,
          step: state.createFromSources.step === 'idle' ? 'pick_sources' : state.createFromSources.step,
        },
      };
    case 'createFromSources.close':
      return {
        ...state,
        createFromSources: {
          isOpen: false,
          step: 'idle',
          provisionalBrandKitName: '',
          selectedSourceIds: [],
        },
      };
    case 'createFromSources.setStep':
      return { ...state, createFromSources: { ...state.createFromSources, step: action.step } };
    case 'createFromSources.setProvisionalName':
      return {
        ...state,
        createFromSources: { ...state.createFromSources, provisionalBrandKitName: action.name },
      };
    case 'createFromSources.setSelectedSourceIds':
      return {
        ...state,
        createFromSources: { ...state.createFromSources, selectedSourceIds: action.ids },
      };
    case 'createFromSources.toggleSourceId': {
      const set = new Set(state.createFromSources.selectedSourceIds);
      if (set.has(action.id)) set.delete(action.id);
      else set.add(action.id);
      return {
        ...state,
        createFromSources: {
          ...state.createFromSources,
          selectedSourceIds: [...set],
        },
      };
    }
    case 'sources.selectSource':
      return { ...state, sourcesTab: { ...state.sourcesTab, selectedSourceId: action.id } };
    case 'sources.patchInlineEdit': {
      const prev = state.sourcesTab.inlineEditsBySourceId[action.sourceId] ?? {};
      return {
        ...state,
        sourcesTab: {
          ...state.sourcesTab,
          inlineEditsBySourceId: {
            ...state.sourcesTab.inlineEditsBySourceId,
            [action.sourceId]: { ...prev, ...action.patch },
          },
        },
      };
    }
    case 'sources.clearInlineEdit': {
      const { [action.sourceId]: _, ...rest } = state.sourcesTab.inlineEditsBySourceId;
      return { ...state, sourcesTab: { ...state.sourcesTab, inlineEditsBySourceId: rest } };
    }
    case 'sources.syncStart':
      return {
        ...state,
        sourcesTab: {
          ...state.sourcesTab,
          sync: {
            ...state.sourcesTab.sync,
            inFlight: true,
            lastStartedAt: new Date().toISOString(),
            error: null,
          },
        },
      };
    case 'sources.syncSuccess':
      return {
        ...state,
        sourcesTab: {
          ...state.sourcesTab,
          sync: {
            inFlight: false,
            lastCompletedAt: action.completedAt,
            lastStartedAt: state.sourcesTab.sync.lastStartedAt,
            error: null,
          },
        },
        overview: { ...state.overview, lastSuccessfulSyncAt: action.completedAt },
      };
    case 'sources.syncFailure':
      return {
        ...state,
        sourcesTab: {
          ...state.sourcesTab,
          sync: { ...state.sourcesTab.sync, inFlight: false, error: action.error },
        },
      };
    case 'sources.syncResetError':
      return {
        ...state,
        sourcesTab: { ...state.sourcesTab, sync: { ...state.sourcesTab.sync, error: null } },
      };
    case 'extraction.selectKeys':
      return {
        ...state,
        extractionReview: { ...state.extractionReview, selectedKeys: action.keys },
      };
    case 'extraction.toggleKey': {
      const set = new Set(state.extractionReview.selectedKeys);
      if (set.has(action.key)) set.delete(action.key);
      else set.add(action.key);
      return {
        ...state,
        extractionReview: { ...state.extractionReview, selectedKeys: [...set] },
      };
    }
    case 'extraction.setDecision':
      return {
        ...state,
        extractionReview: {
          ...state.extractionReview,
          decisionsByKey: {
            ...state.extractionReview.decisionsByKey,
            [action.key]: action.decision,
          },
        },
      };
    case 'extraction.unsetDecision': {
      const { [action.key]: _, ...rest } = state.extractionReview.decisionsByKey;
      return {
        ...state,
        extractionReview: { ...state.extractionReview, decisionsByKey: rest },
      };
    }
    case 'extraction.clearDecisions':
      return {
        ...state,
        extractionReview: { ...state.extractionReview, decisionsByKey: {} },
      };
    case 'extraction.setBatchMode':
      return {
        ...state,
        extractionReview: { ...state.extractionReview, batchMode: action.on },
      };
    case 'guidelines.select':
      return {
        ...state,
        guidelinesTab: { ...state.guidelinesTab, selectedGuidelineId: action.id },
      };
    case 'guidelines.generateStart':
      return {
        ...state,
        guidelinesTab: {
          ...state.guidelinesTab,
          generate: {
            inFlight: true,
            lastJobId: action.jobId,
            error: null,
          },
        },
      };
    case 'guidelines.generateSuccess':
      return {
        ...state,
        guidelinesTab: {
          ...state.guidelinesTab,
          generate: { inFlight: false, lastJobId: action.jobId, error: null },
        },
      };
    case 'guidelines.generateFailure':
      return {
        ...state,
        guidelinesTab: {
          ...state.guidelinesTab,
          generate: {
            ...state.guidelinesTab.generate,
            inFlight: false,
            error: action.error,
          },
        },
      };
    case 'guidelines.generateClearError':
      return {
        ...state,
        guidelinesTab: {
          ...state.guidelinesTab,
          generate: { ...state.guidelinesTab.generate, error: null },
        },
      };
    case 'overview.patch':
      return { ...state, overview: { ...state.overview, ...action.patch } };
    case 'session.resetForBrandKit': {
      const next = initialBrandCenterOperationalState();
      return {
        ...next,
        kitsList: state.kitsList,
        createFromSources: state.createFromSources,
      };
    }
  }
}

export type BrandCenterReviewGate = {
  requiresReview: boolean;
  hasConflict: boolean;
  hasManualOverride: boolean;
  undecidedExtractionKeys: number;
};

export function deriveReviewGate(
  state: BrandCenterOperationalState,
  options?: { conflictKeys?: string[] }
): BrandCenterReviewGate {
  const conflictKeys = options?.conflictKeys ?? [];
  const hasConflict = conflictKeys.length > 0 || state.overview.conflictCount > 0;
  const decisions = state.extractionReview.decisionsByKey;
  const decided = new Set(Object.keys(decisions));
  const selected = state.extractionReview.selectedKeys;
  const keysNeedingDecision =
    selected.length > 0 ? selected.filter((k) => !decided.has(k)) : conflictKeys.filter((k) => !decided.has(k));
  const undecidedExtractionKeys = keysNeedingDecision.length;
  const hasManualOverride = Object.values(decisions).some((d) => d === 'manual_override');
  const requiresReview =
    state.overview.pendingReviewCount > 0 || undecidedExtractionKeys > 0 || hasConflict;
  return { requiresReview, hasConflict, hasManualOverride, undecidedExtractionKeys };
}
