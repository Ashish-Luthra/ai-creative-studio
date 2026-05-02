'use client'

import { Copy, Frame, Grid2X2, Image as ImageIcon, MousePointer2, Pencil, Shapes, Type } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RailTool } from './ToolbarLeft'

interface ToolDef {
  id: RailTool
  icon: React.ReactNode
  label: string
}

const TOOLS: ToolDef[] = [
  { id: 'hand',   icon: <MousePointer2 size={18} />, label: 'Cursor' },
  { id: 'layout', icon: <Grid2X2 size={18} />,       label: 'Grid'   },
  { id: 'frame',  icon: <Frame size={18} />,         label: 'Frame'  },
  { id: 'shapes', icon: <Shapes size={18} />,        label: 'Shapes' },
  { id: 'image',  icon: <ImageIcon size={18} />,     label: 'Image'  },
  { id: 'text',   icon: <Type size={18} />,          label: 'Text'   },
  { id: 'draw',   icon: <Pencil size={18} />,        label: 'Draw'   },
]

interface Props {
  activeTool: RailTool | null
  onToolAction: (tool: RailTool) => void
  onReplicateAll: () => void
}

export const CanvasFloatingToolbar: React.FC<Props> = ({ activeTool, onToolAction, onReplicateAll }) => (
  <div className="pointer-events-auto absolute left-1/2 top-4 z-40 -translate-x-1/2">
    <div className="flex items-end gap-1 rounded-2xl border border-gray-200 bg-white/95 px-2 py-2 shadow-[0_6px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm">
      {TOOLS.map((tool) => {
        const active = activeTool === tool.id
        return (
          <button
            key={tool.id}
            onClick={() => onToolAction(tool.id)}
            title={tool.label}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 transition-colors',
              active
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            )}
          >
            {tool.icon}
            <span className="text-[10px] font-medium leading-none">{tool.label}</span>
          </button>
        )
      })}

      <div className="mx-1 h-9 w-px self-center bg-gray-200" />

      <button
        onClick={onReplicateAll}
        title="Replicate to all sizes"
        className="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <Copy size={18} />
        <span className="text-[10px] font-medium leading-none">Replicate All</span>
      </button>
    </div>
  </div>
)
