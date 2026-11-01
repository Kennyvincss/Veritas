import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kgetList, ksetList, uid, parseBody } from './_redis'

const KEY = 'veripay:submissions'

interface Submission {
  id: string; bountyId: string; submitterAddress: string
  content: string; links: string[]; status: string
  createdAt: number; updatedAt: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  const submissions = await kgetList<Submission>(KEY)

  if (req.method === 'GET') {
    const bountyId = typeof req.query['bountyId'] === 'string' ? req.query['bountyId'] : null
    const result = bountyId ? submissions.filter((s) => s.bountyId === bountyId) : submissions
    res.json({ ok: true, submissions: result }); return
  }

  if (req.method === 'POST') {
    const b = await parseBody(req)
    const bountyId = typeof b['bountyId'] === 'string' ? b['bountyId'] : ''
    const submitterAddress = typeof b['submitterAddress'] === 'string' ? b['submitterAddress'].toLowerCase() : ''
    const content = typeof b['content'] === 'string' ? b['content'].trim() : ''
    if (!bountyId || !submitterAddress || !content) {
      res.status(400).json({ ok: false, error: 'bountyId, submitterAddress and content are required.' }); return
    }
    const now = Date.now()
    const sub: Submission = {
      id: uid(), bountyId, submitterAddress, content,
      links: Array.isArray(b['links']) ? b['links'] as string[] : [],
      status: 'pending', createdAt: now, updatedAt: now,
    }
    submissions.push(sub)
    await ksetList(KEY, submissions)
    res.json({ ok: true, submission: sub }); return
  }

  if (req.method === 'PATCH') {
    const id = typeof req.query['id'] === 'string' ? req.query['id'] : ''
    const b = await parseBody(req)
    const idx = submissions.findIndex((s) => s.id === id)
    if (idx === -1) { res.status(404).json({ ok: false, error: 'Submission not found.' }); return }
    if (typeof b['status'] === 'string') submissions[idx]!.status = b['status']
    submissions[idx]!.updatedAt = Date.now()
    await ksetList(KEY, submissions)
    res.json({ ok: true, submission: submissions[idx] }); return
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' })
}

export const config = { api: { bodyParser: false } }
