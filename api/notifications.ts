import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kgetList, ksetList, uid, parseBody } from './_redis'

const KEY = 'veripay:notifications'

interface Notification {
  id: string; recipientAddress: string; type: string
  title: string; message: string; bountyId?: string
  read: boolean; createdAt: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  const notifications = await kgetList<Notification>(KEY)

  if (req.method === 'GET') {
    const addr = typeof req.query['address'] === 'string' ? req.query['address'].toLowerCase() : ''
    if (!addr) { res.status(400).json({ ok: false, error: 'address required' }); return }
    const result = notifications
      .filter((n) => n.recipientAddress === addr)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50)
    res.json({ ok: true, notifications: result }); return
  }

  if (req.method === 'POST') {
    const b = await parseBody(req)
    const recipientAddress = typeof b['recipientAddress'] === 'string' ? b['recipientAddress'].toLowerCase() : ''
    const type = typeof b['type'] === 'string' ? b['type'] : 'info'
    const title = typeof b['title'] === 'string' ? b['title'].trim() : ''
    const message = typeof b['message'] === 'string' ? b['message'].trim() : ''
    if (!recipientAddress || !title) { res.status(400).json({ ok: false, error: 'recipientAddress and title required' }); return }
    const notif: Notification = {
      id: uid(), recipientAddress, type, title, message,
      bountyId: typeof b['bountyId'] === 'string' ? b['bountyId'] : undefined,
      read: false, createdAt: Date.now(),
    }
    notifications.unshift(notif)
    if (notifications.length > 1000) notifications.splice(1000)
    await ksetList(KEY, notifications)
    res.json({ ok: true, notification: notif }); return
  }

  if (req.method === 'PATCH') {
    // Mark all read for an address
    const b = await parseBody(req)
    const addr = typeof b['address'] === 'string' ? b['address'].toLowerCase() : ''
    if (!addr) { res.status(400).json({ ok: false, error: 'address required' }); return }
    let changed = false
    for (const n of notifications) {
      if (n.recipientAddress === addr && !n.read) { n.read = true; changed = true }
    }
    if (changed) await ksetList(KEY, notifications)
    res.json({ ok: true }); return
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' })
}

export const config = { api: { bodyParser: false } }
