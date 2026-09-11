import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { ChatMessage } from '../api'

const EXAMPLE_QUESTIONS = [
  'Bu gün ən yüksək riskli alert hansıdır?',
  'Neçə pending approval var?',
]

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[85%] rounded-lg px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap"
        style={isUser
          ? { background: '#00d4ff20', color: 'var(--color-text-primary)', border: '1px solid #00d4ff40' }
          : { background: 'var(--color-surface-2)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
      >
        {msg.content}
      </div>
    </div>
  )
}

export default function AssistantWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, open])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setError('')
    const history = messages
    const nextMessages: ChatMessage[] = [...history, { role: 'user', content: trimmed }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    try {
      const { reply } = await api.chatWithAssistant(trimmed, history)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setError('AI assistant is unreachable right now — try again in a moment.')
      setMessages(prev => prev.slice(0, -1)) // drop the optimistic user message that got no reply
      setInput(trimmed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-40 w-13 h-13 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
        style={{
          width: 52, height: 52,
          background: open ? 'var(--color-surface-2)' : '#00d4ff',
          border: open ? '1px solid var(--color-border-bright)' : 'none',
          boxShadow: open ? 'none' : '0 4px 20px -4px #00d4ff80',
        }}
        title="AI Assistant"
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--color-text-primary)" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l10 10M14 4L4 14" /></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#04070f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10c0-3.87 3.58-7 8-7s8 3.13 8 7-3.58 7-8 7c-1 0-1.96-.15-2.83-.44L4 18l1.3-3.9C3.87 12.9 3 11.52 3 10z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-[84px] right-5 z-40 w-[360px] max-w-[calc(100vw-2.5rem)] h-[480px] max-h-[70vh] rounded-lg border flex flex-col overflow-hidden"
          style={{ background: 'var(--color-background)', borderColor: 'var(--color-border-bright)', boxShadow: '0 20px 60px -15px rgba(0,0,0,0.6)' }}
        >
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
            <span className="w-2 h-2 rounded-full bg-[#00d4ff]" />
            <span className="text-xs font-semibold text-[var(--color-text-primary)]">AI Assistant</span>
            <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">Groq · live data</span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-[var(--color-text-muted)] px-1">
                  Ask about current alerts, cases, or pending approvals. Try:
                </p>
                {EXAMPLE_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="block w-full text-left text-[12px] px-3 py-2 rounded-lg border transition-colors hover:border-[#00d4ff40] hover:text-[#00d4ff]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => <Bubble key={i} msg={m} />)}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg px-3 py-2 text-[12px] text-[var(--color-text-muted)]" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                  Thinking…
                </div>
              </div>
            )}
            {error && <div className="text-[11px] text-[#ef4444] px-1">{error}</div>}
          </div>

          <div className="p-2.5 border-t flex items-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(input) }}
              placeholder="Ask about alerts, cases…"
              disabled={loading}
              className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[#00d4ff40] disabled:opacity-60"
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="px-3 py-2 rounded-lg bg-[#00d4ff15] border border-[#00d4ff40] text-[#00d4ff] text-[11px] font-semibold hover:bg-[#00d4ff25] transition-colors disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  )
}
