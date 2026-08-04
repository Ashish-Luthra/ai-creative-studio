'use client'

import { useEffect, useState, type KeyboardEvent, type RefObject } from 'react'
import { ArrowUp, type LucideIcon } from 'lucide-react'
import { cn } from '@studio/lib/utils'
import { ROTATING_PLACEHOLDERS } from '@studio/lib/home/capabilities'

export interface PromptChip {
  id: string
  label: string
  icon: LucideIcon
  onClick: () => void
}

export interface HomePromptBoxProps {
  value: string
  onValueChange: (value: string) => void
  onSubmit: (value: string) => void
  /** Quick asset-type chips rendered in the composer's footer row. */
  chips: PromptChip[]
  /** Owned by the parent so capability cards can seed + focus it. */
  textareaRef: RefObject<HTMLTextAreaElement | null>
}

const ROTATE_MS = 3500

export const HomePromptBox: React.FC<HomePromptBoxProps> = ({
  value,
  onValueChange,
  onSubmit,
  chips,
  textareaRef,
}) => {
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const [focused, setFocused] = useState(false)

  // Rotate the placeholder only while the box sits idle — a moving prompt
  // under a focused cursor (or behind typed text) is just noise.
  const paused = focused || value.length > 0
  useEffect(() => {
    if (paused) return
    const timer = setInterval(
      () => setPlaceholderIdx((i) => (i + 1) % ROTATING_PLACEHOLDERS.length),
      ROTATE_MS
    )
    return () => clearInterval(timer)
  }, [paused])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed) onSubmit(trimmed)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  return (
    <div
      className={cn(
        'rounded-2xl border bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] transition-colors',
        focused ? 'border-gray-900' : 'border-gray-200'
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        rows={3}
        onChange={(e) => {
          onValueChange(e.target.value)
          autoGrow(e.target)
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={ROTATING_PLACEHOLDERS[placeholderIdx]}
        aria-label="Describe what you want to create"
        className="w-full resize-none bg-transparent px-4 pt-3.5 text-[13px] text-gray-900 outline-none placeholder:text-gray-400"
      />
      <div className="flex items-center gap-1.5 px-3 pb-2.5">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={chip.onClick}
            className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
          >
            <chip.icon size={12} strokeWidth={1.75} />
            {chip.label}
          </button>
        ))}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim()}
          aria-label="Send to the creative agent"
          className={cn(
            'ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors',
            value.trim() ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-400'
          )}
        >
          <ArrowUp size={13} />
        </button>
      </div>
    </div>
  )
}
