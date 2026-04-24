/**
 * spacerBlock.tsx — renders a vertical spacer as a fixed-height empty <td>.
 *
 * Contract:
 *  - font-size:0 + line-height:0 prevent Outlook from adding extra whitespace.
 */

import type { SpacerBlock } from '@/types/email'

interface SpacerBlockRendererProps {
  block: SpacerBlock
}

export function renderSpacerBlock({ block }: SpacerBlockRendererProps) {
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
              height: `${block.height}px`,
              fontSize: '0',
              lineHeight: '0',
            }}
          >
            {/* Zero-width non-breaking space keeps Outlook from collapsing the row */}
            &nbsp;
          </td>
        </tr>
      </tbody>
    </table>
  )
}
