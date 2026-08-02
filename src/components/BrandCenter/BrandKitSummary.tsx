import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Pencil, Plus, MoreVertical, X } from 'lucide-react';
import {
  FallbackLogo,
  primaryColor,
  useBrandFonts,
  type BrandKitBoardData,
} from './BrandBoard';
import type { BrandVoice, CtaSpec, DeepColor, SectionCopy, SectionKey, TypeScaleRow } from '../../lib/brand-kit-types';

/**
 * Expanded, human-editable Brand Kit summary.
 *
 * Two depths: kits produced by the deep pipeline (kit.deep) render the five
 * benchmark sections — 01 Logo variants + rules, 02 Color system (roles +
 * gradients + usage), 03 Typography scale + rules, 04 Buttons from measured
 * specs, 05 Voice & Tone — while shallow/mock kits keep the original simple
 * sections. Edits are pushed up via onChange (persisted by the caller).
 */

const DEFAULT_CTAS = { primary: 'Primary CTA', secondary: 'Secondary CTA', link: 'Link' };
/** Weights the Google-Fonts fallback stylesheet requests (shallow/legacy kits). */
const GOOGLE_FALLBACK_WEIGHTS = [400, 500, 600, 700];

function Section({
  title,
  eyebrow,
  intro,
  editing,
  onEdit,
  onSave,
  onCancel,
  children,
}: {
  title: string;
  /** Benchmark-style section eyebrow, e.g. "01 / LOGO". */
  eyebrow?: string;
  /** Editorial 1-2 sentence intro under the title. */
  intro?: string;
  editing?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="bg-white border border-[#e5e7eb] rounded-xl p-6 mb-4">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[10px] font-bold tracking-[1.2px] uppercase text-[#9CA3AF] mb-1">{eyebrow}</div>
          )}
          <h3 className="text-[16px] font-bold text-[#0d1117]">{title}</h3>
          {intro && <p className="text-[12.5px] text-[#6b7280] leading-relaxed mt-1 max-w-[600px]">{intro}</p>}
        </div>
        {onEdit && (editing ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCancel} className="h-7 px-2.5 rounded-md text-[12px] font-medium text-[#374151] border border-[#e5e7eb] hover:bg-[#f9fafb]">
              Cancel
            </button>
            <button type="button" onClick={onSave} className="h-7 px-2.5 rounded-md text-[12px] font-medium text-white bg-[#111827] hover:opacity-90">
              Save
            </button>
          </div>
        ) : (
          <button type="button" onClick={onEdit} className="h-7 px-2.5 rounded-md text-[12px] font-medium text-[#374151] border border-[#e5e7eb] hover:bg-[#f9fafb] flex items-center gap-1.5">
            <Pencil size={11} /> Edit
          </button>
        ))}
      </div>
      {children}
    </section>
  );
}

/** Allyvate icon set: trash-alt-solid (Line Awesome), inlined for currentColor. */
export function TrashIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.25,3 C10.8574222,3 10.4560545,3.13769549 10.171875,3.421875 C9.88769549,3.70605451 9.75,4.10742223 9.75,4.5 L9.75,5.25 L5.25,5.25 L5.25,6.75 L6,6.75 L6,18.75 C6,19.9833983 7.01660174,21 8.25,21 L17.25,21 C18.4833983,21 19.5,19.9833983 19.5,18.75 L19.5,6.75 L20.25,6.75 L20.25,5.25 L15.75,5.25 L15.75,4.5 C15.75,4.10742223 15.6123045,3.70605451 15.328125,3.421875 C15.0439455,3.13769549 14.6425785,3 14.25,3 L11.25,3 Z M11.25,4.5 L14.25,4.5 L14.25,5.25 L11.25,5.25 L11.25,4.5 Z M7.5,6.75 L18,6.75 L18,18.75 C18,19.166016 17.666016,19.5 17.25,19.5 L8.25,19.5 C7.83398473,19.5 7.5,19.166016 7.5,18.75 L7.5,6.75 Z M9,9 L9,17.25 L10.5,17.25 L10.5,9 L9,9 Z M12,9 L12,17.25 L13.5,17.25 L13.5,9 L12,9 Z M15,9 L15,17.25 L16.5,17.25 L16.5,9 L15,9 Z" />
    </svg>
  );
}

/** Logo <img> that swaps to a fallback instead of the browser's broken-image glyph. */
function KitLogoImg({ src, alt, fallback }: { src: string; alt: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed) return <>{fallback}</>;
  return <img src={src} alt={alt} onError={() => setFailed(true)} className="max-h-[52px] max-w-[200px] object-contain" />;
}

function RuleList({ rules }: { rules: string[] }) {
  if (!rules.length) return null;
  return (
    <ul className="mt-4 space-y-1">
      {rules.map((r) => (
        <li key={r} className="text-[12px] text-[#6b7280] flex gap-2">
          <span className="text-[#9CA3AF]">—</span>
          {r}
        </li>
      ))}
    </ul>
  );
}

function isLightHex(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 230;
}

function FontCard({ family, weights, selfHosted }: { family: string; weights?: number[]; selfHosted?: boolean }) {
  const shown = weights?.length ? weights : null;
  return (
    <div className="border border-[#e5e7eb] rounded-lg p-4 w-[210px]">
      <div className="flex items-start justify-between">
        <div className="text-[14px] font-bold text-[#0d1117]">{family}</div>
        <MoreVertical size={13} className="text-[#9CA3AF] mt-0.5" />
      </div>
      <div className="text-[11px] text-[#6b7280] mt-1.5">
        {shown
          ? `${shown.length} ${shown.length === 1 ? 'weight' : 'weights'} · ${shown.join(' / ')}`
          : `${GOOGLE_FALLBACK_WEIGHTS.length} weights (fallback)`}
        {selfHosted && <span className="text-[#15803D]"> · self-hosted</span>}
      </div>
      <div className="mt-3 space-y-1">
        {(shown ?? [400, 700]).slice(0, 4).map((w) => (
          <div key={w} className="flex items-baseline gap-2">
            <span className="text-[15px] text-[#0d1117]" style={{ fontFamily: `'${family}', sans-serif`, fontWeight: w }}>
              AaBbCcDd
            </span>
            <span className="text-[10px] text-[#9CA3AF]">{w}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ROLE_LABEL: Record<DeepColor['role'], string> = {
  canvas: 'Canvas',
  ink: 'Ink',
  accent: 'Accent',
  neutral: 'Neutral',
};

function DeepSwatch({ color }: { color: DeepColor }) {
  return (
    <div className="w-[128px]">
      <div
        className="w-full h-16 rounded-lg"
        style={{ background: color.hex, border: isLightHex(color.hex) ? '1px solid #e5e7eb' : '1px solid rgba(0,0,0,0.04)' }}
      />
      <div className="text-[12px] font-semibold text-[#0d1117] mt-1.5">{color.name ?? ROLE_LABEL[color.role]}</div>
      <div className="text-[10px] text-[#9CA3AF] uppercase tracking-[0.3px]">{color.hex} · {ROLE_LABEL[color.role]}</div>
      {color.usage && <div className="text-[11px] text-[#6b7280] mt-1 leading-snug">{color.usage}</div>}
    </div>
  );
}

function TypeScaleTable({ rows }: { rows: TypeScaleRow[] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="border-b border-[#f1f2f4] pb-2.5">
          <div className="flex items-baseline justify-between gap-4 mb-1">
            <div className="text-[10px] font-bold tracking-[0.8px] uppercase text-[#9CA3AF]">
              {row.label} / {row.px}px
            </div>
            <div className="text-[11px] text-[#9CA3AF] whitespace-nowrap text-right">
              {row.family} · {row.px}px · {row.weight}
              {row.textTransform ? ` · ${row.textTransform}` : ''}
            </div>
          </div>
          <div
            className="text-[#0d1117] leading-tight truncate"
            style={{
              fontFamily: `'${row.family}', sans-serif`,
              fontSize: Math.min(row.px, 44),
              fontWeight: row.weight,
              textTransform: (row.textTransform as 'uppercase' | 'lowercase' | 'capitalize' | 'none' | undefined) ?? 'none',
            }}
          >
            {row.exampleText || row.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Gradient card with parsed stop chips (benchmark: stops spelled out with usage). */
function GradientCard({ css, stops, name, usage }: { css: string; stops?: string[]; name?: string; usage?: string }) {
  return (
    <div className="w-[260px]">
      <div className="w-full h-14 rounded-lg border border-black/5" style={{ background: css }} />
      {name && <div className="text-[12px] font-semibold text-[#0d1117] mt-1.5">{name}</div>}
      {(stops?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {stops!.map((hex, i) => (
            <span key={`${hex}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-[#e5e7eb] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.3px] text-[#6b7280]">
              <span className="w-2 h-2 rounded-full border border-black/10" style={{ background: hex }} />
              {hex}
            </span>
          ))}
        </div>
      )}
      {usage && <div className="text-[11px] text-[#6b7280] leading-snug mt-1">{usage}</div>}
    </div>
  );
}

function SpecButton({ spec }: { spec: CtaSpec }) {
  if (spec.kind === 'link') {
    return (
      <span className="text-[13px] font-medium cursor-pointer hover:underline" style={{ color: spec.color }}>
        {spec.label || 'Learn more'}
      </span>
    );
  }
  return (
    <button
      type="button"
      className="px-5 h-10 text-[13px] font-semibold"
      style={{
        background: spec.background,
        color: spec.color,
        borderRadius: spec.borderRadius,
        border: spec.border === 'none' ? undefined : spec.border,
      }}
    >
      {spec.label || (spec.kind === 'primary' ? 'Primary CTA' : 'Secondary CTA')}
    </button>
  );
}

/** Multi-line text ⇄ list helpers for voice editing. */
const toLines = (xs: string[]) => xs.join('\n');
const fromLines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);

export function BrandKitSummary({
  kit,
  onBack,
  onChange,
  onDelete,
}: {
  kit: BrandKitBoardData;
  onBack: () => void;
  onChange: (next: BrandKitBoardData) => void;
  /** Deletes the kit (store + local state); the caller navigates back. */
  onDelete?: (kit: BrandKitBoardData) => void;
}) {
  useBrandFonts(kit);
  const primary = primaryColor(kit);
  const headingFont = `'${kit.typography.heading.family}', sans-serif`;
  const ctas = kit.ctas ?? DEFAULT_CTAS;
  const deep = kit.deep;

  const [editing, setEditing] = useState<null | 'logo' | 'colors' | 'fonts' | 'typography' | 'ctas' | 'voice'>(null);
  const [draftName, setDraftName] = useState(kit.name);
  const [draftLogoUrl, setDraftLogoUrl] = useState(kit.logoUrl ?? '');
  const [draftPalette, setDraftPalette] = useState<string[]>(kit.palette);
  const [draftHeadingFamily, setDraftHeadingFamily] = useState(kit.typography.heading.family);
  const [draftBodyFamily, setDraftBodyFamily] = useState(kit.typography.body.family);
  const [sampleText, setSampleText] = useState('example');
  const [draftSampleText, setDraftSampleText] = useState('example');
  const [draftCtas, setDraftCtas] = useState(ctas);
  const emptyVoice: BrandVoice = { summary: '', pillars: [], descriptors: [], phrasesToUse: [], wordsToAvoid: [] };
  const [draftVoice, setDraftVoice] = useState({ summary: '', pillars: '', descriptors: '', use: '', avoid: '' });
  // Editorial title/intro(/caption) for the section currently being edited.
  const [draftSection, setDraftSection] = useState({ title: '', intro: '', caption: '' });
  // Two-step inline confirm for the destructive delete action.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /** UI edit key → persisted deep.sections key. */
  const SECTION_OF: Partial<Record<NonNullable<typeof editing>, SectionKey>> = {
    logo: 'logo',
    colors: 'color',
    typography: 'typography',
    ctas: 'buttons',
    voice: 'voice',
  };

  const start = (section: NonNullable<typeof editing>) => {
    setDraftName(kit.name);
    setDraftLogoUrl(kit.logoUrl ?? '');
    setDraftPalette(kit.palette);
    setDraftHeadingFamily(kit.typography.heading.family);
    setDraftBodyFamily(kit.typography.body.family);
    setDraftSampleText(sampleText);
    setDraftCtas(kit.ctas ?? DEFAULT_CTAS);
    const v = deep?.voice ?? emptyVoice;
    setDraftVoice({
      summary: v.summary ?? '',
      pillars: toLines(v.pillars),
      descriptors: toLines(v.descriptors),
      use: toLines(v.phrasesToUse),
      avoid: toLines(v.wordsToAvoid),
    });
    const key = SECTION_OF[section];
    const copy = key ? deep?.sections?.[key] : undefined;
    setDraftSection({ title: copy?.title ?? '', intro: copy?.intro ?? '', caption: copy?.caption ?? '' });
    setEditing(section);
  };
  const cancel = () => setEditing(null);
  const save = () => {
    let next: BrandKitBoardData = { ...kit };
    let dirty = false;
    if (editing === 'logo') {
      next = { ...next, name: draftName.trim() || kit.name, logoUrl: draftLogoUrl.trim() || null };
      dirty = true;
    }
    if (editing === 'colors' && !deep?.colorSystem?.length) {
      next = { ...next, palette: draftPalette.filter((h) => h.trim()) };
      dirty = true;
    }
    if (editing === 'fonts') {
      next = {
        ...next,
        typography: {
          heading: { ...kit.typography.heading, family: draftHeadingFamily.trim() || kit.typography.heading.family },
          body: { ...kit.typography.body, family: draftBodyFamily.trim() || kit.typography.body.family },
        },
      };
      dirty = true;
    }
    if (editing === 'typography' && !deep?.typeScale?.length) setSampleText(draftSampleText.trim() || 'example');
    if (editing === 'ctas' && !deep?.ctaSpecs?.length) {
      next = { ...next, ctas: draftCtas };
      dirty = true;
    }
    if (editing === 'voice') {
      next = {
        ...next,
        deep: {
          ...next.deep,
          voice: {
            summary: draftVoice.summary.trim(),
            pillars: fromLines(draftVoice.pillars),
            descriptors: fromLines(draftVoice.descriptors),
            phrasesToUse: fromLines(draftVoice.use),
            wordsToAvoid: fromLines(draftVoice.avoid),
          },
        },
      };
      dirty = true;
    }
    // Editorial section copy round-trips via deep.sections for any deep kit.
    const key = editing ? SECTION_OF[editing] : undefined;
    if (deep && key) {
      const trimmed = { title: draftSection.title.trim(), intro: draftSection.intro.trim(), caption: draftSection.caption.trim() };
      const copy: SectionCopy | undefined =
        trimmed.title || trimmed.intro || trimmed.caption
          ? { title: trimmed.title, intro: trimmed.intro || undefined, caption: trimmed.caption || undefined }
          : undefined;
      next = { ...next, deep: { ...next.deep, sections: { ...next.deep?.sections, [key]: copy } } };
      dirty = true;
    }
    if (dirty) onChange(next);
    setEditing(null);
  };

  const inputClass =
    'h-9 rounded-lg border border-[#d1d5db] px-3 text-[13px] outline-none focus:border-[#2563EB] bg-white';
  const textareaClass =
    'rounded-lg border border-[#d1d5db] px-3 py-2 text-[13px] outline-none focus:border-[#2563EB] bg-white w-full';

  const scaleRows = deep?.typeScale?.length ? deep.typeScale : null;
  const specCtas = deep?.ctaSpecs?.length ? deep.ctaSpecs : null;
  const colorSystem = deep?.colorSystem?.length ? deep.colorSystem : null;
  const anchors = colorSystem?.filter((c) => c.role === 'canvas' || c.role === 'ink') ?? [];
  const accents = colorSystem?.filter((c) => c.role === 'accent') ?? [];
  const neutrals = colorSystem?.filter((c) => c.role === 'neutral') ?? [];
  // Brand-adaptive groups (LLM-curated); legacy role grouping when absent.
  const colorByHex = new Map((colorSystem ?? []).map((c) => [c.hex.toLowerCase(), c]));
  const colorGroups = deep?.colorGroups?.length ? deep.colorGroups : null;

  /** Editorial copy with per-section defaults preserving the pre-editorial titles. */
  const sectionCopy = (key: SectionKey, defaultTitle: string): { title: string; intro?: string; caption?: string } => {
    const s = deep?.sections?.[key];
    return { title: s?.title?.trim() || defaultTitle, intro: s?.intro, caption: s?.caption };
  };

  const familyMatches = (a: string, b: string) => {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x === y || x.startsWith(y) || y.startsWith(x);
  };
  const weightsFor = (family: string): number[] | undefined => {
    const fw = deep?.fontWeights;
    if (!fw) return undefined;
    const key = Object.keys(fw).find((k) => familyMatches(k, family));
    return key ? fw[key] : undefined;
  };
  const isSelfHosted = (family: string): boolean =>
    !!deep?.fontFaces?.some((f) => familyMatches(f.family, family));

  const inkHex = colorSystem?.find((c) => c.role === 'ink')?.hex ?? '#111827';
  const canvasHex = colorSystem?.find((c) => c.role === 'canvas')?.hex ?? '#ffffff';

  const sectionCopyEditor = (withCaption = false) => (
    <div className="flex flex-col gap-2 max-w-[480px] mb-4">
      <label className="text-[11px] font-medium text-[#6b7280]">Section title</label>
      <input className={inputClass} value={draftSection.title} onChange={(e) => setDraftSection((s) => ({ ...s, title: e.target.value }))} placeholder="Editorial section title" />
      <label className="text-[11px] font-medium text-[#6b7280]">Section intro</label>
      <textarea className={textareaClass} rows={2} value={draftSection.intro} onChange={(e) => setDraftSection((s) => ({ ...s, intro: e.target.value }))} placeholder="1-2 sentence intro" />
      {withCaption && (
        <>
          <label className="text-[11px] font-medium text-[#6b7280]">Caption</label>
          <input className={inputClass} value={draftSection.caption} onChange={(e) => setDraftSection((s) => ({ ...s, caption: e.target.value }))} placeholder="Usage caption shown under the buttons" />
        </>
      )}
    </div>
  );

  return (
    <div className="flex-1 overflow-auto bg-[#F7F7F8]">
      <div className="max-w-[900px] px-6 py-5">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-[13px] font-medium text-[#374151] hover:text-[#111827] mb-4">
          <ArrowLeft size={15} /> All brand kits
        </button>

        {/* Kit header: brand-personality paragraph (benchmark hero) */}
        {deep && (
          <div className="mb-6">
            <div className="text-[10px] font-bold tracking-[1.4px] uppercase text-[#9CA3AF] mb-1.5">Brand guidelines</div>
            <h2 className="text-[26px] font-bold text-[#0d1117] tracking-[-0.4px]" style={{ fontFamily: headingFont }}>
              The {kit.name} brand kit
            </h2>
            {deep.brandSummary && (
              <p className="text-[13.5px] text-[#4b5563] leading-relaxed mt-2 max-w-[640px]">{deep.brandSummary}</p>
            )}
          </div>
        )}

        {/* 01 / Logo */}
        <Section
          eyebrow={deep ? '01 / Logo' : undefined}
          title={deep ? sectionCopy('logo', 'The wordmark').title : 'Logo'}
          intro={deep ? sectionCopy('logo', '').intro : undefined}
          editing={editing === 'logo'}
          onEdit={() => start('logo')}
          onSave={save}
          onCancel={cancel}
        >
          {editing === 'logo' && deep && sectionCopyEditor()}
          {deep?.logos ? (
            <>
              <div className="flex flex-wrap gap-4">
                <div className="w-[240px] h-[110px] rounded-lg border border-[#e5e7eb] bg-[#faf9f6] flex items-center justify-center p-5">
                  {deep.logos.light ? (
                    <KitLogoImg
                      src={deep.logos.light}
                      alt={`${kit.name} logo for light backgrounds`}
                      fallback={<FallbackLogo color={primary} size={44} />}
                    />
                  ) : (
                    <FallbackLogo color={primary} size={44} />
                  )}
                </div>
                <div className="w-[240px] h-[110px] rounded-lg flex items-center justify-center p-5" style={{ background: '#101014' }}>
                  {deep.logos.dark ? (
                    <KitLogoImg
                      src={deep.logos.dark}
                      alt={`${kit.name} logo for dark backgrounds`}
                      fallback={<span className="text-[11px] text-[#6b7280]">No dark variant captured</span>}
                    />
                  ) : (
                    <span className="text-[11px] text-[#6b7280]">No dark variant captured</span>
                  )}
                </div>
              </div>
              <RuleList rules={deep.logos.usageRules ?? []} />
            </>
          ) : (
            <div className="border border-[#e5e7eb] rounded-lg px-6 py-5 inline-flex items-center gap-3 bg-white">
              {kit.logoUrl ? (
                <img
                  src={kit.logoUrl}
                  alt={`${kit.name} logo`}
                  className="object-contain"
                  style={(kit.logoAspect ?? 0) >= 2.2 ? { height: 40, maxWidth: 260 } : { width: 42, height: 42 }}
                />
              ) : (
                <FallbackLogo color={primary} size={42} />
              )}
              {(kit.logoAspect ?? 0) < 2.2 && (
                <span className="font-bold text-[26px] tracking-[-0.4px]" style={{ fontFamily: headingFont, color: primary }}>
                  {kit.name}
                </span>
              )}
            </div>
          )}
          {editing === 'logo' && (
            <div className="flex flex-col gap-2 max-w-[340px] mt-4">
              <input className={inputClass} value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Brand name" />
              <input className={inputClass} value={draftLogoUrl} onChange={(e) => setDraftLogoUrl(e.target.value)} placeholder="Logo image URL" />
            </div>
          )}
        </Section>

        {/* 02 / Color */}
        <Section
          eyebrow={deep ? '02 / Color' : undefined}
          title={deep ? sectionCopy('color', 'Core palette').title : 'Colors'}
          intro={deep ? sectionCopy('color', '').intro : undefined}
          editing={editing === 'colors'}
          onEdit={() => start('colors')}
          onSave={save}
          onCancel={cancel}
        >
          {editing === 'colors' && deep && sectionCopyEditor()}
          {colorSystem ? (
            <>
              {colorGroups ? (
                colorGroups.map((g) => {
                  const groupColors = g.hexes
                    .map((h) => colorByHex.get(h.toLowerCase()))
                    .filter((c): c is DeepColor => !!c);
                  if (!groupColors.length) return null;
                  return (
                    <div key={g.title} className="mb-5">
                      <div className="text-[11px] font-bold tracking-[0.6px] uppercase text-[#9CA3AF] mb-2">{g.title}</div>
                      <div className="flex flex-wrap gap-4">{groupColors.map((c) => <DeepSwatch key={c.hex} color={c} />)}</div>
                      {g.note && <div className="text-[11px] italic text-[#9CA3AF] mt-2 max-w-[600px]">{g.note}</div>}
                    </div>
                  );
                })
              ) : (
                <>
                  {anchors.length > 0 && (
                    <>
                      <div className="text-[11px] font-bold tracking-[0.6px] uppercase text-[#9CA3AF] mb-2">Anchors</div>
                      <div className="flex flex-wrap gap-4 mb-5">{anchors.map((c) => <DeepSwatch key={c.hex} color={c} />)}</div>
                    </>
                  )}
                  {accents.length > 0 && (
                    <>
                      <div className="text-[11px] font-bold tracking-[0.6px] uppercase text-[#9CA3AF] mb-2">Accents</div>
                      <div className="flex flex-wrap gap-4 mb-5">{accents.map((c) => <DeepSwatch key={c.hex} color={c} />)}</div>
                    </>
                  )}
                  {neutrals.length > 0 && (
                    <>
                      <div className="text-[11px] font-bold tracking-[0.6px] uppercase text-[#9CA3AF] mb-2">Neutrals</div>
                      <div className="flex flex-wrap gap-4 mb-5">{neutrals.map((c) => <DeepSwatch key={c.hex} color={c} />)}</div>
                    </>
                  )}
                </>
              )}
              {(deep?.gradients?.length ?? 0) > 0 && (
                <>
                  <div className="text-[11px] font-bold tracking-[0.6px] uppercase text-[#9CA3AF] mb-2">Gradients</div>
                  <div className="flex flex-wrap gap-4">
                    {deep!.gradients!.map((g) => (
                      <GradientCard key={g.css} css={g.css} stops={g.stops} name={g.name} usage={g.usage} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : editing === 'colors' ? (
            <div className="flex flex-wrap gap-3">
              {draftPalette.map((hex, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className="relative">
                    <input
                      type="color"
                      value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000'}
                      onChange={(e) => setDraftPalette((p) => p.map((h, j) => (j === i ? e.target.value : h)))}
                      className="w-12 h-12 rounded-lg border border-[#e5e7eb] cursor-pointer p-0"
                      aria-label={`Color ${i + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => setDraftPalette((p) => p.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#111827] text-white flex items-center justify-center"
                      aria-label={`Remove color ${i + 1}`}
                    >
                      <X size={9} />
                    </button>
                  </div>
                  <input
                    className="w-[74px] h-6 rounded border border-[#d1d5db] px-1.5 text-[11px] uppercase outline-none focus:border-[#2563EB]"
                    value={hex}
                    onChange={(e) => setDraftPalette((p) => p.map((h, j) => (j === i ? e.target.value : h)))}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setDraftPalette((p) => [...p, '#888888'])}
                className="w-12 h-12 rounded-lg border border-dashed border-[#d1d5db] text-[#9CA3AF] flex items-center justify-center hover:border-[#9CA3AF]"
                aria-label="Add color"
              >
                <Plus size={16} />
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {kit.palette.map((hex, i) => (
                <div key={`${hex}-${i}`} title={hex} className="w-12 h-12 rounded-lg" style={{ background: hex, border: isLightHex(hex) ? '1px solid #e5e7eb' : '1px solid rgba(0,0,0,0.04)' }} />
              ))}
            </div>
          )}
        </Section>

        {/* Fonts */}
        <Section title="Fonts" editing={editing === 'fonts'} onEdit={() => start('fonts')} onSave={save} onCancel={cancel}>
          <div className="flex flex-wrap items-start gap-4">
            <FontCard
              family={editing === 'fonts' ? draftHeadingFamily : kit.typography.heading.family}
              weights={weightsFor(kit.typography.heading.family)}
              selfHosted={isSelfHosted(kit.typography.heading.family)}
            />
            <FontCard
              family={editing === 'fonts' ? draftBodyFamily : kit.typography.body.family}
              weights={weightsFor(kit.typography.body.family)}
              selfHosted={isSelfHosted(kit.typography.body.family)}
            />
            {editing === 'fonts' && (
              <div className="flex flex-col gap-2 max-w-[300px]">
                <label className="text-[11px] font-medium text-[#6b7280]">Heading font (Google Fonts family)</label>
                <input className={inputClass} value={draftHeadingFamily} onChange={(e) => setDraftHeadingFamily(e.target.value)} />
                <label className="text-[11px] font-medium text-[#6b7280] mt-1">Body font (Google Fonts family)</label>
                <input className={inputClass} value={draftBodyFamily} onChange={(e) => setDraftBodyFamily(e.target.value)} />
              </div>
            )}
          </div>
          {deep?.fontNote && <p className="text-[11px] italic text-[#9CA3AF] mt-3 max-w-[600px]">{deep.fontNote}</p>}
        </Section>

        {/* 03 / Typography */}
        <Section
          eyebrow={deep ? '03 / Typography' : undefined}
          title={deep ? sectionCopy('typography', `Set in ${kit.typography.heading.family}`).title : 'Typography'}
          intro={deep ? sectionCopy('typography', '').intro : undefined}
          editing={editing === 'typography'}
          onEdit={() => start('typography')}
          onSave={save}
          onCancel={cancel}
        >
          {editing === 'typography' && deep && sectionCopyEditor()}
          {scaleRows ? (
            <>
              <TypeScaleTable rows={scaleRows} />
              <RuleList rules={deep?.typographyRules ?? []} />
            </>
          ) : (
            <>
              {editing === 'typography' && (
                <div className="mb-4 max-w-[340px]">
                  <label className="text-[11px] font-medium text-[#6b7280] block mb-1.5">Example word shown in samples</label>
                  <input className={inputClass + ' w-full'} value={draftSampleText} onChange={(e) => setDraftSampleText(e.target.value)} />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                <SimpleTypographyPanel kit={kit} sampleText={editing === 'typography' ? draftSampleText : sampleText} />
                <SimpleTypographyPanel kit={kit} dark sampleText={editing === 'typography' ? draftSampleText : sampleText} />
              </div>
            </>
          )}
        </Section>

        {/* 04 / Buttons */}
        <Section
          eyebrow={deep ? '04 / Buttons' : undefined}
          title={deep ? sectionCopy('buttons', 'Calls to action').title : 'CTAs'}
          intro={deep ? sectionCopy('buttons', '').intro : undefined}
          editing={editing === 'ctas'}
          onEdit={() => start('ctas')}
          onSave={save}
          onCancel={cancel}
        >
          {editing === 'ctas' && deep && sectionCopyEditor(true)}
          {specCtas ? (
            <>
              <div className="flex items-center gap-5 flex-wrap">
                {specCtas.map((spec) => (
                  <div key={spec.kind} className="flex flex-col items-start gap-1.5">
                    <SpecButton spec={spec} />
                    <span className="text-[10px] uppercase tracking-[0.5px] text-[#9CA3AF]">{spec.kind}</span>
                  </div>
                ))}
              </div>
              {sectionCopy('buttons', '').caption && (
                <p className="text-[11px] text-[#6b7280] mt-3">{sectionCopy('buttons', '').caption}</p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-4 flex-wrap">
              <button type="button" className="h-9 px-5 rounded-full text-[13px] font-semibold text-white" style={{ background: primary }}>
                {(editing === 'ctas' ? draftCtas : ctas).primary}
              </button>
              <button type="button" className="h-9 px-5 rounded-full text-[13px] font-semibold bg-white" style={{ color: primary, border: `1.5px solid ${primary}` }}>
                {(editing === 'ctas' ? draftCtas : ctas).secondary}
              </button>
              <span className="text-[13px] font-medium cursor-pointer hover:underline" style={{ color: primary }}>
                {(editing === 'ctas' ? draftCtas : ctas).link}
              </span>
              {editing === 'ctas' && (
                <div className="flex flex-col gap-2 basis-full max-w-[340px] mt-2">
                  <input className={inputClass} value={draftCtas.primary} onChange={(e) => setDraftCtas((c) => ({ ...c, primary: e.target.value }))} placeholder="Primary CTA label" />
                  <input className={inputClass} value={draftCtas.secondary} onChange={(e) => setDraftCtas((c) => ({ ...c, secondary: e.target.value }))} placeholder="Secondary CTA label" />
                  <input className={inputClass} value={draftCtas.link} onChange={(e) => setDraftCtas((c) => ({ ...c, link: e.target.value }))} placeholder="Link label" />
                </div>
              )}
            </div>
          )}
        </Section>

        {/* 05 / Voice & Tone */}
        {deep && (
          <Section
            eyebrow="05 / Voice and tone"
            title={sectionCopy('voice', `How ${kit.name} sounds`).title}
            intro={sectionCopy('voice', '').intro}
            editing={editing === 'voice'}
            onEdit={() => start('voice')}
            onSave={save}
            onCancel={cancel}
          >
            {editing === 'voice' && sectionCopyEditor()}
            {editing === 'voice' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="text-[11px] font-medium text-[#6b7280] block mb-1">Summary</label>
                  <textarea className={textareaClass} rows={2} value={draftVoice.summary} onChange={(e) => setDraftVoice((v) => ({ ...v, summary: e.target.value }))} />
                </div>
                {(
                  [
                    ['pillars', 'Brand pillars (one per line)'],
                    ['descriptors', 'Descriptors (one per line)'],
                    ['use', 'Phrases to use (one per line)'],
                    ['avoid', 'Words to avoid (one per line)'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="text-[11px] font-medium text-[#6b7280] block mb-1">{label}</label>
                    <textarea className={textareaClass} rows={5} value={draftVoice[key]} onChange={(e) => setDraftVoice((v) => ({ ...v, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
            ) : deep.voice ? (
              <>
                {deep.voice.summary && <p className="text-[13px] text-[#374151] leading-relaxed mb-4 max-w-[640px]">{deep.voice.summary}</p>}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  {deep.voice.pillars.map((p) => (
                    <div key={p} className="border border-[#e5e7eb] rounded-lg p-3 text-[12px] font-semibold text-[#0d1117] bg-[#fafafa]">
                      {p}
                    </div>
                  ))}
                </div>
                {deep.voice.descriptors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {deep.voice.descriptors.map((d) => (
                      <span key={d} className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#EEF2FF] text-[#3730A3]">
                        {d}
                      </span>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <div className="text-[11px] font-bold tracking-[0.6px] uppercase text-[#15803D] mb-2">Say this</div>
                    <ul className="space-y-1">
                      {deep.voice.phrasesToUse.map((p) => (
                        <li key={p} className="text-[12px] text-[#374151]">“{p}”</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold tracking-[0.6px] uppercase text-[#B91C1C] mb-2">Avoid</div>
                    <ul className="space-y-1">
                      {deep.voice.wordsToAvoid.map((p) => (
                        <li key={p} className="text-[12px] text-[#374151] line-through decoration-[#d1d5db]">“{p}”</li>
                      ))}
                    </ul>
                  </div>
                </div>
                {deep.voiceExtra && (
                  <div className="border border-[#e5e7eb] rounded-lg p-4 mt-5 bg-[#fafafa] max-w-[640px]">
                    <div className="text-[12px] font-bold text-[#0d1117] mb-1">{deep.voiceExtra.title}</div>
                    <p className="text-[12px] text-[#374151] leading-relaxed">{deep.voiceExtra.body}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-[13px] text-[#9CA3AF]">
                Voice &amp; tone generation needs ANTHROPIC_API_KEY on the server — add it to apps/salesdemo-ui/.env.local and re-extract, or click Edit to write it by hand.
              </p>
            )}
          </Section>
        )}

        {/* Closing band (benchmark: "PUT IT TO WORK") — styled with the kit's own ink */}
        {deep && (
          <div className="rounded-xl px-8 py-10 mb-4" style={{ background: inkHex }}>
            <div className="text-[10px] font-bold tracking-[1.4px] uppercase mb-2" style={{ color: `${canvasHex}99` }}>
              Put it to work
            </div>
            <div className="text-[22px] font-bold tracking-[-0.3px]" style={{ color: canvasHex, fontFamily: headingFont }}>
              One system, on brand everywhere
            </div>
            <p className="text-[13px] leading-relaxed mt-2 max-w-[560px]" style={{ color: `${canvasHex}b3` }}>
              Every asset above was extracted from {kit.domain}: logo, palette, type, buttons, and voice in one place.
              Edit any section — changes persist to this kit.
            </p>
          </div>
        )}

        {/* Danger zone: delete this kit (inline confirm, no browser dialog) */}
        {onDelete && (
          <div className="flex items-center justify-end gap-2 pb-8">
            {confirmingDelete ? (
              <>
                <span className="text-[12px] text-[#6b7280]">
                  Delete the {kit.name} kit? Its extracted data and assets are removed.
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="h-8 px-3 rounded-lg text-[12px] font-medium text-[#374151] border border-[#e5e7eb] hover:bg-[#f9fafb]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(kit)}
                  className="h-8 px-3 rounded-lg text-[12px] font-medium text-white bg-[#B91C1C] hover:opacity-90 flex items-center gap-1.5"
                >
                  <TrashIcon size={13} /> Delete kit
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="h-8 px-3 rounded-lg text-[12px] font-medium text-[#B91C1C] border border-[#fecaca] hover:bg-[#fef2f2] flex items-center gap-1.5"
                aria-label={`Delete the ${kit.name} brand kit`}
              >
                <TrashIcon size={13} /> Delete kit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SimpleTypographyPanel({ kit, dark, sampleText }: { kit: BrandKitBoardData; dark?: boolean; sampleText: string }) {
  const headingFont = `'${kit.typography.heading.family}', sans-serif`;
  const bodyFont = `'${kit.typography.body.family}', sans-serif`;
  const fg = dark ? '#ffffff' : '#0d1b2a';
  const muted = dark ? '#94A3B8' : '#6b7280';
  const rows = [
    { label: 'H1', size: 34, weight: 700 },
    { label: 'H2', size: 26, weight: 600 },
    { label: 'H3', size: 21, weight: 600 },
    { label: 'H4', size: 16, weight: 600 },
  ];
  return (
    <div className="p-5 rounded-sm" style={{ background: dark ? '#0D1B2A' : 'transparent' }}>
      {rows.map((r) => (
        <div key={r.label} className="leading-snug" style={{ fontFamily: headingFont, fontSize: r.size, fontWeight: r.weight, color: fg, marginBottom: 6 }}>
          {`Here's an ${r.label} ${sampleText}`}
        </div>
      ))}
      <div style={{ fontFamily: bodyFont, fontSize: 12, color: muted, marginBottom: 6 }}>{`Here's a body ${sampleText}`}</div>
      <div style={{ fontFamily: bodyFont, fontSize: 11, color: muted, letterSpacing: 0.3 }}>{`Here's an overline ${sampleText}`}</div>
    </div>
  );
}
