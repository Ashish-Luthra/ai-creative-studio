# Canvas parity checks

This project includes an automated canvas parity smoke test to keep the editor behavior and output stable.

## What it verifies

- Top bar controls exist (`Save`, `Clear`)
- First invoke canvas starts blank
- Layout flow creates a blank frame (`Layout -> Instagram 1:1`)
- Frame remains blank (no seeded image)
- Frame label exists and frame corners are square
- Legacy hover hint text is not present
- Optional visual diff against baseline screenshot

## Commands

- `npm run parity:smoke`  
  Run local smoke + optional visual diff.

- `npm run parity:update-baseline`  
  Re-capture and update the baseline screenshot at `tests/parity-baselines/canvas-parity-smoke.png`.

- `npm run parity:ci`  
  CI mode (Chromium, strict non-interactive run).

## Artifacts

Script output is written to `artifacts/`:

- `canvas-parity-report.json` — JSON pass/fail report and check details
- `canvas-parity-smoke.png` — latest captured screenshot
- `canvas-parity-diff.png` — visual diff image (when baseline exists)

## CI

GitHub Actions workflow:

- `.github/workflows/canvas-parity.yml`

Runs on every pull request and uploads parity artifacts, including the dev server log.

## Threshold tuning

You can change visual diff tolerance with:

- `MAX_DIFF_PERCENT` (default: `0.5`)

Example:

`MAX_DIFF_PERCENT=0.25 npm run parity:smoke`
