// components/video-canvas/AssetDock.tsx
"use client";

import React, { useState } from 'react';
import { ImageRecord, VideoRecord } from '@/lib/types';
import { Image as ImageIcon, Film, Map, Users, Package, Grid, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore'; 

interface AssetDockProps {
  imageHistory: ImageRecord[];
  videoHistory: VideoRecord[];
  localAssets?: any[]; 
}

export default function AssetDock({ imageHistory, videoHistory, localAssets = [] }: AssetDockProps) {
  
  const { activeCanvasProjectId, canvasProjects } = useAppStore();
  const currentProject = (canvasProjects || []).find((p: any) => p.id === activeCanvasProjectId);
  const [activeFilter, setActiveFilter] = useState('all');
  // ★ 改为点击触发，不再使用 group hover
  const [isOpen, setIsOpen] = useState(false);
  
  const canvasGeneratedAssets = (currentProject?.nodes || [])
    .filter((n: any) => n.data.resultUrl || n.data.frameUrl || n.data.videoUrl)
    .map((n: any) => {
       const url = n.data.resultUrl || n.data.frameUrl || n.data.videoUrl;
       const isVideo = url.includes('.mp4') || n.type === 'videoClip' || n.type === 'render';
       return { 
         id: `node_gen_${n.id}`, 
         url: url, 
         prompt: n.data.prompt || n.data.firstFrameAnchor || '画布生成的资源', 
         timestamp: Date.now(), 
         _type: isVideo ? 'video' : 'image',
         ratio: n.data.ratio || '16:9' 
       };
    });

  const localAssetsWithType = localAssets.map(a => ({ ...a, _type: a._type || (a.url.includes('video') ? 'video' : 'image') }));
  const otherAssetsRaw = [
    ...canvasGeneratedAssets,
    ...imageHistory.map(img => ({ ...img, _type: 'image' as const })),
    ...videoHistory.map(vid => ({ ...vid, _type: 'video' as const }))
  ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const uniqueUrls = new Set();
  const dedupedOtherAssets = otherAssetsRaw.filter(asset => {
     if (!asset.url) return false;
     if (uniqueUrls.has(asset.url)) return false;
     uniqueUrls.add(asset.url);
     return true;
  });

  const allAssets = [...localAssetsWithType, ...dedupedOtherAssets];

  const filteredAssets = allAssets.filter(asset => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'video') return asset._type === 'video';
    if (asset._type === 'image') {
       if (activeFilter === 'scene') return asset.category === 'scene';
       if (activeFilter === 'character') return asset.category === 'character';
       if (activeFilter === 'prop') return asset.category === 'prop' || !asset.category; 
    }
    return false;
  });

  const onDragStart = (event: React.DragEvent, asset: any) => {
    event.dataTransfer.setData('application/yr-canvas-asset', JSON.stringify(asset));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="absolute right-0 top-0 h-full z-30 flex items-center py-8 pointer-events-none">
      
      {/* ★ 点击触发标签按钮 — 始终在最外层，z-index 高于抽屉 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute right-0 top-1/2 -translate-y-1/2 w-7 h-24 rounded-l-xl bg-black/80 backdrop-blur-3xl border border-white/[0.12] hover:border-white/[0.25] flex flex-col items-center justify-center gap-1.5 text-zinc-500 hover:text-white transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.9)] pointer-events-auto z-[35]"
        title={isOpen ? '收起素材坞' : '展开素材坞'}
      >
        {isOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        <span className="text-[8px] font-extrabold tracking-[0.3em] uppercase" style={{ writingMode: 'vertical-rl' }}>VAULT</span>
      </button>

      {/* ★ 抽屉内容 — 由 isOpen 状态控制显示/隐藏，展开时不遮挡标签按钮 */}
      <div className={`h-[85vh] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                      bg-black/80 backdrop-blur-3xl border-l border-white/[0.08]
                      rounded-l-[32px] shadow-[-30px_0_60px_rgba(0,0,0,0.8)]
                      flex flex-col items-center py-6 overflow-y-auto custom-scrollbar relative pointer-events-auto mr-7
                      ${isOpen ? 'w-[140px] opacity-100' : 'w-0 opacity-0 pointer-events-none border-transparent'}`}>
          
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 whitespace-nowrap">
             Vault
          </div>

          {/* 分类导航按钮阵列 */}
          <div className="flex flex-wrap gap-1.5 px-3 mb-5 justify-center w-full">
             <button onClick={()=>setActiveFilter('all')} title="全部资产" className={`p-1.5 rounded-xl transition-all ${activeFilter==='all'?'bg-white/20 text-white shadow-inner':'text-zinc-500 hover:text-white hover:bg-white/10'}`}><Grid size={14}/></button>
             <button onClick={()=>setActiveFilter('scene')} title="场景底图" className={`p-1.5 rounded-xl transition-all ${activeFilter==='scene'?'bg-emerald-500/20 text-emerald-400 shadow-inner':'text-zinc-500 hover:text-emerald-400 hover:bg-white/10'}`}><Map size={14}/></button>
             <button onClick={()=>setActiveFilter('character')} title="角色造型" className={`p-1.5 rounded-xl transition-all ${activeFilter==='character'?'bg-amber-500/20 text-amber-400 shadow-inner':'text-zinc-500 hover:text-amber-400 hover:bg-white/10'}`}><Users size={14}/></button>
             <button onClick={()=>setActiveFilter('prop')} title="静图道具" className={`p-1.5 rounded-xl transition-all ${activeFilter==='prop'?'bg-fuchsia-500/20 text-fuchsia-400 shadow-inner':'text-zinc-500 hover:text-fuchsia-400 hover:bg-white/10'}`}><Package size={14}/></button>
             <button onClick={()=>setActiveFilter('video')} title="视频/动态" className={`p-1.5 rounded-xl transition-all ${activeFilter==='video'?'bg-indigo-500/20 text-indigo-400 shadow-inner':'text-zinc-500 hover:text-indigo-400 hover:bg-white/10'}`}><Film size={14}/></button>
          </div>

          <div className="flex flex-col items-center gap-4 w-full px-2 pb-10">
            {filteredAssets.map(asset => (
              <div key={asset.id} className="relative w-16 h-16 flex-shrink-0 group/item">
                <div 
                    draggable
                    onDragStart={(e) => onDragStart(e, asset)}
                    title={asset.prompt || '拖入画布使用'}
                    className="absolute right-1/2 translate-x-1/2 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing
                               w-16 h-16 hover:w-[88px] hover:h-[88px] hover:z-50
                               transition-all duration-300 ease-out
                               rounded-[20px] overflow-hidden border border-white/5
                               hover:border-white/30 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] bg-[#0a0a0a] flex items-center justify-center"
                >
                  {asset.status === 'processing' ? (
                      <div className="w-full h-full flex items-center justify-center bg-white/5 animate-pulse">
                          {asset._type === 'image' ? <ImageIcon size={18} className="text-zinc-500"/> : <Film size={18} className="text-zinc-500"/>}
                      </div>
                  ) : (
                      asset._type === 'image' ? (
                          <img src={asset.url} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" draggable={false}/>
                      ) : (
                          <video src={asset.url} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" draggable={false} preload="metadata"/>
                      )
                  )}
                  {/* 分类智能角标 */}
                  <div className={`absolute top-1.5 right-1.5 backdrop-blur-md rounded-[6px] px-1.5 py-0.5 text-[8px] font-bold tracking-widest pointer-events-none 
                                   ${asset.category === 'scene' ? 'bg-emerald-500/80 text-white' : 
                                     asset.category === 'character' ? 'bg-amber-500/80 text-white' : 
                                     asset.category === 'prop' ? 'bg-fuchsia-500/80 text-white' : 
                                     asset._type === 'video' ? 'bg-indigo-500/80 text-white' : 'bg-black/80 text-zinc-300'}`}>
                     {asset.category ? asset.category.substring(0,3).toUpperCase() : asset._type === 'image' ? 'IMG' : 'VID'}
                  </div>
                </div>
              </div>
            ))}
            
            {filteredAssets.length === 0 && (
               <div className="flex flex-col items-center mt-10">
                 <span className="text-[10px] text-zinc-600 font-mono text-center tracking-widest whitespace-pre-wrap">EMPTY</span>
               </div>
            )}
          </div>
      </div>
    </div>
  );
}
