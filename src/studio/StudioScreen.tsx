'use client'

/**
 * StudioScreen — mounts the full Creative Studio (ported from
 * Ashish-Luthra/ai-creative-studio) inside the salesdemo-ui shell.
 *
 * The sidebar's Creative Studio sub-items deep-link to /studio/<mode>; this
 * wrapper maps the URL segment onto the studio's canvasStore mode so both
 * navigations stay in sync. The studio's own internal rail keeps working —
 * it drives the same store.
 */
import { useEffect, useState } from 'react'
import { CanvasEditorClient } from '@studio/components/canvas/CanvasEditorClient'
import { useCanvasStore, type CanvasMode } from '@studio/lib/canvas/canvasStore'
import { getGoogleFontStylesheetHrefs } from '@studio/lib/canvas/googleFonts'

interface KitFontFace {
  family: string
  weight: number
  style?: string
  file: string
  format?: string
}

/** URL segment ↔ studio mode. Segments mirror the approved mockup nav. */
export const STUDIO_MODES: Record<string, CanvasMode> = {
  ads: 'canvas',
  email: 'email',
  'landing-pages': 'landing-page',
  'case-studies': 'case-study',
  assets: 'assets',
}

export function StudioScreen({ mode }: { mode?: string }) {
  const setMode = useCanvasStore((s) => s.setMode)
  const [brandCss, setBrandCss] = useState('')

  useEffect(() => {
    const target = STUDIO_MODES[mode ?? 'ads']
    if (target) setMode(target)
  }, [mode, setMode])

  // Brand kit fonts: Fabric renders text to <canvas>, which never triggers
  // lazy font loading — inject @font-face for the kit's self-hosted files and
  // pre-load them so agent-generated creatives render in the real typeface.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/brand-kit')
        if (!res.ok) return
        const body = (await res.json()) as { items?: Array<{ deep?: { fontFaces?: KitFontFace[] } }> }
        const faces = body.items?.flatMap((k) => k.deep?.fontFaces ?? []) ?? []
        if (cancelled || faces.length === 0) return
        const css = faces
          .map(
            (f) =>
              `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:${f.style ?? 'normal'};` +
              `src:url('${f.file}') format('${f.format ?? 'woff2'}');font-display:swap;}`
          )
          .join('\n')
        setBrandCss(css)
        await Promise.allSettled(faces.map((f) => document.fonts.load(`${f.weight} 16px '${f.family}'`)))
      } catch {
        /* kit fonts are progressive enhancement */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex-1 min-h-0 relative">
      {/* Fabric renders text to <canvas>, which never triggers Google Fonts'
          lazy loading — the stylesheets must be present on the page. */}
      {getGoogleFontStylesheetHrefs().map((href) => (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link key={href} rel="stylesheet" href={href} />
      ))}
      {brandCss && <style dangerouslySetInnerHTML={{ __html: brandCss }} />}
      <CanvasEditorClient briefId="dev-session" />
    </div>
  )
}
