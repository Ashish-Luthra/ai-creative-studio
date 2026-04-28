import { chromium, firefox, webkit } from 'playwright'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const TEST_URL = 'http://127.0.0.1:3000/studio/dev-session/canvas'
const ARTIFACTS_DIR = 'artifacts'
const SCREENSHOT_PATH = `${ARTIFACTS_DIR}/canvas-parity-smoke.png`
const DIFF_PATH = `${ARTIFACTS_DIR}/canvas-parity-diff.png`
const REPORT_PATH = `${ARTIFACTS_DIR}/canvas-parity-report.json`
const BASELINE_PATH = 'tests/parity-baselines/canvas-parity-smoke.png'
const UPDATE_BASELINE = process.env.UPDATE_PARITY_BASELINE === '1'
const MAX_DIFF_PERCENT = Number(process.env.MAX_DIFF_PERCENT ?? '0.5')
const BROWSER_NAME = process.env.PLAYWRIGHT_BROWSER ?? 'chromium'

const browserMap = {
  chromium,
  firefox,
  webkit,
}

function parseCanvasSnapshot(snapshotRaw) {
  if (!snapshotRaw) return null
  try {
    return JSON.parse(snapshotRaw)
  } catch {
    return null
  }
}

function summarizeObjects(snapshot) {
  const objects = Array.isArray(snapshot?.objects) ? snapshot.objects : []
  const byKind = objects.reduce((acc, obj) => {
    const kind = obj?.data?.kind ?? obj?.type ?? 'unknown'
    acc[kind] = (acc[kind] ?? 0) + 1
    return acc
  }, {})
  return { total: objects.length, byKind, objects }
}

async function compareWithBaseline(report) {
  if (!existsSync(BASELINE_PATH)) {
    report.visualDiff = {
      skipped: true,
      reason: 'No baseline found',
      baselinePath: BASELINE_PATH,
    }
    return true
  }

  const baselineBuffer = await readFile(BASELINE_PATH)
  const currentBuffer = await readFile(SCREENSHOT_PATH)
  const baselinePng = PNG.sync.read(baselineBuffer)
  const currentPng = PNG.sync.read(currentBuffer)

  if (baselinePng.width !== currentPng.width || baselinePng.height !== currentPng.height) {
    report.visualDiff = {
      skipped: false,
      pass: false,
      reason: 'Image dimensions differ',
      baseline: `${baselinePng.width}x${baselinePng.height}`,
      current: `${currentPng.width}x${currentPng.height}`,
    }
    return false
  }

  const diffPng = new PNG({ width: baselinePng.width, height: baselinePng.height })
  const diffPixels = pixelmatch(
    baselinePng.data,
    currentPng.data,
    diffPng.data,
    baselinePng.width,
    baselinePng.height,
    { threshold: 0.1 }
  )
  const totalPixels = baselinePng.width * baselinePng.height
  const diffPercent = (diffPixels / totalPixels) * 100
  await writeFile(DIFF_PATH, PNG.sync.write(diffPng))

  const pass = diffPercent <= MAX_DIFF_PERCENT
  report.visualDiff = {
    skipped: false,
    pass,
    diffPixels,
    totalPixels,
    diffPercent: Number(diffPercent.toFixed(4)),
    maxDiffPercent: MAX_DIFF_PERCENT,
    diffPath: DIFF_PATH,
    baselinePath: BASELINE_PATH,
  }
  return pass
}

async function run() {
  const browserType = browserMap[BROWSER_NAME]
  if (!browserType) {
    throw new Error(
      `Unsupported PLAYWRIGHT_BROWSER=${BROWSER_NAME}. Use one of: ${Object.keys(browserMap).join(', ')}`
    )
  }

  const browser = await browserType.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const report = {
    url: TEST_URL,
    checks: [],
    pass: true,
    browser: BROWSER_NAME,
  }

  const addCheck = (name, ok, details = '') => {
    report.checks.push({ name, ok, details })
    if (!ok) report.pass = false
  }

  try {
    await mkdir(ARTIFACTS_DIR, { recursive: true })
    await page.goto(TEST_URL, { waitUntil: 'networkidle' })
    await page.waitForSelector('canvas', { timeout: 15000 })
    await page.evaluate(() => localStorage.clear())
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('canvas', { timeout: 15000 })

    const hasSave = await page.getByRole('button', { name: 'Save' }).isVisible()
    const hasClear = await page.getByRole('button', { name: 'Clear' }).isVisible()
    addCheck('Top bar has Save', hasSave)
    addCheck('Top bar has Clear', hasClear)

    const hasLegacyHoverText = await page.getByText('Double-click to change').count()
    addCheck('No legacy hover hint text', hasLegacyHoverText === 0, `count=${hasLegacyHoverText}`)

    const initialSnapshotRaw = await page.evaluate(() => localStorage.getItem('creative-canvas:dev-session'))
    const initialSnapshot = parseCanvasSnapshot(initialSnapshotRaw)
    const initialSummary = summarizeObjects(initialSnapshot)
    addCheck(
      'First invoke canvas starts blank',
      initialSummary.total === 0,
      `objects=${initialSummary.total}`
    )

    await page.getByTitle('Layout / Template').click()
    await page.getByRole('button', { name: 'Instagram 1:1 1080 x 1080' }).click()
    await page.waitForTimeout(600)

    const postLayoutSnapshotRaw = await page.evaluate(() => localStorage.getItem('creative-canvas:dev-session'))
    const postLayoutSnapshot = parseCanvasSnapshot(postLayoutSnapshotRaw)
    const postLayoutSummary = summarizeObjects(postLayoutSnapshot)

    const frameCount = postLayoutSummary.byKind['creative-frame'] ?? 0
    const imageCount = postLayoutSummary.byKind['creative-image'] ?? 0
    const textCount = postLayoutSummary.byKind['creative-text'] ?? 0

    addCheck('Layout selection creates one frame', frameCount === 1, `frameCount=${frameCount}`)
    addCheck('Layout selection keeps frame blank', imageCount === 0, `imageCount=${imageCount}`)
    addCheck('Layout selection includes editable label', textCount >= 1, `textCount=${textCount}`)

    const frameObject = postLayoutSummary.objects.find((obj) => obj?.data?.kind === 'creative-frame')
    const squareCorners = frameObject?.rx === 0 && frameObject?.ry === 0
    addCheck('Frame corners are square', Boolean(squareCorners), `rx=${frameObject?.rx}, ry=${frameObject?.ry}`)

    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true })

    if (UPDATE_BASELINE) {
      await mkdir('tests/parity-baselines', { recursive: true })
      const shot = await readFile(SCREENSHOT_PATH)
      await writeFile(BASELINE_PATH, shot)
      report.visualDiff = {
        skipped: false,
        pass: true,
        baselineUpdated: true,
        baselinePath: BASELINE_PATH,
      }
    } else {
      const visualPass = await compareWithBaseline(report)
      if (!visualPass) {
        report.pass = false
      }
    }

    await writeFile(REPORT_PATH, JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))

    if (!report.pass) {
      process.exitCode = 1
    }
  } finally {
    await context.close()
    await browser.close()
  }
}

void run()
