'use client'

import type { RailTool } from './ToolbarLeft'
import { CREATIVE_PRESETS } from '@studio/lib/canvas/presets'
import { RatioTile } from './RatioTile'

interface RightStudioPanelProps {
  activeTool: RailTool | null
  selectedPresetId: string
  onPresetChange: (presetId: string) => void
  onAddFrame: () => void
  onConvertToAll: () => void
  /** Render in-flow inside CanvasRightSidebar instead of floating. */
  embedded?: boolean
}

export const RightStudioPanel: React.FC<RightStudioPanelProps> = ({
  activeTool,
  selectedPresetId,
  onPresetChange,
  onAddFrame,
  onConvertToAll,
  embedded = false,
}) => {
  // Only render for tools that have actual content. Any other tool (frame,
  // shapes, image, text, projects, settings, cta) gets nothing — no empty pill.
  if (!embedded && activeTool !== 'layout' && activeTool !== 'hand') return null

  return (
    <aside className={embedded
      ? 'w-full bg-white px-3 py-1'
      : 'absolute right-5 top-20 z-50 w-72 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.10)] backdrop-blur-sm'}>
      {activeTool === 'layout' && (
        <>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Layout / Template</h3>
          <div className="space-y-2">
            {/* Compact ratio-tile grid — same look as the frame panel's Ad Specs. */}
            <div className="grid grid-cols-3 gap-2">
              {CREATIVE_PRESETS.map((preset) => (
                <RatioTile
                  key={preset.id}
                  width={preset.width}
                  height={preset.height}
                  label={preset.label}
                  selected={selectedPresetId === preset.id}
                  onClick={() => onPresetChange(preset.id)}
                />
              ))}
            </div>
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
