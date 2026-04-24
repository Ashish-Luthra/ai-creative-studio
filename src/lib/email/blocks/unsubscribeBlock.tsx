/**
 * unsubscribeBlock.tsx — renders the locked Unsubscribe block.
 *
 * Contract:
 *  - Always the last rendered element in the email.
 *  - Cannot be deleted, reordered, or hidden — enforced in compiler and store.
 *  - Supports merge tags in href e.g. {{unsubscribe_url}}
 *  - Small muted footer style by default.
 */

import { Link, Text } from '@react-email/components'
import type { UnsubscribeBlock, GlobalEmailStyles } from '@/types/email'
import { buildFontStack } from '../styleUtils'

interface UnsubscribeBlockRendererProps {
  block: UnsubscribeBlock
  globalStyles: GlobalEmailStyles
}

export function renderUnsubscribeBlock({
  block,
  globalStyles,
}: UnsubscribeBlockRendererProps) {
  const { styles, text, href } = block
  const fontFamily = buildFontStack(styles.fontFamily, globalStyles.fontFamily)

  // Split text on the link placeholder [[unsubscribe]] if present,
  // otherwise wrap the whole text in the link.
  const parts = text.split('[[unsubscribe]]')
  const hasPlaceholder = parts.length === 2

  const linkEl = (
    <Link
      href={href}
      style={{
        color: globalStyles.linkColor,
        textDecoration: 'underline',
      }}
    >
      {hasPlaceholder ? 'Unsubscribe' : text}
    </Link>
  )

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
          <td align="center" style={{ padding: '24px 16px 16px' }}>
            <Text
              style={{
                fontFamily,
                fontSize: `${styles.fontSize}px`,
                fontWeight: styles.fontWeight,
                lineHeight: String(styles.lineHeight),
                color: styles.color,
                textAlign: 'center',
                margin: '0',
              }}
            >
              {hasPlaceholder ? (
                <>
                  {parts[0]}
                  {linkEl}
                  {parts[1]}
                </>
              ) : (
                linkEl
              )}
            </Text>
          </td>
        </tr>
      </tbody>
    </table>
  )
}
