import { CanvasEditorClient } from '@/components/canvas/CanvasEditorClient'

interface CanvasPageProps {
  params: Promise<{ briefId: string }>
  searchParams: Promise<{ preset?: string }>
}

export default async function CanvasPage({ params, searchParams }: CanvasPageProps) {
  const { briefId } = await params
  const { preset } = await searchParams
  // TODO: validate briefId + gate1Approved from Supabase before rendering
  return <CanvasEditorClient briefId={briefId} initialPresetId={preset} />
}
