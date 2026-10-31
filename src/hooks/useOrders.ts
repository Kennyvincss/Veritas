import { useState, useEffect, useCallback, useRef } from 'react'
import type { Order } from '@/types/order'

const AI_BASE = import.meta.env.VITE_AI_SERVER_URL as string | undefined
function apiBase() { return AI_BASE ? AI_BASE.replace(/\/$/, '') : '' }

export function useOrders(address: string | undefined) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchOrders = useCallback(async () => {
    if (!address) return
    try {
      const res = await fetch(`${apiBase()}/api/orders?address=${encodeURIComponent(address)}`)
      if (!res.ok) return
      const data = await res.json() as { ok: boolean; orders: Order[] }
      if (data.ok) setOrders(data.orders)
    } catch { /* network error */ }
  }, [address])

  useEffect(() => {
    const run = () => { void fetchOrders() }
    run()
    pollRef.current = setInterval(run, 8_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchOrders])

  const placeOrder = useCallback(async (params: {
    gigId?: string
    gigTitle: string
    creatorAddress: string
    freelancerAddress: string
    description: string
    price: number
    deliveryDays: number
    offerOrigin: 'creator' | 'freelancer'
    autoStart?: boolean
  }): Promise<{ ok: true; order: Order } | { ok: false; error: string }> => {
    setLoading(true)
    try {
      const res = await fetch(`${apiBase()}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const data = await res.json() as { ok: boolean; order?: Order; error?: string }
      if (data.ok && data.order) {
        void fetchOrders()
        return { ok: true, order: data.order }
      }
      return { ok: false, error: data.error ?? 'Failed to place order.' }
    } catch { return { ok: false, error: 'Network error.' } }
    finally { setLoading(false) }
  }, [fetchOrders])

  const updateOrder = useCallback(async (
    orderId: string,
    action: 'accept' | 'decline' | 'deliver' | 'complete' | 'cancel',
    callerAddress: string,
    note?: string,
  ): Promise<{ ok: true; order: Order } | { ok: false; error: string }> => {
    try {
      const res = await fetch(`${apiBase()}/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, callerAddress, note }),
      })
      const data = await res.json() as { ok: boolean; order?: Order; error?: string }
      if (data.ok && data.order) { void fetchOrders(); return { ok: true, order: data.order } }
      return { ok: false, error: data.error ?? 'Failed.' }
    } catch { return { ok: false, error: 'Network error.' } }
  }, [fetchOrders])

  return { orders, loading, placeOrder, updateOrder, refresh: fetchOrders }
}
