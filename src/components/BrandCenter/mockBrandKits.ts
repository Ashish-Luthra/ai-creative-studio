import type { BrandKitBoardData } from './BrandBoard';

/**
 * Mock brand kits for the Stage-1 UI preview (master brand + one sub-brand,
 * demonstrating the multi-kit case). Replaced by useBrandKits hooks in Stage 3.
 */
export const MOCK_BRAND_KITS: BrandKitBoardData[] = [
  {
    id: 'bk_master',
    name: 'Allyvate',
    domain: 'allyvate.ai',
    logoUrl: null,
    snapshotUrl: null,
    palette: ['#001B4A', '#2563EB', '#E0F2FE', '#10B981', '#F97316', '#F3F4F6'],
    typography: {
      heading: { family: 'Poppins', weight: 700 },
      body: { family: 'Inter', weight: 400 },
    },
  },
  {
    id: 'bk_sub',
    name: 'Wavelet',
    domain: 'wavelet.allyvate.ai',
    logoUrl: null,
    snapshotUrl: null,
    palette: ['#4A0E1B', '#E11D48', '#FFE4E6', '#0EA5E9', '#FACC15', '#F5F5F4'],
    typography: {
      heading: { family: 'DM Serif Display', weight: 400 },
      body: { family: 'Nunito Sans', weight: 400 },
    },
  },
];
