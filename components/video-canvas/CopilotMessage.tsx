// components/video-canvas/CopilotMessage.tsx
// ★ 副驾驶消息气泡组件 — 用户/AI 消息的展示

"use client";

import React from 'react';
import { CopilotMessage as CopilotMessageType } from '@/hooks/useCanvasCopilot';
import { User, Sparkles, Loader2 } from 'lucide-react';

interface CopilotMessageProps {
  message: CopilotMessageType;
}

export default function CopilotMessageBubble({ message }: CopilotMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // 系统消息不渲染
  if (isSystem) return null;

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-200`}>
      {/* 头像图标 */}
      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
        isUser 
          ? 'bg-indigo-500/20 border border-indigo-500/30' 
          : 'bg-emerald-500/20 border border-emerald-500/30'
      }`}>
        {isUser 
          ? <User size={13} className="text-indigo-400" />
          : <Sparkles size={13} className="text-emerald-400" />
        }
      </div>

      {/* 消息气泡 */}
      <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[12px] leading-relaxed whitespace-pre-wrap break-words ${
        isUser
          ? 'bg-indigo-500/15 border border-indigo-500/20 text-zinc-200 rounded-tr-md'
          : 'bg-white/[0.04] border border-white/[0.06] text-zinc-300 rounded-tl-md'
      }`}>
        {/* 流式输出中：显示文字 + 闪烁光标 */}
        {message.isStreaming ? (
          <span>
            {message.content || '思考中...'}
            <span className="inline-block w-1.5 h-4 bg-emerald-400 ml-0.5 animate-pulse align-middle" />
          </span>
        ) : (
          message.content || (
            <span className="flex items-center gap-1.5 text-zinc-500">
              <Loader2 size={12} className="animate-spin" />
              处理中...
            </span>
          )
        )}

        {/* 时间戳 */}
        <div className={`text-[9px] mt-1 text-zinc-600 ${isUser ? 'text-right' : 'text-left'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
