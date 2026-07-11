// components/workflow/WorkflowCenter.tsx
"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  ArrowRight, ChevronDown, Upload, Check, Play, 
  Loader2, Clock, Plus, Trash2, FileText, FileCode, File, 
  X, PlusCircle, ArrowUp, ArrowLeft, Bot
} from 'lucide-react';

import { WORKFLOW_REGISTRY } from '@/lib/constants';
import { useAppStore } from '@/store/useAppStore';

interface WorkflowCenterProps {
  activeWfCategory: string;
  setActiveWfCategory: (val: string) => void;
  activeWfId: string | null;
  setActiveWfId: (val: string | null) => void;
  wfFormValues: Record<string, any>;
  setWfFormValues: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  isWfRunning: boolean;
  wfInput: string;
  setWfInput: (val: string) => void;
  wfSessions: any[];
  setWfSessions: React.Dispatch<React.SetStateAction<any[]>>;
  activeWfSessionId: string | null;
  setActiveWfSessionId: (val: string | null) => void;
  isWfHistoryMenuOpen: boolean;
  setIsWfHistoryMenuOpen: (val: boolean) => void;
  wfMessages: any[];
  activeWorkflowData: any;
  handleWfFileUpload: (e: React.ChangeEvent<HTMLInputElement>, inputKey: string) => void;
  handleRunWorkflow: (isChat: boolean, chatText?: string) => void;
  wfResultScrollRef: React.RefObject<HTMLDivElement | null>;
  wfTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  attachedFile: any;
  setAttachedFile: (val: any) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setPreviewFileContent: (val: any) => void;
}

export default function WorkflowCenter({
  activeWfCategory, setActiveWfCategory, activeWfId, setActiveWfId,
  wfFormValues, setWfFormValues, isWfRunning, wfInput, setWfInput,
  wfSessions, setWfSessions, activeWfSessionId, setActiveWfSessionId,
  isWfHistoryMenuOpen, setIsWfHistoryMenuOpen, wfMessages, activeWorkflowData,
  handleWfFileUpload, handleRunWorkflow, wfResultScrollRef, wfTextareaRef,
  attachedFile, setAttachedFile, handleFileChange, setPreviewFileContent
}: WorkflowCenterProps) {
  
  const { activeView, setActiveView } = useAppStore();

  return (
    <>
      {activeView === 'workflow-gallery' && (
        <div className="flex flex-col h-full overflow-hidden bg-transparent">
          {/* 画廊头部 
              🚀 修复重点：将 pb-6 改为了 pb-2，把多出来的空间让给下方的滚动容器 
          */}
          <header className="px-10 pt-12 pb-2 shrink-0 relative z-10 select-none">
            <div className="flex flex-col gap-2">
              <h1 className="text-[28px] font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-500 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                {activeWfCategory === 'all' ? '热门智能应用' : 
                 activeWfCategory === 'content' ? '内容创作引擎' :
                 activeWfCategory === 'image' ? '视觉图像处理' : 
                 activeWfCategory === 'data' ? '数据自动化' : '自动化 Agent'}
              </h1>
              <p className="text-[13px] text-zinc-500 tracking-wider font-light">
                选择一个工作流，将繁琐的步骤交给 AI 自动完成。
              </p>
            </div>
          </header>

          {/* 画廊卡片 
              🚀 修复重点：新增了 pt-6 (Padding Top)，让卡片在滚动容器内部拥有了上方呼吸空间，彻底杜绝悬浮截断！
          */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-10 pt-6 pb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {WORKFLOW_REGISTRY
                .filter(wf => activeWfCategory === 'all' || wf.category === activeWfCategory)
                .map(wf => (
                  <div 
                    key={wf.id}
                    onClick={() => { 
                      setActiveWfId(wf.id); 
                      setActiveView('workflow-execution'); 
                      setWfFormValues({}); 
                      setWfInput("");
                      const existingSessions = wfSessions.filter(s => s.workflowId === wf.id).sort((a, b) => b.updatedAt - a.updatedAt);
                      setActiveWfSessionId(existingSessions.length > 0 ? existingSessions[0].id : null);
                    }}
                    className="group relative h-48 p-6 cursor-pointer rounded-[24px] overflow-hidden transition-all duration-500 ease-out hover:-translate-y-1.5"
                  >
                    <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-[24px] transition-all duration-500 group-hover:bg-white/[0.04] group-hover:border-white/[0.12] group-hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)]" />
                    <div className="absolute -top-20 -right-20 w-48 h-48 bg-white/5 rounded-full blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                    <div className="relative z-10 flex flex-col h-full">
                      <div className="w-10 h-10 mb-4 flex items-center justify-start relative">
                        <div className="relative z-10 transition-transform duration-500 group-hover:scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                          {wf.icon}
                        </div>
                      </div>
                      <h3 className="text-[15px] font-medium text-zinc-200 mb-2 tracking-wide group-hover:text-white transition-colors duration-300">
                        {wf.name}
                      </h3>
                      <p className="text-[12px] text-zinc-500 leading-relaxed line-clamp-2 transition-colors duration-300 group-hover:text-zinc-400 font-light">
                        {wf.desc}
                      </p>
                      <div className="mt-auto flex justify-end">
                        <div className="w-7 h-7 rounded-full border border-white/0 flex items-center justify-center opacity-0 -translate-x-4 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:translate-x-0 group-hover:border-white/10 group-hover:bg-white/5">
                          <ArrowRight size={14} className="text-white" />
                        </div>
                      </div>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 工作流执行页面 */}
      {activeView === 'workflow-execution' && activeWorkflowData && (
        <div className="flex h-full w-full overflow-hidden bg-transparent">
          
          {/* 左侧配置栏 (部分引擎如 Agent / 生图才需要) */}
          {activeWorkflowData.engine !== 'dify' && (
            <div className="w-[360px] shrink-0 bg-black/20 backdrop-blur-3xl border-r border-white/[0.05] flex flex-col h-full shadow-2xl z-10 relative">
              <header className="p-5 border-b border-white/[0.05] flex items-center gap-3 shrink-0">
                <button onClick={() => setActiveView('workflow-gallery')} className="p-1.5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"><ArrowLeft size={18} /></button>
                <div className="flex-1 truncate">
                  <div className="text-[15px] font-bold text-zinc-200 truncate tracking-wide">{activeWorkflowData.name}</div>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                <div className="text-xs text-zinc-400 font-light leading-relaxed">{activeWorkflowData.desc}</div>
                <div className="space-y-6">
                  {activeWorkflowData.inputs.map((input: any) => (
                    <div key={input.key} className="space-y-2">
                      <label className="text-[11px] font-medium text-zinc-500 tracking-wider">{input.label}</label>
                      {input.type === 'text' && <input type="text" value={wfFormValues[input.key] || ''} onChange={(e) => setWfFormValues({...wfFormValues, [input.key]: e.target.value})} placeholder={input.placeholder} className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-white/20 focus:bg-white/[0.04] transition-all outline-none" />}
                      {input.type === 'textarea' && <textarea value={wfFormValues[input.key] || ''} onChange={(e) => setWfFormValues({...wfFormValues, [input.key]: e.target.value})} placeholder={input.placeholder} className="w-full h-24 bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-white/20 focus:bg-white/[0.04] transition-all outline-none resize-none custom-scrollbar" />}
                      {input.type === 'select' && (
                        <div className="relative">
                          <select value={wfFormValues[input.key] || (input.options ? input.options[0] : '')} onChange={(e) => setWfFormValues({...wfFormValues, [input.key]: e.target.value})} className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-white/20 focus:bg-white/[0.04] transition-all outline-none appearance-none cursor-pointer">
                            {input.options?.map((opt: string) => <option key={opt} value={opt} className="bg-[#1a1a1a]">{opt}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                        </div>
                      )}
                      {input.type === 'file' && (
                        <label className="w-full py-5 border border-dashed border-white/[0.1] rounded-xl flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-zinc-300 hover:border-white/20 hover:bg-white/[0.02] transition-all cursor-pointer relative overflow-hidden">
                          <input type="file" className="hidden" onChange={(e) => handleWfFileUpload(e, input.key)} />
                          {wfFormValues[input.key] ? (
                             <div className="text-center">
                               <Check size={20} className="mx-auto text-zinc-300 mb-1" />
                               <span className="text-[11px] font-medium text-zinc-400">已载入</span>
                             </div>
                          ) : (
                             <>
                               <Upload size={20} />
                               <span className="text-[11px] font-medium">点击上传文件</span>
                             </>
                          )}
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 shrink-0">
                <button onClick={() => handleRunWorkflow(false)} disabled={isWfRunning} className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold transition-all shadow-lg ${isWfRunning ? 'bg-white/5 text-zinc-500 cursor-not-allowed' : 'bg-white text-black hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]'}`}>
                  {isWfRunning ? <><Loader2 size={16} className="animate-spin" /> 运转中...</> : <><Play size={16} className="fill-black" /> 执行</>}
                </button>
              </div>
            </div>
          )}

          {/* 右侧对话执行区 (Dify Chatflow 专属或通用结果展示区) */}
          <div className="flex-1 flex flex-col relative bg-transparent">
            
            {/* 顶部透明导航条 */}
            {activeWorkflowData.engine === 'dify' && (
              <header className="p-4 flex items-center gap-3 shrink-0 bg-transparent sticky top-0 z-20">
                <button onClick={() => setActiveView('workflow-gallery')} className="p-1.5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors">
                  <ArrowLeft size={18} />
                </button>
                <div className="flex items-center gap-2 select-none">
                  <span className="text-[15px] font-bold tracking-wide text-zinc-400 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                    {activeWorkflowData.name}
                  </span>
                </div>

                <div className="flex-1"></div>
                
                {/* 历史记录下拉，同步玻璃化 */}
                <div className="relative wf-history-dropdown">
                  <button onClick={() => setIsWfHistoryMenuOpen(!isWfHistoryMenuOpen)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-all">
                    <Clock size={14} /> <span>历史记录 ({wfSessions.filter(s => s.workflowId === activeWfId).length})</span>
                  </button>
                  
                  {isWfHistoryMenuOpen && (
                    <div className="absolute top-full right-0 mt-3 w-64 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-2 z-[100] animate-in fade-in zoom-in-95 duration-200">
                      <button onClick={() => { setActiveWfSessionId(null); setIsWfHistoryMenuOpen(false); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-white hover:bg-white/10 rounded-xl mb-1 flex items-center gap-2 transition-all">
                        <Plus size={14} strokeWidth={3} /> 开启全新任务
                      </button>
                      
                      <div className="max-h-64 overflow-y-auto custom-scrollbar border-t border-white/5 pt-1">
                        {wfSessions.filter(s => s.workflowId === activeWfId).sort((a,b) => b.updatedAt - a.updatedAt).map(s => (
                          <div key={s.id} className={`group flex items-center justify-between px-3 py-2.5 text-xs rounded-xl cursor-pointer transition-all ${activeWfSessionId === s.id ? 'bg-white/10 text-white shadow-inner' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`} onClick={() => { setActiveWfSessionId(s.id); setIsWfHistoryMenuOpen(false); }}>
                            <span className="truncate flex-1 pr-2 font-medium">{s.title}</span>
                            <button onClick={(e) => { e.stopPropagation(); setWfSessions(prev => prev.filter(x => x.id !== s.id)); if (activeWfSessionId === s.id) setActiveWfSessionId(null); }} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all"><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </header>
            )}

            {/* 对话流/结果展示区 */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative z-10" ref={wfResultScrollRef}>
              {wfMessages.length === 0 && !isWfRunning ? (
                /* 空状态：极简透明风 */
                activeWorkflowData.engine === 'dify' ? (
                  <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto opacity-80">
                    <div className="mb-6 opacity-60 scale-125 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                      {activeWorkflowData.icon}
                    </div>
                    <h3 className="text-xl font-medium text-zinc-300 mb-2 tracking-wide">{activeWorkflowData.name}</h3>
                    <p className="text-[13px] text-zinc-500 font-light leading-relaxed">{activeWorkflowData.desc}</p>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto opacity-80">
                    <div className="mb-6 opacity-60 scale-125 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                      {activeWorkflowData.icon}
                    </div>
                    <h3 className="text-xl font-medium text-zinc-300 mb-2 tracking-wide">等待参数输入</h3>
                    <p className="text-[13px] text-zinc-500 font-light leading-relaxed">在左侧配置面板设定好参数后，点击“执行”即可看到 AI 魔法。</p>
                  </div>
                )
              ) : (
                /* 聊天气泡列表：同步 ChatView 黑玻璃风 */
                <div className="max-w-4xl mx-auto space-y-8 pb-32 pt-4">
                  {wfMessages.map((msg, idx) => (
                    <div key={idx} className={`group flex gap-5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} message-appear`}>
                      
                      {/* AI 头像 */}
                      {msg.role !== 'user' && (
                        <div className="w-8 h-8 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center border border-white/10 text-zinc-400 flex-shrink-0 shadow-lg mt-1">
                          <Bot size={16}/>
                        </div>
                      )}

                      {/* 气泡本体 */}
                      <div className={`max-w-[85%] rounded-[24px] px-6 py-4 ${msg.role === 'user' ? 'bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] text-zinc-100' : 'text-zinc-300 bg-transparent border-none shadow-none leading-relaxed'}`}>
                        <div className={msg.role === 'assistant' && idx === wfMessages.length - 1 && isWfRunning ? "typing-cursor" : ""}>
                          
                          {/* 渲染图片与文件附件 */}
                          {Array.isArray(msg.content) ? (
                            <div className="space-y-4">
                              {msg.content.map((part: any, pIdx: number) => (
                                <div key={pIdx}>
                                  {part.type === 'text' && (
                                    <ReactMarkdown components={{
                                      code({ node, inline, className, children, ...props }: any) {
                                        const match = /language-(\w+)/.exec(className || '');
                                        return !inline && match ? (
                                          <div className="my-4 rounded-xl overflow-hidden border border-white/10 shadow-2xl"><SyntaxHighlighter style={vscDarkPlus as any} language={match[1]} PreTag="div" {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter></div>
                                        ) : ( <code className={`${className} bg-white/10 rounded-md px-1.5 py-0.5 text-zinc-200 font-mono text-sm border border-white/5`} {...props}>{children}</code> );
                                      },
                                    }}>{part.text}</ReactMarkdown>
                                  )}
                                  {part.type === 'image_url' && (
                                    part.image_url.url.startsWith('data:image') ? (
                                      <img src={part.image_url.url} alt="Uploaded" className="max-w-full rounded-xl border border-white/10 shadow-2xl mt-2" />
                                    ) : (
                                      <div 
                                      onClick={() => part.image_url._fileData && setPreviewFileContent({ name: part.image_url.url.replace('file-text:', ''), content: part.image_url._fileData })}
                                      className={`flex items-center justify-between p-3 border border-white/10 rounded-xl max-w-sm mt-2 transition-all ${part.image_url._fileData ? 'bg-white/5 hover:bg-white/10 cursor-pointer group' : 'bg-white/5'}`}
                                      title={part.image_url._fileData ? "点击查看文件内容" : "该文件暂无提取文本"}
                                    >
                                      <div className="flex items-center gap-3 overflow-hidden">
                                        <FileText className="text-zinc-400 flex-shrink-0" size={24} />
                                        <div className="truncate text-sm font-medium text-zinc-200">文件: {part.image_url.url.replace('file-text:', '')}</div>
                                      </div>
                                      {part.image_url._fileData && <span className="text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 px-2 py-1 rounded">查看</span>}
                                    </div>
                                    )
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            /* 普通文本渲染 */
                            <ReactMarkdown components={{
                              code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <div className="my-4 rounded-xl overflow-hidden border border-white/10 shadow-2xl"><SyntaxHighlighter style={vscDarkPlus as any} language={match[1]} PreTag="div" {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter></div>
                                ) : ( <code className={`${className} bg-white/10 rounded-md px-1.5 py-0.5 text-zinc-200 font-mono text-sm border border-white/5`} {...props}>{children}</code> );
                              },
                            }}>{msg.content}</ReactMarkdown>
                          )}

                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 🚨 底部输入框：100% 复刻 ChatView 顶级黑玻璃 */}
            {(activeWorkflowData.engine === 'dify' || wfMessages.length > 0) && (
              <div className="p-4 flex flex-col items-center bg-gradient-to-t from-[#020203] via-[#020203]/80 to-transparent absolute bottom-0 left-0 right-0 z-20">
                <div className="max-w-3xl w-full relative px-4">
                  
                  {/* 悬浮的附件预览模块 (黑玻璃) */}
                  {attachedFile && (
                    <div className="absolute -top-20 left-6 animate-in slide-in-from-bottom-2 duration-300 z-50">
                      <div className="relative group flex items-center gap-3 bg-black/60 backdrop-blur-2xl border border-white/10 p-3 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.8)] min-w-[200px] hover:scale-[1.02] transition-transform">
                        {attachedFile.isImage ? (<img src={attachedFile.data} className="w-10 h-10 object-cover rounded-xl border border-white/10" />) : (<div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white"><FileText size={20} /></div>)}
                        <div className="flex flex-col max-w-[130px]"><span className="text-xs font-bold text-zinc-100 truncate">{attachedFile.name}</span></div>
                        <button onClick={() => setAttachedFile(null)} className="absolute -top-2 -right-2 bg-zinc-800 text-white rounded-full p-1.5 shadow-xl hover:scale-110 hover:bg-zinc-700 transition-all border border-white/10"><X size={10} /></button>
                      </div>
                    </div>
                  )}

                  {/* 核心输入框本体 (极强拟态黑玻璃) */}
                  <div className="bg-black/40 border border-white/10 backdrop-blur-3xl rounded-[32px] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.8)] focus-within:border-white/30 focus-within:shadow-[0_20px_60px_rgba(255,255,255,0.05)] transition-all duration-500 overflow-hidden group">
                    <input type="file" id="wf-chat-file" className="hidden" onChange={handleFileChange} accept="*" />
                    
                    <div className="flex items-end">
                      {/* 上传文件小按钮 */}
                      <button onClick={() => document.getElementById('wf-chat-file')?.click()} className="p-3 text-zinc-500 hover:text-white rounded-full transition-all hover:bg-white/10 mb-1 ml-1 shrink-0">
                        <PlusCircle size={20} />
                      </button>

                      <textarea
                        ref={wfTextareaRef}
                        value={wfInput}
                        onChange={(e) => setWfInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleRunWorkflow(true, wfInput))}
                        placeholder="向引擎发送指令以推进工作流..."
                        className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-zinc-200 px-3 py-3.5 min-h-[44px] resize-none text-[15px] leading-relaxed custom-scrollbar placeholder-zinc-600"
                        style={{ height: 'auto' }}
                      />
                      
                      {/* 发送按钮发光质感 */}
                      <button 
                        onClick={() => handleRunWorkflow(true, wfInput)} 
                        disabled={(!wfInput.trim() && !attachedFile) || isWfRunning} 
                        className={`p-3 rounded-full transition-all duration-500 mb-1 mr-1 shrink-0 ${((wfInput.trim() || attachedFile) && !isWfRunning) ? 'bg-white text-black hover:scale-110 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.4)]' : 'bg-white/5 text-zinc-600'}`}
                      >
                        <ArrowUp size={18} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                  
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </>
  );
}