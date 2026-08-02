/**
 * compiler.ts — compiles a PageDocument to clean HTML/CSS.
 * Output is self-contained: one HTML file, inline <style>, no JS required.
 */

import type { PageDocument, PageBlock, ContentSlot } from '@studio/types/page'

function t(slot: ContentSlot | undefined, fallback = ''): string {
  if (!slot) return fallback
  if (slot.type === 'text') return escapeHtml(slot.value)
  return fallback
}

function img(slot: ContentSlot | undefined): { src: string; alt: string } {
  if (!slot || slot.type !== 'image') return { src: '', alt: '' }
  return { src: slot.src, alt: slot.alt }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function compileBlock(block: PageBlock): string {
  const bg = block.bgColor ?? '#FFFFFF'
  const c = block.content

  switch (block.type) {
    case 'page-hero': {
      const hero = img(c.image)
      return `
<section style="position:relative;background-color:${bg};overflow:hidden;min-height:480px;">
  ${hero.src ? `<img src="${hero.src}" alt="${escapeHtml(hero.alt)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.35;">` : ''}
  <div style="position:relative;max-width:800px;margin:0 auto;padding:80px 40px;text-align:center;">
    <span style="display:inline-block;font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#93C5FD;margin-bottom:16px;">${t(c.tag)}</span>
    <h1 style="font-size:42px;font-weight:800;line-height:1.15;color:#FFFFFF;margin:0 0 20px;">${t(c.heading)}</h1>
    <p style="font-size:18px;line-height:1.7;color:#CBD5E1;margin:0;">${t(c.subtext)}</p>
  </div>
</section>`
    }

    case 'page-executive-summary': {
      return `
<section style="background-color:${bg};padding:64px 40px;">
  <div style="max-width:900px;margin:0 auto;">
    <h2 style="font-size:30px;font-weight:700;color:#0F172A;margin:0 0 20px;">${t(c.heading)}</h2>
    <p style="font-size:17px;line-height:1.75;color:#475569;margin:0 0 48px;">${t(c.body)}</p>
    <div style="display:flex;gap:32px;flex-wrap:wrap;">
      ${[1,2,3].map(i => `
      <div style="flex:1;min-width:160px;border-top:3px solid #2563EB;padding-top:16px;">
        <div style="font-size:36px;font-weight:800;color:#2563EB;">${t(c[`stat${i}`])}</div>
        <div style="font-size:14px;font-weight:600;color:#0F172A;margin-top:4px;">${t(c[`stat${i}label`])}</div>
      </div>`).join('')}
    </div>
  </div>
</section>`
    }

    case 'page-problem': {
      const problem = img(c.image)
      return `
<section style="background-color:${bg};padding:64px 40px;">
  <div style="max-width:1100px;margin:0 auto;display:flex;gap:64px;align-items:center;flex-wrap:wrap;">
    ${problem.src ? `<div style="flex:1;min-width:280px;"><img src="${problem.src}" alt="${escapeHtml(problem.alt)}" style="width:100%;border-radius:12px;display:block;"></div>` : ''}
    <div style="flex:1;min-width:280px;">
      <span style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#EF4444;">${t(c.label)}</span>
      <h2 style="font-size:30px;font-weight:700;color:#0F172A;margin:12px 0 20px;">${t(c.heading)}</h2>
      <p style="font-size:16px;line-height:1.75;color:#475569;margin:0;">${t(c.body)}</p>
    </div>
  </div>
</section>`
    }

    case 'page-solution': {
      const sol = img(c.image)
      return `
<section style="background-color:${bg};padding:64px 40px;">
  <div style="max-width:1100px;margin:0 auto;display:flex;gap:64px;align-items:center;flex-wrap:wrap;flex-direction:row-reverse;">
    ${sol.src ? `<div style="flex:1;min-width:280px;"><img src="${sol.src}" alt="${escapeHtml(sol.alt)}" style="width:100%;border-radius:12px;display:block;"></div>` : ''}
    <div style="flex:1;min-width:280px;">
      <span style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#10B981;">${t(c.label)}</span>
      <h2 style="font-size:30px;font-weight:700;color:#0F172A;margin:12px 0 20px;">${t(c.heading)}</h2>
      <p style="font-size:16px;line-height:1.75;color:#475569;margin:0;">${t(c.body)}</p>
    </div>
  </div>
</section>`
    }

    case 'page-results': {
      return `
<section style="background-color:${bg};padding:72px 40px;">
  <div style="max-width:900px;margin:0 auto;text-align:center;">
    <h2 style="font-size:34px;font-weight:800;color:#FFFFFF;margin:0 0 12px;">${t(c.heading)}</h2>
    <p style="font-size:17px;color:#94A3B8;margin:0 0 56px;">${t(c.subtext)}</p>
    <div style="display:flex;gap:24px;flex-wrap:wrap;justify-content:center;">
      ${[1,2,3].map(i => `
      <div style="flex:1;min-width:220px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:32px 24px;">
        <div style="font-size:42px;font-weight:900;color:#FFFFFF;">${t(c[`stat${i}`])}</div>
        <div style="font-size:16px;font-weight:600;color:#E2E8F0;margin-top:8px;">${t(c[`stat${i}label`])}</div>
        <div style="font-size:13px;color:#94A3B8;margin-top:6px;">${t(c[`stat${i}desc`])}</div>
      </div>`).join('')}
    </div>
  </div>
</section>`
    }

    case 'page-quote': {
      const av = img(c.avatar)
      return `
<section style="background-color:${bg};padding:72px 40px;">
  <div style="max-width:700px;margin:0 auto;text-align:center;">
    <svg style="width:40px;height:40px;color:#BAE6FD;margin-bottom:24px;" viewBox="0 0 24 24" fill="currentColor"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/></svg>
    <blockquote style="font-size:22px;font-weight:500;line-height:1.65;color:#0F172A;margin:0 0 32px;font-style:italic;">${t(c.quote)}</blockquote>
    <div style="display:flex;align-items:center;justify-content:center;gap:14px;">
      ${av.src ? `<img src="${av.src}" alt="${escapeHtml(av.alt)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">` : ''}
      <div style="text-align:left;">
        <div style="font-size:15px;font-weight:700;color:#0F172A;">${t(c.name)}</div>
        <div style="font-size:13px;color:#64748B;">${t(c.title)}</div>
      </div>
    </div>
  </div>
</section>`
    }

    case 'page-cta': {
      const btnUrl = c.btnUrl?.type === 'text' ? c.btnUrl.value : '#'
      return `
<section style="background-color:${bg};padding:80px 40px;text-align:center;">
  <div style="max-width:640px;margin:0 auto;">
    <h2 style="font-size:34px;font-weight:800;color:#FFFFFF;margin:0 0 16px;">${t(c.heading)}</h2>
    <p style="font-size:18px;color:rgba(255,255,255,0.8);margin:0 0 36px;">${t(c.subtext)}</p>
    <a href="${escapeHtml(btnUrl)}" style="display:inline-block;background:#FFFFFF;color:#2563EB;font-size:16px;font-weight:700;padding:16px 36px;border-radius:8px;text-decoration:none;">${t(c.btnText)}</a>
  </div>
</section>`
    }

    case 'page-image': {
      const fi = img(c.image)
      return `
<section style="background-color:${bg};padding:0;">
  ${fi.src ? `<img src="${fi.src}" alt="${escapeHtml(fi.alt)}" style="width:100%;display:block;max-height:520px;object-fit:cover;">` : ''}
  ${t(c.caption) ? `<p style="text-align:center;font-size:13px;color:#94A3B8;padding:12px 40px;">${t(c.caption)}</p>` : ''}
</section>`
    }

    case 'page-divider':
      return `<div style="background-color:${bg};height:1px;margin:0 40px;background:linear-gradient(to right,transparent,#E2E8F0,transparent);"></div>`

    default:
      return ''
  }
}

export function compilePage(doc: PageDocument): string {
  const blocks = doc.blocks.map(compileBlock).join('\n')
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(doc.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:${doc.globalStyles.fontFamily};color:${doc.globalStyles.textColor};background:${doc.globalStyles.bgColor};-webkit-font-smoothing:antialiased;}
  img{max-width:100%;height:auto;}
  @media(max-width:640px){
    h1{font-size:28px!important;}
    h2{font-size:24px!important;}
    section{padding:40px 20px!important;}
    div[style*="display:flex"]{flex-direction:column!important;}
  }
</style>
</head>
<body>
${blocks}
</body>
</html>`
}
