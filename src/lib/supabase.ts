import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser-safe client (anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-only client (service-role key bypasses RLS – only use in API routes)
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

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
