/**
 * Typography tokens generated from design/figma/exports/tokens.json
 */

export const typography = {
  fontSize: {
    base: '16px',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
  },
  lineHeight: {
    default: '1.5',
  },
  fontSizes: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    md: '15px',
    lg: '17px',
    xl: 'var(--text-xl)',
    '2xl': 'var(--text-2xl)',
  },
} as const;

export type FontSize = keyof typeof typography.fontSizes;
export type FontWeight = keyof typeof typography.fontWeight;
