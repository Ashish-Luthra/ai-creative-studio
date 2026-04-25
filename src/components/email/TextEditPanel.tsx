'use client'
import { useState } from 'react'
import { ColorPickerPopup } from './ColorPickerPopup'

interface TextEditPanelProps {
  onClose?: () => void
}

export function TextEditPanel({ onClose }: TextEditPanelProps) {
  const [fontFamily, setFontFamily] = useState('Georgia')
  const [fontWeight, setFontWeight] = useState('Medium')
  const [fontSize, setFontSize] = useState(28)
  const [fontColor, setFontColor] = useState('#000000')
  const [alignment, setAlignment] = useState('center')
  const [textCase, setTextCase] = useState('none')
  const [lineHeight, setLineHeight] = useState(1.3)
  const [letterSpacing, setLetterSpacing] = useState(0.3)
  const [showWeightDropdown, setShowWeightDropdown] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [activeTab, setActiveTab] = useState<'font' | 'layout' | 'link' | 'block'>('font')

  const weights = ['Light', 'Book', 'Medium', 'Semibold', 'Bold', 'Black']

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-gray-100 px-4">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Text Style</span>
        {onClose && (
          <button onClick={onClose} className="text-[11px] text-gray-400 hover:text-gray-700">← Blocks</button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 gap-3 border-b border-gray-200 px-4">
        {(['font', 'layout', 'link', 'block'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`py-2 text-[11px] font-medium capitalize transition-colors ${activeTab === tab ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
          >{tab}</button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-5">
        {activeTab === 'font' && (
          <>
            {/* Font family + weight */}
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-gray-500">Font</label>
              <div className="flex gap-2">
                <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}
                  className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-[12px] text-gray-700 focus:border-blue-400 focus:outline-none">
                  <option>Georgia</option><option>Arial</option><option>Helvetica</option><option>Verdana</option>
                </select>
                <div className="relative">
                  <button onClick={() => setShowWeightDropdown(!showWeightDropdown)}
                    className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-[12px] text-blue-700 flex items-center gap-1">
                    {fontWeight}
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>
                  {showWeightDropdown && (
                    <div className="absolute top-full mt-1 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
                      {weights.map((w) => (
                        <button key={w} onClick={() => { setFontWeight(w); setShowWeightDropdown(false) }}
                          className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50 ${fontWeight === w ? 'bg-gray-100' : ''}`}>{w}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Size */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-medium text-gray-500">Size</label>
                <span className="text-[11px] text-gray-400">{fontSize}px</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setFontSize(Math.max(8, fontSize - 1))} className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded text-gray-500 hover:bg-gray-50">−</button>
                <input type="range" min="8" max="72" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="flex-1" />
                <button onClick={() => setFontSize(Math.min(72, fontSize + 1))} className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded text-gray-500 hover:bg-gray-50">+</button>
              </div>
            </div>

            {/* Color */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-medium text-gray-500">Color</label>
                <span className="text-[11px] font-mono text-gray-400">{fontColor}</span>
              </div>
              <button onClick={() => setShowColorPicker(!showColorPicker)}
                className="w-10 h-10 rounded-full border-2 border-gray-200 hover:border-blue-400 transition-all"
                style={{ backgroundColor: fontColor }} />
              {showColorPicker && (
                <ColorPickerPopup isOpen={showColorPicker} onClose={() => setShowColorPicker(false)}
                  currentColor={fontColor} onColorChange={setFontColor} />
              )}
            </div>

            {/* Alignment */}
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-gray-500">Align</label>
              <div className="flex gap-1.5">
                {[
                  { v: 'left', icon: <path d="M3 5h10M3 10h14M3 15h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/> },
                  { v: 'center', icon: <path d="M5 5h10M3 10h14M6 15h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/> },
                  { v: 'right', icon: <path d="M7 5h10M3 10h14M9 15h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/> },
                ].map(({ v, icon }) => (
                  <button key={v} onClick={() => setAlignment(v)}
                    className={`flex-1 py-1.5 rounded border ${alignment === v ? 'bg-gray-200 border-gray-400' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="mx-auto">{icon}</svg>
                  </button>
                ))}
              </div>
            </div>

            {/* Case */}
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-gray-500">Case</label>
              <div className="flex gap-1.5">
                {[['none','-'],['lowercase','aa'],['capitalize','Aa'],['uppercase','AA']].map(([v, label]) => (
                  <button key={v} onClick={() => setTextCase(v)}
                    className={`flex-1 py-1.5 rounded border text-[11px] ${textCase === v ? 'bg-gray-200 border-gray-400' : 'border-gray-200 hover:bg-gray-50'}`}>{label}</button>
                ))}
              </div>
            </div>

            {/* Spacing */}
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-gray-500">Line Height</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setLineHeight(Math.max(0.5, +(lineHeight - 0.1).toFixed(1)))} className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded text-gray-500 hover:bg-gray-50 text-sm">−</button>
                <input type="range" min="0.5" max="3" step="0.1" value={lineHeight} onChange={(e) => setLineHeight(+e.target.value)} className="flex-1" />
                <span className="w-8 text-right text-[11px] text-gray-400">{lineHeight}</span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-gray-500">Letter Spacing</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setLetterSpacing(Math.max(-1, +(letterSpacing - 0.1).toFixed(1)))} className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded text-gray-500 hover:bg-gray-50 text-sm">−</button>
                <input type="range" min="-1" max="2" step="0.1" value={letterSpacing} onChange={(e) => setLetterSpacing(+e.target.value)} className="flex-1" />
                <span className="w-8 text-right text-[11px] text-gray-400">{letterSpacing}</span>
              </div>
            </div>
          </>
        )}
        {(activeTab === 'layout' || activeTab === 'link' || activeTab === 'block') && (
          <p className="text-[11px] text-gray-400 py-4 text-center">Coming soon</p>
        )}
      </div>
    </div>
  )
}
