export interface CreativePreset {
  id: string
  label: string
  platform: 'instagram' | 'linkedin'
  ratioLabel: string
  width: number
  height: number
}

export const CREATIVE_PRESETS: CreativePreset[] = [
  { id: 'instagram-1-1', label: 'Instagram 1:1', platform: 'instagram', ratioLabel: '1:1', width: 1080, height: 1080 },
  { id: 'instagram-4-5', label: 'Instagram 4:5', platform: 'instagram', ratioLabel: '4:5', width: 1080, height: 1350 },
  { id: 'instagram-9-16', label: 'Instagram 9:16', platform: 'instagram', ratioLabel: '9:16', width: 1080, height: 1920 },
  { id: 'linkedin-1-1', label: 'LinkedIn 1:1', platform: 'linkedin', ratioLabel: '1:1', width: 1080, height: 1080 },
  { id: 'linkedin-1-91-1', label: 'LinkedIn 1.91:1', platform: 'linkedin', ratioLabel: '1.91:1', width: 1200, height: 628 },
  { id: 'linkedin-4-5', label: 'LinkedIn 4:5', platform: 'linkedin', ratioLabel: '4:5', width: 1080, height: 1350 },
]

export function getPresetById(id: string): CreativePreset {
  return CREATIVE_PRESETS.find((preset) => preset.id === id) ?? CREATIVE_PRESETS[1]
}

export function isPresetId(id: string): boolean {
  return CREATIVE_PRESETS.some((preset) => preset.id === id)
}
