/**
 * useEvaluations — AI Work Evaluation storage and retrieval for VERITAS.
 *
 * Storage architecture:
 *   - All evaluations are persisted in localStorage under EVALUATIONS_KEY.
 *   - Each evaluation run is a separate, immutable record (never overwritten).
 *   - Re-running an evaluation increments the `version` counter for that
 *     (bountyId, submissionId) pair. This creates a full audit trail.
 *   - The hook exposes `requestEvaluation` which calls the backend /api/evaluate
 *     endpoint and stores the result.
 *
 * Safety invariants (enforced here and documented):
 *   - This hook NEVER calls approveContributor(), releasePayment(), or any onchain tx.
 *   - It NEVER creates or modifies a WorkReceipt.
 *   - The `recommendation` field is advisory only — it has no side effects.
 *   - Human decisions (humanDecision field) are recorded separately via
 *     `recordHumanDecision` and never auto-populated by AI results.
 *   - Authorization: only the bounty owner (requestedBy) may request evaluations.
 *     This is enforced in the panel component and noted here; the localStorage
 *     layer cannot cryptographically enforce ownership (that is the contract's job).
 *
 * Cross-tab sync via the 'storage' event.
 *
 * AI provider configuration:
 *   - The backend server must be running (`bun run server`) with either
 *     OPENAI_API_KEY or ANTHROPIC_API_KEY set in .env.
 *   - The frontend calls /api/evaluate (Vite proxies to localhost:3001).
 *   - If the server is unavailable or returns AI_UNAVAILABLE, the evaluation
 *     is stored with status 'unavailable' and a clear explanation is shown.
 */

import { useState, useEffect, useCallback } from 'react'
import type {
  AIEvaluation,
  EvaluationStatus,
  CriterionStatus,
  AIRecommendation,
} from '@/types/bounty'

// ---------------------------------------------------------------------------
// API base URL
// ---------------------------------------------------------------------------
// API calls use relative /api/* paths — works in dev (Vite proxy) and production (Vercel functions).
const AI_BASE = ''

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

export const EVALUATIONS_KEY = 'veritas_evaluations_v1'

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

export function loadAllEvaluations(): AIEvaluation[] {
  try {
    const raw = localStorage.getItem(EVALUATIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Record<string, unknown>[]
    return parsed.flatMap((e): AIEvaluation[] => {
      const str = (v: unknown, fb = ''): string => (typeof v === 'string' ? v : fb)
      const num = (v: unknown, fb = 0): number => (typeof v === 'number' ? v : fb)
      const evaluationId = str(e['evaluationId'])
      if (!evaluationId) return []
      return [{
        evaluationId,
        bountyId: str(e['bountyId']),
        bountyTitle: str(e['bountyTitle']),
        submissionId: str(e['submissionId']),
        contributorAddress: str(e['contributorAddress']),
        requestedBy: str(e['requestedBy']),
        criteriaSnapshot: str(e['criteriaSnapshot']),
        criteriaUnverified: e['criteriaUnverified'] === true,
        requestedAt: num(e['requestedAt']),
        completedAt: typeof e['completedAt'] === 'number' ? e['completedAt'] : undefined,
        version: num(e['version'], 1),
        status: (str(e['status'], 'failed')) as EvaluationStatus,
        errorMessage: typeof e['errorMessage'] === 'string' ? e['errorMessage'] : undefined,
        criterionResults: Array.isArray(e['criterionResults'])
          ? (e['criterionResults'] as Record<string, unknown>[]).map((cr) => ({
              criterion: str(cr['criterion']),
              status: (str(cr['status'], 'unclear')) as CriterionStatus,
              reason: str(cr['reason']),
              evidence: str(cr['evidence']),
              missing: str(cr['missing']),
            }))
          : undefined,
        workSummary: typeof e['workSummary'] === 'string' ? e['workSummary'] : undefined,
        recommendation: typeof e['recommendation'] === 'string'
          ? (e['recommendation'] as AIRecommendation) : undefined,
        confidence: (['high', 'medium', 'low'] as const).includes(e['confidence'] as 'high' | 'medium' | 'low')
          ? (e['confidence'] as 'high' | 'medium' | 'low') : undefined,
        confidenceExplanation: typeof e['confidenceExplanation'] === 'string' ? e['confidenceExplanation'] : undefined,
        limitations: Array.isArray(e['limitations'])
          ? (e['limitations'] as unknown[]).filter((l): l is string => typeof l === 'string')
          : undefined,
        provider: typeof e['provider'] === 'string' ? e['provider'] : undefined,
        model: typeof e['model'] === 'string' ? e['model'] : undefined,
        humanDecision: (['approved', 'revisions_requested', 'rejected'].includes(e['humanDecision'] as string))
          ? (e['humanDecision'] as 'approved' | 'revisions_requested' | 'rejected') : null,
        humanDecisionAt: typeof e['humanDecisionAt'] === 'number' ? e['humanDecisionAt'] : undefined,
        humanDecisionNote: typeof e['humanDecisionNote'] === 'string' ? e['humanDecisionNote'] : undefined,
      }]
    })
  } catch {
    return []
  }
}

function saveAllEvaluations(evals: AIEvaluation[]): void {
  localStorage.setItem(EVALUATIONS_KEY, JSON.stringify(evals))
}

function newEvaluationId(): string {
  const ts = Date.now().toString(36)
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `eval-${ts}-${rand}`
}

// ---------------------------------------------------------------------------
// Request params
// ---------------------------------------------------------------------------

export interface RequestEvaluationParams {
  bountyId: string
  bountyTitle: string
  bountyDescription: string  // used as acceptance criteria
  criteriaItems?: string[]   // optional parsed list
  submissionId: string
  submissionTitle: string
  submissionSummary: string
  deliverables: Array<{ label: string; url: string }>
  contributorAddress: string
  requestedBy: string        // must be bounty owner — enforced in UI
}

export interface RecordHumanDecisionParams {
  evaluationId: string
  decision: 'approved' | 'revisions_requested' | 'rejected'
  note?: string
  /** Must match the evaluationId's requestedBy to be accepted. */
  callerAddress: string
}

export interface UseEvaluationsResult {
  evaluations: AIEvaluation[]
  /** All evaluations for a given submission, sorted newest first. */
  forSubmission: (submissionId: string) => AIEvaluation[]
  /** All evaluations for a given bounty. */
  forBounty: (bountyId: string) => AIEvaluation[]
  /** The latest evaluation for a submission, or undefined. */
  latestForSubmission: (submissionId: string) => AIEvaluation | undefined
  /**
   * Request a new AI evaluation. Calls /api/evaluate on the backend.
   * Returns the stored evaluation (status may be 'failed' or 'unavailable').
   * SAFETY: Does NOT approve submissions, trigger payments, or issue receipts.
   */
  requestEvaluation: (params: RequestEvaluationParams) => Promise<AIEvaluation>
  /**
   * Record the bounty creator's human decision about an evaluation.
   * Stored separately from the AI recommendation.
   * SAFETY: Does NOT approve submissions onchain or trigger payments.
   */
  recordHumanDecision: (params: RecordHumanDecisionParams) => { ok: true } | { ok: false; error: string }
  /** Force reload from localStorage (cross-tab sync). */
  refresh: () => void
  /** True while an evaluation request is in flight. */
  isEvaluating: boolean
}

// ---------------------------------------------------------------------------
// API response shape from /api/evaluate
// ---------------------------------------------------------------------------

interface EvaluateAPISuccess {
  ok: true
  provider: string
  model: string
  workSummary: string
  criterionResults: Array<{
    criterion: string
    status: string
    reason: string
    evidence: string
    missing: string
  }>
  recommendation: string
  confidence: string
  confidenceExplanation: string
  limitations: string[]
}

interface EvaluateAPIError {
  error: string
  code?: string
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEvaluations(): UseEvaluationsResult {
  const [evaluations, setEvaluations] = useState<AIEvaluation[]>(loadAllEvaluations)
  const [isEvaluating, setIsEvaluating] = useState(false)

  // Cross-tab sync
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === EVALUATIONS_KEY) setEvaluations(loadAllEvaluations())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const refresh = useCallback(() => setEvaluations(loadAllEvaluations()), [])

  // ── Readers ────────────────────────────────────────────────────────────────

  const forSubmission = useCallback(
    (submissionId: string): AIEvaluation[] =>
      evaluations
        .filter((e) => e.submissionId === submissionId)
        .sort((a, b) => b.version - a.version),
    [evaluations],
  )

  const forBounty = useCallback(
    (bountyId: string): AIEvaluation[] =>
      evaluations.filter((e) => e.bountyId === bountyId),
    [evaluations],
  )

  const latestForSubmission = useCallback(
    (submissionId: string): AIEvaluation | undefined =>
      evaluations
        .filter((e) => e.submissionId === submissionId)
        .sort((a, b) => b.version - a.version)[0],
    [evaluations],
  )

  // ── Request evaluation ─────────────────────────────────────────────────────

  const requestEvaluation = useCallback(
    async (params: RequestEvaluationParams): Promise<AIEvaluation> => {
      const {
        bountyId, bountyTitle, bountyDescription, criteriaItems,
        submissionId, submissionTitle, submissionSummary,
        deliverables, contributorAddress, requestedBy,
      } = params

      // Determine version: max existing version for this submission + 1
      const existing = loadAllEvaluations()
      const prevVersions = existing
        .filter((e) => e.submissionId === submissionId)
        .map((e) => e.version)
      const version = prevVersions.length > 0 ? Math.max(...prevVersions) + 1 : 1

      const evaluationId = newEvaluationId()
      const requestedAt = Math.floor(Date.now() / 1000)

      // Detect if criteria are verifiable
      const criteriaUnverified = !bountyDescription.trim() || bountyDescription.trim().length < 20

      // Create a 'running' placeholder immediately so the UI can show progress
      const runningRecord: AIEvaluation = {
        evaluationId,
        bountyId,
        bountyTitle,
        submissionId,
        contributorAddress,
        requestedBy,
        criteriaSnapshot: bountyDescription,
        criteriaUnverified,
        requestedAt,
        version,
        status: 'running',
        humanDecision: null,
      }

      setEvaluations((prev) => {
        const updated = [...prev, runningRecord]
        saveAllEvaluations(updated)
        return updated
      })
      setIsEvaluating(true)

      let finalRecord: AIEvaluation

      try {
        const response = await fetch(`${AI_BASE}/api/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bountyId,
            bountyTitle,
            bountyDescription,
            criteriaItems,
            submissionId,
            submissionTitle,
            submissionSummary,
            deliverables,
            contributorAddress,
          }),
          signal: AbortSignal.timeout(50_000),
        })

        const completedAt = Math.floor(Date.now() / 1000)

        if (response.status === 503) {
          const err = await response.json() as EvaluateAPIError
          finalRecord = {
            ...runningRecord,
            status: 'unavailable',
            errorMessage: err.error ?? 'AI evaluation is not available. Configure OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.',
            completedAt,
          }
        } else if (!response.ok) {
          const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` })) as EvaluateAPIError
          finalRecord = {
            ...runningRecord,
            status: 'failed',
            errorMessage: err.error ?? `Server error ${response.status}`,
            completedAt,
          }
        } else {
          const result = await response.json() as EvaluateAPISuccess
          finalRecord = {
            ...runningRecord,
            status: 'complete',
            completedAt,
            criterionResults: result.criterionResults.map((cr) => ({
              criterion: cr.criterion,
              status: cr.status as CriterionStatus,
              reason: cr.reason,
              evidence: cr.evidence,
              missing: cr.missing,
            })),
            workSummary: result.workSummary,
            recommendation: result.recommendation as AIRecommendation,
            confidence: result.confidence as 'high' | 'medium' | 'low',
            confidenceExplanation: result.confidenceExplanation,
            limitations: result.limitations,
            provider: result.provider,
            model: result.model,
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        const isTimeout = msg.includes('timeout') || msg.includes('aborted') || msg.includes('AbortError')
        finalRecord = {
          ...runningRecord,
          status: 'failed',
          errorMessage: isTimeout
            ? 'Evaluation timed out. The AI provider did not respond in time. Please try again.'
            : 'Could not reach the AI evaluation server. Make sure `bun run server` is running.',
          completedAt: Math.floor(Date.now() / 1000),
        }
      }

      // Replace the running placeholder with the final record
      setEvaluations((prev) => {
        const updated = prev.map((e) => e.evaluationId === evaluationId ? finalRecord : e)
        saveAllEvaluations(updated)
        return updated
      })
      setIsEvaluating(false)

      return finalRecord
    },
    [],
  )

  // ── Record human decision ──────────────────────────────────────────────────

  const recordHumanDecision = useCallback(
    (params: RecordHumanDecisionParams): { ok: true } | { ok: false; error: string } => {
      const { evaluationId, decision, note, callerAddress } = params

      const existing = loadAllEvaluations()
      const target = existing.find((e) => e.evaluationId === evaluationId)
      if (!target) return { ok: false, error: 'Evaluation not found.' }

      // Authorization: only the requester can record a decision
      if (target.requestedBy.toLowerCase() !== callerAddress.toLowerCase()) {
        return { ok: false, error: 'Only the bounty creator who requested this evaluation can record a decision.' }
      }

      // SAFETY: Recording a human decision has NO effect on the smart contract.
      // It does NOT call approveContributor(), releasePayment(), or any onchain tx.
      // The creator must use the existing approval buttons for onchain actions.
      const updated = existing.map((e) =>
        e.evaluationId === evaluationId
          ? {
              ...e,
              humanDecision: decision,
              humanDecisionAt: Math.floor(Date.now() / 1000),
              humanDecisionNote: note?.slice(0, 500).trim(),
            }
          : e,
      )
      saveAllEvaluations(updated)
      setEvaluations(updated)
      return { ok: true }
    },
    [],
  )

  return {
    evaluations,
    forSubmission,
    forBounty,
    latestForSubmission,
    requestEvaluation,
    recordHumanDecision,
    refresh,
    isEvaluating,
  }
}
