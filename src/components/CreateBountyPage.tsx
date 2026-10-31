import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle, Clock, ExternalLink, Loader2 } from 'lucide-react'
import { PrivyLoginButton } from '@/components/PrivyLoginButton'
import { TokenUSDC } from '@web3icons/react'
import { parseUnits } from 'viem'
import { useArcTestnet } from '@/hooks/useArcTestnet'
import { useCreateAndFundBounty, type CreateFundStep } from '@/hooks/useCreateAndFundBounty'
import { formatAddress, formatUsdcAmount } from '@/lib/utils'
import { ARC_TESTNET_CHAIN_ID, USDC_DECIMALS } from '@/contracts/VeritasEscrow'

interface CreateBountyPageProps {
  onNavigate: (view: string) => void
  onBountyCreated?: () => void
}

const MIN_REWARD_USDC = 1
const MAX_REWARD_USDC = 100_000
const MIN_TITLE_LEN = 5
const MAX_TITLE_LEN = 100
const MIN_DESC_LEN = 30
const MAX_DESC_LEN = 5_000

function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function stepLabel(step: CreateFundStep): string {
  switch (step) {
    case 'approving': return 'Confirm USDC approval in your wallet…'
    case 'approve_pending': return 'Approval confirming on-chain…'
    case 'creating': return 'Confirm job creation in your wallet…'
    case 'create_pending': return 'Bounty transaction confirming…'
    case 'funding': return 'Confirm escrow funding in your wallet…'
    case 'fund_pending': return 'Funding confirming on-chain…'
    default: return ''
  }
}

function StepRow({
  label,
  done,
  active,
}: {
  label: string
  done: boolean
  active: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-5 h-5 flex items-center justify-center shrink-0">
        {done ? (
          <CheckCircle size={18} style={{ color: 'var(--success)' }} />
        ) : active ? (
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
        ) : (
          <div
            className="w-4 h-4 rounded-full border"
            style={{ borderColor: 'var(--border)' }}
          />
        )}
      </div>
      <span
        className="text-sm"
        style={{ color: done ? 'var(--success)' : active ? 'var(--ink)' : 'var(--subtle)' }}
      >
        {label}
      </span>
    </div>
  )
}

export function CreateBountyPage({ onNavigate, onBountyCreated }: CreateBountyPageProps) {
  const { address, isConnected, isOnArc, isSwitching, switchToArc, usdcBalance } = useArcTestnet()
  const { execute, reset, isPending, state } = useCreateAndFundBounty()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [reward, setReward] = useState('')
  const [deadline, setDeadline] = useState(daysFromNow(14))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showConfirm, setShowConfirm] = useState(false)

  // Navigate to marketplace after success
  useEffect(() => {
    if (state.step === 'success') {
      toast.success('Bounty funded and live on Arc Testnet!')
      onBountyCreated?.()
      const t = setTimeout(() => onNavigate('marketplace'), 3000)
      return () => clearTimeout(t)
    }
  }, [state.step, onNavigate, onBountyCreated])

  function validate(): boolean {
    const e: Record<string, string> = {}
    const t = title.trim()
    if (!t) e.title = 'Title is required.'
    else if (t.length < MIN_TITLE_LEN) e.title = `Title must be at least ${MIN_TITLE_LEN} characters.`
    else if (t.length > MAX_TITLE_LEN) e.title = `Title must be ${MAX_TITLE_LEN} characters or fewer.`

    const d = description.trim()
    if (!d) e.description = 'Description is required.'
    else if (d.length < MIN_DESC_LEN) e.description = `Description must be at least ${MIN_DESC_LEN} characters.`
    else if (d.length > MAX_DESC_LEN) e.description = `Description must be ${MAX_DESC_LEN} characters or fewer.`

    const r = parseFloat(reward)
    if (!reward || isNaN(r)) e.reward = 'Enter a reward amount.'
    else if (r < MIN_REWARD_USDC) e.reward = `Minimum reward is ${MIN_REWARD_USDC} USDC.`
    else if (r > MAX_REWARD_USDC) e.reward = `Maximum reward is ${MAX_REWARD_USDC.toLocaleString()} USDC.`
    else {
      const rewardRaw = parseUnits(r.toFixed(6), USDC_DECIMALS)
      if (rewardRaw > usdcBalance)
        e.reward = `Insufficient USDC balance. Get test USDC from the sidebar.`
    }

    if (!deadline) e.deadline = 'Deadline is required.'
    else {
      const dl = new Date(deadline)
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      if (dl < tomorrow) e.deadline = 'Deadline must be at least tomorrow.'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setShowConfirm(true)
  }

  function handleConfirm() {
    const deadlineTs = Math.floor(new Date(deadline).getTime() / 1000)
    void execute({ title: title.trim(), description: description.trim(), rewardUsdc: reward, deadline: deadlineTs })
  }

  function handleBack() {
    setShowConfirm(false)
    reset()
  }

  const minDate = daysFromNow(1)
  const rewardNum = parseFloat(reward) || 0
  const rewardRaw = rewardNum > 0 ? parseUnits(rewardNum.toFixed(6), USDC_DECIMALS) : 0n

  // ── Success screen ────────────────────────────────────────────────────────
  if (state.step === 'success') {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <div
          className="rounded-2xl p-8 border text-center"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <CheckCircle size={48} className="mx-auto mb-4" style={{ color: 'var(--success)' }} />
          <h2
            className="display font-700 text-xl mb-2"
            style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
          >
            Bounty Live
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
            Your job is funded and visible in the marketplace.
            {state.bountyId != null && ` Job #${state.bountyId}`}
          </p>
          {state.fundTxHash && (
            <a
              href={`https://explorer.testnet.arc.io/tx/${state.fundTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs mb-6"
              style={{ color: 'var(--accent)' }}
            >
              <ExternalLink size={12} />
              View funding transaction
            </a>
          )}
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            Redirecting to marketplace…
          </p>
        </div>
      </div>
    )
  }

  // ── Confirm + transaction screen ──────────────────────────────────────────
  if (showConfirm) {
    const currentStep = state.step as CreateFundStep
    const approveStepDone =
      currentStep === 'creating' ||
      currentStep === 'create_pending' ||
      currentStep === 'funding' ||
      currentStep === 'fund_pending' ||
      currentStep === 'success'
    const approveStepActive = currentStep === 'approving' || currentStep === 'approve_pending'

    const createStepDone =
      currentStep === 'funding' ||
      currentStep === 'fund_pending' ||
      currentStep === 'success'
    const createStepActive = currentStep === 'creating' || currentStep === 'create_pending'

    const fundStepDone = currentStep === 'success'
    const fundStepActive = currentStep === 'funding' || currentStep === 'fund_pending'

    // Determine if approval step is needed
    const needsApproval = true // we'll always show it; the hook skips if not needed

    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1
          className="display font-700 text-2xl mb-6"
          style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
        >
          Confirm &amp; Fund
        </h1>

        {/* Details summary */}
        <div
          className="rounded-2xl border divide-y divide-white/10 mb-6"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="p-5">
            <p className="text-xs font-600 mb-1" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>
              TITLE
            </p>
            <p className="text-sm" style={{ color: 'var(--ink)' }}>
              {title}
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs font-600 mb-1" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>
              DESCRIPTION PREVIEW
            </p>
            <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--muted)' }}>
              {description}
            </p>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-600 mb-1" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>
                REWARD
              </p>
              <div className="flex items-center gap-1.5">
                <TokenUSDC variant="branded" size={16} />
                <span className="text-sm font-600 tabular-nums" style={{ color: 'var(--ink)' }}>
                  {formatUsdcAmount(rewardRaw, ARC_TESTNET_CHAIN_ID)}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs font-600 mb-1" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>
                DEADLINE
              </p>
              <div className="flex items-center gap-1.5">
                <Clock size={13} style={{ color: 'var(--subtle)' }} />
                <span className="text-sm" style={{ color: 'var(--ink)' }}>
                  {new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
          <div className="p-5">
            <p className="text-xs font-600 mb-1" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>
              FROM WALLET
            </p>
            <p className="text-xs mono" style={{ color: 'var(--muted)' }}>
              {address}
            </p>
          </div>
        </div>

        {/* Transaction steps */}
        <div
          className="rounded-2xl border p-5 mb-6 flex flex-col gap-4"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <p className="text-xs font-600" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>
            TRANSACTION STEPS
          </p>
          {needsApproval && (
            <StepRow
              label="1. Approve USDC transfer to escrow"
              done={approveStepDone}
              active={approveStepActive}
            />
          )}
          <StepRow
            label={`${needsApproval ? '2' : '1'}. Create job on-chain`}
            done={createStepDone}
            active={createStepActive}
          />
          <StepRow
            label={`${needsApproval ? '3' : '2'}. Fund escrow with USDC`}
            done={fundStepDone}
            active={fundStepActive}
          />
          {isPending && (
            <p className="text-xs" style={{ color: 'var(--accent)' }}>
              {stepLabel(currentStep)}
            </p>
          )}
          {currentStep === 'idle' && !isPending && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Your wallet will prompt you for each step.
            </p>
          )}
        </div>

        {/* Error */}
        {state.error && (
          <div
            className="flex items-start gap-2 p-4 rounded-xl border mb-4"
            style={{ background: 'rgba(232,109,122,0.08)', borderColor: 'rgba(192,54,77,0.22)' }}
          >
            <AlertCircle size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {state.error}
            </p>
          </div>
        )}

        {/* Tx hashes */}
        {state.approveTxHash && (
          <a
            href={`https://explorer.testnet.arc.io/tx/${state.approveTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs mb-2"
            style={{ color: 'var(--subtle)' }}
          >
            <ExternalLink size={11} />
            Approval tx: {state.approveTxHash.slice(0, 12)}…
          </a>
        )}
        {state.createTxHash && (
          <a
            href={`https://explorer.testnet.arc.io/tx/${state.createTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs mb-2"
            style={{ color: 'var(--subtle)' }}
          >
            <ExternalLink size={11} />
            Create tx: {state.createTxHash.slice(0, 12)}…
          </a>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleBack}
            disabled={isPending}
            className="flex-1 py-3 rounded-xl text-sm font-600 border transition-colors min-h-[44px]"
            style={{
              borderColor: 'var(--border)',
              color: isPending ? 'var(--subtle)' : 'var(--muted)',
              background: 'transparent',
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || currentStep !== 'idle'}
            className="flex-[2] py-3 rounded-xl text-sm font-600 flex items-center justify-center gap-2 transition-colors min-h-[44px]"
            style={{
              background: isPending || currentStep !== 'idle' ? 'var(--surface-muted)' : 'var(--accent)',
              color: isPending || currentStep !== 'idle' ? 'var(--subtle)' : 'var(--bg)',
              cursor: isPending || currentStep !== 'idle' ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending && <Loader2 size={15} className="animate-spin" />}
            {currentStep === 'idle' ? 'Start — Sign Transactions' : stepLabel(currentStep) || 'Processing…'}
          </button>
        </div>
      </div>
    )
  }

  // ── Form screen ───────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <h1
          className="display font-700 text-2xl mb-1"
          style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
        >
          Post a Job
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Describe the work, set a USDC reward, and fund the escrow.
        </p>
      </div>

      {/* Wallet gate */}
      {!isConnected && (
        <div
          className="flex items-start gap-3 p-4 rounded-xl border mb-6"
          style={{ background: 'rgba(172,198,233,0.07)', borderColor: 'rgba(172,198,233,0.3)' }}
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
          <div>
            <p className="text-sm font-600 mb-2" style={{ color: 'var(--accent)' }}>
              Wallet required
            </p>
            <PrivyLoginButton variant="light" />
          </div>
        </div>
      )}

      {/* Wrong network */}
      {isConnected && !isOnArc && (
        <div
          className="flex items-center justify-between gap-3 p-4 rounded-xl border mb-6"
          style={{ background: 'var(--danger-bg)', borderColor: 'rgba(192,54,77,0.22)' }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={15} style={{ color: 'var(--danger)' }} />
            <p className="text-sm font-600" style={{ color: 'var(--danger)' }}>
              Switch to Arc Testnet
            </p>
          </div>
          <button
            onClick={switchToArc}
            disabled={isSwitching}
            className="px-4 py-2 rounded-xl text-xs font-600 min-h-[36px]"
            style={{ background: 'var(--danger)', color: '#fff' }}
          >
            {isSwitching ? 'Switching…' : 'Switch Network'}
          </button>
        </div>
      )}

      {/* USDC balance */}
      {isConnected && isOnArc && (
        <div
          className="flex items-center gap-2 p-3 rounded-xl border mb-6"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <TokenUSDC variant="branded" size={16} />
          <span className="text-sm" style={{ color: 'var(--muted)' }}>
            Your USDC balance:{' '}
            <span className="font-600 tabular-nums" style={{ color: 'var(--ink)' }}>
              {formatUsdcAmount(usdcBalance, ARC_TESTNET_CHAIN_ID)}
            </span>
          </span>
          <span className="text-xs ml-auto" style={{ color: 'var(--subtle)' }}>
            Arc Testnet
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div
          className="rounded-2xl border divide-y divide-white/10"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {/* Title */}
          <div className="p-5">
            <label className="block text-xs font-600 mb-2" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>
              TITLE
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setErrors((x) => ({ ...x, title: '' })) }}
              placeholder="e.g. Build a USDC payment widget"
              maxLength={MAX_TITLE_LEN}
              className="w-full rounded-xl px-4 py-3 text-sm border outline-none"
              style={{
                background: 'var(--surface-muted)',
                borderColor: errors.title ? 'var(--danger)' : 'var(--border)',
                color: 'var(--ink)',
              }}
            />
            <div className="flex justify-between mt-1.5">
              {errors.title ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{errors.title}</p> : <span />}
              <p className="text-xs" style={{ color: 'var(--subtle)' }}>{title.length}/{MAX_TITLE_LEN}</p>
            </div>
          </div>

          {/* Description */}
          <div className="p-5">
            <label className="block text-xs font-600 mb-2" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>
              DESCRIPTION
            </label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setErrors((x) => ({ ...x, description: '' })) }}
              placeholder="Describe the work, requirements, and acceptance criteria."
              rows={5}
              maxLength={MAX_DESC_LEN}
              className="w-full rounded-xl px-4 py-3 text-sm border outline-none resize-none"
              style={{
                background: 'var(--surface-muted)',
                borderColor: errors.description ? 'var(--danger)' : 'var(--border)',
                color: 'var(--ink)',
              }}
            />
            <div className="flex justify-between mt-1.5">
              {errors.description ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{errors.description}</p> : <span />}
              <p className="text-xs" style={{ color: 'var(--subtle)' }}>{description.length}/{MAX_DESC_LEN}</p>
            </div>
          </div>

          {/* Reward + Deadline */}
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-600 mb-2" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>
                REWARD (USDC)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2">
                  <TokenUSDC variant="branded" size={16} />
                </span>
                <input
                  type="number"
                  value={reward}
                  onChange={(e) => { setReward(e.target.value); setErrors((x) => ({ ...x, reward: '' })) }}
                  placeholder="0.00"
                  min={MIN_REWARD_USDC}
                  max={MAX_REWARD_USDC}
                  step="1"
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm border outline-none tabular-nums"
                  style={{
                    background: 'var(--surface-muted)',
                    borderColor: errors.reward ? 'var(--danger)' : 'var(--border)',
                    color: 'var(--ink)',
                  }}
                />
              </div>
              {errors.reward && <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>{errors.reward}</p>}
            </div>

            <div>
              <label className="block text-xs font-600 mb-2" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>
                DEADLINE
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => { setDeadline(e.target.value); setErrors((x) => ({ ...x, deadline: '' })) }}
                min={minDate}
                className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                style={{
                  background: 'var(--surface-muted)',
                  borderColor: errors.deadline ? 'var(--danger)' : 'var(--border)',
                  color: 'var(--ink)',
                  colorScheme: 'dark',
                }}
              />
              {errors.deadline && <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>{errors.deadline}</p>}
            </div>
          </div>

          {/* Submit */}
          <div className="p-5">
            <button
              type="submit"
              disabled={!isConnected || !isOnArc}
              className="w-full py-3.5 rounded-xl text-sm font-600 transition-colors min-h-[44px]"
              style={{
                background: isConnected && isOnArc ? 'var(--accent)' : 'var(--surface-muted)',
                color: isConnected && isOnArc ? 'var(--bg)' : 'var(--subtle)',
                cursor: isConnected && isOnArc ? 'pointer' : 'not-allowed',
              }}
            >
              {!isConnected
                ? 'Connect Wallet to Continue'
                : !isOnArc
                  ? 'Switch to Arc Testnet'
                  : 'Review & Fund Escrow'}
            </button>
            {isConnected && isOnArc && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--subtle)' }}>
                You will approve a USDC transfer, then sign two more transactions.
              </p>
            )}
          </div>
        </div>
      </form>

      {/* Creator info */}
      {isConnected && (
        <p className="text-xs mt-4 text-center" style={{ color: 'var(--subtle)' }}>
          Creating as{' '}
          <span className="mono" style={{ color: 'var(--muted)' }}>
            {formatAddress(address ?? '')}
          </span>
        </p>
      )}
    </div>
  )
}
