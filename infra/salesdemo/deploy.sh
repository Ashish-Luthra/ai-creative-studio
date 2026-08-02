#!/usr/bin/env bash
# Deploy the SalesDemo Agent (apps/salesdemo-ui) on the Allyvate EC2 box.
# Idempotent — safe to re-run for updates. Run as ec2-user ON THE BOX:
#   bash /home/ec2-user/salesdemo/infra/salesdemo/deploy.sh   (after first checkout)
# First time, bootstrap the worktree from the existing clone:
#   cd /home/ec2-user/AIDemoAgent && git fetch origin \
#     && git worktree add /home/ec2-user/salesdemo origin/feat/salesdemo-ui
set -euo pipefail

APP_DIR=/home/ec2-user/salesdemo
UI_DIR=$APP_DIR/apps/salesdemo-ui
PUBLIC_URL=https://salesdemo.allyvate.ai
BRANCH=feat/salesdemo-ui

echo "==> 1/7 Update checkout ($BRANCH)"
cd "$APP_DIR"
git fetch origin "$BRANCH"
# Hard reset, not checkout: `pnpm build` rewrites tracked generated files
# (next-env.d.ts flips its routes.d.ts path between dev and build), which makes
# a plain checkout abort on the next deploy. Untracked .env.local and data/ are
# gitignored, so they survive.
git reset --hard "origin/$BRANCH"

echo "==> 2/7 Node 22 + pnpm"
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 22 ]; then
  sudo dnf install -y nodejs22 && sudo alternatives --set node /usr/bin/node-22 || {
    echo "Install Node 22 manually (dnf nodejs22 unavailable)"; exit 1; }
fi
command -v pnpm >/dev/null || sudo corepack enable

echo "==> 3/7 Dependencies"
pnpm install --frozen-lockfile

echo "==> 4/7 Playwright Chromium + system libs (AL2023)"
sudo dnf install -y --skip-broken \
  alsa-lib atk at-spi2-atk at-spi2-core cups-libs libdrm libxkbcommon \
  libXcomposite libXdamage libXfixes libXrandr mesa-libgbm nss pango \
  cairo expat
cd "$UI_DIR"
pnpm exec playwright install chromium

echo "==> 5/7 Secrets check"
if [ ! -f "$UI_DIR/.env.local" ]; then
  echo "MISSING $UI_DIR/.env.local — copy it from the dev machine:"
  echo "  scp apps/salesdemo-ui/.env.local ec2-user@52.0.159.200:$UI_DIR/.env.local"
  exit 1
fi

echo "==> 6/7 Build + services"
NEXT_PUBLIC_API_BASE_URL=$PUBLIC_URL pnpm build
sudo cp "$APP_DIR/infra/salesdemo/salesdemo-ui.service" /etc/systemd/system/
sudo cp "$APP_DIR/infra/salesdemo/salesdemo-stub-api.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now salesdemo-stub-api salesdemo-ui
sudo systemctl restart salesdemo-stub-api salesdemo-ui

echo "==> 7/7 Caddy vhost"
sudo cp "$APP_DIR/infra/caddy/Caddyfile" /etc/caddy/Caddyfile
sudo systemctl reload caddy

sleep 2
echo "==> Health:"
curl -sf http://localhost:3100/ -o /dev/null && echo "  ui :3100 OK"
curl -sf http://localhost:58000/v1/me/workspace-setup -o /dev/null && echo "  stub :58000 OK"
echo "Done. Public URL (once DNS resolves): $PUBLIC_URL"
