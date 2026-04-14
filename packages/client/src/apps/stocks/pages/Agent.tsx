import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Loader2, Wrench, AlertCircle, Sparkles } from 'lucide-react';
import { useStocksTheme } from '../useStocksTheme';
import { streamAgentChat } from '../api';
import type { AgentMessage } from '@networth/shared';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ToolStatus {
  id: string;
  tool: string;
}

const STARTERS = [
  "What's AAPL's current price and key metrics?",
  'Compare MSFT and GOOGL fundamentals',
  'Show RSI and MACD for NVDA',
  "What's the news sentiment on TSLA?",
  'Give me a company overview for AMZN',
  'What are the 50-day and 200-day moving averages for SPY?',
];

let msgId = 0;
function nextId() {
  return `msg-${++msgId}`;
}

export default function Agent() {
  const { themeClassName } = useStocksTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, toolCalls]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setError(null);
      setToolCalls([]);

      const userMsg: ChatMessage = { id: nextId(), role: 'user', content: trimmed };
      const assistantMsg: ChatMessage = { id: nextId(), role: 'assistant', content: '' };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setIsStreaming(true);

      const assistantId = assistantMsg.id;

      // Build history for API (exclude in-progress empty assistant)
      const apiMessages: AgentMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: trimmed },
      ];

      const controller = new AbortController();
      abortRef.current = controller;

      await streamAgentChat(
        apiMessages,
        {
          onToken: (content) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + content } : m))
            );
          },
          onStatus: (status) => {
            if (status.type === 'tool_call' && status.tool) {
              setToolCalls((prev) => [...prev, { id: nextId(), tool: status.tool! }]);
            }
          },
          onError: (message) => {
            setError(message);
          },
          onDone: () => {
            setIsStreaming(false);
            setToolCalls([]);
            abortRef.current = null;
            // Remove empty assistant messages
            setMessages((prev) => prev.filter((m) => m.role !== 'assistant' || m.content.length > 0));
          },
        },
        controller.signal
      );
    },
    [messages, isStreaming]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className={`stocks-agent ${themeClassName}`}>
      {/* Header */}
      <div className="stocks-agent-header">
        <div className="flex items-center gap-3">
          <div className="stocks-agent-avatar">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--stocks-text-strong)]">Stock Research Agent</h1>
            <p className="text-xs text-[var(--stocks-text-muted)]">
              Powered by Alpha Vantage &middot; Ask about prices, fundamentals, technicals, or news
            </p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="stocks-agent-messages">
        <AnimatePresence initial={false}>
          {isEmpty && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="stocks-agent-welcome"
            >
              <Sparkles className="w-10 h-10 text-[var(--stocks-accent)] mb-4" />
              <h2 className="text-xl font-semibold text-[var(--stocks-text-strong)] mb-2">
                What would you like to research?
              </h2>
              <p className="text-sm text-[var(--stocks-text-muted)] mb-6 max-w-md">
                I can look up real-time prices, company fundamentals, technical indicators, earnings data, and news
                sentiment for any stock.
              </p>
              <div className="stocks-agent-starters">
                {STARTERS.map((s) => (
                  <button key={s} className="stocks-agent-starter" onClick={() => sendMessage(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`stocks-agent-msg ${msg.role === 'user' ? 'stocks-agent-msg-user' : 'stocks-agent-msg-assistant'}`}
            >
              {msg.role === 'assistant' && (
                <div className="stocks-agent-msg-icon">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div className={`stocks-agent-bubble ${msg.role === 'user' ? 'stocks-agent-bubble-user' : 'stocks-agent-bubble-assistant'}`}>
                {msg.role === 'user' && msg.content}
                {msg.role === 'assistant' && !msg.content && isStreaming && (
                  <span className="stocks-agent-typing">
                    <span /><span /><span />
                  </span>
                )}
                {msg.role === 'assistant' && msg.content && (
                  <div className="stocks-agent-prose" dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Tool call indicators */}
        <AnimatePresence>
          {toolCalls.map((tc) => (
            <motion.div
              key={tc.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="stocks-agent-tool"
            >
              <Wrench className="w-3.5 h-3.5 text-[var(--stocks-accent)]" />
              <span className="text-xs text-[var(--stocks-text-muted)]">
                Calling <code>{tc.tool}</code>…
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="stocks-agent-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="stocks-agent-input-bar">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about any stock…"
          rows={1}
          className="stocks-agent-input"
          disabled={isStreaming}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="stocks-agent-send"
          title="Send"
        >
          {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}

/** Minimal formatting: newlines → <br>, **bold**, `code` */
function formatContent(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');
}
