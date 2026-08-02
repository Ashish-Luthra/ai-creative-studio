'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { AllyvateIcon } from './AllyvateAssistant'

/**
 * BriefChatPanel — the agentic brief conversation, docked on the right of the
 * canvas. Talks to POST /api/studio/brief; when the agent returns creative
 * specs, the host (CanvasEditor) tiles them onto the canvas.
 */

export interface BriefSpecClient {
  presetId: string
  headline: string
  subhead?: string
  ctaLabel?: string
  /** How the frame is filled; 'image' is opt-in and needs a usable imageSrc. */
  background?: 'image' | 'solid' | 'gradient'
  /** null when the creative is brand-color rather than photographic. */
  imageSrc: string | null
  gradientFrom?: string
  gradientTo?: string
  /** Brand wordmark variant chosen for this creative's background. */
  logoUrl?: string | null
  accentColor?: string
  rationale?: string
  style: {
    textColor: string
    scrimFrom: string
    scrimTo: string
    frameColor: string
    fontFamily: string
    fontPx: number
    fontWeight: number
    ctaBg?: string
    ctaColor?: string
  }
}

interface ChatMsg {
  from: 'user' | 'agent'
  body: string
}

export function BriefChatPanel({
  visible,
  seedMessage,
  domain,
  onClose,
  onSpecs,
}: {
  visible: boolean
  /**
   * First user message (from the AgentPill), sent automatically on open.
   * Carries an `id` so a SECOND submit while the panel is already open still
   * sends — keying off the text alone meant repeat submits were swallowed.
   */
  seedMessage?: { id: string; text: string }
  /** Content domain, so the agent grounds in the right brand kit + corpus. */
  domain?: string | null
  onClose: () => void
  onSpecs: (specs: BriefSpecClient[], reply: string) => void
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const seededRef = useRef<string | null>(null)
  // Mirrors `messages` so the seed effect can append to the live transcript
  // without listing it as a dependency (which would re-fire the seed).
  const messagesRef = useRef<ChatMsg[]>([])
  messagesRef.current = messages

  useEffect(() => {
    if (!visible) {
      seededRef.current = null
      setMessages([])
      setInput('')
      setBusy(false)
      return
    }
    if (seedMessage && seededRef.current !== seedMessage.id) {
      seededRef.current = seedMessage.id
      void send(seedMessage.text, messagesRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, seedMessage])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, busy])

  async function send(text: string, history: ChatMsg[]) {
    const nextMsgs: ChatMsg[] = [...history, { from: 'user' as const, body: text }]
    setMessages(nextMsgs)
    setBusy(true)
    try {
      const res = await fetch('/api/studio/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMsgs.map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.body })),
          // The route has always accepted this and the client never sent it,
          // so the agent silently grounded in whichever domain synced last.
          ...(domain ? { domain } : {}),
        }),
      })
      const body = (await res.json()) as {
        kind?: 'message' | 'specs'
        reply?: string
        specs?: BriefSpecClient[]
        error?: string
      }
      if (!res.ok) {
        setMessages((m) => [...m, { from: 'agent', body: body.error ?? 'Something went wrong — try again.' }])
        return
      }
      const reply = body.reply ?? ''
      setMessages((m) => [...m, { from: 'agent', body: reply }])
      if (body.kind === 'specs' && body.specs?.length) {
        onSpecs(body.specs, reply)
      }
    } catch {
      setMessages((m) => [...m, { from: 'agent', body: 'Network error — try again.' }])
    } finally {
      setBusy(false)
    }
  }

  if (!visible) return null

  return (
    <aside className="absolute right-5 top-20 z-[90] flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
      <div className="flex items-center gap-2 border-b border-gray-100 px-3.5 py-2.5">
        <AllyvateIcon size={18} />
        <span className="text-[13px] font-semibold text-gray-900">Creative brief</span>
        <span className="flex-1" />
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
          <X size={15} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3">
        {messages.length === 0 && !busy && (
          <p className="text-[12px] leading-relaxed text-gray-500">
            Describe the campaign — audience, channel, angle. I&apos;ll design on-brand options from your Brand Kit and
            approved content.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[92%] rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${
              m.from === 'user' ? 'ml-auto bg-[#1E1B4B] text-white' : 'bg-gray-100 text-gray-800'
            }`}
          >
            {m.body}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2.5 text-[12px] text-gray-500">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:240ms]" />
            <span className="ml-1">designing…</span>
          </div>
        )}
      </div>

      <form
        className="flex gap-2 border-t border-gray-100 p-2.5"
        onSubmit={(e) => {
          e.preventDefault()
          const text = input.trim()
          if (!text || busy) return
          setInput('')
          void send(text, messages)
        }}
      >
        <input
          className="h-9 flex-1 rounded-lg border border-gray-200 px-3 text-[12.5px] outline-none focus:border-[#2563EB]"
          placeholder={busy ? 'Working…' : 'Reply…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="h-9 rounded-lg bg-[#1E1B4B] px-3 text-[12.5px] font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </aside>
  )
}
