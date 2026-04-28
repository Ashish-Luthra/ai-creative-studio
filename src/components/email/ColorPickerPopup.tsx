'use client'
import { useState } from 'react'

interface ColorPickerPopupProps {
  isOpen: boolean
  onClose: () => void
  currentColor: string
  onColorChange: (color: string) => void
}

export function ColorPickerPopup({ onClose, currentColor, onColorChange }: ColorPickerPopupProps) {
  const [hexInput, setHexInput] = useState(currentColor)

  const presetColors = [
    '#D4B5A7','#B07B7B','#F5E6E8','#C9A89C','#E8D5C4','#C9C5A3','#A8A67E','#8FA095','#9EA5A3','#B8CDE0','#000814',
    '#E8BBA8','#D4A5A5','#E8D5C4','#D4B5A7','#F5D5C4','#C9D5C4','#7FBC8C','#A8C9C5','#B8CDE0','#D5E0C9','#3D4149',
    '#E87B5C','#C96B5C','#F5A5A5','#E85C7B','#C96B5C','#E89C5C','#5FBC8C','#A8D5C9','#C9E0D5','#E0E8C9','#5A5D66',
    '#BC4B3C','#7B3D3D','#C97B8C','#BC3D5C','#E87B5C','#E8A85C','#8FD5A8','#A8C9B8','#C9D5C4','#E0E8D5','#1A3D3D',
    '#8C3D3D','#C9A89C','#C97B9C','#BC5C7B','#E8A87B','#5FBC8C','#7BA8A8','#7BB8D5','#0047AB','#A8B8C9','#8899AA',
  ]

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg">
      {/* Preset colour circles — visually a "palette" because of their variety of hues */}
      <div className="mb-2 flex items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/colour-palette.svg" alt="Colour palette" className="h-4 w-4 opacity-70" />
        <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">Colour Palette</p>
      </div>
      <div className="mb-4 grid grid-cols-11 gap-1.5">
        {presetColors.map((color, i) => (
          <button
            key={i}
            onClick={() => { setHexInput(color); onColorChange(color) }}
            className="h-5 w-5 rounded-full border-2 border-transparent transition-all hover:scale-110 hover:border-blue-400"
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* Bottom row: rounded-square swatch + hex input + rainbow picker */}
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-2.5 py-2">
        {/* Rounded square = current colour indicator (distinguishable from the circles above) */}
        <div
          className="h-8 w-8 shrink-0 rounded-[6px] border border-black/10 shadow-sm"
          style={{ backgroundColor: currentColor }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => {
            setHexInput(e.target.value)
            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) onColorChange(e.target.value)
          }}
          className="flex-1 font-mono text-[12px] text-gray-700 outline-none"
          placeholder="#000000"
        />
        {/* Gradient icon = custom colour picker trigger */}
        <label
          className="relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center transition-transform hover:scale-105"
          title="Open colour picker"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/colour-picker.svg" alt="Colour picker" className="h-6 w-6" />
          <input
            type="color"
            value={currentColor}
            onChange={(e) => { setHexInput(e.target.value); onColorChange(e.target.value) }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <button onClick={onClose} className="text-[16px] leading-none text-gray-400 hover:text-gray-600 transition-colors">×</button>
      </div>
    </div>
  )
}
