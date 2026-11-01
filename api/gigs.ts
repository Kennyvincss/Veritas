import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kgetList, ksetList, uid, parseBody } from './_redis'

const KEY = 'veripay:gigs'

interface Gig {
  id: string; title: string; description: string; category: string
  deliverables: string; startingPrice: number; turnaround: string
  freelancerAddress: string; portfolioLinks: string[]; tags: string[]
  createdAt: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  const gigs = await kgetList<Gig>(KEY)

  if (req.method === 'GET') {
    const addr = typeof req.query['freelancerAddress'] === 'string'
      ? req.query['freelancerAddress'].toLowerCase() : null
    const result = addr ? gigs.filter((g) => g.freelancerAddress === addr) : gigs
    res.json({ ok: true, gigs: result }); return
  }

  if (req.method === 'POST') {
    const b = await parseBody(req)
    const title = typeof b['title'] === 'string' ? b['title'].trim() : ''
    const description = typeof b['description'] === 'string' ? b['description'].trim() : ''
    const freelancerAddress = typeof b['freelancerAddress'] === 'string' ? b['freelancerAddress'].toLowerCase() : ''
    const startingPrice = typeof b['startingPrice'] === 'number' ? b['startingPrice'] : 0
    if (!title || !description || !freelancerAddress || startingPrice <= 0) {
      res.status(400).json({ ok: false, error: 'title, description, freelancerAddress and startingPrice are required.' }); return
    }
    const gig: Gig = {
      id: uid(), title, description,
      category: typeof b['category'] === 'string' ? b['category'] : 'other',
      deliverables: typeof b['deliverables'] === 'string' ? b['deliverables'].trim() : '',
      startingPrice,
      turnaround: typeof b['turnaround'] === 'string' ? b['turnaround'].trim() : 'Flexible',
      freelancerAddress,
      portfolioLinks: Array.isArray(b['portfolioLinks']) ? b['portfolioLinks'] as string[] : [],
      tags: Array.isArray(b['tags']) ? b['tags'] as string[] : [],
      createdAt: Date.now(),
    }
    gigs.unshift(gig)
    if (gigs.length > 500) gigs.splice(500)
    await ksetList(KEY, gigs)
    res.json({ ok: true, gig }); return
  }

  if (req.method === 'DELETE') {
    const id = typeof req.query['id'] === 'string' ? req.query['id'] : ''
    const bd = await parseBody(req)
    const callerAddress = (typeof bd['callerAddress'] === 'string' ? bd['callerAddress'] : '').toLowerCase()
    const idx = gigs.findIndex((g) => g.id === id && g.freelancerAddress === callerAddress)
    if (idx === -1) { res.status(404).json({ ok: false, error: 'Gig not found or not yours.' }); return }
    gigs.splice(idx, 1)
    await ksetList(KEY, gigs)
    res.json({ ok: true }); return
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' })
}

export const config = { api: { bodyParser: false } }
