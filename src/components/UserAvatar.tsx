/**
 * UserAvatar — deterministic avatar for any wallet address.
 * Uses a hashed colour pair from the address so the same wallet
 * always gets the same colour, with no external image dependency.
 * When a profile provides a custom avatar URL (base64 data: or https:),
 * that image is shown instead.
 */

interface UserAvatarProps {
  address: string
  avatarUrl?: string
  displayName?: string
  size?: number
  className?: string
}

/** Derive a stable pastel background + contrasting ink from any string. */
function addressToColors(address: string): { bg: string; fg: string } {
  let hash = 0
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0
  }
  const hue = hash % 360
  return {
    bg: `hsl(${hue}, 55%, 88%)`,
    fg: `hsl(${hue}, 45%, 22%)`,
  }
}

function initials(address: string, displayName?: string): string {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  // Use hex chars from address as fallback initials
  return address.slice(2, 4).toUpperCase()
}

export function UserAvatar({
  address,
  avatarUrl,
  displayName,
  size = 36,
  className = '',
}: UserAvatarProps) {
  const { bg, fg } = addressToColors(address)
  const label = initials(address, displayName)
  const fontSize = Math.max(10, Math.round(size * 0.38))

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName ?? address}
        width={size}
        height={size}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
        onError={(e) => {
          // Fall back to initials on load error
          const target = e.currentTarget
          target.style.display = 'none'
          const parent = target.parentElement
          if (parent) {
            parent.style.background = bg
            parent.style.color = fg
          }
        }}
      />
    )
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 font-700 select-none ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize,
        fontFamily: "'Space Grotesk', sans-serif",
        letterSpacing: '-0.01em',
      }}
      aria-label={displayName ?? address}
    >
      {label}
    </div>
  )
}
