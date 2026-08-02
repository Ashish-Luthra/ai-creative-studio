/**
 * Spacing tokens generated from design/figma/exports/tokens.json
 */

export const spacing = {
  scale: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    6: '24px',
    8: '32px',
  },
  common: {
    sidebarWidth: '280px',
    headerHeight: '64px',
    rowHeight: '48px',
    rowHeightCompact: '40px',
  },
} as const;

export type SpacingScale = keyof typeof spacing.scale;
export type SpacingCommon = keyof typeof spacing.common;
