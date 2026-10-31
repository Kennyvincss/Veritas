/**
 * OrderGigModal — popup for a creator to place a direct order on a freelancer gig.
 * The order goes active immediately (creator-initiated, no acceptance required).
 */
import { useState } from 'react'
import { X, Loader2, ShoppingBag } from 'lucide-react'
import { useOrders } from '@/hooks/useOrders'
import type { Gig } from '@/types/gig'

interface OrderGigModalProps {
  gig: Gig
  creatorAddress: string
  onClose: () => void
  onSuccess: () => void
}

export function OrderGigModal({ gig, creatorAddress, onClose, onSuccess }: OrderGigModalProps) {
  const { placeOrder, loading } = useOrders(creatorAddress)
  const [desc, setDesc] = useState(gig.description)
  const [price, setPrice] = useState(String(gig.startingPrice))
  const [days, setDays] = useState(gig.turnaround.replace(/\D/g, '') || '7')
  const [err, setErr] = useState('')

  function handleOrder(e: React.FormEvent): void {
    e.preventDefault()
    const p = parseFloat(price)
    const d = parseInt(days, 10)
    if (isNaN(p) || p <= 0) { setErr('Enter a valid price.'); return }
    if (isNaN(d) || d < 1) { setErr('Enter valid delivery days.'); return }

    void placeOrder({
      gigId: gig.id,
      gigTitle: gig.title,
      creatorAddress,
      freelancerAddress: gig.freelancerAddress,
      description: desc.trim() || gig.description,
      price: p,
      deliveryDays: d,
      offerOrigin: 'creator',
      autoStart: true,
    }).then((result) => {
      if (result.ok) onSuccess()
      else setErr(result.error)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-3xl border w-full max-w-md p-6 relative"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ background: 'var(--surface-muted)', color: 'var(--subtle)' }}
        >
          <X size={15} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--cta-soft)' }}>
            <ShoppingBag size={18} style={{ color: 'var(--cta)' }} />
          </div>
          <div>
            <h2 className="font-700 text-base" style={{ color: 'var(--ink)' }}>Order Directly</h2>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>{gig.title}</p>
          </div>
        </div>

        <form onSubmit={handleOrder} className="flex flex-col gap-4">
          {err && <p className="text-xs px-3 py-2 rounded-xl" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{err}</p>}

          <div>
            <label className="text-xs font-600 block mb-1" style={{ color: 'var(--subtle)' }}>ORDER DESCRIPTION</label>
            <textarea
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value.slice(0, 800))}
              className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none resize-none"
              style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-600 block mb-1" style={{ color: 'var(--subtle)' }}>PRICE (USDC)</label>
              <input
                type="number" min="1" step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--ink)' }}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-600 block mb-1" style={{ color: 'var(--subtle)' }}>DELIVERY (DAYS)</label>
              <input
                type="number" min="1" max="365"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--ink)' }}
              />
            </div>
          </div>

          <p className="text-xs px-3 py-2 rounded-xl" style={{ background: 'var(--accent-soft)', color: 'var(--muted)' }}>
            The timer starts immediately when you place this order. The freelancer will be notified.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-700 flex items-center justify-center gap-2"
            style={{ background: 'var(--cta)', color: '#fff' }}
          >
            {loading
              ? <Loader2 size={15} className="animate-spin" />
              : <><ShoppingBag size={15} /> Place Order &amp; Start Timer</>}
          </button>
        </form>
      </div>
    </div>
  )
}
