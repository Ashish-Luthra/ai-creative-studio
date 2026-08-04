import type { AssetType } from '../qualify/assetIntent.ts';

/**
 * Static content for the studio home screen. Pure data — the lucide icons
 * live in the components so this file stays importable under node:test.
 */

/** Cycled through the prompt box's placeholder while it sits idle. */
export const ROTATING_PLACEHOLDERS: string[] = [
  'Create a case study for CTO from call transcripts',
  'Create a 1:1 personalised page for prospecting',
  'Create an executive business case',
  'Create a follow up from my last demo',
];

export interface Capability {
  id: string;
  title: string;
  description: string;
  /**
   * Full card tile (481×231, own #ECF3FE rounded background) from the user's
   * design set in public/studio/home/. personalisation.svg was composed from
   * the master design's illustration group — the supplied export was empty.
   */
  illustration: string;
  /**
   * What clicking the card puts into the prompt box. Seeds ending in a space
   * expect the user to finish the sentence; complete sentences are ready to
   * send as-is.
   */
  seedPrompt: string;
  /**
   * What detectAssetType reads out of the seed — pinned by a unit test so a
   * pattern change can't silently reroute a card. `null` stays in the ads
   * qualify flow.
   */
  expectedAsset: AssetType | null;
}

export const CAPABILITIES: Capability[] = [
  {
    id: 'landing-page',
    title: 'Landing Page',
    description: 'Creates an on-brand landing page tailored to your audience.',
    illustration: '/studio/home/landing-page.svg',
    seedPrompt: 'Create a landing page for ',
    expectedAsset: 'landing-page',
  },
  {
    id: 'case-study',
    title: 'Case Study',
    description: 'Turns customer success into a compelling case study.',
    illustration: '/studio/home/case-study.svg',
    seedPrompt: 'Create a case study for our CTO from recent call transcripts',
    expectedAsset: 'case-study',
  },
  {
    id: 'social-ads',
    title: 'Social Ads',
    description: 'Generates on-brand social ads for every campaign.',
    illustration: '/studio/home/social-ads.svg',
    seedPrompt: 'Create a social ad campaign for ',
    expectedAsset: 'ad',
  },
  {
    id: 'personalisation',
    title: '1:1 Personalisation',
    // "personalised landing page", not the reference's "personalised page" —
    // the asset router only fires on an asset it can name.
    description: 'Builds a personalised landing page for a single prospect.',
    illustration: '/studio/home/personalisation.svg',
    seedPrompt: 'Create a 1:1 personalised landing page for ',
    expectedAsset: 'landing-page',
  },
  {
    id: 'performance',
    title: 'Performance Analysis',
    description: 'Understand the KPIs of recent campaigns.',
    illustration: '/studio/home/performance.svg',
    seedPrompt: 'Analyse the performance of my recent campaigns',
    expectedAsset: null,
  },
  {
    id: 'own-media',
    title: 'Own Media Campaigns',
    // Deliberately no channel words ("email" would route to the email
    // builder); an omni-channel plan starts in the ads qualify flow.
    description: 'Build campaigns for omni-channel communication.',
    illustration: '/studio/home/own-media.svg',
    seedPrompt: 'Plan an own-media campaign across our channels',
    expectedAsset: null,
  },
];
