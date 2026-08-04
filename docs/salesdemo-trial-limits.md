# SalesDemo — Trial Limits

Every cap that governs a trial tenant's Content Engine, what it costs, and what
to change for a paid client. Numbers below are measured, not estimated — source
runs are `www.getjust.ai` (28 pages) and `hightouch.com` (198 pages), 2026-07-31.

## The quotas

| | Trial default | Env override | Paid |
|---|---|---|---|
| **Crawled pages — case studies** | **75** | `CONTENT_CRAWL_GROUP_LIMIT` | `0` or `unlimited` |
| **Crawled pages — blog** | **75** | `CONTENT_CRAWL_GROUP_LIMIT` | `0` or `unlimited` |
| **Crawled pages — webpages** | **75** | `CONTENT_CRAWL_GROUP_LIMIT` | `0` or `unlimited` |
| **Manually added docs** | **25** | `CONTENT_MANUAL_DOC_LIMIT` | `0` or `unlimited` |

Defined in `apps/salesdemo-ui/src/lib/content-limits.ts`. An unparseable value
falls back to the trial default rather than failing open.

These are **separate budgets on purpose.** Hand-picked collateral (decks, PDFs,
call notes) is the highest-signal content in the corpus, so a large site crawl
must never consume the allowance for it. Manual docs = `source: 'url'` +
`source: 'upload'`, counted including archived items — the quota is on what was
ingested, not on what is currently displayed.

Over-quota manual adds return **409** from `/api/content/add-url` and
`/api/content/upload`. On uploads the check runs *before* PDF parsing, so a
rejected document never burns a parse or a Claude call.

## Why per-group and not one flat number

Groups are assigned by **URL path at discovery time** (`crawlGroupFor`), not by
the Claude-assigned category — the category is only known after a page has been
crawled and classified, so quota-ing on it would mean paying to ingest pages we
then discard. The two are close but not identical: a `/blog/...` URL can still
classify as a Case study.

A flat total cap cannot buy category diversity, because in priority order the
groups are *contiguous*. Measured on hightouch.com:

| Flat cap | What it ingested |
|---|---|
| 50 | 50 case studies, **zero blogs** |
| 80 | 55 case studies + 25 blogs |
| 120 | all case studies + all blogs |
| 150 | + pricing/compare |
| **159+** | first product/platform page |

Per-group reaches all three at a fraction of that: case studies occupy discovery
positions 1–55, blogs 56–120 and product pages don't start until 159, so a flat
cap had to more than triple before showing a single product page.

## What a trial actually costs

Measured on getjust.ai (28 pages, full classify, images downloaded):
**31 seconds end to end**. Worst case is 3 × 75 = **225 pages**:

- **Crawl time**: ~225s (~4 min) at the ceiling. The crawler is deliberately
  polite — 1 request/sec (`politeDelay`) — so page count is the dominant term.
  Add ~2–4s per JS-rendered page that falls back to Playwright.
- **Claude calls**: ~23 classify calls (batched 10 pages/call), each retried up
  to 3× with exponential backoff. A batch that still fails is skipped, not fatal
  — it is never upserted, so the next sync re-fetches it.
- **Disk**: 119KB average per image on getjust.ai, 284KB on hightouch.com →
  budget **~25–60MB per trial tenant** at the ceiling.
- **Re-sync is much cheaper.** Unchanged pages are detected by content hash and
  skipped before classification, so a repeat sync costs the crawl time and
  near-zero Claude spend.

## Coverage: what 75/75/75 gets you

| Site | Pages available | Trial ingests |
|---|---|---|
| getjust.ai | 0 case / 27 blog / 1 web | **all 28** — entire site |
| hightouch.com | 55 case / 65 blog / 78 web | **195 of 198** (only 3 webpages cut) |

At this level a trial takes essentially the whole site for anything short of a
large content operation. **Trial and paid are therefore near-identical on content
volume** — the differentiation has to come from elsewhere (seats, publishing,
call intelligence, refresh cadence). That is a deliberate choice, not an
accident: lower numbers made the Content Engine look like it only found one kind
of page, which undersells the product in a demo.

## Related hard limits (not plan-based)

These apply on every plan and are separate from the trial quotas:

| Limit | Value | Where |
|---|---|---|
| Upload file size | 15MB | `app/api/content/upload/route.ts` |
| Downloaded image size | 1KB–4MB | `content-image.ts` (`MAX_BYTES`) |
| Image candidates tried per page | 5 | `content-crawl.ts` (`extractHeroImages`) |
| Site-wide og:image threshold | reused on ≥3 pages | `content-sync.ts` |
| Stored full text per item | 20,000 chars | `content-sync.ts` / `content-add.ts` |
| Classify batch size | 10 pages, 3 attempts | `content-sync.ts` |
| Child sitemaps followed | 10 | `content-crawl.ts` |
| Approved corpus fed to a creative brief | 20 items | `app/api/studio/brief/route.ts` |

The 4MB image cap is why multi-candidate fallback exists: getjust.ai's Series-A
post has a 9.97MB hero, and before the fallback that item got no image at all.

## Caveats

- **The crawl caps govern new discovery only.** Items already stored above the
  cap are never pruned. A tenant that was crawled uncapped and later moved to
  trial keeps everything it has.
- **Limits are process-wide, not per tenant.** They come from the environment,
  so one deployment currently serves one plan tier.
- **Production path (ADR 0001):** read both limits from the tenant's plan row in
  Neon instead of `process.env`, so a single deployment can serve trial and paid
  tenants side by side. The env vars are the stand-in until that table exists.
- The Add-content dialog does not yet display remaining quota — it simply fails
  at the limit.
