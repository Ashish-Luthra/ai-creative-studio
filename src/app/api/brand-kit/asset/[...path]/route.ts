import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Serves brand-kit assets (screenshots, logos, self-hosted font files) written
 * to public/brand-kits/<domain>/... by the extraction pipeline at runtime.
 *
 * Next's production server (`next start`) resolves public/ against a manifest
 * built at process startup, so files written after boot 404 until the next
 * restart — verified directly against the deployed box. A route handler always
 * executes fresh against the filesystem, so assets are servable the moment
 * they're written, regardless of when the process last restarted.
 */

const ROOT = path.join(process.cwd(), 'public', 'brand-kits');

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const bad = !segments?.length || segments.some((s) => !s || s === '.' || s === '..' || /[/\\]/.test(s));
  if (bad) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const filePath = path.join(ROOT, ...segments);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
