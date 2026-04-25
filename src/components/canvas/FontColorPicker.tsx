'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Pipette } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buildDefaultSwatchColumns,
  clamp,
  colorToOpaqueHex,
  hexToHsl,
  hslToHex,
  isTransparentCss,
  normalizeHex,
} from '@/lib/canvas/colorPickerUtils'

const TRANSPARENT = 'rgba(0,0,0,0)'
const BRAND_KEY = 'ai-creative-studio-brand-colors'
const MAX_BRAND = 8

function loadBrandColors(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(BRAND_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === 'string' && /^#[0-9A-Fa-f]{6}$/.test(x)).slice(0, MAX_BRAND)
      : []
  } catch {
    return []
  }
}

function saveBrandColors(colors: string[]) {
  try {
    localStorage.setItem(BRAND_KEY, JSON.stringify(colors.slice(0, MAX_BRAND)))
  } catch {
    /* ignore quota */
  }
}

export interface FontColorPickerProps {
  color: string
  onColorChange: (color: string) => void
  className?: string
}

export const FontColorPicker: React.FC<FontColorPickerProps> = ({
  color,
  onColorChange,
  className,
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 })
  const [hsl, setHsl] = useState<{ h: number; s: number; l: number }>(() => hexToHsl('#111827')!)
  const [hexDraft, setHexDraft] = useState('')
  const [brandColors, setBrandColors] = useState<string[]>([])

  const opaqueHex = useMemo(() => colorToOpaqueHex(color), [color])
  const transparent = isTransparentCss(color)
  const displayHex = opaqueHex ?? '#000000'

  const swatchColumns = useMemo(() => buildDefaultSwatchColumns(10), [])

  useEffect(() => {
    if (!open) return
    setBrandColors(loadBrandColors())
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = colorToOpaqueHex(color)
    if (h) {
      const parsed = hexToHsl(h)
      if (parsed) setHsl(parsed)
    } else {
      setHsl({ h: 0, s: 0, l: 0 })
    }
    setHexDraft(transparent ? '' : (opaqueHex ?? '').replace(/^#/, '').toUpperCase())
  }, [color, open, opaqueHex, transparent])

  const updatePanelPosition = useCallback(() => {
    const tr = triggerRef.current
    if (!tr) return
    const r = tr.getBoundingClientRect()
    setPanelPos({ top: r.bottom + 8, left: r.left + r.width / 2 })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePanelPosition()
    window.addEventListener('scroll', updatePanelPosition, true)
    window.addEventListener('resize', updatePanelPosition)
    return () => {
      window.removeEventListener('scroll', updatePanelPosition, true)
      window.removeEventListener('resize', updatePanelPosition)
    }
  }, [open, updatePanelPosition])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const applyHexString = useCallback(
    (raw: string) => {
      const cleaned = raw.replace(/^#/, '').trim()
      if (cleaned.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(cleaned)) return
      const hex = normalizeHex(`#${cleaned}`)
      onColorChange(hex)
      const parsed = hexToHsl(hex)
      if (parsed) setHsl(parsed)
    },
    [onColorChange]
  )

  const onSliderChange = useCallback(
    (l: number) => {
      const next = { ...hsl, l: clamp(l, 0, 100) }
      setHsl(next)
      onColorChange(hslToHex(next.h, next.s, next.l))
    },
    [hsl, onColorChange]
  )

  const addBrandColor = useCallback(() => {
    const hex = colorToOpaqueHex(color)
    if (!hex) return
    const n = normalizeHex(hex)
    setBrandColors((prev) => {
      if (prev.includes(n)) return prev
      const next = [...prev, n].slice(0, MAX_BRAND)
      saveBrandColors(next)
      return next
    })
  }, [color])

  const eyedropperSupported =
    typeof window !== 'undefined' && typeof (window as Window & { EyeDropper?: unknown }).EyeDropper === 'function'

  const eyedropper = useCallback(async () => {
    const ED = typeof window !== 'undefined' ? (window as Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper : undefined
    if (!ED) return
    try {
      const dropper = new ED()
      const { sRGBHex } = await dropper.open()
      if (sRGBHex) onColorChange(normalizeHex(sRGBHex))
    } catch {
      /* user cancelled */
    }
  }, [onColorChange])

  const sliderTrackStyle = {
    background: `linear-gradient(to right, ${hslToHex(hsl.h, hsl.s, 100)}, ${hslToHex(hsl.h, hsl.s, 0)})`,
  } as const

  const previewFill = transparent ? 'transparent' : displayHex
  const triggerRing = transparent || previewFill === 'transparent'

  const panel = open && (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: panelPos.top,
        left: panelPos.left,
        transform: 'translateX(-50%)',
        zIndex: 10000,
      }}
      className={cn(
        'w-[min(288px,calc(100vw-24px))]',
        'rounded-2xl border border-gray-200/80 bg-white p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.14),0_4px_12px_rgba(0,0,0,0.08)]'
      )}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-gray-800">Font color</p>
          <p className="text-[11px] text-gray-400">{transparent ? 'Transparent' : displayHex}</p>
        </div>
        <div
          className="h-11 w-11 shrink-0 rounded-full border border-black/10 shadow-inner"
          style={{
            background: transparent
              ? 'linear-gradient(135deg, #fff 45%, #ef4444 45%, #ef4444 55%, #fff 55%)'
              : displayHex,
          }}
        />
      </div>

      <div className="mb-2.5 flex gap-1">
        {swatchColumns.map((col, ci) => (
          <div key={ci} className="flex min-w-0 flex-1 flex-col gap-1">
            {col.map((hex, ri) => {
              const selected = !transparent && opaqueHex && normalizeHex(hex) === normalizeHex(opaqueHex)
              return (
                <button
                  key={`${ci}-${ri}-${hex}`}
                  type="button"
                  title={hex}
                  onClick={() => onColorChange(hex)}
                  style={{ background: hex }}
                  className={cn(
                    'mx-auto h-[18px] w-[18px] shrink-0 rounded-full border border-black/[0.08] transition-transform hover:scale-110',
                    selected && 'ring-2 ring-blue-500 ring-offset-1'
                  )}
                />
              )
            })}
            {ci === swatchColumns.length - 1 && (
              <button
                type="button"
                title="Transparent"
                onClick={() => onColorChange(TRANSPARENT)}
                className={cn(
                  'relative mx-auto mt-0.5 h-[18px] w-[18px] shrink-0 overflow-hidden rounded-full border border-gray-300 bg-white transition-transform hover:scale-110',
                  transparent && 'ring-2 ring-blue-500 ring-offset-1'
                )}
              >
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(135deg, transparent 44%, #ef4444 44%, #ef4444 56%, transparent 56%)',
                  }}
                />
              </button>
            )}
          </div>
        ))}
      </div>

      {brandColors.length > 0 && (
        <div className="mb-2.5">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-gray-400">Brand</p>
          <div className="flex flex-wrap gap-1">
            {brandColors.map((hex) => (
              <button
                key={hex}
                type="button"
                title={hex}
                onClick={() => onColorChange(hex)}
                style={{ background: hex }}
                className={cn(
                  'h-[18px] w-[18px] rounded-full border border-black/[0.08] transition-transform hover:scale-110',
                  !transparent && normalizeHex(hex) === normalizeHex(displayHex) && 'ring-2 ring-blue-500 ring-offset-1'
                )}
              />
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={addBrandColor}
        className="mb-3 w-full text-left text-[11px] font-medium text-gray-700 underline decoration-gray-300 underline-offset-2 transition-colors hover:text-blue-600 hover:decoration-blue-300"
      >
        Add your brand colors
      </button>

      <div className="mb-3">
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={hsl.l}
          onChange={(e) => onSliderChange(Number(e.target.value))}
          className={cn(
            'h-2 w-full cursor-pointer appearance-none rounded-full',
            '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-gray-900 [&::-webkit-slider-thumb]:shadow-md',
            '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-gray-900 [&::-moz-range-thumb]:shadow-md'
          )}
          style={sliderTrackStyle}
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
          <span
            className="h-5 w-5 shrink-0 rounded-full border border-black/10"
            style={{
              background: transparent
                ? 'linear-gradient(135deg, #fff 45%, #ef4444 45%, #ef4444 55%, #fff 55%)'
                : displayHex,
            }}
          />
          <span className="text-[12px] text-gray-500">#</span>
          <input
            type="text"
            value={hexDraft}
            onChange={(e) => setHexDraft(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
            onBlur={() => {
              if (hexDraft.length === 6) applyHexString(hexDraft)
              else
                setHexDraft(
                  transparent ? '' : (opaqueHex ?? '').replace(/^#/, '').toUpperCase()
                )
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                applyHexString(hexDraft)
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            placeholder={transparent ? '—' : '000000'}
            className="min-w-0 flex-1 bg-transparent text-[12px] font-medium uppercase text-gray-900 outline-none placeholder:text-gray-400"
          />
        </div>
        <button
          type="button"
          title={eyedropperSupported ? 'Pick from screen' : 'Eyedropper not supported in this browser'}
          onClick={eyedropper}
          disabled={!eyedropperSupported}
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors',
            eyedropperSupported
              ? 'hover:border-gray-300 hover:bg-gray-50'
              : 'cursor-not-allowed opacity-40'
          )}
        >
          <Pipette size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  )

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        title="Font color"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-transform',
          open ? 'border-blue-500 ring-1 ring-blue-400' : 'border-gray-300 hover:scale-105 hover:border-gray-400'
        )}
        style={{
          background: triggerRing
            ? 'linear-gradient(135deg, #fff 45%, #ef4444 45%, #ef4444 55%, #fff 55%)'
            : previewFill,
        }}
      />

      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </div>
  )
}
