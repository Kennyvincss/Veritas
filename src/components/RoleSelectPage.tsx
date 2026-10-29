/**
 * RoleSelectPage — shown once after a wallet connects, before any inner view.
 * Users choose Creator or Freelancer. Freelancers can switch to Creator later.
 */
import { Briefcase, Search, ArrowRight, CheckCircle2 } from 'lucide-react'
import { VeriPayLogo } from './VeriPayLogo'
import type { UserRole } from '@/hooks/useRole'

interface RoleSelectPageProps {
  onChoose: (role: UserRole) => void
}

const ROLES = [
  {
    id: 'creator' as UserRole,
    icon: Briefcase,
    title: "I'm a Creator",
    subtitle: 'Post bounties & hire talent',
    description:
      'You have work to get done. Post a bounty, set a USDC reward, review submissions, and release payment when satisfied. Every payout is locked in escrow upfront.',
    perks: [
      'Post bounties with USDC escrow',
      'Review and approve submissions',
      'Build a verified track record',
      'Release payment in 2 transactions',
    ],
    accent: 'var(--cta)',
    accentSoft: 'var(--cta-soft)',
    gradient: 'linear-gradient(135deg, rgba(29,78,216,0.06) 0%, rgba(29,78,216,0.02) 100%)',
    border: 'rgba(29,78,216,0.18)',
  },
  {
    id: 'freelancer' as UserRole,
    icon: Search,
    title: "I'm a Freelancer",
    subtitle: 'Hunt bounties & get paid',
    description:
      'You have skills to offer. Browse open bounties, submit your work, and get paid in USDC the moment your submission is approved — no invoices, no delays.',
    perks: [
      'Browse all open bounties',
      'Submit work with deliverable links',
      'Get paid instantly in USDC',
      'Build a verifiable work history',
    ],
    accent: '#7c3aed',
    accentSoft: 'rgba(124,58,237,0.08)',
    gradient: 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(124,58,237,0.02) 100%)',
    border: 'rgba(124,58,237,0.18)',
  },
] as const

export function RoleSelectPage({ onChoose }: RoleSelectPageProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ background: 'var(--bg-gradient)' }}
    >
      {/* Logo + brand */}
      <div className="flex items-center gap-3 mb-3">
        <VeriPayLogo size={40} />
        <span
          className="display font-700 text-2xl"
          style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}
        >
          VERIPAY
        </span>
      </div>

      <p className="text-sm mb-10 text-center" style={{ color: 'var(--subtle)' }}>
        Onchain bounties, verified work, instant USDC payments.
      </p>

      <h2
        className="display font-700 text-xl sm:text-2xl mb-2 text-center"
        style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
      >
        How are you joining?
      </h2>
      <p className="text-sm mb-8 text-center" style={{ color: 'var(--muted)' }}>
        Choose your role — you can always switch later.
      </p>

      {/* Role cards */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl">
        {ROLES.map((r) => {
          const Icon = r.icon
          return (
            <button
              key={r.id}
              onClick={() => onChoose(r.id)}
              className="flex-1 text-left rounded-2xl p-6 border transition-all duration-150 group"
              style={{
                background: r.gradient,
                borderColor: r.border,
                boxShadow: 'var(--shadow-card)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = `0 8px 32px ${r.accentSoft}, 0 2px 8px rgba(17,24,39,0.08)`
                e.currentTarget.style.borderColor = r.accent
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'var(--shadow-card)'
                e.currentTarget.style.borderColor = r.border
              }}
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: r.accentSoft }}
              >
                <Icon size={22} style={{ color: r.accent }} />
              </div>

              <p className="display font-700 text-lg mb-0.5" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                {r.title}
              </p>
              <p className="text-xs font-600 mb-3" style={{ color: r.accent }}>
                {r.subtitle}
              </p>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--muted)' }}>
                {r.description}
              </p>

              {/* Perks */}
              <ul className="space-y-1.5 mb-5">
                {r.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2 text-xs" style={{ color: 'var(--ink)' }}>
                    <CheckCircle2 size={13} style={{ color: r.accent, flexShrink: 0 }} />
                    {perk}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div
                className="flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-600 transition-colors"
                style={{ background: r.accent, color: '#fff' }}
              >
                <span>Join as {r.id === 'creator' ? 'Creator' : 'Freelancer'}</span>
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          )
        })}
      </div>

      <p className="text-xs mt-8 text-center" style={{ color: 'var(--subtle)' }}>
        Freelancers can switch to Creator mode anytime from their profile.
      </p>
    </div>
  )
}
