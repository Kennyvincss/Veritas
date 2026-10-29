/**
 * Gig — a service offering posted by a Freelancer.
 * Creators browse gigs and can hire/contact the freelancer.
 * Stored in localStorage (offchain, like submissions).
 */

export type GigCategory =
  | 'design'
  | 'development'
  | 'writing'
  | 'marketing'
  | 'video'
  | 'data'
  | 'other'

export interface Gig {
  id: string
  title: string
  description: string
  category: GigCategory
  /** What the freelancer delivers */
  deliverables: string
  /** Starting price in USDC (display only — actual payment via bounty escrow) */
  startingPrice: number
  /** Estimated turnaround e.g. "3 days", "1 week" */
  turnaround: string
  /** Wallet address of the freelancer who posted it */
  freelancerAddress: string
  createdAt: number
  /** Optional portfolio/work sample links */
  portfolioLinks: string[]
  /** Skills / tags */
  tags: string[]
}
