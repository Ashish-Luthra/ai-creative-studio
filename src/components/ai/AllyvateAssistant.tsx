'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  X, Type, Image as ImageIcon, Smile,
  ChevronLeft, ChevronRight, Send, Sparkles, CornerDownLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { nanoid } from 'nanoid'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AllyContext = 'text' | 'image' | 'design'

interface Message {
  id: string
  from: 'user' | 'ally'
  body: string
  /** For text-context ally replies: 3 copy variants to choose from */
  variants?: string[]
  ts: string
}

// ─── Action menus ─────────────────────────────────────────────────────────────

const TEXT_ACTIONS = [
  { id: 'shorten',    label: 'Shorten',         prompt: 'shorten this text' },
  { id: 'formal',     label: 'More formal',      prompt: 'make this text more formal' },
  { id: 'informal',   label: 'More informal',    prompt: 'make this text more informal' },
  { id: 'variations', label: 'Variations',       prompt: 'give me 3 variations of this text' },
  { id: 'new',        label: 'Something new',    prompt: 'write something entirely new for this section' },
]

const IMAGE_ACTIONS = [
  { id: 'similar',  label: 'Similar',         prompt: 'create a similar image' },
  { id: 'refresh',  label: 'Refresh',         prompt: 'refresh this image with a new take' },
  { id: 'new',      label: 'Something new',   prompt: 'create something entirely new for this slot' },
]

const MOOD_ACTIONS = [
  { id: 'serious',      label: '🎯  Serious',       prompt: 'switch the mood of this design to serious' },
  { id: 'aspirational', label: '✨  Aspirational',  prompt: 'switch the mood of this design to aspirational' },
  { id: 'playful',      label: '🎉  Playful',       prompt: 'switch the mood of this design to playful' },
]

// ─── Mock copy variants ───────────────────────────────────────────────────────

const MOCK_TEXT_VARIANTS: string[][] = [
  [
    'Experience the moment — every sip tells a story worth sharing.',
    'Savour every drop. Life tastes better when shared.',
    'From the first sip to the last, make every moment count.',
  ],
  [
    'Join thousands who\'ve already made the switch.',
    'Be part of something bigger — your story starts here.',
    'Ready to level up? The community is waiting for you.',
  ],
  [
    'Less clutter. More clarity. Your brand, amplified.',
    'Simple, powerful, and built for creators like you.',
    'Everything you need — nothing you don\'t.',
  ],
]

let _variantIdx = 0
function nextMockVariants(): string[] {
  const v = MOCK_TEXT_VARIANTS[_variantIdx % MOCK_TEXT_VARIANTS.length]
  _variantIdx++
  return v
}

const MOCK_NON_TEXT_REPLY: Record<'image' | 'design', string> = {
  image:  'Here\'s a fresh image concept to try. Drop it onto the canvas to apply it.',
  design: 'I\'ve rethought the image and copy together to match your chosen mood. Apply it to the block when ready.',
}

// ─── Allyvate icon ────────────────────────────────────────────────────────────

function AllyvateIcon({ size = 20 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/allyvate-icon.svg"
      alt="Allyvate"
      width={size}
      height={size}
      style={{ display: 'block', borderRadius: '50%' }}
    />
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60)   return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

// ─── Variant card ─────────────────────────────────────────────────────────────

function VariantCard({
  text,
  index,
  onInsert,
}: {
  text: string
  index: number
  onInsert: (text: string) => void
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
          Variant {index + 1}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-gray-700">{text}</p>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => onInsert(text)}
          title="Insert this variant"
          className="flex items-center gap-1 rounded-lg border border-[#1B51B3]/30 bg-[#1B51B3]/8 px-2.5 py-1 text-[10px] font-semibold text-[#1B51B3] transition-colors hover:bg-[#1B51B3] hover:text-white"
        >
          <CornerDownLeft size={10} />
          Insert
        </button>
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AllyvateAssistantProps {
  visible: boolean
  context: AllyContext
  /** Viewport coords of the element that triggered the pill */
  anchorX: number
  anchorY: number
  onClose: () => void
  /** Called when user clicks Insert on a text variant */
  onInsert?: (text: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AllyvateAssistant({
  visible, context, anchorX, anchorY, onClose, onInsert,
}: AllyvateAssistantProps) {
  const [mode,            setMode]            = useState<'pill' | 'expanded'>('pill')
  const [activeCtx,       setActiveCtx]       = useState<AllyContext>(context)
  const [input,           setInput]           = useState('@Allyvate ')
  const [showActionMenu,  setShowActionMenu]  = useState(false)
  const [messages,        setMessages]        = useState<Message[]>([])
  const [isTyping,        setIsTyping]        = useState(false)

  const inputRef    = useRef<HTMLTextAreaElement>(null)
  const messagesEnd = useRef<HTMLDivElement>(null)

  // Reset on each new invocation
  useEffect(() => {
    if (visible) {
      setMode('pill')
      setActiveCtx(context)
      setInput('@Allyvate ')
      setMessages([])
      setIsTyping(false)
      setShowActionMenu(false)
    }
  }, [visible, context])

  // Auto-scroll
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const expand = (ctx: AllyContext) => {
    setActiveCtx(ctx)
    setMode('expanded')
    setTimeout(() => inputRef.current?.focus(), 80)
  }

  const handleActionSelect = (prompt: string) => {
    setShowActionMenu(false)
    // Fire immediately as if the user sent it
    sendMessage(`@Allyvate, ${prompt}`, activeCtx)
  }

  const sendMessage = (body: string, ctx: AllyContext) => {
    if (!body.trim() || body.trim() === '@Allyvate') return

    const userMsg: Message = { id: nanoid(), from: 'user', body, ts: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])
    setInput('@Allyvate ')
    setIsTyping(true)

    setTimeout(() => {
      setIsTyping(false)
      if (ctx === 'text') {
        setMessages((prev) => [
          ...prev,
          {
            id: nanoid(),
            from: 'ally',
            body: 'Here are 3 copy variants for you:',
            variants: nextMockVariants(),
            ts: new Date().toISOString(),
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: nanoid(),
            from: 'ally',
            body: MOCK_NON_TEXT_REPLY[ctx as 'image' | 'design'],
            ts: new Date().toISOString(),
          },
        ])
      }
    }, 1000)
  }

  const handleSend = () => {
    sendMessage(input.trim(), activeCtx)
  }

  if (!visible) return null

  // ── Pill ──────────────────────────────────────────────────────────────────
  if (mode === 'pill') {
    const pillTop  = Math.max(10, anchorY - 50)
    const pillLeft = anchorX

    return (
      <div
        className="fixed z-[90] flex items-center gap-1.5 rounded-full border border-[#1B51B3]/30 bg-white/95 px-3 py-1.5 shadow-xl backdrop-blur-sm"
        style={{ left: pillLeft, top: pillTop, transform: 'translateX(-50%)' }}
      >
        <button
          type="button"
          onClick={() => expand(activeCtx)}
          className="flex items-center gap-1.5"
        >
          <AllyvateIcon size={17} />
          <span className="text-[11px] font-semibold text-[#1B51B3] whitespace-nowrap">Ask Allyvate</span>
        </button>

        <div className="mx-1 h-3.5 w-px bg-gray-200" />

        <button type="button" onClick={() => expand('text')}   title="Edit text"   className="rounded p-0.5 text-gray-400 hover:text-[#1B51B3] transition-colors"><Type      size={12} /></button>
        <button type="button" onClick={() => expand('image')}  title="Edit image"  className="rounded p-0.5 text-gray-400 hover:text-[#1B51B3] transition-colors"><ImageIcon size={12} /></button>
        <button type="button" onClick={() => expand('design')} title="Switch mood" className="rounded p-0.5 text-gray-400 hover:text-[#1B51B3] transition-colors"><Smile     size={12} /></button>

        <button type="button" onClick={onClose} className="ml-0.5 rounded-full p-0.5 text-gray-300 hover:text-gray-500 transition-colors">
          <X size={10} />
        </button>
      </div>
    )
  }

  // ── Expanded card ─────────────────────────────────────────────────────────
  const actions  = activeCtx === 'text' ? TEXT_ACTIONS : activeCtx === 'image' ? IMAGE_ACTIONS : MOOD_ACTIONS
  const ctxLabel = activeCtx === 'text' ? 'Text' : activeCtx === 'image' ? 'Image' : 'Mood'

  return (
    <div className="fixed right-[320px] top-1/2 z-[90] flex w-[320px] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">

      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <AllyvateIcon size={20} />
          <span className="text-[13px] font-semibold text-gray-900">Allyvate</span>
          <span className="rounded-full bg-[#1B51B3]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#1B51B3]">
            {ctxLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMode('pill')} className="rounded p-1 text-gray-300 hover:text-gray-600 transition-colors" title="Collapse">
            <ChevronLeft size={13} />
          </button>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-300 hover:text-gray-600 transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── Context tabs ── */}
      <div className="flex shrink-0 gap-1.5 border-b border-gray-100 px-4 py-2">
        {(['text', 'image', 'design'] as AllyContext[]).map((ctx) => (
          <button
            key={ctx}
            type="button"
            onClick={() => { setActiveCtx(ctx); setInput('@Allyvate '); setShowActionMenu(false) }}
            className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors',
              activeCtx === ctx
                ? 'bg-[#1B51B3] text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-[#1B51B3]/10 hover:text-[#1B51B3]',
            )}
          >
            {ctx === 'text'   && <Type      size={9} />}
            {ctx === 'image'  && <ImageIcon size={9} />}
            {ctx === 'design' && <Smile     size={9} />}
            {ctx === 'text' ? 'Text' : ctx === 'image' ? 'Image' : 'Mood'}
          </button>
        ))}
      </div>

      {/* ── Messages ── */}
      <div className="min-h-[120px] max-h-[360px] flex-1 overflow-auto px-4 py-3 space-y-4">
        {messages.length === 0 && !isTyping && (
          <p className="mt-3 text-center text-[11px] text-gray-300">
            Choose a quick action or describe what you&apos;d like
          </p>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-2.5">
            <div className="shrink-0 mt-0.5">
              {msg.from === 'ally'
                ? <AllyvateIcon size={22} />
                : (
                  <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-gray-200 text-[9px] font-bold text-gray-600">
                    A
                  </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-semibold text-gray-800">
                  {msg.from === 'ally' ? 'Allyvate' : 'You'}
                </span>
                <span className="text-[9px] text-gray-300">{timeAgo(msg.ts)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-[11px] leading-relaxed text-gray-600">
                {msg.body}
              </p>
              {/* Variant cards */}
              {msg.variants && msg.variants.length > 0 && (
                <div className="mt-2 space-y-2">
                  {msg.variants.map((v, i) => (
                    <VariantCard
                      key={i}
                      text={v}
                      index={i}
                      onInsert={(text) => onInsert?.(text)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-2.5">
            <div className="shrink-0 mt-0.5"><AllyvateIcon size={22} /></div>
            <div className="flex items-center gap-1 pt-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-[#1B51B3]/40 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEnd} />
      </div>

      {/* ── Quick actions ── */}
      <div className="relative shrink-0 border-t border-gray-100 px-4 pt-2.5">
        <button
          type="button"
          onClick={() => setShowActionMenu((o) => !o)}
          className="flex items-center gap-1 text-[10px] font-semibold text-[#1B51B3] hover:text-[#153d8a] transition-colors"
        >
          <Sparkles size={10} />
          Quick actions
          <ChevronRight size={9} className={cn('transition-transform', showActionMenu && 'rotate-90')} />
        </button>

        {showActionMenu && (
          <div className="absolute bottom-full left-4 right-4 mb-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <p className="border-b border-gray-100 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-gray-400">
              {ctxLabel} actions
            </p>
            {actions.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => handleActionSelect(a.prompt)}
                className="flex w-full items-center px-3 py-2 text-left text-[12px] text-gray-700 transition-colors hover:bg-[#1B51B3]/8 hover:text-[#1B51B3]"
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Input ── */}
      <div className="shrink-0 px-4 pb-3 pt-2">
        <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-[#1B51B3]/40 focus-within:ring-1 focus-within:ring-[#1B51B3]/10 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            rows={2}
            placeholder="@Allyvate what would you like?"
            className="flex-1 resize-none bg-transparent text-[12px] leading-relaxed text-gray-700 placeholder:text-gray-300 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isTyping}
            className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1B51B3] text-white transition-colors hover:bg-[#153d8a] disabled:opacity-40"
          >
            <Send size={10} />
          </button>
        </div>
      </div>
    </div>
  )
}
