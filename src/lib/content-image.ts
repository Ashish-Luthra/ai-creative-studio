import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Localise a crawled page's lead image into `public/content-images/<domain>/`.
 *
 * Two reasons not to just store the remote URL:
 *  - Hotlinking is unreliable — CDNs 403 on a missing/foreign Referer, so a
 *    library of remote thumbnails decays into broken images.
 *  - The Creative Studio draws these onto a Fabric canvas and exports it with
 *    `toDataURL()`. A cross-origin image taints the canvas and the export
 *    throws; same-origin files keep publish/export working.
 *
 * Failure is soft: the caller falls back to the category colour stub.
 *
 * Production path (ADR 0001): object storage + a `content_images` row keyed by
 * item id, same as the brand-kit assets.
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 AllyvateContentEngine/1.0';

const MAX_BYTES = 4_000_000;

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/gif': '.gif',
};

/** Safe on-disk name for a domain (mirrors the brand-kit asset layout). */
const safeDomain = (domain: string) => domain.replace(/[^a-z0-9.-]/gi, '_');

/**
 * Try each candidate in order, best first, and keep the first that lands.
 *
 * Single-candidate was too brittle: getjust.ai's Series-A post has a site-wide
 * og:image (correctly skipped as generic) and a 9.97MB hero above the size cap,
 * so it ended up with no picture at all despite four other usable images on the
 * page.
 */
export async function localizeFirstAvailable(
  candidates: string[],
  domain: string,
  itemId: string,
  pageUrl?: string
): Promise<string | null> {
  for (const candidate of candidates) {
    const stored = await localizeContentImage(candidate, domain, itemId, pageUrl);
    if (stored) return stored;
  }
  return null;
}

export async function localizeContentImage(
  remoteUrl: string,
  domain: string,
  itemId: string,
  pageUrl?: string
): Promise<string | null> {
  try {
    const res = await fetch(remoteUrl, {
      headers: {
        'User-Agent': UA,
        Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*',
        // Some CDNs serve 403 without a plausible Referer from the same site.
        ...(pageUrl ? { Referer: pageUrl } : {}),
      },
      signal: AbortSignal.timeout(15_000),
      redirect: 'follow',
    });
    if (!res.ok) return null;

    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const ext = EXT_BY_TYPE[type];
    if (!ext) return null; // not an image we can serve (HTML error page, SVG, …)

    const buf = Buffer.from(await res.arrayBuffer());
    // Guard both ends: a multi-MB hero is not worth storing, and a sub-1KB
    // response is a tracking pixel or an error placeholder, not a thumbnail.
    if (buf.byteLength > MAX_BYTES || buf.byteLength < 1_024) return null;

    const dir = path.join(process.cwd(), 'public', 'content-images', safeDomain(domain));
    await mkdir(dir, { recursive: true });
    const filename = `${itemId}${ext}`;
    await writeFile(path.join(dir, filename), buf);
    return `/content-images/${safeDomain(domain)}/${filename}`;
  } catch {
    return null;
  }
}
