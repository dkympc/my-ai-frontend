// components/video-canvas/SelectionAssist.tsx
// ★★★ 全局文字选中 AI 助手 — 改写模式 + 对话模式 ★★★

"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Wand2, X, Loader2, Check, MessageSquare, Send } from 'lucide-react';

interface SelectionInfo {
  selectedText: string;
  fullText: string;
  nodeId: string;
  fieldName: string;
  fieldLabel: string;
  element: HTMLTextAreaElement | HTMLInputElement;
}

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

export default function SelectionAssist() {
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  // 改写模式
  const [aiReply, setAiReply] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  // 对话模式
  const [mode, setMode] = useState<'toolbar' | 'rewrite' | 'chat'>('toolbar');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ★ 全局 mouseup 监听
  const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
    setTimeout(() => {
      const el = document.activeElement;
      if (!(el instanceof HTMLTextAreaElement) && !(el instanceof HTMLInputElement)) {
        setSelection(null);
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setSelection(null);
        return;
      }
      const selectedText = sel.toString().trim();
      const fullText = el.value;
      const nodeId = el.getAttribute('data-node-id') || '';
      const fieldName = el.getAttribute('data-field') || '';
      const fieldLabel = el.getAttribute('data-field-label') || fieldName;
      if (!nodeId || !fieldName) { setSelection(null); return; }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setToolbarPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
      setSelection({ selectedText, fullText, nodeId, fieldName, fieldLabel, element: el });
      setShowResult(false);
      setAiReply('');
      setMode('toolbar');
      setChatMessages([]);
      setChatInput('');
    }, 10);
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [handleGlobalMouseUp]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ★ 改写模式：一次调用 LLM
  const handleAIRewrite = async () => {
    if (!selection || isLoading) return;
    setIsLoading(true);
    setMode('rewrite');
    setShowResult(true);
    setAiReply('');
    try {
      const systemPrompt = `你是一个精准的文字改写助手。请直接输出改写后的文字，不要任何前缀、后缀或解释。
【上下文】节点: ${selection.nodeId} / 字段: ${selection.fieldLabel}
【选中文字】"${selection.selectedText}"`;
      const token = localStorage.getItem('yr-ai-token');
      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          model: 'gpt-5.4',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `请改写：${selection.selectedText}` }],
          stream: false,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setAiReply((data.choices?.[0]?.message?.content || '').trim());
    } catch (error: any) {
      console.error('[SelectionAI Error] 改写失败:', error);
      setAiReply(`⚠️ ${error.message}`);
    } finally { setIsLoading(false); }
  };

  // ★ 对话模式：多轮对话修改
  const handleStartChat = () => {
    if (!selection) return;
    setMode('chat');
    setChatMessages([{
      role: 'assistant',
      content: `你好！我看到你在编辑「${selection.fieldLabel}」。\n\n当前选中的文字是："${selection.selectedText.length > 100 ? selection.selectedText.slice(0,100) + '...' : selection.selectedText}"\n\n你想怎么修改这段文字？`,
    }]);
  };

  const handleChatSend = async () => {
    if (!selection || !chatInput.trim() || isLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);
    try {
      const systemPrompt = `你是一个画布字段编辑助手。用户正在编辑「${selection.fieldLabel}」字段。

【字段上下文】
- 节点 ID: ${selection.nodeId}
- 字段完整内容: ${selection.fullText}
- 用户选中的片段: "${selection.selectedText}"

【工作方式】
根据对话历史理解用户的修改意图。当你准备好建议修改时，在回复末尾单独一行写：【建议修改】然后紧接着输出修改后的完整文字（替换选中的片段）。
如果没有准备好，就继续和用户对话确认细节。

保持回复简短，专注于文字修改。`;
      const history = chatMessages.map(m => ({ role: m.role, content: m.content }));
      const token = localStorage.getItem('yr-ai-token');
      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          model: 'gpt-5.4',
          messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: userMsg }],
          stream: false,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content || '';
      // 分离对话文本和修改建议
      const suggestIdx = rawContent.indexOf('【建议修改】');
      const chatContent = suggestIdx > -1 ? rawContent.slice(0, suggestIdx).trim() : rawContent;
      const suggestion = suggestIdx > -1 ? rawContent.slice(suggestIdx + 6).trim() : '';

      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: chatContent || rawContent,
      }]);
      if (suggestion) {
        setAiReply(suggestion);
        setShowResult(true);
      }
    } catch (error: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${error.message}` }]);
    } finally { setIsLoading(false); }
  };

  // ★ 应用改写/对话结果
  const handleApply = () => {
    if (!selection || !aiReply) return;
    const el = selection.element;
    const before = selection.fullText.slice(0, el.selectionStart || 0);
    const after = selection.fullText.slice(el.selectionEnd || 0);
    const newValue = before + aiReply + after;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, newValue);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setSelection(null);
    setShowResult(false);
    setAiReply('');
    setMode('toolbar');
    setChatMessages([]);
    el.focus();
  };

  // ★ 对话中继续迭代（不清空选择）
  const handleChatApply = () => {
    handleApply();
  };

  const handleClose = () => {
    setSelection(null);
    setShowResult(false);
    setAiReply('');
    setMode('toolbar');
    setChatMessages([]);
  };

  if (!selection) return null;

  return createPortal(
    <div className="fixed z-[99999999] pointer-events-none" style={{ left: 0, top: 0 }}>
      <div
        className="pointer-events-auto absolute bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/[0.08] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{ left: toolbarPos.x, top: toolbarPos.y, transform: 'translate(-50%, -100%)' }}
      >
        {/* 工具栏 */}
        {mode === 'toolbar' && (
          <div className="flex items-center gap-0.5 p-1">
            <button onClick={handleAIRewrite} disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/[0.06] text-zinc-400 hover:text-white text-[11px] font-medium transition-all disabled:opacity-40">
              <Wand2 size={12} /> 改写选中
            </button>
            <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
            <button onClick={handleStartChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/[0.06] text-zinc-400 hover:text-white text-[11px] font-medium transition-all">
              <MessageSquare size={12} /> AI 对话
            </button>
            <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
            <button onClick={handleClose}
              className="p-1.5 rounded-xl hover:bg-white/[0.06] text-zinc-600 hover:text-white transition-all">
              <X size={12} />
            </button>
          </div>
        )}

        {/* 改写模式结果 */}
        {mode === 'rewrite' && showResult && (
          <div className="border-t border-white/[0.05] bg-white/[0.01] p-3 min-w-[300px] max-w-[450px]">
            {(isLoading && !aiReply) ? (
              <div className="flex items-center gap-2 text-zinc-500 text-[11px] py-2"><Loader2 size={12} className="animate-spin" /> 改写中...</div>
            ) : (
              <>
                <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">改写结果</div>
                <div className="text-[11px] text-zinc-300 leading-relaxed max-h-[150px] overflow-y-auto custom-scrollbar whitespace-pre-wrap mb-2">{aiReply}</div>
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => { setMode('toolbar'); setShowResult(false); setAiReply(''); }} className="px-2.5 py-1 rounded-lg border border-white/[0.08] text-zinc-500 hover:text-white text-[10px] transition-all">返回</button>
                  <button onClick={handleApply} className="px-2.5 py-1 rounded-lg bg-white/[0.08] border border-white/[0.12] text-white text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1"><Check size={11} /> 替换</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 对话模式 */}
        {mode === 'chat' && (
          <div className="border-t border-white/[0.05] flex flex-col min-w-[340px] max-w-[500px]">
            {/* 对话消息 */}
            <div className="max-h-[260px] overflow-y-auto custom-scrollbar p-3 space-y-2.5">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`text-[11px] leading-relaxed ${msg.role === 'user' ? 'text-zinc-500 pl-4' : 'text-zinc-300'}`}>
                  <span className="text-[9px] font-bold text-zinc-600 mr-1">{msg.role === 'user' ? '你' : 'AI'}:</span>
                  {msg.content}
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]"><Loader2 size={11} className="animate-spin" /> AI 思考中...</div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* 修改建议预览 */}
            {showResult && aiReply && (
              <div className="border-t border-white/[0.05] bg-emerald-500/[0.04] p-3">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">建议修改</div>
                <div className="text-[11px] text-emerald-400 leading-relaxed max-h-[100px] overflow-y-auto custom-scrollbar whitespace-pre-wrap mb-2">{aiReply}</div>
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => { setShowResult(false); setAiReply(''); }} className="px-2.5 py-1 rounded-lg border border-white/[0.08] text-zinc-500 hover:text-white text-[10px] transition-all">忽略</button>
                  <button onClick={handleChatApply} className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1"><Check size={11} /> 应用修改</button>
                </div>
              </div>
            )}

            {/* 输入框 */}
            <div className="border-t border-white/[0.05] p-2.5 flex gap-2">
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                placeholder="描述你想怎么修改..."
                className="flex-1 bg-black/40 border border-white/[0.05] focus:border-white/[0.12] rounded-xl p-2 text-[11px] text-zinc-300 outline-none resize-none min-h-[32px] max-h-[70px] custom-scrollbar placeholder:text-zinc-700"
                rows={1}
                disabled={isLoading}
              />
              <button onClick={handleChatSend} disabled={!chatInput.trim() || isLoading}
                className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08] text-zinc-500 hover:text-white disabled:opacity-20 transition-all flex-shrink-0 flex items-center justify-center">
                <Send size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
