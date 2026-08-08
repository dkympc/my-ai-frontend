import React, { useMemo, useRef } from 'react';
import { 
  Wand2, ChevronDown, Check, Upload, Plus, Trash2, 
  Square, Monitor, Smartphone, Layers, Sparkles, 
  Download, Loader2, AlertTriangle, Image as ImageIcon
} from 'lucide-react';
import { IMAGE_MODELS } from '@/lib/constants';
import { useImageGen } from '@/hooks/useImageGen';
import { ImageRecord } from '@/lib/types';

interface ImageGeneratorProps {
  imageHistory: ImageRecord[];
  setImageHistory: React.Dispatch<React.SetStateAction<ImageRecord[]>>;
  activeImageId: string | null;
  setActiveImageId: React.Dispatch<React.SetStateAction<string | null>>;
}

export default function ImageGenerator({
  imageHistory, setImageHistory,
  activeImageId, setActiveImageId
}: ImageGeneratorProps) {
  const imgFileInputRef = useRef<HTMLInputElement>(null);

  const {
    imgModel, setImgModel,
    isImgModelMenuOpen, setIsImgModelMenuOpen,
    imgPrompt, setImgPrompt,
    imgNegativePrompt, setImgNegativePrompt,
    imgRatio, setImgRatio,
    imgStyle, setImgStyle,
    imgReferences, setImgReferences,
    handleGenerateImage
  } = useImageGen(imageHistory, setImageHistory, setActiveImageId);

  const currentImgFeatures = useMemo(() => IMAGE_MODELS.find(m => m.id === imgModel)?.features || [], [imgModel]);

  const handleImgReferenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => setImgReferences(prev => [...prev, event.target?.result as string].slice(0, 4));
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-transparent">
      
      {/* =========================================
          🔥 左侧控制台
          ========================================= */}
      <div className="w-[360px] shrink-0 bg-black/20 backdrop-blur-3xl border-r border-white/[0.05] flex flex-col h-full shadow-2xl z-10 relative">
        
        <header className="p-5 border-b border-white/[0.05] flex items-center gap-3 shrink-0">
          <div className="flex-1 truncate flex items-center gap-2">
            <Sparkles size={16} className="text-zinc-400" />
            <div className="text-[15px] font-bold text-zinc-200 truncate tracking-wide">图像生成参数</div>
          </div>
        </header>

        {/* 🚨 修复 1: 增加了 pb-32 (padding-bottom: 8rem)，确底部元素能拉出渐变遮罩之上 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pb-32 space-y-8">
          
          <div className="space-y-2.5 relative">
            <label className="text-[11px] font-medium text-zinc-500 tracking-wider flex justify-between items-center">
              <span>图像引擎 (Engine)</span>
              <span className="text-zinc-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest">Pro</span>
            </label>
            <button onClick={() => setIsImgModelMenuOpen(!isImgModelMenuOpen)} className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] transition-all">
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-semibold text-zinc-200">{IMAGE_MODELS.find(m => m.id === imgModel)?.name || imgModel}</span>
              </div>
              <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isImgModelMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {isImgModelMenuOpen && (
              <div className="absolute top-[75px] left-0 right-0 bg-black/80 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                {IMAGE_MODELS.map(m => (
                  <button key={m.id} onClick={() => { setImgModel(m.id); setIsImgModelMenuOpen(false); }} className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm transition-all mb-0.5 ${imgModel === m.id ? 'bg-white/10 text-white shadow-inner border border-white/5' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
                    <div className="flex flex-col items-start text-left">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-[10px] opacity-60 mt-0.5 font-light">{m.desc}</span>
                    </div>
                    {imgModel === m.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            <label className="text-[11px] font-medium text-zinc-500 tracking-wider">画面描述 (Prompt)</label>
            <textarea 
              value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} 
              placeholder="描述你想看到的画面，例如：一只赛博朋克风格的猫，霓虹灯背景，8k分辨率..." 
              className="w-full h-32 bg-black/40 border border-white/[0.08] rounded-[20px] p-4 text-[13px] text-zinc-200 placeholder-zinc-600 focus:border-white/30 focus:shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-all resize-none custom-scrollbar outline-none leading-relaxed" 
            />
          </div>

          <div className="space-y-2.5">
            <label className="text-[11px] font-medium text-zinc-500 tracking-wider flex justify-between items-center">
              <span>参考图 (Image to Image)</span>
              {imgReferences.length > 0 && <span className="text-[10px] text-zinc-400 bg-white/10 px-2 py-0.5 rounded-full">{imgReferences.length} / 4</span>}
            </label>
            <input type="file" ref={imgFileInputRef} onChange={handleImgReferenceChange} className="hidden" accept="image/*" multiple />
            {imgReferences.length === 0 ? (
              <button onClick={() => imgFileInputRef.current?.click()} className="w-full py-6 border border-dashed border-white/[0.1] rounded-[20px] flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-zinc-300 hover:border-white/20 hover:bg-white/[0.02] transition-all">
                <Upload size={18} />
                <span className="text-[11px] font-medium tracking-wide">点击上传垫图 (支持多选)</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {imgReferences.map((img, idx) => (
                  <div key={idx} className="relative w-full h-24 rounded-xl border border-white/[0.1] overflow-hidden group shadow-lg">
                    <img src={img} alt={`Ref ${idx}`} className="w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 backdrop-blur-sm">
                      <button onClick={() => setImgReferences(prev => prev.filter((_, i) => i !== idx))} className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-all shadow-lg scale-90 hover:scale-100"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
                {imgReferences.length < 4 && (<button onClick={() => imgFileInputRef.current?.click()} className="w-full h-24 border border-dashed border-white/[0.15] rounded-xl flex flex-col items-center justify-center gap-1 text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition-all"><Plus size={18} /><span className="text-[10px]">添加</span></button>)}
              </div>
            )}
          </div>

          <div className={`space-y-2.5 transition-opacity duration-300 ${!currentImgFeatures.includes('negative') ? 'opacity-30 pointer-events-none' : ''}`}>
            <label className="text-[11px] font-medium text-zinc-500 tracking-wider flex justify-between items-center">
              <span>反向描述 (Negative)</span>
              {!currentImgFeatures.includes('negative') && <span className="text-[9px] text-zinc-600">模型不支持</span>}
            </label>
            <textarea 
              value={imgNegativePrompt} onChange={(e) => setImgNegativePrompt(e.target.value)} 
              placeholder="不想在画面中出现的元素..." 
              className="w-full h-16 bg-black/40 border border-white/[0.08] rounded-xl p-3 text-[12px] text-zinc-200 placeholder-zinc-600 focus:border-white/30 transition-all resize-none custom-scrollbar outline-none" 
            />
          </div>

          <div className={`space-y-2.5 transition-opacity duration-300 ${!currentImgFeatures.includes('ratio') ? 'opacity-30 pointer-events-none' : ''}`}>
            <label className="text-[11px] font-medium text-zinc-500 tracking-wider">画面比例 (Ratio)</label>
            <div className="grid grid-cols-4 gap-2">
              {[{ id: '1:1', icon: <Square size={14} /> }, { id: '16:9', icon: <Monitor size={14} /> }, { id: '9:16', icon: <Smartphone size={14} /> }, { id: '4:3', icon: <Layers size={14} /> }].map(r => (
                <button 
                  key={r.id} onClick={() => setImgRatio(r.id)} 
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border transition-all duration-300 ${imgRatio === r.id ? 'bg-white/10 border-white/30 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)] scale-[1.02]' : 'bg-white/[0.02] border-white/[0.05] text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300'}`}
                >
                  {r.icon}<span className="text-[10px] font-mono font-medium">{r.id}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`space-y-2.5 transition-opacity duration-300 ${!currentImgFeatures.includes('style') && !currentImgFeatures.includes('stylize') ? 'opacity-30 pointer-events-none' : ''}`}>
            <label className="text-[11px] font-medium text-zinc-500 tracking-wider">风格倾向 (Style)</label>
            <div className="grid grid-cols-3 gap-2">
              {[{ id: 'none', label: '智能/不选' }, { id: 'photorealistic', label: '真实摄影' }, { id: 'anime', label: '二次元' }, { id: '3d-model', label: '3D 渲染' }, { id: 'cyberpunk', label: '赛博朋克' }, { id: 'watercolor', label: '水彩艺术' }].map(s => (
                <button 
                  key={s.id} onClick={() => setImgStyle(s.id)} 
                  className={`py-2 px-1.5 rounded-lg border text-[11px] transition-all duration-300 whitespace-nowrap overflow-hidden text-ellipsis ${imgStyle === s.id ? 'bg-white/10 border-white/30 text-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'bg-white/[0.02] border-white/[0.05] text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 底部生成按钮区 */}
        <div className="p-6 shrink-0 absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">
          <div className="pointer-events-auto">
            <button 
              onClick={handleGenerateImage} 
              disabled={!imgPrompt.trim()} 
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all duration-500 ${!imgPrompt.trim() ? 'bg-white/5 text-zinc-600 cursor-not-allowed border border-white/5' : 'bg-white text-black hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(255,255,255,0.3)]'}`}
            >
              <Sparkles size={18} className={imgPrompt.trim() ? "animate-pulse" : ""} /> 
              立即生成
            </button>
          </div>
        </div>
      </div>

      {/* =========================================
          🌌 右侧画板区
          ========================================= */}
      <div className="flex-1 flex flex-col relative bg-transparent">
        
        {/* 🚨 修复 2: px-8 pt-8 pb-[140px]，强行给底部的 Dock 栏留出 140px 的空间！
            这样图片在计算 max-h-full 时，绝对不会被底部的历史记录挡住 */}
        <div className="flex-1 relative flex items-center justify-center px-8 pt-8 pb-[140px] overflow-hidden">
          
          <div className="absolute top-6 right-6 flex gap-2 z-10">
            {activeImageId && (
              <button 
                onClick={() => { const img = imageHistory.find(i => i.id === activeImageId); if(img && img.url) { const link = document.createElement('a'); link.href = img.url; link.download = `W_Image_${img.id}.png`; link.click(); } }} 
                className="p-3 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-full text-zinc-400 hover:text-white transition-all hover:bg-black/60 shadow-lg hover:scale-110"
              >
                <Download size={18} />
              </button>
            )}
          </div>
          
          {(() => {
            const activeImg = imageHistory.find(i => i.id === activeImageId);
            
            if (activeImg?.status === 'processing') {
              return (
                <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500 select-none">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <div className="absolute inset-0 border-t-2 border-white/80 rounded-full animate-spin"></div>
                    <div className="absolute inset-2 border-r-2 border-white/30 rounded-full animate-spin-reverse" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                    <Sparkles className="text-white animate-pulse" size={28} />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-medium text-zinc-200 tracking-wide">正在唤醒潜意识...</h3>
                    <p className="text-xs text-zinc-500 font-mono tracking-widest uppercase">Model: {activeImg.model} • Ratio: {activeImg.ratio}</p>
                  </div>
                </div>
              );
            } else if (activeImg?.status === 'failed') {
              return (
                 <div className="flex flex-col items-center text-center text-red-400 animate-in fade-in duration-500">
                    <AlertTriangle size={48} className="mb-4 opacity-80" />
                    <h3 className="text-xl font-bold mb-2">图像生成失败或被中断</h3>
                    <p className="text-sm text-red-400/60 max-w-md">{activeImg.prompt}</p>
                 </div>
              );
            } else if (activeImg?.url) {
              return (
                <div className="w-full h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-500 group">
                  {/* 🚨 修复 2.1: 限制图片的宽高响应比例，确保不会撑爆外层容器 */}
                  <div className="relative w-auto h-auto max-w-full max-h-full rounded-[24px] shadow-[0_30px_80px_rgba(0,0,0,0.8)] border border-white/10 bg-black/20 p-2 backdrop-blur-sm transition-transform duration-700 hover:scale-[1.01] flex items-center justify-center">
                    <img src={activeImg.url} alt="Generated AI Art" className="w-auto h-auto max-w-full max-h-full object-contain rounded-[18px]" />
                  </div>
                  
                  {/* 悬浮的提示词 */}
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 max-w-2xl w-[90%] bg-black/60 backdrop-blur-2xl border border-white/10 p-5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-2xl pointer-events-none">
                     <p className="text-sm text-zinc-200 line-clamp-3 leading-relaxed font-light">{activeImg.prompt}</p>
                     <div className="flex gap-4 mt-3 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                       <span className="flex items-center gap-1.5"><Wand2 size={12}/> {activeImg.model}</span>
                       <span className="flex items-center gap-1.5"><Square size={12}/> Ratio: {activeImg.ratio}</span>
                     </div>
                  </div>
                </div>
              );
            } else {
              return (
                <div className="flex flex-col items-center text-center max-w-sm opacity-60 hover:opacity-100 transition-all duration-700 select-none">
                  <div className="w-24 h-24 mb-8 rounded-[32px] bg-white/[0.02] backdrop-blur-xl flex items-center justify-center border border-white/5 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
                    <ImageIcon size={40} className="text-zinc-400 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" />
                  </div>
                  <h3 className="text-xl font-medium text-zinc-300 mb-2 tracking-wider">构想你的画面</h3>
                  <p className="text-[13px] text-zinc-500 font-light leading-relaxed">在左侧控制台输入描述词并调整参数，<br/>让 AI 为你呈现独一无二的视觉艺术。</p>
                </div>
              );
            }
          })()}
        </div>

        {/* 底部历史记录 Dock 栏 */}
        {imageHistory.length > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-4xl w-[90%]">
            <div className="bg-black/40 backdrop-blur-3xl border border-white/10 p-3 rounded-[24px] flex gap-3 overflow-x-auto custom-scrollbar items-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] mask-fade-edges">
              {imageHistory.map((record) => (
                <div 
                  key={record.id} 
                  onClick={() => setActiveImageId(record.id)} 
                  className={`group relative w-[72px] h-[72px] rounded-[16px] flex-shrink-0 cursor-pointer overflow-hidden transition-all duration-300 ${
                    activeImageId === record.id 
                      ? 'border-[2px] border-white shadow-[0_0_20px_rgba(255,255,255,0.4)] scale-105 opacity-100 z-10' 
                      : 'border border-white/10 opacity-50 hover:opacity-100 hover:scale-105'
                  }`}
                >
                  {record.status === 'processing' ? (
                     <div className="w-full h-full flex items-center justify-center bg-white/5"><Loader2 size={18} className="animate-spin text-white"/></div>
                  ) : record.status === 'failed' ? (
                     <div className="w-full h-full flex items-center justify-center bg-red-500/10 text-red-500"><AlertTriangle size={18}/></div>
                  ) : (
                     <img src={record.url} className="w-full h-full object-cover" />
                  )}
                  <button onClick={(e) => { e.stopPropagation(); const newHistory = imageHistory.filter(i => i.id !== record.id); setImageHistory(newHistory); if (activeImageId === record.id) setActiveImageId(newHistory.length > 0 ? newHistory[0].id : null); }} className="absolute top-1 right-1 p-1 bg-black/60 backdrop-blur-md text-zinc-300 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all scale-75 group-hover:scale-100"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}