'use client'

import type { RailTool } from './ToolbarLeft'
import { CREATIVE_PRESETS } from '@studio/lib/canvas/presets'

interface RightStudioPanelProps {
  activeTool: RailTool | null
  selectedPresetId: string
  onPresetChange: (presetId: string) => void
  onAddFrame: () => void
  onConvertToAll: () => void
}

export const RightStudioPanel: React.FC<RightStudioPanelProps> = ({
  activeTool,
  selectedPresetId,
  onPresetChange,
  onAddFrame,
  onConvertToAll,
}) => {
  // Only render for tools that have actual content. Any other tool (frame,
  // shapes, image, text, projects, settings, cta) gets nothing — no empty pill.
  if (activeTool !== 'layout' && activeTool !== 'hand') return null

  return (
    <aside className="absolute right-5 top-20 z-50 w-72 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.10)] backdrop-blur-sm">
      {activeTool === 'layout' && (
        <>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Layout / Template</h3>
          <div className="space-y-2">
            {CREATIVE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onPresetChange(preset.id)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                  selectedPresetId === preset.id ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700'
                }`}
              >
                <div className="font-medium">{preset.label}</div>
                <div className="text-xs text-gray-500">{preset.width} x {preset.height}</div>
              </button>
            ))}
            <button
              onClick={onAddFrame}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              <span className="font-medium">Add Frame (1:1)</span>
            </button>
            <button
              onClick={onConvertToAll}
              className="flex w-full items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-gray-400">
                <span className="h-1.5 w-1.5 rounded-full bg-transparent" />
              </span>
              <span className="font-medium">Replicate to all sizes</span>
            </button>
          </div>
        </>
      )}

      {activeTool === 'hand' && (
        <Placeholder
          title="Hand Move"
          text="Drag the image or frame to move the whole creative block. In Hand mode, any layer in the block drags the full creative."
        />
      )}
    </aside>
  )
}

const Placeholder: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <>
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
    <p className="text-sm text-gray-600">{text}</p>
  </>
)
