// Minimal stub of the magic-link contract on :58000 for browser verification.
// - POST /v1/auth/magic-link/request  -> 200 {status:"sent"}; emails the link via
//   SendGrid when SENDGRID_API_KEY + SENDGRID_FROM are set (in env or
//   apps/salesdemo-ui/.env.local), else logs it like ConsoleEmailSender
// - POST /v1/auth/magic-link/verify   -> 200 with unsigned JWT for issued or known
//   tokens, 400 codes otherwise
// - GET  /v1/me/workspace-setup       -> {completed:false} so the post-login popup shows
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Pick up SENDGRID_* / APP_URL from .env.local (gitignored) without a dotenv dep.
// Matches dotenv semantics: first occurrence wins, real env takes precedence.
try {
  for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
    const m = /^\s*(SENDGRID_API_KEY|SENDGRID_FROM|APP_URL)\s*=\s*(.+?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch {
  // no .env.local — console logging only
}
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const SENDGRID_FROM = process.env.SENDGRID_FROM || '';
const APP_URL = (process.env.APP_URL || 'http://localhost:3100').replace(/\/$/, '');
// Public-deploy hardening: ALLOWED_EMAILS="a@x.com,b@y.com" restricts who can
// request a magic link (unset = anyone, dev behavior). DISABLE_DEV_LOGIN=1
// turns off the one-click /dev/login backdoor.
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const DISABLE_DEV_LOGIN = process.env.DISABLE_DEV_LOGIN === '1';

// One-time magic tokens: token -> { email, expires } (15 min TTL).
const magicTokens = new Map();
const TOKEN_TTL_MS = 15 * 60 * 1000;

/** Real email via SendGrid v3. Returns true when accepted (2xx). */
async function sendMagicEmail(email, link) {
  if (!SENDGRID_API_KEY || !SENDGRID_FROM) return false;
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: SENDGRID_FROM, name: 'Allyvate' },
        subject: 'Your Allyvate login link',
        content: [
          {
            type: 'text/html',
            value:
              `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:440px;margin:0 auto;padding:32px 24px">` +
              `<h2 style="margin:0 0 8px;color:#0d1117">Log in to Allyvate</h2>` +
              `<p style="margin:0 0 20px;color:#4b5563;font-size:14px;line-height:1.6">Click the button below to sign in. This link works once and expires in 15 minutes.</p>` +
              `<a href="${link}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:10px">Sign in to Allyvate</a>` +
              `<p style="margin:24px 0 0;color:#9ca3af;font-size:12px;line-height:1.6">If you didn't request this, you can safely ignore this email.</p>` +
              `</div>`,
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.warn(`SendGrid rejected the send (HTTP ${res.status}): ${await res.text()}`);
    return res.ok;
  } catch (err) {
    console.warn('SendGrid send failed:', err.message || err);
    return false;
  }
}

const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
function mintJwt(sub) {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64u({ alg: 'none', typ: 'JWT' }),
    b64u({ sub, workspaceId: 'ws_dev', roles: ['admin'], iss: 'stub', iat: now, exp: now + 8 * 3600 }),
    'sig',
  ].join('.');
}

// In-memory: the one-time post-login popup completes once per stub run.
let workspaceSetup = { completed: false, profile: null };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,Idempotency-Key,X-Workspace-Id,X-Organization-Id',
};

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const json = (code, obj) => { res.writeHead(code, { ...CORS, 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    const url = req.url.split('?')[0];
    // Dev convenience: open http://localhost:58000/dev/login in a browser to
    // jump straight into the app (simulates clicking the emailed magic link).
    if (req.method === 'GET' && url === '/dev/login') {
      if (DISABLE_DEV_LOGIN) return json(404, { detail: { code: 'NOT_FOUND', message: 'Disabled in production.' } });
      res.writeHead(302, { ...CORS, Location: `${APP_URL}/auth/magic/callback?magicToken=good-token-123456` });
      return res.end();
    }
    if (req.method === 'POST' && url === '/v1/auth/magic-link/request') {
      const email = (JSON.parse(body || '{}').email || '').toLowerCase();
      if (!email || !email.includes('@')) {
        return json(400, { detail: { code: 'INVALID_EMAIL', message: 'Enter a valid email address.' } });
      }
      if (ALLOWED_EMAILS.length && !ALLOWED_EMAILS.includes(email)) {
        // Same response as success — don't leak which emails are allowed.
        console.log(`MAGIC LINK denied (not allowlisted): ${email}`);
        return json(200, { status: 'sent' });
      }
      const token = crypto.randomUUID();
      magicTokens.set(token, { email, expires: Date.now() + TOKEN_TTL_MS });
      const link = `${APP_URL}/auth/magic/callback?magicToken=${token}`;
      // Real send when SendGrid is configured; console fallback either way so
      // dev flows never dead-end on email deliverability.
      sendMagicEmail(email, link).then((sent) => {
        console.log(sent ? `MAGIC LINK emailed to ${email} via SendGrid` : `MAGIC LINK for ${email}: ${link}`);
      });
      return json(200, { status: 'sent' });
    }
    if (req.method === 'POST' && url === '/v1/auth/magic-link/verify') {
      const token = JSON.parse(body || '{}').token || '';
      const issued = magicTokens.get(token);
      if (issued) {
        magicTokens.delete(token); // one-time use
        if (issued.expires < Date.now()) {
          return json(400, { detail: { code: 'MAGIC_LINK_EXPIRED', message: 'This login link has expired. Request a new one.' } });
        }
        return json(200, { token: mintJwt(issued.email), userId: issued.email, email: issued.email, nextStep: 'workspace_home' });
      }
      if (token === 'good-token-123456' && !DISABLE_DEV_LOGIN) {
        return json(200, { token: mintJwt('magic@corp.com'), userId: 'magic@corp.com', email: 'magic@corp.com', nextStep: 'workspace_home' });
      }
      if (token === 'expired-token-1234567') {
        return json(400, { detail: { code: 'MAGIC_LINK_EXPIRED', message: 'This login link has expired. Request a new one.' } });
      }
      return json(400, { detail: { code: 'MAGIC_LINK_INVALID', message: 'This login link is invalid or was already used.' } });
    }
    if (req.method === 'GET' && url === '/v1/me/workspace-setup') {
      return json(200, workspaceSetup);
    }
    // Demo shell endpoints: empty-but-valid responses so pages render their
    // designed empty states instead of stub 404 errors.
    if (req.method === 'GET' && url === '/v1/workspaces') {
      return json(200, {
        items: [{ id: 'ws_dev', name: 'Development Workspace', edition: 'bfsi', defaultEnv: 'sandbox', createdAt: '2026-07-01T00:00:00Z' }],
        nextCursor: null,
        hasMore: false,
      });
    }
    if (req.method === 'GET' && /^\/v1\/workspaces\/[^/]+\/artifacts$/.test(url)) {
      return json(200, { items: [], nextCursor: null, hasMore: false });
    }
    // Authz lists for the workspace switcher dropdown.
    if (req.method === 'GET' && url === '/v1/authz/organizations') {
      return json(200, {
        items: [{ organizationId: 'org_dev', name: 'Allyvate', slug: 'allyvate', effectivePermission: 'admin' }],
      });
    }
    if (req.method === 'GET' && url === '/v1/authz/workspaces') {
      return json(200, {
        items: [
          {
            workspaceId: 'ws_dev',
            organizationId: 'org_dev',
            workspaceName: 'Development Workspace',
            slug: 'development',
            effectivePermission: 'admin',
          },
        ],
      });
    }
    // Admin workspace list used by Brand Center's workspace scoping.
    if (req.method === 'GET' && url === '/v1/admin/workspaces') {
      return json(200, {
        items: [
          {
            id: 'ws_dev',
            name: 'Development Workspace',
            edition: 'bfsi',
            defaultEnv: 'sandbox',
            createdAt: '2026-07-01T00:00:00Z',
            updatedAt: '2026-07-01T00:00:00Z',
          },
        ],
      });
    }
    // Seeded brand kit so the Brand Kits table + full kit drawer (sources,
    // extraction review, logos, guidelines, tokens, typography, preview, audit)
    // are demonstrable without the real backend.
    const demoKit = {
      id: 'bk_allyvate',
      name: 'Allyvate',
      version: '2',
      status: 'published',
      scope: 'workspace',
      lastUpdated: '2026-07-15T10:00:00Z',
      workspacesUsing: ['ws_dev'],
      owner: 'magic@corp.com',
      tokens: {
        colors: { primary: '#001B4A', accent: '#2563EB', surface: '#E0F2FE', success: '#10B981', warning: '#F97316', muted: '#F3F4F6' },
      },
      typography: {
        heading: { family: 'Poppins', weight: 700 },
        body: { family: 'Inter', weight: 400 },
      },
      components: null,
      notes: 'Seeded demo kit',
    };
    if (req.method === 'GET' && url === '/v1/admin/brand/brandkits') {
      return json(200, { items: [demoKit], nextCursor: null, hasMore: false });
    }
    if (req.method === 'GET' && /^\/v1\/admin\/brand\/brandkits\/[^/]+$/.test(url)) {
      return json(200, demoKit);
    }
    if (req.method === 'GET' && url.startsWith('/v1/brand/sources')) {
      return json(200, { items: [], nextCursor: null, hasMore: false });
    }
    if (req.method === 'GET' && url.startsWith('/v1/brand/extraction-jobs')) {
      return json(200, { items: [], nextCursor: null, hasMore: false });
    }
    if (req.method === 'GET' && url.startsWith('/v1/brand/guidelines')) {
      return json(200, { items: [], nextCursor: null, hasMore: false });
    }
    if (req.method === 'GET' && url.startsWith('/v1/admin/brand/')) {
      return json(200, { items: [], nextCursor: null, hasMore: false });
    }
    if (req.method === 'PUT' && url === '/v1/me/workspace-setup') {
      const b = JSON.parse(body || '{}');
      workspaceSetup = { completed: true, profile: { role: b.role, website: b.website || null, completedAt: new Date().toISOString() } };
      return json(200, workspaceSetup);
    }
    return json(404, { detail: { code: 'NOT_FOUND', message: `stub: no route ${req.method} ${url}` } });
  });
});
server.listen(58000, () => console.log('stub api on :58000'));
