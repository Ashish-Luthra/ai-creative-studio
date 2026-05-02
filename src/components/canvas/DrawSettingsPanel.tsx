'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ColorSwatch } from '@/components/shared/TextStyleControls'

interface Props {
  color: string
  thickness: number
  onChange: (patch: { color?: string; thickness?: number }) => void
}

const Section: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({
  title, defaultOpen = true, children,
}) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700"
      >
        {title}
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  )
}

export const DrawSettingsPanel: React.FC<Props> = ({ color, thickness, onChange }) => (
  <aside className="absolute right-5 top-20 z-[60] w-72 rounded-2xl border border-gray-200 bg-white shadow-xl">
    <div className="px-4 py-2">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Pencil</h3>
      <Section title="Colour">
        <ColorSwatch label="" value={color} onChange={(v) => onChange({ color: v })} />
      </Section>
      <Section title="Thickness">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-gray-500">Stroke width</span>
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1">
            <input
              type="number" min={1} max={40} step={1}
              value={thickness}
              onChange={(e) => onChange({ thickness: Number(e.target.value) })}
              className="w-10 text-right text-[11px] text-gray-700 focus:outline-none"
            />
            <span className="text-[10px] text-gray-400">px</span>
          </div>
        </div>
      </Section>
    </div>
  </aside>
)
