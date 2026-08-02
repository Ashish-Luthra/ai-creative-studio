import { useEffect, useState } from 'react';
import type { DeepKitData } from '../../lib/brand-kit-types';

/**
 * Data behind one Brand Kit summary board (design: brand-board_14Jul.html).
 * Produced by the brand-kit summary API; palette/typography come from website
 * extraction, logoUrl/snapshotUrl from stored assets (og:image) when available.
 */
export interface BrandKitBoardData {
  id: string;
  name: string;
  /** Bare domain shown in the browser address bar, e.g. "allyvate.ai". */
  domain: string;
  /** Stored/extracted logo image URL; falls back to a generic mark when absent. */
  logoUrl?: string | null;
  /** Homepage snapshot (mobile screenshot). When absent a stylized mockup is rendered. */
  snapshotUrl?: string | null;
  /** og:image fallback used when the screenshot fails to load. */
  ogImageUrl?: string | null;
  /** Logo width/height ratio when known; wide (≥2.2) logos are full wordmarks. */
  logoAspect?: number | null;
  /** Up to 6 swatches, primary first. */
  palette: string[];
  typography: {
    heading: { family: string; weight: number };
    body: { family: string; weight: number };
  };
  /** Call-to-action labels shown in the expanded summary; sensible defaults when absent. */
  ctas?: { primary: string; secondary: string; link: string };
  /** Deep, benchmark-grade kit data from the Playwright+Claude pipeline. */
  deep?: DeepKitData;
}

/** Primary brand color (first palette entry) with a safe default. */
export function primaryColor(kit: BrandKitBoardData): string {
  return kit.palette[0] ?? '#001B4A';
}

/**
 * Loads the kit's typefaces: self-hosted @font-face files captured at
 * extraction time take priority (proprietary fonts like Nuckle aren't on
 * Google Fonts); Google is the fallback for uncovered families and old kits.
 */
export function useBrandFonts(kit: BrandKitBoardData) {
  const { heading, body } = kit.typography;
  const fontFaces = kit.deep?.fontFaces;
  useEffect(() => {
    const selfHosted = fontFaces ?? [];
    if (selfHosted.length > 0) {
      const id = `brand-font-faces-${kit.domain.replace(/[^a-z0-9.-]/gi, '')}`;
      if (!document.getElementById(id)) {
        const style = document.createElement('style');
        style.id = id;
        style.textContent = selfHosted
          .map(
            (f) =>
              `@font-face { font-family: '${f.family.replace(/'/g, '')}'; src: url('${f.file}')${f.format ? ` format('${f.format}')` : ''}; font-weight: ${f.weight}; font-style: ${f.style ?? 'normal'}; font-display: swap; }`
          )
          .join('\n');
        document.head.appendChild(style);
      }
    }
    const covered = new Set(selfHosted.map((f) => f.family.toLowerCase()));
    const families = [...new Set([heading.family, body.family])].filter((f) => !covered.has(f.toLowerCase()));
    for (const family of families) {
      const id = `brand-font-${family.replace(/\s+/g, '-').toLowerCase()}`;
      if (document.getElementById(id)) continue;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700&display=swap`;
      document.head.appendChild(link);
    }
    // Deliberately never removed: fonts are page-wide resources shared across boards.
  }, [heading.family, body.family, fontFaces, kit.domain]);
}

/** Generic geometric cube mark used when a kit has no extracted logo yet. */
export function FallbackLogo({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M27 3 L48 15 V39 L27 51 L6 39 V15 Z" fill={color} />
      <path d="M27 14 L38.5 20.5 L27 27 L15.5 20.5 Z" fill="#ffffff" fillOpacity="0.95" />
      <path d="M27 27 L38.5 20.5 V33.5 L27 40 Z" fill="#ffffff" fillOpacity="0.55" />
      <path d="M27 27 L15.5 20.5 V33.5 L27 40 Z" fill="#ffffff" fillOpacity="0.30" />
    </svg>
  );
}

/** Soft layered wave separating the board header from the content grid. */
function Wave() {
  return (
    <div className="absolute left-0 w-full overflow-hidden flex items-center pointer-events-none" style={{ top: 96, height: 82 }} aria-hidden>
      <svg viewBox="0 0 1200 152.3" width="100%" preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id="bb-body-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#EFF4FC" />
            <stop offset="1" stopColor="#DEE8F6" />
          </linearGradient>
        </defs>
        <path
          d="M -25 54.8 C 40 40 90 38 180 57 C 300 82 380 122 520 98 C 640 77 700 52 800 64 C 900 76 1000 108 1100 88 C 1160 76 1200 62 1225 60.7 L 1225 87.8 C 1160 90 1100 104 1000 118 C 900 130 800 120 700 98 C 600 76 500 92 400 112 C 300 130 200 122 100 96 C 40 80 -10 92 -25 92.3 Z"
          fill="url(#bb-body-grad)"
          fillOpacity="0.9"
        />
        <path
          d="M -25 73.6 C 60 52 140 50 260 76 C 380 102 460 120 580 96 C 700 72 760 58 860 72 C 960 86 1060 108 1160 84 C 1190 77 1210 74.5 1225 74.3"
          fill="none"
          stroke="#B4C7E8"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/** Stylized homepage mockup rendered from brand tokens (used when no snapshot). */
function MockupPreview({ kit }: { kit: BrandKitBoardData }) {
  const primary = primaryColor(kit);
  const accent = kit.palette[1] ?? '#2563EB';
  const headingFont = `'${kit.typography.heading.family}', sans-serif`;
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* navbar */}
      <div className="flex items-center px-3 gap-2 flex-shrink-0" style={{ height: 28 }}>
        {kit.logoUrl ? (
          <img src={kit.logoUrl} alt="" className="w-[13px] h-[13px] object-contain" />
        ) : (
          <FallbackLogo color={primary} size={13} />
        )}
        <span className="font-semibold text-[8px] text-[#111827]" style={{ fontFamily: headingFont }}>{kit.name}</span>
        <div className="flex gap-2 ml-auto text-[6px] text-[#6B7280] items-center">
          <span>Home</span><span>Features</span><span>About</span><span>Pricing</span><span>Contact</span>
        </div>
        <span className="text-white text-[6px] font-semibold px-[7px] py-[4px] rounded-[5px] ml-1" style={{ background: primary }}>
          Get Started
        </span>
      </div>
      {/* hero */}
      <div className="flex px-3 pt-3 pb-2.5 gap-3 flex-1 min-h-0">
        <div className="w-1/2">
          <div className="font-bold text-[17px] leading-[1.12] text-[#111827] mb-[7px] tracking-[-0.4px]" style={{ fontFamily: headingFont }}>
            A modern workflow for…
          </div>
          <div className="text-[5.5px] leading-[1.7] text-[#9CA3AF] mb-[9px]">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </div>
          <div className="flex gap-1.5">
            <span className="text-white text-[6px] font-semibold px-[9px] py-[5px] rounded-[5px]" style={{ background: primary }}>Get Started</span>
            <span className="bg-white text-[#374151] text-[6px] font-semibold px-[9px] py-[5px] rounded-[5px] border border-[#E5E7EB]">Learn More</span>
          </div>
        </div>
        <div className="w-1/2">
          <div className="bg-[#F3F4F6] rounded-lg p-2 h-full flex flex-col">
            <div className="w-[13px] h-[13px] rounded flex items-center justify-center mb-1.5" style={{ background: primary }}>
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
            </div>
            <div className="flex-1 min-h-0 mb-1.5">
              <svg width="100%" height="100%" viewBox="0 0 200 70" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`bb-chart-${kit.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={accent} stopOpacity="0.24" />
                    <stop offset="1" stopColor={accent} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 55 C 26 53 40 43 64 41 C 92 38 104 31 128 27 C 156 22 176 14 200 10 L200 70 L0 70 Z" fill={`url(#bb-chart-${kit.id})`} />
                <path d="M0 55 C 26 53 40 43 64 41 C 92 38 104 31 128 27 C 156 22 176 14 200 10" fill="none" stroke={accent} strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
            <div className="flex items-end gap-[7px]">
              <div className="bg-white rounded-[5px] px-1.5 py-[5px] flex-1">
                <div className="text-[9px] font-bold text-[#111827] leading-none">12.5K</div>
                <div className="text-[5px] font-semibold text-[#10B981] mt-0.5">+12%</div>
              </div>
              <div className="bg-white rounded-[5px] px-1.5 py-[5px] flex-1">
                <div className="text-[9px] font-bold text-[#111827] leading-none">98%</div>
                <div className="text-[5px] font-semibold text-[#10B981] mt-0.5">+4%</div>
              </div>
              <div className="bg-white rounded-[5px] p-1 flex items-center justify-center">
                <svg width="26" height="26" viewBox="0 0 42 42">
                  <circle cx="21" cy="21" r="15" fill="none" stroke="#E5E7EB" strokeWidth="6" />
                  <circle cx="21" cy="21" r="15" fill="none" stroke={accent} strokeWidth="6" strokeDasharray="71 94" strokeDashoffset="23.5" strokeLinecap="round" transform="rotate(-90 21 21)" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* features */}
      <div className="grid grid-cols-3 gap-2 px-3 pb-3 pt-3 border-t border-[#F0F1F3]">
        {['Feature One', 'Feature Two', 'Feature Three'].map((title) => (
          <div key={title} className="text-center">
            <div className="w-[22px] h-[22px] rounded-full bg-[#F3F4F6] flex items-center justify-center mx-auto mb-1.5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
            </div>
            <div className="text-[6.5px] font-bold text-[#1F2937] mb-[3px]">{title}</div>
            <div className="text-[5px] leading-[1.6] text-[#9CA3AF]">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="font-bold text-[10px] tracking-[0.5px] uppercase text-[#6B7280] mb-[7px]">{children}</div>
  );
}

/**
 * One Brand Kit summary board: logo + name header over a wave, website preview
 * in a browser-chrome frame (snapshot when available, stylized brand mockup
 * otherwise), typography scale, and color palette. Faithful port of
 * brand-board_14Jul.html.
 */
export function BrandBoard({ kit }: { kit: BrandKitBoardData }) {
  useBrandFonts(kit);
  const primary = primaryColor(kit);
  const headingFont = `'${kit.typography.heading.family}', sans-serif`;
  const bodyFont = `'${kit.typography.body.family}', sans-serif`;
  const weightName = (w: number) =>
    ({ 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold' })[w] ?? String(w);

  // Wide logos are full wordmarks: show them at natural width without the
  // (redundant) name text. Aspect comes from the extractor when known, and is
  // refined from the loaded image's natural size otherwise.
  const [logoAspect, setLogoAspect] = useState(kit.logoAspect ?? null);
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => setLogoFailed(false), [kit.logoUrl]);
  const logoUrl = logoFailed ? null : kit.logoUrl;
  const isWordmark = (logoAspect ?? 0) >= 2.2;

  // Snapshot fallback chain: mobile screenshot -> og:image -> styled mockup.
  const [snapshotSrc, setSnapshotSrc] = useState(kit.snapshotUrl ?? kit.ogImageUrl ?? null);
  useEffect(() => {
    setSnapshotSrc(kit.snapshotUrl ?? kit.ogImageUrl ?? null);
  }, [kit.snapshotUrl, kit.ogImageUrl]);

  return (
    // Half-size display: the board artwork is laid out on a fixed 550×620
    // canvas, then scaled to 275×310 so all internals shrink proportionally.
    // The site URL is captioned in grey below the scaled board.
    <div className="flex-shrink-0" style={{ width: 275 }} data-testid={`brand-board-${kit.id}`}>
    <div style={{ width: 275, height: 310 }}>
    <div
      className="relative overflow-hidden rounded-[24px] border border-[#D9D9D9] bg-[#F8F8F8]"
      style={{ width: 550, height: 620, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', transform: 'scale(0.5)', transformOrigin: 'top left' }}
    >
      {/* header */}
      <div className="pt-10 flex items-center justify-center gap-3.5" style={{ height: 94 }}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${kit.name} logo`}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth > 0 && img.naturalHeight > 0) setLogoAspect(img.naturalWidth / img.naturalHeight);
            }}
            onError={() => setLogoFailed(true)}
            className="object-contain"
            style={isWordmark ? { height: 46, maxWidth: 300 } : { width: 54, height: 54 }}
          />
        ) : (
          <FallbackLogo color={primary} size={54} />
        )}
        {(!logoUrl || !isWordmark) && (
          <div className="font-bold text-[30px] leading-none tracking-[-0.5px]" style={{ fontFamily: headingFont, color: primary }}>
            {kit.name}
          </div>
        )}
      </div>

      <Wave />

      {/* content grid */}
      <div className="px-6 grid gap-x-6" style={{ marginTop: 104, gridTemplateColumns: '58fr 42fr' }}>
        {/* left: website preview */}
        <div>
          <SectionLabel>Website Preview</SectionLabel>
          <div className="bg-white border border-[#E5E7EB] rounded-[10px] overflow-hidden flex flex-col" style={{ height: 380 }}>
            <div className="flex items-center px-[9px] gap-1.5 border-b border-[#F0F1F3] flex-shrink-0" style={{ height: 26 }}>
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: '#FF5F57' }} />
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: '#FEBC2E' }} />
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: '#28C840' }} />
              <div className="flex-1 h-[13px] bg-[#F3F4F6] rounded-[7px] flex items-center justify-center text-[6px] text-[#9CA3AF] ml-1 mr-[22px]">
                {kit.domain}
              </div>
            </div>
            {snapshotSrc ? (
              <img
                src={snapshotSrc}
                alt={`${kit.name} homepage`}
                onError={() =>
                  setSnapshotSrc(snapshotSrc === kit.snapshotUrl && kit.ogImageUrl ? kit.ogImageUrl : null)
                }
                className="w-full flex-1 min-h-0 object-cover object-top"
              />
            ) : (
              <MockupPreview kit={kit} />
            )}
          </div>
        </div>

        {/* right: typography + palette */}
        <div>
          <SectionLabel>Typography</SectionLabel>
          <div className="h-px bg-[#E5E7EB] mb-[9px]" />

          <div className="mb-1.5">
            <div className="font-bold text-[48px] leading-[1.2] text-[#111827]" style={{ fontFamily: headingFont, fontWeight: kit.typography.heading.weight }}>H1</div>
            <div className="text-[8px] text-[#9CA3AF] leading-[1.5] mt-0.5" style={{ fontFamily: bodyFont }}>
              Font: {kit.typography.heading.family} {weightName(kit.typography.heading.weight)} / 48px / Line Height: 1.2
            </div>
          </div>
          <div className="mb-1.5">
            <div className="text-[28px] leading-[1.3] text-[#111827]" style={{ fontFamily: headingFont, fontWeight: 600 }}>H2</div>
            <div className="text-[8px] text-[#9CA3AF] leading-[1.5] mt-0.5" style={{ fontFamily: bodyFont }}>
              Font: {kit.typography.heading.family} SemiBold / 28px / Line Height: 1.3
            </div>
          </div>
          <div className="mb-1.5">
            <div className="text-[16px] leading-[1.6] text-[#111827]" style={{ fontFamily: bodyFont, fontWeight: kit.typography.body.weight }}>Body</div>
            <div className="text-[8px] text-[#9CA3AF] leading-[1.5] mt-0.5" style={{ fontFamily: bodyFont }}>
              Font: {kit.typography.body.family} {weightName(kit.typography.body.weight)} / 16px / Line Height: 1.6
            </div>
          </div>

          <SectionLabel>Color Palette</SectionLabel>
          <div className="h-px bg-[#E5E7EB] mb-[9px]" />
          <div className="grid grid-cols-3 gap-2">
            {kit.palette.slice(0, 6).map((hex) => (
              <div key={hex}>
                <div className="w-full rounded-lg border border-black/5" style={{ aspectRatio: '1 / 1', background: hex }} />
                <div className="text-[7px] text-[#9CA3AF] mt-1 tracking-[0.2px] uppercase" style={{ fontFamily: bodyFont }}>{hex}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </div>
    </div>
  );
}
