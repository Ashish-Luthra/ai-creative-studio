'use client'

import { useMemo, useState } from 'react'

interface AIAssistPanelProps {
  selectedText: string | null
  onApplyCopy: (text: string) => void
  onSuggestLayout: () => void
}

function buildSuggestions(prompt: string, selectedText: string | null): string[] {
  const source = (prompt.trim() || selectedText || 'Create standout creative copy').trim()
  return [
    `${source} — Limited Time Offer`,
    `Why choose us: ${source}`,
    `${source} | Trusted by thousands`,
  ]
}

export const AIAssistPanel: React.FC<AIAssistPanelProps> = ({
  selectedText,
  onApplyCopy,
  onSuggestLayout,
}) => {
  const [prompt, setPrompt] = useState('')
  const [generated, setGenerated] = useState<string[]>([])

  const contextLabel = useMemo(
    () => (selectedText ? `Selected text: "${selectedText}"` : 'No text layer selected'),
    [selectedText]
  )

  return (
    <aside className="absolute right-5 top-20 z-50 w-80 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.10)] backdrop-blur-sm">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">AI Assist</h3>
      <p className="mb-3 text-sm text-gray-600">
        Generate copy options, apply to selected text, and suggest a quick layout adjustment.
      </p>

      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Prompt</label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. premium coffee launch for young professionals"
        className="mb-2 h-20 w-full resize-none rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-300"
      />
      <p className="mb-2 truncate text-xs text-gray-500">{contextLabel}</p>

      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setGenerated(buildSuggestions(prompt, selectedText))}
          className="flex-1 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white"
        >
          Generate Copy
        </button>
        <button
          onClick={onSuggestLayout}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700"
        >
          Suggest Layout
        </button>
      </div>

      <div className="max-h-72 space-y-2 overflow-auto pr-1">
        {generated.map((item) => (
          <div key={item} className="rounded-md border border-gray-200 p-2">
            <p className="mb-2 text-xs text-gray-700">{item}</p>
            <button
              onClick={() => onApplyCopy(item)}
              className="w-full rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white"
            >
              Apply to Text
            </button>
          </div>
        ))}
        {generated.length === 0 && (
          <div className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-500">
            Generate copy to see AI suggestions here.
          </div>
        )}
      </div>
    </aside>
  )
}
