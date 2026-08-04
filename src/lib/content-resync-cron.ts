import { listContentDomains } from './content-store';
import { resolveBrandName } from './content-domain';
import { startSync } from './content-sync';

/**
 * Nightly re-sync: at the configured UTC hour, kick a sync for every domain
 * that has a content file, so the library tracks site changes without a
 * manual Sync click. Wired from instrumentation.ts; opt-in via
 * CONTENT_RESYNC_CRON=1 (set on the prod box, not in dev — HMR would orphan
 * an in-flight crawl).
 */

const RESYNC_UTC_HOUR = Number(process.env.CONTENT_RESYNC_UTC_HOUR ?? 8); // 8 UTC ≈ 3am ET

// globalThis-anchored so a re-run of register() can't double-schedule.
const globalStore = globalThis as unknown as { __contentResyncTimer?: NodeJS.Timeout };

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(RESYNC_UTC_HOUR, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

async function resyncAll(): Promise<void> {
  const domains = await listContentDomains();
  for (const domain of domains) {
    const brandName = await resolveBrandName(domain);
    const result = startSync(domain, brandName);
    console.log(
      result.started
        ? `[resync-cron] started sync for ${domain}`
        : `[resync-cron] skipped ${domain}: ${result.reason}`
    );
  }
}

export function scheduleNightlyResync(): void {
  if (globalStore.__contentResyncTimer) return;
  const arm = () => {
    globalStore.__contentResyncTimer = setTimeout(async () => {
      try {
        await resyncAll();
      } catch (err) {
        console.error('[resync-cron] failed:', err);
      }
      arm();
    }, msUntilNextRun());
    globalStore.__contentResyncTimer.unref?.();
  };
  arm();
  console.log(`[resync-cron] armed — next run in ${Math.round(msUntilNextRun() / 60_000)} min`);
}
