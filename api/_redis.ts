/**
 * KV store helper — works with Vercel KV (built-in, free) or Upstash Redis REST.
 *
 * Vercel KV env vars (set automatically when you add KV in Vercel dashboard):
 *   KV_REST_API_URL, KV_REST_API_TOKEN
 *
 * Upstash env vars (alternative):
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 *
 * Falls back to an in-process Map when neither is set (local dev only —
 * data is lost between requests in production without KV configured).
 */

const REDIS_URL =
  process.env['KV_REST_API_URL'] ??
  process.env['UPSTASH_REDIS_REST_URL']

const REDIS_TOKEN =
  process.env['KV_REST_API_TOKEN'] ??
  process.env['UPSTASH_REDIS_REST_TOKEN']

// In-memory fallback for local dev (lost between requests in serverless!)
const memStore = new Map<string, string>()

async function redisCmd(...args: (string | number)[]): Promise<unknown> {
  if (!REDIS_URL || !REDIS_TOKEN) {
    const [cmd, key, ...rest] = args
    if (cmd === 'GET') return memStore.get(String(key)) ?? null
    if (cmd === 'SET') { memStore.set(String(key), String(rest[0])); return 'OK' }
    if (cmd === 'DEL') { memStore.delete(String(key)); return 1 }
    return null
  }
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  const json = await res.json() as { result: unknown }
  return json.result
}

export async function kget<T>(key: string): Promise<T | null> {
  const raw = await redisCmd('GET', key) as string | null
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

export async function kset(key: string, value: unknown): Promise<void> {
  await redisCmd('SET', key, JSON.stringify(value))
}

export async function kdel(key: string): Promise<void> {
  await redisCmd('DEL', key)
}

export async function kgetList<T>(key: string): Promise<T[]> {
  return (await kget<T[]>(key)) ?? []
}

export async function ksetList<T>(key: string, list: T[]): Promise<void> {
  await kset(key, list)
}

function uid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
export { uid }

/**
 * Parse JSON body from a Vercel request.
 * @vercel/node v3+ does NOT auto-parse — body may be undefined or a raw Buffer/string.
 */
export async function parseBody(req: import('@vercel/node').VercelRequest): Promise<Record<string, unknown>> {
  // Already parsed (some runtimes do parse it)
  if (req.body !== undefined && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body as Record<string, unknown>
  }
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) as Record<string, unknown> : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}
