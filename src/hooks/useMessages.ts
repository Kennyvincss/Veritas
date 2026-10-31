import { useState, useEffect, useCallback, useRef } from 'react'

const AI_BASE = import.meta.env.VITE_AI_SERVER_URL as string | undefined

function apiBase(): string {
  return AI_BASE ? AI_BASE.replace(/\/$/, '') : ''
}

export interface ChatMessage {
  id: string
  fromAddress: string
  toAddress: string
  text: string
  createdAt: number
  read: boolean
}

export interface Conversation {
  partnerAddress: string
  lastMessage: ChatMessage
  unreadCount: number
}

export function useMessages(myAddress: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchConversations = useCallback(async () => {
    if (!myAddress) return
    try {
      const res = await fetch(`${apiBase()}/api/messages?myAddress=${encodeURIComponent(myAddress)}`)
      if (!res.ok) return
      const data = await res.json() as { ok: boolean; conversations: Conversation[] }
      if (data.ok) setConversations(data.conversations)
    } catch { /* network error */ }
  }, [myAddress])

  useEffect(() => {
    const run = () => { void fetchConversations() }
    run()
    pollRef.current = setInterval(run, 5_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchConversations])

  return { conversations, refresh: fetchConversations }
}

export function useConversation(myAddress: string | undefined, partnerAddress: string | undefined) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchMsgs = useCallback(async () => {
    if (!myAddress || !partnerAddress) return
    try {
      const res = await fetch(`${apiBase()}/api/messages?between=${encodeURIComponent(myAddress)},${encodeURIComponent(partnerAddress)}`)
      if (!res.ok) return
      const data = await res.json() as { ok: boolean; messages: ChatMessage[] }
      if (data.ok) setMsgs(data.messages)
    } catch { /* network error */ }
  }, [myAddress, partnerAddress])

  useEffect(() => {
    const run = () => { void fetchMsgs() }
    run()
    pollRef.current = setInterval(run, 3_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchMsgs])

  const send = useCallback(async (text: string): Promise<boolean> => {
    if (!myAddress || !partnerAddress || !text.trim()) return false
    try {
      const res = await fetch(`${apiBase()}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAddress: myAddress, toAddress: partnerAddress, text: text.trim() }),
      })
      if (!res.ok) return false
      void fetchMsgs()
      return true
    } catch { return false }
  }, [myAddress, partnerAddress, fetchMsgs])

  const markRead = useCallback(async () => {
    if (!myAddress || !partnerAddress) return
    try {
      await fetch(`${apiBase()}/api/messages/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ myAddress, partnerAddress }),
      })
    } catch { /* ignore */ }
  }, [myAddress, partnerAddress])

  return { messages: msgs, send, markRead, refresh: fetchMsgs }
}
