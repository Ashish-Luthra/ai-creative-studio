import type { BrandCenterOperationalState } from './brandCenterOperationalReducer';
import type { useBrandCenterOperationalState } from './useBrandCenterOperationalState';

/** Pass-through from `useBrandCenterOperationalState` for BrandKit drawer tabs. */
export type BrandKitDrawerOperationalBinding = Pick<
  ReturnType<typeof useBrandCenterOperationalState>,
  'state' | 'act' | 'reviewGate' | 'mergeServerOverview'
>;

type Act = ReturnType<typeof useBrandCenterOperationalState>['act'];

/** List view: filters + create-from-sources flow actions. */
export type BrandKitsViewOperationalBinding = Pick<BrandCenterOperationalState, 'kitsList' | 'createFromSources'> & {
  act: Pick<
    Act,
    | 'setKitsFilterQuery'
    | 'setKitsStatusFilter'
    | 'openCreateFromSources'
    | 'closeCreateFromSources'
    | 'setCreateStep'
    | 'setProvisionalBrandKitName'
    | 'toggleCreateSourceId'
    | 'setCreateSelectedSourceIds'
  >;
};
