/**
 * dividerBlock.tsx — renders a DividerBlock as a full-width <hr>-style separator.
 *
 * Contract:
 *  - Rendered as a border-top on a zero-height <td>, not as an <hr>,
 *    so Outlook honours the colour and thickness correctly.
 */

import type { DividerBlock } from '@/types/email'

interface DividerBlockRendererProps {
  block: DividerBlock
}

export function renderDividerBlock({ block }: DividerBlockRendererProps) {
  const { styles } = block

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
          <td
            style={{
              paddingTop: `${styles.margin.top}px`,
              paddingBottom: `${styles.margin.bottom}px`,
            }}
          >
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              border={0}
              style={{ width: '100%' }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      borderTop: `${styles.height}px ${styles.style} ${styles.color}`,
                      fontSize: '0',
                      lineHeight: '0',
                      height: '0',
                    }}
                  />
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  )
}
