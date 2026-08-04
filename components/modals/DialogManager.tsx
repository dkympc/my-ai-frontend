// components/modals/DialogManager.tsx
// ★ 统一弹窗渲染组件 — ConfirmDialog / PromptDialog / MessageDialog
// 设计语言：深色液态玻璃，与项目现有的 DeleteConfirmModal / SearchModal 保持一致
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, HelpCircle, X, Info, Check } from 'lucide-react';
import { useDialogStore } from '@/lib/dialogStore';

export default function DialogManager() {
  const store = useDialogStore();
  const [promptValue, setPromptValue] = useState('');
  const promptInputRef = useRef<HTMLInputElement>(null);

  // 打开 Prompt 时预填默认值 + 自动聚焦
  useEffect(() => {
    if (store.open && store.type === 'prompt') {
      setPromptValue(store.promptDefaultValue);
      const timer = setTimeout(() => promptInputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [store.open, store.type, store.promptDefaultValue]);

  // 全局键盘：Esc 关闭任意弹窗 / Enter 提交 Prompt
  useEffect(() => {
    if (!store.open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        store.closeDialog();
      }
      if (e.key === 'Enter' && store.type === 'prompt' && document.activeElement === promptInputRef.current) {
        handlePromptConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store.open, store.type, promptValue]);

  if (!store.open) return null;

  // ─── 内部决议函数（从 store 中取 resolver，决议后立即清空状态防重复触发）───

  const resolveConfirm = (value: boolean) => {
    const resolver = useDialogStore.getState().resolveConfirm;
    useDialogStore.setState({ open: false, type: null, resolveConfirm: null });
    resolver?.(value);
  };

  const resolvePrompt = (value: string | null) => {
    const resolver = useDialogStore.getState().resolvePrompt;
    useDialogStore.setState({ open: false, type: null, resolvePrompt: null });
    resolver?.(value);
  };

  const resolveMessage = () => {
    const resolver = useDialogStore.getState().resolveMessage;
    useDialogStore.setState({ open: false, type: null, resolveMessage: null });
    resolver?.();
  };

  const handlePromptConfirm = () => {
    const trimmed = promptValue.trim();
    resolvePrompt(trimmed || null);
  };

  const handlePromptCancel = () => resolvePrompt(null);

  // ====================================================================
  //  ConfirmDialog  — 替代 window.confirm()
  // ====================================================================
  if (store.type === 'confirm') {
    const isDanger = store.confirmVariant === 'danger';
    return (
      <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4">
        {/* 遮罩层 */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => resolveConfirm(false)}
        />
        {/* 卡片本体 */}
        <div className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/[0.08] rounded-[28px] shadow-[0_30px_80px_rgba(0,0,0,0.8)] p-7 animate-in zoom-in-95 fade-in duration-200">
          <div className="flex items-start gap-4 mb-2">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                isDanger ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-zinc-300'
              }`}
            >
              {isDanger ? <AlertTriangle size={22} /> : <HelpCircle size={22} />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-zinc-100 mb-1.5 leading-snug">
                {store.confirmTitle}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{store.confirmMessage}</p>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => resolveConfirm(false)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors text-sm"
            >
              取消
            </button>
            <button
              onClick={() => resolveConfirm(true)}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all text-sm ${
                isDanger
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
                  : 'bg-white hover:bg-zinc-200 text-black shadow-lg shadow-white/10'
              }`}
            >
              {isDanger ? '确认删除' : '确定'}
            </button>
          </div>
          <button
            onClick={() => resolveConfirm(false)}
            className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors rounded-lg hover:bg-white/5"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ====================================================================
  //  PromptDialog  — 替代 window.prompt()
  // ====================================================================
  if (store.type === 'prompt') {
    return (
      <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={handlePromptCancel}
        />
        <div className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/[0.08] rounded-[28px] shadow-[0_30px_80px_rgba(0,0,0,0.8)] p-7 animate-in zoom-in-95 fade-in duration-200">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-300 flex-shrink-0">
              <Info size={22} />
            </div>
            <h3 className="text-base font-bold text-zinc-100 leading-snug">{store.promptTitle}</h3>
          </div>
          <input
            ref={promptInputRef}
            type="text"
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-white/10 text-zinc-200 placeholder-zinc-500 text-sm outline-none focus:border-white/20 focus:bg-zinc-800 transition-all"
            placeholder="请输入..."
          />
          <div className="flex gap-3 mt-5">
            <button
              onClick={handlePromptCancel}
              className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors text-sm"
            >
              取消
            </button>
            <button
              onClick={handlePromptConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-medium transition-all text-sm shadow-lg shadow-white/10"
            >
              确认
            </button>
          </div>
          <button
            onClick={handlePromptCancel}
            className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors rounded-lg hover:bg-white/5"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ====================================================================
  //  MessageDialog  — 替代需要用户停驻阅读的 alert()
  // ====================================================================
  if (store.type === 'message') {
    return (
      <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={resolveMessage}
        />
        <div className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/[0.08] rounded-[28px] shadow-[0_30px_80px_rgba(0,0,0,0.8)] p-7 animate-in zoom-in-95 fade-in duration-200">
          <div className="flex items-start gap-4 mb-2">
            <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-400 flex-shrink-0">
              <Info size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-zinc-100 mb-1.5 leading-snug">
                {store.messageTitle}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">
                {store.messageContent}
              </p>
            </div>
          </div>
          <div className="flex justify-center mt-5">
            <button
              onClick={resolveMessage}
              className="px-8 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-medium transition-all text-sm shadow-lg shadow-white/10 flex items-center gap-2"
            >
              <Check size={16} />
              我知道了
            </button>
          </div>
          <button
            onClick={resolveMessage}
            className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors rounded-lg hover:bg-white/5"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
