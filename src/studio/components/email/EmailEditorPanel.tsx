'use client'

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  Layers, LayoutGrid, Palette, FileText,
  Monitor, Smartphone, ChevronUp, ChevronDown, Trash2,
  Type, Plus, X, MousePointer2, ChevronsUpDown,
  Star, Link2, Share2, MapPin, Mail, Layout,
  Save, FolderOpen, ChevronDown as ChevronDownIcon, Check, Loader2, PlusCircle,
  Image as ImageIcon, Eye, EyeOff,
} from 'lucide-react'
import type { EmailerMeta } from '@studio/types/emailer'
import type { CanvasBlock } from '@studio/types/canvas'
import { nanoid } from 'nanoid'
import { cn } from '@studio/lib/utils'
import { useEmailStore } from '@studio/lib/email/emailStore'
import { BlockLibrary } from './BlockLibrary'
import { FloatingActionBar } from './FloatingActionBar'
import { ApprovedImagesPanel } from '@studio/components/canvas/ApprovedImagesPanel'
import { AllyvateAssistant, type AllyContext } from '@studio/components/ai/AllyvateAssistant'
import { EmailRightNav } from './EmailRightNav'
import { SendTestEmailPanel } from './SendTestEmailPanel'
import { ExportMenu, type ExportFormat } from '@studio/components/shared/ExportMenu'
import { GOOGLE_FONT_FAMILIES, getGoogleFontStylesheetHrefs } from '@studio/lib/canvas/googleFonts'
import { SPECS } from '@studio/lib/email/blockSpecs'

// ─── Types ────────────────────────────────────────────────────────────────────
// CanvasBlock is imported from @/types/canvas (shared with canvasConverter)
// Re-export so existing imports of CanvasBlock from this file continue to work.
export type { CanvasBlock } from '@studio/types/canvas'

type EmailTab = 'tree' | 'sections' | 'text' | 'content' | 'style'

// afterId: null = insert at very top; string = insert after that block id
type InsertState = { afterId: string | null } | null

// ─── Canvas block type palette (structural blocks from left nav) ──────────────

const CANVAS_BLOCK_TYPES = [
  { id: 'logo',     label: 'Logo',     Icon: Star },
  { id: 'link-bar', label: 'Link Bar', Icon: Link2 },
  { id: 'content',  label: 'Content',  Icon: Layout },
  { id: 'text',     label: 'Text',     Icon: Type },
  { id: 'button',   label: 'Button',   Icon: MousePointer2 },
  { id: 'social',   label: 'Social',   Icon: Share2 },
  { id: 'address',  label: 'Address',  Icon: MapPin },
  { id: 'footer',   label: 'Footer',   Icon: Mail },
  { id: 'spacer',   label: 'Spacer',   Icon: ChevronsUpDown },
] as const

// Map all block type ids → display label (structural + prebuilt design blocks)
const BLOCK_LABEL: Record<string, string> = {
  'logo':                  'Logo',
  'link-bar':              'Link Bar',
  'content':               'Content',
  'text':                  'Text',
  'button':                'Button',
  'social':                'Social',
  'address':               'Address',
  'footer':                'Footer',
  'spacer':                'Spacer',
  'image-left-text-right': 'Image Left, Text Right',
  'centered-content':      'Centered Content',
  'text-over-image':       'Text Over Image',
  'text-left-image-right': 'Text Left, Image Right',
  'recipe-card':           'Recipe Card',
  'image-top-text-bottom': 'Image Top, Text Bottom',
  'testimonial':           'Testimonial',
}

// Web-safe system fonts for the global body font picker
const SYSTEM_FONTS_EMAIL = [
  'Arial', 'Georgia', 'Helvetica', 'Tahoma',
  'Times New Roman', 'Trebuchet MS', 'Verdana', 'Courier New',
]

// ─── Default canvas (email content flow) ─────────────────────────────────────

// Social platform definitions used in the canvas renderer
// (a lightweight list — just the platforms we want to display as icons on canvas)
const SOCIAL_PLATFORMS_CANVAS: { key: string; title: string; svg: React.ReactNode }[] = [
  { key: 'facebook',  title: 'Facebook',  svg: <svg viewBox="0 0 76 151" xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="h-5 w-5"><path d="M48.8868895,150 L48.8868895,81.5829675 L71.0820271,81.5829675 L74.4119522,54.9117243 L48.8868895,54.9117243 L48.8868895,37.8860248 C48.8868895,30.1664959 50.9510317,24.9057297 61.6662481,24.9057297 L75.3103402,24.8999285 L75.3103402,1.04422486 C72.9507863,0.7270899 64.8512718,0 55.4242746,0 C35.7392011,0 22.2624467,12.4272427 22.2624467,35.2445227 L22.2624467,54.9117243 L0,54.9117243 L0,81.5829675 L22.2624467,81.5829675 L22.2624467,150 L48.8868895,150 Z"/></svg> },
  { key: 'instagram', title: 'Instagram', svg: <svg viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="h-5 w-5"><path d="M43.9385663,0.524533902 C35.9584855,0.901035204 30.5089304,2.17453961 25.7448821,4.04654608 C20.8143322,5.96805272 16.63529,8.54656163 12.4772479,12.7195761 C8.3192058,16.8925905 5.75867989,21.0746049 3.85066058,26.012622 C2.0041419,30.7871385 0.753129235,36.2411574 0.400625668,44.225685 C0.048122101,52.2102126 -0.0298786883,54.7767214 0.00912170636,75.1437918 C0.048122101,95.5108622 0.138123012,98.0638711 0.525126928,106.064899 C0.906130784,114.043426 2.17514363,119.491445 4.04716257,124.256962 C5.97168205,129.187479 8.54720811,133.364993 12.7217504,137.524507 C16.8962926,141.684022 21.0753349,144.238531 26.025385,146.149537 C30.7954333,147.993044 36.2509885,149.250048 44.2340692,149.599549 C52.21715,149.94905 54.786676,150.030051 75.1478821,149.991051 C95.5090881,149.95205 98.0726141,149.86205 106.072195,149.482549 C114.071776,149.103047 119.491331,147.825043 124.258379,145.962037 C129.188929,144.03303 133.369471,141.462021 137.526013,137.286007 C141.682555,133.109992 144.241581,128.924978 146.148101,123.983961 C147.996119,119.213944 149.251632,113.758425 149.598136,105.781398 C149.947639,97.7758701 150.03014,95.2198612 149.991139,74.8557908 C149.952139,54.4917204 149.860638,51.9387116 149.481134,43.940684 C149.10163,35.9426563 147.831118,30.5111376 145.960599,25.7426211 C144.033079,20.812104 141.460553,16.6375896 137.287511,12.4750752 C133.114469,8.31256082 128.926426,5.75505198 123.986876,3.85304541 C119.213828,2.00653902 113.761273,0.748034675 105.778192,0.403033482 C97.7951113,0.0580322898 95.2255853,-0.0304680161 74.8568791,0.00853211873 C54.488173,0.0475322535 51.9381472,0.134532554 43.9385663,0.524533902 M44.8145751,136.107003 C37.5020011,135.789001 33.5314609,134.573997 30.8854342,133.556994 C27.3813987,132.206989 24.8853734,130.574983 22.2483468,127.963474 C19.6113201,125.351965 17.9913037,122.846957 16.6232898,119.350445 C15.5957794,116.704435 14.3582669,112.738422 14.0162635,105.425897 C13.6442597,97.5223692 13.5662589,95.149361 13.5227585,75.1257918 C13.479258,55.1022226 13.5557588,52.7322144 13.9022623,44.825687 C14.2142655,37.5191618 15.4367778,33.544148 16.4522881,30.8996389 C17.8023018,27.3911268 19.4283182,24.8996182 22.0458447,22.264109 C24.6633712,19.6285999 27.1608965,18.0055943 30.6604319,16.6375896 C33.3034586,15.605586 37.2694988,14.3785818 44.5790727,14.0305806 C52.4886528,13.6555793 54.8586768,13.580579 74.8793794,13.5370789 C94.900082,13.4935787 97.276106,13.568579 105.188686,13.9165802 C112.49526,14.2345813 116.4718,15.4450855 119.113327,16.466589 C122.618862,17.8165937 125.113388,19.4380993 127.748914,22.0601083 C130.384441,24.6821174 132.008958,27.170626 133.376971,30.6776381 C134.410482,33.3131472 135.637494,37.2776609 135.982498,44.5916862 C136.359002,52.5012136 136.444502,54.8727218 136.480503,74.891791 C136.516503,94.9108602 136.446002,97.2883684 136.099499,105.191896 C135.779996,112.504421 134.567983,116.476435 133.549473,119.125444 C132.199459,122.627956 130.571943,125.125465 127.952916,127.759474 C125.33389,130.393483 122.839365,132.016488 119.338329,133.384493 C116.698303,134.414997 112.727762,135.645001 105.424188,135.993002 C97.5146084,136.365003 95.1445844,136.443004 75.1163818,136.486504 C55.0881791,136.530004 52.7256552,136.449004 44.8160751,136.107003 M105.956681,34.9151528 C105.962769,38.5555907 108.161365,41.8338524 111.527153,43.2210978 C114.89294,44.6083432 118.762982,43.8313356 121.332456,41.2524379 C123.901931,38.6735401 124.664746,34.800701 123.265158,31.4400458 C121.865569,28.0793906 118.579245,25.8928458 114.938785,25.9001035 C109.969341,25.9100535 105.948402,29.9457394 105.956681,34.9151528 M36.4909195,75.0747916 C36.5329913,96.3448651 53.8071661,113.548425 75.0728813,113.507996 C96.3385965,113.467424 113.554271,96.1948646 113.513842,74.9247911 C113.47327,53.6547176 96.1945951,36.4466581 74.9258798,36.4885815 C53.6571646,36.5306584 36.4504905,53.8077181 36.4909195,75.0747916 M50.0000776,75.0477915 C49.9728164,61.2403887 61.1438528,50.0251321 74.9513476,49.9977529 C88.7588424,49.9704739 99.9741883,61.1414212 100.001586,74.948824 C100.028883,88.7562268 88.8578758,99.9715126 75.0503811,99.998933 C68.4195228,100.012815 62.0547988,97.3916838 57.3567893,92.7122724 C52.6587798,88.0328611 50.0124476,81.6786088 50.0000776,75.0477915"/></svg> },
  { key: 'pinterest', title: 'Pinterest', svg: <svg viewBox="0 0 123 150" xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="h-5 w-5"><path d="M63.1421366,0 C21.9216112,0 0,26.3449432 0,55.0712443 C0,68.3937228 7.46387621,85.0069752 19.4117183,90.2759639 C21.2259855,91.0916258 22.213022,90.7447351 22.617237,89.0665341 C22.9744502,87.7914764 24.5443083,81.6505732 25.3057365,78.753567 C25.5407452,77.8254 25.4185406,77.0191134 24.6665128,76.1471989 C20.699566,71.5719917 17.5504495,63.2372392 17.5504495,55.4181351 C17.5504495,35.3828526 33.5216405,15.9288465 60.6980462,15.9288465 C84.1989159,15.9288465 100.640124,31.1545361 100.640124,52.9336475 C100.640124,77.5441372 87.5830411,94.5699084 70.6154132,94.5699084 C61.2244657,94.5699084 54.2306069,87.2195754 56.449089,78.1254135 C59.1281881,67.2967981 64.3829826,55.6525207 64.3829826,47.8427919 C64.3829826,40.8393497 60.4160358,35.0453373 52.3129359,35.0453373 C42.7527821,35.0453373 34.9974951,44.4863899 34.9974951,57.161964 C34.9974951,65.2154538 37.8552009,70.6532001 37.8552009,70.6532001 C37.8552009,70.6532001 28.3984509,108.754926 26.6405859,115.870873 C23.6700759,127.918294 27.0448008,147.428552 27.3362116,149.106754 C27.5148182,150.034921 28.5582568,150.325559 29.1410784,149.566149 C30.0717128,148.347344 41.5025358,132.080982 44.7080545,120.3242 C45.8736976,116.039631 50.6584747,98.6669689 50.6584747,98.6669689 C53.8075912,104.339101 62.8977276,109.092441 72.5800859,109.092441 C101.382752,109.092441 122.195122,83.8444226 122.195122,52.5117534 C122.091718,22.4728929 96.3159643,0 63.1421366,0 Z"/></svg> },
  { key: 'twitter',   title: 'X',         svg: <svg viewBox="0 0 147 150" xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="h-5 w-5"><path d="M87.3508403,63.5147631 L141.990998,0 L129.043029,0 L81.5989873,55.1489762 L43.7055701,0 L0,0 L57.3022823,83.3950194 L0,150 L12.9487023,150 L63.0508329,91.7608063 L103.069057,150 L146.774628,150 L87.3476602,63.5147631 L87.3508403,63.5147631 Z M69.6158174,84.1297488 L63.8099024,75.825485 L17.6143007,9.74754764 L37.502752,9.74754764 L74.7831405,63.0745615 L80.5890555,71.3788253 L129.049145,140.695712 L109.160694,140.695712 L69.6158174,84.1329289 L69.6158174,84.1297488 Z"/></svg> },
  { key: 'youtube',   title: 'YouTube',   svg: <svg viewBox="0 0 199 150" xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="h-5 w-5"><path d="M129.50411,66.1398527 L85.7518432,42.2005317 C83.2361295,40.8240663 80.2626011,40.8754381 77.7967484,42.3365164 C75.3293847,43.7991055 73.8577298,46.3828114 73.8577298,49.2505742 L73.8577298,96.7182401 C73.8577298,99.5724041 75.3203189,102.151577 77.7710625,103.615677 C79.0508281,104.380213 80.4695997,104.763991 81.8913938,104.763991 C83.1938232,104.763991 84.4992747,104.442161 85.7004714,103.795479 L129.454249,80.2686449 C132.051553,78.8710262 133.672791,76.1709778 133.684931,73.2201136 C133.695455,70.2692495 132.093859,67.5571135 129.50411,66.1398527 L129.50411,66.1398527 Z M85.4632541,90.7470083 L85.4632541,55.2701559 L118.163,73.1626981 L85.4632541,90.7470083 Z"/><path d="M196.585277,35.4028165 L196.576212,35.3121601 C196.408498,33.7181192 194.73891,19.5394657 187.846005,12.327753 C179.878823,3.84534017 170.846428,2.81487983 166.502478,2.32080261 C166.142874,2.28000716 165.81349,2.24223377 165.518857,2.20294916 L165.172852,2.16668662 C138.991297,0.262903614 99.451529,0.0030218784 99.0556631,0.0015109392 L99.0209114,0 L98.9861597,0.0015109392 C98.5902938,0.0030218784 59.0505256,0.262903614 32.633265,2.16668662 L32.284238,2.20294916 C32.0032031,2.24072293 31.6934607,2.27547424 31.3565211,2.31475885 C27.0624321,2.81034691 18.1267375,3.84231848 10.136891,12.6314517 C3.57186027,19.7661064 1.67412063,33.6410612 1.47920957,35.2003504 L1.45654539,35.4028165 C1.39761866,36.0661189 0,51.8569442 0,67.7097183 L0,82.5290099 C0,98.381784 1.39761866,114.17261 1.45654539,114.837423 L1.46712206,114.937145 C1.63483602,116.5055 3.3029129,130.424272 10.1640881,137.639007 C17.6553245,145.837362 27.1274022,146.922217 32.2222896,147.505439 C33.0276201,147.597607 33.7211413,147.676175 34.1940651,147.759277 L34.6518798,147.822737 C49.7688264,149.261151 97.1654781,149.969781 99.1750274,149.998489 L99.235465,150 L99.2959025,149.998489 C99.6917684,149.996978 139.230025,149.737097 165.41158,147.833313 L165.757585,147.79705 C166.088481,147.753233 166.460171,147.713949 166.868125,147.671643 C171.138039,147.218361 180.025384,146.277046 187.904932,137.607276 C194.469963,130.471111 196.369213,116.596156 196.562613,115.038378 L196.585277,114.835912 C196.644204,114.171099 198.043334,98.381784 198.043334,82.5290099 L198.043334,67.7097183 C198.043334,51.8569442 196.644204,36.0676297 196.585277,35.4028165 L196.585277,35.4028165 Z M186.436299,82.5290099 C186.436299,97.2017406 185.155022,112.312643 185.034147,113.699686 C184.541581,117.520851 182.539587,126.299408 179.340928,129.776079 C174.409223,135.201861 169.343044,135.739756 165.644265,136.131089 C165.197027,136.177928 164.783029,136.223257 164.408316,136.270095 C139.084975,138.101354 101.038015,138.382389 99.2853259,138.392965 C97.3195937,138.364257 50.6164632,137.649583 35.960353,136.288227 C35.2094163,136.165841 34.398042,136.072162 33.5428502,135.975462 C29.2049437,135.478363 23.2669528,134.798441 18.7008944,129.776079 L18.5936176,129.661248 C15.4508641,126.387042 13.5062856,118.17811 13.0122084,113.745014 C12.9200412,112.696422 11.6055239,97.4072283 11.6055239,82.5290099 L11.6055239,67.7097183 C11.6055239,53.053608 12.8837787,37.9593256 13.0076755,36.5435753 C13.5954311,32.0424877 15.6351988,23.7957814 18.7008944,20.4626497 C23.7836938,14.8721746 29.1429953,14.2526894 32.6876585,13.8432248 C33.0261088,13.8039405 33.3418954,13.767678 33.6335066,13.7299046 C59.3255167,11.8895805 97.6459565,11.6161006 99.0209114,11.6055239 C100.395866,11.6145897 138.702708,11.8895805 164.166566,13.7299046 C164.47933,13.7691888 164.820803,13.8084734 165.187961,13.8507797 C168.833857,14.2662877 174.344252,14.8948384 179.401366,20.2888916 L179.448205,20.3387525 C182.590959,23.6129578 184.535537,31.9654297 185.029614,36.4876706 C185.117249,37.4773359 186.436299,52.7997702 186.436299,67.7097183 L186.436299,82.5290099 Z"/></svg> },
]

const DEFAULT_LINK_BAR: { label: string; url: string }[] = [
  { label: 'Home',     url: '' },
  { label: 'About',    url: '' },
  { label: 'Products', url: '' },
  { label: 'Blog',     url: '' },
  { label: 'Contact',  url: '' },
]

/** Creates a new CanvasBlock with sensible defaults pre-populated for block types that need them. */
function makeNewBlock(type: string): CanvasBlock {
  const base: CanvasBlock = { id: nanoid(), type }
  if (type === 'link-bar') return { ...base, linkBarItems: [...DEFAULT_LINK_BAR] }
  if (type === 'spacer')   return { ...base, spacerHeight: 64 }
  return base
}

function makeDefaultBlocks(): CanvasBlock[] {
  return [
    { id: nanoid(), type: 'logo' },
    { id: nanoid(), type: 'link-bar', linkBarItems: [...DEFAULT_LINK_BAR] },
    { id: nanoid(), type: 'spacer', spacerHeight: 64 },
    { id: nanoid(), type: 'footer' },
  ]
}

// ─── Inline Block Inserter ────────────────────────────────────────────────────

function BlockInserter({
  onSelect,
  onClose,
}: {
  onSelect: (type: string) => void
  onClose: () => void
}) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2.5 my-1 mx-auto max-w-[640px] bg-blue-50 border border-blue-200 rounded-xl shadow-sm">
      <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mr-1 shrink-0">
        Add block:
      </span>
      <div className="flex items-center gap-1 flex-wrap flex-1">
        {CANVAS_BLOCK_TYPES.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-blue-200 hover:bg-blue-100 hover:border-blue-400 text-blue-700 text-[10px] font-medium transition-colors shadow-sm"
          >
            <Icon size={9} />
            {label}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors ml-1"
      >
        <X size={11} />
      </button>
    </div>
  )
}

// ─── Tree / Layer Panel ───────────────────────────────────────────────────────

interface TreePanelProps {
  blocks: CanvasBlock[]
  selectedId: string | null
  onSelect: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onDelete: (id: string) => void
}

function TreePanel({ blocks, selectedId, onSelect, onMoveUp, onMoveDown, onDelete }: TreePanelProps) {
  const getIcon = (type: string) => {
    const found = CANVAS_BLOCK_TYPES.find((b) => b.id === type)
    if (found) {
      const { Icon } = found
      return <Icon size={10} />
    }
    return <Layout size={10} />
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-center border-b border-gray-100 px-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Layer Tree
        </span>
      </div>

      <div className="flex-1 overflow-auto py-1">
        {blocks.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-[11px] text-gray-400">No blocks yet.</p>
            <p className="text-[10px] text-gray-300 mt-1">Add from Sections or Right Nav.</p>
          </div>
        ) : (
          blocks.map((block, i) => (
            <div
              key={block.id}
              onClick={() => onSelect(block.id)}
              className={cn(
                'group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors',
                selectedId === block.id ? 'bg-blue-50' : 'hover:bg-gray-50',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded',
                  selectedId === block.id
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-400',
                )}
              >
                {getIcon(block.type)}
              </span>
              <span
                className={cn(
                  'flex-1 truncate text-[11px] capitalize',
                  selectedId === block.id
                    ? 'font-medium text-blue-700'
                    : 'text-gray-600',
                )}
              >
                {BLOCK_LABEL[block.type] ?? block.type}
              </span>
              <div
                className={cn(
                  'flex items-center gap-0.5 transition-opacity',
                  selectedId === block.id
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100',
                )}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveUp(block.id) }}
                  disabled={i === 0}
                  className="flex h-4 w-4 items-center justify-center rounded text-gray-300 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-20"
                >
                  <ChevronUp size={9} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveDown(block.id) }}
                  disabled={i === blocks.length - 1}
                  className="flex h-4 w-4 items-center justify-center rounded text-gray-300 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-20"
                >
                  <ChevronDown size={9} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(block.id) }}
                  className="flex h-4 w-4 items-center justify-center rounded text-gray-300 hover:bg-red-50 hover:text-red-400"
                >
                  <Trash2 size={9} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Sections Panel ───────────────────────────────────────────────────────────

function SectionsPanel({
  onInsert,
  onBlockDragStart,
  onBlockDragEnd,
}: {
  onInsert: (type: string) => void
  onBlockDragStart?: (type: string) => void
  onBlockDragEnd?: () => void
}) {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="px-3 pb-3 pt-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Email Blocks
        </p>
        <p className="mb-3 text-[10px] text-gray-400 leading-relaxed">
          Click to insert · Drag into a Content block
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {CANVAS_BLOCK_TYPES.map(({ id, label, Icon }) => (
            <button
              key={id}
              draggable
              onClick={() => onInsert(id)}
              onDragStart={(e) => {
                e.dataTransfer.setData('blockType', id)
                e.dataTransfer.effectAllowed = 'copy'
                onBlockDragStart?.(id)
              }}
              onDragEnd={onBlockDragEnd}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-2.5 text-center transition-all hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm active:scale-95 cursor-grab active:cursor-grabbing"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-500">
                <Icon size={13} />
              </div>
              <span className="text-[9px] font-medium leading-tight text-gray-500">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Text Blocks Panel ────────────────────────────────────────────────────────

function TextBlocksPanel({ onInsert }: { onInsert: (type: string) => void }) {
  const TEXT_STYLES = [
    { id: 'h1',      label: 'Heading 1',  preview: 'Heading 1',   cls: 'text-xl font-bold' },
    { id: 'h2',      label: 'Heading 2',  preview: 'Heading 2',   cls: 'text-lg font-semibold' },
    { id: 'h3',      label: 'Heading 3',  preview: 'Heading 3',   cls: 'text-base font-medium' },
    { id: 'body',    label: 'Body Text',  preview: 'Body copy',   cls: 'text-sm' },
    { id: 'caption', label: 'Caption',    preview: 'Caption text', cls: 'text-xs text-gray-500 italic' },
  ]

  return (
    <div className="flex flex-1 flex-col overflow-auto px-3 pb-3 pt-2">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Text Styles
      </p>
      <div className="flex flex-col gap-1.5">
        {TEXT_STYLES.map(({ id, label, preview, cls }) => (
          <button
            key={id}
            onClick={() => onInsert('text')}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left transition-all hover:border-blue-400 hover:bg-blue-50 active:scale-[0.99]"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-400 shrink-0">
              <Type size={11} />
            </div>
            <div className="min-w-0">
              <p className={cn('text-gray-700 leading-tight truncate', cls)}>{preview}</p>
              <p className="text-[9px] text-gray-400 mt-0.5">{label}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Content Panel (replaces Settings) ───────────────────────────────────────

function ContentPanel({
  selectedBlock,
  onBlockColorChange,
}: {
  selectedBlock: CanvasBlock | null
  onBlockColorChange: (id: string, color: string) => void
}) {
  const { document: doc, updateSubject, updatePreheader, updateGlobalStyles } = useEmailStore()

  return (
    <div className="flex flex-1 flex-col overflow-auto px-3 pb-3 pt-2">
      {selectedBlock ? (
        <>
          {/* Selected block badge */}
          <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-blue-400">Selected Block</p>
            <p className="mt-0.5 text-[12px] font-medium capitalize text-blue-800">
              {BLOCK_LABEL[selectedBlock.type] ?? selectedBlock.type}
            </p>
          </div>

          {/* Block background colour */}
          <Field label="Block Background">
            <div className="flex items-center gap-2">
              <ColorRow
                value={selectedBlock.backgroundColor ?? '#ffffff'}
                onChange={(v) => onBlockColorChange(selectedBlock.id, v)}
              />
              {selectedBlock.backgroundColor && selectedBlock.backgroundColor !== '#ffffff' && (
                <button
                  onClick={() => onBlockColorChange(selectedBlock.id, '#ffffff')}
                  title="Reset to white"
                  className="shrink-0 rounded border border-gray-200 px-2 py-1.5 text-[10px] text-gray-400 hover:border-gray-300 hover:text-gray-600"
                >
                  Reset
                </button>
              )}
            </div>
            <p className="mt-1 text-[10px] text-gray-400">
              Pick a colour to change this block&apos;s background
            </p>
          </Field>

          <div className="mb-3 h-px bg-gray-100" />
        </>
      ) : (
        <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-center">
          <p className="text-[11px] text-gray-400">Click a block on the canvas to style it</p>
        </div>
      )}

      <Field label="Subject Line">
        <input
          type="text"
          value={doc.subject}
          onChange={(e) => updateSubject(e.target.value)}
          placeholder="Your email subject…"
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
        />
      </Field>

      <Field label="Preheader Text">
        <textarea
          value={doc.preheader}
          onChange={(e) => updatePreheader(e.target.value)}
          placeholder="Preview text shown in inbox…"
          rows={2}
          className="w-full resize-none rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
        />
        <p className="mt-1 text-[10px] text-gray-400">Shown after subject line in most clients</p>
      </Field>

      <Field label="Unsubscribe Text">
        <textarea
          value={doc.globalStyles.unsubscribeText}
          onChange={(e) => updateGlobalStyles({ unsubscribeText: e.target.value })}
          rows={2}
          className="w-full resize-none rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
        />
        <p className="mt-1 text-[10px] text-gray-400">
          Use <code className="text-[10px]">[[unsubscribe]]</code> for the link
        </p>
      </Field>
    </div>
  )
}

// ─── Block Properties Panel (Right Nav — shown when a block is selected) ─────

const BG_SWATCHES = [
  '#ffffff','#f9fafb','#f3f4f6','#e5e7eb','#d1d5db',
  '#111827','#1f2937','#374151','#6b7280','#9ca3af',
  '#eff6ff','#dbeafe','#bfdbfe','#93c5fd','#3b82f6',
  '#fdf4ff','#fae8ff','#e9d5ff','#c084fc','#a855f7',
  '#fdf2f8','#fce7f3','#fbcfe8','#f9a8d4','#ec4899',
  '#fff7ed','#ffedd5','#fed7aa','#fb923c','#f97316',
  '#f0fdf4','#dcfce7','#bbf7d0','#86efac','#22c55e',
  '#fefce8','#fef9c3','#fef08a','#fde047','#eab308',
]

interface BlockPropertiesPanelProps {
  block: CanvasBlock
  onColorChange: (id: string, color: string) => void
  onBack: () => void
}

function BlockPropertiesPanel({ block, onColorChange, onBack }: BlockPropertiesPanelProps) {
  const bg = block.backgroundColor ?? '#ffffff'

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-gray-100 px-4">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Block Style
        </span>
        <button
          onClick={onBack}
          className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
        >
          ← Blocks
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">

        {/* Selected block badge */}
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-blue-400">
            Selected
          </p>
          <p className="mt-0.5 text-[12px] font-medium capitalize text-blue-800">
            {BLOCK_LABEL[block.type] ?? block.type}
          </p>
        </div>

        {/* Background colour */}
        <div>
          <label className="mb-2 block text-[10px] font-medium text-gray-500">
            Background Colour
          </label>

          {/* Native colour input + hex field row */}
          <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5">
            <input
              type="color"
              value={bg}
              onChange={(e) => onColorChange(block.id, e.target.value)}
              className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <input
              type="text"
              value={bg}
              onChange={(e) => {
                if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                  onColorChange(block.id, e.target.value)
                }
              }}
              maxLength={7}
              className="flex-1 text-[12px] text-gray-600 focus:outline-none"
            />
            {bg !== '#ffffff' && (
              <button
                onClick={() => onColorChange(block.id, '#ffffff')}
                className="shrink-0 rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors"
              >
                Reset
              </button>
            )}
          </div>

          {/* Swatch grid */}
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {BG_SWATCHES.map((colour) => (
              <button
                key={colour}
                onClick={() => onColorChange(block.id, colour)}
                title={colour}
                className={cn(
                  'h-8 w-full rounded-md border transition-transform hover:scale-105',
                  bg === colour ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200',
                )}
                style={{ backgroundColor: colour }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Style Panel ──────────────────────────────────────────────────────────────

function StylePanel() {
  const { document: doc, updateGlobalStyles } = useEmailStore()
  const g = doc.globalStyles

  return (
    <div className="flex flex-1 flex-col overflow-auto px-3 pb-3 pt-2">
      <Field label="Email Background">
        <ColorRow value={g.backgroundColor} onChange={(v) => updateGlobalStyles({ backgroundColor: v })} />
      </Field>

      <Field label="Body Font">
        <select
          value={g.fontFamily}
          onChange={(e) => updateGlobalStyles({ fontFamily: e.target.value })}
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 focus:border-blue-400 focus:outline-none"
        >
          <optgroup label="System Fonts">
            {SYSTEM_FONTS_EMAIL.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </optgroup>
          <optgroup label="Google Fonts">
            {GOOGLE_FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </optgroup>
        </select>
      </Field>

      <Field label="Link Colour">
        <ColorRow value={g.linkColor} onChange={(v) => updateGlobalStyles({ linkColor: v })} />
      </Field>

      <Field label="Content Width">
        <div className="flex gap-1.5">
          {[600, 640].map((w) => (
            <button
              key={w}
              onClick={() => updateGlobalStyles({ contentWidth: w })}
              className={cn(
                'flex-1 rounded-md border py-1.5 text-[11px] font-medium transition-colors',
                g.contentWidth === w
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
              )}
            >
              {w}px
            </button>
          ))}
        </div>
      </Field>

      <Field label="Logo URL">
        <input
          type="text"
          placeholder="https://…/logo.png"
          value={g.logo?.src ?? ''}
          onChange={(e) =>
            updateGlobalStyles({
              logo: { src: e.target.value, alt: g.logo?.alt ?? 'Logo', width: g.logo?.width ?? 120 },
            })
          }
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
        />
      </Field>
    </div>
  )
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-[10px] font-medium text-gray-500">{label}</label>
      {children}
    </div>
  )
}

function ColorRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 text-[12px] text-gray-600 focus:outline-none"
        maxLength={7}
      />
    </div>
  )
}

// ─── Rail button ──────────────────────────────────────────────────────────────

function RailBtn({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={cn(
        'flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[9px] font-medium transition-colors',
        active ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600',
      )}
    >
      {icon}
      <span className="leading-none">{label}</span>
    </button>
  )
}

// ─── ResizableImageSlot ────────────────────────────────────────────────────────
// Renders an image that:
//  • shows a "Double-click to change" overlay on hover
//  • exposes a bottom-right drag handle to resize height (width stays 100% of column)
//  • never distorts (object-cover always active)

interface ResizableImageSlotProps {
  src: string
  alt: string
  height?: number
  className?: string
  style?: React.CSSProperties  // e.g. clip-path for image shape
  onDoubleClick: () => void
  onResize: (newHeight: number) => void
  onImageClick?: (e: React.MouseEvent) => void
}

function ResizableImageSlot({
  src, alt, height, className, style, onDoubleClick, onResize, onImageClick,
}: ResizableImageSlotProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startH = wrapRef.current ? wrapRef.current.offsetHeight : (height ?? 240)
    dragRef.current = { startY: e.clientY, startH }

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const newH = Math.max(60, dragRef.current.startH + (ev.clientY - dragRef.current.startY))
      onResize(Math.round(newH))
    }
    const onUp = (ev: MouseEvent) => {
      if (dragRef.current) {
        const newH = Math.max(60, dragRef.current.startH + (ev.clientY - dragRef.current.startY))
        onResize(Math.round(newH))
      }
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={wrapRef}
      className={cn('group relative overflow-hidden', className)}
      style={{ ...(style ?? {}), ...(height != null ? { height } : {}) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        onClick={(e) => { e.stopPropagation(); onImageClick?.(e) }}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
        draggable={false}
      />
      {/* Hover overlay */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/25">
        <span className="rounded bg-black/60 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          Double-click to change
        </span>
      </div>
      {/* Bottom-right resize handle */}
      <div
        className="absolute bottom-0 right-0 z-10 hidden h-5 w-5 cursor-se-resize items-end justify-end pb-1 pr-1 group-hover:flex"
        onMouseDown={startResize}
        title="Drag to resize"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-white drop-shadow-md">
          <path d="M1 7L7 1M4 7L7 4M7 7V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  )
}

// ─── BlockContent: full-size block renderer (9 structural + 7 prebuilt) ───────

function BlockContent({
  type,
  backgroundColor,
  onTextClick,
  imageSrcs = {},
  imageSizes = {},
  onImageDoubleClick,
  onImageResize,
  onImageClick,
  // Button settings
  buttonShapeVariant,
  buttonFillColor,
  buttonBorderColor,
  buttonPosition,
  buttonBorderWidth,
  buttonWidth,
  buttonHeight,
  buttonFontFamily,
  // Font settings
  fontFamily,
  fontSize,
  fontBold,
  fontItalic,
  fontUnderline,
  fontColor,
  textAlign,
  lineHeight,
  letterSpacing,
  // Image settings
  imageShape,
  onButtonAreaClick,
  // Content block
  contentLayout,
  onContentLayoutSelect,
  spacerHeight,
  linkBarItems,
  footerLinks,
  socialLinks,
  socialIconStyle,
  socialIconColor,
  socialIconSize,
  socialIconPosition,
  socialIconSpacing,
  logoWidth,
  contentHeight,
  contentButton,
  isDraggingButton,
  onDropButton,
  onContentButtonRemove,
}: {
  type: string
  backgroundColor?: string
  onTextClick: (e: React.MouseEvent) => void
  imageSrcs?: Record<string, string>
  imageSizes?: Record<string, number>
  onImageDoubleClick: (key: string) => void
  onImageResize: (key: string, height: number) => void
  onImageClick?: (e: React.MouseEvent) => void
  buttonShapeVariant?: number
  buttonFillColor?: string
  buttonBorderColor?: string
  buttonPosition?: 'left' | 'center' | 'right'
  buttonBorderWidth?: number
  buttonWidth?: number
  buttonHeight?: number
  buttonFontFamily?: string
  fontFamily?: string
  fontSize?: number
  fontBold?: boolean
  fontItalic?: boolean
  fontUnderline?: boolean
  fontColor?: string
  textAlign?: 'left' | 'center' | 'right'
  lineHeight?: number
  letterSpacing?: number
  imageShape?: string
  /** Separate handler for button elements so they route to the Button tab, not Font tab */
  onButtonAreaClick?: (e: React.MouseEvent) => void
  contentLayout?: string
  onContentLayoutSelect?: (layout: string) => void
  spacerHeight?: number
  linkBarItems?: { label: string; url: string }[]
  footerLinks?: { label: string; url: string }[]
  socialLinks?: Record<string, string>
  socialIconStyle?: 'outline' | 'filled'
  socialIconColor?: string
  socialIconSize?: 'S' | 'M' | 'L'
  socialIconPosition?: 'left' | 'center' | 'right'
  socialIconSpacing?: number
  logoWidth?: number
  contentHeight?: number
  contentButton?: { position: 'below-text' | 'on-image'; label: string } | null
  isDraggingButton?: boolean
  onDropButton?: (pos: 'below-text' | 'on-image') => void
  onContentButtonRemove?: () => void
}) {
  // ── Button style derivation ──────────────────────────────────────────────────
  const BTN_SHAPES = [
    { radius: '0px',   filled: true  },
    { radius: '4px',   filled: true  },
    { radius: '12px',  filled: true  },
    { radius: '999px', filled: true  },
    { radius: '0px',   filled: false },
    { radius: '4px',   filled: false },
    { radius: '12px',  filled: false },
    { radius: '999px', filled: false },
  ]
  const btnShape  = BTN_SHAPES[buttonShapeVariant ?? 0]
  const btnFill   = buttonFillColor   ?? '#1F2937'
  const btnBorder = buttonBorderColor ?? '#1F2937'
  const btnStyle: React.CSSProperties = {
    borderRadius:    btnShape.radius,
    backgroundColor: btnShape.filled ? btnFill : 'transparent',
    border:          `${buttonBorderWidth ?? 1}px solid ${btnBorder}`,
    color:           btnShape.filled ? '#FFFFFF' : btnFill,
    fontFamily:      buttonFontFamily ?? fontFamily ?? undefined,
    width:           buttonWidth  ? `${buttonWidth}px`  : undefined,
    height:          buttonHeight ? `${buttonHeight}px` : undefined,
  }
  const btnJustify = { left: 'flex-start', center: 'center', right: 'flex-end' }[buttonPosition ?? 'center']

  // ── Font style derivation ────────────────────────────────────────────────────
  const fontStyle: React.CSSProperties = {
    fontFamily:      fontFamily    ?? undefined,
    fontSize:        fontSize      ? `${fontSize}px`        : undefined,
    fontWeight:      fontBold      ? 'bold'                 : undefined,
    fontStyle:       fontItalic    ? 'italic'               : undefined,
    textDecoration:  fontUnderline ? 'underline'            : undefined,
    color:           fontColor     ?? undefined,
    textAlign:       textAlign     ?? undefined,
    lineHeight:      lineHeight    ?? undefined,
    letterSpacing:   letterSpacing ? `${letterSpacing}px`  : undefined,
  }

  // ── Image shape clip ─────────────────────────────────────────────────────────
  const IMAGE_CLIP: Record<string, React.CSSProperties> = {
    circle:  { borderRadius: '50%' },
    rounded: { borderRadius: '12px' },
    square:  { borderRadius: '0' },
    arch:    { borderRadius: '50% 50% 0 0' },
    diamond: { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' },
    hexagon: { clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' },
  }
  const imgClip = imageShape ? (IMAGE_CLIP[imageShape] ?? {}) : {}

  const editable = {
    contentEditable: true as const,
    suppressContentEditableWarning: true,
    onClick: onTextClick,
    className:
      'outline-none cursor-text border-2 border-transparent hover:border-blue-200 rounded px-1 transition-colors',
  }

  // Used for the CTA button element inside layout blocks — same contentEditable
  // behaviour but routes to the Button tab instead of the Font tab in the right nav.
  const buttonEditable = {
    contentEditable: true as const,
    suppressContentEditableWarning: true,
    onClick: onButtonAreaClick ?? onTextClick,
    className: editable.className,
  }

  // Inline bg style — overrides Tailwind bg-* classes on the outermost element
  const bg = backgroundColor ? { backgroundColor } : {}

  // ── Structural blocks ──────────────────────────────────────────────────────

  if (type === 'logo') {
    const logoSrc = imageSrcs['logo']
    return (
      <div className="flex items-center justify-center bg-white py-6" style={bg}>
        {logoSrc ? (
          <div className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt="Logo"
              style={{ width: logoWidth ?? 120, maxWidth: '100%', height: 'auto' }}
              draggable={false}
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onImageDoubleClick('logo') }}
              className="absolute inset-0 flex items-center justify-center rounded bg-black/0 text-transparent transition-all group-hover:bg-black/30 group-hover:text-white"
            >
              <span className="rounded bg-black/60 px-2 py-1 text-[10px] font-medium opacity-0 transition-opacity group-hover:opacity-100">
                Change logo
              </span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onImageDoubleClick('logo') }}
            className="flex h-14 w-44 flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-gray-200 bg-gray-50 transition-all hover:border-blue-400 hover:bg-blue-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-gray-300">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
              <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-300">
              Upload Logo
            </span>
          </button>
        )}
      </div>
    )
  }

  if (type === 'link-bar') {
    const items = (linkBarItems && linkBarItems.length > 0) ? linkBarItems : DEFAULT_LINK_BAR
    return (
      <div className="flex items-center justify-center gap-6 border-b border-gray-100 bg-white px-8 py-3" style={bg}>
        {items.map((item, i) => (
          <a
            key={i}
            href={item.url || '#'}
            onClick={(e) => e.preventDefault()}
            className="text-[11px] font-medium tracking-wide text-gray-600 hover:text-gray-900 hover:underline transition-colors"
          >
            {item.label}
          </a>
        ))}
      </div>
    )
  }

  if (type === 'content') {
    // ── Layout picker — shown when no inner layout is chosen yet ─────────────
    if (!contentLayout) {
      const OPTIONS = [
        {
          id: '2col-text', label: '2 Column Text',
          preview: (
            <div className="grid grid-cols-2 gap-1 w-full h-full p-2">
              <div className="flex flex-col gap-0.5">
                <div className="h-1.5 w-3/4 rounded-sm bg-gray-400" />
                <div className="h-1 rounded-sm bg-gray-200" />
                <div className="h-1 rounded-sm bg-gray-200" />
                <div className="h-1 w-2/3 rounded-sm bg-gray-200" />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="h-1.5 w-3/4 rounded-sm bg-gray-400" />
                <div className="h-1 rounded-sm bg-gray-200" />
                <div className="h-1 rounded-sm bg-gray-200" />
                <div className="h-1 w-2/3 rounded-sm bg-gray-200" />
              </div>
            </div>
          ),
        },
        {
          id: '3col-text', label: '3 Column Text',
          preview: (
            <div className="grid grid-cols-3 gap-1 w-full h-full p-2">
              {[0,1,2].map((i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  <div className="h-1.5 rounded-sm bg-gray-400" />
                  <div className="h-1 rounded-sm bg-gray-200" />
                  <div className="h-1 rounded-sm bg-gray-200" />
                </div>
              ))}
            </div>
          ),
        },
        {
          id: 'image', label: 'Image',
          preview: (
            <div className="flex h-full w-full items-center justify-center bg-gray-100 rounded-sm m-2 overflow-hidden">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="#9CA3AF" strokeWidth="1.5"/>
                <circle cx="8.5" cy="8.5" r="1.5" fill="#9CA3AF"/>
                <path d="M21 15l-5-5L5 21" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          ),
        },
        {
          id: 'image-text', label: 'Image + Text',
          preview: (
            <div className="flex gap-1.5 w-full h-full p-2">
              <div className="w-1/2 flex items-center justify-center bg-gray-100 rounded-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="#9CA3AF" strokeWidth="1.5"/>
                  <circle cx="8.5" cy="8.5" r="1.5" fill="#9CA3AF"/>
                  <path d="M21 15l-5-5L5 21" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="flex flex-1 flex-col justify-center gap-0.5">
                <div className="h-1.5 w-full rounded-sm bg-gray-400" />
                <div className="h-1 rounded-sm bg-gray-200" />
                <div className="h-1 w-3/4 rounded-sm bg-gray-200" />
              </div>
            </div>
          ),
        },
      ]
      return (
        <div className="bg-white px-8 py-6" style={bg}>
          <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Choose content layout
          </p>
          <div className="grid grid-cols-2 gap-3">
            {OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={(e) => { e.stopPropagation(); onContentLayoutSelect?.(opt.id) }}
                className="group flex flex-col overflow-hidden rounded-xl border-2 border-gray-200 bg-gray-50 transition-all hover:border-blue-400 hover:bg-blue-50"
              >
                <div className="h-16 w-full">{opt.preview}</div>
                <p className="border-t border-gray-200 py-1.5 text-center text-[10px] font-medium text-gray-500 group-hover:text-blue-600">
                  {opt.label}
                </p>
              </button>
            ))}
          </div>
        </div>
      )
    }

    // ── Shared helpers ────────────────────────────────────────────────────────
    const dropZoneBelow = (
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropButton?.('below-text') }}
        className={cn(
          'mx-8 mb-4 flex items-center justify-center rounded-xl border-2 border-dashed py-3 text-[10px] font-medium transition-all',
          isDraggingButton
            ? 'border-blue-400 bg-blue-50 text-blue-500 opacity-100'
            : 'border-transparent opacity-0 pointer-events-none',
        )}
      >
        Drop button here
      </div>
    )

    const embeddedBtn = contentButton ? (
      <div className="relative flex items-center justify-center px-8 py-4" style={{ justifyContent: btnJustify }}>
        <div
          {...buttonEditable}
          style={btnStyle}
          className="relative inline-flex items-center justify-center px-5 py-2 text-[13px] font-semibold"
        >
          {contentButton.label}
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onContentButtonRemove?.() }}
            className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-gray-800 text-[8px] text-white opacity-0 transition-opacity hover:bg-red-500 group-hover/cbtn:opacity-100"
            title="Remove button"
          >
            ✕
          </button>
        </div>
      </div>
    ) : null

    // ── 2-column text ────────────────────────────────────────────────────────
    if (contentLayout === '2col-text') {
      return (
        <div className="group/cbtn bg-white" style={bg}>
          <div
            className="grid grid-cols-2 divide-x divide-gray-100 px-2 py-8"
            style={contentHeight ? { minHeight: contentHeight } : undefined}
          >
            <div className="flex flex-col gap-2 px-8">
              <h4 {...editable} className={`${editable.className} text-sm font-semibold`} style={fontStyle}>
                Column One Heading
              </h4>
              <p {...editable} className={`${editable.className} text-sm leading-relaxed text-gray-600`} style={fontStyle}>
                Add your text here. Click to edit this column and tell your story.
              </p>
            </div>
            <div className="flex flex-col gap-2 px-8">
              <h4 {...editable} className={`${editable.className} text-sm font-semibold`} style={fontStyle}>
                Column Two Heading
              </h4>
              <p {...editable} className={`${editable.className} text-sm leading-relaxed text-gray-600`} style={fontStyle}>
                Add your text here. Click to edit this column and share more details.
              </p>
            </div>
          </div>
          {contentButton?.position === 'below-text' ? embeddedBtn : dropZoneBelow}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onContentLayoutSelect?.('') }}
            className="w-full border-t border-gray-100 py-1 text-[9px] font-medium uppercase tracking-wider text-gray-300 hover:text-blue-500 transition-colors"
          >
            ↺ Change layout
          </button>
        </div>
      )
    }

    // ── 3-column text ────────────────────────────────────────────────────────
    if (contentLayout === '3col-text') {
      return (
        <div className="group/cbtn bg-white" style={bg}>
          <div
            className="grid grid-cols-3 divide-x divide-gray-100 px-2 py-8"
            style={contentHeight ? { minHeight: contentHeight } : undefined}
          >
            {(['One', 'Two', 'Three'] as const).map((col) => (
              <div key={col} className="flex flex-col gap-2 px-6">
                <h4 {...editable} className={`${editable.className} text-sm font-semibold`} style={fontStyle}>
                  Column {col}
                </h4>
                <p {...editable} className={`${editable.className} text-xs leading-relaxed text-gray-600`} style={fontStyle}>
                  Click to edit this column.
                </p>
              </div>
            ))}
          </div>
          {contentButton?.position === 'below-text' ? embeddedBtn : dropZoneBelow}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onContentLayoutSelect?.('') }}
            className="w-full border-t border-gray-100 py-1 text-[9px] font-medium uppercase tracking-wider text-gray-300 hover:text-blue-500 transition-colors"
          >
            ↺ Change layout
          </button>
        </div>
      )
    }

    // ── Image only ───────────────────────────────────────────────────────────
    if (contentLayout === 'image') {
      const imgSrc = imageSrcs['content-img']
      const hasOnImageBtn = contentButton?.position === 'on-image'
      return (
        <div className="group/cbtn bg-white" style={bg}>
          <div
            className="relative"
            style={contentHeight ? { minHeight: contentHeight } : undefined}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropButton?.('on-image') }}
          >
            {imgSrc ? (
              <ResizableImageSlot
                src={imgSrc}
                alt="Content"
                height={imageSizes['content-img'] ?? 320}
                onDoubleClick={() => onImageDoubleClick('content-img')}
                onResize={(h) => onImageResize('content-img', h)}
                onImageClick={onImageClick}
              />
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onImageDoubleClick('content-img') }}
                className="flex w-full flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 bg-gray-50 py-16 transition-all hover:border-blue-400 hover:bg-blue-50"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-gray-300">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                  <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span className="text-[11px] font-medium text-gray-400">Click to add image</span>
              </button>
            )}
            {/* On-image drop hint */}
            {isDraggingButton && !hasOnImageBtn && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded border-2 border-dashed border-blue-400 bg-blue-500/10">
                <span className="rounded-lg bg-white/90 px-3 py-1.5 text-[11px] font-medium text-blue-600 shadow">
                  Drop button on image
                </span>
              </div>
            )}
            {/* On-image embedded button */}
            {hasOnImageBtn && (
              <div className="absolute inset-0 flex items-end justify-center pb-6">
                <div
                  {...buttonEditable}
                  style={btnStyle}
                  className="relative inline-flex items-center justify-center px-5 py-2 text-[13px] font-semibold"
                >
                  {contentButton!.label}
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onContentButtonRemove?.() }}
                    className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-gray-800 text-[8px] text-white opacity-0 transition-opacity hover:bg-red-500 group-hover/cbtn:opacity-100"
                    title="Remove button"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onContentLayoutSelect?.('') }}
            className="w-full border-t border-gray-100 py-1 text-[9px] font-medium uppercase tracking-wider text-gray-300 hover:text-blue-500 transition-colors"
          >
            ↺ Change layout
          </button>
        </div>
      )
    }

    // ── Image + Text ─────────────────────────────────────────────────────────
    if (contentLayout === 'image-text') {
      const imgSrc = imageSrcs['content-img']
      const hasOnImageBtn = contentButton?.position === 'on-image'
      return (
        <div className="group/cbtn bg-white" style={bg}>
          <div
            className="flex"
            style={{ minHeight: contentHeight ?? 200 }}
          >
            {/* Image half */}
            <div
              className="relative w-1/2"
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropButton?.('on-image') }}
            >
              {imgSrc ? (
                <ResizableImageSlot
                  src={imgSrc}
                  alt="Content"
                  height={imageSizes['content-img'] ?? 240}
                  className="w-full self-stretch"
                  onDoubleClick={() => onImageDoubleClick('content-img')}
                  onResize={(h) => onImageResize('content-img', h)}
                  onImageClick={onImageClick}
                />
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onImageDoubleClick('content-img') }}
                  className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 bg-gray-50 transition-all hover:border-blue-400 hover:bg-blue-50"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-gray-300">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                    <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span className="text-[10px] font-medium text-gray-400">Click to add image</span>
                </button>
              )}
              {isDraggingButton && !hasOnImageBtn && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded border-2 border-dashed border-blue-400 bg-blue-500/10">
                  <span className="rounded-lg bg-white/90 px-2 py-1 text-[10px] font-medium text-blue-600 shadow">
                    Drop on image
                  </span>
                </div>
              )}
              {hasOnImageBtn && (
                <div className="absolute inset-0 flex items-end justify-center pb-4">
                  <div
                    {...buttonEditable}
                    style={btnStyle}
                    className="relative inline-flex items-center justify-center px-4 py-1.5 text-[12px] font-semibold"
                  >
                    {contentButton!.label}
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); onContentButtonRemove?.() }}
                      className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-gray-800 text-[8px] text-white opacity-0 transition-opacity hover:bg-red-500 group-hover/cbtn:opacity-100"
                      title="Remove button"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* Text half */}
            <div
              className="flex w-1/2 flex-col justify-center gap-3 px-8 py-8"
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropButton?.('below-text') }}
            >
              <h4 {...editable} className={`${editable.className} font-semibold text-sm`} style={fontStyle}>
                Content Heading
              </h4>
              <p {...editable} className={`${editable.className} text-sm leading-relaxed text-gray-600`} style={fontStyle}>
                Click to edit this text. Tell your story alongside the image.
              </p>
              {isDraggingButton && !contentButton && (
                <div className="rounded-xl border-2 border-dashed border-blue-400 bg-blue-50 py-2 text-center text-[10px] font-medium text-blue-500">
                  Drop button below text
                </div>
              )}
              {contentButton?.position === 'below-text' && embeddedBtn}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onContentLayoutSelect?.('') }}
            className="w-full border-t border-gray-100 py-1 text-[9px] font-medium uppercase tracking-wider text-gray-300 hover:text-blue-500 transition-colors"
          >
            ↺ Change layout
          </button>
        </div>
      )
    }
  }

  if (type === 'text') {
    return (
      <div className="bg-white px-12 py-8" style={bg}>
        <p
          {...editable}
          className={`${editable.className} text-sm leading-relaxed text-gray-700`}
          style={fontStyle}
        >
          Your text content here. Click to edit this paragraph and add your own copy.
        </p>
      </div>
    )
  }

  if (type === 'button') {
    return (
      <div className="bg-white py-8" style={{ ...bg, display: 'flex', alignItems: 'center', justifyContent: btnJustify, paddingLeft: 48, paddingRight: 48 }}>
        <div
          {...editable}
          className={`${editable.className} px-10 py-3 text-sm font-semibold tracking-widest`}
          style={btnStyle}
        >
          CLICK HERE
        </div>
      </div>
    )
  }

  if (type === 'social') {
    // Default icons shown when no links are configured yet
    const DEFAULT_SOCIAL_KEYS = ['facebook', 'instagram', 'pinterest', 'twitter', 'youtube']
    const links = socialLinks ?? {}
    const linkedKeys = Object.keys(links).filter((k) => links[k])
    // Show linked platforms if any, otherwise show default placeholders
    const keysToShow = linkedKeys.length > 0 ? linkedKeys : DEFAULT_SOCIAL_KEYS

    // Icon style and sizing
    const iconStyle = socialIconStyle ?? 'outline'
    const iconColor = socialIconColor ?? '#1F2937'
    const iconSize = socialIconSize ?? 'M'
    const iconPosition = socialIconPosition ?? 'center'
    const iconSpacing = socialIconSpacing ?? 12

    // Size mapping
    const sizeMap = { S: 32, M: 40, L: 48 }
    const iconPx = sizeMap[iconSize]
    const borderWidth = iconStyle === 'filled' ? 0 : 1

    // Position alignment
    const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' }

    return (
      <div
        className="flex flex-wrap items-center bg-white px-6 py-6"
        style={{ ...bg, justifyContent: justifyMap[iconPosition], gap: `${iconSpacing}px` }}
      >
        {keysToShow.map((key) => {
          const platform = SOCIAL_PLATFORMS_CANVAS.find((p) => p.key === key)
          if (!platform) return null
          const url = links[key] || '#'
          return (
            <a
              key={key}
              href={url}
              title={platform.title}
              className="flex items-center justify-center rounded-full transition-all hover:scale-110"
              style={{
                width: `${iconPx}px`,
                height: `${iconPx}px`,
                borderWidth: `${borderWidth}px`,
                borderColor: iconColor,
                borderStyle: 'solid',
                backgroundColor: iconStyle === 'filled' ? iconColor : 'transparent',
                color: iconStyle === 'filled' ? '#ffffff' : iconColor,
              }}
              onClick={(e) => e.preventDefault()}
            >
              {platform.svg}
            </a>
          )
        })}
      </div>
    )
  }

  if (type === 'address') {
    return (
      <div className="bg-white px-12 py-4 text-center" style={bg}>
        <p
          {...editable}
          className={`${editable.className} text-[11px] leading-relaxed text-gray-500`}
        >
          123 Main Street, Suite 100 · City, State 12345 · United States
        </p>
      </div>
    )
  }

  if (type === 'footer') {
    const DEFAULT_FOOTER_LINKS = [
      { label: 'Privacy Policy', url: '' },
      { label: 'Unsubscribe',    url: '' },
      { label: 'View in Browser', url: '' },
      { label: 'Contact Us',     url: '' },
    ]
    const fLinks = (footerLinks && footerLinks.length > 0) ? footerLinks : DEFAULT_FOOTER_LINKS
    return (
      <div className="bg-gray-50 px-12 py-6 text-center" style={bg}>
        <div className="mb-3 flex items-center justify-center gap-4 text-[11px] text-gray-500">
          {fLinks.map((link, i) => (
            <React.Fragment key={i}>
              <a
                href={link.url || '#'}
                onClick={(e) => e.preventDefault()}
                className="cursor-pointer hover:text-gray-800 hover:underline transition-colors"
              >
                {link.label}
              </a>
              {i < fLinks.length - 1 && <span className="text-gray-300">·</span>}
            </React.Fragment>
          ))}
        </div>
        <p
          {...editable}
          className={`${editable.className} text-[10px] text-gray-400`}
        >
          © {new Date().getFullYear()} Your Company Name. All rights reserved.
        </p>
      </div>
    )
  }

  if (type === 'spacer') {
    const spacerPx = spacerHeight ?? 64
    return (
      <div
        className="flex items-center justify-center border-y border-dashed border-gray-200 bg-white"
        style={{ ...bg, height: spacerPx }}
      >
        <span className="text-[9px] font-medium uppercase tracking-widest text-gray-300">
          Spacer · {spacerPx}px
        </span>
      </div>
    )
  }

  // ── Prebuilt design blocks (from right nav) ────────────────────────────────

  if (type === 'image-left-text-right') {
    const S = SPECS.IMAGE_LEFT_TEXT_RIGHT
    return (
      <div className="flex min-h-[300px]" style={bg}>
        <ResizableImageSlot
          src={imageSrcs[S.imageKey] ?? S.defaultImageSrc}
          alt="Fashion"
          height={imageSizes[S.imageKey]}
          className="self-stretch"
          style={{ width: `${S.imageColPct}%` }}
          onDoubleClick={() => onImageDoubleClick(S.imageKey)}
          onResize={(h) => onImageResize(S.imageKey, h)}
          onImageClick={onImageClick}
        />
        <div className="flex flex-col items-center justify-center gap-4"
          style={{ width: `${S.textColPct}%`, padding: S.textPaddingH }}>
          <p {...editable}
            style={{ ...fontStyle, fontSize: S.taglineFontSize, color: S.taglineColor, fontStyle: 'italic', textAlign: 'center' }}
            className={editable.className}>
            From The &apos;Gram
          </p>
          <h2 {...editable}
            style={{ ...fontStyle, fontSize: fontSize ?? S.headingFontSize, fontWeight: S.headingWeight, textAlign: 'center' }}
            className={editable.className}>
            The Post That Got Everyone Talking
          </h2>
          <div style={{ height: 1, width: 64, backgroundColor: S.dividerColor }} />
          <div style={{ display: 'flex', justifyContent: btnJustify }}>
            <div {...buttonEditable} style={btnStyle} className={`${buttonEditable.className} px-6 py-2 text-xs font-semibold tracking-widest`}>
              {S.buttonLabel}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'centered-content') {
    const S = SPECS.CENTERED_CONTENT
    return (
      <div className="text-center" style={{ backgroundColor: bg.backgroundColor ?? S.outerBg, padding: S.outerPadding.top }}>
        <div className="inline-block rounded shadow-sm" style={{ backgroundColor: S.cardBg, borderRadius: S.cardBorderRadius, padding: S.cardPadding }}>
          <div {...editable}
            style={{ ...fontStyle, fontSize: S.numberFontSize, color: S.numberColor, lineHeight: S.numberLineHeight }}
            className={editable.className}>
            6
          </div>
          <h3 {...editable}
            style={{ ...fontStyle, fontSize: fontSize ?? S.headingFontSize, fontWeight: S.headingWeight, marginTop: 8 }}
            className={editable.className}>
            Tips to Photograph Food
          </h3>
          <p {...editable}
            style={{ ...fontStyle, fontSize: S.bodyFontSize, color: S.bodyColor, maxWidth: S.bodyMaxWidthPx, margin: '12px auto 0', lineHeight: S.bodyLineHeight }}
            className={editable.className}>
            I remember my first try at food photography. I created this guide to help you get started without making all the mistakes I did.
          </p>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: btnJustify, gap: 12 }}>
            <span style={{ fontSize: S.labelFontSize, color: S.labelColor }}>001</span>
            <div {...buttonEditable} style={btnStyle} className={`${buttonEditable.className} px-6 py-2 text-xs font-semibold tracking-widest`}>
              {S.buttonLabel}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'text-over-image') {
    const S = SPECS.TEXT_OVER_IMAGE
    return (
      <div style={{ backgroundColor: bg.backgroundColor ?? S.bgColor }}>
        <div className="text-center" style={{ padding: S.sectionPadding.top }}>
          <div style={{ margin: '0 auto 16px', height: 1, width: 64, backgroundColor: S.dividerColor }} />
          <h3 {...editable}
            style={{ ...fontStyle, fontSize: fontSize ?? S.headingFontSize, fontWeight: S.headingWeight, letterSpacing: S.headingTracking, textTransform: 'uppercase', textAlign: 'center' }}
            className={editable.className}>
            A Little Gift of Thanks for Joining the List.
          </h3>
          <div style={{ margin: '16px auto 0', height: 1, width: 64, backgroundColor: S.dividerColor }} />
          <div style={{ marginTop: 24, display: 'flex', justifyContent: btnJustify }}>
            <div {...buttonEditable}
              className={`${buttonEditable.className} text-xs font-semibold tracking-widest`}
              style={{ ...btnStyle, paddingTop: S.buttonPadding.top, paddingBottom: S.buttonPadding.top, paddingLeft: S.buttonPadding.right, paddingRight: S.buttonPadding.right }}>
              {S.buttonLabel}
            </div>
          </div>
        </div>
        <ResizableImageSlot
          src={imageSrcs[S.imageKey] ?? S.defaultImageSrc}
          alt="Background"
          height={imageSizes[S.imageKey] ?? S.defaultImageHeight}
          onDoubleClick={() => onImageDoubleClick(S.imageKey)}
          onResize={(h) => onImageResize(S.imageKey, h)}
          onImageClick={onImageClick}
        />
      </div>
    )
  }

  if (type === 'text-left-image-right') {
    const S = SPECS.TEXT_LEFT_IMAGE_RIGHT
    return (
      <div className="flex min-h-[300px]" style={bg}>
        <div className="flex flex-col items-center justify-center gap-6"
          style={{ width: `${S.textColPct}%`, padding: S.textPaddingH }}>
          <h3 {...editable}
            style={{ ...fontStyle, fontSize: fontSize ?? S.headingFontSize, fontWeight: S.headingWeight, lineHeight: S.headingLineHeight }}
            className={editable.className}>
            WEL—COME
          </h3>
          <div style={{ display: 'flex', justifyContent: btnJustify }}>
            <div {...buttonEditable} style={btnStyle} className={`${buttonEditable.className} px-6 py-2 text-xs font-semibold tracking-widest`}>
              {S.buttonLabel}
            </div>
          </div>
        </div>
        <ResizableImageSlot
          src={imageSrcs[S.imageKey] ?? S.defaultImageSrc}
          alt="Background"
          height={imageSizes[S.imageKey] ?? S.defaultImageHeight}
          style={{ width: `${S.imageColPct}%` }}
          onDoubleClick={() => onImageDoubleClick(S.imageKey)}
          onResize={(h) => onImageResize(S.imageKey, h)}
          onImageClick={onImageClick}
        />
      </div>
    )
  }

  if (type === 'recipe-card') {
    const S = SPECS.RECIPE_CARD
    return (
      <div className="flex min-h-[280px] gap-8" style={{ backgroundColor: bg.backgroundColor ?? S.bgColor }}>
        <ResizableImageSlot
          src={imageSrcs[S.imageKey] ?? S.defaultImageSrc}
          alt="Recipe"
          height={imageSizes[S.imageKey] ?? S.defaultImageHeight}
          style={{ width: `${S.imageColPct}%`, ...imgClip }}
          onDoubleClick={() => onImageDoubleClick(S.imageKey)}
          onResize={(h) => onImageResize(S.imageKey, h)}
          onImageClick={onImageClick}
        />
        <div className="flex flex-col justify-center gap-3 px-4" style={{ width: `${S.textColPct}%` }}>
          <p {...editable}
            style={{ ...fontStyle, fontSize: S.labelFontSize, color: S.labelColor, fontStyle: 'italic' }}
            className={editable.className}>One</p>
          <h3 {...editable}
            style={{ ...fontStyle, fontSize: fontSize ?? S.headingFontSize, fontWeight: S.headingWeight }}
            className={editable.className}>
            Click here for my creamy butternut squash soup
          </h3>
          <p {...editable}
            style={{ ...fontStyle, fontSize: S.descFontSize, color: S.descColor, fontStyle: 'italic' }}
            className={editable.className}>
            A warming recipe perfect for fall evenings.
          </p>
          <div style={{ display: 'flex', justifyContent: btnJustify }}>
            <div {...buttonEditable} style={btnStyle} className={`${buttonEditable.className} px-6 py-2 text-xs font-semibold tracking-widest`}>
              {S.buttonLabel}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'image-top-text-bottom') {
    const S = SPECS.IMAGE_TOP_TEXT_BOTTOM
    return (
      <div style={{ backgroundColor: S.imageSectionBg }}>
        <ResizableImageSlot
          src={imageSrcs[S.imageKey] ?? S.defaultImageSrc}
          alt="Main image"
          height={imageSizes[S.imageKey] ?? S.defaultImageHeight}
          onDoubleClick={() => onImageDoubleClick(S.imageKey)}
          onResize={(h) => onImageResize(S.imageKey, h)}
          onImageClick={onImageClick}
        />
        <div className="text-center" style={{ backgroundColor: bg.backgroundColor ?? S.textBg, padding: S.textPadding.top }}>
          <h3 {...editable}
            style={{ ...fontStyle, fontSize: fontSize ?? S.headingFontSize, fontWeight: S.headingWeight, marginBottom: S.headingBottomMargin }}
            className={editable.className}>
            Get 25% off when you book my services
          </h3>
          <p {...editable}
            style={{ ...fontStyle, fontSize: S.bodyFontSize, color: S.bodyColor, fontStyle: 'italic' }}
            className={editable.className}>
            for the next 24 hours only.
          </p>
          <div style={{ marginTop: 24, display: 'flex', justifyContent: btnJustify }}>
            <div {...buttonEditable}
              className={`${buttonEditable.className} text-xs font-semibold tracking-widest`}
              style={{ ...btnStyle, paddingTop: S.buttonPadding.top, paddingBottom: S.buttonPadding.top, paddingLeft: S.buttonPadding.right, paddingRight: S.buttonPadding.right }}>
              {S.buttonLabel}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'testimonial') {
    const S = SPECS.TESTIMONIAL
    return (
      <div className="flex min-h-[200px] gap-8"
        style={{ backgroundColor: bg.backgroundColor ?? S.bgColor, padding: `${S.sectionPadding.top}px ${S.sectionPadding.right}px` }}>
        <ResizableImageSlot
          src={imageSrcs[S.avatarKey] ?? S.defaultAvatarSrc}
          alt="Testimonial"
          height={imageSizes[S.avatarKey] ?? S.avatarWidth}
          style={{ width: S.avatarWidth, flexShrink: 0, ...imgClip }}
          onDoubleClick={() => onImageDoubleClick(S.avatarKey)}
          onResize={(h) => onImageResize(S.avatarKey, h)}
          onImageClick={onImageClick}
        />
        <div className="flex flex-1 flex-col justify-center gap-3">
          <h4 {...editable}
            style={{ ...fontStyle, fontSize: S.nameFontSize, fontWeight: S.nameWeight, letterSpacing: S.nameTracking, textTransform: 'uppercase' }}
            className={editable.className}>
            TESTIMONIAL NAME
          </h4>
          <p {...editable}
            style={{ ...fontStyle, fontSize: fontSize ?? S.quoteFontSize, color: S.quoteColor, lineHeight: S.quoteLineHeight }}
            className={editable.className}>
            Since joining, my email list has grown 4x and I&apos;ve finally found a system that works for my creative business.
          </p>
          <div style={{ fontSize: S.starFontSize, color: S.starColor }}>{S.starsText}</div>
        </div>
      </div>
    )
  }

  // Fallback
  return (
    <div className="flex h-24 items-center justify-center bg-gray-50 text-sm text-gray-400">
      Unknown block: {type}
    </div>
  )
}

// ─── Main EmailEditorPanel ────────────────────────────────────────────────────

export const EmailEditorPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<EmailTab>('sections')
  const [panelOpen, setPanelOpen] = useState(true)

  // Canvas state
  const [canvasBlocks, setCanvasBlocks] = useState<CanvasBlock[]>(makeDefaultBlocks)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [insertState, setInsertState] = useState<InsertState>(null)
  const [showTextEdit, setShowTextEdit] = useState(false)
  const [textToolbarPosition, setTextToolbarPosition] = useState<{ top: number; left: number } | undefined>()
  // Dormant editor affordances preserved from the standalone studio.
  void [showTextEdit, textToolbarPosition, BlockPropertiesPanel]
  const [showApprovedImages, setShowApprovedImages] = useState(false)
  const [pendingImageTarget, setPendingImageTarget] = useState<{ blockId: string; imageKey: string } | null>(null)
  // Signals EmailRightNav which tab to activate when a specific element is clicked
  const [focusTab, setFocusTab] = useState<{ tab: string; seq: number } | undefined>()
  // Tracks which block type is currently being dragged from the sections panel
  const [draggedBlockType, setDraggedBlockType] = useState<string | null>(null)

  // ── Allyvate AI assistant ───────────────────────────────────────────────────
  const [allyVisible,  setAllyVisible]  = useState(false)
  const [allyContext,  setAllyContext]  = useState<AllyContext>('text')
  const [allyAnchorX, setAllyAnchorX]  = useState(0)
  const [allyAnchorY, setAllyAnchorY]  = useState(0)
  const [allySeedText, setAllySeedText] = useState('')

  const showAlly = useCallback((ctx: AllyContext, e: React.MouseEvent) => {
    setAllyContext(ctx)
    setAllyAnchorX(e.clientX)
    setAllyAnchorY(e.clientY)
    if (ctx === 'text') {
      const target = e.target as HTMLElement | null
      const editable = target?.closest('[contenteditable]') as HTMLElement | null
      setAllySeedText((editable ?? target)?.innerText?.trim() ?? '')
    } else {
      setAllySeedText('')
    }
    setAllyVisible(true)
  }, [])

  // ── Persistence state ───────────────────────────────────────────────────────
  const [currentEmailerId, setCurrentEmailerId] = useState<string | null>(null)
  const [savedEmailers, setSavedEmailers] = useState<EmailerMeta[]>([
    { id: 'demo-1', name: 'Dormant User — Winter Win-Back Campaign',   subject: 'We miss you! Here\'s 20% off to welcome you back',  preheader: null, created_at: '2025-01-15T10:00:00Z', updated_at: '2025-01-15T10:00:00Z' },
    { id: 'demo-2', name: 'Summer Flash Sale — 48 Hour Countdown',     subject: 'Only 48 hrs left: up to 50% off sitewide',           preheader: null, created_at: '2025-02-10T09:00:00Z', updated_at: '2025-02-10T09:00:00Z' },
    { id: 'demo-3', name: 'New Product Launch — Spring Collection',    subject: 'Introducing our brand-new Spring 2025 line',         preheader: null, created_at: '2025-03-01T08:00:00Z', updated_at: '2025-03-01T08:00:00Z' },
    { id: 'demo-4', name: 'Monthly Newsletter — April Edition',        subject: 'Your April update: tips, stories & exclusive offers', preheader: null, created_at: '2025-04-01T07:00:00Z', updated_at: '2025-04-01T07:00:00Z' },
    { id: 'demo-5', name: 'VIP Early Access — Members Only Preview',   subject: 'You\'re invited: shop 24 hours before everyone else', preheader: null, created_at: '2025-04-20T06:00:00Z', updated_at: '2025-04-20T06:00:00Z' },
  ])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showEmailerDropdown, setShowEmailerDropdown] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveModalMode, setSaveModalMode] = useState<'new' | 'fork'>('new')
  const [emailerNameInput, setEmailerNameInput] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { document: doc, previewMode, setPreviewMode, updateSubject, updatePreheader, syncFromCanvas, compiledHtml, emailerName, setEmailerName } = useEmailStore()

  // Send-test-email right-nav panel toggle (replaces the per-block right nav while open)
  const [sendTestOpen, setSendTestOpen] = useState(false)
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null)

  // Toggle between live canvas editing and iframe-based email HTML preview
  const [showPreview, setShowPreview] = useState(false)

  // ── Font-enriched preview HTML ─────────────────────────────────────────────
  // srcDoc iframes run with a null origin, which means they cannot reuse the
  // parent page's cached Google Fonts connections in all browsers.  We pre-inject
  // <link> tags for every font in the full catalogue so the preview shows the
  // correct font immediately — these same fonts are already loaded by the root
  // layout, so browsers that share the cache serve them from memory.
  // NOTE: these extra links are injected for preview only; the exported HTML still
  // only embeds the specific fonts actually used in the document (as compiled).
  const previewSrcDoc = useMemo(() => {
    if (!compiledHtml) return ''
    const extraLinks = getGoogleFontStylesheetHrefs()
      .map((href) => `<link rel="stylesheet" href="${href}">`)
      .join('')
    return compiledHtml.replace('</head>', `${extraLinks}</head>`)
  }, [compiledHtml])

  // ── Sync canvas → emailStore on every canvas change ─────────────────────────
  // This bridges the CanvasBlock[] visual model with the EmailDocument compiler
  // model so that compiled HTML always reflects what the user sees on canvas.
  useEffect(() => {
    void syncFromCanvas(canvasBlocks)
    // syncFromCanvas is stable (Zustand action ref never changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasBlocks])

  // Fetch emailer list on mount — only replace dummy data if real rows come back
  useEffect(() => {
    fetch('/api/studio/emailers')
      .then((r) => r.ok ? r.json() : null)
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setSavedEmailers(list as EmailerMeta[])
        }
      })
      .catch(() => {})
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowEmailerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const buildPayload = useCallback(() => ({
    subject:   doc.subject   ?? null,
    preheader: doc.preheader ?? null,
    blocks:    canvasBlocks,
  }), [doc.subject, doc.preheader, canvasBlocks])

  // Save (update) the current emailer
  const handleSave = useCallback(async () => {
    if (!currentEmailerId) {
      // No ID yet → open "save as new" modal
      setSaveModalMode('new')
      setEmailerNameInput(doc.subject || 'Untitled')
      setShowSaveModal(true)
      return
    }
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/studio/emailers/${currentEmailerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated = await res.json() as EmailerMeta
      setSavedEmailers((prev) => prev.map((e) => e.id === updated.id ? updated : e))
      setEmailerName(updated.name)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }, [currentEmailerId, buildPayload, doc.subject, setEmailerName])

  // Confirm save (new or fork) from modal
  const handleSaveConfirm = useCallback(async () => {
    const name = emailerNameInput.trim() || 'Untitled'
    setShowSaveModal(false)
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/studio/emailers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ...buildPayload() }),
      })
      if (!res.ok) throw new Error(await res.text())
      const created = await res.json() as EmailerMeta
      if (saveModalMode === 'new') setCurrentEmailerId(created.id)
      setSavedEmailers((prev) => [created, ...prev])
      setEmailerName(created.name)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }, [emailerNameInput, buildPayload, saveModalMode, setEmailerName])

  // Load a saved emailer into the canvas
  const handleLoadEmailer = useCallback(async (id: string) => {
    setShowEmailerDropdown(false)
    setSaveStatus('saving') // reuse spinner while loading
    try {
      const res = await fetch(`/api/studio/emailers/${id}`)
      if (!res.ok) throw new Error()
      const row = await res.json() as {
        id: string
        name: string
        subject: string | null
        preheader: string | null
        blocks: CanvasBlock[]
      }
      // Restore canvas blocks
      setCanvasBlocks(Array.isArray(row.blocks) ? row.blocks : [])
      setCurrentEmailerId(row.id)
      // Restore subject + preheader into the email store so buildPayload
      // and the subject input both reflect the loaded emailer
      updateSubject(row.subject ?? '')
      updatePreheader(row.preheader ?? '')
      setEmailerName(row.name)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }, [updateSubject, updatePreheader, setEmailerName])

  // ── Export (PNG / PDF / HTML) ───────────────────────────────────────────────
  const slugify = (s: string) =>
    (s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled-campaign'

  const downloadBlob = (data: BlobPart, filename: string, mime: string) => {
    const blob = new Blob([data], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const handleEmailExport = useCallback(async (format: ExportFormat) => {
    const base = slugify(emailerName)
    if (format === 'html') {
      downloadBlob(compiledHtml, `${base}.html`, 'text/html;charset=utf-8')
      return
    }

    const iframe = previewIframeRef.current
    const body = iframe?.contentDocument?.body
    if (!body) {
      // Iframe isn't mounted (e.g. user is in canvas view, not Preview).
      // Fall back to creating a hidden iframe with previewSrcDoc.
      const tmp = document.createElement('iframe')
      tmp.style.position = 'fixed'
      tmp.style.left = '-99999px'
      tmp.style.top = '0'
      tmp.style.width = '660px'
      tmp.style.height = '1px'
      tmp.srcdoc = previewSrcDoc
      document.body.appendChild(tmp)
      await new Promise<void>((resolve) => {
        tmp.onload = () => resolve()
      })
      try {
        const tmpBody = tmp.contentDocument?.body
        if (!tmpBody) throw new Error('Preview unavailable')
        const html2canvas = (await import('html2canvas')).default
        const canvas = await html2canvas(tmpBody, { useCORS: true, backgroundColor: '#ffffff' })
        const dataUrl = canvas.toDataURL('image/png')
        if (format === 'png') {
          downloadBlob(await (await fetch(dataUrl)).blob(), `${base}.png`, 'image/png')
        } else {
          const { jsPDF } = await import('jspdf')
          const w = canvas.width
          const h = canvas.height
          const pdf = new jsPDF({ orientation: w >= h ? 'l' : 'p', unit: 'px', format: [w, h] })
          pdf.addImage(dataUrl, 'PNG', 0, 0, w, h)
          pdf.save(`${base}.pdf`)
        }
      } finally {
        tmp.remove()
      }
      return
    }

    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(body, { useCORS: true, backgroundColor: '#ffffff' })
    const dataUrl = canvas.toDataURL('image/png')
    if (format === 'png') {
      downloadBlob(await (await fetch(dataUrl)).blob(), `${base}.png`, 'image/png')
    } else if (format === 'pdf') {
      const { jsPDF } = await import('jspdf')
      const w = canvas.width
      const h = canvas.height
      const pdf = new jsPDF({ orientation: w >= h ? 'l' : 'p', unit: 'px', format: [w, h] })
      pdf.addImage(dataUrl, 'PNG', 0, 0, w, h)
      pdf.save(`${base}.pdf`)
    }
  }, [emailerName, compiledHtml, previewSrcDoc])

  const handleTabClick = (tab: EmailTab) => {
    if (activeTab === tab) setPanelOpen((o) => !o)
    else { setActiveTab(tab); setPanelOpen(true) }
  }

  const RAIL_ITEMS: { id: EmailTab; icon: React.ReactNode; label: string }[] = [
    { id: 'tree',     icon: <Layers size={14} />,     label: 'Tree' },
    { id: 'sections', icon: <LayoutGrid size={14} />, label: 'Sections' },
    { id: 'text',     icon: <Type size={14} />,       label: 'Text' },
    { id: 'content',  icon: <FileText size={14} />,   label: 'Content' },
    { id: 'style',    icon: <Palette size={14} />,    label: 'Style' },
  ]

  // ── Canvas block actions ────────────────────────────────────────────────────

  const handleMoveUp = useCallback((id: string) => {
    setCanvasBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx <= 0) return prev
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }, [])

  const handleMoveDown = useCallback((id: string) => {
    setCanvasBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }, [])

  const handleDuplicate = useCallback((id: string) => {
    setCanvasBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx < 0) return prev
      const copy: CanvasBlock = { ...prev[idx], id: nanoid() }
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })
  }, [])

  const handleDelete = useCallback((id: string) => {
    setCanvasBlocks((prev) => prev.filter((b) => b.id !== id))
    setSelectedId((prev) => (prev === id ? null : prev))
    setInsertState(null)
  }, [])

  const handleBlockColorChange = useCallback((id: string, color: string) => {
    setCanvasBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, backgroundColor: color } : b)),
    )
  }, [])

  // Insert a block inline (from "+" button)
  const handleInlineInsert = useCallback((type: string, afterId: string | null) => {
    const newBlock: CanvasBlock = makeNewBlock(type)
    setCanvasBlocks((prev) => {
      if (afterId === null) return [newBlock, ...prev]
      const idx = prev.findIndex((b) => b.id === afterId)
      if (idx < 0) return [...prev, newBlock]
      const next = [...prev]
      next.splice(idx + 1, 0, newBlock)
      return next
    })
    setSelectedId(newBlock.id)
    setInsertState(null)
  }, [])

  // Insert after selected (or append) — used by Sections panel + right nav
  const handleAppendInsert = useCallback((type: string) => {
    const newBlock: CanvasBlock = makeNewBlock(type)
    setCanvasBlocks((prev) => {
      if (!selectedId) return [...prev, newBlock]
      const idx = prev.findIndex((b) => b.id === selectedId)
      if (idx < 0) return [...prev, newBlock]
      const next = [...prev]
      next.splice(idx + 1, 0, newBlock)
      return next
    })
    setSelectedId(newBlock.id)
    setInsertState(null)
  }, [selectedId])

  const handleTextClick = useCallback((e: React.MouseEvent) => {
    // Do NOT stopPropagation — let the click bubble up to the block wrapper
    // so the block gets selected and EmailRightNav stays visible.
    setTextToolbarPosition({ top: e.clientY - 50, left: e.clientX - 60 })
    setShowTextEdit(true)
    setFocusTab((prev) => ({ tab: 'font', seq: (prev?.seq ?? 0) + 1 }))
    showAlly('text', e)
  }, [showAlly])

  // Clicking the styled button element inside a layout block → show Button tab
  const handleButtonAreaClick = useCallback(() => {
    setFocusTab((prev) => ({ tab: 'button', seq: (prev?.seq ?? 0) + 1 }))
  }, [])

  const handleCanvasClick = useCallback(() => {
    setSelectedId(null)
    setInsertState(null)
    setTextToolbarPosition(undefined)
    setShowTextEdit(false)
  }, [])

  const handleOpenImagePicker = useCallback((blockId: string, imageKey: string) => {
    setPendingImageTarget({ blockId, imageKey })
    setShowApprovedImages(true)
  }, [])

  const handleImageSelect = useCallback((src: string) => {
    if (pendingImageTarget) {
      const { blockId, imageKey } = pendingImageTarget
      setCanvasBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? { ...b, imageSrcs: { ...(b.imageSrcs ?? {}), [imageKey]: src } }
            : b,
        ),
      )
    }
    // Always close — covers both "pick for block" and "browse from rail" modes
    setShowApprovedImages(false)
    setPendingImageTarget(null)
  }, [pendingImageTarget])

  const handleImageResize = useCallback((blockId: string, imageKey: string, height: number) => {
    setCanvasBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? { ...b, imageSizes: { ...(b.imageSizes ?? {}), [imageKey]: height } }
          : b,
      ),
    )
  }, [])

  /** Direct upload from "My computer" in the Image tab — no ApprovedImagesPanel needed */
  const handleDirectImageUpload = useCallback(async (blockId: string, imageKey: string, src: string) => {
    // Optimistically store the base64 src while uploading
    setCanvasBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? { ...b, imageSrcs: { ...(b.imageSrcs ?? {}), [imageKey]: src } }
          : b,
      ),
    )
    // Upload to Minio in the background and replace with durable URL
    try {
      const res = await fetch('/api/studio/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: src }),
      })
      if (res.ok) {
        const { url } = await res.json() as { url: string }
        setCanvasBlocks((prev) =>
          prev.map((b) =>
            b.id === blockId
              ? { ...b, imageSrcs: { ...(b.imageSrcs ?? {}), [imageKey]: url } }
              : b,
          ),
        )
      }
    } catch {
      // keep base64 if upload fails
    }
  }, [])

  const handleBlockPatch = useCallback((id: string, patch: Partial<CanvasBlock>) => {
    setCanvasBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }, [])

  const selectedBlock = canvasBlocks.find((b) => b.id === selectedId) ?? null

  return (
    <div className="absolute inset-0 flex overflow-hidden">

      {/* ── Icon Rail ────────────────────────────────────── */}
      <aside className="flex w-[52px] shrink-0 flex-col items-center gap-0.5 border-r border-gray-200 bg-white py-2 px-1">
        {RAIL_ITEMS.map((item) => (
          <RailBtn
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeTab === item.id && panelOpen}
            onClick={() => handleTabClick(item.id)}
          />
        ))}

        {/* Divider */}
        <div className="my-1 w-7 border-t border-gray-200" />

        {/* Image Library shortcut */}
        <RailBtn
          icon={<ImageIcon size={14} />}
          label="Images"
          active={showApprovedImages && !pendingImageTarget}
          onClick={() => {
            setPendingImageTarget(null)
            setShowApprovedImages(true)
          }}
        />
      </aside>

      {/* ── Slide-out Sub-panel ──────────────────────────── */}
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-gray-200 bg-white transition-all duration-200',
          panelOpen ? 'w-[216px]' : 'w-0 overflow-hidden',
        )}
      >
        {panelOpen && (
          <>
            {activeTab === 'tree'     && (
              <TreePanel
                blocks={canvasBlocks}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onDelete={handleDelete}
              />
            )}
            {activeTab === 'sections' && (
              <SectionsPanel
                onInsert={handleAppendInsert}
                onBlockDragStart={setDraggedBlockType}
                onBlockDragEnd={() => setDraggedBlockType(null)}
              />
            )}
            {activeTab === 'text'     && <TextBlocksPanel onInsert={handleAppendInsert} />}
            {activeTab === 'content'  && <ContentPanel selectedBlock={selectedBlock} onBlockColorChange={handleBlockColorChange} />}
            {activeTab === 'style'    && <StylePanel />}
          </>
        )}
      </aside>

      {/* ── Centre: Interactive Canvas ───────────────────── */}
      <div className="relative flex flex-1 flex-col overflow-hidden bg-[#F3F4F6]">

        {/* Top toolbar strip */}
        <div className="flex h-10 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">

          {/* ── Open existing emailer dropdown — far LEFT ── */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              onClick={() => setShowEmailerDropdown((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <FolderOpen size={12} />
              Open
              <ChevronDownIcon size={10} className={cn('transition-transform', showEmailerDropdown && 'rotate-180')} />
            </button>

            {showEmailerDropdown && (
              <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-96 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                <div className="border-b border-gray-100 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Saved Emailers</p>
                </div>
                <div className="max-h-64 overflow-auto">
                  {savedEmailers.length === 0 ? (
                    <p className="px-3 py-4 text-center text-[11px] text-gray-400">No saved emailers yet</p>
                  ) : (
                    savedEmailers.map((em) => (
                      <button
                        key={em.id}
                        onClick={() => handleLoadEmailer(em.id)}
                        className={cn(
                          'flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-50',
                          em.id === currentEmailerId && 'bg-blue-50',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium leading-snug text-gray-800">{em.name}</p>
                          {em.subject && (
                            <p className="text-[10px] leading-snug text-gray-400">{em.subject}</p>
                          )}
                          <p className="text-[9px] text-gray-300">
                            {new Date(em.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        {em.id === currentEmailerId && <Check size={12} className="mt-0.5 shrink-0 text-blue-500" />}
                      </button>
                    ))
                  )}
                </div>
                <div className="border-t border-gray-100 px-3 py-2">
                  <button
                    onClick={() => {
                      setShowEmailerDropdown(false)
                      setCanvasBlocks(makeDefaultBlocks())
                      setCurrentEmailerId(null)
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <PlusCircle size={11} /> New emailer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Campaign name — editable, persists on blur */}
          <input
            type="text"
            value={emailerName}
            onChange={(e) => setEmailerName(e.target.value)}
            onBlur={async () => {
              if (!currentEmailerId) return
              const trimmed = emailerName.trim() || 'Untitled'
              try {
                const res = await fetch(`/api/studio/emailers/${currentEmailerId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: trimmed }),
                })
                if (!res.ok) return
                const updated = await res.json() as EmailerMeta
                setSavedEmailers((prev) => prev.map((e) => e.id === updated.id ? updated : e))
              } catch {
                // swallow — UX stays optimistic
              }
            }}
            placeholder="Untitled campaign"
            className="w-48 shrink-0 bg-transparent text-left text-[11px] font-medium text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-0"
          />

          <div className="flex-1" />

          {/* ── Save / Save as New ── */}
          <div className="inline-flex items-center gap-1">
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors',
                saveStatus === 'saved'
                  ? 'bg-green-50 text-green-600'
                  : saveStatus === 'error'
                  ? 'bg-red-50 text-red-600'
                  : 'bg-gray-900 text-white hover:bg-gray-700',
              )}
            >
              {saveStatus === 'saving' ? (
                <Loader2 size={11} className="animate-spin" />
              ) : saveStatus === 'saved' ? (
                <Check size={11} />
              ) : (
                <Save size={11} />
              )}
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Error' : 'Save'}
            </button>

            {currentEmailerId && (
              <button
                onClick={() => {
                  setSaveModalMode('fork')
                  setEmailerNameInput((savedEmailers.find((e) => e.id === currentEmailerId)?.name ?? 'Untitled') + ' (copy)')
                  setShowSaveModal(true)
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
                title="Save as new emailer"
              >
                <PlusCircle size={11} /> Save as New
              </button>
            )}
          </div>

          {/* ── Export menu ── */}
          <ExportMenu
            mode="email"
            onExport={handleEmailExport}
            onSendTest={() => setSendTestOpen(true)}
          />

          {/* ── Desktop / Mobile toggle ── */}
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
            <button
              onClick={() => setPreviewMode('desktop')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors',
                previewMode === 'desktop' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
              )}
            >
              <Monitor size={12} /> Desktop
            </button>
            <button
              onClick={() => setPreviewMode('mobile')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors',
                previewMode === 'mobile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
              )}
            >
              <Smartphone size={12} /> Mobile
            </button>
          </div>

          {/* ── HTML Preview toggle ── */}
          <button
            onClick={() => setShowPreview((v) => !v)}
            title={showPreview ? 'Back to editor' : 'Preview actual email HTML'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors',
              showPreview
                ? 'border-blue-400 bg-blue-50 text-blue-600'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
            )}
          >
            {showPreview ? <EyeOff size={12} /> : <Eye size={12} />}
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>

        {/* ── Save / Name modal ── */}
        {showSaveModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="w-80 rounded-2xl bg-white p-6 shadow-2xl">
              <h3 className="mb-1 text-[14px] font-semibold text-gray-900">
                {saveModalMode === 'fork' ? 'Save as New Emailer' : 'Name Your Emailer'}
              </h3>
              <p className="mb-4 text-[11px] text-gray-400">
                {saveModalMode === 'fork'
                  ? 'Creates a duplicate with a new name — the original is untouched.'
                  : 'Give this emailer a name so you can find it later.'}
              </p>
              <input
                autoFocus
                type="text"
                value={emailerNameInput}
                onChange={(e) => setEmailerNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveConfirm() }}
                placeholder="e.g. Summer Sale 2025"
                className="mb-4 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="rounded-lg px-3 py-2 text-[12px] text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConfirm}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-[12px] font-medium text-white hover:bg-gray-700 transition-colors"
                >
                  {saveModalMode === 'fork' ? 'Save Copy' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── HTML Preview iframe (replaces canvas when Preview is active) ── */}
        {showPreview && (
          <div className="flex flex-1 items-start justify-center overflow-auto bg-[#F3F4F6] py-8">
            <div
              className={cn(
                'overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-black/5',
                previewMode === 'mobile' ? 'w-[390px]' : 'w-[660px]',
              )}
            >
              {/* Browser chrome bar */}
              <div className="flex h-8 items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <div className="ml-2 flex-1 rounded-sm bg-white px-2 py-0.5 text-[9px] text-gray-300 text-center">
                  {previewMode === 'mobile' ? 'Email client — mobile' : 'Email client — desktop'}
                </div>
              </div>
              {previewSrcDoc ? (
                <iframe
                  ref={previewIframeRef}
                  title="Email HTML Preview"
                  srcDoc={previewSrcDoc}
                  className="w-full border-0 block"
                  style={{ minHeight: 600, height: 'auto' }}
                  onLoad={(e) => {
                    // Auto-size iframe to its content height
                    const iframe = e.currentTarget
                    try {
                      const h = iframe.contentDocument?.documentElement?.scrollHeight
                      if (h) iframe.style.height = `${h}px`
                    } catch { /* cross-origin guard */ }
                  }}
                />
              ) : (
                <div className="flex h-40 items-center justify-center text-[12px] text-gray-400">
                  Compiling email…
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scrollable canvas */}
        <div
          className={cn(
            'flex flex-1 items-start justify-center overflow-auto py-8',
            showPreview && 'hidden',
          )}
          onClick={handleCanvasClick}
        >
          <div className="w-full max-w-[680px] px-4">

            {/* Empty state */}
            {canvasBlocks.length === 0 && (
              <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white py-24">
                <div className="text-center">
                  <p className="text-[13px] font-medium text-gray-400">Add a block from the right panel or Sections</p>
                  <p className="mt-1 text-[11px] text-gray-300">Your email will be built here</p>
                </div>
              </div>
            )}

            {/* Top inserter (before first block) */}
            {insertState?.afterId === null && (
              <BlockInserter
                onSelect={(t) => handleInlineInsert(t, null)}
                onClose={() => setInsertState(null)}
              />
            )}

            {canvasBlocks.map((block, i) => {
              const isSelected = selectedId === block.id
              const prevId = i === 0 ? null : canvasBlocks[i - 1].id

              return (
                <React.Fragment key={block.id}>
                  {/* Block row — extra right margin so the absolute action bar has room */}
                  <div
                    className="relative mb-1 mr-14"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* The block itself */}
                    <div
                      className={cn(
                        'cursor-pointer overflow-hidden rounded border-2 transition-all',
                        isSelected
                          ? 'border-blue-400 shadow-[0_0_0_3px_rgba(96,165,250,0.15)]'
                          : 'border-transparent hover:border-gray-200',
                      )}
                      onClick={() => {
                        setSelectedId(block.id)
                        setInsertState(null)
                      }}
                    >
                      <BlockContent
                        type={block.type}
                        backgroundColor={block.backgroundColor}
                        onTextClick={handleTextClick}
                        imageSrcs={block.imageSrcs}
                        imageSizes={block.imageSizes}
                        onImageDoubleClick={(key) => handleOpenImagePicker(block.id, key)}
                        onImageResize={(key, h) => handleImageResize(block.id, key, h)}
                        onImageClick={(e) => showAlly('image', e)}
                        buttonShapeVariant={block.buttonShapeVariant}
                        buttonFillColor={block.buttonFillColor}
                        buttonBorderColor={block.buttonBorderColor}
                        buttonPosition={block.buttonPosition}
                        buttonBorderWidth={block.buttonBorderWidth}
                        buttonWidth={block.buttonWidth}
                        buttonHeight={block.buttonHeight}
                        buttonFontFamily={block.buttonFontFamily}
                        fontFamily={block.fontFamily ?? doc.globalStyles.fontFamily}
                        fontSize={block.fontSize}
                        fontBold={block.fontBold}
                        fontItalic={block.fontItalic}
                        fontUnderline={block.fontUnderline}
                        fontColor={block.fontColor}
                        textAlign={block.textAlign}
                        lineHeight={block.lineHeight}
                        letterSpacing={block.letterSpacing}
                        imageShape={block.imageShape}
                        onButtonAreaClick={handleButtonAreaClick}
                        contentLayout={block.contentLayout}
                        onContentLayoutSelect={(layout) =>
                          handleBlockPatch(block.id, { contentLayout: (layout || undefined) as CanvasBlock['contentLayout'] })
                        }
                        spacerHeight={block.spacerHeight}
                        linkBarItems={block.linkBarItems}
                        footerLinks={block.footerLinks}
                        socialLinks={block.socialLinks}
                        socialIconStyle={block.socialIconStyle}
                        socialIconColor={block.socialIconColor}
                        socialIconSize={block.socialIconSize}
                        socialIconPosition={block.socialIconPosition}
                        socialIconSpacing={block.socialIconSpacing}
                        logoWidth={block.logoWidth}
                        contentHeight={block.contentHeight}
                        contentButton={block.contentButton}
                        isDraggingButton={draggedBlockType === 'button'}
                        onDropButton={(pos) => handleBlockPatch(block.id, {
                          contentButton: { position: pos, label: 'Click Here' },
                        })}
                        onContentButtonRemove={() => handleBlockPatch(block.id, { contentButton: null })}
                      />
                    </div>

                    {/* ± Insert above (top center of outline) */}
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setInsertState({ afterId: prevId })
                        }}
                        className="absolute -top-3 left-1/2 z-20 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-white shadow-md transition-transform hover:scale-110 hover:bg-blue-600"
                        title="Insert block above"
                      >
                        <Plus size={12} />
                      </button>
                    )}

                    {/* ± Insert below (bottom center of outline) */}
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setInsertState({ afterId: block.id })
                        }}
                        className="absolute -bottom-3 left-1/2 z-20 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-white shadow-md transition-transform hover:scale-110 hover:bg-blue-600"
                        title="Insert block below"
                      >
                        <Plus size={12} />
                      </button>
                    )}

                    {/* Floating action bar — absolutely to the right, outside the block */}
                    {isSelected && (
                      <div className="absolute right-[-52px] top-2 z-30">
                        <FloatingActionBar
                          onMoveUp={() => handleMoveUp(block.id)}
                          onMoveDown={() => handleMoveDown(block.id)}
                          onDuplicate={() => handleDuplicate(block.id)}
                          onDelete={() => handleDelete(block.id)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Inline block inserter — shown after this block when triggered */}
                  {insertState?.afterId === block.id && (
                    <BlockInserter
                      onSelect={(t) => handleInlineInsert(t, block.id)}
                      onClose={() => setInsertState(null)}
                    />
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {/* Approved images overlay — opens when an image slot is double-clicked */}
        <ApprovedImagesPanel
          open={showApprovedImages}
          onClose={() => { setShowApprovedImages(false); setPendingImageTarget(null) }}
          onSelect={handleImageSelect}
        />

        {/* ── Persistent Allyvate trigger button (bottom-right of canvas) ── */}
        {!allyVisible && (
          <button
            type="button"
            onClick={(e) => showAlly('text', e)}
            title="Ask Allyvate"
            className="absolute bottom-6 right-6 z-[80] flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 hover:shadow-xl overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/allyvate-icon.svg" alt="Ask Allyvate" width={44} height={44} />
          </button>
        )}
      </div>

      {/* ── Right Nav: SendTest → EmailRightNav (when block selected) → Block Library ─ */}
      <aside className="flex w-[300px] shrink-0 flex-col border-l border-gray-200 bg-white">
        {sendTestOpen ? (
          <SendTestEmailPanel
            onClose={() => setSendTestOpen(false)}
            previewSrcDoc={previewSrcDoc}
            compiledHtml={compiledHtml}
          />
        ) : selectedBlock ? (
          <EmailRightNav
            block={selectedBlock}
            onPatch={handleBlockPatch}
            onOpenImagePicker={handleOpenImagePicker}
            onImageUpload={handleDirectImageUpload}
            onBack={() => setSelectedId(null)}
            focusTab={focusTab}
          />
        ) : (
          <BlockLibrary
            selectedBlock={undefined}
            onBlockSelect={handleAppendInsert}
          />
        )}
      </aside>

      {/* ── Allyvate AI Assistant (pill → expanded card) ─────────────────── */}
      <AllyvateAssistant
        visible={allyVisible}
        context={allyContext}
        anchorX={allyAnchorX}
        anchorY={allyAnchorY}
        seedText={allySeedText}
        onClose={() => setAllyVisible(false)}
      />

    </div>
  )
}
