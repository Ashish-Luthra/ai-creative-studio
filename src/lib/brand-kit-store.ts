import { promises as fs } from 'fs';
import path from 'path';
import type { BrandKitBoardData } from '../components/BrandCenter/BrandBoard';

/**
 * Minimal server-side persistence for generated brand kits: one JSON file per
 * domain under data/brand-kits/ (gitignored). Swapped for the real backend
 * (/v1/brand/kits) later — the API routes are the only callers.
 */

const DATA_DIR = path.join(process.cwd(), 'data', 'brand-kits');

/** Domain → safe filename ("hightouch.com" → "hightouch.com.json"). */
function fileFor(domain: string): string {
  const safe = domain.toLowerCase().replace(/[^a-z0-9.-]/g, '');
  if (!safe) throw new Error('Invalid domain');
  return path.join(DATA_DIR, `${safe}.json`);
}

export async function saveKit(kit: BrandKitBoardData & { domain: string }): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(fileFor(kit.domain), JSON.stringify(kit, null, 2), 'utf8');
}

export async function loadKit(domain: string): Promise<BrandKitBoardData | null> {
  try {
    return JSON.parse(await fs.readFile(fileFor(domain), 'utf8')) as BrandKitBoardData;
  } catch {
    return null;
  }
}

/**
 * Load the kit for a domain, tolerating a `www.` mismatch between the content
 * store and the brand-kit filenames (kits are saved under whatever host the
 * extractor was given, so `getjust.ai` and `www.getjust.ai` both occur).
 *
 * Returns null when the domain genuinely has no kit. It deliberately does NOT
 * fall back to some other tenant's kit — borrowing another brand's palette,
 * fonts and voice produces confidently off-brand creatives, which is worse than
 * degrading to neutral defaults.
 */
export async function loadKitForDomain(domain: string | null): Promise<BrandKitBoardData | null> {
  if (!domain) return null;
  const bare = domain.replace(/^www\./i, '');
  for (const candidate of [domain, bare, `www.${bare}`]) {
    const kit = await loadKit(candidate);
    if (kit) return kit;
  }
  return null;
}

/** Remove a kit's JSON and its stored assets (screenshots + fonts). Idempotent. */
export async function deleteKit(domain: string): Promise<boolean> {
  let existed = true;
  try {
    await fs.unlink(fileFor(domain));
  } catch {
    existed = false;
  }
  const safe = domain.toLowerCase().replace(/[^a-z0-9.-]/g, '');
  if (safe) {
    await fs.rm(path.join(process.cwd(), 'public', 'brand-kits', safe), { recursive: true, force: true }).catch(() => undefined);
  }
  return existed;
}

export async function listKits(): Promise<BrandKitBoardData[]> {
  try {
    const files = await fs.readdir(DATA_DIR);
    const kits = await Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map(async (f) => {
          try {
            return JSON.parse(await fs.readFile(path.join(DATA_DIR, f), 'utf8')) as BrandKitBoardData;
          } catch {
            return null;
          }
        })
    );
    return kits.filter((k): k is BrandKitBoardData => k !== null);
  } catch {
    return [];
  }
}
