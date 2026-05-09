'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type Role = 'user' | 'assistant';

type ChatMessage = {
  role: Role;
  content: string;
};

const MODEL = 'gpt-5.4-mini';

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const appendToLastAssistant = (delta: string) => {
    setMessages((prev) => {
      const next = [...prev];
      const lastIndex = next.length - 1;

      if (lastIndex >= 0 && next[lastIndex].role === 'assistant') {
        next[lastIndex] = {
          ...next[lastIndex],
          content: next[lastIndex].content + delta,
        };
      } else {
        next.push({ role: 'assistant', content: delta });
      }

      return next;
    });
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    const prompt = input.trim();
    if (!prompt) return;

    setInput('');
    setError('');
    setLoading(true);

    // 先把用户消息和一个空的 assistant 占位消息放进去
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: prompt },
      { role: 'assistant', content: '' },
    ]);

    try {
      // 这里走 next.config.js 里的 rewrite：
      // /api/chat/completions  ->  你的 FastAPI /v1/chat/completions
      // 如果你不想走 rewrite，也可以改成你的后端完整地址。
      const response = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `请求失败：${response.status}`);
      }

      if (!response.body) {
        throw new Error('当前浏览器不支持流式响应');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // OpenAI 风格 SSE：事件之间通常用 \n\n 分隔
        let boundaryIndex = buffer.indexOf('\n\n');
        while (boundaryIndex !== -1) {
          const rawEvent = buffer.slice(0, boundaryIndex).trim();
          buffer = buffer.slice(boundaryIndex + 2);
          boundaryIndex = buffer.indexOf('\n\n');

          if (!rawEvent) continue;

          const lines = rawEvent.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const data = trimmed.slice(5).trim();
            if (!data) continue;

            if (data === '[DONE]') {
              return;
            }

            try {
              const json = JSON.parse(data);
              const token =
                json?.choices?.[0]?.delta?.content ??
                json?.choices?.[0]?.message?.content ??
                '';

              if (token) {
                appendToLastAssistant(token);
              }
            } catch {
              // 如果上游不是严格 JSON，也做兜底显示
              appendToLastAssistant(data);
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '发生未知错误';
      setError(message);

      setMessages((prev) => {
        const next = [...prev];
        const lastIndex = next.length - 1;

        if (lastIndex >= 0 && next[lastIndex].role === 'assistant') {
          next[lastIndex] = {
            role: 'assistant',
            content: `出错了：${message}`,
          };
        } else {
          next.push({ role: 'assistant', content: `出错了：${message}` });
        }

        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-lg font-semibold">AI Chat</h1>
          <span className="text-xs text-zinc-400">Stream Demo</span>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-zinc-400">
              输入一条消息开始对话。
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-100'
                  }`}
                >
                  {msg.content || (msg.role === 'assistant' && loading ? '...' : '')}
                </div>
              </div>
            ))
          )}

          <div ref={bottomRef} />
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="border-t border-zinc-800 bg-zinc-900/80 p-4 backdrop-blur"
      >
        <div className="mx-auto flex max-w-3xl gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的问题..."
            className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-indigo-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
          >
            {loading ? '发送中...' : '发送'}
          </button>
        </div>

        {error ? (
          <div className="mx-auto mt-3 max-w-3xl text-sm text-red-400">
            {error}
          </div>
        ) : null}
      </form>
    </main>
  );
}