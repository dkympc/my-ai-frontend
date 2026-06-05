import React, { useMemo, useRef } from 'react';
import { 
  Clapperboard, MonitorPlay, Loader2, AlertTriangle, RotateCcw, 
  Trash2, Film, Download, Video, Music, X, Plus, Image as ImageIcon, 
  Wand2, ChevronDown, Check, Sparkles, Monitor, Clock, Layers, ArrowUp 
} from 'lucide-react';
import { VIDEO_MODES, VIDEO_MODELS } from '@/lib/constants';
import { useVideoGen } from '@/hooks/useVideoGen';
import { VideoRecord } from '@/lib/types';

interface VideoGeneratorProps {
  videoHistory: VideoRecord[];
  setVideoHistory: React.Dispatch<React.SetStateAction<VideoRecord[]>>;
}

export default function VideoGenerator({
  videoHistory, setVideoHistory
}: VideoGeneratorProps) {
  const vidFeedScrollRef = useRef<HTMLDivElement>(null);
  const vidFileInputRef = useRef<HTMLInputElement>(null);

  // ✨ 核心魔法：视频的大脑被移到了这里！
  const {
    vidModel, setVidModel,
    vidMode, setVidMode,
    vidPrompt, setVidPrompt,
    vidRatio, setVidRatio,
    vidDuration, setVidDuration,
    vidResolution, setVidResolution,
    vidMaterials, setVidMaterials,
    isVidModelMenuOpen, setIsVidModelMenuOpen,
    isVidModeMenuOpen, setIsVidModeMenuOpen,
    isVidRatioMenuOpen, setIsVidRatioMenuOpen,
    isVidDurationMenuOpen, setIsVidDurationMenuOpen,
    isVidResMenuOpen, setIsVidResMenuOpen,
    showAtDropdown, setShowAtDropdown,
    isVideoDeleteModalOpen, setIsVideoDeleteModalOpen,
    videoToDeleteId, setVideoToDeleteId,
    pollVideoTask,
    handleVidModelChange,
    handleGenerateVideo,
    loadVideoToEdit,
    triggerVideoDelete,
    confirmVideoDelete
  } = useVideoGen(videoHistory, setVideoHistory);

  // 辅助函数
  const handleVidMaterialUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'audio';
      const reader = new FileReader();
      reader.onload = (event) => {
        const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        const tag = `@${file.name.split('.')[0].substring(0, 10)}`;
        setVidMaterials(prev => [...prev, { id: newId, type, url: event.target?.result as string, name: file.name, tag }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleVidPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setVidPrompt(val);
    const textBeforeCursor = val.slice(0, e.target.selectionStart);
    setShowAtDropdown(!!textBeforeCursor.match(/@(\S*)$/));
  };

  const insertMaterialTag = (tag: string) => {
    const textarea = document.getElementById('vid-textarea') as HTMLTextAreaElement;
    const cursorPosition = textarea?.selectionStart || vidPrompt.length;
    const textBeforeCursor = vidPrompt.slice(0, cursorPosition);
    const textAfterCursor = vidPrompt.slice(cursorPosition);
    const match = textBeforeCursor.match(/@(\S*)$/);
    if (match) {
      setVidPrompt(textBeforeCursor.slice(0, match.index) + tag + ' ' + textAfterCursor);
    } else {
      setVidPrompt(vidPrompt + tag + ' ');
    }
    setShowAtDropdown(false);
    textarea?.focus();
  };

  const getVidPlaceholder = () => vidMaterials.length > 0 ? "输入视频描述，输入 @ 引用已上传的参考素材..." : "描述您想生成的视频画面...";

  const currentVidModelData = useMemo(() => VIDEO_MODELS.find(m => m.id === vidModel), [vidModel]);
  const currentVidFeatures = currentVidModelData?.features || [];
  const currentVidModes = currentVidModelData?.modes || [];
  const imageMaterials = vidMaterials.filter(m => m.type === 'image');

  return (
    <>
      <div className="flex flex-col h-full w-full relative">
        <header className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-[#171717] to-transparent z-10 pointer-events-none flex justify-between items-center">
          <div className="text-zinc-400 font-medium text-sm flex items-center gap-2 pointer-events-auto bg-black/40 px-4 py-2 rounded-full backdrop-blur-md border border-white/5"><Clapperboard size={16} className="text-purple-400"/> 视频创作工作台</div>
        </header>

        <div ref={vidFeedScrollRef} className="flex-1 overflow-y-auto p-6 pt-20 pb-64 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-12">
            {videoHistory.length === 0 && (
              <div className="mt-32 flex flex-col items-center text-center opacity-50 grayscale">
                <div className="w-20 h-20 mb-6 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 shadow-2xl"><MonitorPlay size={32} className="text-zinc-400" /></div>
                <h3 className="text-xl font-bold text-zinc-300 mb-2">构想你的动态视界</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">在下方选择创作模式并上传参考素材，<br/>让 AI 为你导演一部专属大片。</p>
              </div>
            )}

            {videoHistory.map((record, idx) => {
              if (record.status === 'processing') {
                  return (
                    <div key={record.id} className="bg-[#1e1e1e] border border-purple-500/30 rounded-3xl p-5 shadow-[0_0_30px_rgba(168,85,247,0.1)] animate-pulse">
                      <div className="flex gap-4 mb-4">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center"><Loader2 size={14} className="text-purple-400 animate-spin" /></div>
                        <div className="flex-1 space-y-2 py-1"><div className="h-4 bg-white/10 rounded w-3/4"></div><div className="h-3 bg-white/5 rounded w-1/2"></div></div>
                      </div>
                      <div className="w-full h-64 bg-black/50 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-3"><Film className="text-purple-500/50" size={32} /><span className="text-sm text-purple-400/80 font-mono">引擎正在逐帧渲染中 (约需1~3分钟)...</span></div>
                    </div>
                  );
              } else if (record.status === 'failed') {
                  return (
                    <div key={record.id} className="bg-[#1e1e1e] border border-red-500/30 rounded-3xl p-5 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                      <div className="flex items-center gap-2 text-red-400 mb-2"><AlertTriangle size={18}/> <span className="font-bold">视频生成失败或被中断</span></div>
                      <p className="text-sm text-zinc-500 leading-relaxed">{record.prompt}</p>
                      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-red-500/10">
                          <button onClick={() => loadVideoToEdit(record)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium transition-all"><RotateCcw size={14} /> 重新编辑</button>
                          <div className="flex-1"></div>
                          <button onClick={() => triggerVideoDelete(record.id)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  );
              } else {
                  return (
                    <div key={record.id} className="bg-[#1e1e1e] border border-white/[0.05] rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
                      <div className="flex gap-4 mb-4">
                        <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 flex-shrink-0 mt-1"><span className="text-[12px] font-black">AI</span></div>
                        <div className="flex-1">
                          <div className="text-sm text-zinc-200 leading-relaxed mb-2 font-medium">
                            {record.prompt.split(/(@\S+)/g).map((part, i) => part.startsWith('@') ? <span key={i} className="text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-md mx-0.5">{part}</span> : part)}
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] font-mono text-zinc-500">
                            <span className="bg-white/5 px-2 py-1 rounded-md border border-white/5">{VIDEO_MODES.find(m=>m.id===record.mode)?.label || '文生视频'}</span>
                            <span className="bg-white/5 px-2 py-1 rounded-md border border-white/5">{VIDEO_MODELS.find(m=>m.id===record.model)?.name || record.model}</span>
                            <span className="bg-white/5 px-2 py-1 rounded-md border border-white/5">{record.ratio}</span>
                            {record.duration && <span className="bg-white/5 px-2 py-1 rounded-md border border-white/5">{record.duration}s</span>}
                            {record.resolution && <span className="bg-white/5 px-2 py-1 rounded-md border border-white/5">{record.resolution.toUpperCase()}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl overflow-hidden bg-black border border-white/10 relative group">
                        <video src={record.url} controls loop playsInline className="w-full max-h-[500px] object-contain" />
                      </div>

                      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
                        <button onClick={() => loadVideoToEdit(record)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium transition-all"><RotateCcw size={14} /> 重新编辑</button>
                        <button onClick={() => { const link = document.createElement('a'); link.href = record.url; link.download = `Video_${record.id}.mp4`; link.click(); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium transition-all"><Download size={14} /> 下载视频</button>
                        <div className="flex-1"></div>
                        <button onClick={() => triggerVideoDelete(record.id)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  );
              }
            })}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#171717] via-[#171717]/95 to-transparent pt-10 pb-6 px-6">
          <div className="max-w-4xl mx-auto bg-[#232323] rounded-[24px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-3 flex flex-col gap-3 transition-all focus-within:border-white/20 focus-within:shadow-[0_20px_50px_rgba(168,85,247,0.1)]">
            
            {vidMaterials.length > 0 && (
              <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1 px-1">
                {vidMaterials.map((m) => {
                  let roleBadge = null;
                  if (m.type === 'image') {
                    if (vidMode === 'i2v-both') {
                      if (m.id === imageMaterials[0]?.id) roleBadge = "首帧";
                      else if (imageMaterials.length > 1 && m.id === imageMaterials[imageMaterials.length - 1]?.id) roleBadge = "尾帧";
                    } else if (vidMode === 'i2v') {
                      if (m.id === imageMaterials[0]?.id) roleBadge = "首帧";
                    }
                  }
                  return (
                    <div key={m.id} className="relative w-16 h-16 rounded-xl border border-white/10 overflow-hidden group flex-shrink-0 bg-black/50">
                      {roleBadge && (<div className="absolute top-0 left-0 bg-pink-500/90 text-white text-[8px] px-1.5 py-0.5 rounded-br-lg z-10 font-bold tracking-widest shadow-sm">{roleBadge}</div>)}
                      {m.type === 'image' ? <img src={m.url} className="w-full h-full object-cover opacity-80" /> : m.type === 'video' ? <div className="w-full h-full flex items-center justify-center text-blue-400"><Video size={20}/></div> : <div className="w-full h-full flex items-center justify-center text-emerald-400"><Music size={20}/></div>}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-center py-0.5 text-white truncate px-1">{m.tag}</div>
                      <button onClick={() => setVidMaterials(prev => prev.filter(item => item.id !== m.id))} className="absolute top-1 right-1 p-1 bg-red-500/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity scale-75 hover:scale-100 z-20"><X size={10}/></button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-3 items-start px-2">
              <input type="file" ref={vidFileInputRef} onChange={handleVidMaterialUpload} className="hidden" accept="image/*,video/*,audio/*" multiple />
              <button onClick={() => vidFileInputRef.current?.click()} className="w-16 h-16 flex-shrink-0 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-all group">
                <Plus size={20} className="mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-medium tracking-wide">参考内容</span>
              </button>

              <div className="flex-1 relative at-dropdown-container">
                {showAtDropdown && vidMaterials.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="text-[10px] text-zinc-500 mb-2 px-1">选择参考素材</div>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar">
                      {vidMaterials.map(m => (
                        <button key={m.id} onClick={() => insertMaterialTag(m.tag)} className="w-full text-left px-2 py-1.5 hover:bg-white/5 rounded-lg flex items-center gap-2 transition-colors">
                          {m.type === 'image' ? <ImageIcon size={14} className="text-zinc-400"/> : m.type === 'video' ? <Video size={14} className="text-blue-400"/> : <Music size={14} className="text-emerald-400"/>}
                          <span className="text-sm text-zinc-300">{m.tag}</span><span className="text-[10px] text-zinc-500 truncate flex-1 text-right">{m.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <textarea id="vid-textarea" value={vidPrompt} onChange={handleVidPromptChange} placeholder={getVidPlaceholder()} className="w-full bg-transparent resize-none outline-none text-[15px] text-zinc-200 placeholder-zinc-600 min-h-[64px] py-1 leading-relaxed custom-scrollbar" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5 px-2 relative vid-toolbar-menu">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <button onClick={() => setIsVidModeMenuOpen(!isVidModeMenuOpen)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 text-zinc-300 text-xs font-medium transition-colors"><Wand2 size={14} className="text-pink-400" /><span>{VIDEO_MODES.find(m => m.id === vidMode)?.label}</span><ChevronDown size={12} className="text-zinc-500" /></button>
                  {isVidModeMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-36 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95">
                      {VIDEO_MODES.map(m => {
                        const isSupported = currentVidModes.includes(m.id);
                        return (
                          <button key={m.id} disabled={!isSupported} onClick={() => {setVidMode(m.id); setIsVidModeMenuOpen(false);}} className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${!isSupported ? 'opacity-30' : 'hover:bg-white/5 text-zinc-300'} ${vidMode === m.id ? 'text-pink-400' : ''}`}>
                            {m.icon} <span className="flex-1">{m.label}</span> {vidMode === m.id && <Check size={12}/>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="w-px h-4 bg-white/10 mx-1"></div>

                <div className="relative">
                  <button onClick={() => setIsVidModelMenuOpen(!isVidModelMenuOpen)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 text-zinc-300 text-xs font-medium transition-colors"><Sparkles size={14} className="text-indigo-400" /><span>{VIDEO_MODELS.find(m => m.id === vidModel)?.name}</span><ChevronDown size={12} className="text-zinc-500" /></button>
                  {isVidModelMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95">
                      {VIDEO_MODELS.map(m => (
                        <button key={m.id} onClick={() => handleVidModelChange(m.id)} className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center justify-between ${vidModel === m.id ? 'text-indigo-400' : 'text-zinc-300'}`}>{m.name} {vidModel === m.id && <Check size={12}/>}</button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button onClick={() => currentVidFeatures.includes('ratio') && setIsVidRatioMenuOpen(!isVidRatioMenuOpen)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!currentVidFeatures.includes('ratio') ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/5 text-zinc-300'}`}><Monitor size={14} /> <span>{vidRatio}</span> <ChevronDown size={12} className="text-zinc-500" /></button>
                  {isVidRatioMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-32 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl py-1 z-50 flex flex-col">
                      {['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'].map(r => {
                        const isSupported = currentVidModelData?.ratios?.includes(r);
                        return (
                          <button key={r} disabled={!isSupported} onClick={() => {setVidRatio(r); setIsVidRatioMenuOpen(false);}} className={`w-full text-left px-3 py-2 text-xs flex justify-between ${!isSupported ? 'opacity-30' : 'hover:bg-white/5 text-zinc-300'} ${vidRatio === r ? 'text-purple-400' : ''}`}>{r} {vidRatio === r && <Check size={12}/>}</button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button onClick={() => currentVidFeatures.includes('duration') && setIsVidDurationMenuOpen(!isVidDurationMenuOpen)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!currentVidFeatures.includes('duration') ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/5 text-zinc-300'}`}><Clock size={14} /> <span>{vidDuration}s</span> <ChevronDown size={12} className="text-zinc-500" /></button>
                  {isVidDurationMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl p-3 z-50">
                      <div className="flex items-center gap-3"><span className="text-[10px] text-zinc-500">4s</span><input type="range" min="4" max="15" step="1" value={vidDuration} onChange={(e) => setVidDuration(parseInt(e.target.value))} className="flex-1 h-1 bg-white/10 rounded-lg appearance-none accent-purple-500" /><span className="text-[10px] text-zinc-500">15s</span></div>
                    </div>
                  )}
                </div>

                <div className="relative hidden sm:block">
                  <button onClick={() => currentVidFeatures.includes('resolution') && setIsVidResMenuOpen(!isVidResMenuOpen)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!currentVidFeatures.includes('resolution') ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/5 text-zinc-300'}`}><Layers size={14} /> <span>{vidResolution.toUpperCase()}</span> <ChevronDown size={12} className="text-zinc-500" /></button>
                  {isVidResMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-32 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl py-1 z-50 flex flex-col">
                      {['480p', '720p', '1080p', '4k'].map(r => {
                        const isSupported = currentVidModelData?.resolutions?.includes(r);
                        return (
                          <button key={r} disabled={!isSupported} onClick={() => {setVidResolution(r); setIsVidResMenuOpen(false);}} className={`w-full text-left px-3 py-2 text-xs flex justify-between ${!isSupported ? 'opacity-30' : 'hover:bg-white/5 text-zinc-300'} ${vidResolution === r ? 'text-purple-400' : ''}`}>{r.toUpperCase()} {vidResolution === r && <Check size={12}/>}</button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={handleGenerateVideo} disabled={!vidPrompt.trim() && vidMaterials.length === 0} className={`p-2.5 rounded-full transition-all ${(!vidPrompt.trim() && vidMaterials.length === 0) ? 'bg-white/5 text-zinc-600' : 'bg-purple-600 text-white hover:bg-purple-500 hover:scale-105 shadow-[0_0_15px_rgba(168,85,247,0.4)]'}`}>
                  <ArrowUp size={18} strokeWidth={3} />
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ⚠️ 这个视频专属的弹窗被我们一起搬过来了！ */}
      {isVideoDeleteModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsVideoDeleteModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500"><AlertTriangle size={24} /></div>
              <div><h3 className="text-lg font-bold text-zinc-100">确认删除此视频？</h3><p className="text-sm text-zinc-500 leading-relaxed">此操作不可撤销，视频生成记录将从本地清除。</p></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsVideoDeleteModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors text-sm">取消</button>
              <button onClick={confirmVideoDelete} className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors shadow-lg shadow-red-500/20 text-sm">确认删除</button>
            </div>
            <button onClick={() => setIsVideoDeleteModalOpen(false)} className="absolute top-4 right-4 p-1 text-zinc-500 hover:text-zinc-200 transition-colors"><X size={18} /></button>
          </div>
        </div>
      )}
    </>
  );
}