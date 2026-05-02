'use client'

import React, { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEmailStore } from '@/lib/email/emailStore'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface SendTestEmailPanelProps {
  onClose: () => void
  /** The compiled HTML to be sent (with font links). */
  previewSrcDoc: string
  /** The raw compiled HTML to be sent in the email body (smaller, no preview links). */
  compiledHtml: string
}

type SendState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

export const SendTestEmailPanel: React.FC<SendTestEmailPanelProps> = ({
  onClose,
  previewSrcDoc,
  compiledHtml,
}) => {
  const subject = useEmailStore((s) => s.document.subject ?? '')
  const updateSubject = useEmailStore((s) => s.updateSubject)

  const [to, setTo] = useState('')
  const [state, setState] = useState<SendState>({ kind: 'idle' })

  const subjectEmpty = subject.trim().length === 0
  const toValid = EMAIL_RE.test(to.trim())
  const canSend = !subjectEmpty && toValid && state.kind !== 'sending'

  const handleSend = async () => {
    if (!canSend) return
    setState({ kind: 'sending' })
    try {
      const res = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          html: compiledHtml,
        }),
      })
      const json = (await res.json()) as { data?: { ok?: boolean }; error?: string }
      if (!res.ok || !json.data?.ok) {
        setState({ kind: 'error', message: json.error ?? 'Failed to send' })
        return
      }
      setState({
        kind: 'success',
        message: 'Test email sent — check your inbox.',
      })
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      })
    }
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-[13px] font-semibold text-gray-800">Send test email</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {/* Phone-frame preview */}
        <div className="flex justify-center">
          <div className="w-[180px] aspect-[9/19] rounded-[24px] border-[6px] border-gray-800 overflow-hidden bg-white relative">
            {previewSrcDoc ? (
              <iframe
                title="Test email preview"
                srcDoc={previewSrcDoc}
                className="absolute left-0 top-0 border-0"
                style={{
                  width: '600px',
                  height: '1280px',
                  transform: 'scale(0.28)',
                  transformOrigin: 'top left',
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] text-gray-400">
                Compiling…
              </div>
            )}
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-700">
            Subject line
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => updateSubject(e.target.value)}
            placeholder="Enter a subject line…"
            className={cn(
              'w-full rounded-lg border px-3 py-2 text-[12px] text-gray-800 focus:outline-none focus:ring-2',
              subjectEmpty
                ? 'border-red-400 focus:ring-red-200'
                : 'border-gray-200 focus:ring-gray-300',
            )}
          />
          {subjectEmpty && (
            <p className="mt-1 text-[11px] text-red-500">
              Enter a subject line for your email
            </p>
          )}
        </div>

        {/* To */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-700">
            To
          </label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="you@example.com"
            className={cn(
              'w-full rounded-lg border px-3 py-2 text-[12px] text-gray-800 focus:outline-none focus:ring-2',
              to && !toValid
                ? 'border-red-400 focus:ring-red-200'
                : 'border-gray-200 focus:ring-gray-300',
            )}
          />
          {to && !toValid && (
            <p className="mt-1 text-[11px] text-red-500">
              Enter a valid email address
            </p>
          )}
        </div>

        {/* Inline status */}
        {state.kind === 'success' && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[11px] text-green-700">
            {state.message}
          </div>
        )}
        {state.kind === 'error' && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
            {state.message}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-gray-200 p-4">
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            'w-full rounded-lg px-3 py-2 text-[12px] font-medium transition-colors',
            canSend
              ? 'bg-gray-900 text-white hover:bg-gray-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed',
          )}
        >
          {state.kind === 'sending' ? 'Sending…' : 'Send test email'}
        </button>
      </div>
    </div>
  )
}
