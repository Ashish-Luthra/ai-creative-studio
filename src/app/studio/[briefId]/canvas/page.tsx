import { CanvasEditorClient } from '@/components/canvas/CanvasEditorClient'

interface CanvasPageProps {
  params: Promise<{ briefId: string }>
}

export default async function CanvasPage({ params }: CanvasPageProps) {
  const { briefId } = await params
  // TODO: validate briefId + gate1Approved from Supabase before rendering
  void briefId
  return <CanvasEditorClient />
}
