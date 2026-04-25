'use client'

import { type CSSProperties } from 'react'
import { ImageIcon, Scaling } from 'lucide-react'
import { CREATIVE_PRESETS } from '@/lib/canvas/presets'

interface ImageSelectionToolbarProps {
  position: { x: number; y: number }
  selectedPresetId: string
  onPresetChange: (presetId: string) => void
  onOpenMedia: () => void
  onConvertToAll: () => void
  onSaveCrop: () => void
  cropPending: boolean
}

export const ImageSelectionToolbar: React.FC<ImageSelectionToolbarProps> = ({
  position,
  selectedPresetId,
  onPresetChange,
  onOpenMedia,
  onConvertToAll,
  onSaveCrop,
  cropPending,
}) => {
  const style: CSSProperties = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    transform: 'translateY(-100%) translateY(-14px)',
    zIndex: 55,
  }

  return (
    <div style={style} className="flex items-center gap-2 rounded-[10px] border border-white/60 bg-white/80 px-2 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.10)] backdrop-blur-[12px]">
      <input
        placeholder="Prompt box (remix placeholder)"
        className="h-7 w-48 rounded-md border border-gray-200 px-2 text-xs text-gray-700 outline-none"
      />
      <button onClick={onOpenMedia} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700">
        <ImageIcon size={12} />
        Images
      </button>
      <div className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-1.5 py-1">
        <Scaling size={12} className="text-gray-500" />
        <select
          value={selectedPresetId}
          onChange={(e) => onPresetChange(e.target.value)}
          className="bg-transparent text-xs text-gray-700 outline-none"
        >
          {CREATIVE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>{preset.ratioLabel}</option>
          ))}
        </select>
      </div>
      <button onClick={onConvertToAll} className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700">
        Convert all
      </button>
      <button
        onClick={onSaveCrop}
        className="rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
      >
        {cropPending ? 'Save' : 'Saved'}
      </button>
    </div>
  )
}
