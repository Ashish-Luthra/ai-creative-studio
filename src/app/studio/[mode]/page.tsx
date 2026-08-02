import { StudioScreen } from '../../../studio/StudioScreen'

interface StudioPageProps {
  params: Promise<{ mode: string }>
}

export default async function StudioModePage({ params }: StudioPageProps) {
  const { mode } = await params
  return <StudioScreen mode={mode} />
}
