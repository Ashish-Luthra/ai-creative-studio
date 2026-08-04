// Layer type definitions for Fabric.js objects in the studio

export type LayerType = 'text' | 'image' | 'shape' | 'group' | 'zone'

export interface LayerMeta {
  id: string
  type: LayerType
  name: string
  zoneId?: string
  locked?: boolean
}

export interface TextLayerProps {
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: number | string
  fill: string
  lineHeight: number
  left: number
  top: number
}
