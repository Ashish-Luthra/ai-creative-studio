'use client'

import { Layers, Library, Type, Circle, Sparkles, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCanvasStore } from '@/lib/canvas/canvasStore'
import { useState } from 'react'

type RailTool = 'layers' | 'assets' | 'text' | 'shapes' | 'generate' | 'settings'

interface RailButtonProps {
  icon: React.ReactNode
  id: RailTool
  title: string
  active: boolean
  onClick: (id: RailTool) => void
}

const RailButton: React.FC<RailButtonProps> = ({ icon, id, title, active, onClick }) => (
  <button
    title={title}
    onClick={() => onClick(id)}
    className={cn(
      'flex h-8 w-8 items-center justify-center rounded-[7px] transition-colors',
      active
        ? 'bg-blue-50 text-blue-600'
        : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
    )}
  >
    {icon}
  </button>
)

export const ToolbarLeft: React.FC = () => {
  const { mode } = useCanvasStore()
  const [activeTool, setActiveTool] = useState<RailTool>('layers')

  // Email mode shows different tools
  const canvasTools: { id: RailTool; icon: React.ReactNode; title: string }[] = [
    { id: 'layers',   icon: <Layers size={15} />,   title: 'Layers'   },
    { id: 'assets',   icon: <Library size={15} />,  title: 'Assets'   },
    { id: 'text',     icon: <Type size={15} />,     title: 'Text'     },
    { id: 'shapes',   icon: <Circle size={15} />,   title: 'Shapes'   },
    { id: 'generate', icon: <Sparkles size={15} />, title: 'Generate' },
  ]

  const emailTools: { id: RailTool; icon: React.ReactNode; title: string }[] = [
    { id: 'layers',   icon: <Layers size={15} />,   title: 'Sections' },
    { id: 'assets',   icon: <Library size={15} />,  title: 'Blocks'   },
    { id: 'text',     icon: <Type size={15} />,     title: 'Text'     },
    { id: 'shapes',   icon: <Circle size={15} />,   title: 'Image'    },
    { id: 'generate', icon: <Sparkles size={15} />, title: 'Button'   },
  ]

  const tools = mode === 'email' ? emailTools : canvasTools

  return (
    <aside className="flex w-12 shrink-0 flex-col items-center gap-0.5 border-r border-gray-200 bg-white py-2.5">
      {tools.map((tool, i) => (
        <div key={tool.id}>
          {/* Divider between layers/assets and text/shapes/generate */}
          {i === 2 && (
            <div className="my-1 h-px w-5 bg-gray-100" />
          )}
          <RailButton
            icon={tool.icon}
            id={tool.id}
            title={tool.title}
            active={activeTool === tool.id}
            onClick={setActiveTool}
          />
        </div>
      ))}

      {/* Spacer pushes settings to bottom */}
      <div className="flex-1" />

      <RailButton
        icon={<Settings size={15} />}
        id="settings"
        title="Settings"
        active={activeTool === 'settings'}
        onClick={setActiveTool}
      />
    </aside>
  )
}
