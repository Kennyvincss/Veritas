import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kgetList, ksetList, uid, parseBody } from './_redis'

const KEY = 'veripay:messages'

interface Message {
  id: string; fromAddress: string; toAddress: string
  text: string; read: boolean; createdAt: number
}

function threadKey(a: string, b: string) {
  return [a.toLowerCase(), b.toLowerCase()].sort().join(':')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  const messages = await kgetList<Message>(KEY)

  if (req.method === 'GET') {
    const myAddress = typeof req.query['myAddress'] === 'string' ? req.query['myAddress'].toLowerCase() : ''
    const partnerAddress = typeof req.query['partnerAddress'] === 'string' ? req.query['partnerAddress'].toLowerCase() : ''
    if (!myAddress) { res.status(400).json({ ok: false, error: 'myAddress required' }); return }
    if (partnerAddress) {
      const tk = threadKey(myAddress, partnerAddress)
      const thread = messages.filter((m) =>
        threadKey(m.fromAddress, m.toAddress) === tk
      ).sort((a, b) => a.createdAt - b.createdAt)
      res.json({ ok: true, messages: thread }); return
    }
    // Return conversation list (latest message per partner)
    const seen = new Map<string, Message>()
    for (const m of messages) {
      if (m.fromAddress !== myAddress && m.toAddress !== myAddress) continue
      const partner = m.fromAddress === myAddress ? m.toAddress : m.fromAddress
      const existing = seen.get(partner)
      if (!existing || m.createdAt > existing.createdAt) seen.set(partner, m)
    }
    res.json({ ok: true, conversations: [...seen.entries()].map(([partner, last]) => ({ partner, last })) })
    return
  }

  if (req.method === 'POST') {
    const b = await parseBody(req)
    const fromAddress = typeof b['fromAddress'] === 'string' ? b['fromAddress'].toLowerCase() : ''
    const toAddress = typeof b['toAddress'] === 'string' ? b['toAddress'].toLowerCase() : ''
    const text = typeof b['text'] === 'string' ? b['text'].trim() : ''
    if (!fromAddress || !toAddress || !text) {
      res.status(400).json({ ok: false, error: 'fromAddress, toAddress and text are required.' }); return
    }
    const msg: Message = { id: uid(), fromAddress, toAddress, text, read: false, createdAt: Date.now() }
    messages.push(msg)
    if (messages.length > 2000) messages.splice(0, messages.length - 2000)
    await ksetList(KEY, messages)
    res.json({ ok: true, message: msg }); return
  }

  if (req.method === 'PATCH') {
    // Mark messages as read
    const b = await parseBody(req)
    const myAddress = typeof b['myAddress'] === 'string' ? b['myAddress'].toLowerCase() : ''
    const partnerAddress = typeof b['partnerAddress'] === 'string' ? b['partnerAddress'].toLowerCase() : ''
    if (!myAddress || !partnerAddress) { res.status(400).json({ ok: false, error: 'myAddress and partnerAddress required' }); return }
    const tk = threadKey(myAddress, partnerAddress)
    let changed = false
    for (const m of messages) {
      if (threadKey(m.fromAddress, m.toAddress) === tk && m.toAddress === myAddress && !m.read) {
        m.read = true; changed = true
      }
    }
    if (changed) await ksetList(KEY, messages)
    res.json({ ok: true }); return
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' })
}

export const config = { api: { bodyParser: false } }
