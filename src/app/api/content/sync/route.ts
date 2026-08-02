import { NextResponse } from 'next/server';
import { getSyncState, startSync } from '../../../../lib/content-sync';
import { resolveDomain, resolveBrandName } from '../../../../lib/content-domain';

export const runtime = 'nodejs';
// Crawl runs in-process; keep the route alive long enough to kick off.
export const maxDuration = 30;

// POST /api/content/sync {domain?} — start a crawl (409 if one is running)
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { domain?: string };
  const domain = await resolveDomain(body.domain ?? null);
  if (!domain) {
    return NextResponse.json(
      { error: 'No domain — add a Brand Kit first (its domain is the crawl target)' },
      { status: 400 }
    );
  }
  const brandName = await resolveBrandName(domain);
  const result = startSync(domain, brandName);
  if (!result.started) return NextResponse.json({ error: result.reason }, { status: 409 });
  return NextResponse.json({ started: true, domain });
}

// GET /api/content/sync — progress for the banner / dialog log
export async function GET() {
  return NextResponse.json(getSyncState());
}
