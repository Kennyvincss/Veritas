import type { VercelRequest, VercelResponse } from '@vercel/node'

// Simple rate limit: 10 evaluations per IP per 60s
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  // Rate limit
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? 'unknown'
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 })
  } else if (entry.count >= 10) {
    res.status(429).json({ error: 'Rate limit exceeded. Please wait before requesting another evaluation.' }); return
  } else {
    entry.count++
  }

  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    res.status(503).json({ error: 'AI evaluation is not configured on this server.' }); return
  }

  const b = req.body as Record<string, unknown>
  const bountyTitle = typeof b['bountyTitle'] === 'string' ? b['bountyTitle'] : ''
  const bountyDescription = typeof b['bountyDescription'] === 'string' ? b['bountyDescription'] : ''
  const submissionContent = typeof b['submissionContent'] === 'string' ? b['submissionContent'] : ''

  if (!bountyTitle || !submissionContent) {
    res.status(400).json({ error: 'bountyTitle and submissionContent are required.' }); return
  }

  const prompt = `You are an expert evaluator for a freelance work platform called VERIPAY.

Job Title: ${bountyTitle}
Job Description: ${bountyDescription}

Submitted Work:
${submissionContent}

Evaluate this submission against the job requirements. Be honest and constructive.
Respond with a JSON object (no markdown, raw JSON only) with these exact fields:
{
  "score": <number 0-100>,
  "verdict": "<Excellent|Good|Needs Improvement|Insufficient>",
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "recommendation": "<Approve Payment|Request Revisions|Decline>"
}`

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      console.error('Anthropic error', anthropicRes.status, errText)
      res.status(502).json({ error: 'AI service error. Please try again.' }); return
    }

    const data = await anthropicRes.json() as {
      content: { type: string; text: string }[]
    }
    const text = data.content.find((c) => c.type === 'text')?.text ?? ''
    let evaluation: unknown
    try { evaluation = JSON.parse(text) } catch {
      // Try to extract JSON from text
      const match = text.match(/\{[\s\S]*\}/)
      if (match) { try { evaluation = JSON.parse(match[0]) } catch { /* ignore */ } }
    }
    if (!evaluation) {
      res.status(502).json({ error: 'Could not parse AI response.' }); return
    }
    res.json({ ok: true, evaluation })
  } catch (err) {
    console.error('evaluate error', err)
    res.status(500).json({ error: 'Internal server error.' })
  }
}
