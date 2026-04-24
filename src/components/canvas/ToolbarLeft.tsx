'use client'

import { Folder, Grid2X2, Image, Type, MousePointer2, Palette, Sparkles, Shuffle, Smartphone, Upload, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export type RailTool =
  | 'projects'
  | 'layout'
  | 'media'
  | 'copy'
  | 'cta'
  | 'style'
  | 'ai'
  | 'variants'
  | 'preview'
  | 'export'
  | 'settings'

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

interface ToolbarLeftProps {
  onToolAction?: (tool: RailTool) => void
}

export const ToolbarLeft: React.FC<ToolbarLeftProps> = ({ onToolAction }) => {
  const [activeTool, setActiveTool] = useState<RailTool>('projects')

  const tools: { id: RailTool; icon: React.ReactNode; title: string }[] = [
    { id: 'projects', icon: <Folder size={15} />, title: 'Projects / Assets' },
    { id: 'layout', icon: <Grid2X2 size={15} />, title: 'Layout / Template' },
    { id: 'media', icon: <Image size={15} />, title: 'Media' },
    { id: 'copy', icon: <Type size={15} />, title: 'Copy' },
    { id: 'cta', icon: <MousePointer2 size={15} />, title: 'CTA / Action' },
    { id: 'style', icon: <Palette size={15} />, title: 'Style / Brand' },
    { id: 'ai', icon: <Sparkles size={15} />, title: 'AI Assist' },
    { id: 'variants', icon: <Shuffle size={15} />, title: 'Variants' },
    { id: 'preview', icon: <Smartphone size={15} />, title: 'Preview' },
    { id: 'export', icon: <Upload size={15} />, title: 'Export / Publish' },
  ]

  const handleToolClick = (tool: RailTool) => {
    setActiveTool(tool)
    onToolAction?.(tool)
  }

  return (
    <aside className="flex w-12 shrink-0 flex-col items-center gap-0.5 border-r border-gray-200 bg-white py-2.5">
      {tools.map((tool, i) => (
        <div key={tool.id}>
          {i === 2 || i === 6 ? (
            <div className="my-1 h-px w-5 bg-gray-100" />
          ) : null}
          <RailButton
            icon={tool.icon}
            id={tool.id}
            title={tool.title}
            active={activeTool === tool.id}
            onClick={handleToolClick}
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
        onClick={handleToolClick}
      />
    </aside>
  )
}
