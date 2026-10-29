/**
 * VeriPayLogo — SVG recreation of the VP app icon.
 * Dark navy rounded-square with blue glow border + metallic silver VP lettermark.
 * Accepts a `size` prop (default 32).
 */

interface VeriPayLogoProps {
  size?: number
  className?: string
}

export function VeriPayLogo({ size = 32, className }: VeriPayLogoProps) {
  const r = size * 0.22 // corner radius ~22% of size

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="VERIPAY logo"
    >
      <defs>
        {/* Dark navy background gradient */}
        <linearGradient id="vp-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0d1b2e" />
          <stop offset="100%" stopColor="#0a1520" />
        </linearGradient>

        {/* Blue glow border */}
        <linearGradient id="vp-border" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4a90d9" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#2563eb" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#1e3a5f" stopOpacity="0.4" />
        </linearGradient>

        {/* Metallic silver gradient for VP */}
        <linearGradient id="vp-metal" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f0f4ff" />
          <stop offset="35%" stopColor="#c8d4e8" />
          <stop offset="55%" stopColor="#8a9ab8" />
          <stop offset="75%" stopColor="#d0daea" />
          <stop offset="100%" stopColor="#e8edf5" />
        </linearGradient>

        {/* Glow filter for the border */}
        <filter id="vp-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Clip to rounded square */}
        <clipPath id="vp-clip">
          <rect x="4" y="4" width="92" height="92" rx={r * 3.6} ry={r * 3.6} />
        </clipPath>
      </defs>

      {/* Outer glow ring */}
      <rect
        x="1.5"
        y="1.5"
        width="97"
        height="97"
        rx={r * 3.8}
        ry={r * 3.8}
        fill="none"
        stroke="url(#vp-border)"
        strokeWidth="2"
        filter="url(#vp-glow)"
        opacity="0.7"
      />

      {/* Background */}
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx={r * 3.6}
        ry={r * 3.6}
        fill="url(#vp-bg)"
      />

      {/* Inner border line */}
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx={r * 3.6}
        ry={r * 3.6}
        fill="none"
        stroke="url(#vp-border)"
        strokeWidth="1"
        opacity="0.5"
      />

      {/* VP lettermark — clipped to the rounded square */}
      <g clipPath="url(#vp-clip)" fill="url(#vp-metal)">
        {/*
          V — italic chevron, left half and right half meet at a point.
          Left stroke: top-left to bottom-center
          Right stroke: bottom-center to top-right, then folds into P stem
        */}
        {/* V left arm */}
        <polygon points="14,22 28,22 50,68 38,68" />
        {/* V right arm (merges into P stem) */}
        <polygon points="62,22 74,22 50,68 38,68" />

        {/*
          P — sits to the right, sharing its stem with the V's right arm.
          Stem is the right arm of V. Bowl is a rounded rectangle top-right.
        */}
        {/* P stem (the right arm of V is already drawn; add explicit stem for P) */}
        <rect x="61" y="22" width="13" height="46" rx="2" />
        {/* P bowl */}
        <path d="M74,22 Q92,22 92,38 Q92,54 74,54 L61,54 L61,22 Z" />
        {/* P bowl cutout (inner) */}
        <path
          d="M74,30 Q84,30 84,38 Q84,46 74,46 L69,46 L69,30 Z"
          fill="url(#vp-bg)"
        />
      </g>
    </svg>
  )
}
