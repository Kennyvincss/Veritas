/**
 * OrdersPage — shows all orders for the logged-in user.
 * Freelancers see incoming orders + custom offers to accept/decline.
 * Creators see orders they placed and can confirm delivery.
 * Live countdown timer ticks every second for active orders.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Clock, Package, Loader2,
  AlertCircle, ChevronDown, ChevronUp, Send,
} from 'lucide-react'
import { useOrders } from '@/hooks/useOrders'
import { formatAddress } from '@/lib/utils'
import type { Order } from '@/types/order'

interface OrdersPageProps {
  myAddress: string | undefined
  role: 'creator' | 'freelancer' | null
  onNavigate: (v: string) => void
}

// ── Countdown timer ────────────────────────────────────────────────────────────
function formatRemaining(deadlineAt: number): string {
  const diff = deadlineAt - Date.now()
  if (diff <= 0) return 'Overdue'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

function useCountdown(deadlineAt: number | undefined) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!deadlineAt) return
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [deadlineAt])
  if (!deadlineAt) return ''
  return formatRemaining(deadlineAt)
}

function CountdownBadge({ order }: { order: Order }) {
  const remaining = useCountdown(order.deadlineAt)
  if (order.status !== 'active') return null
  const isOverdue = remaining === 'Overdue'
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-600"
      style={{
        background: isOverdue ? 'var(--danger-bg)' : 'var(--accent-soft)',
        color: isOverdue ? 'var(--danger)' : 'var(--accent)',
      }}
    >
      <Clock size={11} className={isOverdue ? '' : 'animate-pulse'} />
      {remaining}
    </div>
  )
}

const STATUS_LABELS: Record<Order['status'], string> = {
  pending_acceptance: 'Pending',
  active: 'In Progress',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
}

const STATUS_COLORS: Record<Order['status'], string> = {
  pending_acceptance: 'var(--accent)',
  active: 'var(--success)',
  delivered: '#f59e0b',
  completed: 'var(--success)',
  cancelled: 'var(--muted)',
  disputed: 'var(--danger)',
}

function OrderCard({
  order,
  myAddress,
  onAction,
}: {
  order: Order
  myAddress: string
  onAction: (orderId: string, action: 'accept' | 'decline' | 'deliver' | 'complete' | 'cancel', note?: string) => void | Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const [acting, setActing] = useState(false)
  const addr = myAddress.toLowerCase()
  const isCreator = order.creatorAddress === addr
  const isFreelancer = order.freelancerAddress === addr
  const partner = isCreator ? order.freelancerAddress : order.creatorAddress

  function act(action: 'accept' | 'decline' | 'deliver' | 'complete' | 'cancel'): void {
    setActing(true)
    void Promise.resolve(onAction(order.id, action, note.trim() || undefined))
      .finally(() => setTimeout(() => setActing(false), 1000))
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--surface)', borderColor: order.status === 'active' ? 'rgba(26,122,69,0.3)' : 'var(--border)' }}
    >
      {/* Header row */}
      <button
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-700 text-sm" style={{ color: 'var(--ink)' }}>
              {order.gigTitle}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-600"
              style={{
                background: `color-mix(in srgb, ${STATUS_COLORS[order.status]} 12%, transparent)`,
                color: STATUS_COLORS[order.status],
              }}
            >
              {STATUS_LABELS[order.status]}
            </span>
            {order.offerOrigin === 'freelancer' && order.status === 'pending_acceptance' && isCreator && (
              <span className="text-xs px-2 py-0.5 rounded-full font-600 border"
                style={{ borderColor: 'rgba(124,58,237,0.3)', color: '#c4b5fd', background: 'rgba(124,58,237,0.08)' }}>
                Custom offer
              </span>
            )}
            {order.offerOrigin === 'creator' && order.status === 'pending_acceptance' && isFreelancer && (
              <span className="text-xs px-2 py-0.5 rounded-full font-600 border"
                style={{ borderColor: 'rgba(29,78,216,0.3)', color: '#93c5fd', background: 'rgba(29,78,216,0.08)' }}>
                Incoming order
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: 'var(--subtle)' }}>
            <span>{isCreator ? 'Freelancer' : 'Creator'}: {formatAddress(partner)}</span>
            <span>${order.price} USDC · {order.deliveryDays}d delivery</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CountdownBadge order={order} />
          {expanded ? <ChevronUp size={15} style={{ color: 'var(--subtle)' }} /> : <ChevronDown size={15} style={{ color: 'var(--subtle)' }} />}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm leading-relaxed mt-4 mb-4" style={{ color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>
            {order.description}
          </p>

          {/* Timeline */}
          <div className="flex flex-col gap-1 text-xs mb-4" style={{ color: 'var(--subtle)' }}>
            <span>Created: {new Date(order.createdAt).toLocaleString()}</span>
            {order.startedAt && <span>Started: {new Date(order.startedAt).toLocaleString()}</span>}
            {order.deadlineAt && <span>Deadline: {new Date(order.deadlineAt).toLocaleString()}</span>}
            {order.deliveredAt && <span>Delivered: {new Date(order.deliveredAt).toLocaleString()}</span>}
            {order.completedAt && <span>Completed: {new Date(order.completedAt).toLocaleString()}</span>}
          </div>

          {/* Notes */}
          {order.freelancerNote && (
            <div className="p-3 rounded-xl border mb-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)' }}>
              <p className="text-xs font-600 mb-1" style={{ color: 'var(--subtle)' }}>FREELANCER NOTE</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{order.freelancerNote}</p>
            </div>
          )}
          {order.creatorNote && (
            <div className="p-3 rounded-xl border mb-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)' }}>
              <p className="text-xs font-600 mb-1" style={{ color: 'var(--subtle)' }}>CREATOR NOTE</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{order.creatorNote}</p>
            </div>
          )}

          {/* Action area */}
          {order.status === 'pending_acceptance' && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              {/* Freelancer: accept/decline incoming order */}
              {isFreelancer && order.offerOrigin === 'creator' && (
                <div className="flex gap-2">
                  <button onClick={() => { void act('accept') }} disabled={acting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-600"
                    style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(26,122,69,0.3)' }}>
                    {acting ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Accept & Start'}
                  </button>
                  <button onClick={() => { void act('decline') }} disabled={acting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-600"
                    style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid rgba(192,54,77,0.25)' }}>
                    Decline
                  </button>
                </div>
              )}
              {/* Creator: accept/decline custom freelancer offer */}
              {isCreator && order.offerOrigin === 'freelancer' && (
                <div className="flex gap-2">
                  <button onClick={() => { void act('accept') }} disabled={acting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-600"
                    style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(26,122,69,0.3)' }}>
                    {acting ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Accept Offer'}
                  </button>
                  <button onClick={() => { void act('decline') }} disabled={acting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-600"
                    style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid rgba(192,54,77,0.25)' }}>
                    Decline
                  </button>
                </div>
              )}
            </div>
          )}

          {order.status === 'active' && isFreelancer && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <textarea
                rows={2}
                placeholder="Optional delivery note…"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                className="w-full px-3 py-2 rounded-xl text-xs border outline-none resize-none mb-2"
                style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--ink)' }}
              />
              <button onClick={() => { void act('deliver') }} disabled={acting}
                className="w-full py-2.5 rounded-xl text-sm font-600"
                style={{ background: 'var(--cta)', color: '#fff' }}>
                {acting ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Mark as Delivered'}
              </button>
            </div>
          )}

          {order.status === 'delivered' && isCreator && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <textarea
                rows={2}
                placeholder="Optional review note…"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                className="w-full px-3 py-2 rounded-xl text-xs border outline-none resize-none mb-2"
                style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--ink)' }}
              />
              <button onClick={() => { void act('complete') }} disabled={acting}
                className="w-full py-2.5 rounded-xl text-sm font-600"
                style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(26,122,69,0.3)' }}>
                {acting ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Confirm Completion'}
              </button>
            </div>
          )}

          {['pending_acceptance', 'active'].includes(order.status) && (
            <button onClick={() => { void act('cancel') }} disabled={acting}
              className="mt-3 text-xs font-600 w-full text-center py-1"
              style={{ color: 'var(--muted)' }}>
              Cancel order
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Custom offer form ──────────────────────────────────────────────────────────
function CustomOfferForm({
  partnerAddress,
  onSubmit,
  onCancel,
}: {
  partnerAddress: string
  onSubmit: (params: {
    gigTitle: string; description: string; price: number; deliveryDays: number
  }) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [price, setPrice] = useState('')
  const [days, setDays] = useState('')
  const [err, setErr] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const p = parseFloat(price)
    const d = parseInt(days, 10)
    if (!title.trim()) { setErr('Title required.'); return }
    if (!desc.trim()) { setErr('Description required.'); return }
    if (isNaN(p) || p <= 0) { setErr('Enter a valid price.'); return }
    if (isNaN(d) || d < 1) { setErr('Enter valid delivery days.'); return }
    onSubmit({ gigTitle: title.trim(), description: desc.trim(), price: p, deliveryDays: d })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <p className="font-700 text-base mb-4" style={{ color: 'var(--ink)' }}>
        Send custom offer to {formatAddress(partnerAddress)}
      </p>
      {err && <p className="text-xs mb-3" style={{ color: 'var(--danger)' }}>{err}</p>}
      <div className="flex flex-col gap-3">
        <input type="text" placeholder="Service title" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 100))}
          className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none"
          style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--ink)' }} />
        <textarea rows={3} placeholder="Describe what you'll deliver…" value={desc} onChange={(e) => setDesc(e.target.value.slice(0, 1000))}
          className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none resize-none"
          style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--ink)' }} />
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-600 block mb-1" style={{ color: 'var(--subtle)' }}>PRICE (USDC)</label>
            <input type="number" min="1" step="0.01" placeholder="50" value={price} onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
              style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--ink)' }} />
          </div>
          <div className="flex-1">
            <label className="text-xs font-600 block mb-1" style={{ color: 'var(--subtle)' }}>DELIVERY (DAYS)</label>
            <input type="number" min="1" max="365" placeholder="7" value={days} onChange={(e) => setDays(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
              style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--ink)' }} />
          </div>
        </div>
        <div className="flex gap-2 mt-1">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-600 border"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'transparent' }}>
            Cancel
          </button>
          <button type="submit"
            className="flex-1 py-2.5 rounded-xl text-sm font-600 flex items-center justify-center gap-2"
            style={{ background: 'var(--cta)', color: '#fff' }}>
            <Send size={13} /> Send Offer
          </button>
        </div>
      </div>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function OrdersPage({ myAddress, role, onNavigate }: OrdersPageProps) {
  const { orders, placeOrder, updateOrder } = useOrders(myAddress)
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'completed'>('all')
  const [showOffer, setShowOffer] = useState(false)
  const [offerPartner, setOfferPartner] = useState('')
  const [actionFeedback, setActionFeedback] = useState<Record<string, string>>({})

  const filtered = orders.filter((o) => {
    if (filter === 'active') return o.status === 'active'
    if (filter === 'pending') return o.status === 'pending_acceptance'
    if (filter === 'completed') return ['completed', 'cancelled'].includes(o.status)
    return true
  })

  const pendingCount = orders.filter((o) => o.status === 'pending_acceptance').length
  const activeCount = orders.filter((o) => o.status === 'active').length

  const handleAction = useCallback(async (
    orderId: string,
    action: 'accept' | 'decline' | 'deliver' | 'complete' | 'cancel',
    note?: string,
  ) => {
    if (!myAddress) return
    const result = await updateOrder(orderId, action, myAddress, note)
    if (!result.ok) {
      setActionFeedback((prev) => ({ ...prev, [orderId]: result.error }))
      setTimeout(() => setActionFeedback((prev) => { const n = { ...prev }; delete n[orderId]; return n }), 4000)
    }
  }, [myAddress, updateOrder])

  function handleSendOffer(params: { gigTitle: string; description: string; price: number; deliveryDays: number }): void {
    if (!myAddress || !offerPartner) return
    const isFreelancer = role === 'freelancer'
    void placeOrder({
      gigTitle: params.gigTitle,
      description: params.description,
      price: params.price,
      deliveryDays: params.deliveryDays,
      creatorAddress: isFreelancer ? offerPartner : myAddress,
      freelancerAddress: isFreelancer ? myAddress : offerPartner,
      offerOrigin: isFreelancer ? 'freelancer' : 'creator',
      autoStart: false,
    }).then((result) => { if (result.ok) setShowOffer(false) })
  }

  if (!myAddress) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <Package size={32} className="mx-auto mb-4" style={{ color: 'var(--subtle)' }} />
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Sign in to view your orders.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="display font-700 text-2xl mb-1" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
            Orders
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {activeCount > 0 && `${activeCount} active · `}
            {pendingCount > 0 && `${pendingCount} awaiting response`}
            {activeCount === 0 && pendingCount === 0 && 'All your orders in one place'}
          </p>
        </div>
        <button
          onClick={() => { setShowOffer(true); setOfferPartner('') }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-600"
          style={{ background: 'var(--cta)', color: '#fff' }}
        >
          <Send size={14} /> Send Custom Offer
        </button>
      </div>

      {/* Custom offer form */}
      {showOffer && (
        <div className="mb-6">
          <div className="mb-3">
            <label className="text-xs font-600 block mb-1" style={{ color: 'var(--subtle)' }}>
              {role === 'freelancer' ? "CREATOR'S WALLET ADDRESS" : "FREELANCER'S WALLET ADDRESS"}
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={offerPartner}
              onChange={(e) => setOfferPartner(e.target.value.trim())}
              className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none font-mono"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
          </div>
          {offerPartner.startsWith('0x') && offerPartner.length >= 10 && (
            <CustomOfferForm
              partnerAddress={offerPartner}
              onSubmit={handleSendOffer}
              onCancel={() => setShowOffer(false)}
            />
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {(['all', 'active', 'pending', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-full text-xs font-600 border transition-colors"
            style={{
              background: filter === f ? 'var(--cta)' : 'var(--surface)',
              borderColor: filter === f ? 'var(--cta)' : 'var(--border)',
              color: filter === f ? '#fff' : 'var(--muted)',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && pendingCount > 0 && ` (${pendingCount})`}
            {f === 'active' && activeCount > 0 && ` (${activeCount})`}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package size={28} className="mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
          <p className="font-600 mb-1" style={{ color: 'var(--ink)' }}>No orders yet</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {role === 'freelancer'
              ? 'Orders placed on your gigs appear here.'
              : 'Place an order from a freelancer gig to get started.'}
          </p>
          <button
            onClick={() => onNavigate(role === 'creator' ? 'gigs' : 'post_gig')}
            className="mt-4 px-4 py-2 rounded-xl text-sm font-600"
            style={{ background: 'var(--cta)', color: '#fff' }}
          >
            {role === 'creator' ? 'Browse Freelancers' : 'Post a Gig'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((o) => (
            <div key={o.id}>
              {actionFeedback[o.id] && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl mb-2 text-xs"
                  style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                  <AlertCircle size={13} /> {actionFeedback[o.id]}
                </div>
              )}
              <OrderCard order={o} myAddress={myAddress} onAction={handleAction} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
