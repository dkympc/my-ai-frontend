// components/chat/ChatView.tsx
"use client";

import React, { useRef, useEffect } from 'react';
import { 
  ChevronDown, Check, Github, Settings, X, 
  FileText, PlusCircle, Globe, Mic, Square, ArrowUp 
} from 'lucide-react';

import { MODELS } from '@/lib/constants';
import { useAppStore } from '@/store/useAppStore';
import MessageBubble from './MessageBubble';

interface ChatViewProps {
  isChatStarted: boolean;
  isModelMenuOpen: boolean;
  setIsModelMenuOpen: (val: boolean) => void;
  currentModelId: string;
  handleModelChange: (e: React.MouseEvent, id: string) => void;
  modelMenuRef: React.RefObject<HTMLDivElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  handleContainerScroll: () => void;
  messages: any[];
  currentSessionId: string | null;
  setInput: (val: string) => void;
  setSessions: React.Dispatch<React.SetStateAction<any[]>>;
  isTyping: boolean;
  setPreviewFileContent: (val: any) => void;
  attachedFile: any;
  setAttachedFile: (val: any) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  input: string;
  handlePaste: (e: React.ClipboardEvent) => void;
  handleSend: (overrideInput?: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isWebSearchEnabled: boolean;
  setIsWebSearchEnabled: (val: boolean) => void;
  stopTyping: () => void;
}

export default function ChatView({
  isChatStarted, isModelMenuOpen, setIsModelMenuOpen,
  currentModelId, handleModelChange, modelMenuRef,
  scrollRef, handleContainerScroll, messages,
  currentSessionId, setInput, setSessions,
  isTyping, setPreviewFileContent, attachedFile,
  setAttachedFile, textareaRef, input,
  handlePaste, handleSend, fileInputRef,
  handleFileChange, isWebSearchEnabled, setIsWebSearchEnabled,
  stopTyping
}: ChatViewProps) {
  
  const { activeView, setIsSettingsModalOpen } = useAppStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAutoScrolling = useRef(true); // 🚀 记录当前是否应该自动滚动

  // 🚀 核心修复 2：监听用户鼠标滚动
  // 如果用户往上滑了超过 100px，我们就把 isAutoScrolling 设为 false，停止跟随。
  // 如果用户手动拉回底部，就恢复跟随。
  // 🚀 核心修复 1：引入滚动节流，彻底消灭 DOM 强制同步重排 (Layout Thrashing)
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  const onUserScroll = () => {
    if (scrollTimeout.current) return; // 节流拦截
    
    scrollTimeout.current = setTimeout(() => {
      if (!scrollRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      isAutoScrolling.current = distanceFromBottom < 100;
      
      if (handleContainerScroll) handleContainerScroll();
      scrollTimeout.current = null; // 释放锁
    }, 150); // 每 150ms 才允许浏览器计算一次高度，完美释放主线程！
  };

  // 根据 isAutoScrolling 决定要不要把屏幕拉下来
  useEffect(() => {
    if (isAutoScrolling.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [messages, isTyping]);

  if (activeView !== 'chat') return null;

  return (
    <>
      {/* 顶部透明导航栏 */}
      <header className="p-4 flex justify-between items-center bg-transparent sticky top-0 z-10">
        <div className="relative" ref={modelMenuRef as React.RefObject<HTMLDivElement>}>
          <button onClick={() => !isChatStarted && setIsModelMenuOpen(!isModelMenuOpen)} className={`flex items-center gap-2 group px-2 py-1 transition-all duration-300 ${isChatStarted ? 'cursor-default opacity-50' : 'cursor-pointer hover:scale-[1.02] hover:-translate-y-[1px]'}`}>
            <span className={`text-[15px] font-bold transition-all duration-300 tracking-wide ${isChatStarted ? 'text-zinc-500' : 'text-zinc-400 group-hover:text-white group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]'}`}>
              {MODELS.find(m => m.id === currentModelId)?.name || currentModelId}
            </span>
            {!isChatStarted && <ChevronDown size={14} className={`text-zinc-600 group-hover:text-white transition-all duration-300 ${isModelMenuOpen ? 'rotate-180' : ''}`} />}
          </button>

          {isModelMenuOpen && !isChatStarted && (
            <div className="absolute left-0 mt-3 w-64 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[100] py-2 px-1 animate-in fade-in zoom-in-95 duration-200">
              <div className="px-4 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">选择引擎</div>
              {MODELS.map((model) => (
                <button key={model.id} onClick={(e) => handleModelChange(e, model.id)} className={`flex items-center justify-between w-full px-4 py-3 text-sm rounded-xl transition-all duration-300 mb-0.5 group ${currentModelId === model.id ? 'bg-white/10 text-white shadow-inner' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
                  <div className="flex flex-col items-start"><span className="font-semibold">{model.name}</span><span className="text-[10px] text-zinc-500 opacity-80 group-hover:text-zinc-400 transition-colors">{model.desc}</span></div>
                  {currentModelId === model.id && <Check size={14} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-5 text-zinc-500">
          <Github size={18} className="hover:text-white hover:scale-110 cursor-pointer transition-all duration-300" />
          <Settings size={18} className="hover:text-white hover:scale-110 hover:rotate-90 cursor-pointer transition-all duration-500" onClick={() => setIsSettingsModalOpen(true)} />
        </div>
      </header>

      {/* 🚀 注入全新的 onScroll 事件 */}
      <div ref={scrollRef as React.RefObject<HTMLDivElement>} onScroll={onUserScroll} className="flex-1 overflow-y-auto px-4 py-8 custom-scrollbar relative">
      {messages.length === 0 ? (
          <div className="mt-8 flex flex-col items-center max-w-3xl mx-auto text-center">
            <div className="mb-5 flex items-center justify-center select-none">
              <span className="text-3xl font-light tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-zinc-500 drop-shadow-[0_0_25px_rgba(255,255,255,0.12)] select-none">
                无中生
                <span className="mx-2 text-white/15 font-thin text-xl">|</span>
                <span className="text-white/40 font-thin tracking-[0.25em] text-lg">AI</span>
              </span>
            </div>
            
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-zinc-200 mb-1 tracking-wide drop-shadow-sm">{MODELS.find(m => m.id === currentModelId)?.name}</h2>
              <h1 className="text-xl font-medium text-zinc-500 tracking-wide">有什么我能帮您的吗？</h1>
            </div>
            
            <div className="flex items-center justify-center mb-5 opacity-40">
              <Globe size={16} className="text-zinc-400" />
            </div>
            
            <div className="grid grid-cols-2 gap-2 w-full px-2 max-w-xl mx-auto">
              {["Give me ideas", "Explain options trading", "Overcome procrastination", "Help me study"].map((t, i) => (
                <div key={i} className="group cursor-pointer py-3 !bg-transparent !border-none transition-all duration-500 ease-out hover:-translate-y-1 hover:scale-[1.03]" onClick={() => handleSend(t)}>
                  <div className="text-[13.5px] font-medium text-zinc-600 group-hover:text-white transition-all duration-500 text-center group-hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.6)] tracking-wide">{t}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-10 pb-8">
            {messages.map((m, i) => (
              <MessageBubble 
                key={`${currentSessionId}-${i}`} 
                message={m} 
                isTyping={isTyping} 
                isLast={i === messages.length - 1} 
                onEdit={() => {
                  const text = typeof m.content === 'string' ? m.content : m.content.find((p:any)=>p.type==='text')?.text || '';
                  setInput(text.replace('\n\n【用户附件内容】\n', '').split('```')[0].trim());
                  setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: s.messages.slice(0, i) } : s));
                }} 
              />
            ))}
            {/* 📍 自动滚动到底部的隐形锚点 */}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>
      
      <div className="p-4 flex flex-col items-center"> 
        <div className="max-w-3xl w-full relative px-4">
          {attachedFile && (
            <div className="absolute -top-24 left-6 animate-in slide-in-from-bottom-2 duration-300 z-50">
              <div className="relative group flex items-center gap-3 bg-black/60 backdrop-blur-2xl border border-white/10 p-3 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.8)] min-w-[200px] hover:scale-[1.02] transition-transform">
                {attachedFile.isImage ? (<img src={attachedFile.data} className="w-12 h-12 object-cover rounded-xl border border-white/10" />) : (<div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white"><FileText size={20} /></div>)}
                <div className="flex flex-col max-w-[140px]"><span className="text-xs font-bold text-zinc-200 truncate">{attachedFile.name}</span><span className="text-[10px] text-zinc-500 font-mono mt-0.5">{(attachedFile.size / 1024).toFixed(1)} KB</span></div>
                <button onClick={() => setAttachedFile(null)} className="absolute -top-2 -right-2 bg-zinc-800 text-white rounded-full p-1.5 shadow-xl hover:scale-110 hover:bg-zinc-700 transition-all border border-white/10"><X size={10} /></button>
              </div>
            </div>
          )}

          <div className="bg-black/40 border border-white/10 backdrop-blur-3xl rounded-[32px] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.8)] focus-within:border-white/30 focus-within:shadow-[0_20px_60px_rgba(255,255,255,0.05)] transition-all duration-500 overflow-hidden group">
            <textarea ref={textareaRef as React.RefObject<HTMLTextAreaElement>} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} onPaste={handlePaste} placeholder={`给 ${MODELS.find(m => m.id === currentModelId)?.name} 发送消息...`} className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-zinc-200 px-5 py-3 min-h-[44px] resize-none text-[15px] leading-relaxed custom-scrollbar placeholder-zinc-600" style={{ height: 'auto' }} />
            
            <div className="flex items-center justify-between px-3 pb-1">
              <div className="flex items-center gap-1">
                <input type="file" ref={fileInputRef as React.RefObject<HTMLInputElement>} onChange={handleFileChange} className="hidden" accept="*" />
                <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-zinc-500 hover:text-white rounded-full transition-all hover:bg-white/10 hover:scale-110"><PlusCircle size={18} /></button>
                
                <button 
                  onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)} 
                  className={`p-2.5 rounded-full transition-all duration-500 ${
                    isWebSearchEnabled 
                      ? 'text-white bg-white/20 shadow-[0_0_15px_rgba(255,255,255,0.3)] scale-110' 
                      : 'text-zinc-500 hover:text-white hover:bg-white/10 hover:scale-110'
                  }`}
                >
                  <Globe size={18} className={isWebSearchEnabled ? "animate-pulse" : ""} />
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <button className="p-2.5 text-zinc-500 hover:text-white rounded-full transition-all hover:bg-white/10 hover:scale-110"><Mic size={18} /></button>
                {isTyping ? (
                  <button onClick={stopTyping} className="p-2.5 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:scale-110 animate-pulse border border-white/20">
                    <Square size={16} className="fill-current" />
                  </button>
                ) : (
                  <button onClick={() => handleSend()} disabled={!input.trim() && !attachedFile} className={`p-2.5 rounded-full transition-all duration-500 ${(input.trim() || attachedFile) ? "bg-white text-black hover:scale-110 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.4)]" : "bg-white/5 text-zinc-600"}`}><ArrowUp size={18} strokeWidth={3} /></button>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-4 text-center pb-6">
            <p className="text-[10px] text-zinc-600 font-medium tracking-widest uppercase">无中生引擎 · AI生成可能产生事实错误</p>
          </div>
        </div>
      </div>
    </>
  );
}