import { NextResponse } from 'next/server';
import { addSingleItem } from '../../../../lib/content-add';
import { resolveDomain, resolveBrandName } from '../../../../lib/content-domain';
import { manualDocQuota } from '../../../../lib/content-limits';
import { countManualItems } from '../../../../lib/content-store';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/content/upload (multipart: file) — PDF text extraction + classify
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file' }, { status: 400 });
  if (file.size > 15_000_000) return NextResponse.json({ error: 'File too large (15MB max)' }, { status: 413 });

  const domain = await resolveDomain((form?.get('domain') as string) ?? null);
  if (!domain) return NextResponse.json({ error: 'No content domain — add a Brand Kit first' }, { status: 400 });

  // Checked before parsing: no point spending a PDF parse + a Claude classify
  // call on a document that can't be stored.
  const quota = manualDocQuota(await countManualItems(domain));
  if (quota.exceeded) {
    return NextResponse.json(
      { error: `Trial limit reached — ${quota.limit} manually added documents. Remove one, or upgrade for unlimited.` },
      { status: 409 }
    );
  }

  let text = '';
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    try {
      // pdf-parse is CJS; import the lib entry to avoid its index.js debug harness.
      const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
      const parsed = await pdfParse(Buffer.from(await file.arrayBuffer()));
      text = parsed.text.replace(/\s+/g, ' ').trim();
    } catch (err) {
      return NextResponse.json(
        { error: `Could not read PDF: ${err instanceof Error ? err.message : 'parse failed'}` },
        { status: 422 }
      );
    }
  } else {
    text = (await file.text()).replace(/\s+/g, ' ').trim();
  }
  if (text.length < 80) {
    return NextResponse.json({ error: 'No readable text found in the file' }, { status: 422 });
  }

  const item = await addSingleItem({
    domain,
    brandName: await resolveBrandName(domain),
    url: `upload://${file.name}`,
    title: file.name.replace(/\.[a-z0-9]+$/i, ''),
    metaDescription: '',
    text,
    source: 'upload',
    addedBy: 'Ashish L',
  });
  return NextResponse.json({ item }, { status: 201 });
}
