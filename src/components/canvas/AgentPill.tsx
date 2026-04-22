'use client'

import { useState, useRef, type KeyboardEvent } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AgentPillProps {
  onSubmit?: (command: string) => void
  placeholder?: string
  className?: string
}

export const AgentPill: React.FC<AgentPillProps> = ({
  onSubmit,
  placeholder = 'Describe your creative…',
  className,
}) => {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit?.(trimmed)
    setValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      className={cn(
        // Spec: position fixed, bottom 24px, centered, pill shape
        'fixed bottom-6 left-1/2 -translate-x-1/2',
        'flex min-w-[440px] items-center gap-2.5 rounded-full',
        'border border-gray-300 bg-white px-4 py-2.5',
        'shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]',
        'z-[60]',
        className
      )}
    >
      {/* Agent icon */}
      <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] bg-gray-900">
        <span className="text-[10px] font-black text-white">✦</span>
      </div>

      {/* Text input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[13px] text-gray-900 placeholder:text-gray-400 outline-none"
      />

      {/* ⌘K hint */}
      <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
        ⌘K
      </kbd>

      {/* Send button */}
      <button
        onClick={handleSubmit}
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors',
          value.trim()
            ? 'bg-gray-900 text-white hover:bg-gray-700'
            : 'bg-gray-100 text-gray-400'
        )}
      >
        <ArrowUp size={13} />
      </button>
    </div>
  )
}
