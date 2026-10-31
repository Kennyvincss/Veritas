/**
 * MessagesPage — real-time chat between creators and freelancers.
 * Polls every 3 s. Shows conversation list on the left, thread on the right.
 * Custom order offers can be sent inline from the thread.
 */
import { useState, useEffect, useRef } from 'react'
import { Send, MessageSquare, ArrowLeft, Package, Loader2, CheckCheck } from 'lucide-react'
import { useMessages, useConversation } from '@/hooks/useMessages'
import { useOrders } from '@/hooks/useOrders'
import { formatAddress } from '@/lib/utils'

interface MessagesPageProps {
  myAddress: string | undefined
  initialPartner?: string
  role?: 'creator' | 'freelancer' | null
  onNavigate: (v: string) => void
}

function formatRelTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ts).toLocaleDateString()
}

function RelTime({ ts }: { ts: number }) {
  const [label, setLabel] = useState(() => formatRelTime(ts))
  useEffect(() => {
    const t = setInterval(() => setLabel(formatRelTime(ts)), 30_000)
    return () => clearInterval(t)
  }, [ts])
  return <span>{label}</span>
}

// ── Inline custom offer form ────────────────────────────────────────────────
function InlineOfferForm({
  partnerAddress,
  onSend,
  onCancel,
}: {
  myAddress?: string
  partnerAddress: string
  role?: 'creator' | 'freelancer' | null
  onSend: (params: { title: string; description: string; price: number; days: number }) => Promise<boolean>
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [price, setPrice] = useState('')
  const [days, setDays] = useState('')
  const [err, setErr] = useState('')
  const [sending, setSending] = useState(false)

  function handleSend(e: React.FormEvent): void {
    e.preventDefault()
    const p = parseFloat(price)
    const d = parseInt(days, 10)
    if (!title.trim()) { setErr('Title is required.'); return }
    if (!desc.trim()) { setErr('Description is required.'); return }
    if (isNaN(p) || p <= 0) { setErr('Enter a valid price.'); return }
    if (isNaN(d) || d < 1) { setErr('Enter valid delivery days.'); return }
    setSending(true)
    void onSend({ title: title.trim(), description: desc.trim(), price: p, days: d }).then((ok) => {
      setSending(false)
      if (!ok) setErr('Failed to send offer. Try again.')
    })
  }

  return (
    <form onSubmit={handleSend} className="border rounded-2xl p-4 mb-2"
      style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}>
      <p className="text-xs font-700 mb-3" style={{ color: 'var(--ink)' }}>
        Custom offer to {formatAddress(partnerAddress)}
      </p>
      {err && <p className="text-xs mb-2" style={{ color: 'var(--danger)' }}>{err}</p>}
      <div className="flex flex-col gap-2">
        <input type="text" placeholder="Service title" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))}
          className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }} />
        <textarea rows={2} placeholder="What you'll deliver…" value={desc} onChange={(e) => setDesc(e.target.value.slice(0, 600))}
          className="w-full px-3 py-2 rounded-xl text-xs border outline-none resize-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }} />
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs font-600 block mb-1" style={{ color: 'var(--subtle)' }}>PRICE (USDC)</label>
            <input type="number" min="1" step="0.01" placeholder="50" value={price} onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }} />
          </div>
          <div className="flex-1">
            <label className="text-xs font-600 block mb-1" style={{ color: 'var(--subtle)' }}>DAYS</label>
            <input type="number" min="1" max="365" placeholder="7" value={days} onChange={(e) => setDays(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }} />
          </div>
        </div>
        <div className="flex gap-2 mt-1">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-xs font-600 border"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'transparent' }}>
            Cancel
          </button>
          <button type="submit" disabled={sending}
            className="flex-1 py-2 rounded-xl text-xs font-600 flex items-center justify-center gap-1.5"
            style={{ background: 'var(--cta)', color: '#fff' }}>
            {sending ? <Loader2 size={12} className="animate-spin" /> : <><Package size={12} /> Send Offer</>}
          </button>
        </div>
      </div>
    </form>
  )
}

// ── Thread view ────────────────────────────────────────────────────────────
function Thread({
  myAddress,
  partnerAddress,
  role,
  onBack,
}: {
  myAddress: string
  partnerAddress: string
  role: 'creator' | 'freelancer' | null | undefined
  onBack: () => void
}) {
  const { messages, send, markRead } = useConversation(myAddress, partnerAddress)
  const { placeOrder } = useOrders(myAddress)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showOfferForm, setShowOfferForm] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void markRead()
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, markRead])

  function handleSend(e: React.FormEvent): void {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    void send(text.trim()).then(() => { setText(''); setSending(false) })
  }

  async function handleSendOffer(params: { title: string; description: string; price: number; days: number }) {
    const isFreelancer = role === 'freelancer'
    const result = await placeOrder({
      gigTitle: params.title,
      description: params.description,
      price: params.price,
      deliveryDays: params.days,
      creatorAddress: isFreelancer ? partnerAddress : myAddress,
      freelancerAddress: isFreelancer ? myAddress : partnerAddress,
      offerOrigin: isFreelancer ? 'freelancer' : 'creator',
      autoStart: false,
    })
    if (result.ok) {
      await send(`📦 Sent you a custom offer: "${params.title}" — $${params.price} USDC / ${params.days}d. Check your Orders tab.`)
      setShowOfferForm(false)
      return true
    }
    return false
  }

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <button onClick={onBack} className="md:hidden p-1 rounded-lg" style={{ color: 'var(--subtle)' }}>
          <ArrowLeft size={18} />
        </button>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-700 shrink-0"
          style={{ background: 'var(--cta)', color: '#fff' }}
        >
          {partnerAddress.slice(2, 3).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-600 truncate" style={{ color: 'var(--ink)' }}>{formatAddress(partnerAddress)}</p>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>{role === 'creator' ? 'Freelancer' : 'Creator'}</p>
        </div>
        <button
          onClick={() => setShowOfferForm(!showOfferForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600 border"
          style={{
            borderColor: showOfferForm ? 'var(--cta)' : 'var(--border)',
            color: showOfferForm ? 'var(--cta)' : 'var(--muted)',
            background: 'transparent',
          }}
        >
          <Package size={12} /> Custom Offer
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare size={24} className="mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
            <p className="text-sm" style={{ color: 'var(--muted)' }}>No messages yet. Say hello!</p>
          </div>
        )}
        {messages.map((m) => {
          const isMine = m.fromAddress.toLowerCase() === myAddress.toLowerCase()
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-xs rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                style={{
                  background: isMine ? 'var(--cta)' : 'var(--surface-muted)',
                  color: isMine ? '#fff' : 'var(--ink)',
                  borderBottomRightRadius: isMine ? 4 : undefined,
                  borderBottomLeftRadius: isMine ? undefined : 4,
                }}
              >
                <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</p>
                <div className={`flex items-center gap-1 mt-1 text-xs ${isMine ? 'justify-end' : ''}`}
                  style={{ color: isMine ? 'rgba(255,255,255,0.6)' : 'var(--subtle)' }}>
                  <RelTime ts={m.createdAt} />
                  {isMine && <CheckCheck size={11} />}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Inline offer form */}
      {showOfferForm && (
        <div className="px-4 pb-2">
          <InlineOfferForm
            myAddress={myAddress}
            partnerAddress={partnerAddress}
            role={role}
            onSend={handleSendOffer}
            onCancel={() => setShowOfferForm(false)}
          />
        </div>
      )}

      {/* Compose bar */}
      <form onSubmit={handleSend}
        className="flex items-end gap-2 px-4 py-3 border-t shrink-0"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <textarea
          rows={1}
          placeholder="Type a message…"
          value={text}
          onChange={(e) => {
            setText(e.target.value.slice(0, 2000))
            e.currentTarget.style.height = 'auto'
            e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 120)}px`
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(e) }
          }}
          className="flex-1 px-3 py-2.5 rounded-xl text-sm border outline-none resize-none overflow-hidden"
          style={{
            background: 'var(--surface-muted)',
            borderColor: 'var(--border)',
            color: 'var(--ink)',
            minHeight: 40,
            maxHeight: 120,
          }}
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-opacity"
          style={{
            background: text.trim() ? 'var(--cta)' : 'var(--surface-muted)',
            color: text.trim() ? '#fff' : 'var(--subtle)',
          }}
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </form>
    </div>
  )
}

// ── Conversation list ──────────────────────────────────────────────────────
function ConvoList({
  myAddress,
  activePartner,
  onSelect,
}: {
  myAddress: string
  activePartner: string | null
  onSelect: (addr: string) => void
}) {
  const { conversations } = useMessages(myAddress)
  const [newAddr, setNewAddr] = useState('')
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b shrink-0 flex items-center justify-between"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h2 className="font-700 text-base" style={{ color: 'var(--ink)' }}>Messages</h2>
        <button
          onClick={() => setShowNew(!showNew)}
          className="text-xs font-600 px-3 py-1.5 rounded-xl"
          style={{ background: 'var(--cta-soft)', color: 'var(--cta)' }}
        >+ New</button>
      </div>

      {showNew && (
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)' }}>
          <input
            type="text"
            placeholder="Paste wallet address 0x…"
            value={newAddr}
            onChange={(e) => setNewAddr(e.target.value.trim())}
            className="w-full px-3 py-2 rounded-xl text-xs border outline-none font-mono"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newAddr.startsWith('0x') && newAddr.length >= 10) {
                onSelect(newAddr); setNewAddr(''); setShowNew(false)
              }
            }}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>Press Enter to open conversation.</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <div className="text-center py-12 px-4">
            <MessageSquare size={22} className="mx-auto mb-2" style={{ color: 'var(--subtle)' }} />
            <p className="text-xs" style={{ color: 'var(--muted)' }}>No conversations yet.<br />Click + New to start one.</p>
          </div>
        )}
        {conversations.map((c) => (
          <button
            key={c.partnerAddress}
            onClick={() => onSelect(c.partnerAddress)}
            className="w-full text-left px-4 py-3 border-b flex items-center gap-3 transition-colors"
            style={{
              borderColor: 'var(--border)',
              background: activePartner === c.partnerAddress ? 'var(--surface-muted)' : 'transparent',
            }}
            onMouseEnter={(e) => { if (activePartner !== c.partnerAddress) e.currentTarget.style.background = 'var(--surface-muted)' }}
            onMouseLeave={(e) => { if (activePartner !== c.partnerAddress) e.currentTarget.style.background = 'transparent' }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-700 shrink-0"
              style={{ background: 'var(--cta)', color: '#fff' }}
            >
              {c.partnerAddress.slice(2, 3).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm font-600 truncate" style={{ color: 'var(--ink)' }}>
                  {formatAddress(c.partnerAddress)}
                </span>
                <span className="text-xs shrink-0 ml-2" style={{ color: 'var(--subtle)' }}>
                  <RelTime ts={c.lastMessage.createdAt} />
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                  {c.lastMessage.fromAddress.toLowerCase() === myAddress.toLowerCase() ? 'You: ' : ''}
                  {c.lastMessage.text}
                </span>
                {c.unreadCount > 0 && (
                  <span
                    className="ml-2 text-xs font-700 px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ background: 'var(--cta)', color: '#fff' }}
                  >
                    {c.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Root ────────────────────────────────────────────────────────────────────
export function MessagesPage({ myAddress, initialPartner, role, onNavigate: _onNavigate }: MessagesPageProps) {
  const [activePartner, setActivePartner] = useState<string | null>(initialPartner ?? null)

  if (!myAddress) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <MessageSquare size={32} className="mx-auto mb-4" style={{ color: 'var(--subtle)' }} />
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Sign in to view your messages.</p>
      </div>
    )
  }

  return (
    <div
      className="flex overflow-hidden"
      style={{
        height: 'calc(100dvh - 60px)',
        background: 'var(--bg-gradient)',
      }}
    >
      {/* Sidebar: conversation list — hidden on mobile when a thread is open */}
      <div
        className={`${activePartner ? 'hidden md:flex' : 'flex'} flex-col border-r shrink-0`}
        style={{
          width: '100%',
          maxWidth: 320,
          borderColor: 'var(--border)',
          background: 'var(--surface)',
        }}
      >
        <ConvoList myAddress={myAddress} activePartner={activePartner} onSelect={setActivePartner} />
      </div>

      {/* Thread — takes remaining width */}
      <div className={`${activePartner ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
        {activePartner ? (
          <Thread
            myAddress={myAddress}
            partnerAddress={activePartner}
            role={role}
            onBack={() => setActivePartner(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <MessageSquare size={32} style={{ color: 'var(--subtle)' }} />
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Select a conversation to start messaging.</p>
          </div>
        )}
      </div>
    </div>
  )
}
