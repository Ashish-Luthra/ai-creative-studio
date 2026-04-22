import { redirect } from 'next/navigation'

// Dev shortcut — redirect straight to the canvas shell
// Production flow: /onboarding → brief agent → /studio/[briefId]/canvas
export default function Home() {
  redirect('/studio/dev-session/canvas')
}
