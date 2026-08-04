import type { CtaSpec } from './brand-kit-types';

/**
 * Button labels scraped off a site are often form chrome rather than a call to
 * action — getjust.ai's "primary" CTA is its newsletter Submit button, while
 * the real marketing CTA ("Book a demo") sits in the link slot. An ad or a
 * landing page whose button says "Submit" reads as broken.
 */
export const FORM_CHROME_CTA = /^(submit|send|go|search|continue|next|ok|enter|sign in|log ?in)$/i;

export function isRealCta(label: string | undefined | null): boolean {
  return Boolean(label && label.trim() && !FORM_CHROME_CTA.test(label.trim()));
}

/**
 * The best usable CTA label from a kit. Keeps the primary when it reads as a
 * call to action, else takes the first one that does. Never invents a label —
 * it falls back to the primary rather than making something up.
 */
export function preferredCtaLabel(
  ctaSpecs: CtaSpec[] | undefined,
  intent: 'primary' | 'soft' = 'primary'
): string | undefined {
  const specs = ctaSpecs ?? [];
  const real = specs.filter((c) => isRealCta(c.label));
  const primary = specs.find((c) => c.kind === 'primary');
  const primaryLabel = (isRealCta(primary?.label) ? primary?.label : undefined) ?? real[0]?.label ?? primary?.label;
  if (intent !== 'soft') return primaryLabel;
  // An awareness-stage asset shouldn't shout "Book a demo".
  const soft = real.find((c) => c.kind === 'link')?.label ?? real.find((c) => c.kind === 'secondary')?.label;
  return soft ?? primaryLabel;
}
