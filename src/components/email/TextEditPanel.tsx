'use client'
import { useState, useRef, useCallback } from 'react'
import { ColorPickerPopup } from './ColorPickerPopup'

// ─── ContentEditable helpers ──────────────────────────────────────────────────

/** Execute a formatting command. Must be called while the contenteditable still
 *  has focus — use onMouseDown + e.preventDefault() on toolbar buttons so the
 *  contenteditable never loses focus/selection. */
function execCmd(command: string, value?: string) {
  document.execCommand(command, false, value ?? undefined)
}

/** Wrap the current selection in a <span> with one inline style applied.
 *  Uses extractContents() so it's safe across partial element selections. */
function wrapSelectionStyle(prop: string, value: string) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
  const range = sel.getRangeAt(0)
  const fragment = range.extractContents()
  const span = document.createElement('span')
  ;(span.style as unknown as Record<string, string>)[prop] = value
  span.appendChild(fragment)
  range.insertNode(span)
  // Re-select the new span contents
  const newRange = document.createRange()
  newRange.selectNodeContents(span)
  sel.removeAllRanges()
  sel.addRange(newRange)
}

/** Apply pixel font size using execCommand workaround:
 *  stamp a sentinel <font size="7">, then replace with a <span style="font-size"> */
function applyFontSizePx(px: number) {
  execCmd('fontSize', '7')
  const fontEls = document.querySelectorAll('font[size="7"]')
  fontEls.forEach((el) => {
    const span = document.createElement('span')
    span.style.fontSize = `${px}px`
    span.innerHTML = (el as HTMLElement).innerHTML
    el.parentNode?.replaceChild(span, el)
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TextEditPanelProps {
  onClose?: () => void
}

export function TextEditPanel({ onClose }: TextEditPanelProps) {
  const [fontFamily, setFontFamily] = useState('Georgia')
  const [fontWeight, setFontWeight] = useState('Medium')
  const [fontSize, setFontSize] = useState(16)
  const [fontColor, setFontColor] = useState('#000000')
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('left')
  const [textCase, setTextCase] = useState('none')
  const [lineHeight, setLineHeight] = useState(1.5)
  const [letterSpacing, setLetterSpacing] = useState(0)
  const [showWeightDropdown, setShowWeightDropdown] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [activeTab, setActiveTab] = useState<'font' | 'layout' | 'link' | 'block'>('font')

  // Saved selection ref — used when a slider or select steals focus
  const savedRangeRef = useRef<Range | null>(null)

  const saveSelection = useCallback(() => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    }
  }, [])

  const restoreSelection = useCallback(() => {
    const sel = window.getSelection()
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges()
      sel.addRange(savedRangeRef.current)
    }
  }, [])

  const FONT_OPTIONS = [
    'Georgia', 'Arial', 'Helvetica', 'Verdana',
    'Times New Roman', 'Courier New', 'Trebuchet MS', 'Tahoma',
  ]

  const WEIGHTS: { label: string; value: string }[] = [
    { label: 'Light',    value: '300' },
    { label: 'Regular',  value: '400' },
    { label: 'Medium',   value: '500' },
    { label: 'Semibold', value: '600' },
    { label: 'Bold',     value: '700' },
    { label: 'Black',    value: '900' },
  ]

  const ALIGN_ITEMS: { v: 'left' | 'center' | 'right'; cmd: string; icon: React.ReactNode }[] = [
    {
      v: 'left', cmd: 'justifyLeft',
      icon: <path d="M3 5h10M3 10h14M3 15h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />,
    },
    {
      v: 'center', cmd: 'justifyCenter',
      icon: <path d="M5 5h10M3 10h14M6 15h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />,
    },
    {
      v: 'right', cmd: 'justifyRight',
      icon: <path d="M7 5h10M3 10h14M9 15h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />,
    },
  ]

  // bg colour for ColorPickerPopup trigger
  const colorTriggerStyle = { backgroundColor: fontColor }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">

      {/* ── Header ── */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-gray-100 px-4">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Text Style
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
          >
            ← Blocks
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex shrink-0 gap-3 border-b border-gray-200 px-4">
        {(['font', 'layout', 'link', 'block'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2 text-[11px] font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-gray-900 text-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-5">

        {activeTab === 'font' && (
          <>
            {/* ── B / I / U / S quick row ── */}
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-gray-500">
                Format
              </label>
              <div className="flex gap-1.5">
                {[
                  { label: 'B', title: 'Bold',          cmd: 'bold',          cls: 'font-bold' },
                  { label: 'I', title: 'Italic',        cmd: 'italic',        cls: 'italic' },
                  { label: 'U', title: 'Underline',     cmd: 'underline',     cls: 'underline' },
                  { label: 'S', title: 'Strikethrough', cmd: 'strikeThrough', cls: 'line-through' },
                ].map(({ label, title, cmd: c, cls }) => (
                  <button
                    key={c}
                    title={title}
                    onMouseDown={(e) => {
                      e.preventDefault()   // keep focus + selection in contenteditable
                      execCmd(c)
                    }}
                    className={`flex-1 rounded border border-gray-200 py-1.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors ${cls}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Font family ── */}
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-gray-500">
                Font Family
              </label>
              <div className="flex gap-2">
                <select
                  value={fontFamily}
                  onFocus={saveSelection}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-[12px] text-gray-700 focus:border-blue-400 focus:outline-none"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault()
                    restoreSelection()
                    execCmd('fontName', fontFamily)
                  }}
                  className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* ── Font weight ── */}
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-gray-500">
                Weight
              </label>
              <div className="relative">
                <button
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setShowWeightDropdown((o) => !o)
                  }}
                  className="w-full flex items-center justify-between rounded-md border border-gray-200 px-3 py-1.5 text-[12px] text-gray-700 hover:border-gray-300 transition-colors"
                >
                  <span>{fontWeight}</span>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
                {showWeightDropdown && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                    {WEIGHTS.map(({ label, value }) => (
                      <button
                        key={label}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setFontWeight(label)
                          setShowWeightDropdown(false)
                          wrapSelectionStyle('fontWeight', value)
                        }}
                        className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50 ${
                          fontWeight === label ? 'bg-gray-100 font-medium' : ''
                        }`}
                        style={{ fontWeight: value }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Font size ── */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[10px] font-medium text-gray-500">Size</label>
                <span className="text-[11px] font-medium text-gray-500">{fontSize}px</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const next = Math.max(8, fontSize - 1)
                    setFontSize(next)
                    applyFontSizePx(next)
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm"
                >
                  −
                </button>
                <input
                  type="range"
                  min="8"
                  max="72"
                  value={fontSize}
                  onFocus={saveSelection}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  onMouseUp={() => { restoreSelection(); applyFontSizePx(fontSize) }}
                  onTouchEnd={() => { restoreSelection(); applyFontSizePx(fontSize) }}
                  className="flex-1 accent-blue-500"
                />
                <button
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const next = Math.min(72, fontSize + 1)
                    setFontSize(next)
                    applyFontSizePx(next)
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* ── Text colour ── */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[10px] font-medium text-gray-500">Colour</label>
                <span className="font-mono text-[11px] text-gray-400">{fontColor}</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Native colour input — saves selection on focus so clicking the
                    picker doesn't lose the contenteditable selection */}
                <label
                  className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-gray-200 shadow-inner hover:border-blue-400 transition-colors"
                  style={colorTriggerStyle}
                >
                  <input
                    type="color"
                    value={fontColor}
                    onFocus={saveSelection}
                    onChange={(e) => {
                      setFontColor(e.target.value)
                      restoreSelection()
                      execCmd('foreColor', e.target.value)
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>

                {/* Colour swatches — quick picks */}
                <div className="flex flex-1 flex-wrap gap-1">
                  {['#000000','#374151','#6b7280','#ffffff','#3b82f6','#8b5cf6','#ec4899','#f97316','#22c55e','#eab308','#ef4444','#14b8a6'].map((c) => (
                    <button
                      key={c}
                      title={c}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setFontColor(c)
                        execCmd('foreColor', c)
                      }}
                      className="h-5 w-5 rounded-full border border-gray-200 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {showColorPicker && (
                <ColorPickerPopup
                  isOpen={showColorPicker}
                  onClose={() => setShowColorPicker(false)}
                  currentColor={fontColor}
                  onColorChange={(c) => {
                    setFontColor(c)
                    restoreSelection()
                    execCmd('foreColor', c)
                  }}
                />
              )}
            </div>

            {/* ── Alignment ── */}
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-gray-500">
                Align
              </label>
              <div className="flex gap-1.5">
                {ALIGN_ITEMS.map(({ v, cmd: c, icon }) => (
                  <button
                    key={v}
                    title={v}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setAlignment(v)
                      execCmd(c)
                    }}
                    className={`flex flex-1 items-center justify-center rounded border py-1.5 transition-colors ${
                      alignment === v
                        ? 'border-gray-400 bg-gray-200'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">{icon}</svg>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Text case ── */}
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-gray-500">
                Case
              </label>
              <div className="flex gap-1.5">
                {[
                  { v: 'none',       label: '—' },
                  { v: 'lowercase',  label: 'aa' },
                  { v: 'capitalize', label: 'Aa' },
                  { v: 'uppercase',  label: 'AA' },
                ].map(({ v, label }) => (
                  <button
                    key={v}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setTextCase(v)
                      wrapSelectionStyle('textTransform', v === 'none' ? 'initial' : v)
                    }}
                    className={`flex-1 rounded border py-1.5 text-[11px] transition-colors ${
                      textCase === v
                        ? 'border-gray-400 bg-gray-200'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Line height ── */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[10px] font-medium text-gray-500">Line Height</label>
                <span className="text-[11px] text-gray-400">{lineHeight.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const next = +(Math.max(0.5, lineHeight - 0.1)).toFixed(1)
                    setLineHeight(next)
                    wrapSelectionStyle('lineHeight', String(next))
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm"
                >
                  −
                </button>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={lineHeight}
                  onFocus={saveSelection}
                  onChange={(e) => setLineHeight(+e.target.value)}
                  onMouseUp={() => { restoreSelection(); wrapSelectionStyle('lineHeight', String(lineHeight)) }}
                  className="flex-1 accent-blue-500"
                />
                <button
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const next = +(Math.min(3, lineHeight + 0.1)).toFixed(1)
                    setLineHeight(next)
                    wrapSelectionStyle('lineHeight', String(next))
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* ── Letter spacing ── */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[10px] font-medium text-gray-500">Letter Spacing</label>
                <span className="text-[11px] text-gray-400">{letterSpacing.toFixed(1)}px</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const next = +(Math.max(-2, letterSpacing - 0.5)).toFixed(1)
                    setLetterSpacing(next)
                    wrapSelectionStyle('letterSpacing', `${next}px`)
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm"
                >
                  −
                </button>
                <input
                  type="range"
                  min="-2"
                  max="10"
                  step="0.5"
                  value={letterSpacing}
                  onFocus={saveSelection}
                  onChange={(e) => setLetterSpacing(+e.target.value)}
                  onMouseUp={() => { restoreSelection(); wrapSelectionStyle('letterSpacing', `${letterSpacing}px`) }}
                  className="flex-1 accent-blue-500"
                />
                <button
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const next = +(Math.min(10, letterSpacing + 0.5)).toFixed(1)
                    setLetterSpacing(next)
                    wrapSelectionStyle('letterSpacing', `${next}px`)
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm"
                >
                  +
                </button>
              </div>
            </div>
          </>
        )}

        {(activeTab === 'layout' || activeTab === 'link' || activeTab === 'block') && (
          <p className="py-6 text-center text-[11px] text-gray-400">Coming soon</p>
        )}

      </div>
    </div>
  )
}
