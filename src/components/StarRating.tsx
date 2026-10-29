/**
 * StarRating — display and interactive star rating (1–5).
 * In display mode (readOnly): shows filled/half/empty stars.
 * In input mode: clickable stars with hover preview.
 */

import { useState } from 'react'
import { Star } from 'lucide-react'

interface StarRatingProps {
  value: number        // 0–5, decimals accepted for display
  max?: number         // default 5
  size?: number        // px
  readOnly?: boolean
  onChange?: (rating: 1 | 2 | 3 | 4 | 5) => void
  className?: string
}

export function StarRating({
  value,
  max = 5,
  size = 16,
  readOnly = true,
  onChange,
  className = '',
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const display = hovered ?? value

  return (
    <div
      className={`flex items-center gap-0.5 ${className}`}
      onMouseLeave={() => setHovered(null)}
    >
      {Array.from({ length: max }, (_, i) => {
        const starValue = i + 1
        const filled = display >= starValue
        const half = !filled && display >= starValue - 0.5

        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange?.(starValue as 1 | 2 | 3 | 4 | 5)}
            onMouseEnter={() => !readOnly && setHovered(starValue)}
            className={readOnly ? 'cursor-default' : 'cursor-pointer transition-transform hover:scale-110'}
            style={{ background: 'none', border: 'none', padding: 0, lineHeight: 0 }}
            aria-label={`${starValue} star${starValue !== 1 ? 's' : ''}`}
          >
            <Star
              size={size}
              strokeWidth={1.5}
              style={{
                fill: filled ? '#f59e0b' : half ? 'url(#half-star)' : 'transparent',
                color: filled || half ? '#f59e0b' : '#d1d5db',
                transition: 'color 0.1s, fill 0.1s',
              }}
            />
          </button>
        )
      })}
    </div>
  )
}

/** Inline star rating display with numeric value. */
export function RatingSummary({
  avg,
  count,
  size = 14,
}: {
  avg: number | null
  count: number
  size?: number
}) {
  if (avg === null || count === 0) {
    return (
      <span className="text-xs" style={{ color: 'var(--subtle)' }}>
        No reviews yet
      </span>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <StarRating value={avg} size={size} readOnly />
      <span
        className="text-sm font-600 tabular-nums"
        style={{ color: 'var(--ink)' }}
      >
        {avg.toFixed(1)}
      </span>
      <span className="text-xs" style={{ color: 'var(--subtle)' }}>
        ({count} review{count !== 1 ? 's' : ''})
      </span>
    </div>
  )
}
