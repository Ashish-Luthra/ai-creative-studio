# Deploying the SalesDemo Agent — salesdemo.allyvate.ai

Runs on the existing Allyvate EC2 box (`52.0.159.200`, us-east-1, instance `i-08f5f11f0e0cef60b`) next to the
Brain API. Vercel is NOT an option for this app: the extraction pipeline runs
Playwright/Chromium in a Next route and writes kits/screenshots/fonts to disk
at runtime (`data/brand-kits/`, `public/brand-kits/`), which needs a persistent
filesystem and a long-lived Node process.

## Topology

| URL | Where |
|---|---|
| `https://salesdemo.allyvate.ai` | Caddy → Next `next start` on `:3100` |
| same host, `/v1/*` + `/dev/*` | Caddy → stub API on `:58000` (same-origin, no CORS) |

The app is built with `NEXT_PUBLIC_API_BASE_URL=https://salesdemo.allyvate.ai`
so browser API calls stay same-origin. The checkout lives at
`/home/ec2-user/salesdemo` — a **git worktree** of the existing
`/home/ec2-user/AIDemoAgent` clone, so the Brain API's `main` checkout is
untouched.

## One-time setup

1. **DNS (Namecheap):** add `salesdemo` → **A** `52.0.159.200`.
2. **Worktree on the box:**
   ```bash
   cd /home/ec2-user/AIDemoAgent && git fetch origin \
     && git worktree add /home/ec2-user/salesdemo origin/feat/salesdemo-ui
   ```
3. **Secrets:** copy the gitignored env file from the dev machine:
   ```bash
   scp apps/salesdemo-ui/.env.local ec2-user@52.0.159.200:/home/ec2-user/salesdemo/apps/salesdemo-ui/.env.local
   ```
   Needs `ANTHROPIC_API_KEY` (kit voice/labeling + content classify + agentic
   brief), `SENDGRID_API_KEY` + `SENDGRID_FROM` (magic-link email).
   Optional integrations:
   - `BRAIN_API_URL` (default https://api.allyvate.ai), `BRAIN_API_TOKEN`,
     `BRAIN_TENANT_ID` — push approved Content Engine items into the Brain as
     knowledge objects. Without them, approvals soft-fail the push (retry chip).
   - `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` — real LinkedIn OAuth +
     image-post publishing from the Studio. Without them, LinkedIn runs in
     demo/dry-run mode (Instagram/YouTube are demo-grade regardless, pending
     their platform app reviews). The LinkedIn app's authorized redirect URL
     must include `https://salesdemo.allyvate.ai/studio/connections/callback`.

## Deploy / update

```bash
ssh ec2-user@52.0.159.200 'bash /home/ec2-user/salesdemo/infra/salesdemo/deploy.sh'
```

The script is idempotent: pulls the branch, installs deps + Chromium (+AL2023
libs), builds, installs/restarts the two systemd units, reloads Caddy.

## Production hardening (already wired in the units)

- `DISABLE_DEV_LOGIN=1` — kills `/dev/login` and the fixed dev token.
- `ALLOWED_EMAILS=...` — only these addresses can request a magic link
  (responses don't leak which emails are allowed). Edit the unit, then
  `sudo systemctl daemon-reload && sudo systemctl restart salesdemo-stub-api`.
- `APP_URL=https://salesdemo.allyvate.ai` — emailed links point at the public URL.
- Kits persist in the worktree (`data/brand-kits/`, `public/brand-kits/`) — a
  re-deploy does not delete them.

## Verify

```bash
curl -sI https://salesdemo.allyvate.ai | head -1          # 200
curl -s https://salesdemo.allyvate.ai/v1/me/workspace-setup # stub JSON
journalctl -u salesdemo-ui -e                             # app logs
journalctl -u salesdemo-stub-api -e                       # magic-link log lines
```

Then the real test: request a magic link from the login page with an
allowlisted email → email arrives via SendGrid → link logs you in → Brand
Center loads persisted kits → extract a fresh kit (needs Chromium working on
the box — first run downloads nothing further; if it fails, check
`journalctl -u salesdemo-ui` for missing shared libs).

## Known limits on the box

- Extraction is CPU/RAM heavy (headless Chromium + screenshots). On a small
  instance expect ~60–120s per kit; avoid concurrent extractions.
- The stub API is still the auth/workspace backend (in-memory: workspace-setup
  popup returns after restart; magic tokens don't survive restarts).
- Production path for extraction remains the marketingos Python
  `BrandExtractionOrchestrator` (Stage 2) — this deploy is the demo stand-in.
