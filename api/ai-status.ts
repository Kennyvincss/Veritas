import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.json({ ok: true, service: 'veripay-api', version: '2.0.0', runtime: 'vercel-functions' })
}
