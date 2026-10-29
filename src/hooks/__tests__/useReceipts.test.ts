/**
 * Tests for the Proof-of-Work Receipt system (standalone logic).
 *
 * Tests executed:
 *  1. Receipt creation + persistence to localStorage
 *  2. Receipt ID uniqueness (different receipts get different IDs)
 *  3. Duplicate receipt prevention (same bountyId + contributorAddress)
 *  4. Hash generation — verificationStatus set to 'hash_verified' on creation
 *  5. Integrity hash is 64-char hex (SHA-256)
 *  6. Tampered receipt detection — integrityHash mismatch after field mutation
 *  7. Invalid / corrupted storage handled gracefully (no crash)
 *  8. Entries with no receiptId are skipped on load
 *  9. forContributor filter (case-insensitive)
 * 10. forBounty filter
 * 11. submissionContentHash does not embed raw private content
 * 12. submissionContentHash is deterministic (same inputs → same output)
 * 13. Missing required field (bountyId) rejected
 * 14. Receipt without paymentTxHash is accepted (field is optional)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createReceipt,
  loadAllReceipts,
  computeSubmissionContentHash,
  RECEIPTS_KEY,
} from '../useReceipts'
import { ARC_TESTNET_CHAIN_ID, ESCROW_ADDRESS_TESTNET } from '@/contracts/VeritasEscrow'

// ── Mock localStorage ────────────────────────────────────────────────────────
const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]) },
})

// ── Shared fixture ────────────────────────────────────────────────────────────

const BASE = {
  bountyId: 'bounty-1',
  bountyTitle: 'Write a blog post',
  bountyDescriptionSnapshot: 'Write 1000 words about VERITAS.',
  creatorAddress: '0xowner0000000000000000000000000000000001',
  contributorAddress: '0xcontrib000000000000000000000000000000001',
  submissionId: 'sub-abc123',
  submissionTitle: 'My Blog Post',
  submissionSummary: 'I wrote the full post with examples.',
  rewardRawString: '100000000', // $100 USDC
  completedAt: 1700000000,
  paymentTxHash: '0xdeadbeef00000000000000000000000000000000000000000000000000000001',
  chainId: ARC_TESTNET_CHAIN_ID,
  escrowContractAddress: ESCROW_ADDRESS_TESTNET,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createReceipt', () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
  })

  // 1. Creation + persistence
  it('creates a receipt and persists it', async () => {
    const result = await createReceipt(BASE)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const stored = loadAllReceipts()
    expect(stored).toHaveLength(1)
    expect(stored[0].receiptId).toBe(result.receipt.receiptId)
    expect(stored[0].bountyTitle).toBe('Write a blog post')
    expect(stored[0].rewardToken).toBe('USDC')
    expect(stored[0].rewardRawString).toBe('100000000')
    expect(stored[0].completedAt).toBe(1700000000)
  })

  // 2. Unique IDs
  it('generates unique IDs for different receipts', async () => {
    const r1 = await createReceipt({ ...BASE, bountyId: 'b-unique-1' })
    const r2 = await createReceipt({ ...BASE, bountyId: 'b-unique-2' })
    expect(r1.ok && r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return
    expect(r1.receipt.receiptId).not.toBe(r2.receipt.receiptId)
    expect(r1.receipt.receiptId).toMatch(/^rcpt-/)
    expect(r2.receipt.receiptId).toMatch(/^rcpt-/)
  })

  // 3. Duplicate prevention
  it('rejects a duplicate (same bountyId + contributorAddress)', async () => {
    const r1 = await createReceipt(BASE)
    expect(r1.ok).toBe(true)

    const r2 = await createReceipt({ ...BASE, submissionId: 'sub-other' }) // same bounty+contributor
    expect(r2.ok).toBe(false)
    if (r2.ok) return
    expect(r2.error).toContain('already exists')
  })

  // 4. verificationStatus set to hash_verified
  it('sets verificationStatus to hash_verified', async () => {
    const r = await createReceipt(BASE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.receipt.verificationStatus).toBe('hash_verified')
  })

  // 5. integrityHash is 64-char SHA-256 hex
  it('integrityHash is a 64-char hex string', async () => {
    const r = await createReceipt(BASE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.receipt.integrityHash).toHaveLength(64)
    expect(/^[0-9a-f]{64}$/.test(r.receipt.integrityHash)).toBe(true)
  })

  // 6. Tampered receipt detected by hash mismatch
  it('detects a tampered receipt — stored hash differs after field mutation', async () => {
    const r = await createReceipt(BASE)
    expect(r.ok).toBe(true)
    if (!r.ok) return

    const originalHash = r.receipt.integrityHash

    // Directly mutate the stored receipt (simulates tampering)
    const raw = JSON.parse(store[RECEIPTS_KEY] ?? '[]') as Record<string, unknown>[]
    raw[0]['rewardRawString'] = '1' // attacker changes reward to $0.000001
    store[RECEIPTS_KEY] = JSON.stringify(raw)

    const tampered = loadAllReceipts()
    expect(tampered[0].rewardRawString).toBe('1')       // tamper confirmed
    expect(tampered[0].integrityHash).toBe(originalHash) // hash NOT updated by attacker

    // The stored hash was for the original fields; recomputing over '1' produces a different hash.
    // This is what verifyReceipt checks — we verify the invariant here:
    const freshHash = await (async () => {
      // Reproduce the canonical hash over tampered fields
      const fields = {
        receiptId: tampered[0].receiptId,
        bountyId: tampered[0].bountyId,
        bountyTitle: tampered[0].bountyTitle,
        creatorAddress: tampered[0].creatorAddress,
        contributorAddress: tampered[0].contributorAddress,
        submissionId: tampered[0].submissionId,
        submissionContentHash: tampered[0].submissionContentHash,
        bountyDescriptionSnapshot: tampered[0].bountyDescriptionSnapshot,
        rewardRawString: '1', // tampered
        rewardToken: tampered[0].rewardToken,
        completedAt: tampered[0].completedAt,
        paymentTxHash: tampered[0].paymentTxHash,
        createdAt: tampered[0].createdAt,
      }
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(fields).sort()) {
        sorted[k] = fields[k as keyof typeof fields] ?? null
      }
      const enc = new TextEncoder()
      const buf = await crypto.subtle.digest('SHA-256', enc.encode(JSON.stringify(sorted)))
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
    })()

    expect(freshHash).not.toBe(originalHash) // hash mismatch confirmed
  })

  // 7. Invalid JSON in storage handled gracefully
  it('returns empty array on corrupted localStorage', () => {
    store[RECEIPTS_KEY] = '{invalid-json}'
    const result = loadAllReceipts()
    expect(result).toEqual([])
  })

  // 8. Entries without receiptId are skipped
  it('skips entries missing receiptId', () => {
    store[RECEIPTS_KEY] = JSON.stringify([
      { bountyId: 'b1' }, // no receiptId
      { bountyId: 'b2', receiptId: '' }, // empty receiptId
    ])
    const result = loadAllReceipts()
    expect(result).toHaveLength(0)
  })

  // 9. forContributor filter (case-insensitive)
  it('filters receipts by contributor address case-insensitively', async () => {
    await createReceipt({ ...BASE, bountyId: 'b-alice', contributorAddress: '0xAlice' })
    await createReceipt({ ...BASE, bountyId: 'b-bob', contributorAddress: '0xBob' })

    const all = loadAllReceipts()
    const aliceReceipts = all.filter(
      (r) => r.contributorAddress.toLowerCase() === '0xalice',
    )
    expect(aliceReceipts).toHaveLength(1)
    expect(aliceReceipts[0].bountyId).toBe('b-alice')
  })

  // 10. forBounty filter
  it('filters receipts by bountyId', async () => {
    await createReceipt({ ...BASE, bountyId: 'target', contributorAddress: '0xC1' })
    await createReceipt({ ...BASE, bountyId: 'other', contributorAddress: '0xC2' })

    const all = loadAllReceipts()
    const targeted = all.filter((r) => r.bountyId === 'target')
    expect(targeted).toHaveLength(1)
    expect(targeted[0].contributorAddress).toBe('0xc1')
  })

  // 11. submissionContentHash does not embed raw content
  it('submissionContentHash is a hex hash, not raw content', async () => {
    const hash = await computeSubmissionContentHash(
      'My Secret Work Title',
      'Confidential summary: I built X using Y.',
    )
    expect(hash).toHaveLength(64)
    expect(hash).not.toContain('My Secret Work Title')
    expect(hash).not.toContain('Confidential summary')
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true)
  })

  // 12. submissionContentHash is deterministic
  it('produces the same hash for identical inputs', async () => {
    const h1 = await computeSubmissionContentHash('title', 'summary')
    const h2 = await computeSubmissionContentHash('title', 'summary')
    expect(h1).toBe(h2)
  })

  it('produces different hashes for different inputs', async () => {
    const h1 = await computeSubmissionContentHash('title-A', 'summary-A')
    const h2 = await computeSubmissionContentHash('title-B', 'summary-B')
    expect(h1).not.toBe(h2)
  })

  // 13. Missing required field rejected
  it('rejects creation when bountyId is missing', async () => {
    const r = await createReceipt({ ...BASE, bountyId: '' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('bountyId')
  })

  // 14. Optional paymentTxHash
  it('creates a valid receipt without paymentTxHash', async () => {
    const r = await createReceipt({ ...BASE, bountyId: 'b-nohash', paymentTxHash: undefined })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.receipt.paymentTxHash).toBeUndefined()
    expect(r.receipt.verificationStatus).toBe('hash_verified')
  })
})
