// components/modals/AdminRecordsModal.tsx
"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, X, MessageSquare, Puzzle, Image as ImageIcon, Film, Archive as ArchiveIcon, ArrowLeft, Download, PenTool, Clapperboard, FileText, Bot } from 'lucide-react';

interface AdminRecordsModalProps {
  viewingUserChats: any;
  setViewingUserChats: (val: any) => void;
  viewingUsername: string;
  adminViewTab: 'chats' | 'images' | 'videos' | 'workflows';
  setAdminViewTab: (val: 'chats' | 'images' | 'videos' | 'workflows') => void;
  viewingSpecificChat: any;
  setViewingSpecificChat: (val: any) => void;
  handleDownloadSpecificRecord: () => void;
  setPreviewFileContent: (val: any) => void;
}

export default function AdminRecordsModal({
  viewingUserChats, setViewingUserChats, viewingUsername,
  adminViewTab, setAdminViewTab, viewingSpecificChat,
  setViewingSpecificChat, handleDownloadSpecificRecord,
  setPreviewFileContent
}: AdminRecordsModalProps) {
  return (
    <>
      {/* =========================================
          🗂️ 列表视图 (List View)
          ========================================= */}
      {viewingUserChats !== null && !viewingSpecificChat && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 lg:p-10">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setViewingUserChats(null)} />
          
          <div className="relative w-full max-w-5xl bg-black/80 backdrop-blur-3xl border border-white/[0.08] rounded-[32px] shadow-[0_30px_100px_rgba(0,0,0,0.8)] flex flex-col animate-in zoom-in-95 fade-in duration-300 h-[80vh] overflow-hidden">
            
            {/* Header: 高级黑玻璃顶部 */}
            <div className="flex items-center justify-between p-6 border-b border-white/[0.05] bg-transparent shrink-0">
              <h2 className="text-[20px] font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 flex items-center gap-3">
                <div className="w-10 h-10 rounded-[14px] bg-white/5 border border-white/10 flex items-center justify-center text-white shadow-inner">
                  <User size={18} />
                </div>
                {viewingUsername} 的生成记录库
              </h2>
              <button 
                onClick={() => setViewingUserChats(null)} 
                className="p-3 text-zinc-500 hover:text-white bg-white/[0.02] border border-white/[0.05] rounded-full hover:bg-white/10 transition-all hover:scale-110 outline-none focus:outline-none"
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Tab 切换区: 取消丑陋下划线和白边，改为高级晶体胶囊 */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.05] shrink-0 bg-white/[0.01]">
              {[
                { id: 'chats', label: '智能对话', icon: <MessageSquare size={14}/> },
                { id: 'workflows', label: '工作流引擎', icon: <Puzzle size={14}/> },
                { id: 'images', label: '视觉图像', icon: <ImageIcon size={14}/> },
                { id: 'videos', label: '视频创作', icon: <Film size={14}/> }
              ].map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => setAdminViewTab(tab.id as any)} 
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-[14px] text-[13px] font-medium transition-all duration-300 outline-none focus:outline-none ${
                    adminViewTab === tab.id 
                      ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/10' 
                      : 'bg-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  {tab.icon} {tab.label} 
                  <span className={`px-2 py-0.5 rounded-[6px] text-[10px] font-mono ${adminViewTab === tab.id ? 'bg-white/20 text-white' : 'bg-white/5 text-zinc-500'}`}>
                    {viewingUserChats[tab.id]?.length || 0}
                  </span>
                </button>
              ))}
            </div>
            
            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {(!viewingUserChats[adminViewTab] || viewingUserChats[adminViewTab].length === 0) ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 opacity-60">
                  <ArchiveIcon size={40} className="mb-4 opacity-50 drop-shadow-lg" />
                  <p className="text-[13px] tracking-wide font-light">该分类下暂无任何生成记录</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-w-4xl mx-auto">
                  {adminViewTab === 'chats' && viewingUserChats.chats.map((chat: any) => (
                    <div key={chat.id} onClick={() => setViewingSpecificChat({ ...chat, _type: 'chat' })} className="group flex items-center px-5 py-4 hover:bg-white/[0.04] border border-transparent hover:border-white/[0.05] rounded-[20px] cursor-pointer transition-all duration-300">
                      <div className="flex-1 flex items-center gap-4 truncate pr-4">
                        <MessageSquare size={16} className="text-zinc-400 group-hover:text-white transition-colors" />
                        <span className="text-[14px] text-zinc-300 group-hover:text-white font-medium truncate tracking-wide transition-colors">{chat.title}</span>
                      </div>
                      <div className="text-[11px] text-zinc-600 font-mono tracking-widest">{new Date(chat.updatedAt).toLocaleDateString()}</div>
                    </div>
                  ))}
                  
                  {adminViewTab === 'workflows' && viewingUserChats.workflows.map((wf: any) => (
                    <div key={wf.id} onClick={() => setViewingSpecificChat({ ...wf, _type: 'workflow' })} className="group flex items-center px-5 py-4 hover:bg-white/[0.04] border border-transparent hover:border-white/[0.05] rounded-[20px] cursor-pointer transition-all duration-300">
                      <div className="flex-1 flex items-center gap-4 truncate pr-4">
                        <Puzzle size={16} className="text-zinc-400 group-hover:text-white transition-colors" />
                        <span className="text-[14px] text-zinc-300 group-hover:text-white font-medium truncate tracking-wide transition-colors">{wf.title}</span>
                        <span className="text-[9px] bg-white/5 border border-white/10 text-zinc-400 px-2 py-0.5 rounded-[6px] uppercase tracking-widest">{wf.workflowId}</span>
                      </div>
                      <div className="text-[11px] text-zinc-600 font-mono tracking-widest">{new Date(wf.updatedAt).toLocaleDateString()}</div>
                    </div>
                  ))}
                  
                  {adminViewTab === 'images' && (
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-2">
                      {viewingUserChats.images.map((img: any) => (
                        <div key={img.id} onClick={() => setViewingSpecificChat({ ...img, _type: 'image' })} className="relative aspect-square rounded-[20px] overflow-hidden cursor-pointer group border border-white/10 shadow-lg bg-black/20 backdrop-blur-sm">
                          <img src={img.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                            <p className="text-[10px] text-white line-clamp-3 leading-relaxed font-light">{img.prompt}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {adminViewTab === 'videos' && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-2">
                      {viewingUserChats.videos.map((vid: any) => (
                        <div key={vid.id} onClick={() => setViewingSpecificChat({ ...vid, _type: 'video' })} className="relative aspect-video rounded-[24px] overflow-hidden cursor-pointer group border border-white/10 shadow-lg bg-black">
                          <video src={vid.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-xl border border-white/10 px-2 py-1 rounded-[8px] text-[10px] text-white flex items-center gap-1.5 shadow-md">
                            <Film size={10}/> {vid.duration || 5}s
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                            <p className="text-[11px] text-white line-clamp-2 leading-relaxed font-light">{vid.prompt || '[无文本描述]'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          🔍 详情视图 (Detail View)
          ========================================= */}
      {viewingSpecificChat && (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 lg:p-10">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setViewingSpecificChat(null)} />
          
          <div className="relative w-full max-w-5xl bg-black/60 backdrop-blur-3xl border border-white/[0.08] rounded-[32px] shadow-[0_30px_100px_rgba(0,0,0,0.9)] flex flex-col animate-in zoom-in-95 fade-in duration-300 h-[85vh] overflow-hidden">
            
            {/* Header */}
            <div className="flex flex-col p-6 border-b border-white/[0.05] bg-transparent shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  <button onClick={() => setViewingSpecificChat(null)} className="p-2 text-zinc-500 hover:text-white bg-white/[0.02] border border-white/[0.05] rounded-full hover:bg-white/10 transition-colors outline-none focus:outline-none">
                    <ArrowLeft size={16} />
                  </button>
                  <h2 className="text-[18px] font-bold text-zinc-100 flex items-center gap-2.5 tracking-wide">
                    {viewingSpecificChat._type === 'chat' ? <MessageSquare size={18} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" /> :
                     viewingSpecificChat._type === 'workflow' ? <Puzzle size={18} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" /> :
                     viewingSpecificChat._type === 'image' ? <ImageIcon size={18} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" /> :
                     <Film size={18} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />}
                    {viewingSpecificChat.title || '生成媒体详情'}
                  </h2>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* 下载按钮纯白发光 */}
                  <button onClick={handleDownloadSpecificRecord} className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:scale-105 rounded-[12px] transition-all text-[12px] font-bold shadow-[0_0_20px_rgba(255,255,255,0.2)] outline-none focus:outline-none">
                    <Download size={14} /> 导出记录
                  </button>
                  <button onClick={() => { setViewingSpecificChat(null); setViewingUserChats(null); }} className="p-2.5 text-zinc-500 hover:text-white bg-white/[0.02] border border-white/[0.05] hover:bg-white/10 rounded-full transition-colors outline-none focus:outline-none">
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono ml-12 flex gap-4 uppercase tracking-widest">
                {(viewingSpecificChat._type === 'chat' || viewingSpecificChat._type === 'image' || viewingSpecificChat._type === 'video') && <span>Model: {viewingSpecificChat.model}</span>}
                {viewingSpecificChat._type === 'workflow' && <span>Engine: {viewingSpecificChat.workflowId}</span>}
                {(viewingSpecificChat._type === 'image' || viewingSpecificChat._type === 'video') && <span>Ratio: {viewingSpecificChat.ratio}</span>}
                <span>Time: {new Date(viewingSpecificChat.updatedAt || viewingSpecificChat.timestamp).toLocaleString()}</span>
              </div>
            </div>
            
            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
              
              {/* 💬 对话/工作流内容渲染 (同步 ChatView 高级黑玻璃气泡) */}
              {(viewingSpecificChat._type === 'chat' || viewingSpecificChat._type === 'workflow') && (
                <div className="max-w-4xl mx-auto space-y-8 pb-10">
                  {viewingSpecificChat.messages.map((m: any, i: number) => (
                    <div key={i} className={`flex gap-5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {/* AI 玻璃头像 */}
                      {m.role !== 'user' && (
                        <div className="w-8 h-8 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center border border-white/10 text-zinc-400 flex-shrink-0 shadow-lg mt-1">
                          <Bot size={16}/>
                        </div>
                      )}
                      
                      {/* 玻璃化气泡 */}
                      <div className={`max-w-[85%] rounded-[24px] px-6 py-4 ${m.role === 'user' ? 'bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] text-zinc-100' : 'text-zinc-300 bg-transparent border-none shadow-none leading-relaxed'}`}>
                        {Array.isArray(m.content) ? (
                          <div className="space-y-4">
                            {m.content.map((part: any, pIdx: number) => (
                              <div key={pIdx}>
                                {part.type === 'text' && (
                                  <ReactMarkdown components={{
                                    code({ node, inline, className, children, ...props }: any) {
                                      const match = /language-(\w+)/.exec(className || '');
                                      return !inline && match ? (
                                        <div className="my-4 rounded-xl overflow-hidden border border-white/10 shadow-2xl"><SyntaxHighlighter style={vscDarkPlus as any} language={match[1]} PreTag="div" {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter></div>
                                      ) : ( <code className={`${className} bg-white/10 rounded-md px-1.5 py-0.5 text-zinc-200 font-mono text-sm border border-white/5`} {...props}>{children}</code> );
                                    }
                                  }}>{part.text}</ReactMarkdown>
                                )}
                                {part.type === 'image_url' && (
                                  part.image_url.url.startsWith('data:image') || part.image_url.url.startsWith('http') ? (
                                    <img src={part.image_url.url} alt="Attachment" className="max-w-full rounded-xl border border-white/10 shadow-lg mt-2" />
                                  ) : (
                                    <div 
                                      onClick={() => part.image_url._fileData && setPreviewFileContent({ name: part.image_url.url.replace('file-text:', ''), content: part.image_url._fileData })}
                                      className={`flex items-center justify-between p-3 border border-white/10 rounded-xl max-w-sm mt-2 transition-all ${part.image_url._fileData ? 'bg-white/5 hover:bg-white/10 cursor-pointer group' : 'bg-white/5'}`}
                                      title={part.image_url._fileData ? "点击查看文件内容" : "该文件暂无提取文本"}
                                    >
                                      <div className="flex items-center gap-3 overflow-hidden">
                                        <FileText className="text-white flex-shrink-0" size={24} />
                                        <div className="truncate text-sm font-medium text-zinc-200">文件附件: {part.image_url.url.replace('file-text:', '')}</div>
                                      </div>
                                      {part.image_url._fileData && <span className="text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 px-2 py-1 rounded">查看</span>}
                                    </div>
                                  )
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <ReactMarkdown components={{
                            code({ node, inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match ? (
                                <div className="my-4 rounded-xl overflow-hidden border border-white/10 shadow-2xl"><SyntaxHighlighter style={vscDarkPlus as any} language={match[1]} PreTag="div" {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter></div>
                              ) : ( <code className={`${className} bg-white/10 rounded-md px-1.5 py-0.5 text-zinc-200 font-mono text-sm border border-white/5`} {...props}>{children}</code> );
                            }
                          }}>
                            {m.content}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 🖼️ 图片详情渲染 */}
              {viewingSpecificChat._type === 'image' && (
                <div className="flex flex-col items-center justify-center min-h-full gap-8 max-w-4xl mx-auto pb-10">
                  <div className="relative max-w-full max-h-[60vh] rounded-[24px] shadow-[0_30px_80px_rgba(0,0,0,0.8)] border border-white/10 bg-black/20 p-2 backdrop-blur-sm flex items-center justify-center">
                    <img src={viewingSpecificChat.url} className="w-auto h-auto max-w-full max-h-[58vh] object-contain rounded-[18px]" />
                  </div>
                  
                  {viewingSpecificChat.references && viewingSpecificChat.references.length > 0 && (
                    <div className="w-full bg-black/40 backdrop-blur-2xl p-6 rounded-[24px] border border-white/[0.08] shadow-2xl">
                      <div className="flex items-center gap-2 mb-4 text-zinc-500 font-bold uppercase text-[11px] tracking-widest">
                        <ImageIcon size={14}/> 参考图 (References)
                      </div>
                      <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
                        {viewingSpecificChat.references.map((ref: string, idx: number) => (
                          <img key={idx} src={ref} className="h-28 w-auto rounded-[12px] border border-white/10 object-cover shadow-lg" />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="w-full bg-black/40 backdrop-blur-2xl p-6 rounded-[24px] border border-white/[0.08] text-[13px] text-zinc-300 leading-relaxed shadow-2xl font-light">
                    <div className="flex items-center gap-2 mb-3 text-zinc-500 font-bold uppercase text-[11px] tracking-widest">
                      <PenTool size={14}/> Prompt (提示词)
                    </div>
                    {viewingSpecificChat.prompt}
                  </div>
                </div>
              )}

              {/* 🎬 视频详情渲染 */}
              {viewingSpecificChat._type === 'video' && (
                <div className="flex flex-col items-center justify-center min-h-full gap-8 max-w-4xl mx-auto pb-10">
                  <div className="relative w-full max-w-3xl rounded-[24px] shadow-[0_30px_80px_rgba(0,0,0,0.8)] border border-white/10 bg-black/40 p-2 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                    <video src={viewingSpecificChat.url} controls autoPlay loop className="w-full h-auto object-contain rounded-[18px]" />
                  </div>

                  <div className="w-full max-w-3xl bg-black/40 backdrop-blur-2xl p-6 rounded-[24px] border border-white/[0.08] text-[13px] text-zinc-300 leading-relaxed shadow-2xl font-light">
                    <div className="flex items-center gap-2 mb-4 text-zinc-500 font-bold uppercase text-[11px] tracking-widest">
                      <Clapperboard size={14}/> Prompt & Mode
                    </div>
                    <div className="mb-2">
                      <span className="bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded-[6px] text-[10px] font-mono uppercase tracking-widest mr-3">
                        {viewingSpecificChat.mode}
                      </span>
                    </div>
                    {viewingSpecificChat.prompt || '[该视频仅使用参考图生成，无文本描述]'}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}