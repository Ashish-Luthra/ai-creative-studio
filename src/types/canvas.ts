/**
 * canvas.ts — CanvasBlock type used by EmailEditorPanel for the visual editor.
 *
 * These are the "design" representation of email blocks on the drag-and-drop
 * canvas. They are converted to the compiler's EmailDocument structure via
 * canvasConverter.ts before HTML compilation.
 */

export interface CanvasBlock {
  id: string
  type: string
  // Block
  backgroundColor?: string
  padding?: { top: number; right: number; bottom: number; left: number }
  // Image
  imageSrcs?: Record<string, string>
  imageSizes?: Record<string, number>
  imageShape?: 'circle' | 'square' | 'rounded' | 'arch' | 'diamond' | 'hexagon'
  // Social links — keyed by platform (e.g. 'instagram', 'facebook')
  socialLinks?: Record<string, string>
  // Social icons styling
  socialIconStyle?: 'outline' | 'filled'
  socialIconColor?: string
  socialIconSize?: 'S' | 'M' | 'L'
  socialIconPosition?: 'left' | 'center' | 'right'
  socialIconSpacing?: number
  // Button
  buttonShapeVariant?: number
  buttonFillColor?: string
  buttonBorderColor?: string
  buttonPosition?: 'left' | 'center' | 'right'
  buttonBorderWidth?: number
  buttonWidth?: number
  buttonHeight?: number
  buttonFontFamily?: string
  // Font
  fontFamily?: string
  fontSize?: number
  fontBold?: boolean
  fontItalic?: boolean
  fontUnderline?: boolean
  fontColor?: string
  textAlign?: 'left' | 'center' | 'right'
  lineHeight?: number
  letterSpacing?: number
  // Spacer
  spacerHeight?: number
  // Content block
  contentHeight?: number
  contentButton?: { position: 'below-text' | 'on-image'; label: string } | null
  // Link bar
  linkBarItems?: { label: string; url: string }[]
  // Footer
  footerLinks?: { label: string; url: string }[]
  // Content block inner layout
  contentLayout?: '2col-text' | '3col-text' | 'image' | 'image-text'
  // Logo
  logoWidth?: number
  // Link
  linkType?: 'url' | 'file' | 'checkout'
  linkUrl?: string
  linkAction?: string
}
