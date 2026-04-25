'use client'

import type { RailTool } from './ToolbarLeft'
import { CREATIVE_PRESETS } from '@/lib/canvas/presets'

interface RightStudioPanelProps {
  activeTool: RailTool | null
  selectedPresetId: string
  onPresetChange: (presetId: string) => void
  onAddText: () => void
  onAddShape: () => void
  onOpenMedia: () => void
}

export const RightStudioPanel: React.FC<RightStudioPanelProps> = ({
  activeTool,
  selectedPresetId,
  onPresetChange,
  onAddText,
  onAddShape,
  onOpenMedia,
}) => {
  if (!activeTool || activeTool === 'projects' || activeTool === 'settings') return null

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
          </div>
        </>
      )}

      {activeTool === 'media' && (
        <>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Media</h3>
          <p className="mb-3 text-sm text-gray-600">Open approved images and replace the selected creative image.</p>
          <button onClick={onOpenMedia} className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white">
            Open Approved Images
          </button>
        </>
      )}

      {activeTool === 'copy' && (
        <>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Copy</h3>
          <p className="mb-3 text-sm text-gray-600">Add headline/subtext layers and edit them inline on canvas.</p>
          <button onClick={onAddText} className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">
            Add Text Layer
          </button>
        </>
      )}

      {activeTool === 'hand' && (
        <Placeholder
          title="Hand Move"
          text="Drag the image or frame to move the whole creative block. In Hand mode, any layer in the block drags the full creative."
        />
      )}
      {activeTool === 'cta' && <Placeholder title="CTA / Action" text="Separate CTA controls are planned for a later phase." />}
      {activeTool === 'style' && <Placeholder title="Style / Brand" text="Brand style automation is deferred; text styling works in the floating toolbar." />}
      {activeTool === 'ai' && <Placeholder title="AI Assist" text="AI generation tools are intentionally deferred in Phase 1." />}
      {activeTool === 'variants' && (
        <>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Variants</h3>
          <p className="text-sm text-gray-600">Use this tab to generate and compare variants from current creative state.</p>
        </>
      )}
      {activeTool === 'preview' && (
        <>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Preview</h3>
          <p className="mb-3 text-sm text-gray-600">Use Layout presets to preview LinkedIn/Instagram output ratios.</p>
          <button onClick={onAddShape} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">
            Add Shape Overlay
          </button>
        </>
      )}
      {activeTool === 'export' && <Placeholder title="Export / Publish" text="Use the top-right Export button to download a PNG asset." />}
    </aside>
  )
}

const Placeholder: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <>
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
    <p className="text-sm text-gray-600">{text}</p>
  </>
)
