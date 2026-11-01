/**
 * GigsMarketplace — Creators browse freelancer gig offerings.
 * Shown when role === 'creator'.
 */

import { useState, useMemo } from 'react'
import { Search, Briefcase, Star, Clock, ExternalLink, Tag, Share2, Check } from 'lucide-react'
import { useServerGigs } from '@/hooks/useServerGigs'
import { useProfiles } from '@/hooks/useProfiles'
import { formatAddress } from '@/lib/utils'
import type { Gig, GigCategory } from '@/types/gig'

const CATEGORIES: { id: GigCategory | 'all'; label: string; emoji: string }[] = [
  { id: 'all', label: 'All', emoji: '✨' },
  { id: 'development', label: 'Dev', emoji: '💻' },
  { id: 'design', label: 'Design', emoji: '🎨' },
  { id: 'writing', label: 'Writing', emoji: '✍️' },
  { id: 'marketing', label: 'Marketing', emoji: '📣' },
  { id: 'video', label: 'Video', emoji: '🎬' },
  { id: 'data', label: 'Data', emoji: '📊' },
  { id: 'other', label: 'Other', emoji: '⚡' },
]

interface GigCardProps {
  gig: Gig
  myAddress?: string
  onNavigate: (view: string) => void
  onOrderDirectly?: (gig: Gig) => void
}

function GigCard({ gig, myAddress, onNavigate, onOrderDirectly }: GigCardProps) {
  const { getProfile } = useProfiles()
  const profile = getProfile(gig.freelancerAddress)
  const displayName = profile?.displayName || formatAddress(gig.freelancerAddress)
  const catEmoji = CATEGORIES.find((c) => c.id === gig.category)?.emoji ?? '⚡'
  const [copied, setCopied] = useState(false)

  function handleShare() {
    const base = window.location.origin + window.location.pathname
    const url = `${base}?gig=${gig.id}`
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-3 hover:shadow-md transition-shadow cursor-default"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Category + price */}
      <div className="flex items-center justify-between">
        <span
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-600"
          style={{ background: 'var(--cta-soft)', color: 'var(--cta)' }}
        >
          {catEmoji} {CATEGORIES.find((c) => c.id === gig.category)?.label ?? gig.category}
        </span>
        <span className="text-sm font-700" style={{ color: 'var(--ink)' }}>
          from ${gig.startingPrice} <span className="text-xs font-500" style={{ color: 'var(--subtle)' }}>USDC</span>
        </span>
      </div>

      {/* Title */}
      <h3 className="font-700 text-sm leading-snug" style={{ color: 'var(--ink)' }}>
        {gig.title}
      </h3>

      {/* Description */}
      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--muted)' }}>
        {gig.description}
      </p>

      {/* Tags */}
      {gig.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {gig.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
              style={{ background: 'var(--surface-muted)', color: 'var(--subtle)' }}
            >
              <Tag size={9} />
              {t}
            </span>
          ))}
          {gig.tags.length > 4 && (
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>+{gig.tags.length - 4}</span>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="border-t" style={{ borderColor: 'var(--border)' }} />

      {/* Footer: freelancer + turnaround */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate(`profile:${gig.freelancerAddress}`)}
          className="flex items-center gap-2 group"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 shrink-0"
            style={{ background: 'var(--cta)', color: '#fff' }}
          >
            {gig.freelancerAddress.slice(2, 3).toUpperCase()}
          </div>
          <span
            className="text-xs font-500 group-hover:underline"
            style={{ color: 'var(--muted)' }}
          >
            {displayName}
          </span>
        </button>
        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--subtle)' }}>
          <Clock size={11} />
          {gig.turnaround}
        </div>
      </div>

      {/* Portfolio links */}
      {gig.portfolioLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {gig.portfolioLinks.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs underline"
              style={{ color: 'var(--cta)' }}
            >
              <ExternalLink size={10} /> Sample {i + 1}
            </a>
          ))}
        </div>
      )}

      {/* Hire button: navigates to Post Job pre-filled */}
      <div className="flex gap-2">
        {/* Primary: Order Directly — shown when viewer is a creator (not the freelancer) */}
        {onOrderDirectly && myAddress?.toLowerCase() !== gig.freelancerAddress.toLowerCase() ? (
          <button
            onClick={() => onOrderDirectly(gig)}
            className="flex-1 py-2.5 rounded-xl text-sm font-600 transition-colors"
            style={{ background: 'var(--cta)', color: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cta-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--cta)')}
          >
            Order Directly
          </button>
        ) : (
          <button
            onClick={() => onNavigate('create')}
            className="flex-1 py-2.5 rounded-xl text-sm font-600 transition-colors"
            style={{ background: 'var(--cta)', color: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cta-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--cta)')}
          >
            Post a Job to Hire
          </button>
        )}
        <button
          onClick={handleShare}
          title="Copy share link"
          className="flex items-center justify-center w-10 h-10 rounded-xl border shrink-0 transition-colors"
          style={{
            background: copied ? 'var(--success-bg)' : 'var(--surface-muted)',
            borderColor: copied ? 'rgba(26,122,69,0.3)' : 'var(--border)',
            color: copied ? 'var(--success)' : 'var(--subtle)',
          }}
        >
          {copied ? <Check size={14} /> : <Share2 size={14} />}
        </button>
      </div>
    </div>
  )
}

interface GigsMarketplaceProps {
  onNavigate: (view: string) => void
  myAddress?: string
  onOrderGig?: (gig: Gig) => void
}

export function GigsMarketplace({ onNavigate, myAddress, onOrderGig }: GigsMarketplaceProps) {
  const { gigs } = useServerGigs()
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<GigCategory | 'all'>('all')

  const filtered = useMemo(() => {
    return gigs.filter((g) => {
      const matchCat = categoryFilter === 'all' || g.category === categoryFilter
      const q = query.toLowerCase()
      const matchQ = !q
        || g.title.toLowerCase().includes(q)
        || g.description.toLowerCase().includes(q)
        || g.tags.some((t) => t.includes(q))
      return matchCat && matchQ
    })
  }, [gigs, query, categoryFilter])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="display font-700 text-2xl mb-1" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
          Browse Freelancers
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Find skilled freelancers, post a job to hire them, and pay in USDC via escrow.
        </p>
      </div>

      {/* Search + category filter */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--subtle)' }} />
          <input
            type="text"
            placeholder="Search gigs, skills, or keywords…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--cta)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Category chips */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-600 border transition-colors"
              style={{
                background: categoryFilter === cat.id ? 'var(--cta)' : 'var(--surface)',
                borderColor: categoryFilter === cat.id ? 'var(--cta)' : 'var(--border)',
                color: categoryFilter === cat.id ? '#fff' : 'var(--muted)',
              }}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {gigs.length > 0 && (
        <p className="text-sm mb-4 font-500" style={{ color: 'var(--ink)' }}>
          {filtered.length} gig{filtered.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Empty state */}
      {gigs.length === 0 && (
        <div className="text-center py-20">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'var(--cta-soft)' }}
          >
            <Briefcase size={28} style={{ color: 'var(--cta)' }} />
          </div>
          <h2 className="display font-700 text-xl mb-2" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            No freelancers yet
          </h2>
          <p className="text-sm max-w-sm mx-auto mb-6" style={{ color: 'var(--muted)' }}>
            Freelancers haven't posted any gigs yet. Check back soon — or post a job and let talent come to you.
          </p>
          <button
            onClick={() => onNavigate('create')}
            className="px-5 py-2.5 rounded-xl text-sm font-600"
            style={{ background: 'var(--cta)', color: '#fff' }}
          >
            Post a Job
          </button>
        </div>
      )}

      {/* No results after filter */}
      {gigs.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16">
          <Star size={28} className="mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
          <p className="font-600 mb-1" style={{ color: 'var(--ink)' }}>No gigs match your search</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Try a different keyword or category.</p>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((gig) => (
            <GigCard key={gig.id} gig={gig} myAddress={myAddress} onNavigate={onNavigate} onOrderDirectly={onOrderGig} />
          ))}
        </div>
      )}
    </div>
  )
}
