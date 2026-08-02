import { NextResponse } from 'next/server';
import { getItem, updateItem, deleteItem } from '../../../../lib/content-store';
import { resolveDomain } from '../../../../lib/content-domain';
import { contentPatchSchema } from '../../../../lib/content-types';
import { pushToBrain } from '../../../../lib/brain-push';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/content/[id]?domain= — edit metadata / change status.
// Approving triggers the Brain push (soft-fail; error stored on the item).
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const domain = await resolveDomain(searchParams.get('domain'));
  if (!domain) return NextResponse.json({ error: 'No content domain' }, { status: 400 });

  const parsed = contentPatchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid patch' }, { status: 400 });

  const prior = await getItem(domain, id);
  if (!prior) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let item = await updateItem(domain, id, parsed.data);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Newly approved (or explicit retry while approved & un-pushed) → Brain.
  const becameApproved = parsed.data.status === 'approved' && prior.status !== 'approved';
  const retryPush = searchParams.get('retryBrain') === '1' && item.status === 'approved' && !item.brainKoId;
  if (becameApproved || retryPush) {
    const result = await pushToBrain(item);
    item =
      (await updateItem(domain, id, {
        brainKoId: result.koId,
        brainPushError: result.ok ? (result.abstained ? 'Brain classifier abstained (not indexed)' : null) : result.error,
      })) ?? item;
  }

  return NextResponse.json({ item });
}

// DELETE /api/content/[id]?domain=
export async function DELETE(request: Request, { params }: Ctx) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const domain = await resolveDomain(searchParams.get('domain'));
  if (!domain) return NextResponse.json({ error: 'No content domain' }, { status: 400 });
  const deleted = await deleteItem(domain, id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
