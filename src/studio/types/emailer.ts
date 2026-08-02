/**
 * emailer.ts — persistence shape for saved email campaigns.
 *
 * Stored via the file-based local store (src/lib/local-store.ts). The
 * production path is Postgres (Neon) behind the Allyvate API layer — see the
 * AIDemoAgent monorepo ADR 0001 (one Postgres; no secondary databases).
 */

export interface EmailerRow {
  id: string
  name: string
  subject: string | null
  preheader: string | null
  blocks: unknown        // stored as JSON; cast to CanvasBlock[] on the client
  created_at: string
  updated_at: string
}

export type EmailerMeta = Omit<EmailerRow, 'blocks'>
