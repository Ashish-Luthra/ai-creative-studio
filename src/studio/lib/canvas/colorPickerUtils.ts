/** Helpers for the canvas font color picker (HSL / hex, swatch grid). */

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase()
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      default:
        h = ((r - g) / d + 4) / 6
        break
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  s = clamp(s, 0, 100) / 100
  l = clamp(l, 0, 100) / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let rp = 0
  let gp = 0
  let bp = 0
  if (h < 60) {
    rp = c
    gp = x
    bp = 0
  } else if (h < 120) {
    rp = x
    gp = c
    bp = 0
  } else if (h < 180) {
    rp = 0
    gp = c
    bp = x
  } else if (h < 240) {
    rp = 0
    gp = x
    bp = c
  } else if (h < 300) {
    rp = x
    gp = 0
    bp = c
  } else {
    rp = c
    gp = 0
    bp = x
  }
  return rgbToHex((rp + m) * 255, (gp + m) * 255, (bp + m) * 255)
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  return rgbToHsl(rgb.r, rgb.g, rgb.b)
}

export function isTransparentCss(color: string): boolean {
  const c = color.trim().toLowerCase()
  if (c === 'transparent') return true
  const rgba = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c)
  if (rgba) {
    const a = rgba[4] !== undefined ? parseFloat(rgba[4]) : 1
    return a === 0
  }
  return false
}

/** Best-effort hex for display / swatch compare; opaque colors only. */
export function colorToOpaqueHex(color: string): string | null {
  if (isTransparentCss(color)) return null
  const t = color.trim()
  if (t.startsWith('#') && hexToRgb(t)) return normalizeHex(t)
  const rgba =
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(t)
  if (rgba) {
    const a = rgba[4] !== undefined ? parseFloat(rgba[4]) : 1
    if (a === 0) return null
    return rgbToHex(parseFloat(rgba[1]), parseFloat(rgba[2]), parseFloat(rgba[3]))
  }
  const rgb = /^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i.exec(t)
  if (rgb) {
    return rgbToHex(parseFloat(rgb[1]), parseFloat(rgb[2]), parseFloat(rgb[3]))
  }
  return null
}

export function normalizeHex(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return hex
  return `#${m[1].toUpperCase()}`
}

/** 12 hue columns + grey column; each column same length; last cell of grey = slot for transparent UI (handled in component). */
export function buildDefaultSwatchColumns(rows = 10): string[][] {
  const hues = [355, 330, 305, 275, 245, 215, 185, 155, 125, 95, 65, 35]
  const cols: string[][] = hues.map((hue) => {
    const col: string[] = []
    for (let i = 0; i < rows; i++) {
      const t = i / Math.max(1, rows - 1)
      const s = 98 - t * 78
      const l = 92 - t * 78
      col.push(hslToHex(hue, clamp(s, 18, 100), clamp(l, 8, 94)))
    }
    return col
  })
  const grey: string[] = []
  for (let i = 0; i < rows; i++) {
    const t = i / Math.max(1, rows - 1)
    const v = Math.round(255 * (1 - t))
    grey.push(rgbToHex(v, v, v))
  }
  cols.push(grey)
  return cols
}
