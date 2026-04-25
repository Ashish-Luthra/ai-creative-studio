'use client'

import type { FabricObject } from 'fabric'
import { Sparkles } from 'lucide-react'
import { DEFAULT_TEXT_FONT_FAMILY, DEFAULT_TEXT_FONT_SIZE } from '@/lib/canvas/canvasDefaults'
import { cn } from '@/lib/utils'

const SWATCHES = ['#111827', '#2563EB', '#7C3AED', '#DC2626', '#16A34A', '#D97706']

/** Fabric `fill` may be a string, Gradient, Pattern, etc. — only strings are valid React text. */
function fabricFillToDisplay(fill: unknown): string {
  if (typeof fill === 'string') return fill
  if (fill && typeof fill === 'object' && 'type' in fill) {
    const t = String((fill as { type?: string }).type)
    if (t === 'linear' || t === 'radial') return 'Gradient'
    return 'Fill'
  }
  return '—'
}

export interface FloatPropertiesCardProps {
  selectedLayer: FabricObject
  onClose?: () => void
  onAiImprove?: () => void
  onAiVariants?: () => void
}

export const FloatPropertiesCard: React.FC<FloatPropertiesCardProps> = ({
  selectedLayer,
  onAiImprove,
  onAiVariants,
}) => {
  // Extract properties from the Fabric object (best-effort — works for IText/Textbox)
  const obj = selectedLayer as unknown as Record<string, unknown>
  const fontFamily  = (obj.fontFamily  as string)  ?? DEFAULT_TEXT_FONT_FAMILY
  const fontSize    = (obj.fontSize    as number)   ?? DEFAULT_TEXT_FONT_SIZE
  const fontWeight  = (obj.fontWeight  as string | number) ?? 400
  const lineHeight  = (obj.lineHeight  as number)   ?? 1.2
  const fillRaw = obj.fill
  const fillDisplay = fabricFillToDisplay(fillRaw)
  const fillForSwatch = typeof fillRaw === 'string' ? fillRaw : null
  const left        = Math.round((obj.left  as number) ?? 0)
  const top         = Math.round((obj.top   as number) ?? 0)

  return (
    <div
      className={cn(
        // Spec: glassmorphism card, floating right — not anchored to edge
        'absolute right-5 top-16 z-50 w-[216px]',
        'rounded-2xl border border-white/70 bg-white/90',
        'p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.10),0_2px_6px_rgba(0,0,0,0.06)]',
        'backdrop-blur-[16px]'
      )}
    >
      <h3 className="mb-2.5 border-b border-black/[0.06] pb-1.5 text-[10px] font-bold uppercase tracking-[.08em] text-gray-500">
        Properties
      </h3>

      {/* Typography */}
      <Section label="Typography">
        <PropRow label="Font"   value={fontFamily} />
        <PropRow label="Size"   value={`${fontSize}px`} />
        <PropRow label="Weight" value={String(fontWeight)} />
        <PropRow label="Line H" value={String(lineHeight)} />
      </Section>

      {/* Color */}
      <Section label="Color">
        <div className="mb-1 flex gap-1">
          {SWATCHES.map((hex) => (
            <div
              key={hex}
              style={{ background: hex }}
              className={cn(
                'h-5 w-5 cursor-pointer rounded-[4px] border-2 transition-transform hover:scale-110',
                fillForSwatch === hex ? 'border-blue-500' : 'border-transparent'
              )}
            />
          ))}
        </div>
        <p className="text-[10px] text-gray-400">{fillDisplay}</p>
      </Section>

      {/* Position */}
      <Section label="Position">
        <PropRow label="X" value={String(left)} />
        <PropRow label="Y" value={String(top)} />
      </Section>

      {/* AI actions */}
      <Section label="AI" noBorder>
        <AiBtn icon={<Sparkles size={11} />} onClick={onAiImprove}>
          Improve copy
        </AiBtn>
        <AiBtn icon={<Sparkles size={11} />} onClick={onAiVariants}>
          Generate variants
        </AiBtn>
      </Section>
    </div>
  )
}

/* ── Helpers ───────────────────────────────────────────────── */

const Section: React.FC<{
  label: string
  children: React.ReactNode
  noBorder?: boolean
}> = ({ label, children, noBorder }) => (
  <div className={cn('mb-3', noBorder ? '' : '')}>
    <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[.08em] text-gray-400">
      {label}
    </p>
    {children}
  </div>
)

const PropRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="mb-1.5 flex items-center justify-between">
    <span className="text-[11px] text-gray-500">{label}</span>
    <span className="min-w-[58px] rounded-[5px] border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-center text-[11px] font-medium text-gray-900">
      {value}
    </span>
  </div>
)

const AiBtn: React.FC<{
  icon: React.ReactNode
  onClick?: () => void
  children: React.ReactNode
}> = ({ icon, onClick, children }) => (
  <button
    onClick={onClick}
    className="mb-1 flex w-full items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-left text-[11px] text-gray-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
  >
    <span className="text-gray-400">{icon}</span>
    {children}
  </button>
)
