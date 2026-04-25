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
    <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4 shadow-lg">
      <div className="grid grid-cols-11 gap-1.5 mb-4">
        {presetColors.map((color, i) => (
          <button key={i} onClick={() => { setHexInput(color); onColorChange(color) }}
            className="w-5 h-5 rounded-full border-2 border-transparent hover:border-blue-400 transition-all"
            style={{ backgroundColor: color }} title={color}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-2">
        <div className="w-8 h-8 rounded-full border border-gray-300 shrink-0" style={{ backgroundColor: currentColor }} />
        <input type="text" value={hexInput}
          onChange={(e) => { setHexInput(e.target.value); if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) onColorChange(e.target.value) }}
          className="flex-1 text-sm font-mono outline-none" placeholder="#000000"
        />
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>
    </div>
  )
}
