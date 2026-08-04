import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  brandCenterOperationalReducer,
  deriveReviewGate,
  initialBrandCenterOperationalState,
  type BrandCenterOperationalState,
  type ExtractionReviewDecision,
} from './brandCenterOperationalReducer';

export type UseBrandCenterOperationalStateParams = {
  /** When the user opens a different brand kit in the drawer, tab-local state resets. */
  activeBrandKitId: string | null;
};

export function useBrandCenterOperationalState({ activeBrandKitId }: UseBrandCenterOperationalStateParams) {
  const [state, dispatch] = useReducer(brandCenterOperationalReducer, undefined, initialBrandCenterOperationalState);
  const lastKitRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeBrandKitId === null) {
      lastKitRef.current = null;
      return;
    }
    if (lastKitRef.current !== activeBrandKitId) {
      lastKitRef.current = activeBrandKitId;
      dispatch({ type: 'session.resetForBrandKit' });
    }
  }, [activeBrandKitId]);

  const act = useMemo(
    () => ({
      dispatch,
      setKitsFilterQuery: (query: string) => dispatch({ type: 'kitsList.setFilterQuery', query }),
      setKitsStatusFilter: (status: BrandCenterOperationalState['kitsList']['statusFilter']) =>
        dispatch({ type: 'kitsList.setStatusFilter', status }),
      openCreateFromSources: () => dispatch({ type: 'createFromSources.open' }),
      closeCreateFromSources: () => dispatch({ type: 'createFromSources.close' }),
      setCreateStep: (step: BrandCenterOperationalState['createFromSources']['step']) =>
        dispatch({ type: 'createFromSources.setStep', step }),
      setProvisionalBrandKitName: (name: string) =>
        dispatch({ type: 'createFromSources.setProvisionalName', name }),
      setCreateSelectedSourceIds: (ids: string[]) =>
        dispatch({ type: 'createFromSources.setSelectedSourceIds', ids }),
      toggleCreateSourceId: (id: string) => dispatch({ type: 'createFromSources.toggleSourceId', id }),
      selectSource: (id: string | null) => dispatch({ type: 'sources.selectSource', id }),
      patchSourceInlineEdit: (sourceId: string, patch: Record<string, unknown>) =>
        dispatch({ type: 'sources.patchInlineEdit', sourceId, patch }),
      clearSourceInlineEdit: (sourceId: string) => dispatch({ type: 'sources.clearInlineEdit', sourceId }),
      startSync: () => dispatch({ type: 'sources.syncStart' }),
      completeSync: (completedAt: string) => dispatch({ type: 'sources.syncSuccess', completedAt }),
      failSync: (error: string) => dispatch({ type: 'sources.syncFailure', error }),
      resetSyncError: () => dispatch({ type: 'sources.syncResetError' }),
      setExtractionSelectedKeys: (keys: string[]) => dispatch({ type: 'extraction.selectKeys', keys }),
      toggleExtractionKey: (key: string) => dispatch({ type: 'extraction.toggleKey', key }),
      setExtractionDecision: (key: string, decision: ExtractionReviewDecision) =>
        dispatch({ type: 'extraction.setDecision', key, decision }),
      unsetExtractionDecision: (key: string) => dispatch({ type: 'extraction.unsetDecision', key }),
      clearExtractionDecisions: () => dispatch({ type: 'extraction.clearDecisions' }),
      setExtractionBatchMode: (on: boolean) => dispatch({ type: 'extraction.setBatchMode', on }),
      selectGuideline: (id: string | null) => dispatch({ type: 'guidelines.select', id }),
      startGuidelineGenerate: (jobId: string | null) => dispatch({ type: 'guidelines.generateStart', jobId }),
      completeGuidelineGenerate: (jobId: string) => dispatch({ type: 'guidelines.generateSuccess', jobId }),
      failGuidelineGenerate: (error: string) => dispatch({ type: 'guidelines.generateFailure', error }),
      clearGuidelineGenerateError: () => dispatch({ type: 'guidelines.generateClearError' }),
      patchOverview: (patch: Partial<BrandCenterOperationalState['overview']>) =>
        dispatch({ type: 'overview.patch', patch }),
    }),
    []
  );

  const reviewGate = useMemo(() => deriveReviewGate(state), [state]);

  const mergeServerOverview = useCallback(
    (patch: Partial<BrandCenterOperationalState['overview']>) => {
      dispatch({ type: 'overview.patch', patch });
    },
    []
  );

  return useMemo(
    () => ({ state, act, reviewGate, mergeServerOverview }),
    [state, act, reviewGate, mergeServerOverview],
  );
}
