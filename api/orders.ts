import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kgetList, ksetList, uid, parseBody } from './_redis'

const KEY = 'veripay:orders'

interface Order {
  id: string; gigId?: string; gigTitle: string
  creatorAddress: string; freelancerAddress: string
  price: number; deliveryDays: number; description: string
  status: 'active' | 'delivered' | 'completed' | 'cancelled' | 'pending_offer'
  offeredBy?: string
  createdAt: number; deadlineAt?: number; deliveredAt?: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  const orders = await kgetList<Order>(KEY)

  if (req.method === 'GET') {
    const addr = typeof req.query['address'] === 'string' ? req.query['address'].toLowerCase() : ''
    if (!addr) { res.status(400).json({ ok: false, error: 'address required' }); return }
    const result = orders.filter((o) =>
      o.creatorAddress === addr || o.freelancerAddress === addr
    ).sort((a, b) => b.createdAt - a.createdAt)
    res.json({ ok: true, orders: result }); return
  }

  if (req.method === 'POST') {
    const b = await parseBody(req)
    const creatorAddress = typeof b['creatorAddress'] === 'string' ? b['creatorAddress'].toLowerCase() : ''
    const freelancerAddress = typeof b['freelancerAddress'] === 'string' ? b['freelancerAddress'].toLowerCase() : ''
    const price = typeof b['price'] === 'number' ? b['price'] : 0
    const deliveryDays = typeof b['deliveryDays'] === 'number' ? b['deliveryDays'] : 1
    const gigTitle = typeof b['gigTitle'] === 'string' ? b['gigTitle'].trim() : ''
    const description = typeof b['description'] === 'string' ? b['description'].trim() : ''
    const isPendingOffer = b['status'] === 'pending_offer'
    const offeredBy = typeof b['offeredBy'] === 'string' ? b['offeredBy'].toLowerCase() : undefined

    if (!creatorAddress || !freelancerAddress || price <= 0 || !gigTitle) {
      res.status(400).json({ ok: false, error: 'creatorAddress, freelancerAddress, price and gigTitle are required.' }); return
    }
    const now = Date.now()
    const order: Order = {
      id: uid(),
      gigId: typeof b['gigId'] === 'string' ? b['gigId'] : undefined,
      gigTitle, creatorAddress, freelancerAddress, price, deliveryDays, description,
      status: isPendingOffer ? 'pending_offer' : 'active',
      offeredBy,
      createdAt: now,
      deadlineAt: isPendingOffer ? undefined : now + deliveryDays * 86400_000,
    }
    orders.unshift(order)
    if (orders.length > 1000) orders.splice(1000)
    await ksetList(KEY, orders)
    res.json({ ok: true, order }); return
  }

  if (req.method === 'PATCH') {
    const id = typeof req.query['id'] === 'string' ? req.query['id'] : ''
    const b = await parseBody(req)
    const idx = orders.findIndex((o) => o.id === id)
    if (idx === -1) { res.status(404).json({ ok: false, error: 'Order not found.' }); return }
    const order = orders[idx]!
    const action = typeof b['action'] === 'string' ? b['action'] : null
    const newStatus = typeof b['status'] === 'string' ? b['status'] as Order['status'] : null

    if (action === 'accept' || newStatus === 'active') {
      order.status = 'active'
      order.deadlineAt = Date.now() + order.deliveryDays * 86400_000
    } else if (action === 'deliver' || newStatus === 'delivered') {
      order.status = 'delivered'
      order.deliveredAt = Date.now()
    } else if (action === 'complete' || newStatus === 'completed') {
      order.status = 'completed'
    } else if (action === 'decline' || action === 'cancel' || newStatus === 'cancelled') {
      order.status = 'cancelled'
    } else if (newStatus) {
      order.status = newStatus
    }
    await ksetList(KEY, orders)
    res.json({ ok: true, order }); return
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' })
}

export const config = { api: { bodyParser: false } }
