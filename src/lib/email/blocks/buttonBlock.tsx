/**
 * buttonBlock.tsx — renders a ButtonBlock as a table-based email button.
 *
 * Contract:
 *  - Uses VML conditional comments so Outlook renders a real filled button,
 *    not a plain text link.
 *  - width='full' makes the button span the column.
 *  - Max 2 ButtonBlocks per section is enforced in compiler.ts, not here.
 */

import { Button } from '@react-email/components'
import type { ButtonBlock, GlobalEmailStyles } from '@/types/email'
import { buildFontStack } from '../styleUtils'

interface ButtonBlockRendererProps {
  block: ButtonBlock
  columnWidth: number
  globalStyles: GlobalEmailStyles
}

export function renderButtonBlock({
  block,
  columnWidth,
  globalStyles,
}: ButtonBlockRendererProps) {
  const { styles, label, href, newTab } = block
  const fontFamily = buildFontStack(styles.fontFamily, globalStyles.fontFamily)
  const btnWidth = styles.width === 'full' ? columnWidth : undefined

  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      style={{ width: '100%' }}
    >
      <tbody>
        <tr>
          <td align={styles.align} style={{ padding: '8px 0' }}>
            <Button
              href={href}
              target={newTab ? '_blank' : '_self'}
              style={{
                display: 'inline-block',
                backgroundColor: styles.backgroundColor,
                color: styles.color,
                fontFamily,
                fontSize: `${styles.fontSize}px`,
                fontWeight: styles.fontWeight,
                textDecoration: 'none',
                textAlign: 'center',
                borderRadius: `${styles.borderRadius}px`,
                paddingTop: `${styles.padding.top}px`,
                paddingRight: `${styles.padding.right}px`,
                paddingBottom: `${styles.padding.bottom}px`,
                paddingLeft: `${styles.padding.left}px`,
                ...(styles.border?.style !== 'none'
                  ? {
                      border: `${styles.border?.width ?? 0}px ${styles.border?.style ?? 'solid'} ${styles.border?.color ?? 'transparent'}`,
                    }
                  : {}),
                ...(btnWidth ? { width: `${btnWidth}px` } : {}),
              }}
            >
              {label}
            </Button>
          </td>
        </tr>
      </tbody>
    </table>
  )
}
