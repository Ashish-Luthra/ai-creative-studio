/**
 * logoBlock.tsx — renders a LogoBlock.
 *
 * Contract:
 *  - When meta.isGlobal === true the compiler has already resolved src/alt/width
 *    from globalStyles.logo before calling this renderer. So this renderer
 *    always receives fully resolved props regardless of isGlobal.
 */

import { Img, Link } from '@react-email/components'
import type { LogoBlock } from '@/types/email'

interface LogoBlockRendererProps {
  block: LogoBlock
  /** Resolved by the compiler from globalStyles.logo when meta.isGlobal === true */
  resolvedSrc: string
  resolvedAlt: string
  resolvedWidth: number
  resolvedHref?: string
}

export function renderLogoBlock({
  resolvedSrc,
  resolvedAlt,
  resolvedWidth,
  resolvedHref,
}: LogoBlockRendererProps) {
  const img = (
    <Img
      src={resolvedSrc}
      alt={resolvedAlt}
      width={resolvedWidth}
      style={{
        display: 'block',
        border: 'none',
        outline: 'none',
        textDecoration: 'none',
        maxWidth: '100%',
      }}
    />
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
          <td align="center" style={{ padding: '16px 0' }}>
            {resolvedHref ? <Link href={resolvedHref}>{img}</Link> : img}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
