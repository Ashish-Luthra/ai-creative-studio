import type { ContentItem } from './content-types';

/**
 * Push an approved Content Engine item into the Brain (brain-api /ingest →
 * classify → edges → entity resolution → knowledge object + embedding in
 * Neon). Soft-fail by design: curation must never block on Brain
 * availability; callers store the error and offer retry.
 *
 * Env (in .env.local / box): BRAIN_API_URL (default https://api.allyvate.ai),
 * BRAIN_API_TOKEN, BRAIN_TENANT_ID (uuid of the pilot tenant).
 */

export interface BrainPushResult {
  ok: boolean;
  koId: string | null;
  /** classifier judged it not a knowledge object — a valid outcome, not an error */
  abstained: boolean;
  error: string | null;
}

export function brainConfigured(): boolean {
  return Boolean(process.env.BRAIN_API_TOKEN && process.env.BRAIN_TENANT_ID);
}

export async function pushToBrain(item: ContentItem): Promise<BrainPushResult> {
  if (!brainConfigured()) {
    return { ok: false, koId: null, abstained: false, error: 'Brain not configured (BRAIN_API_TOKEN / BRAIN_TENANT_ID missing)' };
  }
  const base = (process.env.BRAIN_API_URL || 'https://api.allyvate.ai').replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.BRAIN_API_TOKEN}`,
      },
      body: JSON.stringify({
        tenantId: process.env.BRAIN_TENANT_ID,
        title: item.title,
        source: item.url,
        approval: 'approved', // curation already happened in the Content Engine
        text:
          `# ${item.title}\n\n` +
          `Category: ${item.category}\nTags: ${item.tags.join(', ')}\n` +
          `When to use: ${item.referenceDescription}\n\n${item.fullText || item.excerpt}`,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const body = (await res.json().catch(() => ({}))) as {
      knowledgeObjectId?: string | null;
      abstained?: boolean;
      error?: unknown;
    };
    if (!res.ok) {
      return { ok: false, koId: null, abstained: false, error: `brain-api ${res.status}: ${JSON.stringify(body.error ?? body).slice(0, 200)}` };
    }
    return { ok: true, koId: body.knowledgeObjectId ?? null, abstained: Boolean(body.abstained), error: null };
  } catch (err) {
    return { ok: false, koId: null, abstained: false, error: err instanceof Error ? err.message : String(err) };
  }
}
