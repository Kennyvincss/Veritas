/**
 * LandingPage — full marketing landing page for VERIPAY.
 * All statistics are derived from live data passed via props.
 * No fabricated numbers, user counts, or partnership claims.
 */

import { useState } from 'react'
import {
  Shield, Lock, CheckCircle, Zap, ArrowRight, ChevronDown, ChevronUp,
  Trophy, Users, DollarSign, Clock, Star, ExternalLink, Search, Plus,
  FileCheck, Bot, BadgeCheck, Scale, AlertCircle, Hash, ShieldCheck,
  CheckCircle2, XCircle, Eye,
} from 'lucide-react'
import { VeriPayLogo } from './VeriPayLogo'

import { TokenUSDC } from '@web3icons/react'
import { UserAvatar } from './UserAvatar'
import { RatingSummary } from './StarRating'
import { BountyStatusBadge } from './StatusBadge'
import { useProfiles } from '@/hooks/useProfiles'
import { useReviews } from '@/hooks/useReviews'
import { formatAddress, formatUsdcAmount, timeRemaining } from '@/lib/utils'
import type { Bounty, Submission } from '@/types/bounty'
import type { PlatformStats } from '@/hooks/usePlatformStats'

interface LandingPageProps {
  onNavigate: (view: string, address?: string) => void
  onSelectBounty: (id: string) => void
  bounties: Bounty[]
  submissions: Submission[]
  stats: PlatformStats
  isLoading: boolean
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero({ onNavigate }: { onNavigate: (view: string) => void }) {
  return (
    <section className="relative flex flex-col items-center text-center px-4 pt-20 pb-16 md:pt-28 md:pb-24 overflow-hidden">
      {/* Subtle radial background */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background: 'radial-gradient(ellipse 90% 55% at 50% -5%, rgba(26,46,74,0.08) 0%, transparent 65%)',
        }}
      />

      {/* Tagline badge */}
      <div
        className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-600 border mb-8"
        style={{
          color: 'var(--accent)',
          borderColor: 'rgba(26,46,74,0.18)',
          background: 'var(--accent-soft)',
          letterSpacing: '0.06em',
        }}
      >
        <FileCheck size={11} />
        EVERY TASK LEAVES PROOF · EVERY PAYMENT BUILDS TRUST
      </div>

      <h1
        className="relative display font-700 text-4xl sm:text-5xl md:text-[3.5rem] mb-6 max-w-3xl"
        style={{ color: 'var(--ink)', letterSpacing: '-0.04em', textWrap: 'balance', lineHeight: 1.08 }}
      >
        Your Work{' '}
        <span style={{ color: 'var(--accent-hover)' }}>Deserves Proof.</span>
      </h1>

      <p
        className="relative text-base sm:text-lg mb-10 max-w-2xl"
        style={{ color: 'var(--muted)', textWrap: 'pretty', lineHeight: 1.7 }}
      >
        VERIPAY helps teams manage bounties, evaluate submissions, and build verifiable
        work histories. Every completed task can become evidence of what you achieved —
        backed by a smart contract on Arc.
      </p>

      <div className="relative flex flex-col sm:flex-row gap-3 items-center">
        <button
          onClick={() => onNavigate('marketplace')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-600 transition-colors min-h-[48px]"
          style={{ background: 'var(--accent)', color: '#ffffff' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
        >
          <Search size={15} /> Explore Bounties
          <ArrowRight size={15} />
        </button>

        <button
          onClick={() => onNavigate('howitworks')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-600 border transition-colors min-h-[48px]"
          style={{ color: 'var(--ink)', borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-muted)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
        >
          How VERIPAY Works
        </button>
      </div>

      {/* Proof flow visual */}
      <div className="relative mt-12 flex flex-wrap items-center justify-center gap-2 sm:gap-0">
        {[
          { label: 'Bounty Created', icon: Plus, color: 'var(--accent)' },
          { label: 'Work Submitted', icon: ArrowRight, color: 'var(--muted)' },
          { label: 'AI Evaluated', icon: Bot, color: '#7c3aed' },
          { label: 'Payment Released', icon: CheckCircle, color: 'var(--success)' },
          { label: 'Receipt Issued', icon: FileCheck, color: '#0369a1' },
        ].map(({ label, icon: Icon, color }, i, arr) => (
          <div key={label} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
              >
                <Icon size={15} color={color} />
              </div>
              <span className="text-xs font-500 whitespace-nowrap" style={{ color: 'var(--subtle)' }}>{label}</span>
            </div>
            {i < arr.length - 1 && (
              <ArrowRight size={14} className="mb-4 mx-1 sm:mx-2 flex-shrink-0" style={{ color: 'var(--border-strong)' }} />
            )}
          </div>
        ))}
      </div>

      <p
        className="relative mt-8 text-xs px-4 py-2 rounded-lg border"
        style={{ color: 'var(--subtle)', borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        Arc Testnet — test USDC only · No real funds at risk
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function StatBar({ stats, isLoading }: { stats: PlatformStats; isLoading: boolean }) {
  const items = [
    { label: 'Bounties Posted', value: stats.totalBounties, icon: <Trophy size={16} /> },
    { label: 'Active Now', value: stats.activeBounties, icon: <Zap size={16} /> },
    { label: 'Completed', value: stats.completedBounties, icon: <CheckCircle size={16} /> },
    { label: 'Total Funded', value: stats.totalFundedUsdc, icon: <DollarSign size={16} /> },
    { label: 'Paid Out', value: stats.totalPaidUsdc, icon: <TokenUSDC variant="branded" size={16} /> },
    { label: 'Unique Creators', value: stats.uniqueCreators, icon: <Users size={16} /> },
  ]

  return (
    <div
      className="border-y px-4 py-8"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
        {items.map(({ label, value, icon }) => (
          <div key={label} className="text-center">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-xl mx-auto mb-2"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              {icon}
            </div>
            {isLoading ? (
              <div className="h-7 w-12 rounded-lg mx-auto animate-pulse" style={{ background: 'var(--surface-muted)' }} />
            ) : (
              <p
                className="display font-700 text-xl tabular-nums"
                style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
              >
                {typeof value === 'number' ? value.toLocaleString() : value}
              </p>
            )}
            <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Problem / Solution
// ---------------------------------------------------------------------------

const PROBLEMS = [
  {
    icon: Eye,
    problem: 'Hard to verify online work',
    solution: 'Receipts link completed tasks to onchain payments and submission evidence.',
  },
  {
    icon: Users,
    problem: 'Difficult to prove your track record',
    solution: 'Earn a portable profile with verified completed bounties and peer reviews.',
  },
  {
    icon: AlertCircle,
    problem: 'Opaque bounty reviews',
    solution: 'AI evaluation compares submissions against acceptance criteria — transparent, traceable.',
  },
  {
    icon: Scale,
    problem: 'Disputes damage trust',
    solution: 'A structured dispute process lets both sides present evidence before a human decision.',
  },
]

function ProblemSolution({ onNavigate }: { onNavigate: (view: string) => void }) {
  return (
    <section className="border-t px-4 py-16" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p
            className="text-xs font-700 tracking-widest mb-3"
            style={{ color: 'var(--accent)', letterSpacing: '0.12em' }}
          >
            THE PROBLEM
          </p>
          <h2
            className="display font-700 text-2xl mb-4"
            style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
          >
            Work happens. Proof doesn't.
          </h2>
          <p className="text-sm max-w-xl mx-auto" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
            Online work is difficult to verify. Contributors struggle to prove their history.
            Bounty reviews lack transparency. Disagreements erode trust between creators and contributors.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {PROBLEMS.map(({ icon: Icon, problem, solution }) => (
            <div
              key={problem}
              className="rounded-2xl p-5 border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
                >
                  <Icon size={17} />
                </div>
                <div>
                  <p className="font-600 text-sm mb-1.5" style={{ color: 'var(--ink)' }}>{problem}</p>
                  <div className="flex items-start gap-1.5">
                    <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
                    <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{solution}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => onNavigate('marketplace')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-600 border transition-colors"
            style={{ color: 'var(--accent)', borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-muted)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
          >
            See how it works in practice <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Featured bounties
// ---------------------------------------------------------------------------

function FeaturedBounties({
  bounties,
  submissions,
  isLoading,
  onNavigate,
  onSelectBounty,
}: {
  bounties: Bounty[]
  submissions: Submission[]
  isLoading: boolean
  onNavigate: (view: string) => void
  onSelectBounty: (id: string) => void
}) {
  const { getProfile } = useProfiles()
  const reviewsApi = useReviews()

  // Show up to 6 open bounties, sorted by reward
  const featured = bounties
    .filter((b) => b.status === 'open')
    .sort((a, b) => Number(b.rewardRaw - a.rewardRaw))
    .slice(0, 6)

  return (
    <section className="px-4 py-16 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h2
            className="display font-700 text-2xl"
            style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
          >
            Open Bounties
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Funded and ready to work on — rewards locked in escrow
          </p>
        </div>
        <button
          onClick={() => onNavigate('marketplace')}
          className="flex items-center gap-1.5 text-sm font-600 transition-colors"
          style={{ color: 'var(--accent)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent)')}
        >
          View all <ArrowRight size={14} />
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl p-5 border animate-pulse"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', height: 180 }}
            />
          ))}
        </div>
      ) : featured.length === 0 ? (
        <div
          className="rounded-2xl p-12 border text-center"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <Trophy size={32} className="mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
          <p className="font-600 mb-2" style={{ color: 'var(--ink)' }}>No open bounties yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Be the first to post a funded bounty.</p>
          <button
            onClick={() => onNavigate('create')}
            className="px-4 py-2.5 rounded-xl text-sm font-600"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Post a Bounty
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featured.map((bounty) => {
            const ownerProfile = getProfile(bounty.owner)
            const avgRating = reviewsApi.avgRating(bounty.owner)
            const subCount = submissions.filter((s) => s.bountyId === bounty.id).length
            const remaining = timeRemaining(bounty.deadline)
            const isExpired = remaining === 'Expired'

            return (
              <button
                key={bounty.id}
                onClick={() => onSelectBounty(bounty.id)}
                className="w-full text-left rounded-2xl p-5 border transition-all group"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  boxShadow: 'var(--shadow-card)',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget).style.borderColor = 'var(--border-strong)'
                  ;(e.currentTarget).style.boxShadow = '0 4px 24px rgba(26,46,74,0.12)'
                  ;(e.currentTarget).style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget).style.borderColor = 'var(--border)'
                  ;(e.currentTarget).style.boxShadow = 'var(--shadow-card)'
                  ;(e.currentTarget).style.transform = 'translateY(0)'
                }}
              >
                {/* Creator row */}
                <div className="flex items-center gap-2 mb-3">
                  <UserAvatar
                    address={bounty.owner}
                    avatarUrl={ownerProfile?.avatarUrl}
                    displayName={ownerProfile?.displayName}
                    size={24}
                  />
                  <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                    {ownerProfile?.displayName ?? formatAddress(bounty.owner)}
                  </span>
                  {avgRating !== null && (
                    <div className="flex items-center gap-0.5 ml-auto">
                      <Star size={11} fill="#f59e0b" color="#f59e0b" />
                      <span className="text-xs font-600" style={{ color: 'var(--muted)' }}>
                        {avgRating.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>

                <h3
                  className="display font-600 text-base mb-1 line-clamp-2"
                  style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
                >
                  {bounty.title}
                </h3>
                <p
                  className="text-xs leading-relaxed line-clamp-2 mb-3"
                  style={{ color: 'var(--muted)' }}
                >
                  {bounty.description}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <TokenUSDC variant="branded" size={16} />
                    <span className="display font-700 text-base tabular-nums" style={{ color: 'var(--ink)' }}>
                      {formatUsdcAmount(bounty.rewardRaw, 5042002)}
                    </span>
                  </div>
                  <BountyStatusBadge status={bounty.status} />
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-xs flex items-center gap-1" style={{ color: isExpired ? 'var(--danger)' : 'var(--subtle)' }}>
                    <Clock size={11} /> {remaining}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                    {subCount} submission{subCount !== 1 ? 's' : ''}
                  </span>
                  <span
                    className="text-xs font-600 flex items-center gap-1 transition-transform group-hover:translate-x-0.5"
                    style={{ color: 'var(--accent)' }}
                  >
                    View <ArrowRight size={11} />
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Product preview (demo-labelled)
// ---------------------------------------------------------------------------

/** Static demo receipt card — clearly labelled as illustrative content. */
function DemoReceiptCard() {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)', maxWidth: 420 }}
    >
      {/* Demo banner */}
      <div
        className="px-4 py-2 text-xs font-600 text-center"
        style={{ background: 'rgba(180,83,9,0.08)', color: '#b45309', borderBottom: '1px solid rgba(180,83,9,0.15)' }}
      >
        Demo content — illustrative only, not real platform activity
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(3,105,161,0.09)' }}>
            <FileCheck size={16} color="#0369a1" />
          </div>
          <div>
            <p className="font-700 text-sm" style={{ color: 'var(--ink)' }}>Work Receipt</p>
            <p className="text-xs mono" style={{ color: 'var(--subtle)' }}>rcpt-demo-0001</p>
          </div>
          <div
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-600"
            style={{ background: 'var(--success-bg)', color: 'var(--success)' }}
          >
            <CheckCircle2 size={11} /> Verified
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span style={{ color: 'var(--subtle)' }}>Bounty</span>
            <span className="font-500" style={{ color: 'var(--ink)' }}>Build a React dashboard</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--subtle)' }}>Contributor</span>
            <span className="mono text-xs" style={{ color: 'var(--muted)' }}>0xaBcD…1234</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--subtle)' }}>Reward</span>
            <span className="font-700" style={{ color: 'var(--ink)' }}>500 USDC</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--subtle)' }}>Completed</span>
            <span style={{ color: 'var(--muted)' }}>Oct 15, 2026</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={13} style={{ color: 'var(--success)' }} />
            <span className="text-xs font-500" style={{ color: 'var(--success)' }}>Receipt integrity verified</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
            <span className="text-xs font-500" style={{ color: 'var(--success)' }}>Onchain payment verified</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Static demo AI evaluation result — clearly labelled. */
function DemoEvaluationCard() {
  const criteria = [
    { text: 'Working React components', status: 'satisfied' as const },
    { text: 'Unit test coverage > 80%', status: 'satisfied' as const },
    { text: 'Live deployment link', status: 'unclear' as const },
    { text: 'README with setup instructions', status: 'not_satisfied' as const },
  ]
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)', maxWidth: 420 }}
    >
      <div
        className="px-4 py-2 text-xs font-600 text-center"
        style={{ background: 'rgba(180,83,9,0.08)', color: '#b45309', borderBottom: '1px solid rgba(180,83,9,0.15)' }}
      >
        Demo content — illustrative only
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.09)' }}>
            <Bot size={16} color="#7c3aed" />
          </div>
          <div className="flex-1">
            <p className="font-700 text-sm" style={{ color: 'var(--ink)' }}>AI Evaluation</p>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>Advisory · Human review required</p>
          </div>
          <span
            className="text-xs font-600 px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}
          >
            Request Revisions
          </span>
        </div>

        <div className="space-y-2">
          {criteria.map((c) => {
            const cfg = c.status === 'satisfied'
              ? { Icon: CheckCircle2, color: 'var(--success)', bg: 'var(--success-bg)', label: 'Satisfied' }
              : c.status === 'not_satisfied'
              ? { Icon: XCircle, color: 'var(--danger)', bg: 'var(--danger-bg)', label: 'Not satisfied' }
              : { Icon: AlertCircle, color: '#f59e0b', bg: '#fefce8', label: 'Unclear' }
            return (
              <div
                key={c.text}
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: cfg.bg }}
              >
                <cfg.Icon size={13} color={cfg.color} className="flex-shrink-0" />
                <span className="text-xs flex-1" style={{ color: 'var(--ink)' }}>{c.text}</span>
                <span className="text-xs font-600" style={{ color: cfg.color }}>{cfg.label}</span>
              </div>
            )
          })}
        </div>

        <p className="text-xs mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)', color: 'var(--subtle)' }}>
          AI recommendations are advisory only — the creator makes the final decision.
        </p>
      </div>
    </div>
  )
}

function ProductPreview({ onNavigate }: { onNavigate: (view: string) => void }) {
  return (
    <section className="border-t px-4 py-16" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p
            className="text-xs font-700 tracking-widest mb-3"
            style={{ color: 'var(--accent)', letterSpacing: '0.12em' }}
          >
            IN PRACTICE
          </p>
          <h2
            className="display font-700 text-2xl mb-4"
            style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
          >
            From submission to proof of work
          </h2>
          <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
            Below are example cards showing what a completed verification and AI evaluation look like.
            These are illustrative — real data appears once bounties are active.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start justify-center">
          <DemoReceiptCard />
          <DemoEvaluationCard />
        </div>

        <div className="text-center mt-10 flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => onNavigate('marketplace')}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-600"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
          >
            <Search size={14} /> Explore Real Bounties
          </button>
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-600 border"
            style={{ color: 'var(--accent)', borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-muted)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
          >
            <FileCheck size={14} /> View Your Receipts
          </button>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// How It Works (4-step)
// ---------------------------------------------------------------------------

const HOW_IT_WORKS_STEPS = [
  {
    num: '01',
    role: 'Creator',
    action: 'Create a bounty',
    detail: 'Define the task, set the USDC reward, write clear acceptance criteria, and fund the escrow. The reward is locked before any work begins.',
    icon: Plus,
    cta: 'create',
    ctaLabel: 'Post a bounty',
  },
  {
    num: '02',
    role: 'Contributor',
    action: 'Submit your work',
    detail: 'Complete the task and submit your work with a description and deliverable links. Any wallet can contribute to open bounties.',
    icon: ExternalLink,
    cta: 'marketplace',
    ctaLabel: 'Browse open bounties',
  },
  {
    num: '03',
    role: 'Creator',
    action: 'Review and resolve',
    detail: 'Review submissions with optional AI assistance. Request revisions, ask questions, or approve. Disagreements can follow the documented dispute process.',
    icon: Search,
    cta: null,
    ctaLabel: null,
  },
  {
    num: '04',
    role: 'Both',
    action: 'Build your proof of work',
    detail: 'On approval and payment, a tamper-detectable receipt is issued linking the submission, payment transaction, and acceptance criteria. Visible to anyone.',
    icon: FileCheck,
    cta: 'dashboard',
    ctaLabel: 'View receipts',
  },
]

function HowItWorks({ onNavigate }: { onNavigate: (view: string) => void }) {
  return (
    <section
      id="how-it-works"
      className="border-t px-4 py-16"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p
            className="text-xs font-700 tracking-widest mb-3"
            style={{ color: 'var(--accent)', letterSpacing: '0.12em' }}
          >
            HOW IT WORKS
          </p>
          <h2
            className="display font-700 text-2xl mb-3"
            style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
          >
            Four steps from task to proof
          </h2>
          <p className="text-sm max-w-xl mx-auto" style={{ color: 'var(--muted)' }}>
            A trustless bounty lifecycle backed by the VeritasEscrow smart contract on Arc.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <div
              key={step.num}
              className="rounded-2xl p-6 border"
              style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  <step.icon size={18} strokeWidth={2} />
                </div>
                <span
                  className="mono text-xs font-700"
                  style={{ color: 'var(--accent)', letterSpacing: '0.1em' }}
                >
                  STEP {step.num}
                </span>
                <span
                  className="text-xs font-600 px-2 py-0.5 rounded-full ml-auto"
                  style={{ background: i < 2 ? 'var(--accent-soft)' : 'var(--success-bg)', color: i < 2 ? 'var(--accent)' : 'var(--success)' }}
                >
                  {step.role}
                </span>
              </div>

              <h3
                className="display font-600 text-base mb-2"
                style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
              >
                {step.action}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                {step.detail}
              </p>

              {step.cta && step.ctaLabel && (
                <button
                  onClick={() => onNavigate(step.cta)}
                  className="mt-4 flex items-center gap-1.5 text-sm font-600 transition-colors"
                  style={{ color: 'var(--accent)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                >
                  {step.ctaLabel} <ArrowRight size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Why VERIPAY
// ---------------------------------------------------------------------------

const WHY_FEATURES = [
  {
    icon: Lock,
    title: 'Funded before work starts',
    description:
      'USDC is deposited into a smart contract escrow before any work can be submitted. Contributors know the reward is real.',
  },
  {
    icon: Shield,
    title: 'Contract-enforced payments',
    description:
      'Only the bounty creator can approve work. Only the approved contributor receives payment. The contract enforces both rules.',
  },
  {
    icon: CheckCircle,
    title: 'Transparent on-chain state',
    description:
      'Every funding and payment transaction is verifiable on the Arc block explorer. No hidden fees, no custodial intermediaries.',
  },
  {
    icon: Star,
    title: 'Contributor reputation',
    description:
      'Completed bounty interactions generate verified reviews. Reputation is earned through actual work, not self-reported.',
  },
  {
    icon: Zap,
    title: 'Instant USDC settlement',
    description:
      'Arc\'s sub-second finality means approved contributors receive USDC in seconds, not days. Gas is paid in USDC.',
  },
  {
    icon: Users,
    title: 'No account required',
    description:
      'Connect any EVM wallet. No sign-up, no KYC, no email. Your wallet address is your identity.',
  },
]

function WhyVeritas() {
  return (
    <section className="border-t px-4 py-16" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="display font-700 text-2xl mb-3"
            style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
          >
            Why VERIPAY?
          </h2>
          <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--muted)' }}>
            Built on actual smart contract capabilities — no marketing claims that the code can't back up.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {WHY_FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl p-5 border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                <f.icon size={18} strokeWidth={2} />
              </div>
              <h3
                className="display font-600 text-base mb-2"
                style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
              >
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Trust & Verification
// ---------------------------------------------------------------------------

const TRUST_ROWS = [
  {
    icon: Hash,
    color: '#0369a1',
    bg: 'rgba(3,105,161,0.09)',
    title: 'Receipt integrity check',
    what: 'Detects whether a receipt\'s data has been changed since it was created.',
    how: 'SHA-256 hash computed over immutable fields at creation, recomputed and compared on every load.',
    limitation: 'Hash integrity confirms the data in your browser hasn\'t changed. It does not independently prove the payment happened onchain.',
  },
  {
    icon: ShieldCheck,
    color: 'var(--success)',
    bg: 'var(--success-bg)',
    title: 'Onchain payment verification',
    what: 'Confirms the payment transaction exists, succeeded, and matches the receipt.',
    how: 'Fetches the transaction receipt from the Arc RPC, decodes the PaymentReleased event, checks recipient, amount, and contract address.',
    limitation: 'Verification requires the RPC to be reachable. Inconclusive if the RPC is unavailable — this is never shown as "failed".',
  },
  {
    icon: Bot,
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.09)',
    title: 'AI evaluation result',
    what: 'Compares submission content against bounty acceptance criteria, criterion by criterion.',
    how: 'AI model reviews the criteria snapshot and submission text. Schema-validated before storage.',
    limitation: 'Advisory only. Cannot verify links, binary files, or deployed services. The creator must make the final decision — AI cannot approve payments or issue receipts.',
  },
  {
    icon: Users,
    color: 'var(--accent)',
    bg: 'var(--accent-soft)',
    title: 'Human review decision',
    what: 'The bounty creator\'s own decision after reviewing the submission and AI results.',
    how: 'Stored separately from AI recommendations. Creator records it explicitly — it is never auto-populated.',
    limitation: 'A human review decision is a creator\'s personal note. It does not automatically trigger any onchain action. The creator must use the approval flow separately.',
  },
]

function TrustVerification() {
  return (
    <section className="border-t px-4 py-16" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p
            className="text-xs font-700 tracking-widest mb-3"
            style={{ color: 'var(--accent)', letterSpacing: '0.12em' }}
          >
            WHAT IS VERIFIED
          </p>
          <h2
            className="display font-700 text-2xl mb-4"
            style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
          >
            Four layers. Each independent.
          </h2>
          <p className="text-sm max-w-xl mx-auto" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
            VERIPAY shows you exactly what was verified and how — and is honest about what it can't confirm.
            Only display "Verified" when the underlying checks actually pass.
          </p>
        </div>

        <div className="space-y-3">
          {TRUST_ROWS.map((row) => (
            <div
              key={row.title}
              className="rounded-2xl p-5 border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: row.bg, color: row.color }}
                >
                  <row.icon size={18} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-700 text-sm mb-1" style={{ color: 'var(--ink)' }}>{row.title}</p>
                  <p className="text-sm mb-2" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                    <span className="font-600" style={{ color: 'var(--ink-2)' }}>What: </span>{row.what}
                  </p>
                  <p className="text-sm mb-2" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                    <span className="font-600" style={{ color: 'var(--ink-2)' }}>How: </span>{row.how}
                  </p>
                  <div
                    className="flex items-start gap-1.5 rounded-lg px-3 py-2"
                    style={{ background: 'var(--warning-bg)' }}
                  >
                    <AlertCircle size={12} className="flex-shrink-0 mt-0.5" style={{ color: '#b45309' }} />
                    <p className="text-xs" style={{ color: '#b45309', lineHeight: 1.5 }}>{row.limitation}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Core Features
// ---------------------------------------------------------------------------

const CORE_FEATURES = [
  {
    icon: FileCheck,
    iconColor: '#0369a1',
    iconBg: 'rgba(3,105,161,0.09)',
    title: 'Verifiable Work Receipts',
    description:
      'When a bounty is paid, VERIPAY generates a tamper-detectable receipt linking the submission reference, payment transaction, and acceptance criteria. Anyone can verify the receipt\'s integrity or check the onchain payment independently.',
    tag: 'Implemented',
    tagColor: 'var(--success)',
    tagBg: 'var(--success-bg)',
    cta: 'dashboard',
    ctaLabel: 'View your receipts',
  },
  {
    icon: Bot,
    iconColor: '#7c3aed',
    iconBg: 'rgba(124,58,237,0.09)',
    title: 'AI Work Evaluator',
    description:
      'Bounty creators can run an AI evaluation that compares submitted work against the original acceptance criteria, criterion by criterion. The AI provides a structured recommendation — but human review always makes the final call. AI cannot approve payments or issue receipts.',
    tag: 'Implemented',
    tagColor: 'var(--success)',
    tagBg: 'var(--success-bg)',
    cta: 'marketplace',
    ctaLabel: 'Explore bounties',
  },
  {
    icon: BadgeCheck,
    iconColor: 'var(--success)',
    iconBg: 'var(--success-bg)',
    title: 'Portable Reputation',
    description:
      'Completed bounties and eligible peer reviews build a contributor profile that anyone can view. Reputation is earned through real interactions — not self-reported. Profile data is stored offchain and linked to your wallet address.',
    tag: 'Implemented',
    tagColor: 'var(--success)',
    tagBg: 'var(--success-bg)',
    cta: 'leaderboard',
    ctaLabel: 'See the leaderboard',
  },
  {
    icon: Scale,
    iconColor: '#b45309',
    iconBg: 'rgba(180,83,9,0.09)',
    title: 'Fair Dispute Resolution',
    description:
      'When a creator and contributor disagree, either party can open a dispute and present their evidence. A structured human review process documents both sides before a decision is recorded. VERIPAY does not guarantee outcomes — it guarantees a documented process.',
    tag: 'Coming soon',
    tagColor: 'var(--warning)',
    tagBg: 'var(--warning-bg)',
    cta: null,
    ctaLabel: null,
  },
  {
    icon: Lock,
    iconColor: 'var(--accent)',
    iconBg: 'var(--accent-soft)',
    title: 'Smart Contract Escrow',
    description:
      'USDC is locked in the VeritasEscrow contract before work begins. Only the approved contributor receives the reward. Only the creator can cancel and reclaim funds before payment. The contract enforces both rules — no intermediary required.',
    tag: 'Implemented',
    tagColor: 'var(--success)',
    tagBg: 'var(--success-bg)',
    cta: 'create',
    ctaLabel: 'Post a bounty',
  },
  {
    icon: Hash,
    iconColor: '#0369a1',
    iconBg: 'rgba(3,105,161,0.09)',
    title: 'Transparent Onchain Records',
    description:
      'Every funding and payment transaction is verifiable on the Arc block explorer. Receipts embed the transaction hash — anyone can follow the link and confirm the payment independently. We don\'t hide the chain of evidence.',
    tag: 'Implemented',
    tagColor: 'var(--success)',
    tagBg: 'var(--success-bg)',
    cta: null,
    ctaLabel: null,
  },
]

function CoreFeatures({ onNavigate }: { onNavigate: (view: string) => void }) {
  return (
    <section
      id="features"
      className="border-t px-4 py-16"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p
            className="text-xs font-700 tracking-widest mb-3"
            style={{ color: 'var(--accent)', letterSpacing: '0.12em' }}
          >
            PLATFORM FEATURES
          </p>
          <h2
            className="display font-700 text-2xl mb-4"
            style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
          >
            Built for real work. Verified at every step.
          </h2>
          <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
            Each feature reflects actual platform capabilities — only "Implemented" features are live.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CORE_FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl p-5 border flex flex-col"
              style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: f.iconBg, color: f.iconColor }}
                >
                  <f.icon size={17} strokeWidth={2} />
                </div>
                <span
                  className="text-xs font-600 px-2.5 py-1 rounded-full"
                  style={{ background: f.tagBg, color: f.tagColor }}
                >
                  {f.tag}
                </span>
              </div>
              <h3
                className="display font-600 text-base mb-2"
                style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
              >
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--muted)' }}>
                {f.description}
              </p>
              {f.cta && f.ctaLabel && (
                <button
                  onClick={() => onNavigate(f.cta)}
                  className="mt-4 flex items-center gap-1.5 text-sm font-600 transition-colors"
                  style={{ color: 'var(--accent)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                >
                  {f.ctaLabel} <ArrowRight size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Top contributors preview
// ---------------------------------------------------------------------------

function TopContributorsPreview({
  bounties,
  submissions,
  onNavigate,
}: {
  bounties: Bounty[]
  submissions: Submission[]
  onNavigate: (view: string) => void
}) {
  const { getProfile } = useProfiles()
  const reviewsApi = useReviews()

  // Derive top contributors from paid submissions
  const byAddress = new Map<string, { address: string; paid: number; earned: bigint }>()
  for (const sub of submissions.filter((s) => s.status === 'paid')) {
    const addr = sub.contributor.toLowerCase()
    const bounty = bounties.find((b) => b.id === sub.bountyId)
    const entry = byAddress.get(addr) ?? { address: sub.contributor, paid: 0, earned: 0n }
    entry.paid++
    if (bounty) entry.earned += bounty.rewardRaw
    byAddress.set(addr, entry)
  }

  const top = [...byAddress.values()]
    .sort((a, b) => b.paid - a.paid || Number(b.earned - a.earned))
    .slice(0, 5)

  if (top.length === 0) return null

  return (
    <section
      className="border-t px-4 py-16"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h2
              className="display font-700 text-2xl"
              style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
            >
              Top Contributors
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Ranked by completed bounties — real activity, no fabrication
            </p>
          </div>
          <button
            onClick={() => onNavigate('leaderboard')}
            className="flex items-center gap-1.5 text-sm font-600 transition-colors"
            style={{ color: 'var(--accent)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          >
            Full leaderboard <ArrowRight size={14} />
          </button>
        </div>

        <div className="space-y-2">
          {top.map((entry, idx) => {
            const profile = getProfile(entry.address)
            const avg = reviewsApi.avgRating(entry.address)
            const reviewCount = reviewsApi.forRecipient(entry.address).length

            return (
              <button
                key={entry.address}
                onClick={() => onNavigate('profile')}
                className="w-full text-left rounded-xl p-4 border flex items-center gap-4 transition-all"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 flex-shrink-0"
                  style={{
                    background: idx < 3 ? ['rgba(245,158,11,0.15)', 'rgba(156,163,175,0.2)', 'rgba(146,64,14,0.12)'][idx] : 'var(--surface-muted)',
                    color: idx < 3 ? ['#f59e0b', '#6b7280', '#92400e'][idx] : 'var(--subtle)',
                  }}
                >
                  {idx + 1}
                </span>

                <UserAvatar
                  address={entry.address}
                  avatarUrl={profile?.avatarUrl}
                  displayName={profile?.displayName}
                  size={40}
                />

                <div className="flex-1 min-w-0">
                  <p className="font-600 text-sm" style={{ color: 'var(--ink)' }}>
                    {profile?.displayName ?? formatAddress(entry.address)}
                  </p>
                  {avg !== null && (
                    <RatingSummary avg={avg} count={reviewCount} size={12} />
                  )}
                </div>

                <div className="text-right">
                  <p className="font-700 text-sm tabular-nums" style={{ color: 'var(--ink)' }}>
                    {formatUsdcAmount(entry.earned, 5042002)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                    {entry.paid} completed
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  {
    q: 'What wallet do I need?',
    a: 'Any EVM-compatible wallet — MetaMask, Coinbase Wallet, Rainbow, or others. Connect via the "Connect Wallet" button. You\'ll need to be on Arc Testnet and have test USDC.',
  },
  {
    q: 'How do I get test USDC?',
    a: 'Click "Get test USDC" in the Arc Studio sidebar to receive testnet USDC automatically. No real money required.',
  },
  {
    q: 'What happens to my USDC when I create a bounty?',
    a: 'Your USDC is locked in the VeritasEscrow smart contract when you fund a bounty. Only the escrow contract can release it — to the approved contributor on approval, or back to you on cancellation.',
  },
  {
    q: 'Can I submit to my own bounty?',
    a: 'No. The platform blocks self-submission. You cannot be both the creator and contributor for the same bounty.',
  },
  {
    q: 'How are contributors paid?',
    a: 'After you approve a submission, you call "Release Payment" which triggers a USDC transfer from the escrow contract directly to the contributor\'s wallet. This is an onchain transaction verified on Arc.',
  },
  {
    q: 'Can I cancel a bounty and get a refund?',
    a: 'Yes. You can cancel a funded bounty using the "Cancel Bounty" button, which returns your USDC from escrow. Cancellation is not possible after payment has been released.',
  },
  {
    q: 'How do ratings and reviews work?',
    a: 'After a bounty is paid, the creator can review the contributor and the contributor can review the creator. One review per direction per bounty. Reviews are stored offchain but tied to verified completed-bounty interactions.',
  },
  {
    q: 'Is this a mainnet deployment?',
    a: 'Currently Arc Testnet only. All USDC is test tokens with no real value. Mainnet deployment will require an independent security audit and explicit setup — see the deployment guide.',
  },
]

function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section
      id="faq"
      className="border-t px-4 py-16"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="max-w-2xl mx-auto">
        <h2
          className="display font-700 text-2xl text-center mb-10"
          style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
        >
          Frequently asked questions
        </h2>

        <div className="space-y-2">
          {FAQ_ITEMS.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <button
                onClick={() => setOpen(open === idx ? null : idx)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="font-600 text-sm pr-4" style={{ color: 'var(--ink)' }}>
                  {item.q}
                </span>
                {open === idx ? (
                  <ChevronUp size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                ) : (
                  <ChevronDown size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                )}
              </button>
              {open === idx && (
                <div className="px-5 pb-4">
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                    {item.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer({ onNavigate }: { onNavigate: (view: string) => void }) {
  return (
    <footer
      className="border-t px-4 py-10"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-6 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <VeriPayLogo size={28} />
              <span className="display font-700 text-base" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                VERIPAY
              </span>
            </div>
            <p className="text-xs max-w-xs" style={{ color: 'var(--subtle)' }}>
              Onchain bounty platform on Arc Testnet. Every reward locked in escrow before work begins.
            </p>
          </div>

          {/* Nav */}
          <div className="grid grid-cols-2 gap-x-12 gap-y-2">
            {[
              { label: 'Explore Bounties', view: 'marketplace' },
              { label: 'Post a Bounty', view: 'create' },
              { label: 'Dashboard', view: 'dashboard' },
              { label: 'Leaderboard', view: 'leaderboard' },
              { label: 'My Profile', view: 'dashboard' },
              { label: 'How It Works', view: 'howitworks' },
            ].map(({ label, view }) => (
              <button
                key={view}
                onClick={() => onNavigate(view)}
                className="text-sm text-left transition-colors"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              >
                {label}
              </button>
            ))}
          </div>

          {/* External links */}
          <div className="flex flex-col gap-2">
            <a
              href="https://explorer.testnet.arc.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
            >
              <ExternalLink size={13} /> Arc Testnet Explorer
            </a>
            <a
              href="https://docs.arc.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
            >
              <ExternalLink size={13} /> Arc Docs
            </a>
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
            >
              <ExternalLink size={13} /> USDC Faucet
            </a>
          </div>
        </div>

        <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            VERIPAY — Onchain Bounty Platform · Arc Testnet (Chain ID 5042002)
          </p>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            Not audited for mainnet. Use at your own risk on testnet only.
          </p>
        </div>
      </div>
    </footer>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function LandingPage({ onNavigate, onSelectBounty, bounties, submissions, stats, isLoading }: LandingPageProps) {
  function handleNavigate(view: string) {
    // How It Works / FAQ scroll to section; others navigate
    if (view === 'howitworks') {
      const el = document.getElementById('how-it-works')
      el?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    if (view === 'faq') {
      const el = document.getElementById('faq')
      el?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    onNavigate(view)
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <Hero onNavigate={handleNavigate} />
      <StatBar stats={stats} isLoading={isLoading} />
      <ProblemSolution onNavigate={handleNavigate} />
      <FeaturedBounties
        bounties={bounties}
        submissions={submissions}
        isLoading={isLoading}
        onNavigate={handleNavigate}
        onSelectBounty={onSelectBounty}
      />
      <HowItWorks onNavigate={handleNavigate} />
      <CoreFeatures onNavigate={handleNavigate} />
      <ProductPreview onNavigate={handleNavigate} />
      <TrustVerification />
      <WhyVeritas />
      <TopContributorsPreview
        bounties={bounties}
        submissions={submissions}
        onNavigate={handleNavigate}
      />
      <FAQ />
      <Footer onNavigate={handleNavigate} />
    </div>
  )
}
