import { NextResponse } from 'next/server';
import { fetchPage } from '../../../../lib/content-crawl';
import { addSingleItem } from '../../../../lib/content-add';
import { resolveDomain, resolveBrandName } from '../../../../lib/content-domain';
import { manualDocQuota } from '../../../../lib/content-limits';
import { countManualItems } from '../../../../lib/content-store';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/content/add-url {url, domain?} — fetch + classify a single page
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { url?: string; domain?: string };
  const url = (body.url ?? '').trim();
  if (!/^https?:\/\/.+\..+/.test(url)) {
    return NextResponse.json({ error: 'Enter a full URL, e.g. https://yourbrand.com/blog/post' }, { status: 400 });
  }
  const domain = await resolveDomain(body.domain ?? null);
  if (!domain) return NextResponse.json({ error: 'No content domain — add a Brand Kit first' }, { status: 400 });

  const quota = manualDocQuota(await countManualItems(domain));
  if (quota.exceeded) {
    return NextResponse.json(
      { error: `Trial limit reached — ${quota.limit} manually added documents. Remove one, or upgrade for unlimited.` },
      { status: 409 }
    );
  }

  let page = await fetchPage(url);
  if (page?.thin) {
    try {
      const { renderPageText } = await import('../../../../lib/extraction/render');
      const rendered = await renderPageText(url);
      if (rendered.text.length > page.text.length) {
        page = { ...page, title: page.title || rendered.title, text: rendered.text, thin: false };
      }
    } catch {
      /* fall through with what we have */
    }
  }
  if (!page || page.text.length < 80) {
    return NextResponse.json({ error: 'Could not extract readable content from that URL' }, { status: 422 });
  }

  const item = await addSingleItem({
    domain,
    brandName: await resolveBrandName(domain),
    url,
    title: page.title,
    metaDescription: page.metaDescription,
    text: page.text,
    source: 'url',
    addedBy: 'Manual add',
    pageImageUrls: [page.ogImageUrl, ...page.heroImageUrls].filter((u): u is string => Boolean(u)),
  });
  return NextResponse.json({ item }, { status: 201 });
}
