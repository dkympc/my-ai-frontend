// components/video-canvas/CopilotPanel.tsx
// ★★★ 创作助手面板 — 可拖动、多对话、黑色液态玻璃风格 ★★★

"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Send, X, Trash2, Loader2, StopCircle, Plus, MessageSquare, GripHorizontal } from 'lucide-react';
import { useCanvasCopilot, parseUserIntent } from '@/hooks/useCanvasCopilot';
import { useAppStore } from '@/store/useAppStore';
import { showConfirm } from '@/lib/dialogStore';

interface CopilotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  copilot: ReturnType<typeof useCanvasCopilot>;
}

// ★ 消息气泡（完全黑色液态玻璃配色）
function MsgBubble({ msg }: { msg: { role: string; content: string; timestamp: number; isStreaming?: boolean } }) {
  const isUser = msg.role === 'user';
  if (msg.role === 'system') return null;
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-1 duration-150`}>
      <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
        isUser ? 'bg-white/[0.06] border border-white/[0.08]' : 'bg-white/[0.04] border border-white/[0.06]'
      }`}>
        <span className="text-[10px] text-zinc-500">{isUser ? '我' : '助'}</span>
      </div>
      <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[11px] leading-relaxed whitespace-pre-wrap break-words ${
        isUser
          ? 'bg-white/[0.06] border border-white/[0.08] text-zinc-300 rounded-tr-md'
          : 'bg-white/[0.03] border border-white/[0.05] text-zinc-400 rounded-tl-md'
      }`}>
        {msg.isStreaming ? (
          <span>{msg.content || '思考中...'}<span className="inline-block w-1.5 h-3.5 bg-zinc-500 ml-0.5 animate-pulse align-middle" /></span>
        ) : msg.content || (
          <span className="flex items-center gap-1.5 text-zinc-600"><Loader2 size={11} className="animate-spin" />处理中...</span>
        )}
        <div className={`text-[8px] mt-1 text-zinc-700 ${isUser ? 'text-right' : 'text-left'}`}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

export default function CopilotPanel({ isOpen, onClose, copilot }: CopilotPanelProps) {
  const {
    conversations, activeConvId, messages, isProcessing,
    sendMessage, executeLocalIntent, createConversation,
    deleteConversation, switchConversation, abortRequest, parseUserIntent,
  } = copilot;

  const [input, setInput] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const setToastMsg = useAppStore(s => s.setToastMsg);

  // ★ 可拖动
  const [pos, setPos] = useState({ x: 380, y: 80 }); // 默认位置
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  }, [pos]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => {
      setPos({
        x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
        y: Math.max(0, dragRef.current.origY + (e.clientY - dragRef.current.startY)),
      });
    };
    const handleUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [isDragging]);

  // 自动滚底
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ★ 发送消息 + 智能意图处理
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isProcessing) return;
    setInput('');

    // 1. 先做本地意图解析
    const localIntent = parseUserIntent(text);

    // 2. 发送给 LLM（流式）
    const result = await sendMessage(text);

    // 3. 如果本地解析到了意图，直接展示确认弹窗
    if (localIntent) {
      const confirmed = await showConfirm(
        '创作助手',
        `${localIntent.description}\n\n是否执行此修改？`,
        'info'
      );
      if (confirmed) {
        const count = executeLocalIntent(localIntent);
        setToastMsg(`✅ 创作助手已完成 ${count} 处修改`);
      }
    }
    // 4. 如果 LLM 回复中有【确认修改】标记，展示确认弹窗
    else if (result.intentConfirmed) {
      const confirmed = await showConfirm(
        '创作助手',
        `${result.message}\n\n根据 AI 的分析，是否执行此修改？`,
        'info'
      );
      if (confirmed) {
        // ★ 核心修复：优先解析 LLM 的回复文本（AI理解后可产生更准确匹配），回退到原始用户输入
        const reIntent = parseUserIntent(result.message) || parseUserIntent(text);
        if (reIntent) {
          const count = executeLocalIntent(reIntent);
          setToastMsg(`✅ 创作助手已完成 ${count} 处修改`);
        } else {
          setToastMsg('创作助手已确认，但无法自动解析具体操作。请换一种方式描述。');
        }
      }
    }
  };

  // 快捷键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (!isOpen || typeof window === 'undefined') return null;

  const activeConv = conversations.find(c => c.id === activeConvId);

  return createPortal(
    <div
      className={`fixed z-[999998] rounded-[28px] bg-[#08080a]/95 backdrop-blur-3xl border border-white/[0.06] shadow-[0_40px_120px_rgba(0,0,0,0.98),inset_0_1px_1px_rgba(255,255,255,0.04)] flex overflow-hidden animate-in fade-in zoom-in-95 duration-300 ${isDragging ? 'cursor-grabbing select-none' : ''}`}
      style={{ left: pos.x, top: pos.y, width: showSidebar ? 620 : 380, height: 'min(85vh, 700px)' }}
      onClick={e => e.stopPropagation()}
    >
      {/* ========== 左侧对话列表 ========== */}
      {showSidebar && (
        <div className="w-[240px] flex-shrink-0 border-r border-white/[0.05] flex flex-col bg-black/20">
          <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-zinc-500 tracking-[0.2em] uppercase">对话</span>
            <button onClick={createConversation} className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.08] transition-all" title="新建对话">
              <Plus size={12} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => switchConversation(conv.id)}
                className={`group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all ${
                  conv.id === activeConvId
                    ? 'bg-white/[0.06] border border-white/[0.08]'
                    : 'hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <MessageSquare size={12} className={conv.id === activeConvId ? 'text-zinc-400' : 'text-zinc-600'} />
                <span className={`text-[11px] truncate flex-1 ${conv.id === activeConvId ? 'text-zinc-300 font-medium' : 'text-zinc-500'}`}>
                  {conv.title}
                </span>
                {conv.id === activeConvId && conversations.length > 1 && (
                  <button
                    onClick={e => { e.stopPropagation(); deleteConversation(conv.id); }}
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== 右侧聊天区 ========== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶栏 — 可拖动把手 */}
        <div
          className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.01] flex-shrink-0 cursor-grab active:cursor-grabbing"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal size={12} className="text-zinc-700" />
            <span className="text-[11px] font-extrabold text-zinc-400 tracking-[0.15em] flex items-center gap-1.5">
              <MessageSquare size={13} className="text-zinc-500" />
              创作助手
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowSidebar(!showSidebar)} className={`w-6 h-6 rounded-full flex items-center justify-center transition-all border text-[11px] font-bold ${showSidebar ? 'bg-white/[0.06] border-white/[0.1] text-zinc-400' : 'bg-white/[0.03] border-white/[0.05] text-zinc-600'}`} title={showSidebar ? '收起对话列表' : '展开对话列表'}>
              <MessageSquare size={11} />
            </button>
            <button onClick={onClose} className="w-6 h-6 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] text-zinc-500 hover:text-white transition-all border border-white/[0.05]">
              <X size={11} />
            </button>
          </div>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-10">
              <div className="w-14 h-14 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
                <MessageSquare size={24} className="text-zinc-600" />
              </div>
              <h3 className="text-[13px] font-bold text-zinc-400 mb-2">创作助手</h3>
              <p className="text-[10px] text-zinc-600 leading-relaxed mb-5">用人话操控整个画布</p>
              <div className="space-y-1.5 w-full">
                {['把所有分镜的比例改成 16:9', '在每个分镜提示词末尾加上 cinematic lighting', '列出当前画布上的所有节点', '帮我写一段剧本放到主控节点中'].map((ex, i) => (
                  <button key={i} onClick={() => { setInput(ex); inputRef.current?.focus(); }}
                    className="w-full text-left px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] text-[10px] text-zinc-500 hover:text-zinc-300 transition-all">
                    "{ex}"
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => <MsgBubble key={i} msg={msg} />)}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区 */}
        <div className="px-4 py-3 border-t border-white/[0.05] bg-white/[0.01] flex-shrink-0">
          <div className="flex gap-2">
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="告诉创作助手你想改什么..."
              className="flex-1 bg-black/40 border border-white/[0.05] focus:border-white/[0.12] rounded-2xl p-3 text-[11px] text-zinc-400 outline-none resize-none min-h-[42px] max-h-[90px] custom-scrollbar placeholder:text-zinc-700"
              rows={1} disabled={isProcessing} />
            {isProcessing ? (
              <button onClick={abortRequest} className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400/70 hover:bg-red-500/20 transition-all flex items-center justify-center flex-shrink-0">
                <StopCircle size={15} />
              </button>
            ) : (
              <button onClick={handleSend} disabled={!input.trim()}
                className="w-10 h-10 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-zinc-500 hover:text-white hover:bg-white/[0.1] disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center justify-center flex-shrink-0">
                <Send size={15} />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <div className="flex items-center gap-1.5">
              {isProcessing ? (
                <><Loader2 size={9} className="animate-spin text-zinc-500" /><span className="text-[8px] text-zinc-600 font-mono">处理中</span></>
              ) : (
                <><span className="w-1 h-1 rounded-full bg-zinc-700" /><span className="text-[8px] text-zinc-700 font-mono">就绪</span></>
              )}
            </div>
            <span className="text-[8px] text-zinc-700 font-mono">Enter发送 · Shift+Enter换行</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
