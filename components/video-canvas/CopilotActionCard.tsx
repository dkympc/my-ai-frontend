// components/video-canvas/CopilotActionCard.tsx
// ★ 行动计划预览卡片 — 展示 AI 将要执行的修改，用户确认后批量执行

"use client";

import React from 'react';
import { CopilotAction } from '@/hooks/useCanvasCopilot';
import { Check, X, ArrowRight, Plus, Trash2, Link } from 'lucide-react';

interface CopilotActionCardProps {
  actions: CopilotAction[];
  onApply: () => void;
  onCancel: () => void;
}

export default function CopilotActionCard({ actions, onApply, onCancel }: CopilotActionCardProps) {
  // 为每条 action 生成人类可读的变更描述
  const renderActionDescription = (action: CopilotAction, index: number) => {
    switch (action.type) {
      case 'updateField':
        return (
          <div key={index} className="flex items-center gap-2 text-[11px] py-1.5">
            <span className="text-zinc-500 font-mono text-[10px] w-16 flex-shrink-0 truncate">{action.nodeId}</span>
            <span className="text-zinc-400">{action.field}</span>
            <ArrowRight size={12} className="text-zinc-600 flex-shrink-0" />
            <span className="text-emerald-400 font-mono text-[10px] truncate max-w-[160px]">
              {typeof action.newValue === 'string' && action.newValue.length > 40
                ? action.newValue.slice(0, 40) + '...'
                : String(action.newValue || '')}
            </span>
          </div>
        );

      case 'batchUpdateByType':
        return (
          <div key={index} className="flex items-center gap-2 text-[11px] py-1.5">
            <span className="text-indigo-400 font-mono text-[10px] bg-indigo-500/10 px-1.5 py-0.5 rounded">
              所有 {action.nodeType}
            </span>
            <span className="text-zinc-400">{action.field}</span>
            <ArrowRight size={12} className="text-zinc-600 flex-shrink-0" />
            <span className="text-emerald-400 font-mono text-[10px]">{String(action.newValue || '')}</span>
            {action.reason && (
              <span className="text-zinc-600 text-[9px] ml-auto">{action.reason}</span>
            )}
          </div>
        );

      case 'batchUpdateByFilter':
        return (
          <div key={index} className="flex items-center gap-2 text-[11px] py-1.5">
            <span className="text-amber-400 font-mono text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded">
              {action.filter?.field} {action.filter?.operator} {action.filter?.value}
            </span>
            <span className="text-zinc-400">→ {action.field}</span>
            <ArrowRight size={12} className="text-zinc-600 flex-shrink-0" />
            <span className="text-emerald-400 font-mono text-[10px]">{String(action.newValue || '')}</span>
          </div>
        );

      case 'createNode':
        return (
          <div key={index} className="flex items-center gap-2 text-[11px] py-1.5">
            <Plus size={14} className="text-emerald-400 flex-shrink-0" />
            <span className="text-emerald-400 font-mono text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded">
              {action.nodeType}
            </span>
            {action.connectTo && (
              <>
                <Link size={12} className="text-indigo-400 flex-shrink-0" />
                <span className="text-zinc-500 font-mono text-[10px]">← {action.connectTo}</span>
              </>
            )}
          </div>
        );

      case 'deleteNode':
        return (
          <div key={index} className="flex items-center gap-2 text-[11px] py-1.5">
            <Trash2 size={14} className="text-red-400 flex-shrink-0" />
            <span className="text-red-400 font-mono text-[10px]">{action.nodeId}</span>
            {action.reason && (
              <span className="text-zinc-600 text-[9px]">{action.reason}</span>
            )}
          </div>
        );

      case 'addEdge':
        return (
          <div key={index} className="flex items-center gap-2 text-[11px] py-1.5">
            <Link size={14} className="text-indigo-400 flex-shrink-0" />
            <span className="text-zinc-500 font-mono text-[10px]">{action.source}</span>
            <ArrowRight size={12} className="text-zinc-600 flex-shrink-0" />
            <span className="text-zinc-500 font-mono text-[10px]">{action.target}</span>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-indigo-500/[0.04] border border-indigo-500/20 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* 顶栏：标题 + 操作数 */}
      <div className="px-3.5 py-2.5 border-b border-white/[0.05] flex items-center justify-between bg-indigo-500/[0.03]">
        <span className="text-[11px] font-extrabold text-indigo-300 tracking-widest flex items-center gap-1.5">
          <SparklesIcon size={14} />
          AI 行动计划
        </span>
        <span className="text-[10px] font-mono text-zinc-500 bg-black/30 px-2 py-0.5 rounded-full">
          {actions.length} 项修改
        </span>
      </div>

      {/* 变更列表 */}
      <div className="px-3.5 py-2 max-h-[200px] overflow-y-auto custom-scrollbar divide-y divide-white/[0.03]">
        {actions.map((action, index) => renderActionDescription(action, index))}
      </div>

      {/* 底部操作按钮 */}
      <div className="px-3.5 py-2.5 border-t border-white/[0.05] flex items-center justify-end gap-2 bg-indigo-500/[0.02]">
        <button
          onClick={onCancel}
          className="px-3.5 py-1.5 rounded-xl border border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/20 text-[11px] font-medium transition-all flex items-center gap-1.5"
        >
          <X size={13} />
          取消
        </button>
        <button
          onClick={onApply}
          className="px-3.5 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-[11px] font-bold transition-all active:scale-[0.97] shadow-[0_5px_15px_rgba(99,102,241,0.3)] flex items-center gap-1.5"
        >
          <Check size={13} />
          应用全部
        </button>
      </div>
    </div>
  );
}

// 内联 Sparkles 图标（避免额外 import）
function SparklesIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M5 19l.5 1.5L7 21l-1.5.5L5 23l-.5-1.5L3 21l1.5-.5L5 19z" />
      <path d="M19 5l.5 1.5L21 7l-1.5.5L19 9l-.5-1.5L17 7l1.5-.5L19 5z" />
    </svg>
  );
}
