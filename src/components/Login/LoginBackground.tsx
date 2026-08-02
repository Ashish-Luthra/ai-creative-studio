import type { ReactNode } from 'react';

interface LoginBackgroundProps {
  /** Centered content — e.g. the login/sign-up form. */
  children?: ReactNode;
}

/**
 * LoginBackground
 * ----------------
 * Full-screen decorative background converted from the Figma "Login Screen"
 * frame (1440 × 1024). Replaces the static /login-bg.png with pure vector art:
 *   - a soft vertical base gradient (white → #fafafa → #eaeaea)
 *   - two heavily-blurred color blobs (blue top-left, light-blue bottom-right)
 *   - the sweeping curves, drawn entirely as SVG <ellipse> strokes
 *   - a few small accent glyphs
 *
 * The center is left clear; pass the form via `children` and it is centered
 * on top of the artwork.
 */
export function LoginBackground({ children }: LoginBackgroundProps) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-white via-[#fafafa] to-[#eaeaea]">
      {/* Blurred blobs — CSS filter blur keeps the soft, heavy falloff from Figma. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[17%] -top-[9%] h-[62%] w-[62%] rounded-[700px] blur-[105px]"
        style={{
          backgroundImage:
            'linear-gradient(147deg, rgba(65,138,254,0.64) 38%, rgba(39,115,255,0.64) 88%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[60%] top-[58%] h-[42%] w-[40%] rounded-[700px] bg-gradient-to-b from-[rgba(143,186,254,0.8)] to-[rgba(186,211,255,0.8)] blur-[140px]"
      />

      {/* Curves + accent glyphs — all vector, scaled to cover the viewport. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1440 1024"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          {/* Horizontal fade so the arcs dissolve toward the edges, matching the frame. */}
          <linearGradient id="lb-curve" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#3b4a63" stopOpacity="0" />
            <stop offset="0.34" stopColor="#3b4a63" stopOpacity="0.28" />
            <stop offset="0.66" stopColor="#3b4a63" stopOpacity="0.28" />
            <stop offset="1" stopColor="#3b4a63" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* The three sweeping ellipses. Their near-coincident tops fan out into the
            crossing lines seen in the design (exact cx/cy/rx/ry from Figma bounds). */}
        <g stroke="url(#lb-curve)" strokeWidth="0.8">
          <ellipse cx="741.5" cy="618.6" rx="660.5" ry="304.5" />
          <ellipse cx="746" cy="651.2" rx="499.8" ry="337.1" />
          <ellipse cx="739.7" cy="623.5" rx="477.4" ry="299.6" />
        </g>

        {/* Accent glyphs, positioned from the Figma coordinates. */}
        <g stroke="#3a3a3a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.75">
          {/* down-right arrow (center) */}
          <path d="M713 262 l12 12 M725 266 l0 8 -8 0" />
          {/* move / node (left of center) */}
          <path d="M301 676 l0 14 M294 683 l14 0 M298 680 l3 -3 3 3 M298 686 l3 3 3 -3" />
          {/* api node (right of center) */}
          <path d="M955 351 l10 10 M965 351 l-10 10" />
        </g>

        {/* Sparkles */}
        <g fill="#3a3a3a" opacity="0.7">
          <path d="M1097 205 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" />
          <path d="M1284 566 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" />
        </g>
        <g fill="#8fbafe" opacity="0.6">
          <path d="M181 112 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" />
        </g>
      </svg>

      {/* Center slot — the login form goes here. */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        {children}
      </div>
    </div>
  );
}
