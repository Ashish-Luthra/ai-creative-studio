/**
 * imageBlock.tsx — renders an ImageBlock as email-safe HTML.
 *
 * Contract:
 *  - width='full' resolves to 100% of its containing column.
 *  - Wrapped in a centering <table> so alignment works in Outlook.
 *  - Responsive: max-width set; Outlook uses a fixed VML width via mso-style.
 */

import { Img, Link } from '@react-email/components'
import type { ImageBlock, GlobalEmailStyles } from '@/types/email'
import { paddingToInline, borderToInline } from '../styleUtils'

interface ImageBlockRendererProps {
  block: ImageBlock
  /** px width of the containing column — used to resolve 'full' */
  columnWidth: number
  globalStyles: GlobalEmailStyles
}

export function renderImageBlock({
  block,
  columnWidth,
  globalStyles: _globalStyles,
}: ImageBlockRendererProps) {
  const { styles, src, alt, href } = block

  const resolvedWidth =
    styles.width === 'full' ? columnWidth : Math.min(styles.width, columnWidth)

  const img = (
    <Img
      src={src}
      alt={alt}
      width={resolvedWidth}
      style={{
        display: 'block',
        border: 'none',
        outline: 'none',
        textDecoration: 'none',
        maxWidth: '100%',
        ...borderToInline(styles.border),
        ...(styles.borderRadius ? { borderRadius: `${styles.borderRadius}px` } : {}),
      }}
    />
  )

  const aligned = (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      style={{
        width: '100%',
        ...paddingToInline(styles.padding),
      }}
    >
      <tbody>
        <tr>
          <td align={styles.align}>{href ? <Link href={href}>{img}</Link> : img}</td>
        </tr>
      </tbody>
    </table>
  )

  return aligned
}
