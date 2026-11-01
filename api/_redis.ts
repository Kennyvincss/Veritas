/**
 * Upstash Redis REST helper — zero SDK, plain fetch.
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel env vars.
 *
 * Falls back to an in-process Map when env vars are absent (local dev / preview
 * without KV configured) — data is lost on cold-start in that mode.
 */

const REDIS_URL = process.env['UPSTASH_REDIS_REST_URL']
const REDIS_TOKEN = process.env['UPSTASH_REDIS_REST_TOKEN']

// In-memory fallback for local dev
const memStore = new Map<string, string>()

async function redisCmd(...args: (string | number)[]): Promise<unknown> {
  if (!REDIS_URL || !REDIS_TOKEN) {
    // Local fallback — implement only what we use
    const [cmd, key, ...rest] = args
    if (cmd === 'GET') return memStore.get(String(key)) ?? null
    if (cmd === 'SET') { memStore.set(String(key), String(rest[0])); return 'OK' }
    if (cmd === 'DEL') { memStore.delete(String(key)); return 1 }
    return null
  }
  const res = await fetch(`${REDIS_URL}`, {
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

/** Read a JSON array stored at `key`, defaulting to []. */
export async function kgetList<T>(key: string): Promise<T[]> {
  return (await kget<T[]>(key)) ?? []
}

/** Overwrite a JSON array at `key`. */
export async function ksetList<T>(key: string, list: T[]): Promise<void> {
  await kset(key, list)
}

function uid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
export { uid }
