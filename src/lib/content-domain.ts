import { listKits } from './brand-kit-store';
import { listContentDomains, loadContentFile } from './content-store';

/**
 * Workspace content domain: explicit param wins; else the content file with
 * items (most recently synced first — the corpus the user is actually
 * building); else the first brand kit.
 */
export async function resolveDomain(explicit?: string | null): Promise<string | null> {
  if (explicit) return explicit.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const domains = await listContentDomains();
  let best: { domain: string; score: string } | null = null;
  for (const d of domains) {
    const file = await loadContentFile(d);
    if (file.items.length === 0) continue;
    const score = file.lastSyncAt ?? file.items[0]?.updatedAt ?? '';
    if (!best || score > best.score) best = { domain: d, score };
  }
  if (best) return best.domain;
  const kits = await listKits();
  return kits.find((k) => k.domain)?.domain ?? null;
}

/** Brand display name for classification prompts (kit name, else domain). */
export async function resolveBrandName(domain: string): Promise<string> {
  const kits = await listKits();
  return kits.find((k) => k.domain === domain)?.name ?? domain;
}
