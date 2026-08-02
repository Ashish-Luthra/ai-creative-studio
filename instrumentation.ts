export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.CONTENT_RESYNC_CRON !== '1') return;
  const { scheduleNightlyResync } = await import('./src/lib/content-resync-cron');
  scheduleNightlyResync();
}
