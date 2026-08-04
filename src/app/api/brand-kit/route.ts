import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { renderSite } from '../../../lib/extraction/render';
import { buildDraft } from '../../../lib/extraction/postprocess';
import { runClaudePass } from '../../../lib/extraction/claude-pass';
import { parseFontFaces, downloadFontFiles } from '../../../lib/extraction/fonts';
import type { FontFaceAsset } from '../../../lib/brand-kit-types';
import { saveKit, loadKit, listKits, deleteKit } from '../../../lib/brand-kit-store';
import type { BrandKitBoardData } from '../../../components/BrandCenter/BrandBoard';

/**
 * Deep brand-kit pipeline (benchmark: Mutiny's hightouch brand kit).
 *
 * POST {domain}  → Playwright render (light+dark) → deterministic draft
 *                  (colors/gradients/type scale/CTAs/logo variants) → Claude
 *                  labeling + voice pass → persisted BrandKitBoardData+deep.
 *                  Falls back to the quick regex extractor when the render
 *                  fails, so Add Brand Kit never hard-fails.
 * GET ?domain=d  → one saved kit          GET → { items: [...] } (all saved)
 * PUT  {kit}     → persist an edited kit
 */

export const maxDuration = 120;

function cleanDomain(raw: string): string | null {
  const domain = raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return domain && domain.includes('.') && /^[a-z0-9.-]+$/.test(domain) ? domain : null;
}

async function saveScreenshots(domain: string, mobile: Buffer, desktop: Buffer): Promise<{ mobile: string; desktop: string }> {
  const dir = path.join(process.cwd(), 'public', 'brand-kits', domain);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'mobile.jpg'), mobile);
  await fs.writeFile(path.join(dir, 'desktop.jpg'), desktop);
  return {
    mobile: `/api/brand-kit/asset/${domain}/mobile.jpg`,
    desktop: `/api/brand-kit/asset/${domain}/desktop.jpg`,
  };
}

/**
 * Persist a remote logo locally. Hotlinked logo URLs rot (403 hotlink guards,
 * CDN auth, redesigns) — the kit must own its assets. data: URIs pass through;
 * on fetch failure the original URL is kept and the UI falls back gracefully.
 */
async function localizeLogo(src: string | null | undefined, domain: string, variant: 'light' | 'dark'): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith('data:') || src.startsWith('/')) return src;
  try {
    const res = await fetch(src, {
      signal: AbortSignal.timeout(8_000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Referer: `https://${domain}/`,
      },
    });
    if (!res.ok) return src;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 2_000_000) return src;
    const ct = res.headers.get('content-type') ?? '';
    const ext = ct.includes('svg')
      ? 'svg'
      : ct.includes('png')
        ? 'png'
        : ct.includes('webp')
          ? 'webp'
          : /jpe?g/.test(ct)
            ? 'jpg'
            : (/\.(svg|png|webp|jpe?g|gif)(?:[?#]|$)/i.exec(src)?.[1]?.replace(/jpeg/i, 'jpg')?.toLowerCase() ?? 'png');
    const dir = path.join(process.cwd(), 'public', 'brand-kits', domain);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `logo-${variant}.${ext}`), buf);
    return `/api/brand-kit/asset/${domain}/logo-${variant}.${ext}`;
  } catch {
    return src;
  }
}

function logoAspectOf(logoUrl: string | null): number | null {
  if (!logoUrl?.startsWith('data:image/svg+xml')) return null;
  const vb = /viewBox=["']([\d.\s-]+)["']/.exec(decodeURIComponent(logoUrl));
  const p = vb?.[1]?.trim().split(/\s+/).map(Number);
  return p?.length === 4 && p[3]! > 0 ? p[2]! / p[3]! : null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { domain?: string };
  const domain = cleanDomain(body.domain ?? '');
  if (!domain) return NextResponse.json({ error: 'Provide { domain: "yourbrand.com" }' }, { status: 400 });

  try {
    const render = await renderSite(domain);
    const draft = await buildDraft(render);
    const shots = await saveScreenshots(domain, render.mobileShot, render.desktopShot);

    const name =
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i.exec(render.html)?.[1]?.trim() ??
      render.title.split(/[|\-–—·:\\/]/).map((s) => s.trim()).filter((s) => s && !/^(home|homepage|welcome)$/i.test(s))[0] ??
      domain.split('.')[0]!;

    // Self-hosted web fonts (best-effort): capture the real files so kit
    // specimens render in the brand's typeface, not a Google-Fonts fallback.
    let fontFaces: FontFaceAsset[] = [];
    let fontNote: string | undefined;
    try {
      const decls = parseFontFaces(render.styleSheets, render.finalUrl);
      const wanted = [...new Set([draft.headingFamily, draft.bodyFamily])];
      ({ fontFaces, fontNote } = await downloadFontFiles(decls, domain, wanted));
    } catch (err) {
      console.warn(`Font capture failed for ${domain}:`, err);
    }

    const labeled = await runClaudePass(name, domain, draft, render.copy);

    // Own the logo assets: remote URLs are downloaded next to the screenshots.
    const logos = {
      light: await localizeLogo(draft.logos.light, domain, 'light'),
      dark: await localizeLogo(draft.logos.dark, domain, 'dark'),
    };

    const kit: BrandKitBoardData & { domain: string } = {
      id: `bk_${domain}`,
      name,
      domain,
      logoUrl: logos.light ?? logos.dark ?? null,
      logoAspect: logoAspectOf(draft.logos.light ?? draft.logos.dark ?? null),
      snapshotUrl: shots.mobile,
      ogImageUrl: null,
      // Board palette: canvas/ink first then accents (matches prior 6-swatch shape).
      palette: [
        ...labeled.colors.filter((c) => c.role === 'ink').map((c) => c.hex),
        ...labeled.colors.filter((c) => c.role === 'accent').map((c) => c.hex),
        ...labeled.colors.filter((c) => c.role === 'canvas' || c.role === 'neutral').map((c) => c.hex),
      ].slice(0, 6),
      typography: {
        heading: { family: draft.headingFamily, weight: draft.typeScale.find((r) => r.label === 'H1')?.weight ?? 700 },
        body: { family: draft.bodyFamily, weight: 400 },
      },
      deep: {
        logos: { ...logos, usageRules: labeled.logoUsageRules },
        colorSystem: labeled.colors,
        colorGroups: labeled.colorGroups,
        gradients: labeled.gradients,
        typeScale: draft.typeScale,
        typographyRules: labeled.typographyRules,
        ctaSpecs: draft.ctaSpecs,
        voice: labeled.voice,
        snapshots: shots,
        generatedAt: new Date().toISOString(),
        brandSummary: labeled.brandSummary,
        sections: labeled.sections,
        voiceExtra: labeled.voiceExtra,
        fontFaces: fontFaces.length ? fontFaces : undefined,
        // Only the families the kit actually uses — @font-face blocks also
        // declare icon fonts and unused stacks.
        fontWeights: (() => {
          const relevant = [draft.headingFamily, draft.bodyFamily, ...fontFaces.map((f) => f.family)].map((f) => f.toLowerCase());
          const trimmed = Object.fromEntries(
            Object.entries(draft.fontWeights).filter(([family]) => {
              const f = family.toLowerCase();
              return relevant.some((r) => f === r || f.startsWith(r) || r.startsWith(f));
            })
          );
          return Object.keys(trimmed).length ? trimmed : undefined;
        })(),
        fontNote,
      },
    };

    await saveKit(kit);
    return NextResponse.json(kit);
  } catch (err) {
    console.warn(`Deep extraction failed for ${domain}; falling back to quick extractor:`, err);
    try {
      const quick = await fetch(new URL(`/api/brand-extract?domain=${encodeURIComponent(domain)}`, request.url));
      if (!quick.ok) throw new Error(`quick extractor HTTP ${quick.status}`);
      const kit = (await quick.json()) as BrandKitBoardData & { domain: string };
      await saveKit(kit);
      return NextResponse.json(kit);
    } catch {
      return NextResponse.json(
        { error: `Could not extract ${domain}. The site may be blocking automated access.` },
        { status: 502 }
      );
    }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domainParam = searchParams.get('domain');
  if (domainParam) {
    const domain = cleanDomain(domainParam);
    if (!domain) return NextResponse.json({ error: 'Bad domain' }, { status: 400 });
    const kit = await loadKit(domain);
    return kit ? NextResponse.json(kit) : NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ items: await listKits() });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = cleanDomain(searchParams.get('domain') ?? '');
  if (!domain) return NextResponse.json({ error: 'Bad domain' }, { status: 400 });
  const existed = await deleteKit(domain);
  return existed
    ? NextResponse.json({ deleted: true })
    : NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function PUT(request: Request) {
  const kit = (await request.json().catch(() => null)) as (BrandKitBoardData & { domain?: string }) | null;
  if (!kit?.domain || !cleanDomain(kit.domain)) {
    return NextResponse.json({ error: 'Kit with a valid domain required' }, { status: 400 });
  }
  await saveKit(kit as BrandKitBoardData & { domain: string });
  return NextResponse.json({ saved: true });
}
