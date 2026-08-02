import type { TFunction } from 'i18next';
import type { AdminDetailDrawerTab } from '../AdminDetailDrawer';
import type { TabDef } from './constants';

export function mapTabDefsToDrawerTabs(tabs: readonly TabDef[], t: TFunction<'admin'>): AdminDetailDrawerTab[] {
  return tabs.map((tab) => ({ id: tab.id, label: t(tab.labelKey) }));
}

export function translateLabelKeyMap(
  value: string | undefined | null,
  keyMap: Record<string, string>,
  t: TFunction<'admin'>
): string {
  if (value == null || value === '') return '';
  const path = keyMap[value];
  return path ? t(path) : value;
}

const OWNER_VALUE_TO_KEY: Record<string, string> = {
  'brand-marketing': 'brand.ownerLabels.brandMarketing',
  'product-marketing': 'brand.ownerLabels.productMarketing',
  'design-team': 'brand.ownerLabels.designTeam',
  'creative-services': 'brand.ownerLabels.creativeServices',
};

export function brandKitOwnerLabel(owner: string | undefined | null, t: TFunction<'admin'>): string {
  if (owner == null || owner === '') return t('brand.common.emDash');
  const path = OWNER_VALUE_TO_KEY[owner];
  return path ? t(path) : owner;
}
