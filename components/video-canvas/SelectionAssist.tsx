// components/video-canvas/SelectionAssist.tsx
// ★★★ 全局文字选中 AI 助手 — 一次性对话框 ★★★
// 设计原则：
//   1. 选中文字后弹出浮动工具条，只有一个「AI 助手」按钮 + 关闭按钮
//   2. 点击「AI 助手」弹出一次性对话框：用户描述需求 → AI 流式建议 → 应用或关闭
//   3. 不做多轮聊天历史累积，关闭即清零
//   4. 工具栏点击不会被 mouseup 误吞（通过 portal 类名护栏过滤自身 DOM 事件）

"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Wand2, X, Loader2, Check, Send } from 'lucide-react';
import { fetchApi } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

interface SelectionInfo {
  selectedText: string;
  fullText: string;
  nodeId: string;
  fieldName: string;
  fieldLabel: string;
  element: HTMLTextAreaElement | HTMLInputElement;
}

export default function SelectionAssist() {
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });

  // ★ 一次性对话框状态
  const [showDialog, setShowDialog] = useState(false);
  const [dialogInput, setDialogInput] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // ★ 核心修复：不用 window.getSelection()（在 React Flow 中不可靠）
  //   改用 textarea.selectionStart/selectionEnd 直接读取选区状态
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // ★ 护栏：如果点击的是 SelectionAssist 自身的 UI，不处理选中逻辑
      //   解决：点击工具栏按钮 → activeElement 变 button → 原本会 setSelection(null) 卸载门户 → onClick 丢失
      if ((e.target as HTMLElement).closest('.selection-assist-portal')) return;

      const el = document.activeElement;
      if (!(el instanceof HTMLTextAreaElement) && !(el instanceof HTMLInputElement)) {
        setSelection(null);
        return;
      }

      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      if (start === end) { setSelection(null); return; }

      const selectedText = el.value.substring(start, end).trim();
      if (!selectedText) { setSelection(null); return; }

      const fullText = el.value;
      const nodeId = el.getAttribute('data-node-id') || '';
      const fieldName = el.getAttribute('data-field') || '';
      const fieldLabel = el.getAttribute('data-field-label') || fieldName;
      if (!nodeId || !fieldName) { setSelection(null); return; }

      // ★ 坐标：优先用鼠标位置，回退到 textarea 顶部
      let x = 0, y = 0;
      try {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const rangeRect = sel.getRangeAt(0).getBoundingClientRect();
          if (rangeRect.width > 0) {
            x = rangeRect.left + rangeRect.width / 2;
            y = rangeRect.top - 10;
          }
        }
      } catch { /* ignore */ }
      // fallback：如果 Range 不可用（React Flow 中常见），定位到 textarea 顶部
      if (x === 0 && y === 0) {
        const elRect = el.getBoundingClientRect();
        x = elRect.left + elRect.width / 2;
        y = elRect.top - 6;
      }

      setToolbarPos({ x, y });
      setSelection({ selectedText, fullText, nodeId, fieldName, fieldLabel, element: el });
      // ★ 每次新的选中都重置对话框状态
      setShowDialog(false);
      setDialogInput('');
      setAiReply('');
      setShowResult(false);
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // ★ 点击「AI 助手」→ 打开一次性对话框，预填默认指令
  const handleOpenDialog = () => {
    if (!selection) return;
    setDialogInput('改写这段文字');
    setShowDialog(true);
    setShowResult(false);
    setAiReply('');
  };

  // ★ 发送请求：SSE 流式返回 AI 建议
  const handleSend = async () => {
    if (!selection || !dialogInput.trim() || isLoading) return;
    setIsLoading(true);
    setShowResult(true);
    setAiReply('');

    try {
      const systemPrompt = `你是一个嵌入在影视级分镜画布中的文字助手。

【当前字段上下文】
- 节点: ${selection.nodeId}
- 字段名: ${selection.fieldLabel}
- 字段完整内容: ${selection.fullText}
- 用户选中的片段: "${selection.selectedText}"

【工作方式】
- 如果用户要求修改文字（如"改短""润色""改成XX风格"），直接输出替换选中片段后的最终文字，不要前缀后缀
- 如果用户是聊天、提问、讨论（如"在吗""这是什么意思""这里怎么写"），自由回复即可，像正常对话一样
- 回复简洁精准，不啰嗦`;

      const token = localStorage.getItem('yr-ai-token');
      const assistModel = useAppStore.getState().canvasSettings?.defaultLLMModel || 'gpt-5.4-mini';
      const response = await fetchApi('/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: assistModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: dialogInput.trim() }
          ],
          stream: true,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let fullText = '', buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) { fullText += content; setAiReply(fullText); }
          } catch { /* skip malformed chunk */ }
        }
      }
    } catch (error: any) {
      console.error('[SelectionAI Error] 请求失败:', error);
      setAiReply(`请求失败：${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ★ 应用修改结果到 textarea
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
    // ★ 全部重置，对话框关闭
    setSelection(null);
    setShowDialog(false);
    setDialogInput('');
    setAiReply('');
    setShowResult(false);
    el.focus();
  };

  // ★ 关闭对话框，回到工具栏状态（不清除选中，用户可再次打开）
  const handleCloseDialog = () => {
    setShowDialog(false);
    setDialogInput('');
    setAiReply('');
    setShowResult(false);
  };

  // ★ 完全关闭工具栏
  const handleClose = () => {
    setSelection(null);
    setShowDialog(false);
    setDialogInput('');
    setAiReply('');
    setShowResult(false);
  };

  if (!selection) return null;

  return createPortal(
    <div
      className="selection-assist-portal fixed z-[99999999] pointer-events-none"
      style={{ left: 0, top: 0 }}
    >
      <div
        className="pointer-events-auto absolute bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/[0.08] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{ left: toolbarPos.x, top: toolbarPos.y, transform: 'translate(-50%, -100%)' }}
      >
        {/* 工具栏：仅「AI 助手」+ 关闭按钮 */}
        {!showDialog && (
          <div className="flex items-center gap-0.5 p-1 whitespace-nowrap">
            <button
              onClick={handleOpenDialog}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/[0.06] text-zinc-400 hover:text-white text-[11px] font-medium transition-all"
            >
              <Wand2 size={12} /> AI 助手
            </button>
            <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
            <button
              onClick={handleClose}
              className="p-1.5 rounded-xl hover:bg-white/[0.06] text-zinc-600 hover:text-white transition-all"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* ★ 一次性对话框 */}
        {showDialog && (
          <div className="border-t border-white/[0.05] bg-white/[0.01] min-w-[340px] max-w-[480px] flex flex-col">
            {/* 对话框顶栏 */}
            <div className="px-3 py-2 border-b border-white/[0.05] flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                AI 助手 · {selection.fieldLabel}
              </span>
              <button
                onClick={handleClose}
                className="p-1 rounded-lg hover:bg-white/[0.06] text-zinc-600 hover:text-white transition-all"
              >
                <X size={12} />
              </button>
            </div>

            {/* 结果展示区（仅在发送后显示） */}
            {showResult && (
              <div className="px-3 py-2.5 border-b border-white/[0.05]">
                {(isLoading && !aiReply) ? (
                  <div className="flex items-center gap-2 text-zinc-500 text-[11px] py-2">
                    <Loader2 size={12} className="animate-spin" /> AI 思考中...
                  </div>
                ) : (
                  <>
                    <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">修改建议</div>
                    <div className="text-[11px] text-zinc-300 leading-relaxed max-h-[180px] overflow-y-auto custom-scrollbar whitespace-pre-wrap mb-2.5">
                      {aiReply || '（无结果）'}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setShowResult(false); setAiReply(''); }}
                        className="px-2.5 py-1 rounded-lg border border-white/[0.08] text-zinc-500 hover:text-white text-[10px] transition-all"
                      >
                        忽略
                      </button>
                      <button
                        onClick={handleApply}
                        disabled={!aiReply}
                        className="px-3 py-1 rounded-lg bg-white/[0.08] border border-white/[0.12] text-white text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1 disabled:opacity-30"
                      >
                        <Check size={11} /> 应用修改
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 输入区 */}
            <div className="p-2.5 flex gap-2">
              <textarea
                value={dialogInput}
                onChange={e => setDialogInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder="描述你想怎么修改选中的文字..."
                className="flex-1 bg-black/40 border border-white/[0.05] focus:border-white/[0.12] rounded-xl p-2 text-[11px] text-zinc-300 outline-none resize-none min-h-[32px] max-h-[70px] custom-scrollbar placeholder:text-zinc-700"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!dialogInput.trim() || isLoading}
                className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08] text-zinc-500 hover:text-white disabled:opacity-20 transition-all flex-shrink-0 flex items-center justify-center"
              >
                {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
