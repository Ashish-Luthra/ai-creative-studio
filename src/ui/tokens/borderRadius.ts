/**
 * Border radius tokens generated from design/figma/exports/tokens.json
 */

export const borderRadius = {
  sm: 'calc(var(--radius) - 4px)',
  md: 'calc(var(--radius) - 2px)',
  lg: '0.625rem',
  xl: 'calc(var(--radius) + 4px)',
  base: '0.625rem',
  full: '9999px',
} as const;

export type BorderRadius = keyof typeof borderRadius;
