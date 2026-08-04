import { promises as fs } from 'fs';
import path from 'path';
import type { ContentItem, ContentStatus, ContentStoreFile } from './content-types';

/**
 * Content Engine persistence: one JSON file per domain under data/content/
 * (gitignored) — same pattern as brand-kit-store. Production storage for
 * retrieval is the Brain (Neon knowledge objects, pushed on approve); this
 * store is the curation surface of record for the demo app.
 */

const DATA_DIR = path.join(process.cwd(), 'data', 'content');

function fileFor(domain: string): string {
  const safe = domain.toLowerCase().replace(/[^a-z0-9.-]/g, '');
  if (!safe) throw new Error('Invalid domain');
  return path.join(DATA_DIR, `${safe}.json`);
}

export async function loadContentFile(domain: string): Promise<ContentStoreFile> {
  try {
    return JSON.parse(await fs.readFile(fileFor(domain), 'utf8')) as ContentStoreFile;
  } catch {
    return { domain, lastSyncAt: null, items: [] };
  }
}

export async function saveContentFile(file: ContentStoreFile): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(fileFor(file.domain), JSON.stringify(file, null, 2), 'utf8');
}

/** Domains that have a content file (usually just the brand-kit domain). */
export async function listContentDomains(): Promise<string[]> {
  try {
    const files = await fs.readdir(DATA_DIR);
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}

export async function listItems(domain: string, status?: ContentStatus): Promise<ContentItem[]> {
  const file = await loadContentFile(domain);
  const items = status ? file.items.filter((i) => i.status === status) : file.items;
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Documents the client added by hand (uploads + one-off URLs), which carry
 * their own trial allowance separate from the crawl. Archived items still
 * count — the quota is on what was ingested, not on what is currently shown.
 */
export async function countManualItems(domain: string): Promise<number> {
  const file = await loadContentFile(domain);
  return file.items.filter((i) => i.source === 'upload' || i.source === 'url').length;
}

export async function getItem(domain: string, id: string): Promise<ContentItem | null> {
  const file = await loadContentFile(domain);
  return file.items.find((i) => i.id === id) ?? null;
}

/** Insert new items or replace existing ones (matched by id). */
export async function upsertItems(domain: string, items: ContentItem[]): Promise<void> {
  const file = await loadContentFile(domain);
  const byId = new Map(file.items.map((i) => [i.id, i]));
  for (const item of items) byId.set(item.id, item);
  file.items = [...byId.values()];
  await saveContentFile(file);
}

export async function updateItem(
  domain: string,
  id: string,
  patch: Partial<ContentItem>
): Promise<ContentItem | null> {
  const file = await loadContentFile(domain);
  const idx = file.items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  file.items[idx] = { ...file.items[idx], ...patch, updatedAt: new Date().toISOString() };
  await saveContentFile(file);
  return file.items[idx];
}

export async function deleteItem(domain: string, id: string): Promise<boolean> {
  const file = await loadContentFile(domain);
  const before = file.items.length;
  file.items = file.items.filter((i) => i.id !== id);
  if (file.items.length === before) return false;
  await saveContentFile(file);
  return true;
}

export async function markSynced(domain: string): Promise<void> {
  const file = await loadContentFile(domain);
  file.lastSyncAt = new Date().toISOString();
  await saveContentFile(file);
}
