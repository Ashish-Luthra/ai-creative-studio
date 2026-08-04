/**
 * POST /api/send-test-email
 *
 * DEV-ONLY IMPLEMENTATION — DO NOT SHIP TO PROD AS-IS.
 *
 * This route currently only logs the payload to the server console and returns
 * a success envelope so the front-end "Send test email" UX can be developed
 * end-to-end without provisioning an email provider. Swap to a real provider
 * before this ships to customers — recipes below.
 *
 * ─── To swap to Resend ────────────────────────────────────────────────────
 *  1. pnpm add resend
 *  2. Set RESEND_API_KEY in .env.local (server-only).
 *  3. Replace the body of POST below with:
 *       import { Resend } from 'resend'
 *       const resend = new Resend(process.env.RESEND_API_KEY!)
 *       const { error } = await resend.emails.send({
 *         from: 'noreply@your-verified-domain.com',
 *         to, subject, html,
 *       })
 *       if (error) return NextResponse.json({ error: error.message }, { status: 502 })
 *       return NextResponse.json({ data: { ok: true } })
 *
 * ─── To swap to Nodemailer + SMTP ─────────────────────────────────────────
 *  1. pnpm add nodemailer && pnpm add -D @types/nodemailer
 *  2. Set SMTP_HOST/PORT/USER/PASS in .env.local.
 *  3. Replace the body with:
 *       import nodemailer from 'nodemailer'
 *       const t = nodemailer.createTransport({
 *         host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587),
 *         secure: false, auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
 *       })
 *       await t.sendMail({ from: process.env.SMTP_USER, to, subject, html })
 *       return NextResponse.json({ data: { ok: true } })
 *
 * Until that swap happens, this route is a stub: payloads are validated, logged,
 * and acknowledged with `{ data: { ok: true, stubbed: true } }`. No email is
 * actually delivered.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const PayloadSchema = z.object({
  to:      z.string().email(),
  subject: z.string().min(1),
  html:    z.string().min(1),
})

export async function POST(req: Request) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = PayloadSchema.safeParse(json)
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join('; ')
    return NextResponse.json({ error: message || 'Invalid payload' }, { status: 400 })
  }

  const { to, subject, html } = parsed.data
  console.log('[send-test-email] would send:', { to, subject, htmlLen: html.length })

  return NextResponse.json({ data: { ok: true, stubbed: true } })
}
