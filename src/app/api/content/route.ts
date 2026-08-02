import { NextResponse } from 'next/server';
import { listItems } from '../../../lib/content-store';
import { resolveDomain } from '../../../lib/content-domain';
import type { ContentStatus } from '../../../lib/content-types';
import { CONTENT_STATUSES } from '../../../lib/content-types';

export const runtime = 'nodejs';

// GET /api/content?domain=&status= — list items (agent consumption: status=approved)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = await resolveDomain(searchParams.get('domain'));
  if (!domain) return NextResponse.json({ domain: null, items: [] });
  const statusParam = searchParams.get('status');
  const status = CONTENT_STATUSES.includes(statusParam as ContentStatus)
    ? (statusParam as ContentStatus)
    : undefined;
  const items = await listItems(domain, status);
  return NextResponse.json({ domain, items });
}
