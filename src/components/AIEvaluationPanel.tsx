/**
 * AIEvaluationPanel — Stage 4
 *
 * Displays AI evaluation results for a submission within the BountyDetailPage
 * creator review section. Visible only to the bounty owner.
 *
 * SAFETY INVARIANTS (enforced here):
 *   - This panel NEVER calls approveContributor(), releasePayment(), or any onchain tx.
 *   - It NEVER creates or modifies a WorkReceipt.
 *   - The AI recommendation is clearly labelled as advisory.
 *   - Human decisions recorded here have NO effect on the smart contract.
 *   - The creator must use the existing "Approve & Release Payment" button for onchain actions.
 *   - If AI is unavailable, the manual review workflow remains fully functional.
 *
 * Prompt-injection defence:
 *   - Submission text rendered here uses whitespace-pre-wrap but is plain text only.
 *   - Criterion results, reasons, and evidence are rendered as text — no dangerouslySetInnerHTML.
 *   - The AI system prompt (server-side) instructs the model to ignore instructions in submissions.
 */

import { useState } from 'react'
import {
  Bot, CheckCircle2, XCircle, AlertCircle, ChevronDown,
  ChevronUp, RefreshCw, Loader2, Info, AlertTriangle, ThumbsUp,
  ThumbsDown, RotateCcw, History,
} from 'lucide-react'
import type { AIEvaluation, CriterionResult, AIRecommendation, Bounty, Submission } from '@/types/bounty'
import { useEvaluations } from '@/hooks/useEvaluations'
import { formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function recommendationConfig(rec: AIRecommendation) {
  switch (rec) {
    case 'recommend_approval':
      return { label: 'Recommend Approval', color: 'var(--success)', bg: 'var(--success-bg)', Icon: CheckCircle2 }
    case 'request_revisions':
      return { label: 'Request Revisions', color: '#f59e0b', bg: '#fefce8', Icon: AlertCircle }
    case 'human_review_required':
    default:
      return { label: 'Human Review Required', color: 'var(--accent)', bg: 'var(--accent-soft)', Icon: AlertTriangle }
  }
}

function criterionStatusConfig(status: CriterionResult['status']) {
  switch (status) {
    case 'satisfied':
      return { label: 'Satisfied', color: 'var(--success)', bg: 'var(--success-bg)', Icon: CheckCircle2 }
    case 'not_satisfied':
      return { label: 'Not Satisfied', color: 'var(--danger)', bg: 'var(--danger-bg)', Icon: XCircle }
    case 'unclear':
    default:
      return { label: 'Unclear', color: '#f59e0b', bg: '#fefce8', Icon: AlertCircle }
  }
}

function confidencePill(level: 'high' | 'medium' | 'low') {
  const map = {
    high: { label: 'High confidence', color: 'var(--success)', bg: 'var(--success-bg)' },
    medium: { label: 'Medium confidence', color: '#f59e0b', bg: '#fefce8' },
    low: { label: 'Low confidence', color: 'var(--danger)', bg: 'var(--danger-bg)' },
  }
  return map[level]
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AIDisclaimer() {
  return (
    <div
      className="flex items-start gap-2 rounded-xl p-3 text-xs"
      style={{ background: 'rgba(26,46,74,0.05)', color: 'var(--muted)' }}
    >
      <Bot size={13} className="flex-shrink-0 mt-0.5" />
      <span>
        <span className="font-600">AI-generated assessment — human review required.</span>{' '}
        This evaluation is advisory only. It does not approve submissions, release funds,
        or issue work receipts. Use the Approve &amp; Release Payment button above to take onchain action.
      </span>
    </div>
  )
}

function CriterionCard({ cr }: { cr: CriterionResult }) {
  const [open, setOpen] = useState(false)
  const cfg = criterionStatusConfig(cr.status)
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ background: 'var(--surface)' }}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: cfg.bg }}>
          <cfg.Icon size={11} color={cfg.color} />
        </div>
        <span className="flex-1 text-xs font-500 leading-snug" style={{ color: 'var(--ink)' }}>
          {cr.criterion}
        </span>
        <span className="text-xs font-600 flex-shrink-0 mr-2" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
        {open ? <ChevronUp size={13} style={{ color: 'var(--subtle)' }} /> : <ChevronDown size={13} style={{ color: 'var(--subtle)' }} />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)' }}>
          <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--muted)' }}>
            <span className="font-600" style={{ color: 'var(--ink)' }}>Assessment: </span>
            {cr.reason}
          </p>
          {cr.evidence && (
            <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--muted)' }}>
              <span className="font-600" style={{ color: 'var(--ink)' }}>Evidence referenced: </span>
              {cr.evidence}
            </p>
          )}
          {cr.missing && (
            <p className="text-xs leading-relaxed" style={{ color: '#f59e0b' }}>
              <span className="font-600">Still needed: </span>
              {cr.missing}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function EvaluationResult({ evaluation }: { evaluation: AIEvaluation }) {
  const [showHistory, setShowHistory] = useState(false)
  if (evaluation.status !== 'complete' || !evaluation.criterionResults) return null
  const recCfg = recommendationConfig(evaluation.recommendation ?? 'human_review_required')

  return (
    <div className="space-y-4">
      {/* Recommendation */}
      <div
        className="flex items-center gap-3 rounded-xl p-4"
        style={{ background: recCfg.bg }}
      >
        <recCfg.Icon size={20} color={recCfg.color} className="flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-700 text-sm" style={{ color: recCfg.color }}>{recCfg.label}</p>
          {evaluation.confidence && (
            <span
              className="inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-500"
              style={{
                background: confidencePill(evaluation.confidence).bg,
                color: confidencePill(evaluation.confidence).color,
              }}
            >
              {confidencePill(evaluation.confidence).label}
            </span>
          )}
        </div>
      </div>

      {/* Work summary */}
      {evaluation.workSummary && (
        <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-600 mb-2" style={{ color: 'var(--subtle)', letterSpacing: '0.05em' }}>
            WORK SUMMARY
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{evaluation.workSummary}</p>
        </div>
      )}

      {/* Criterion-by-criterion results */}
      <div>
        <p className="text-xs font-600 mb-2" style={{ color: 'var(--subtle)', letterSpacing: '0.05em' }}>
          CRITERIA RESULTS ({evaluation.criterionResults.length})
        </p>
        <div className="space-y-2">
          {evaluation.criterionResults.map((cr, i) => (
            <CriterionCard key={i} cr={cr} />
          ))}
        </div>
      </div>

      {/* Limitations */}
      {evaluation.limitations && evaluation.limitations.length > 0 && (
        <div
          className="rounded-xl border p-3"
          style={{ background: 'var(--warning-bg)', borderColor: 'rgba(245,158,11,0.25)' }}
        >
          <p className="text-xs font-600 mb-1.5" style={{ color: '#92400e', letterSpacing: '0.05em' }}>
            COULD NOT ASSESS
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {evaluation.limitations.map((l, i) => (
              <li key={i} className="text-xs" style={{ color: '#92400e' }}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Confidence explanation */}
      {evaluation.confidenceExplanation && (
        <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--subtle)' }}>
          <Info size={12} className="flex-shrink-0 mt-0.5" />
          <span>{evaluation.confidenceExplanation}</span>
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs" style={{ color: 'var(--subtle)' }}>
        Evaluated {evaluation.completedAt ? formatDate(evaluation.completedAt) : '—'}
        {evaluation.model ? ` · ${evaluation.provider}/${evaluation.model}` : ''}
        {' · '}
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="underline"
        >
          {showHistory ? 'Hide history' : `Version ${evaluation.version}`}
        </button>
      </div>

      {showHistory && (
        <div
          className="rounded-xl border p-3 text-xs"
          style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--muted)' }}
        >
          <p className="font-600 mb-1" style={{ color: 'var(--ink)' }}>Evaluation record</p>
          <p>ID: <span className="mono">{evaluation.evaluationId}</span></p>
          <p>Bounty: #{evaluation.bountyId}</p>
          <p>Submission: <span className="mono">{evaluation.submissionId}</span></p>
          <p>Requested: {formatDate(evaluation.requestedAt)}</p>
          <p>Version: {evaluation.version}</p>
          {evaluation.criteriaUnverified && (
            <p className="mt-1" style={{ color: '#f59e0b' }}>
              ⚠ Criteria snapshot could not be independently verified as the original.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Human Decision Panel
// ---------------------------------------------------------------------------

interface HumanDecisionPanelProps {
  evaluation: AIEvaluation
  callerAddress: string
  onRecord: (decision: 'approved' | 'revisions_requested' | 'rejected', note: string) => void
}

function HumanDecisionPanel({ evaluation, callerAddress, onRecord }: HumanDecisionPanelProps) {
  const [note, setNote] = useState('')
  const [pending, setPending] = useState<'approved' | 'revisions_requested' | 'rejected' | null>(null)

  if (evaluation.requestedBy.toLowerCase() !== callerAddress.toLowerCase()) return null

  if (evaluation.humanDecision) {
    const cfg = {
      approved: { label: 'You approved this submission', color: 'var(--success)', bg: 'var(--success-bg)' },
      revisions_requested: { label: 'You requested revisions', color: '#f59e0b', bg: '#fefce8' },
      rejected: { label: 'You rejected this submission', color: 'var(--danger)', bg: 'var(--danger-bg)' },
    }[evaluation.humanDecision]
    return (
      <div
        className="rounded-xl border p-4"
        style={{ background: cfg.bg, borderColor: 'var(--border)' }}
      >
        <p className="text-xs font-600" style={{ color: cfg.color }}>
          Your decision: {cfg.label}
        </p>
        {evaluation.humanDecisionNote && (
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{evaluation.humanDecisionNote}</p>
        )}
        {evaluation.humanDecisionAt && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>{formatDate(evaluation.humanDecisionAt)}</p>
        )}
        <p className="text-xs mt-2" style={{ color: 'var(--subtle)' }}>
          This is your personal note. Use the Approve &amp; Release Payment button above to take onchain action.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <p className="text-xs font-600" style={{ color: 'var(--ink)' }}>Your decision (optional note)</p>
      <p className="text-xs" style={{ color: 'var(--subtle)' }}>
        Recording a decision here is a personal note — it does not approve the submission onchain or release funds.
        Use the Approve &amp; Release Payment button to take onchain action.
      </p>
      <textarea
        rows={2}
        placeholder="Optional note…"
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 500))}
        className="w-full rounded-xl px-3 py-2.5 text-xs border outline-none resize-none"
        style={{
          background: 'var(--surface-muted)',
          borderColor: 'var(--border)',
          color: 'var(--ink)',
        }}
      />
      <div className="flex flex-wrap gap-2">
        {([
          { value: 'approved' as const, label: 'Looks good', Icon: ThumbsUp, color: 'var(--success)' },
          { value: 'revisions_requested' as const, label: 'Needs revisions', Icon: RotateCcw, color: '#f59e0b' },
          { value: 'rejected' as const, label: 'Not accepted', Icon: ThumbsDown, color: 'var(--danger)' },
        ]).map(({ value, label, Icon, color }) => (
          <button
            key={value}
            type="button"
            disabled={pending !== null}
            onClick={() => {
              setPending(value)
              onRecord(value, note)
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-600 border transition-colors min-h-[36px]"
            style={{ borderColor: 'var(--border)', color, background: 'transparent' }}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export interface AIEvaluationPanelProps {
  bounty: Bounty
  submission: Submission
  /** Must be the bounty owner address. Panel is hidden for non-owners. */
  ownerAddress: string
  /** Optional: pre-parsed list of explicit criteria from the description. */
  criteriaItems?: string[]
}

export function AIEvaluationPanel({
  bounty,
  submission,
  ownerAddress,
  criteriaItems,
}: AIEvaluationPanelProps) {
  const { latestForSubmission, requestEvaluation, recordHumanDecision, forSubmission, isEvaluating } =
    useEvaluations()

  const [showAllVersions, setShowAllVersions] = useState(false)
  const [humanDecisionFeedback, setHumanDecisionFeedback] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const latest = latestForSubmission(submission.id)
  const allVersions = forSubmission(submission.id)
  const isRunning = latest?.status === 'running' || isEvaluating

  function handleEvaluate() {
    if (isRunning) return
    void requestEvaluation({
      bountyId: bounty.id,
      bountyTitle: bounty.title,
      bountyDescription: bounty.description,
      criteriaItems,
      submissionId: submission.id,
      submissionTitle: submission.title,
      submissionSummary: submission.summary,
      deliverables: submission.deliverables,
      contributorAddress: submission.contributor,
      requestedBy: ownerAddress,
    })
  }

  function handleHumanDecision(
    decision: 'approved' | 'revisions_requested' | 'rejected',
    note: string,
  ) {
    if (!latest) return
    const result = recordHumanDecision({
      evaluationId: latest.evaluationId,
      decision,
      note,
      callerAddress: ownerAddress,
    })
    setHumanDecisionFeedback(
      result.ok
        ? 'Decision recorded. Use Approve & Release Payment to take onchain action.'
        : result.error,
    )
    setTimeout(() => setHumanDecisionFeedback(''), 5000)
  }

  // ── Collapsed state ────────────────────────────────────────────────────────
  const panelHeader = (
    <div className="flex items-center gap-2 px-5 py-4">
      <Bot size={15} style={{ color: 'var(--accent)' }} className="flex-shrink-0" />
      <span className="flex-1 text-sm font-600" style={{ color: 'var(--ink)' }}>
        AI Evaluator
      </span>
      {latest?.status === 'complete' && latest.recommendation && (
        <span
          className="text-xs font-600 px-2 py-0.5 rounded-full"
          style={{
            background: recommendationConfig(latest.recommendation).bg,
            color: recommendationConfig(latest.recommendation).color,
          }}
        >
          {recommendationConfig(latest.recommendation).label}
        </span>
      )}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="ml-auto p-1"
        style={{ color: 'var(--subtle)' }}
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
      </button>
    </div>
  )

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header — always visible */}
      <div className="border-b" style={{ borderColor: 'var(--border)' }}>
        {panelHeader}
      </div>

      {!collapsed && (
        <div className="p-5 space-y-4">
          <AIDisclaimer />

          {/* No evaluation yet */}
          {!latest && (
            <div className="text-center py-6">
              <Bot size={28} style={{ color: 'var(--subtle)' }} className="mx-auto mb-3" />
              <p className="text-sm font-500 mb-1" style={{ color: 'var(--ink)' }}>
                No evaluation yet
              </p>
              <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
                Run the AI evaluator to get a structured assessment of this submission against the bounty's acceptance criteria.
              </p>
              <button
                type="button"
                onClick={handleEvaluate}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600 mx-auto"
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  opacity: isRunning ? 0.6 : 1,
                }}
              >
                <Bot size={14} />
                Evaluate submission
              </button>
            </div>
          )}

          {/* Running */}
          {latest?.status === 'running' && (
            <div className="flex items-center gap-3 py-4 text-sm" style={{ color: 'var(--muted)' }}>
              <Loader2 size={16} className="animate-spin flex-shrink-0" style={{ color: 'var(--accent)' }} />
              Evaluating submission against acceptance criteria…
            </div>
          )}

          {/* Unavailable */}
          {latest?.status === 'unavailable' && (
            <div
              className="rounded-xl border p-4 text-sm"
              style={{ background: 'var(--warning-bg)', borderColor: 'rgba(245,158,11,0.25)', color: '#92400e' }}
            >
              <p className="font-600 mb-1">AI evaluation is not configured</p>
              <p className="text-xs">{latest.errorMessage}</p>
              <p className="text-xs mt-2">
                To enable: add <span className="mono font-600">OPENAI_API_KEY</span> or{' '}
                <span className="mono font-600">ANTHROPIC_API_KEY</span> to your{' '}
                <span className="mono">.env</span> file and run{' '}
                <span className="mono font-600">bun run server</span>.
                The manual review workflow above remains fully functional.
              </p>
            </div>
          )}

          {/* Failed */}
          {latest?.status === 'failed' && (
            <div
              className="rounded-xl border p-4"
              style={{ background: 'var(--danger-bg)', borderColor: 'rgba(192,54,77,0.22)' }}
            >
              <p className="text-sm font-600 mb-1" style={{ color: 'var(--danger)' }}>Evaluation failed</p>
              <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>{latest.errorMessage}</p>
              <button
                type="button"
                onClick={handleEvaluate}
                disabled={isRunning}
                className="flex items-center gap-2 text-xs font-600"
                style={{ color: 'var(--accent)' }}
              >
                <RefreshCw size={12} /> Try again
              </button>
            </div>
          )}

          {/* Complete */}
          {latest?.status === 'complete' && (
            <>
              <EvaluationResult evaluation={latest} />

              {/* Human decision */}
              <HumanDecisionPanel
                evaluation={latest}
                callerAddress={ownerAddress}
                onRecord={handleHumanDecision}
              />

              {humanDecisionFeedback && (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{humanDecisionFeedback}</p>
              )}
            </>
          )}

          {/* Re-evaluate / version history */}
          {latest && latest.status !== 'running' && (
            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <button
                type="button"
                onClick={handleEvaluate}
                disabled={isRunning}
                className="flex items-center gap-1.5 text-xs font-500"
                style={{ color: 'var(--accent)', opacity: isRunning ? 0.5 : 1 }}
              >
                <RefreshCw size={12} />
                Re-evaluate (creates new version)
              </button>
              {allVersions.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowAllVersions((v) => !v)}
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: 'var(--subtle)' }}
                >
                  <History size={12} />
                  {allVersions.length} versions
                </button>
              )}
            </div>
          )}

          {/* Version history list */}
          {showAllVersions && allVersions.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-600" style={{ color: 'var(--subtle)', letterSpacing: '0.05em' }}>
                EVALUATION HISTORY
              </p>
              {allVersions.map((ev) => (
                <div
                  key={ev.evaluationId}
                  className="flex items-center justify-between rounded-xl border px-4 py-3"
                  style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}
                >
                  <div>
                    <span className="text-xs font-600" style={{ color: 'var(--ink)' }}>v{ev.version}</span>
                    <span className="text-xs ml-2" style={{ color: 'var(--subtle)' }}>
                      {ev.completedAt ? formatDate(ev.completedAt) : 'Not completed'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {ev.status === 'complete' && ev.recommendation && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-500"
                        style={{
                          background: recommendationConfig(ev.recommendation).bg,
                          color: recommendationConfig(ev.recommendation).color,
                        }}
                      >
                        {recommendationConfig(ev.recommendation).label}
                      </span>
                    )}
                    {ev.status === 'failed' && (
                      <span className="text-xs" style={{ color: 'var(--danger)' }}>Failed</span>
                    )}
                    {ev.humanDecision && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-500"
                        style={{ background: 'rgba(26,46,74,0.06)', color: 'var(--muted)' }}
                      >
                        {ev.humanDecision === 'approved' ? '✓ Noted' : ev.humanDecision}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Loading spinner for re-evaluate while previous result visible */}
          {isRunning && latest?.status !== 'running' && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
              <Loader2 size={12} className="animate-spin" />
              New evaluation running…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
