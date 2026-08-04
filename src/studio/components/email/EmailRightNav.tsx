'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  ChevronDown, Upload,
  Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight,
  Plus, Trash2, X as XIcon,
} from 'lucide-react'
import { cn } from '@studio/lib/utils'
import type { CanvasBlock } from './EmailEditorPanel'
import { GOOGLE_FONT_FAMILIES } from '@studio/lib/canvas/googleFonts'
import { AlertTriangle } from 'lucide-react'
import {
  SectionLabel,
  ColorSwatch,
  TextStyleControls,
  SYSTEM_FONTS,
  ALL_KNOWN_FONTS,
  type TextStyleValue,
} from '@studio/components/shared/TextStyleControls'

// ─── Tab routing ──────────────────────────────────────────────────────────────

type RightTab = 'block' | 'font' | 'button' | 'image' | 'link' | 'icons' | 'links'

// Only blocks where the image has a distinct shape (circle/arch/etc.) get the Image tab.
// Full-bleed blocks intentionally do NOT appear here.
const IMAGE_BLOCK_TYPES = new Set(['testimonial', 'recipe-card'])

// Every layout block that contains a CTA button whose style is driven by
// buttonShapeVariant / buttonFillColor / etc.
const BUTTON_LAYOUT_TYPES = new Set([
  'image-left-text-right',
  'centered-content',
  'text-over-image',
  'text-left-image-right',
  'recipe-card',
  'image-top-text-bottom',
])

function getTabsForBlock(blockType: string): { id: RightTab; label: string }[] {
  const B = { id: 'button' as RightTab, label: 'Button' }
  const F = { id: 'font'   as RightTab, label: 'Font'   }
  const I = { id: 'image'  as RightTab, label: 'Image'  }
  const L = { id: 'link'   as RightTab, label: 'Link'   }
  const K = { id: 'block'  as RightTab, label: 'Block'  }

  // Standalone button block
  if (blockType === 'button') return [B, F, L, K]
  // Text-only block
  if (blockType === 'text')   return [F, L, K]
  // Spacer — only needs Block tab (height + background)
  if (blockType === 'spacer') return [K]
  // Link bar / Footer — only need Block tab (link items editor + background)
  if (blockType === 'link-bar') return [K]
  if (blockType === 'footer')   return [K]
  // Social — Icons styling, Links management, Block (bg + padding)
  if (blockType === 'social') return [
    { id: 'icons' as RightTab, label: 'Icons' },
    { id: 'links' as RightTab, label: 'Links' },
    K,
  ]

  const hasShape  = IMAGE_BLOCK_TYPES.has(blockType)
  const hasButton = BUTTON_LAYOUT_TYPES.has(blockType)

  // All layout blocks include a Font tab since they contain editable text
  if (hasShape && hasButton) return [B, I, F, L, K]   // recipe-card
  if (hasShape)              return [I, F, L, K]       // testimonial
  if (hasButton)             return [B, F, L, K]       // all other layout blocks with buttons

  return [K, L]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BUTTON_SHAPES = [
  { id: 0, radius: '0px',   filled: true  },
  { id: 1, radius: '4px',   filled: true  },
  { id: 2, radius: '12px',  filled: true  },
  { id: 3, radius: '999px', filled: true  },
  { id: 4, radius: '0px',   filled: false },
  { id: 5, radius: '4px',   filled: false },
  { id: 6, radius: '12px',  filled: false },
  { id: 7, radius: '999px', filled: false },
]

const IMAGE_SHAPES: { id: CanvasBlock['imageShape']; path: string }[] = [
  { id: 'circle',   path: 'M16 0C24.8 0 32 7.2 32 16C32 24.8 24.8 32 16 32C7.2 32 0 24.8 0 16C0 7.2 7.2 0 16 0Z' },
  { id: 'square',   path: 'M0 0H32V32H0Z' },
  { id: 'rounded',  path: 'M4 0H28C30.2 0 32 1.8 32 4V28C32 30.2 30.2 32 28 32H4C1.8 32 0 30.2 0 28V4C0 1.8 1.8 0 4 0Z' },
  { id: 'arch',     path: 'M0 16C0 7.2 7.2 0 16 0C24.8 0 32 7.2 32 16V32H0V16Z' },
  { id: 'diamond',  path: 'M16 0L32 16L16 32L0 16Z' },
  { id: 'hexagon',  path: 'M16 0L32 9.3V22.7L16 32L0 22.7V9.3Z' },
]

const LINK_ACTIONS = [
  'Add to segment',
  'Remove from segment',
  'Add to workflow',
  'Remove from workflow',
  'Set custom field value',
]


function Accordion({
  title, children, defaultOpen = false,
}: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-[13px] font-semibold text-gray-800"
      >
        {title}
        <ChevronDown
          size={14}
          className={cn('text-gray-400 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ─── Link Bar editor (used inside BlockTab) ───────────────────────────────────

const DEFAULT_LINK_BAR_ITEMS = [
  { label: 'Home',     url: '' },
  { label: 'About',    url: '' },
  { label: 'Products', url: '' },
  { label: 'Blog',     url: '' },
  { label: 'Contact',  url: '' },
]

function LinkBarEditor({ block, onPatch }: { block: CanvasBlock; onPatch: (p: Partial<CanvasBlock>) => void }) {
  const items = (block.linkBarItems && block.linkBarItems.length > 0)
    ? block.linkBarItems
    : DEFAULT_LINK_BAR_ITEMS

  const patchItems = (next: { label: string; url: string }[]) =>
    onPatch({ linkBarItems: next })

  const updateItem = (i: number, field: 'label' | 'url', value: string) => {
    const next = items.map((item, idx) => idx === i ? { ...item, [field]: value } : item)
    patchItems(next)
  }

  const removeItem = (i: number) => {
    if (items.length <= 1) return
    patchItems(items.filter((_, idx) => idx !== i))
  }

  const addItem = () => {
    patchItems([...items, { label: 'New Link', url: '' }])
  }

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    patchItems(next)
  }

  return (
    <div>
      <SectionLabel>Navigation Links</SectionLabel>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 space-y-2">
            {/* Row 1: drag handle + label + delete */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveItem(i, i - 1)}
                  disabled={i === 0}
                  className="text-[0.95em] text-gray-300 hover:text-gray-500 disabled:opacity-20 leading-none"
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(i, i + 1)}
                  disabled={i === items.length - 1}
                  className="text-[0.95em] text-gray-300 hover:text-gray-500 disabled:opacity-20 leading-none"
                  title="Move down"
                >
                  ▼
                </button>
              </div>
              <input
                type="text"
                value={item.label}
                placeholder="Label"
                onChange={(e) => updateItem(i, 'label', e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-300"
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                disabled={items.length <= 1}
                className="text-gray-300 hover:text-red-400 disabled:opacity-20 transition-colors"
                title="Remove"
              >
                <Trash2 size={13} />
              </button>
            </div>
            {/* Row 2: URL input */}
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5">
              <span className="text-[9px] text-gray-300 font-mono shrink-0">URL</span>
              <input
                type="url"
                value={item.url}
                placeholder="https://…"
                onChange={(e) => updateItem(i, 'url', e.target.value)}
                className="flex-1 text-[11px] text-gray-700 font-mono focus:outline-none min-w-0"
              />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2 text-[11px] text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
      >
        <Plus size={12} />
        Add link
      </button>
    </div>
  )
}

// ─── Footer editor (used inside BlockTab) ────────────────────────────────────

const DEFAULT_FOOTER_LINKS = [
  { label: 'Privacy Policy',  url: '' },
  { label: 'Unsubscribe',     url: '' },
  { label: 'View in Browser', url: '' },
  { label: 'Contact Us',      url: '' },
]

function FooterEditor({ block, onPatch }: { block: CanvasBlock; onPatch: (p: Partial<CanvasBlock>) => void }) {
  const items = (block.footerLinks && block.footerLinks.length > 0)
    ? block.footerLinks
    : DEFAULT_FOOTER_LINKS

  const patchItems = (next: { label: string; url: string }[]) =>
    onPatch({ footerLinks: next })

  const updateItem = (i: number, field: 'label' | 'url', value: string) =>
    patchItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const removeItem = (i: number) => {
    if (items.length <= 1) return
    patchItems(items.filter((_, idx) => idx !== i))
  }

  const addItem = () => patchItems([...items, { label: 'New Link', url: '' }])

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    patchItems(next)
  }

  return (
    <div>
      <SectionLabel>Footer Links</SectionLabel>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5">
                <button type="button" onClick={() => moveItem(i, i - 1)} disabled={i === 0}
                  className="text-[0.95em] text-gray-300 hover:text-gray-500 disabled:opacity-20 leading-none" title="Move up">▲</button>
                <button type="button" onClick={() => moveItem(i, i + 1)} disabled={i === items.length - 1}
                  className="text-[0.95em] text-gray-300 hover:text-gray-500 disabled:opacity-20 leading-none" title="Move down">▼</button>
              </div>
              <input
                type="text"
                value={item.label}
                placeholder="Label"
                onChange={(e) => updateItem(i, 'label', e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-300"
              />
              <button type="button" onClick={() => removeItem(i)} disabled={items.length <= 1}
                className="text-gray-300 hover:text-red-400 disabled:opacity-20 transition-colors" title="Remove">
                <Trash2 size={13} />
              </button>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5">
              <span className="text-[9px] text-gray-300 font-mono shrink-0">URL</span>
              <input
                type="url"
                value={item.url}
                placeholder="https://…"
                onChange={(e) => updateItem(i, 'url', e.target.value)}
                className="flex-1 text-[11px] text-gray-700 font-mono focus:outline-none min-w-0"
              />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2 text-[11px] text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
      >
        <Plus size={12} />
        Add link
      </button>
    </div>
  )
}

// ─── Social platforms list ────────────────────────────────────────────────────

type SocialPlatform = { key: string; name: string; icon: React.ReactNode }

const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: 'facebook',  name: 'Facebook',  icon: <svg viewBox="0 0 76 151" fill="currentColor" className="h-5 w-5"><path d="M48.8868895,150 L48.8868895,81.5829675 L71.0820271,81.5829675 L74.4119522,54.9117243 L48.8868895,54.9117243 L48.8868895,37.8860248 C48.8868895,30.1664959 50.9510317,24.9057297 61.6662481,24.9057297 L75.3103402,24.8999285 L75.3103402,1.04422486 C72.9507863,0.7270899 64.8512718,0 55.4242746,0 C35.7392011,0 22.2624467,12.4272427 22.2624467,35.2445227 L22.2624467,54.9117243 L0,54.9117243 L0,81.5829675 L22.2624467,81.5829675 L22.2624467,150 L48.8868895,150 Z"/></svg> },
  { key: 'instagram', name: 'Instagram', icon: <svg viewBox="0 0 150 150" fill="currentColor" className="h-5 w-5"><path d="M43.9385663,0.524533902 C35.9584855,0.901035204 30.5089304,2.17453961 25.7448821,4.04654608 C20.8143322,5.96805272 16.63529,8.54656163 12.4772479,12.7195761 C8.3192058,16.8925905 5.75867989,21.0746049 3.85066058,26.012622 C2.0041419,30.7871385 0.753129235,36.2411574 0.400625668,44.225685 C0.048122101,52.2102126 -0.0298786883,54.7767214 0.00912170636,75.1437918 C0.048122101,95.5108622 0.138123012,98.0638711 0.525126928,106.064899 C0.906130784,114.043426 2.17514363,119.491445 4.04716257,124.256962 C5.97168205,129.187479 8.54720811,133.364993 12.7217504,137.524507 C16.8962926,141.684022 21.0753349,144.238531 26.025385,146.149537 C30.7954333,147.993044 36.2509885,149.250048 44.2340692,149.599549 C52.21715,149.94905 54.786676,150.030051 75.1478821,149.991051 C95.5090881,149.95205 98.0726141,149.86205 106.072195,149.482549 C114.071776,149.103047 119.491331,147.825043 124.258379,145.962037 C129.188929,144.03303 133.369471,141.462021 137.526013,137.286007 C141.682555,133.109992 144.241581,128.924978 146.148101,123.983961 C147.996119,119.213944 149.251632,113.758425 149.598136,105.781398 C149.947639,97.7758701 150.03014,95.2198612 149.991139,74.8557908 C149.952139,54.4917204 149.860638,51.9387116 149.481134,43.940684 C149.10163,35.9426563 147.831118,30.5111376 145.960599,25.7426211 C144.033079,20.812104 141.460553,16.6375896 137.287511,12.4750752 C133.114469,8.31256082 128.926426,5.75505198 123.986876,3.85304541 C119.213828,2.00653902 113.761273,0.748034675 105.778192,0.403033482 C97.7951113,0.0580322898 95.2255853,-0.0304680161 74.8568791,0.00853211873 C54.488173,0.0475322535 51.9381472,0.134532554 43.9385663,0.524533902 M44.8145751,136.107003 C37.5020011,135.789001 33.5314609,134.573997 30.8854342,133.556994 C27.3813987,132.206989 24.8853734,130.574983 22.2483468,127.963474 C19.6113201,125.351965 17.9913037,122.846957 16.6232898,119.350445 C15.5957794,116.704435 14.3582669,112.738422 14.0162635,105.425897 C13.6442597,97.5223692 13.5662589,95.149361 13.5227585,75.1257918 C13.479258,55.1022226 13.5557588,52.7322144 13.9022623,44.825687 C14.2142655,37.5191618 15.4367778,33.544148 16.4522881,30.8996389 C17.8023018,27.3911268 19.4283182,24.8996182 22.0458447,22.264109 C24.6633712,19.6285999 27.1608965,18.0055943 30.6604319,16.6375896 C33.3034586,15.605586 37.2694988,14.3785818 44.5790727,14.0305806 C52.4886528,13.6555793 54.8586768,13.580579 74.8793794,13.5370789 C94.900082,13.4935787 97.276106,13.568579 105.188686,13.9165802 C112.49526,14.2345813 116.4718,15.4450855 119.113327,16.466589 C122.618862,17.8165937 125.113388,19.4380993 127.748914,22.0601083 C130.384441,24.6821174 132.008958,27.170626 133.376971,30.6776381 C134.410482,33.3131472 135.637494,37.2776609 135.982498,44.5916862 C136.359002,52.5012136 136.444502,54.8727218 136.480503,74.891791 C136.516503,94.9108602 136.446002,97.2883684 136.099499,105.191896 C135.779996,112.504421 134.567983,116.476435 133.549473,119.125444 C132.199459,122.627956 130.571943,125.125465 127.952916,127.759474 C125.33389,130.393483 122.839365,132.016488 119.338329,133.384493 C116.698303,134.414997 112.727762,135.645001 105.424188,135.993002 C97.5146084,136.365003 95.1445844,136.443004 75.1163818,136.486504 C55.0881791,136.530004 52.7256552,136.449004 44.8160751,136.107003 M105.956681,34.9151528 C105.962769,38.5555907 108.161365,41.8338524 111.527153,43.2210978 C114.89294,44.6083432 118.762982,43.8313356 121.332456,41.2524379 C123.901931,38.6735401 124.664746,34.800701 123.265158,31.4400458 C121.865569,28.0793906 118.579245,25.8928458 114.938785,25.9001035 C109.969341,25.9100535 105.948402,29.9457394 105.956681,34.9151528 M36.4909195,75.0747916 C36.5329913,96.3448651 53.8071661,113.548425 75.0728813,113.507996 C96.3385965,113.467424 113.554271,96.1948646 113.513842,74.9247911 C113.47327,53.6547176 96.1945951,36.4466581 74.9258798,36.4885815 C53.6571646,36.5306584 36.4504905,53.8077181 36.4909195,75.0747916 M50.0000776,75.0477915 C49.9728164,61.2403887 61.1438528,50.0251321 74.9513476,49.9977529 C88.7588424,49.9704739 99.9741883,61.1414212 100.001586,74.948824 C100.028883,88.7562268 88.8578758,99.9715126 75.0503811,99.998933 C68.4195228,100.012815 62.0547988,97.3916838 57.3567893,92.7122724 C52.6587798,88.0328611 50.0124476,81.6786088 50.0000776,75.0477915"/></svg> },
  { key: 'pinterest', name: 'Pinterest', icon: <svg viewBox="0 0 123 150" fill="currentColor" className="h-5 w-5"><path d="M63.1421366,0 C21.9216112,0 0,26.3449432 0,55.0712443 C0,68.3937228 7.46387621,85.0069752 19.4117183,90.2759639 C21.2259855,91.0916258 22.213022,90.7447351 22.617237,89.0665341 C22.9744502,87.7914764 24.5443083,81.6505732 25.3057365,78.753567 C25.5407452,77.8254 25.4185406,77.0191134 24.6665128,76.1471989 C20.699566,71.5719917 17.5504495,63.2372392 17.5504495,55.4181351 C17.5504495,35.3828526 33.5216405,15.9288465 60.6980462,15.9288465 C84.1989159,15.9288465 100.640124,31.1545361 100.640124,52.9336475 C100.640124,77.5441372 87.5830411,94.5699084 70.6154132,94.5699084 C61.2244657,94.5699084 54.2306069,87.2195754 56.449089,78.1254135 C59.1281881,67.2967981 64.3829826,55.6525207 64.3829826,47.8427919 C64.3829826,40.8393497 60.4160358,35.0453373 52.3129359,35.0453373 C42.7527821,35.0453373 34.9974951,44.4863899 34.9974951,57.161964 C34.9974951,65.2154538 37.8552009,70.6532001 37.8552009,70.6532001 C37.8552009,70.6532001 28.3984509,108.754926 26.6405859,115.870873 C23.6700759,127.918294 27.0448008,147.428552 27.3362116,149.106754 C27.5148182,150.034921 28.5582568,150.325559 29.1410784,149.566149 C30.0717128,148.347344 41.5025358,132.080982 44.7080545,120.3242 C45.8736976,116.039631 50.6584747,98.6669689 50.6584747,98.6669689 C53.8075912,104.339101 62.8977276,109.092441 72.5800859,109.092441 C101.382752,109.092441 122.195122,83.8444226 122.195122,52.5117534 C122.091718,22.4728929 96.3159643,0 63.1421366,0 Z"/></svg> },
  { key: 'twitter',   name: 'X',         icon: <svg viewBox="0 0 147 150" fill="currentColor" className="h-5 w-5"><path d="M87.3508403,63.5147631 L141.990998,0 L129.043029,0 L81.5989873,55.1489762 L43.7055701,0 L0,0 L57.3022823,83.3950194 L0,150 L12.9487023,150 L63.0508329,91.7608063 L103.069057,150 L146.774628,150 L87.3476602,63.5147631 L87.3508403,63.5147631 Z M69.6158174,84.1297488 L63.8099024,75.825485 L17.6143007,9.74754764 L37.502752,9.74754764 L74.7831405,63.0745615 L80.5890555,71.3788253 L129.049145,140.695712 L109.160694,140.695712 L69.6158174,84.1329289 L69.6158174,84.1297488 Z"/></svg> },
  { key: 'youtube',   name: 'YouTube',   icon: <svg viewBox="0 0 199 150" fill="currentColor" className="h-5 w-5"><path d="M129.50411,66.1398527 L85.7518432,42.2005317 C83.2361295,40.8240663 80.2626011,40.8754381 77.7967484,42.3365164 C75.3293847,43.7991055 73.8577298,46.3828114 73.8577298,49.2505742 L73.8577298,96.7182401 C73.8577298,99.5724041 75.3203189,102.151577 77.7710625,103.615677 C79.0508281,104.380213 80.4695997,104.763991 81.8913938,104.763991 C83.1938232,104.763991 84.4992747,104.442161 85.7004714,103.795479 L129.454249,80.2686449 C132.051553,78.8710262 133.672791,76.1709778 133.684931,73.2201136 C133.695455,70.2692495 132.093859,67.5571135 129.50411,66.1398527 L129.50411,66.1398527 Z M85.4632541,90.7470083 L85.4632541,55.2701559 L118.163,73.1626981 L85.4632541,90.7470083 Z"/><path d="M196.585277,35.4028165 L196.576212,35.3121601 C196.408498,33.7181192 194.73891,19.5394657 187.846005,12.327753 C179.878823,3.84534017 170.846428,2.81487983 166.502478,2.32080261 C166.142874,2.28000716 165.81349,2.24223377 165.518857,2.20294916 L165.172852,2.16668662 C138.991297,0.262903614 99.451529,0.0030218784 99.0556631,0.0015109392 L99.0209114,0 L98.9861597,0.0015109392 C98.5902938,0.0030218784 59.0505256,0.262903614 32.633265,2.16668662 L32.284238,2.20294916 C32.0032031,2.24072293 31.6934607,2.27547424 31.3565211,2.31475885 C27.0624321,2.81034691 18.1267375,3.84231848 10.136891,12.6314517 C3.57186027,19.7661064 1.67412063,33.6410612 1.47920957,35.2003504 L1.45654539,35.4028165 C1.39761866,36.0661189 0,51.8569442 0,67.7097183 L0,82.5290099 C0,98.381784 1.39761866,114.17261 1.45654539,114.837423 L1.46712206,114.937145 C1.63483602,116.5055 3.3029129,130.424272 10.1640881,137.639007 C17.6553245,145.837362 27.1274022,146.922217 32.2222896,147.505439 C33.0276201,147.597607 33.7211413,147.676175 34.1940651,147.759277 L34.6518798,147.822737 C49.7688264,149.261151 97.1654781,149.969781 99.1750274,149.998489 L99.235465,150 L99.2959025,149.998489 C99.6917684,149.996978 139.230025,149.737097 165.41158,147.833313 L165.757585,147.79705 C166.088481,147.753233 166.460171,147.713949 166.868125,147.671643 C171.138039,147.218361 180.025384,146.277046 187.904932,137.607276 C194.469963,130.471111 196.369213,116.596156 196.562613,115.038378 L196.585277,114.835912 C196.644204,114.171099 198.043334,98.381784 198.043334,82.5290099 L198.043334,67.7097183 C198.043334,51.8569442 196.644204,36.0676297 196.585277,35.4028165 L196.585277,35.4028165 Z M186.436299,82.5290099 C186.436299,97.2017406 185.155022,112.312643 185.034147,113.699686 C184.541581,117.520851 182.539587,126.299408 179.340928,129.776079 C174.409223,135.201861 169.343044,135.739756 165.644265,136.131089 C165.197027,136.177928 164.783029,136.223257 164.408316,136.270095 C139.084975,138.101354 101.038015,138.382389 99.2853259,138.392965 C97.3195937,138.364257 50.6164632,137.649583 35.960353,136.288227 C35.2094163,136.165841 34.398042,136.072162 33.5428502,135.975462 C29.2049437,135.478363 23.2669528,134.798441 18.7008944,129.776079 L18.5936176,129.661248 C15.4508641,126.387042 13.5062856,118.17811 13.0122084,113.745014 C12.9200412,112.696422 11.6055239,97.4072283 11.6055239,82.5290099 L11.6055239,67.7097183 C11.6055239,53.053608 12.8837787,37.9593256 13.0076755,36.5435753 C13.5954311,32.0424877 15.6351988,23.7957814 18.7008944,20.4626497 C23.7836938,14.8721746 29.1429953,14.2526894 32.6876585,13.8432248 C33.0261088,13.8039405 33.3418954,13.767678 33.6335066,13.7299046 C59.3255167,11.8895805 97.6459565,11.6161006 99.0209114,11.6055239 C100.395866,11.6145897 138.702708,11.8895805 164.166566,13.7299046 C164.47933,13.7691888 164.820803,13.8084734 165.187961,13.8507797 C168.833857,14.2662877 174.344252,14.8948384 179.401366,20.2888916 L179.448205,20.3387525 C182.590959,23.6129578 184.535537,31.9654297 185.029614,36.4876706 C185.117249,37.4773359 186.436299,52.7997702 186.436299,67.7097183 L186.436299,82.5290099 Z"/></svg> },
]

// ─── Social: Icons tab ────────────────────────────────────────────────────────

function SocialIconsTab({ block, onPatch }: { block: CanvasBlock; onPatch: (p: Partial<CanvasBlock>) => void }) {
  const iconStyle    = block.socialIconStyle    ?? 'outline'
  const iconColor    = block.socialIconColor    ?? '#1F2937'
  const iconSize     = block.socialIconSize     ?? 'M'
  const iconPosition = block.socialIconPosition ?? 'center'
  const iconSpacing  = block.socialIconSpacing  ?? 12

  return (
    <div className="flex-1 overflow-auto px-4 py-4 space-y-5">
      {/* Style — outline / filled */}
      <div>
        <SectionLabel>Style</SectionLabel>
        <div className="flex gap-2">
          {(['outline', 'filled'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onPatch({ socialIconStyle: id })}
              className={cn(
                'flex-1 rounded-xl border py-2 text-[11px] font-medium transition-colors',
                iconStyle === id
                  ? 'border-blue-400 bg-blue-50 text-blue-600'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
              )}
            >
              {id.charAt(0).toUpperCase() + id.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <ColorSwatch
        label="Color"
        value={iconColor}
        onChange={(v) => onPatch({ socialIconColor: v })}
      />

      {/* Size — S / M / L */}
      <div>
        <SectionLabel>Size</SectionLabel>
        <div className="flex gap-2">
          {([
            { id: 'S', hint: '32px' },
            { id: 'M', hint: '40px' },
            { id: 'L', hint: '48px' },
          ] as const).map(({ id, hint }) => (
            <button
              key={id}
              type="button"
              onClick={() => onPatch({ socialIconSize: id })}
              title={hint}
              className={cn(
                'flex-1 rounded-xl border py-2 text-[11px] font-medium transition-colors',
                iconSize === id
                  ? 'border-blue-400 bg-blue-50 text-blue-600'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
              )}
            >
              {id}
            </button>
          ))}
        </div>
      </div>

      {/* Position — left / center / right */}
      <div>
        <SectionLabel>Position</SectionLabel>
        <div className="flex gap-2">
          {(['left', 'center', 'right'] as const).map((align) => (
            <button
              key={align}
              type="button"
              onClick={() => onPatch({ socialIconPosition: align })}
              className={cn(
                'flex h-10 flex-1 items-center justify-center rounded-xl border transition-colors',
                iconPosition === align
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300',
              )}
            >
              <PositionIcon align={align} active={iconPosition === align} />
            </button>
          ))}
        </div>
      </div>

      {/* Spacing */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>Space between icons</SectionLabel>
          <span className="text-[11px] text-gray-500">{iconSpacing}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPatch({ socialIconSpacing: Math.max(4, iconSpacing - 2) })}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            −
          </button>
          <input
            type="range"
            min={4}
            max={32}
            step={2}
            value={iconSpacing}
            onChange={(e) => onPatch({ socialIconSpacing: Number(e.target.value) })}
            className="flex-1 accent-gray-800"
          />
          <button
            type="button"
            onClick={() => onPatch({ socialIconSpacing: Math.min(32, iconSpacing + 2) })}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Social: Links tab ────────────────────────────────────────────────────────

function SocialLinksSection({ block, onPatch }: { block: CanvasBlock; onPatch: (p: Partial<CanvasBlock>) => void }) {
  const [showModal, setShowModal] = useState(false)
  const [editKey, setEditKey] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')

  const socialLinks = block.socialLinks ?? {}
  const linkedPlatforms = SOCIAL_PLATFORMS.filter((p) => socialLinks[p.key])

  function openPlatform(key: string) {
    setEditKey(key)
    setUrlInput(socialLinks[key] ?? '')
  }

  function savePlatformUrl() {
    if (!editKey) return
    const next = { ...socialLinks }
    if (urlInput.trim()) {
      next[editKey] = urlInput.trim()
    } else {
      delete next[editKey]
    }
    onPatch({ socialLinks: next })
    setEditKey(null)
  }

  return (
    <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
      {/* Status */}
      {linkedPlatforms.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-center">
          <p className="text-[13px] font-semibold text-gray-800">Your social icons aren&apos;t linked</p>
          <p className="mt-1 text-[11px] text-gray-400">Add your social media links by clicking below:</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <SectionLabel>Linked accounts</SectionLabel>
          {linkedPlatforms.map((p) => (
            <div key={p.key} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center text-gray-500">{p.icon}</span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-gray-600">{socialLinks[p.key]}</span>
              <button
                type="button"
                onClick={() => openPlatform(p.key)}
                className="shrink-0 text-[10px] text-blue-500 hover:text-blue-700 transition-colors"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Manage button */}
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="w-full rounded-xl border border-gray-200 bg-white py-2.5 text-[12px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
      >
        Manage social links
      </button>

      {/* ── Modal: Platform grid ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-[16px] font-bold text-gray-900">Social links</p>
                <p className="mt-0.5 text-[11px] text-gray-400">Icons in your emails will automatically link to these URLs</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <XIcon size={15} />
              </button>
            </div>

            {/* Platform grid — 5 columns */}
            <div className="max-h-[60vh] overflow-auto px-6 py-4">
              <div className="grid grid-cols-5 gap-3">
                {SOCIAL_PLATFORMS.map((p) => {
                  const isLinked = !!socialLinks[p.key]
                  return (
                    <button
                      key={p.key}
                      type="button"
                      title={p.name}
                      onClick={() => { setShowModal(false); openPlatform(p.key) }}
                      className={cn(
                        'flex h-12 w-12 flex-col items-center justify-center rounded-full border-2 transition-all',
                        isLinked
                          ? 'border-blue-400 bg-blue-50 text-blue-600 ring-2 ring-blue-200'
                          : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-400 hover:bg-gray-100',
                      )}
                    >
                      {p.icon}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: URL input for a single platform ── */}
      {editKey && (() => {
        const platform = SOCIAL_PLATFORMS.find((p) => p.key === editKey)!
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4">
                <p className="text-[18px] font-bold text-gray-900">{platform.name} link</p>
                <button
                  type="button"
                  onClick={() => setEditKey(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                >
                  <XIcon size={15} />
                </button>
              </div>

              {/* URL input */}
              <div className="px-6 pb-6">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') savePlatformUrl() }}
                  placeholder="https://..."
                  autoFocus
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[13px] text-gray-800 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
                />

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between gap-3">
                  {socialLinks[editKey] && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...socialLinks }
                        delete next[editKey]
                        onPatch({ socialLinks: next })
                        setEditKey(null)
                      }}
                      className="text-[11px] text-red-400 hover:text-red-600 transition-colors"
                    >
                      Remove link
                    </button>
                  )}
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditKey(null)}
                      className="rounded-xl border border-gray-200 px-5 py-2 text-[12px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={savePlatformUrl}
                      disabled={!urlInput.trim()}
                      className={cn(
                        'rounded-xl px-5 py-2 text-[12px] font-semibold transition-colors',
                        urlInput.trim()
                          ? 'bg-gray-900 text-white hover:bg-gray-700'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                      )}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Tab: Block ────────────────────────────────────────────────────────────────

function BlockTab({ block, onPatch }: { block: CanvasBlock; onPatch: (p: Partial<CanvasBlock>) => void }) {
  const bg  = block.backgroundColor ?? '#ffffff'
  const pad = block.padding ?? { top: 0, right: 0, bottom: 0, left: 0 }
  const spacerH = block.spacerHeight ?? 64
  const contentH = block.contentHeight ?? 200
  const logoWidth = block.logoWidth ?? 120

  return (
    <div className="flex-1 overflow-auto px-4 py-4 space-y-5">

      {/* Logo width — only shown for logo blocks */}
      {block.type === 'logo' && (
        <div>
          <SectionLabel>Logo Width</SectionLabel>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={40}
              max={300}
              step={4}
              value={logoWidth}
              onChange={(e) => onPatch({ logoWidth: Number(e.target.value) })}
              className="flex-1 accent-gray-800"
            />
            <div className="flex items-center gap-1 rounded-xl border border-gray-200 px-2.5 py-2 w-20 shrink-0">
              <input
                type="number"
                min={40}
                max={300}
                value={logoWidth}
                onChange={(e) => onPatch({ logoWidth: Math.max(40, Math.min(300, Number(e.target.value))) })}
                className="w-full text-[12px] text-gray-700 focus:outline-none"
              />
              <span className="text-[9px] text-gray-300">px</span>
            </div>
          </div>
        </div>
      )}

      {/* Spacer height — only shown for spacer blocks */}
      {block.type === 'spacer' && (
        <div>
          <SectionLabel>Height</SectionLabel>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={8}
              max={320}
              step={4}
              value={spacerH}
              onChange={(e) => onPatch({ spacerHeight: Number(e.target.value) })}
              className="flex-1 accent-gray-800"
            />
            <div className="flex items-center gap-1 rounded-xl border border-gray-200 px-2.5 py-2 w-20 shrink-0">
              <input
                type="number"
                min={8}
                max={320}
                value={spacerH}
                onChange={(e) => onPatch({ spacerHeight: Math.max(8, Math.min(320, Number(e.target.value))) })}
                className="w-full text-[12px] text-gray-700 focus:outline-none"
              />
              <span className="text-[9px] text-gray-300">px</span>
            </div>
          </div>
        </div>
      )}

      {/* Content block height — only shown when a layout is active */}
      {block.type === 'content' && block.contentLayout && (
        <div>
          <SectionLabel>Min Height</SectionLabel>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={80}
              max={800}
              step={8}
              value={contentH}
              onChange={(e) => onPatch({ contentHeight: Number(e.target.value) })}
              className="flex-1 accent-gray-800"
            />
            <div className="flex items-center gap-1 rounded-xl border border-gray-200 px-2.5 py-2 w-20 shrink-0">
              <input
                type="number"
                min={80}
                max={800}
                value={contentH}
                onChange={(e) => onPatch({ contentHeight: Math.max(80, Math.min(800, Number(e.target.value))) })}
                className="w-full text-[12px] text-gray-700 focus:outline-none"
              />
              <span className="text-[9px] text-gray-300">px</span>
            </div>
          </div>
        </div>
      )}

      {/* Link Bar items — only shown for link-bar blocks */}
      {block.type === 'link-bar' && (
        <LinkBarEditor block={block} onPatch={onPatch} />
      )}

      {/* Footer links — only shown for footer blocks */}
      {block.type === 'footer' && (
        <FooterEditor block={block} onPatch={onPatch} />
      )}

      {/* Background */}
      <div>
        <ColorSwatch
          label="Background"
          value={bg}
          onChange={(v) => onPatch({ backgroundColor: v })}
        />
        {bg !== '#ffffff' && (
          <button
            type="button"
            onClick={() => onPatch({ backgroundColor: '#ffffff' })}
            className="mt-1.5 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            Reset to white
          </button>
        )}
      </div>

      {/* Padding */}
      <div>
        <SectionLabel>Padding</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <div key={side} className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-2.5 py-2">
              <span className="w-4 text-[9px] uppercase text-gray-400">{side[0]}</span>
              <input
                type="number"
                min={0}
                max={80}
                value={pad[side]}
                onChange={(e) => onPatch({ padding: { ...pad, [side]: Number(e.target.value) } })}
                className="w-full text-[12px] text-gray-700 focus:outline-none"
              />
              <span className="text-[9px] text-gray-300">px</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Font ─────────────────────────────────────────────────────────────────

function FontTab({
  block,
  onPatch,
  activeTextKey,
}: {
  block: CanvasBlock
  onPatch: (p: Partial<CanvasBlock>) => void
  activeTextKey?: string
}) {
  // When a text field is focused, read/write its per-field style override.
  // Otherwise fall back to block-level font properties.
  const fieldStyle = activeTextKey ? (block.textStyles?.[activeTextKey] ?? {}) : null
  const usingField = fieldStyle !== null

  const patchField = (updates: NonNullable<CanvasBlock['textStyles']>[string]) => {
    if (!activeTextKey) return
    onPatch({
      textStyles: {
        ...(block.textStyles ?? {}),
        [activeTextKey]: { ...(block.textStyles?.[activeTextKey] ?? {}), ...updates },
      },
    })
  }

  const clearField = () => {
    if (!activeTextKey) return
    const next = { ...(block.textStyles ?? {}) }
    delete next[activeTextKey]
    onPatch({ textStyles: Object.keys(next).length ? next : undefined })
  }

  // Resolved values — field overrides take priority over block defaults
  const currentFont     = (fieldStyle ? fieldStyle.fontFamily  : block.fontFamily)  ?? 'Arial'
  const currentSize     = (fieldStyle ? fieldStyle.fontSize     : block.fontSize)    ?? 16
  const currentColor    = (fieldStyle ? fieldStyle.fontColor    : block.fontColor)   ?? '#111827'
  const currentWeight   = (fieldStyle ? fieldStyle.fontWeight   : block.fontWeight)  ?? ((fieldStyle ? fieldStyle.fontBold : block.fontBold) ? 700 : 400)
  const currentBold     = (fieldStyle ? fieldStyle.fontBold     : block.fontBold)    ?? false
  const currentItalic   = (fieldStyle ? fieldStyle.fontItalic   : block.fontItalic)  ?? false
  const currentUnderline = (fieldStyle ? fieldStyle.fontUnderline : block.fontUnderline) ?? false
  const currentAlign    = (fieldStyle ? fieldStyle.textAlign    : block.textAlign)   ?? 'left'
  const currentLH       = (fieldStyle ? fieldStyle.lineHeight   : block.lineHeight)  ?? 1.6
  const currentLS       = (fieldStyle ? fieldStyle.letterSpacing : block.letterSpacing) ?? 0
  const currentCase     = (fieldStyle ? fieldStyle.fontCase     : block.fontCase)    ?? 'none'

  const isUnknownFont   = !!currentFont && !ALL_KNOWN_FONTS.has(currentFont)

  const value: TextStyleValue = {
    fontFamily: currentFont,
    fontWeight: currentWeight,
    fontSize: currentSize,
    color: currentColor,
    bold: currentBold,
    italic: currentItalic,
    underline: currentUnderline,
    textCase: currentCase,
    textAlign: currentAlign,
    lineHeight: currentLH,
    letterSpacing: currentLS,
  }

  const handleChange = (patch: Partial<TextStyleValue>) => {
    // Translate the flat patch back to the email block model. Each property
    // routes either to per-field override (patchField) or block default (onPatch).
    const blockPatch: Partial<CanvasBlock> = {}
    const fieldPatch: NonNullable<CanvasBlock['textStyles']>[string] = {}

    if ('fontFamily' in patch && patch.fontFamily !== undefined) {
      if (usingField) fieldPatch.fontFamily = patch.fontFamily
      else blockPatch.fontFamily = patch.fontFamily
    }
    if ('fontWeight' in patch && patch.fontWeight !== undefined) {
      if (usingField) fieldPatch.fontWeight = patch.fontWeight
      else blockPatch.fontWeight = patch.fontWeight
    }
    if ('fontSize' in patch && patch.fontSize !== undefined) {
      if (usingField) fieldPatch.fontSize = patch.fontSize
      else blockPatch.fontSize = patch.fontSize
    }
    if ('color' in patch && patch.color !== undefined) {
      if (usingField) fieldPatch.fontColor = patch.color
      else blockPatch.fontColor = patch.color
    }
    if ('bold' in patch && patch.bold !== undefined) {
      if (usingField) fieldPatch.fontBold = patch.bold
      else blockPatch.fontBold = patch.bold
    }
    if ('italic' in patch && patch.italic !== undefined) {
      if (usingField) fieldPatch.fontItalic = patch.italic
      else blockPatch.fontItalic = patch.italic
    }
    if ('underline' in patch && patch.underline !== undefined) {
      if (usingField) fieldPatch.fontUnderline = patch.underline
      else blockPatch.fontUnderline = patch.underline
    }
    if ('textAlign' in patch && patch.textAlign !== undefined) {
      if (usingField) fieldPatch.textAlign = patch.textAlign
      else blockPatch.textAlign = patch.textAlign
    }
    if ('lineHeight' in patch && patch.lineHeight !== undefined) {
      if (usingField) fieldPatch.lineHeight = patch.lineHeight
      else blockPatch.lineHeight = patch.lineHeight
    }
    if ('letterSpacing' in patch && patch.letterSpacing !== undefined) {
      if (usingField) fieldPatch.letterSpacing = patch.letterSpacing
      else blockPatch.letterSpacing = patch.letterSpacing
    }
    if ('textCase' in patch && patch.textCase !== undefined) {
      if (usingField) fieldPatch.fontCase = patch.textCase
      else blockPatch.fontCase = patch.textCase
    }

    if (usingField && Object.keys(fieldPatch).length) patchField(fieldPatch)
    if (Object.keys(blockPatch).length) onPatch(blockPatch)
  }

  return (
    <div className="flex-1 overflow-auto px-4 py-4 space-y-4">

      {/* ── Active field indicator ───────────────────────────────────────────── */}
      {activeTextKey && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
          <span className="text-[11px] font-medium text-blue-700 capitalize">
            Editing: <strong>{activeTextKey.replace(/-/g, ' ')}</strong>
          </span>
          {block.textStyles?.[activeTextKey] && (
            <button
              onClick={clearField}
              className="text-[10px] text-blue-500 hover:text-blue-700 underline transition-colors"
              title="Reset to block style"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* ── Unknown-font warning ─────────────────────────────────────────────── */}
      {isUnknownFont && (
        <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-amber-700">Font not available in editor</p>
            <p className="mt-0.5 text-[10px] leading-snug text-amber-600">
              <span className="font-mono">&ldquo;{currentFont}&rdquo;</span> isn&apos;t in
              the font list and won&apos;t render correctly in the email.
              Please select a replacement below.
            </p>
          </div>
        </div>
      )}

      <TextStyleControls value={value} onChange={handleChange} orientation="horizontal" />

      {/* Block-level defaults separator */}
      {activeTextKey && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-[10px] text-gray-400 text-center">
            Changes above apply to the <strong>{activeTextKey.replace(/-/g, ' ')}</strong> field only.
            Click elsewhere to edit block-level defaults.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Button ───────────────────────────────────────────────────────────────

function PositionIcon({ align, active }: { align: 'left' | 'center' | 'right'; active: boolean }) {
  const accent = active ? '#3B82F6' : '#9CA3AF'
  const muted  = active ? '#BFDBFE' : '#E5E7EB'
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
      {align === 'left'   && <><rect x="0" y="3" width="13" height="10" rx="2" fill={accent} /><rect x="15" y="6" width="9" height="4" rx="1" fill={muted} /></>}
      {align === 'center' && <rect x="4" y="3" width="16" height="10" rx="2" fill={accent} />}
      {align === 'right'  && <><rect x="0" y="6" width="9" height="4" rx="1" fill={muted} /><rect x="11" y="3" width="13" height="10" rx="2" fill={accent} /></>}
    </svg>
  )
}

function ButtonTab({ block, onPatch }: { block: CanvasBlock; onPatch: (p: Partial<CanvasBlock>) => void }) {
  const selectedVariant = block.buttonShapeVariant ?? 0
  const fillColor       = block.buttonFillColor    ?? '#1F2937'
  const borderColor     = block.buttonBorderColor  ?? '#1F2937'
  const position        = block.buttonPosition     ?? 'center'

  // Button font is stored in textStyles['button'] — same per-field mechanism as text fields
  const bf = block.textStyles?.['button'] ?? {}
  const patchBF = (updates: NonNullable<CanvasBlock['textStyles']>[string]) =>
    onPatch({ textStyles: { ...(block.textStyles ?? {}), button: { ...bf, ...updates } } })

  const bFont      = bf.fontFamily    ?? block.buttonFontFamily ?? block.fontFamily ?? 'Arial'
  const bSize      = bf.fontSize      ?? block.fontSize ?? 14
  const bWeight    = bf.fontWeight    ?? (bf.fontBold ? 700 : 600)
  const bBold      = bf.fontBold      ?? false
  const bItalic    = bf.fontItalic    ?? false
  const bUnderline = bf.fontUnderline ?? false
  const bCase      = bf.fontCase      ?? 'none'
  const bAlign     = bf.textAlign     ?? 'center'
  const bLH        = bf.lineHeight    ?? 1.2
  const bLS        = bf.letterSpacing ?? 0
  const isUnknown  = !!bFont && !ALL_KNOWN_FONTS.has(bFont)

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 py-4 space-y-5">

        {/* ── Shape ────────────────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Shape</SectionLabel>
          <div className="grid grid-cols-4 gap-2">
            {BUTTON_SHAPES.map((v) => (
              <button
                key={v.id}
                onClick={() => onPatch({ buttonShapeVariant: v.id })}
                title={`Style ${v.id + 1}`}
                style={{ borderRadius: v.radius }}
                className={cn(
                  'h-9 w-full border transition-all',
                  v.filled ? 'bg-gray-200 border-gray-200' : 'bg-white border-gray-300',
                  selectedVariant === v.id
                    ? 'ring-2 ring-blue-500 ring-offset-1'
                    : 'hover:ring-1 hover:ring-gray-400',
                )}
              />
            ))}
          </div>
        </div>

        {/* ── Colors ───────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <ColorSwatch label="Fill color"   value={fillColor}   onChange={(v) => onPatch({ buttonFillColor: v })} />
          <ColorSwatch label="Border color" value={borderColor} onChange={(v) => onPatch({ buttonBorderColor: v })} />
        </div>

        {/* ── Position ─────────────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Position</SectionLabel>
          <div className="flex gap-2">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                onClick={() => onPatch({ buttonPosition: align })}
                className={cn(
                  'flex h-10 flex-1 items-center justify-center rounded-xl border transition-colors',
                  position === align ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <PositionIcon align={align} active={position === align} />
              </button>
            ))}
          </div>
        </div>

        {/* ── Font Family + Weight ──────────────────────────────────────────── */}
        <div>
          <SectionLabel>Font</SectionLabel>
          <div className="flex gap-2">
            <select
              value={ALL_KNOWN_FONTS.has(bFont) ? bFont : ''}
              onChange={(e) => { patchBF({ fontFamily: e.target.value }); onPatch({ buttonFontFamily: e.target.value }) }}
              className={cn(
                'min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-[12px] text-gray-700 focus:outline-none',
                isUnknown ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white focus:border-blue-400',
              )}
            >
              {isUnknown && <option value="" disabled>— select a font —</option>}
              <optgroup label="System Fonts">
                {SYSTEM_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </optgroup>
              <optgroup label="Google Fonts">
                {GOOGLE_FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </optgroup>
            </select>
            <select
              value={bWeight}
              onChange={(e) => patchBF({ fontWeight: Number(e.target.value) })}
              className="w-[108px] shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[12px] text-gray-700 focus:outline-none focus:border-blue-400"
            >
              <option value={100}>Thin</option>
              <option value={200}>Extra Light</option>
              <option value={300}>Light</option>
              <option value={400}>Regular</option>
              <option value={500}>Medium</option>
              <option value={600}>Semi Bold</option>
              <option value={700}>Bold</option>
              <option value={800}>Extra Bold</option>
              <option value={900}>Black</option>
            </select>
          </div>
        </div>

        {/* ── Size ─────────────────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Size</SectionLabel>
          <div className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2.5">
            <input
              type="number" min={8} max={48}
              value={bSize}
              onChange={(e) => patchBF({ fontSize: Number(e.target.value) })}
              className="w-full text-[12px] text-gray-700 focus:outline-none"
            />
            <span className="text-[10px] text-gray-400">px</span>
          </div>
        </div>

        {/* ── Style toggles ─────────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Style</SectionLabel>
          <div className="flex gap-2">
            {[
              { icon: <Bold size={13} />,      active: bBold,      handler: () => patchBF({ fontBold: !bBold }),           label: 'Bold' },
              { icon: <Italic size={13} />,    active: bItalic,    handler: () => patchBF({ fontItalic: !bItalic }),       label: 'Italic' },
              { icon: <Underline size={13} />, active: bUnderline, handler: () => patchBF({ fontUnderline: !bUnderline }), label: 'Underline' },
            ].map(({ icon, active, handler, label }) => (
              <button key={label} title={label} onClick={handler}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
                  active ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
                )}
              >{icon}</button>
            ))}
          </div>
        </div>

        {/* ── Case ──────────────────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Case</SectionLabel>
          <div className="flex gap-2">
            {([
              { value: 'none',      label: 'aA', title: 'Default' },
              { value: 'lowercase', label: 'aa', title: 'Lowercase' },
              { value: 'uppercase', label: 'AA', title: 'Uppercase' },
            ] as const).map(({ value, label, title }) => (
              <button key={value} title={title} onClick={() => patchBF({ fontCase: value })}
                className={cn(
                  'flex h-9 flex-1 items-center justify-center rounded-xl border text-[12px] font-semibold transition-colors',
                  bCase === value ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
                )}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* ── Alignment ─────────────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Text Align</SectionLabel>
          <div className="flex gap-2">
            {([
              { value: 'left',   icon: <AlignLeft   size={14} /> },
              { value: 'center', icon: <AlignCenter size={14} /> },
              { value: 'right',  icon: <AlignRight  size={14} /> },
            ] as const).map(({ value, icon }) => (
              <button key={value} onClick={() => patchBF({ textAlign: value })}
                className={cn(
                  'flex h-9 flex-1 items-center justify-center rounded-xl border transition-colors',
                  bAlign === value ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
                )}
              >{icon}</button>
            ))}
          </div>
        </div>

        {/* ── Line Height & Letter Spacing ──────────────────────────────────── */}
        {([
          { label: 'Line Height',    value: bLH, min: 0.8, max: 3,  step: 0.1, handler: (v: number) => patchBF({ lineHeight: v }) },
          { label: 'Letter Spacing', value: bLS, min: -2,  max: 20, step: 0.5, handler: (v: number) => patchBF({ letterSpacing: v }) },
        ] as const).map(({ label, value, min, max, step, handler }) => (
          <div key={label}>
            <div className="mb-1.5 flex items-center justify-between">
              <SectionLabel>{label}</SectionLabel>
              <span className="text-[10px] text-gray-400">{value.toFixed(1)}</span>
            </div>
            <input
              type="range" min={min} max={max} step={step} value={value}
              onChange={(e) => handler(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
        ))}

      </div>

      {/* ── Border & sizing accordion ──────────────────────────────────────── */}
      <Accordion title="Border and sizing">
        <div className="space-y-3">
          {[
            { label: 'Border Width', key: 'buttonBorderWidth' as const, min: 0,  max: 10,  unit: 'px', def: 1   },
            { label: 'Button Width', key: 'buttonWidth'       as const, min: 60, max: 500, unit: 'px', def: 160 },
            { label: 'Button Height',key: 'buttonHeight'      as const, min: 28, max: 120, unit: 'px', def: 44  },
          ].map(({ label, key, min, max, unit, def }) => (
            <div key={key}>
              <label className="mb-1.5 block text-[10px] font-medium text-gray-500">{label}</label>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
                <input
                  type="number" min={min} max={max}
                  value={(block[key] as number | undefined) ?? def}
                  onChange={(e) => onPatch({ [key]: Number(e.target.value) })}
                  className="w-full text-[12px] text-gray-700 focus:outline-none"
                />
                <span className="text-[10px] text-gray-400">{unit}</span>
              </div>
            </div>
          ))}
        </div>
      </Accordion>
    </div>
  )
}

// ─── Tab: Image ────────────────────────────────────────────────────────────────

function ImageTab({
  block, onPatch, onImageUpload,
}: {
  block: CanvasBlock
  onPatch: (p: Partial<CanvasBlock>) => void
  onImageUpload: (src: string) => void
}) {
  const selectedShape = block.imageShape ?? 'circle'

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onImageUpload(reader.result)
        }
      }
      reader.readAsDataURL(file)
      // Reset the input so the same file can be re-selected
      e.target.value = ''
    },
    [onImageUpload],
  )

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 py-4 space-y-5">
        {/* Shape grid */}
        <div>
          <SectionLabel>Shape</SectionLabel>
          <div className="grid grid-cols-6 gap-1.5">
            {IMAGE_SHAPES.map((shape) => (
              <button
                key={shape.id}
                onClick={() => onPatch({ imageShape: shape.id })}
                title={shape.id ?? ''}
                className={cn(
                  'flex h-9 items-center justify-center rounded-lg border transition-all',
                  selectedShape === shape.id
                    ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-400 ring-offset-1'
                    : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                  <path d={shape.path} fill={selectedShape === shape.id ? '#3B82F6' : '#D1D5DB'} />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Upload */}
        <div>
          <SectionLabel>Add image from…</SectionLabel>
          <div className="mb-3 flex items-center justify-between rounded-xl border border-gray-200 px-4 py-2.5 text-[12px] text-gray-700">
            My computer
            <ChevronDown size={13} className="text-gray-400" />
          </div>
          {/* Hidden file input — label acts as the clickable upload area */}
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-6 text-[12px] text-gray-400 transition-colors hover:border-blue-300 hover:text-blue-500">
            <Upload size={15} />
            Upload image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
          <p className="mt-2 text-center text-[10px] text-gray-400">Max image size 10MB</p>
        </div>
      </div>

      <Accordion title="Overlay effects">
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-medium text-gray-500">Overlay colour</label>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
              <input type="color" defaultValue="#000000" className="h-5 w-5 cursor-pointer rounded-full border-0 bg-transparent p-0" />
              <span className="flex-1 text-[12px] text-gray-600">#000000</span>
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] font-medium text-gray-500">Opacity</label>
              <span className="text-[10px] text-gray-400">0%</span>
            </div>
            <input type="range" min={0} max={100} defaultValue={0} className="w-full accent-blue-500" />
          </div>
        </div>
      </Accordion>

      <Accordion title="Accessibility">
        <div>
          <label className="mb-1.5 block text-[10px] font-medium text-gray-500">Alt text</label>
          <input
            type="text"
            placeholder="Describe the image…"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[12px] text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
          />
          <p className="mt-1 text-[9px] text-gray-400">Shown when the image cannot load</p>
        </div>
      </Accordion>
    </div>
  )
}

// ─── Tab: Link ─────────────────────────────────────────────────────────────────

function LinkTab({ block, onPatch }: { block: CanvasBlock; onPatch: (p: Partial<CanvasBlock>) => void }) {
  const [showActions, setShowActions] = useState(false)
  const linkType = block.linkType ?? 'url'

  return (
    <div className="flex-1 overflow-auto px-4 py-4">
      {/* Sub-tabs */}
      <div className="mb-4 flex rounded-xl bg-gray-100 p-0.5">
        {(['url', 'file', 'checkout'] as const).map((t) => (
          <button
            key={t}
            onClick={() => onPatch({ linkType: t })}
            className={cn(
              'flex-1 rounded-lg py-1.5 text-[11px] font-medium capitalize transition-colors',
              linkType === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {t === 'url' ? 'URL' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* URL input */}
      {linkType === 'url' && (
        <textarea
          value={block.linkUrl ?? ''}
          onChange={(e) => onPatch({ linkUrl: e.target.value })}
          placeholder="https://"
          rows={5}
          className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-[12px] text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
        />
      )}

      {linkType === 'file' && (
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-8 text-[12px] text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
          <Upload size={15} />
          Upload a file
        </button>
      )}

      {linkType === 'checkout' && (
        <div className="rounded-xl border border-gray-200 px-4 py-4 text-[12px] text-gray-400">
          Connect a checkout page
        </div>
      )}

      {/* Link actions */}
      <div className="mt-5">
        <p className="text-[13px] font-semibold text-gray-800">Link actions</p>
        <p className="mt-0.5 mb-3 text-[11px] text-gray-400">When a subscriber clicks this link:</p>

        <div className="relative">
          <button
            onClick={() => setShowActions((o) => !o)}
            className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-[12px] text-gray-500 transition-colors hover:border-gray-300"
          >
            <span>{block.linkAction ?? 'Choose action'}</span>
            <ChevronDown size={13} className={cn('text-gray-400 transition-transform', showActions && 'rotate-180')} />
          </button>

          {showActions && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              {LINK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => { onPatch({ linkAction: action }); setShowActions(false) }}
                  className="w-full px-4 py-2.5 text-left text-[12px] text-gray-700 transition-colors hover:bg-gray-50"
                >
                  {action}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main: EmailRightNav ──────────────────────────────────────────────────────

export interface EmailRightNavProps {
  block: CanvasBlock
  onPatch: (id: string, patch: Partial<CanvasBlock>) => void
  onOpenImagePicker: (blockId: string, imageKey: string) => void
  /** Called when the user uploads an image directly from their computer via the Image tab */
  onImageUpload: (blockId: string, imageKey: string, src: string) => void
  onBack: () => void
  /**
   * Imperative tab-focus signal from the canvas.
   * `seq` increments on every click so the effect always fires, even if
   * the same tab is requested twice in a row.
   */
  focusTab?: { tab: string; seq: number }
  /** The text field key that currently has focus (e.g. 'heading', 'body') */
  activeTextKey?: string
}

export function EmailRightNav({ block, onPatch, onImageUpload, onBack, focusTab, activeTextKey }: EmailRightNavProps) {
  const tabs = getTabsForBlock(block.type)
  const [activeTab, setActiveTab] = useState<RightTab>(tabs[0].id)

  const patch = useCallback(
    (p: Partial<CanvasBlock>) => onPatch(block.id, p),
    [block.id, onPatch],
  )

  // Switch to the tab requested by a canvas click (text → font, button → button)
  useEffect(() => {
    if (!focusTab?.tab) return
    const found = tabs.find((t) => t.id === focusTab.tab)
    if (found) setActiveTab(found.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTab?.seq])

  // If block type changes (e.g. user selects different block), resolve tab
  const resolvedTab = tabs.some((t) => t.id === activeTab) ? activeTab : tabs[0].id

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center border-b border-gray-100 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-3 py-2.5 text-[12px] font-medium transition-colors border-b-2 -mb-px',
              resolvedTab === tab.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-700',
            )}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={onBack}
          className="ml-auto px-3 text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
          title="Deselect block"
        >
          ✕
        </button>
      </div>

      {/* Tab content */}
      {resolvedTab === 'icons'  && <SocialIconsTab block={block} onPatch={patch} />}
      {resolvedTab === 'links'  && <SocialLinksSection block={block} onPatch={patch} />}
      {resolvedTab === 'block'  && <BlockTab  block={block} onPatch={patch} />}
      {resolvedTab === 'font'   && <FontTab   block={block} onPatch={patch} activeTextKey={activeTextKey} />}
      {resolvedTab === 'button' && <ButtonTab block={block} onPatch={patch} />}
      {resolvedTab === 'image'  && (
        <ImageTab
          block={block}
          onPatch={patch}
          onImageUpload={(src) => {
            // testimonial uses 'avatar' key; recipe-card uses 'main'
            const imageKey = block.type === 'testimonial' ? 'avatar' : 'main'
            onImageUpload(block.id, imageKey, src)
          }}
        />
      )}
      {resolvedTab === 'link'   && <LinkTab   block={block} onPatch={patch} />}
    </div>
  )
}
