export type OrderStatus =
  | 'pending_acceptance' // custom offer waiting for other party
  | 'active'            // accepted, timer running
  | 'delivered'         // freelancer marked complete
  | 'completed'         // creator confirmed / auto-completed
  | 'cancelled'         // cancelled before delivery
  | 'disputed'

export type OrderOfferOrigin = 'creator' | 'freelancer'

export interface Order {
  id: string
  gigId?: string          // if placed from a gig
  gigTitle: string
  creatorAddress: string
  freelancerAddress: string
  description: string
  price: number           // USDC amount
  deliveryDays: number    // agreed turnaround
  status: OrderStatus
  offerOrigin: OrderOfferOrigin
  startedAt?: number      // unix ms — set when accepted
  deadlineAt?: number     // startedAt + deliveryDays * 86400 * 1000
  deliveredAt?: number
  completedAt?: number
  createdAt: number
  updatedAt: number
  creatorNote?: string
  freelancerNote?: string
}
