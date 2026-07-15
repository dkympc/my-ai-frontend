// components/agent-cs/AgentCustomerService.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, AlertTriangle, Loader2, RefreshCw, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

// Agent 客服平台消息类型
interface AgentMessage {
  role: 'user' | 'assistant' | 'diversion' | 'system';
  content: string;
  time?: number;
}

// agent-service 的 API 基础路径（通过 Next.js rewrites 代理到 8001 端口）
const AGENT_API = '/agent-api';

// 管理员 Key（从环境变量读取，或使用默认值）
const ADMIN_KEY = process.env.NEXT_PUBLIC_AGENT_ADMIN_KEY || 'agent-admin-change-me-in-production';

export default function AgentCustomerService() {
  const { activeView, setToastMsg } = useAppStore();
  const [tenantId, setTenantId] = useState('');
  const [tenants, setTenants] = useState<{ id: string; name: string; api_key: string }[]>([]);
  const [externalUserId, setExternalUserId] = useState('test_user_' + Date.now());
  const [channel, setChannel] = useState('api');
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [tenantError, setTenantError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 加载租户列表
  useEffect(() => {
    if (activeView !== 'agent-customer-service') return;
    fetchTenants();
  }, [activeView]);

  async function fetchTenants() {
    setIsLoadingTenants(true);
    setTenantError('');
    try {
      const res = await fetch(`${AGENT_API}/tenants?size=50`, {
        headers: { 'X-Admin-Key': ADMIN_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = data.items || data;
      if (Array.isArray(list)) {
        setTenants(list);
        if (list.length > 0) setTenantId(list[0].id);
      }
    } catch {
      setTenantError('无法连接到 Agent 客服服务（请确认 agent-service 已启动于 8001 端口）');
    } finally {
      setIsLoadingTenants(false);
    }
  }

  async function createSession() {
    if (!tenantId) return;
    setIsCreatingSession(true);
    try {
      const res = await fetch(`${AGENT_API}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY },
        body: JSON.stringify({
          tenant_id: tenantId,
          external_user_id: externalUserId,
          channel: channel,
        }),
      });
      const data = await res.json();
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
        setMessages([]);
      } else {
        setToastMsg?.('创建会话失败：' + (data.detail || '未知错误'));
      }
    } catch {
      setToastMsg?.('创建会话失败，请检查网络');
    } finally {
      setIsCreatingSession(false);
    }
  }

  async function sendMessage() {
    const msg = input.trim();
    if (!msg || !conversationId) return;
    setInput('');

    const userMsg: AgentMessage = { role: 'user', content: msg, time: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch(`${AGENT_API}/conversations/${conversationId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();

      const assistantMsg: AgentMessage = { role: 'assistant', content: data.reply || '无回复', time: Date.now() };
      const newMsgs = [assistantMsg];

      if (data.diversion_triggered && data.diversion_message) {
        newMsgs.push({
          role: 'diversion',
          content: '[引流触发] ' + data.diversion_message,
          time: Date.now(),
        });
      }

      setMessages(prev => [...prev, ...newMsgs]);
    } catch {
      setMessages(prev => [...prev, { role: 'system', content: '消息发送失败，请重试', time: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (activeView !== 'agent-customer-service') return null;

  return (
    <div className="flex flex-col h-full">
      {/* 顶部配置栏 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-black/20 shrink-0">
        <Bot size={18} className="text-indigo-400" />
        <span className="text-sm font-semibold text-white tracking-wide">Agent 智能客服</span>

        <div className="flex items-center gap-2 ml-auto">
          {isLoadingTenants ? (
            <div className="flex items-center gap-2 text-zinc-500 text-xs">
              <Loader2 size={14} className="animate-spin" />
              加载租户...
            </div>
          ) : tenantError ? (
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-xs">{tenantError}</span>
              <button onClick={fetchTenants} className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-2 py-1 rounded text-xs">
                重试
              </button>
            </div>
          ) : (
            <select
              value={tenantId}
              onChange={e => setTenantId(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none"
            >
              {tenants.map(t => (
                <option key={t.id} value={t.id} className="bg-zinc-900">{t.name}</option>
              ))}
            </select>
          )}

          <select
            value={channel}
            onChange={e => setChannel(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-300 outline-none"
          >
            <option value="api" className="bg-zinc-900">API</option>
            <option value="wechat" className="bg-zinc-900">微信</option>
            <option value="douyin" className="bg-zinc-900">抖音</option>
            <option value="webhook" className="bg-zinc-900">Webhook</option>
          </select>

          <input
            value={externalUserId}
            onChange={e => setExternalUserId(e.target.value)}
            placeholder="用户ID"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none w-32"
          />

          <button
            onClick={createSession}
            disabled={isCreatingSession || !tenantId}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs text-white font-medium transition-colors"
          >
            {isCreatingSession ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            创建会话
          </button>
        </div>
      </div>

      {/* 对话展示区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600">
            <Bot size={48} className="mb-3 opacity-30" />
            <p className="text-sm">{conversationId ? '开始对话吧' : '请先创建会话'}</p>
            {conversationId && (
              <p className="text-xs mt-1 text-zinc-700">会话ID: {conversationId.slice(0, 8)}...</p>
            )}
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const isDiversion = msg.role === 'diversion';
          const isSystem = msg.role === 'system';

          return (
            <div key={i} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                isUser ? 'bg-indigo-500/20 text-indigo-300' :
                isDiversion ? 'bg-amber-500/20 text-amber-400' :
                isSystem ? 'bg-red-500/20 text-red-400' :
                'bg-emerald-500/20 text-emerald-300'
              }`}>
                {isUser ? <User size={14} /> :
                 isDiversion ? <AlertTriangle size={14} /> :
                 isSystem ? <X size={14} /> :
                 <Bot size={14} />}
              </div>

              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                isUser ? 'bg-indigo-500/15 text-zinc-200 rounded-tr-sm' :
                isDiversion ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-tl-sm' :
                isSystem ? 'bg-red-500/10 text-red-300 rounded-tl-sm' :
                'bg-white/5 text-zinc-200 rounded-tl-sm'
              }`}>
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                {msg.time && (
                  <div className="text-[10px] text-zinc-600 mt-1">
                    {new Date(msg.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Bot size={14} className="text-emerald-300" />
            </div>
            <div className="bg-white/5 rounded-2xl rounded-tl-sm px-4 py-2.5">
              <Loader2 size={16} className="animate-spin text-zinc-500" />
            </div>
          </div>
        )}
      </div>

      {/* 底部输入区 */}
      <div className="border-t border-white/5 bg-black/20 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={conversationId ? '输入消息，按回车发送...' : '请先创建会话'}
            disabled={!conversationId || isLoading}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/30 disabled:opacity-50 transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={!conversationId || !input.trim() || isLoading}
            className="w-10 h-10 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 rounded-xl flex items-center justify-center transition-colors shrink-0"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
