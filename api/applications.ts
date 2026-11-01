import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kgetList, ksetList, uid, parseBody } from './_redis'

const KEY = 'veripay:applications'

interface JobApplication {
  id: string; jobId: string; jobTitle: string; jobOwner: string
  applicantAddress: string; message: string
  status: 'pending' | 'approved' | 'declined'
  createdAt: number; updatedAt: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  const applications = await kgetList<JobApplication>(KEY)

  if (req.method === 'GET') {
    const jobId = typeof req.query['jobId'] === 'string' ? req.query['jobId'] : null
    const applicantAddress = typeof req.query['applicantAddress'] === 'string' ? req.query['applicantAddress'].toLowerCase() : null
    const jobOwner = typeof req.query['jobOwner'] === 'string' ? req.query['jobOwner'].toLowerCase() : null
    let result = applications
    if (jobId) result = result.filter((a) => a.jobId === jobId)
    if (applicantAddress) result = result.filter((a) => a.applicantAddress === applicantAddress)
    if (jobOwner) result = result.filter((a) => a.jobOwner === jobOwner)
    res.json({ ok: true, applications: result }); return
  }

  if (req.method === 'POST') {
    const b = await parseBody(req)
    const jobId = typeof b['jobId'] === 'string' ? b['jobId'] : ''
    const jobTitle = typeof b['jobTitle'] === 'string' ? b['jobTitle'].trim().slice(0, 200) : ''
    const jobOwner = typeof b['jobOwner'] === 'string' ? b['jobOwner'].toLowerCase() : ''
    const applicantAddress = typeof b['applicantAddress'] === 'string' ? b['applicantAddress'].toLowerCase() : ''
    const message = typeof b['message'] === 'string' ? b['message'].trim().slice(0, 1000) : ''
    if (!jobId || !jobOwner || !applicantAddress) {
      res.status(400).json({ ok: false, error: 'jobId, jobOwner and applicantAddress are required.' }); return
    }
    if (applicantAddress === jobOwner) {
      res.status(400).json({ ok: false, error: 'Cannot apply to your own job.' }); return
    }
    const existing = applications.find((a) => a.jobId === jobId && a.applicantAddress === applicantAddress)
    if (existing) {
      res.status(409).json({ ok: false, error: 'You have already applied for this job.' }); return
    }
    const now = Date.now()
    const appl: JobApplication = {
      id: uid(), jobId, jobTitle, jobOwner, applicantAddress, message,
      status: 'pending', createdAt: now, updatedAt: now,
    }
    applications.push(appl)
    await ksetList(KEY, applications)
    res.json({ ok: true, application: appl }); return
  }

  if (req.method === 'PATCH') {
    const id = typeof req.query['id'] === 'string' ? req.query['id'] : ''
    const b = await parseBody(req)
    const status = typeof b['status'] === 'string' ? b['status'] : ''
    const callerAddress = typeof b['callerAddress'] === 'string' ? b['callerAddress'].toLowerCase() : ''
    const idx = applications.findIndex((a) => a.id === id)
    if (idx === -1) { res.status(404).json({ ok: false, error: 'Application not found.' }); return }
    const appl = applications[idx]!
    if (appl.jobOwner !== callerAddress) {
      res.status(403).json({ ok: false, error: 'Only the job owner can update this application.' }); return
    }
    appl.status = status as JobApplication['status']
    appl.updatedAt = Date.now()
    await ksetList(KEY, applications)
    res.json({ ok: true, application: appl }); return
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' })
}

export const config = { api: { bodyParser: false } }
