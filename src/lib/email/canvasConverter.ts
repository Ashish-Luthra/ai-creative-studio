/**
 * canvasConverter.ts
 *
 * Converts a CanvasBlock[] (the visual canvas editor model) into a valid
 * EmailDocument that can be compiled to email-safe HTML.
 *
 * Design notes:
 *  - Each CanvasBlock maps to one or more EmailSections (some prebuilt blocks
 *    need two sections to replicate their split background treatment).
 *  - Font/colour/spacing settings from the canvas block are forwarded faithfully
 *    so the compiled HTML matches what the user designed in the canvas.
 *  - Tailwind class equivalents used in this file:
 *      text-sm  = 14px    text-xl   = 20px    text-2xl  = 24px
 *      text-3xl = 30px    text-4xl  = 36px    text-5xl  = 48px
 *      p-8  = 32px    p-12 = 48px
 *      bg-gray-50  = #F9FAFB    bg-gray-100 = #F3F4F6
 *      text-gray-400 = #9CA3AF   text-gray-500 = #6B7280
 *      text-gray-600 = #4B5563   text-gray-700 = #374151
 */

import { nanoid } from 'nanoid'
import type { CanvasBlock } from '@/types/canvas'
import type {
  EmailDocument, EmailSection, EmailBlock,
  TextStyles, ButtonStyles, ImageStyles, SectionStyles,
} from '@/types/email'
import {
  makeTextBlock, makeImageBlock, makeButtonBlock, makeSpacerBlock,
  makeLogoBlock, makeSection, makeUnsubscribeBlock,
  DEFAULT_GLOBAL_STYLES,
} from './templates'
import { SPECS } from './blockSpecs'

// ─── Style helpers ─────────────────────────────────────────────────────────────

/**
 * Section-level styles. `defaultBg` lets prebuilt blocks specify their
 * canvas-hardcoded background colour (e.g. bg-gray-50) as a default, while
 * still respecting any explicit background the user set in the right nav.
 */
function sectionStyles(
  cb: CanvasBlock,
  overridePadding?: SectionStyles['padding'],
  defaultBg = '#FFFFFF',
): SectionStyles {
  return {
    backgroundColor: cb.backgroundColor ?? defaultBg,
    padding: overridePadding ?? { top: 16, right: 24, bottom: 16, left: 24 },
  }
}

function textStyles(cb: CanvasBlock, overrides: Partial<TextStyles> = {}): TextStyles {
  return {
    // Use the block's explicit font if set; otherwise empty string so
    // buildFontStack() defers to the document's global font family instead
    // of hard-coding Arial and accidentally overriding the global choice.
    fontFamily: cb.fontFamily ?? '',
    fontSize: cb.fontSize ?? 16,
    fontWeight: cb.fontBold ? 'bold' : 'normal',
    lineHeight: cb.lineHeight ?? 1.6,
    color: cb.fontColor ?? '#111827',
    textAlign: cb.textAlign ?? 'left',
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    ...overrides,
  }
}

function buttonStyles(cb: CanvasBlock, overrides: Partial<ButtonStyles> = {}): ButtonStyles {
  return {
    backgroundColor: cb.buttonFillColor ?? '#111827',
    color: '#FFFFFF',
    fontFamily: cb.buttonFontFamily ?? cb.fontFamily ?? '',
    fontSize: cb.fontSize ?? 14,
    fontWeight: '600',
    padding: { top: 12, right: 24, bottom: 12, left: 24 },
    borderRadius: typeof cb.buttonShapeVariant === 'number' ? cb.buttonShapeVariant : 6,
    border: cb.buttonBorderColor
      ? { width: cb.buttonBorderWidth ?? 1, style: 'solid', color: cb.buttonBorderColor }
      : undefined,
    align: cb.buttonPosition ?? 'center',
    width: 'auto',
    ...overrides,
  }
}

function imageStyles(overrides: Partial<ImageStyles> = {}): ImageStyles {
  return {
    width: 'full',
    align: 'center',
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    ...overrides,
  }
}

function firstImageSrc(cb: CanvasBlock, fallback = ''): string {
  if (!cb.imageSrcs) return fallback
  const keys = Object.keys(cb.imageSrcs)
  return keys.length ? (cb.imageSrcs[keys[0]] ?? fallback) : fallback
}

/**
 * Build a narrow centred decorative line matching the canvas `h-px w-16 bg-{color}`.
 * Returns an HTML string safe for use inside a dangerouslySetInnerHTML text block.
 */
function narrowLine(color = '#9CA3AF'): string {
  return `<p style="margin:8px 0;text-align:center">` +
    `<span style="display:inline-block;width:64px;height:1px;` +
    `background-color:${color};line-height:1px;font-size:1px">&nbsp;</span></p>`
}

// ─── Per-block-type converters ────────────────────────────────────────────────

function convertLogo(cb: CanvasBlock): EmailSection {
  const src = firstImageSrc(cb) || (cb.imageSrcs?.['logo'] ?? '')
  const width = cb.logoWidth ?? 120
  const logo = makeLogoBlock({ src, alt: 'Logo', width, isGlobal: !src })
  return makeSection('full', [[logo]], {
    styles: sectionStyles(cb, { top: 16, right: 24, bottom: 16, left: 24 }),
  })
}

function convertLinkBar(cb: CanvasBlock): EmailSection {
  const DEFAULT_LINKS = [
    { label: 'Home',     url: '#' },
    { label: 'About',    url: '#' },
    { label: 'Products', url: '#' },
    { label: 'Blog',     url: '#' },
    { label: 'Contact',  url: '#' },
  ]
  const links = cb.linkBarItems && cb.linkBarItems.length > 0 ? cb.linkBarItems : DEFAULT_LINKS
  const linkColor = cb.fontColor ?? '#4B5563'   // matches canvas text-gray-600 default
  const linkHtml = links
    .map((l) => `<a href="${l.url || '#'}" style="color:${linkColor};text-decoration:none;margin:0 8px">${l.label}</a>`)
    .join('<span style="color:#D1D5DB"> | </span>')
  const block = makeTextBlock({
    content: `<p style="margin:0;text-align:center">${linkHtml}</p>`,
    styles: textStyles(cb, { textAlign: 'center', fontSize: 13 }),
  })
  return makeSection('full', [[block]], {
    styles: sectionStyles(cb, { top: 8, right: 24, bottom: 8, left: 24 }),
  })
}

function convertText(cb: CanvasBlock): EmailSection {
  const block = makeTextBlock({ styles: textStyles(cb) })
  return makeSection('full', [[block]], { styles: sectionStyles(cb) })
}

function convertButton(cb: CanvasBlock): EmailSection {
  const block = makeButtonBlock('Click Here', cb.linkUrl ?? '#')
  block.styles = buttonStyles(cb)
  return makeSection('full', [[block]], { styles: sectionStyles(cb) })
}

function convertSpacer(cb: CanvasBlock): EmailSection {
  // Canvas defaults spacer height to 64 px; match that here.
  const block = makeSpacerBlock(cb.spacerHeight ?? 64)
  return makeSection('full', [[block]], {
    styles: sectionStyles(cb, { top: 0, right: 0, bottom: 0, left: 0 }),
  })
}

function convertSocial(cb: CanvasBlock): EmailSection {
  // All supported platforms with simple outline SVGs (no background circle)
  const ALL_SOCIAL_ICONS: { key: string; name: string; svg: string }[] = [
    { key: 'facebook',  name: 'Facebook',  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 76 151"><path d="M48.8868895,150 L48.8868895,81.5829675 L71.0820271,81.5829675 L74.4119522,54.9117243 L48.8868895,54.9117243 L48.8868895,37.8860248 C48.8868895,30.1664959 50.9510317,24.9057297 61.6662481,24.9057297 L75.3103402,24.8999285 L75.3103402,1.04422486 C72.9507863,0.7270899 64.8512718,0 55.4242746,0 C35.7392011,0 22.2624467,12.4272427 22.2624467,35.2445227 L22.2624467,54.9117243 L0,54.9117243 L0,81.5829675 L22.2624467,81.5829675 L22.2624467,150 L48.8868895,150 Z" fill="currentColor"/></svg>` },
    { key: 'instagram', name: 'Instagram', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 150 150"><path d="M43.9385663,0.524533902 C35.9584855,0.901035204 30.5089304,2.17453961 25.7448821,4.04654608 C20.8143322,5.96805272 16.63529,8.54656163 12.4772479,12.7195761 C8.3192058,16.8925905 5.75867989,21.0746049 3.85066058,26.012622 C2.0041419,30.7871385 0.753129235,36.2411574 0.400625668,44.225685 C0.048122101,52.2102126 -0.0298786883,54.7767214 0.00912170636,75.1437918 C0.048122101,95.5108622 0.138123012,98.0638711 0.525126928,106.064899 C0.906130784,114.043426 2.17514363,119.491445 4.04716257,124.256962 C5.97168205,129.187479 8.54720811,133.364993 12.7217504,137.524507 C16.8962926,141.684022 21.0753349,144.238531 26.025385,146.149537 C30.7954333,147.993044 36.2509885,149.250048 44.2340692,149.599549 C52.21715,149.94905 54.786676,150.030051 75.1478821,149.991051 C95.5090881,149.95205 98.0726141,149.86205 106.072195,149.482549 C114.071776,149.103047 119.491331,147.825043 124.258379,145.962037 C129.188929,144.03303 133.369471,141.462021 137.526013,137.286007 C141.682555,133.109992 144.241581,128.924978 146.148101,123.983961 C147.996119,119.213944 149.251632,113.758425 149.598136,105.781398 C149.947639,97.7758701 150.03014,95.2198612 149.991139,74.8557908 C149.952139,54.4917204 149.860638,51.9387116 149.481134,43.940684 C149.10163,35.9426563 147.831118,30.5111376 145.960599,25.7426211 C144.033079,20.812104 141.460553,16.6375896 137.287511,12.4750752 C133.114469,8.31256082 128.926426,5.75505198 123.986876,3.85304541 C119.213828,2.00653902 113.761273,0.748034675 105.778192,0.403033482 C97.7951113,0.0580322898 95.2255853,-0.0304680161 74.8568791,0.00853211873 C54.488173,0.0475322535 51.9381472,0.134532554 43.9385663,0.524533902 M44.8145751,136.107003 C37.5020011,135.789001 33.5314609,134.573997 30.8854342,133.556994 C27.3813987,132.206989 24.8853734,130.574983 22.2483468,127.963474 C19.6113201,125.351965 17.9913037,122.846957 16.6232898,119.350445 C15.5957794,116.704435 14.3582669,112.738422 14.0162635,105.425897 C13.6442597,97.5223692 13.5662589,95.149361 13.5227585,75.1257918 C13.479258,55.1022226 13.5557588,52.7322144 13.9022623,44.825687 C14.2142655,37.5191618 15.4367778,33.544148 16.4522881,30.8996389 C17.8023018,27.3911268 19.4283182,24.8996182 22.0458447,22.264109 C24.6633712,19.6285999 27.1608965,18.0055943 30.6604319,16.6375896 C33.3034586,15.605586 37.2694988,14.3785818 44.5790727,14.0305806 C52.4886528,13.6555793 54.8586768,13.580579 74.8793794,13.5370789 C94.900082,13.4935787 97.276106,13.568579 105.188686,13.9165802 C112.49526,14.2345813 116.4718,15.4450855 119.113327,16.466589 C122.618862,17.8165937 125.113388,19.4380993 127.748914,22.0601083 C130.384441,24.6821174 132.008958,27.170626 133.376971,30.6776381 C134.410482,33.3131472 135.637494,37.2776609 135.982498,44.5916862 C136.359002,52.5012136 136.444502,54.8727218 136.480503,74.891791 C136.516503,94.9108602 136.446002,97.2883684 136.099499,105.191896 C135.779996,112.504421 134.567983,116.476435 133.549473,119.125444 C132.199459,122.627956 130.571943,125.125465 127.952916,127.759474 C125.33389,130.393483 122.839365,132.016488 119.338329,133.384493 C116.698303,134.414997 112.727762,135.645001 105.424188,135.993002 C97.5146084,136.365003 95.1445844,136.443004 75.1163818,136.486504 C55.0881791,136.530004 52.7256552,136.449004 44.8160751,136.107003 M105.956681,34.9151528 C105.962769,38.5555907 108.161365,41.8338524 111.527153,43.2210978 C114.89294,44.6083432 118.762982,43.8313356 121.332456,41.2524379 C123.901931,38.6735401 124.664746,34.800701 123.265158,31.4400458 C121.865569,28.0793906 118.579245,25.8928458 114.938785,25.9001035 C109.969341,25.9100535 105.948402,29.9457394 105.956681,34.9151528 M36.4909195,75.0747916 C36.5329913,96.3448651 53.8071661,113.548425 75.0728813,113.507996 C96.3385965,113.467424 113.554271,96.1948646 113.513842,74.9247911 C113.47327,53.6547176 96.1945951,36.4466581 74.9258798,36.4885815 C53.6571646,36.5306584 36.4504905,53.8077181 36.4909195,75.0747916 M50.0000776,75.0477915 C49.9728164,61.2403887 61.1438528,50.0251321 74.9513476,49.9977529 C88.7588424,49.9704739 99.9741883,61.1414212 100.001586,74.948824 C100.028883,88.7562268 88.8578758,99.9715126 75.0503811,99.998933 C68.4195228,100.012815 62.0547988,97.3916838 57.3567893,92.7122724 C52.6587798,88.0328611 50.0124476,81.6786088 50.0000776,75.0477915" fill="currentColor"/></svg>` },
    { key: 'pinterest', name: 'Pinterest', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 123 150"><path d="M63.1421366,0 C21.9216112,0 0,26.3449432 0,55.0712443 C0,68.3937228 7.46387621,85.0069752 19.4117183,90.2759639 C21.2259855,91.0916258 22.213022,90.7447351 22.617237,89.0665341 C22.9744502,87.7914764 24.5443083,81.6505732 25.3057365,78.753567 C25.5407452,77.8254 25.4185406,77.0191134 24.6665128,76.1471989 C20.699566,71.5719917 17.5504495,63.2372392 17.5504495,55.4181351 C17.5504495,35.3828526 33.5216405,15.9288465 60.6980462,15.9288465 C84.1989159,15.9288465 100.640124,31.1545361 100.640124,52.9336475 C100.640124,77.5441372 87.5830411,94.5699084 70.6154132,94.5699084 C61.2244657,94.5699084 54.2306069,87.2195754 56.449089,78.1254135 C59.1281881,67.2967981 64.3829826,55.6525207 64.3829826,47.8427919 C64.3829826,40.8393497 60.4160358,35.0453373 52.3129359,35.0453373 C42.7527821,35.0453373 34.9974951,44.4863899 34.9974951,57.161964 C34.9974951,65.2154538 37.8552009,70.6532001 37.8552009,70.6532001 C37.8552009,70.6532001 28.3984509,108.754926 26.6405859,115.870873 C23.6700759,127.918294 27.0448008,147.428552 27.3362116,149.106754 C27.5148182,150.034921 28.5582568,150.325559 29.1410784,149.566149 C30.0717128,148.347344 41.5025358,132.080982 44.7080545,120.3242 C45.8736976,116.039631 50.6584747,98.6669689 50.6584747,98.6669689 C53.8075912,104.339101 62.8977276,109.092441 72.5800859,109.092441 C101.382752,109.092441 122.195122,83.8444226 122.195122,52.5117534 C122.091718,22.4728929 96.3159643,0 63.1421366,0 Z" fill="currentColor"/></svg>` },
    { key: 'twitter',   name: 'X',         svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 147 150"><path d="M87.3508403,63.5147631 L141.990998,0 L129.043029,0 L81.5989873,55.1489762 L43.7055701,0 L0,0 L57.3022823,83.3950194 L0,150 L12.9487023,150 L63.0508329,91.7608063 L103.069057,150 L146.774628,150 L87.3476602,63.5147631 L87.3508403,63.5147631 Z M69.6158174,84.1297488 L63.8099024,75.825485 L17.6143007,9.74754764 L37.502752,9.74754764 L74.7831405,63.0745615 L80.5890555,71.3788253 L129.049145,140.695712 L109.160694,140.695712 L69.6158174,84.1329289 L69.6158174,84.1297488 Z" fill="currentColor"/></svg>` },
    { key: 'youtube',   name: 'YouTube',   svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 199 150"><path d="M129.50411,66.1398527 L85.7518432,42.2005317 C83.2361295,40.8240663 80.2626011,40.8754381 77.7967484,42.3365164 C75.3293847,43.7991055 73.8577298,46.3828114 73.8577298,49.2505742 L73.8577298,96.7182401 C73.8577298,99.5724041 75.3203189,102.151577 77.7710625,103.615677 C79.0508281,104.380213 80.4695997,104.763991 81.8913938,104.763991 C83.1938232,104.763991 84.4992747,104.442161 85.7004714,103.795479 L129.454249,80.2686449 C132.051553,78.8710262 133.672791,76.1709778 133.684931,73.2201136 C133.695455,70.2692495 132.093859,67.5571135 129.50411,66.1398527 L129.50411,66.1398527 Z M85.4632541,90.7470083 L85.4632541,55.2701559 L118.163,73.1626981 L85.4632541,90.7470083 Z" fill="currentColor"/><path d="M196.585277,35.4028165 L196.576212,35.3121601 C196.408498,33.7181192 194.73891,19.5394657 187.846005,12.327753 C179.878823,3.84534017 170.846428,2.81487983 166.502478,2.32080261 C166.142874,2.28000716 165.81349,2.24223377 165.518857,2.20294916 L165.172852,2.16668662 C138.991297,0.262903614 99.451529,0.0030218784 99.0556631,0.0015109392 L99.0209114,0 L98.9861597,0.0015109392 C98.5902938,0.0030218784 59.0505256,0.262903614 32.633265,2.16668662 L32.284238,2.20294916 C32.0032031,2.24072293 31.6934607,2.27547424 31.3565211,2.31475885 C27.0624321,2.81034691 18.1267375,3.84231848 10.136891,12.6314517 C3.57186027,19.7661064 1.67412063,33.6410612 1.47920957,35.2003504 L1.45654539,35.4028165 C1.39761866,36.0661189 0,51.8569442 0,67.7097183 L0,82.5290099 C0,98.381784 1.39761866,114.17261 1.45654539,114.837423 L1.46712206,114.937145 C1.63483602,116.5055 3.3029129,130.424272 10.1640881,137.639007 C17.6553245,145.837362 27.1274022,146.922217 32.2222896,147.505439 C33.0276201,147.597607 33.7211413,147.676175 34.1940651,147.759277 L34.6518798,147.822737 C49.7688264,149.261151 97.1654781,149.969781 99.1750274,149.998489 L99.235465,150 L99.2959025,149.998489 C99.6917684,149.996978 139.230025,149.737097 165.41158,147.833313 L165.757585,147.79705 C166.088481,147.753233 166.460171,147.713949 166.868125,147.671643 C171.138039,147.218361 180.025384,146.277046 187.904932,137.607276 C194.469963,130.471111 196.369213,116.596156 196.562613,115.038378 L196.585277,114.835912 C196.644204,114.171099 198.043334,98.381784 198.043334,82.5290099 L198.043334,67.7097183 C198.043334,51.8569442 196.644204,36.0676297 196.585277,35.4028165 L196.585277,35.4028165 Z M186.436299,82.5290099 C186.436299,97.2017406 185.155022,112.312643 185.034147,113.699686 C184.541581,117.520851 182.539587,126.299408 179.340928,129.776079 C174.409223,135.201861 169.343044,135.739756 165.644265,136.131089 C165.197027,136.177928 164.783029,136.223257 164.408316,136.270095 C139.084975,138.101354 101.038015,138.382389 99.2853259,138.392965 C97.3195937,138.364257 50.6164632,137.649583 35.960353,136.288227 C35.2094163,136.165841 34.398042,136.072162 33.5428502,135.975462 C29.2049437,135.478363 23.2669528,134.798441 18.7008944,129.776079 L18.5936176,129.661248 C15.4508641,126.387042 13.5062856,118.17811 13.0122084,113.745014 C12.9200412,112.696422 11.6055239,97.4072283 11.6055239,82.5290099 L11.6055239,67.7097183 C11.6055239,53.053608 12.8837787,37.9593256 13.0076755,36.5435753 C13.5954311,32.0424877 15.6351988,23.7957814 18.7008944,20.4626497 C23.7836938,14.8721746 29.1429953,14.2526894 32.6876585,13.8432248 C33.0261088,13.8039405 33.3418954,13.767678 33.6335066,13.7299046 C59.3255167,11.8895805 97.6459565,11.6161006 99.0209114,11.6055239 C100.395866,11.6145897 138.702708,11.8895805 164.166566,13.7299046 C164.47933,13.7691888 164.820803,13.8084734 165.187961,13.8507797 C168.833857,14.2662877 174.344252,14.8948384 179.401366,20.2888916 L179.448205,20.3387525 C182.590959,23.6129578 184.535537,31.9654297 185.029614,36.4876706 C185.117249,37.4773359 186.436299,52.7997702 186.436299,67.7097183 L186.436299,82.5290099 Z" fill="currentColor"/></svg>` },
  ]

  const links = cb.socialLinks ?? {}
  const linkedKeys = Object.keys(links).filter((k) => links[k])

  // Use linked platforms if any, otherwise show default set
  const DEFAULT_KEYS = ['facebook', 'instagram', 'pinterest', 'twitter', 'youtube']
  const iconsToRender = linkedKeys.length > 0
    ? ALL_SOCIAL_ICONS.filter((icon) => links[icon.key])
    : ALL_SOCIAL_ICONS.filter((icon) => DEFAULT_KEYS.includes(icon.key))

  // Icon styling options
  const iconStyle = cb.socialIconStyle ?? 'outline'
  const iconColor = cb.socialIconColor ?? '#1F2937'
  const iconSize = cb.socialIconSize ?? 'M'
  const iconPosition = cb.socialIconPosition ?? 'center'
  const iconSpacing = cb.socialIconSpacing ?? 12

  // Size mapping
  const sizeMap = { S: 24, M: 32, L: 40 }
  const iconPx = sizeMap[iconSize]
  const borderWidth = iconStyle === 'filled' ? 0 : 1

  // Alignment mapping for table
  const alignMap = { left: 'left', center: 'center', right: 'right' }
  const tableAlign = alignMap[iconPosition]

  const iconCells = iconsToRender.map(({ key, name, svg }) => {
    const url = links[key] || '#'

    // For outline style: use transparent bg with border
    // For filled style: use icon color as bg with white icon
    const bgColor = iconStyle === 'filled' ? iconColor : 'transparent'
    const iconColor_ = iconStyle === 'filled' ? '#ffffff' : iconColor
    const borderColor = iconStyle === 'filled' ? 'none' : iconColor
    const borderStyle = iconStyle === 'filled' ? 'none' : `solid 1px ${borderColor}`

    // Replace currentColor in SVG with actual color
    const styledSvg = svg.replace(/currentColor/g, iconColor_)
    const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(styledSvg)}`

    const paddingPx = iconSpacing / 2
    return `<td align="center" style="padding:0 ${paddingPx}px">` +
      `<a href="${url}" style="display:inline-block;text-decoration:none" title="${name}">` +
      `<span style="display:inline-flex;align-items:center;justify-content:center;width:${iconPx}px;height:${iconPx}px;background-color:${bgColor};border:${borderStyle};border-radius:50%;line-height:0">` +
      `<img src="${dataUri}" width="${iconPx}" height="${iconPx}" alt="${name}" style="display:block;border:none;width:${iconPx}px;height:${iconPx}px">` +
      `</span></a></td>`
  }).join('')

  const block = makeTextBlock({
    content: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tbody><tr style="text-align:${tableAlign}">${iconCells}</tr></tbody></table>`,
    styles: textStyles(cb, { textAlign: tableAlign, fontSize: 0 }),
  })
  return makeSection('full', [[block]], { styles: sectionStyles(cb) })
}

function convertAddress(cb: CanvasBlock): EmailSection {
  const block = makeTextBlock({
    content: `<p style="margin:0;text-align:center;color:#6B7280">123 Main Street, Suite 100 · City, State 12345 · United States</p>`,
    styles: textStyles(cb, { textAlign: 'center', fontSize: 11, color: '#6B7280' }),
  })
  return makeSection('full', [[block]], {
    styles: sectionStyles(cb, { top: 8, right: 24, bottom: 8, left: 24 }),
  })
}

function convertFooter(cb: CanvasBlock): EmailSection {
  // Canvas: bg-gray-50 px-12 py-6 → #F9FAFB background, 48px horiz padding, 24px vert
  const DEFAULT_FOOTER_LINKS = [
    { label: 'Privacy Policy', url: '#' },
    { label: 'Unsubscribe',    url: '#' },
    { label: 'View in Browser', url: '#' },
    { label: 'Contact Us',     url: '#' },
  ]
  const fLinks = cb.footerLinks && cb.footerLinks.length > 0 ? cb.footerLinks : DEFAULT_FOOTER_LINKS
  const linkHtml = fLinks
    .map((l) => `<a href="${l.url || '#'}" style="color:#6B7280;text-decoration:none">${l.label}</a>`)
    .join('<span style="color:#D1D5DB"> · </span>')
  const block = makeTextBlock({
    content: `<p style="margin:0 0 12px 0;text-align:center">${linkHtml}</p>` +
      `<p style="margin:0;text-align:center;color:#9CA3AF;font-size:10px">` +
      `© ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>`,
    styles: textStyles(cb, { textAlign: 'center', fontSize: 11, color: '#6B7280' }),
  })
  return makeSection('full', [[block]], {
    // bg-gray-50 = #F9FAFB  ·  px-12 py-6 → 24px vert, 48px horiz
    styles: sectionStyles(cb, { top: 24, right: 48, bottom: 24, left: 48 }, '#F9FAFB'),
  })
}

function convertContent(cb: CanvasBlock): EmailSection {
  const layout = cb.contentLayout ?? 'image'
  const imgSrc = firstImageSrc(cb, '')
  const btnLabel = cb.contentButton?.label ?? 'Shop Now'

  if (layout === 'image') {
    const img = makeImageBlock(imgSrc, 'Content image')
    img.styles = imageStyles()
    const blocks: EmailBlock[] = [img]
    if (cb.contentButton) blocks.push(makeButtonBlock(btnLabel, '#'))
    return makeSection('full', [blocks], { styles: sectionStyles(cb) })
  }

  if (layout === 'image-text') {
    const heading = makeTextBlock({
      content: '<p style="margin:0;font-size:22px;font-weight:700">Content Heading</p>',
      styles: textStyles(cb, { fontSize: 22, fontWeight: 'bold' }),
    })
    const body = makeTextBlock({
      content: '<p style="margin:0">Click to edit this text. Tell your story alongside the image.</p>',
      styles: textStyles(cb),
    })
    const imgBlock = makeImageBlock(imgSrc, 'Content image')
    imgBlock.styles = imageStyles()
    const contentBlocks: EmailBlock[] = [heading, body]
    if (cb.contentButton) contentBlocks.push(makeButtonBlock(btnLabel, '#'))
    return makeSection('image-left', [[imgBlock], contentBlocks], { styles: sectionStyles(cb) })
  }

  if (layout === '2col-text') {
    const col1 = [
      makeTextBlock({ content: '<p style="margin:0;font-weight:700">Column One Heading</p>', styles: textStyles(cb) }),
      makeTextBlock({ content: '<p style="margin:0">Add your text here. Click to edit this column and tell your story.</p>', styles: textStyles(cb) }),
    ]
    const col2 = [
      makeTextBlock({ content: '<p style="margin:0;font-weight:700">Column Two Heading</p>', styles: textStyles(cb) }),
      makeTextBlock({ content: '<p style="margin:0">Add your text here. Click to edit this column and share more details.</p>', styles: textStyles(cb) }),
    ]
    return makeSection('two-col', [col1, col2], { styles: sectionStyles(cb) })
  }

  if (layout === '3col-text') {
    const col = (label: string) => [
      makeTextBlock({ content: `<p style="margin:0;font-weight:700">Column ${label}</p>`, styles: textStyles(cb) }),
      makeTextBlock({ content: '<p style="margin:0">Click to edit this column.</p>', styles: textStyles(cb) }),
    ]
    return makeSection('three-col', [col('One'), col('Two'), col('Three')], { styles: sectionStyles(cb) })
  }

  return makeSection('full', [[makeTextBlock()]], { styles: sectionStyles(cb) })
}

// ── Prebuilt layout blocks ────────────────────────────────────────────────────

function convertImageLeftTextRight(cb: CanvasBlock): EmailSection {
  const S = SPECS.IMAGE_LEFT_TEXT_RIGHT
  const imgSrc = cb.imageSrcs?.[S.imageKey] ?? ''
  const imgBlock = makeImageBlock(imgSrc, 'Feature image')
  imgBlock.styles = imageStyles()

  const hPad = { top: 0, right: S.textPaddingH, bottom: 0, left: S.textPaddingH }
  const tagline = makeTextBlock({
    content: `<p style="margin:0;font-style:italic;color:${S.taglineColor};text-align:center">From The &apos;Gram</p>`,
    styles: textStyles(cb, { fontSize: S.taglineFontSize, color: S.taglineColor, textAlign: 'center', padding: hPad }),
  })
  const headingSize = cb.fontSize ?? S.headingFontSize
  const heading = makeTextBlock({
    content: `<p style="margin:0;font-size:${headingSize}px;font-weight:${S.headingWeight};text-align:center">The Post That Got Everyone Talking</p>`,
    styles: textStyles(cb, { fontSize: headingSize, fontWeight: S.headingWeight, textAlign: 'center', padding: hPad }),
  })
  const dividerBlock = makeTextBlock({
    content: narrowLine(S.dividerColor),
    styles: textStyles(cb, { textAlign: 'center', fontSize: 1 }),
  })
  const btn = makeButtonBlock(S.buttonLabel, '#')
  btn.styles = buttonStyles(cb, { align: S.buttonAlign, padding: { top: 8, right: 24, bottom: 8, left: 24 } })

  return {
    id: nanoid(),
    layout: 'two-col',
    columns: [
      { id: nanoid(), widthPct: S.imageColPct, blocks: [imgBlock] },
      {
        id: nanoid(), widthPct: S.textColPct,
        blocks: [makeSpacerBlock(S.textPaddingV), tagline, heading, dividerBlock, btn, makeSpacerBlock(S.textPaddingV)],
      },
    ],
    styles: sectionStyles(cb, S.sectionPadding),
  }
}

function convertCenteredContent(cb: CanvasBlock): EmailSection {
  const S = SPECS.CENTERED_CONTENT
  // White card as a nested HTML table — gives the white-on-gray effect without
  // CSS box-shadows (which email clients strip). Font-family is NOT set on the
  // inner <p> tags so the <td> wrapper's buildFontStack cascade applies.
  const bodyColor = cb.fontColor ?? S.bodyColor

  const cardHtml =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" ` +
    `style="background-color:${S.cardBg};border-radius:${S.cardBorderRadius}px;margin:0 auto;width:100%">` +
    `<tr><td style="padding:${S.cardPadding}px;text-align:center">` +
    `<p style="margin:0;font-size:${S.numberFontSize}px;font-weight:700;color:${S.numberColor};line-height:${S.numberLineHeight}">6</p>` +
    `<p style="margin:8px 0 0;font-size:${cb.fontSize ?? S.headingFontSize}px;font-weight:${S.headingWeight}">Tips to Photograph Food</p>` +
    `<p style="margin:12px auto 0;font-size:${S.bodyFontSize}px;color:${bodyColor};max-width:${S.bodyMaxWidthPx}px;line-height:${S.bodyLineHeight}">` +
    `I remember my first try at food photography. I created this guide to help you get started without making all the mistakes I did.</p>` +
    `<p style="margin:16px 0 0;font-size:${S.labelFontSize}px;color:${S.labelColor}">001</p>` +
    `</td></tr></table>`

  const cardBlock = makeTextBlock({
    content: cardHtml,
    styles: textStyles(cb, { textAlign: 'center', fontSize: S.bodyFontSize }),
  })
  const btn = makeButtonBlock(S.buttonLabel, '#')
  btn.styles = buttonStyles(cb, { align: S.buttonAlign, padding: { top: 8, right: 24, bottom: 8, left: 24 } })

  return makeSection('full', [[cardBlock, btn]], {
    styles: sectionStyles(cb, S.outerPadding, S.outerBg),
  })
}

function convertTextOverImage(cb: CanvasBlock): EmailSection {
  const S = SPECS.TEXT_OVER_IMAGE
  const headingSize = cb.fontSize ?? S.headingFontSize
  const headingHtml =
    narrowLine(S.dividerColor) +
    `<p style="margin:0;font-size:${headingSize}px;font-weight:${S.headingWeight};` +
    `letter-spacing:${S.headingTracking};text-align:center;text-transform:uppercase">` +
    `A Little Gift of Thanks for Joining the List.</p>` +
    narrowLine(S.dividerColor)

  const heading = makeTextBlock({
    content: headingHtml,
    styles: textStyles(cb, { textAlign: 'center', fontSize: headingSize, fontWeight: S.headingWeight }),
  })
  const imgSrc = cb.imageSrcs?.[S.imageKey] ?? firstImageSrc(cb, '')
  const imgBlock = makeImageBlock(imgSrc, 'Feature image')
  imgBlock.styles = imageStyles()
  const btn = makeButtonBlock(S.buttonLabel, '#')
  btn.styles = buttonStyles(cb, { align: S.buttonAlign, padding: S.buttonPadding })

  return makeSection('full', [[heading, btn, makeSpacerBlock(16), imgBlock]], {
    styles: sectionStyles(cb, S.sectionPadding, S.bgColor),
  })
}

function convertTextLeftImageRight(cb: CanvasBlock): EmailSection {
  const S = SPECS.TEXT_LEFT_IMAGE_RIGHT
  const hPad = { top: 0, right: S.textPaddingH, bottom: 0, left: S.textPaddingH }
  const headingSize = cb.fontSize ?? S.headingFontSize
  const heading = makeTextBlock({
    content: `<p style="margin:0;font-size:${headingSize}px;font-weight:${S.headingWeight};line-height:${S.headingLineHeight}">WEL&mdash;COME</p>`,
    styles: textStyles(cb, { fontSize: headingSize, fontWeight: S.headingWeight, lineHeight: S.headingLineHeight, padding: hPad }),
  })
  const btn = makeButtonBlock(S.buttonLabel, '#')
  btn.styles = buttonStyles(cb, { align: S.buttonAlign, padding: { top: 8, right: 24, bottom: 8, left: 24 } })

  const imgSrc = cb.imageSrcs?.[S.imageKey] ?? firstImageSrc(cb, '')
  const imgBlock = makeImageBlock(imgSrc, 'Welcome image')
  imgBlock.styles = imageStyles()

  return {
    id: nanoid(),
    layout: 'image-right',
    columns: [
      {
        id: nanoid(), widthPct: S.textColPct,
        blocks: [makeSpacerBlock(S.textPaddingV), heading, makeSpacerBlock(16), btn, makeSpacerBlock(S.textPaddingV)],
      },
      { id: nanoid(), widthPct: S.imageColPct, blocks: [imgBlock] },
    ],
    styles: sectionStyles(cb, S.sectionPadding),
  }
}

function convertRecipeCard(cb: CanvasBlock): EmailSection {
  const S = SPECS.RECIPE_CARD
  const imgSrc = cb.imageSrcs?.[S.imageKey] ?? firstImageSrc(cb, '')
  const imgBlock = makeImageBlock(imgSrc, 'Recipe image')
  imgBlock.styles = imageStyles()

  // Canvas text column uses px-4 (16px) horizontal padding
  const hPad = { top: 0, right: 16, bottom: 0, left: 16 }
  const label = makeTextBlock({
    content: `<p style="margin:0;font-style:italic;color:${S.labelColor}">One</p>`,
    styles: textStyles(cb, { fontSize: S.labelFontSize, color: S.labelColor, padding: hPad }),
  })
  const headingSize = cb.fontSize ?? S.headingFontSize
  const heading = makeTextBlock({
    content: `<p style="margin:0;font-size:${headingSize}px;font-weight:${S.headingWeight}">Click here for my creamy butternut squash soup</p>`,
    styles: textStyles(cb, { fontSize: headingSize, fontWeight: S.headingWeight, padding: hPad }),
  })
  const description = makeTextBlock({
    content: `<p style="margin:0;font-style:italic;color:${S.descColor}">A warming recipe perfect for fall evenings.</p>`,
    styles: textStyles(cb, { fontSize: S.descFontSize, color: S.descColor, padding: hPad }),
  })
  const btn = makeButtonBlock(S.buttonLabel, '#')
  btn.styles = buttonStyles(cb, { align: S.buttonAlign, padding: { top: 8, right: 24, bottom: 8, left: 24 } })

  return {
    id: nanoid(),
    layout: 'two-col',
    columns: [
      { id: nanoid(), widthPct: S.imageColPct, blocks: [imgBlock] },
      {
        id: nanoid(), widthPct: S.textColPct,
        blocks: [makeSpacerBlock(S.textInnerSpacerV), label, heading, description, btn, makeSpacerBlock(S.textInnerSpacerV)],
      },
    ],
    styles: sectionStyles(cb, S.sectionPadding, S.bgColor),
  }
}

function convertImageTopTextBottom(cb: CanvasBlock): EmailSection[] {
  const S = SPECS.IMAGE_TOP_TEXT_BOTTOM

  const imgSrc = cb.imageSrcs?.[S.imageKey] ?? firstImageSrc(cb, '')
  const imgBlock = makeImageBlock(imgSrc, 'Feature image')
  imgBlock.styles = imageStyles()
  const imageSection = makeSection('full', [[imgBlock]], {
    styles: { backgroundColor: S.imageSectionBg, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
  })

  const headingSize = cb.fontSize ?? S.headingFontSize
  const heading = makeTextBlock({
    content: `<p style="margin:0 0 ${S.headingBottomMargin}px;font-size:${headingSize}px;font-weight:${S.headingWeight};text-align:center">Get 25% off when you book my services</p>`,
    styles: textStyles(cb, { textAlign: 'center', fontSize: headingSize, fontWeight: S.headingWeight }),
  })
  const body = makeTextBlock({
    content: `<p style="margin:0;font-style:italic;color:${S.bodyColor};text-align:center">for the next 24 hours only.</p>`,
    styles: textStyles(cb, { textAlign: 'center', fontSize: S.bodyFontSize, color: S.bodyColor }),
  })
  const btn = makeButtonBlock(S.buttonLabel, '#')
  btn.styles = buttonStyles(cb, { align: S.buttonAlign, padding: S.buttonPadding })

  const textSection = makeSection('full', [[heading, body, makeSpacerBlock(S.buttonSpacerV), btn]], {
    styles: { backgroundColor: cb.backgroundColor ?? S.textBg, padding: S.textPadding },
  })

  return [imageSection, textSection]
}

function convertTestimonial(cb: CanvasBlock): EmailSection {
  const S = SPECS.TESTIMONIAL
  const avatarSrc = cb.imageSrcs?.[S.avatarKey] ?? ''
  const avatarBlock = makeImageBlock(avatarSrc, 'Testimonial avatar')
  avatarBlock.styles = {
    width: S.avatarWidth,
    align: 'center',
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    borderRadius: S.avatarBorderRadius,
  }

  const name = makeTextBlock({
    content: `<p style="margin:0;font-weight:${S.nameWeight};font-size:${S.nameFontSize}px;letter-spacing:${S.nameTracking};text-transform:uppercase">TESTIMONIAL NAME</p>`,
    styles: textStyles(cb, { fontSize: S.nameFontSize, fontWeight: S.nameWeight }),
  })
  const quoteSize = cb.fontSize ?? S.quoteFontSize
  const quote = makeTextBlock({
    content: `<p style="margin:0;font-size:${quoteSize}px;color:${S.quoteColor};line-height:${S.quoteLineHeight}">Since joining, my email list has grown 4x and I&apos;ve finally found a system that works for my creative business.</p>`,
    styles: textStyles(cb, { fontSize: quoteSize, color: S.quoteColor, lineHeight: S.quoteLineHeight }),
  })
  const stars = makeTextBlock({
    content: `<p style="margin:8px 0 0;font-size:${S.starFontSize}px;color:${S.starColor}">${S.starsHtml}</p>`,
    styles: textStyles(cb, { fontSize: S.starFontSize, color: S.starColor }),
  })

  return {
    id: nanoid(),
    layout: 'two-col',
    columns: [
      {
        id: nanoid(), widthPct: S.avatarColPct,
        blocks: [makeSpacerBlock(S.innerSpacerV), avatarBlock, makeSpacerBlock(S.innerSpacerV)],
      },
      {
        id: nanoid(), widthPct: S.textColPct,
        blocks: [makeSpacerBlock(S.innerSpacerV), name, makeSpacerBlock(S.innerSpacerV), quote, stars, makeSpacerBlock(S.innerSpacerV)],
      },
    ],
    styles: sectionStyles(cb, S.sectionPadding, S.bgColor),
  }
}

// ─── Main converter ───────────────────────────────────────────────────────────

/**
 * Converts one CanvasBlock to one or more EmailSections.
 * Most blocks produce one section; image-top-text-bottom produces two (split bg).
 */
function canvasBlockToSections(cb: CanvasBlock): EmailSection[] {
  switch (cb.type) {
    case 'logo':                  return [convertLogo(cb)]
    case 'link-bar':              return [convertLinkBar(cb)]
    case 'text':                  return [convertText(cb)]
    case 'button':                return [convertButton(cb)]
    case 'spacer':                return [convertSpacer(cb)]
    case 'social':                return [convertSocial(cb)]
    case 'address':               return [convertAddress(cb)]
    case 'footer':                return [convertFooter(cb)]
    case 'content':               return [convertContent(cb)]
    case 'image-left-text-right': return [convertImageLeftTextRight(cb)]
    case 'centered-content':      return [convertCenteredContent(cb)]
    case 'text-over-image':       return [convertTextOverImage(cb)]
    case 'text-left-image-right': return [convertTextLeftImageRight(cb)]
    case 'recipe-card':           return [convertRecipeCard(cb)]
    case 'image-top-text-bottom': return convertImageTopTextBottom(cb)   // returns 2
    case 'testimonial':           return [convertTestimonial(cb)]
    default: {
      const placeholder = makeTextBlock({
        content: `<p style="margin:0;color:#9CA3AF;font-size:11px;text-align:center">[${cb.type}]</p>`,
        styles: textStyles(cb, { textAlign: 'center', fontSize: 11, color: '#9CA3AF' }),
      })
      return [makeSection('full', [[placeholder]], { styles: sectionStyles(cb) })]
    }
  }
}

/**
 * Convert a CanvasBlock[] into an EmailDocument ready for compilation.
 *
 * @param canvasBlocks  The current canvas state from EmailEditorPanel
 * @param existingDoc   Optional: when provided, preserves subject, preheader,
 *                      globalStyles, and the unsubscribe block from the existing
 *                      document so user-configured values aren't lost on re-sync.
 */
export function canvasBlocksToEmailDocument(
  canvasBlocks: CanvasBlock[],
  existingDoc?: EmailDocument,
): EmailDocument {
  const g = existingDoc?.globalStyles ?? DEFAULT_GLOBAL_STYLES

  // Flatten — most blocks yield one section, image-top-text-bottom yields two
  const sections = canvasBlocks.flatMap(canvasBlockToSections)

  return {
    id: existingDoc?.id ?? nanoid(),
    subject: existingDoc?.subject ?? 'Your email subject',
    preheader: existingDoc?.preheader ?? '',
    sections,
    unsubscribe: existingDoc?.unsubscribe ?? makeUnsubscribeBlock(g),
    globalStyles: g,
  }
}
