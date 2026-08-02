import { promises as fs } from 'fs';
import path from 'path';

/**
 * Social connector connections (.data/connections.json, gitignored).
 * LinkedIn carries real OAuth tokens when LINKEDIN_CLIENT_ID/SECRET are
 * configured; Instagram/YouTube are demo-grade until their platform app
 * reviews clear (real-API seams documented in the connector routes).
 */

export type ConnectorPlatform = 'linkedin' | 'instagram' | 'youtube';
export const CONNECTOR_PLATFORMS: ConnectorPlatform[] = ['linkedin', 'instagram', 'youtube'];

export interface Connection {
  platform: ConnectorPlatform;
  status: 'connected' | 'disconnected';
  /** 'oauth' = real tokens; 'demo' = simulated connection */
  kind: 'oauth' | 'demo' | null;
  accountName: string | null;
  connectedAt: string | null;
  tokens?: { access: string; refresh?: string; expiresAt?: string } | null;
}

const FILE = path.join(process.cwd(), '.data', 'connections.json');

async function readAll(): Promise<Connection[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8')) as Connection[];
  } catch {
    return [];
  }
}

async function writeAll(rows: Connection[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2), 'utf8');
}

export async function getConnection(platform: ConnectorPlatform): Promise<Connection> {
  const all = await readAll();
  return (
    all.find((c) => c.platform === platform) ?? {
      platform,
      status: 'disconnected',
      kind: null,
      accountName: null,
      connectedAt: null,
      tokens: null,
    }
  );
}

export async function listConnections(): Promise<Connection[]> {
  return Promise.all(CONNECTOR_PLATFORMS.map((p) => getConnection(p)));
}

export async function saveConnection(conn: Connection): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((c) => c.platform === conn.platform);
  if (idx === -1) all.push(conn);
  else all[idx] = conn;
  await writeAll(all);
}

export async function disconnect(platform: ConnectorPlatform): Promise<void> {
  await saveConnection({
    platform,
    status: 'disconnected',
    kind: null,
    accountName: null,
    connectedAt: null,
    tokens: null,
  });
}

/** Strip tokens for client responses. */
export function publicView(conn: Connection): Omit<Connection, 'tokens'> {
  const { tokens: _tokens, ...rest } = conn;
  return rest;
}
