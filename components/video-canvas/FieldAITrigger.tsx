// components/video-canvas/FieldAITrigger.tsx
// ★ 字段级 AI 微调触发 — 悬停在可编辑字段上显示 ✨ 图标，点击弹出迷你对话窗

"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Loader2 } from 'lucide-react';
import { parseActionBlock, CopilotAction } from '@/hooks/useCanvasCopilot';

interface FieldAITriggerProps {
  /** 节点 ID */
  nodeId: string;
  /** 节点类型（用于上下文展示） */
  nodeType: string;
  /** 字段名 */
  fieldName: string;
  /** 字段标签（人类可读，如 "首帧生图提示词"） */
  fieldLabel: string;
  /** 当前值 */
  currentValue: string;
  /** 修改后的回调（用户确认替换时调用） */
  onApply: (newValue: string) => void;
}

export default function FieldAITrigger({
  nodeId,
  nodeType,
  fieldName,
  fieldLabel,
  currentValue,
  onApply,
}: FieldAITriggerProps) {

  // 迷你对话窗状态
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState<CopilotAction[]>([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // 打开对话窗时自动聚焦输入框
  useEffect(() => {
    if (isChatOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isChatOpen]);

  // 点击外部关闭对话窗
  useEffect(() => {
    if (!isChatOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (chatRef.current && !chatRef.current.contains(e.target as Node)) {
        setIsChatOpen(false);
        setAiReply('');
        setPendingActions([]);
        setUserInput('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isChatOpen]);

  // ★ 发送请求 → 调用 LLM 改写当前字段
  const handleSend = async () => {
    const input = userInput.trim();
    if (!input || isLoading) return;

    setUserInput('');
    setIsLoading(true);
    setAiReply('');

    try {
      // 构建上下文 System Prompt（只针对单个字段的精确修改）
      const systemPrompt = `你是一个画布字段编辑器。你只需要修改一个字段的值。

【字段信息】
- 节点 ID: ${nodeId}
- 节点类型: ${nodeType}
- 字段名: ${fieldLabel}
- 当前值: ${currentValue}

【用户要求】${input}

【任务】
直接输出修改后的完整字段值。如果用户只是要求追加内容，在原值基础上追加；如果要求重写，输出全新值。

回复格式：
{你的简短解释}

\`\`\`json
{
  "message": "修改说明",
  "actions": [
    { "type": "updateField", "nodeId": "${nodeId}", "field": "${fieldName}", "newValue": "这里放修改后的完整字段值", "reason": "修改原因" }
  ]
}
\`\`\`

重要：newValue 必须是完整的最终值，不能是增量或缩写。不需要问候或开场白。`;

      const token = localStorage.getItem('yr-ai-token');
      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: 'gpt-5.4-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: input },
          ],
          stream: false, // 字段级用非流式，更快拿结果
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errText || response.statusText}`);
      }

      const data = await response.json();
      const rawText = data.choices?.[0]?.message?.content || '';

      // 提取 JSON 行动块
      const { textContent, actions } = parseActionBlock(rawText);
      setAiReply(textContent);
      setPendingActions(actions);

    } catch (error: any) {
      console.error('[FieldAI Error] 字段级 AI 请求失败:', error);
      setAiReply(`⚠️ 请求失败：${error.message || '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ★ 应用修改：从 actions 中提取 newValue，回调给父组件
  const handleApply = () => {
    if (pendingActions.length === 0) return;
    const action = pendingActions[0];
    if (action.type === 'updateField' && action.newValue) {
      onApply(action.newValue);
    }
    // 关闭并重置
    setIsChatOpen(false);
    setAiReply('');
    setPendingActions([]);
    setUserInput('');
  };

  // 按 Enter 发送（Shift+Enter 换行）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="absolute top-1 right-1 z-10" onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>
      {/* ★ 悬停时显示的 ✨ 触发图标 */}
      <button
        onClick={(e) => { e.stopPropagation(); setIsChatOpen(!isChatOpen); }}
        className={`w-5 h-5 rounded-full bg-black/60 backdrop-blur border border-white/[0.08] flex items-center justify-center transition-all duration-200 ${
          isHovering || isChatOpen
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-75 pointer-events-none'
        }`}
        title="AI 辅助编辑"
      >
        <Sparkles size={10} className={isChatOpen ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'} />
      </button>

      {/* ★ 迷你对话窗 */}
      {isChatOpen && (
        <div
          ref={chatRef}
          className="absolute top-full right-0 mt-2 w-[300px] z-[99999] bg-[#09090b]/95 backdrop-blur-3xl border border-white/[0.08] rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          onClick={e => e.stopPropagation()}
        >
          {/* 顶栏 */}
          <div className="px-3 py-2 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.01]">
            <span className="text-[10px] font-extrabold text-zinc-400 tracking-widest flex items-center gap-1.5">
              <Sparkles size={12} className="text-emerald-400" />
              AI 微调 · {fieldLabel}
            </span>
            <button
              onClick={() => { setIsChatOpen(false); setAiReply(''); setPendingActions([]); }}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <X size={12} />
            </button>
          </div>

          {/* 当前值展示 */}
          <div className="px-3 py-2 border-b border-white/[0.03] bg-black/20">
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">当前值</div>
            <div className="text-[11px] text-zinc-400 leading-relaxed max-h-[60px] overflow-y-auto custom-scrollbar">
              {currentValue || '(空)'}
            </div>
          </div>

          {/* AI 回复区域 */}
          {(aiReply || isLoading) && (
            <div className="px-3 py-2 border-b border-white/[0.03]">
              <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">AI 回复</div>
              {isLoading ? (
                <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
                  <Loader2 size={12} className="animate-spin" /> 思考中...
                </div>
              ) : (
                <div className="text-[11px] text-zinc-300 leading-relaxed max-h-[120px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                  {aiReply}
                </div>
              )}
            </div>
          )}

          {/* 预览变更 */}
          {pendingActions.length > 0 && (
            <div className="px-3 py-2 border-b border-white/[0.03] bg-emerald-500/[0.03]">
              <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">修改预览</div>
              <div className="text-[11px] text-emerald-400 leading-relaxed max-h-[80px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                {pendingActions[0].type === 'updateField' && String(pendingActions[0].newValue || '').length > 150
                  ? String(pendingActions[0].newValue).slice(0, 150) + '...'
                  : String(pendingActions[0].newValue || '')}
              </div>
              {/* 操作按钮 */}
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  onClick={() => { setPendingActions([]); setAiReply(''); }}
                  className="px-2.5 py-1 rounded-lg border border-white/[0.08] text-zinc-500 hover:text-white text-[10px] font-medium transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleApply}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-bold transition-all active:scale-95 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                >
                  替换此字段
                </button>
              </div>
            </div>
          )}

          {/* 输入区 */}
          {!pendingActions.length && (
            <div className="p-2">
              <div className="flex gap-1.5">
                <textarea
                  ref={inputRef}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`改写这个${fieldLabel}...`}
                  className="flex-1 bg-black/30 border border-white/[0.06] focus:border-emerald-500/50 rounded-xl p-2 text-[11px] text-zinc-300 outline-none resize-none min-h-[44px] max-h-[80px] custom-scrollbar placeholder:text-zinc-600"
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!userInput.trim() || isLoading}
                  className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/40 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0 self-end flex items-center justify-center"
                >
                  {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
