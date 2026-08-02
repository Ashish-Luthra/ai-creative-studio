import { promises as fs } from 'fs';
import path from 'path';
import type { StyleSheetText } from './render';
import type { FontFaceAsset } from '../brand-kit-types';

/**
 * Web-font capture: parse @font-face rules out of the site's stylesheets and
 * download the actual font files so kit specimens render in the brand's real
 * typeface (benchmark parity — Mutiny self-hosts Nuckle for the Hightouch kit).
 *
 * Best-effort by design: proprietary fonts behind hostile CDNs degrade to a
 * fontNote caveat, never a failed extraction. Files are self-hosted for kit
 * preview only, not redistribution.
 */

export interface FontFaceDecl {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  /** Absolute URL, or a data: URI for inline-embedded fonts. */
  srcUrl: string;
  format: string;
}

const FORMAT_BY_EXT: Record<string, string> = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' };
const FORMAT_RANK = ['woff2', 'woff', 'truetype', 'opentype'];

function pickSrc(srcValue: string): { url: string; format: string } | null {
  // src is a comma-separated candidate list: url(...) format("...") pairs.
  const candidates: Array<{ url: string; format: string }> = [];
  for (const m of srcValue.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)(?:\s*format\(\s*['"]?([^'")]+)['"]?\s*\))?/gi)) {
    const url = m[1]!.trim();
    let format = m[2]?.toLowerCase().replace(/-variations$/, '') ?? '';
    if (!format) {
      const ext = /\.(woff2|woff|ttf|otf)(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase();
      format = ext ? FORMAT_BY_EXT[ext]! : '';
    }
    if (format) candidates.push({ url, format });
  }
  candidates.sort((a, b) => FORMAT_RANK.indexOf(a.format) - FORMAT_RANK.indexOf(b.format));
  return candidates[0] ?? null;
}

/** Parse every @font-face block, resolving relative src URLs against the sheet's own URL. */
export function parseFontFaces(sheets: StyleSheetText[], pageUrl: string): FontFaceDecl[] {
  const decls: FontFaceDecl[] = [];
  const seen = new Set<string>();
  for (const sheet of sheets) {
    for (const m of sheet.text.matchAll(/@font-face\s*{([^}]+)}/g)) {
      const block = m[1]!;
      const family = /font-family:\s*['"]?([^;'"]+)/.exec(block)?.[1]?.trim();
      const srcValue = /src:\s*([^;]+)/.exec(block)?.[1];
      if (!family || !srcValue) continue;
      const src = pickSrc(srcValue);
      if (!src) continue;
      // Variable fonts declare a range ("100 900") — one file covers all weights.
      const weightRaw = /font-weight:\s*(\d+)(?:\s+\d+)?/.exec(block)?.[1] ?? '400';
      const style = /font-style:\s*italic/.test(block) ? 'italic' : 'normal';
      let srcUrl: string;
      if (src.url.startsWith('data:')) {
        srcUrl = src.url;
      } else {
        try {
          srcUrl = new URL(src.url, sheet.href ?? pageUrl).href;
        } catch {
          continue;
        }
      }
      const key = `${family}|${weightRaw}|${style}`;
      if (seen.has(key)) continue;
      seen.add(key);
      decls.push({ family, weight: parseInt(weightRaw, 10) || 400, style, srcUrl, format: src.format });
    }
  }
  return decls;
}

const EXT_BY_FORMAT: Record<string, string> = { woff2: 'woff2', woff: 'woff', truetype: 'ttf', opentype: 'otf' };
const MAX_FILES = 10;
const MAX_BYTES = 3_000_000;

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Download the wanted families' font files to public/brand-kits/<domain>/fonts/.
 * Returns the assets that landed plus a caveat note when a wanted family
 * yielded nothing (licensed typeface, hostile CDN, ...).
 */
export async function downloadFontFiles(
  decls: FontFaceDecl[],
  domain: string,
  wantedFamilies: string[]
): Promise<{ fontFaces: FontFaceAsset[]; fontNote?: string }> {
  const wanted = wantedFamilies.map((f) => f.toLowerCase()).filter(Boolean);
  const matches = decls.filter((d) => {
    const fam = d.family.toLowerCase();
    // Prefix-match tolerates "Nuckle Var" / "Inter Display" style naming.
    return wanted.some((w) => fam === w || fam.startsWith(w) || w.startsWith(fam));
  });

  const dir = path.join(process.cwd(), 'public', 'brand-kits', domain, 'fonts');
  const fontFaces: FontFaceAsset[] = [];
  for (const decl of matches.slice(0, MAX_FILES)) {
    const ext = EXT_BY_FORMAT[decl.format] ?? 'woff2';
    const filename = `${slug(decl.family)}-${decl.weight}${decl.style === 'italic' ? '-italic' : ''}.${ext}`;
    try {
      let bytes: Buffer;
      if (decl.srcUrl.startsWith('data:')) {
        const base64 = decl.srcUrl.split(',', 2)[1] ?? '';
        bytes = Buffer.from(base64, /;base64/.test(decl.srcUrl) ? 'base64' : 'utf8');
      } else {
        const res = await fetch(decl.srcUrl, {
          signal: AbortSignal.timeout(8_000),
          headers: {
            // Font CDNs commonly 403 non-browser requests without these.
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
            Referer: `https://${domain}/`,
          },
        });
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) continue;
        bytes = Buffer.from(buf);
      }
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), bytes);
      fontFaces.push({
        family: decl.family,
        weight: decl.weight,
        style: decl.style,
        file: `/brand-kits/${domain}/fonts/${filename}`,
        format: decl.format,
      });
    } catch {
      // best-effort per file
    }
  }

  const coveredFamilies = new Set(fontFaces.map((f) => f.family.toLowerCase()));
  const missing = wantedFamilies.filter(
    (f) => f && ![...coveredFamilies].some((c) => c === f.toLowerCase() || c.startsWith(f.toLowerCase()))
  );
  return {
    fontFaces,
    fontNote: missing.length
      ? `${missing.join(' and ')} could not be captured — likely a licensed typeface. Specimens may render in a fallback; confirm the licensed files against the official brand guidelines.`
      : undefined,
  };
}
