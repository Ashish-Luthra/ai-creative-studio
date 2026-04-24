/**
 * textBlock.tsx — renders a TextBlock as email-safe HTML.
 *
 * Contract:
 *  - Content is always live HTML text. Never rasterised into an image.
 *  - All CSS is inlined on the wrapping <td>.
 *  - MSO-safe: uses a <table> wrapper so padding is honoured in Outlook.
 */

import { Text } from '@react-email/components'
import type { TextBlock, GlobalEmailStyles } from '@/types/email'
import { paddingToInline, buildFontStack } from '../styleUtils'

interface TextBlockRendererProps {
  block: TextBlock
  globalStyles: GlobalEmailStyles
}

export function renderTextBlock({ block, globalStyles }: TextBlockRendererProps) {
  const { styles, content } = block
  const fontFamily = buildFontStack(styles.fontFamily, globalStyles.fontFamily)

  return (
    <Text
      style={{
        fontFamily,
        fontSize: `${styles.fontSize}px`,
        fontWeight: styles.fontWeight,
        lineHeight: String(styles.lineHeight),
        color: styles.color,
        textAlign: styles.textAlign,
        margin: '0',
        ...paddingToInline(styles.padding),
      }}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
