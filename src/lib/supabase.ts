import { createClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmailerRow {
  id: string
  name: string
  subject: string | null
  blocks: unknown        // stored as JSONB; cast to CanvasBlock[] on the client
  created_at: string
  updated_at: string
}

export type EmailerMeta = Omit<EmailerRow, 'blocks'>

// ── Supabase configured? ──────────────────────────────────────────────────────
// When NEXT_PUBLIC_SUPABASE_URL is empty (local dev without Supabase) we must
// NOT call createClient — it throws synchronously and crashes every API route.

export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http')
  )
}

// Browser-safe client (anon key) — returns null when not configured
export function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// Server-only client (service-role key bypasses RLS — only use in API routes)
// Returns null when Supabase is not configured so callers can fall back to local store.
export function createServiceClient() {
  if (!isSupabaseConfigured()) return null
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Legacy export — kept for any code that imported `supabase` directly.
// Will be null in local dev; callers should prefer getSupabaseClient().
export const supabase = isSupabaseConfigured()
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  : null
