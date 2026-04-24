'use client'

import { Monitor, Smartphone, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEmailStore } from '@/lib/email/emailStore'

/**
 * EmailEditorPanel — three-panel email editor shell.
 *
 * Layout:
 *   Left  → Section structure tree (placeholder until Figma designs arrive)
 *   Centre → Live 600/375px iframe preview
 *   Right  → Block/section properties (placeholder until Figma designs arrive)
 *
 * Full block library, drag-to-reorder, and property panels will be wired in
 * once the Figma component designs are provided.
 */
export const EmailEditorPanel: React.FC = () => {
  const {
    document: doc,
    compiledHtml,
    compileErrors,
    previewMode,
    selectedSectionId,
    setPreviewMode,
    setSelectedSection,
    resetDocument,
  } = useEmailStore()

  const previewWidth = previewMode === 'desktop' ? 600 : 375

  return (
    <div className="absolute inset-0 flex overflow-hidden">

      {/* ── Left: Section structure tree ─────────────────── */}
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="flex h-10 items-center justify-between border-b border-gray-100 px-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Structure
          </span>
          <button
            onClick={resetDocument}
            title="Reset to default"
            className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <RotateCcw size={12} />
          </button>
        </div>

        <div className="flex-1 overflow-auto py-2">
          {doc.sections.map((section, i) => (
            <button
              key={section.id}
              onClick={() => setSelectedSection(section.id)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors',
                selectedSectionId === section.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50',
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-100 text-[10px] font-semibold text-gray-500">
                {i + 1}
              </span>
              <span className="truncate">{section.label ?? section.layout}</span>
            </button>
          ))}

          {/* Unsubscribe — always last, locked */}
          <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-gray-400">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-50 text-[10px] text-gray-400">
              🔒
            </span>
            <span className="truncate italic">Unsubscribe</span>
          </div>
        </div>
      </aside>

      {/* ── Centre: Live preview ──────────────────────────── */}
      <div className="relative flex flex-1 flex-col bg-[#F3F4F6]">

        {/* Toolbar strip */}
        <div className="flex h-10 items-center justify-between border-b border-gray-200 bg-white px-4">
          <span className="text-[11px] text-gray-400">
            {doc.subject || 'Untitled email'}
          </span>
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
            <button
              onClick={() => setPreviewMode('desktop')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors',
                previewMode === 'desktop' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
              )}
            >
              <Monitor size={12} />
              Desktop
            </button>
            <button
              onClick={() => setPreviewMode('mobile')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors',
                previewMode === 'mobile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
              )}
            >
              <Smartphone size={12} />
              Mobile
            </button>
          </div>
        </div>

        {/* Compile errors */}
        {compileErrors.length > 0 && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2">
            {compileErrors.map((e, i) => (
              <p key={i} className="text-[11px] text-red-600">⚠ {e}</p>
            ))}
          </div>
        )}

        {/* Preview iframe */}
        <div className="flex flex-1 items-start justify-center overflow-auto py-8">
          <div
            className="rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.1)] transition-all duration-300"
            style={{ width: previewWidth }}
          >
            {compiledHtml ? (
              <iframe
                title="Email Preview"
                srcDoc={compiledHtml}
                className="block w-full rounded-xl border-0 bg-white"
                style={{ minHeight: 480 }}
                onLoad={(e) => {
                  const h = e.currentTarget.contentDocument?.documentElement?.scrollHeight
                  if (h) e.currentTarget.style.height = `${h}px`
                }}
              />
            ) : (
              <div className="flex h-48 items-center justify-center rounded-xl bg-white text-[12px] text-gray-400">
                {compileErrors.length ? 'Fix errors to preview' : 'Compiling…'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: Properties panel ───────────────────────── */}
      <aside className="flex w-60 shrink-0 flex-col border-l border-gray-200 bg-white">
        <div className="flex h-10 items-center border-b border-gray-100 px-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Properties
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-center text-[11px] leading-relaxed text-gray-400">
            Select a section or block to edit its properties
          </p>
        </div>
      </aside>

    </div>
  )
}
