/**
 * PostGigPage — Freelancers post a service gig here.
 * Only visible when role === 'freelancer'.
 */

import { useState } from 'react'
import { Briefcase, Plus, X, ChevronRight } from 'lucide-react'
import { useGigs } from '@/hooks/useGigs'
import { useAccount } from '@/hooks/useAccount'
import { PrivyLoginButton } from '@/components/PrivyLoginButton'
import type { GigCategory } from '@/types/gig'

const CATEGORIES: { id: GigCategory; label: string; emoji: string }[] = [
  { id: 'development', label: 'Development', emoji: '💻' },
  { id: 'design', label: 'Design', emoji: '🎨' },
  { id: 'writing', label: 'Writing', emoji: '✍️' },
  { id: 'marketing', label: 'Marketing', emoji: '📣' },
  { id: 'video', label: 'Video', emoji: '🎬' },
  { id: 'data', label: 'Data & Analytics', emoji: '📊' },
  { id: 'other', label: 'Other', emoji: '⚡' },
]

interface PostGigPageProps {
  onNavigate: (view: string) => void
  onGigPosted: () => void
}

export function PostGigPage({ onNavigate, onGigPosted }: PostGigPageProps) {
  const { address, isConnected } = useAccount()
  const { postGig } = useGigs()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<GigCategory>('development')
  const [deliverables, setDeliverables] = useState('')
  const [startingPrice, setStartingPrice] = useState('')
  const [turnaround, setTurnaround] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [portfolioInput, setPortfolioInput] = useState('')
  const [portfolioLinks, setPortfolioLinks] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <Briefcase size={32} className="mx-auto mb-4" style={{ color: 'var(--subtle)' }} />
        <h1 className="display font-700 text-2xl mb-2" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
          Post a Gig
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          Connect your wallet to post your service as a freelancer.
        </p>
        <PrivyLoginButton variant="light" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'var(--cta-soft)' }}
        >
          <Briefcase size={28} style={{ color: 'var(--cta)' }} />
        </div>
        <h1 className="display font-700 text-2xl mb-2" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
          Gig Posted!
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
          Creators can now browse and hire you for your services.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => { setSubmitted(false); setTitle(''); setDescription(''); setDeliverables(''); setStartingPrice(''); setTurnaround(''); setTags([]); setPortfolioLinks([]) }}
            className="px-5 py-2.5 rounded-xl text-sm font-600 border"
            style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
          >
            Post Another Gig
          </button>
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-600"
            style={{ background: 'var(--cta)', color: '#fff' }}
          >
            View My Work <ChevronRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t) && tags.length < 8) {
      setTags((prev) => [...prev, t])
      setTagInput('')
    }
  }

  function addPortfolioLink() {
    const url = portfolioInput.trim()
    if (url && portfolioLinks.length < 5) {
      setPortfolioLinks((prev) => [...prev, url])
      setPortfolioInput('')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!address || isSubmitting) return
    const price = parseFloat(startingPrice)
    if (!title.trim() || !description.trim() || !deliverables.trim() || isNaN(price) || price <= 0) return

    setIsSubmitting(true)
    try {
      postGig({
        title: title.trim(),
        description: description.trim(),
        category,
        deliverables: deliverables.trim(),
        startingPrice: price,
        turnaround: turnaround.trim() || 'Flexible',
        freelancerAddress: address,
        portfolioLinks,
        tags,
      })
      onGigPosted()
      setSubmitted(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValid = title.trim().length > 0
    && description.trim().length >= 20
    && deliverables.trim().length > 0
    && parseFloat(startingPrice) > 0

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <h1 className="display font-700 text-2xl mb-1" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
          Post a Gig
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Tell creators what you offer. They'll contact you and create a bounty to pay you in USDC.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-600 mb-2" style={{ color: 'var(--ink)' }}>
            Gig Title <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. I will build your React dApp frontend"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 100))}
            maxLength={100}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--cta)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
          <p className="text-xs mt-1 text-right" style={{ color: 'var(--subtle)' }}>{title.length}/100</p>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-600 mb-2" style={{ color: 'var(--ink)' }}>
            Category <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-500 transition-colors"
                style={{
                  background: category === cat.id ? 'var(--cta-soft)' : 'var(--surface)',
                  borderColor: category === cat.id ? 'var(--cta)' : 'var(--border)',
                  color: category === cat.id ? 'var(--cta)' : 'var(--muted)',
                }}
              >
                <span>{cat.emoji}</span>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-600 mb-2" style={{ color: 'var(--ink)' }}>
            Description <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <textarea
            placeholder="Describe your skills, experience, and what makes you the right person for the job..."
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 1500))}
            rows={5}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--cta)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
          <p className="text-xs mt-1 text-right" style={{ color: 'var(--subtle)' }}>{description.length}/1500</p>
        </div>

        {/* Deliverables */}
        <div>
          <label className="block text-sm font-600 mb-2" style={{ color: 'var(--ink)' }}>
            What You Deliver <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <textarea
            placeholder="e.g. Fully responsive React app, source code on GitHub, 2 rounds of revisions..."
            value={deliverables}
            onChange={(e) => setDeliverables(e.target.value.slice(0, 500))}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--cta)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Price + Turnaround */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-600 mb-2" style={{ color: 'var(--ink)' }}>
              Starting Price (USDC) <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <div className="relative">
              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-600"
                style={{ color: 'var(--subtle)' }}
              >
                $
              </span>
              <input
                type="number"
                placeholder="50"
                min="1"
                step="1"
                value={startingPrice}
                onChange={(e) => setStartingPrice(e.target.value)}
                className="w-full pl-8 pr-4 py-3 rounded-xl border text-sm outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--cta)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-600 mb-2" style={{ color: 'var(--ink)' }}>
              Turnaround
            </label>
            <input
              type="text"
              placeholder="e.g. 3 days, 1 week"
              value={turnaround}
              onChange={(e) => setTurnaround(e.target.value.slice(0, 50))}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--cta)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-600 mb-2" style={{ color: 'var(--ink)' }}>
            Skills / Tags
          </label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {tags.map((t) => (
              <span
                key={t}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-500"
                style={{ background: 'var(--cta-soft)', color: 'var(--cta)' }}
              >
                {t}
                <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== t))}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. react, solidity, figma"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
              className="flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
            <button
              type="button"
              onClick={addTag}
              disabled={!tagInput.trim() || tags.length >= 8}
              className="px-3 py-2.5 rounded-xl text-sm font-600"
              style={{ background: 'var(--cta-soft)', color: 'var(--cta)' }}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Portfolio links */}
        <div>
          <label className="block text-sm font-600 mb-2" style={{ color: 'var(--ink)' }}>
            Portfolio / Work Samples (optional)
          </label>
          <div className="space-y-2 mb-2">
            {portfolioLinks.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-xs truncate" style={{ color: 'var(--muted)' }}>{url}</span>
                <button type="button" onClick={() => setPortfolioLinks((prev) => prev.filter((_, j) => j !== i))}>
                  <X size={12} style={{ color: 'var(--subtle)' }} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://github.com/you/project"
              value={portfolioInput}
              onChange={(e) => setPortfolioInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPortfolioLink() } }}
              className="flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
            <button
              type="button"
              onClick={addPortfolioLink}
              disabled={!portfolioInput.trim() || portfolioLinks.length >= 5}
              className="px-3 py-2.5 rounded-xl text-sm font-600"
              style={{ background: 'var(--cta-soft)', color: 'var(--cta)' }}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="w-full py-3.5 rounded-xl text-sm font-700 transition-opacity"
          style={{
            background: isValid ? 'var(--cta)' : 'var(--border)',
            color: isValid ? '#fff' : 'var(--subtle)',
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? 'Posting…' : 'Post Gig'}
        </button>
      </form>
    </div>
  )
}
