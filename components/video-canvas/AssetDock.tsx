// components/video-canvas/AssetDock.tsx
"use client";

import React from 'react';
import { ImageRecord, VideoRecord } from '@/lib/types';
import { Image as ImageIcon, Film } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore'; 

interface AssetDockProps {
  imageHistory: ImageRecord[];
  videoHistory: VideoRecord[];
  localAssets?: any[]; 
}

export default function AssetDock({ imageHistory, videoHistory, localAssets = [] }: AssetDockProps) {
  
  const { activeCanvasProjectId, canvasProjects } = useAppStore();
  const currentProject = (canvasProjects || []).find((p: any) => p.id === activeCanvasProjectId);
  
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
         ratio: n.data.ratio || '16:9' // ✨ 修复：提取资源时带上节点原本的比例
       };
    });

  // 合并所有资产
  const allAssetsRaw = [
    ...canvasGeneratedAssets,
    ...localAssets.map(a => ({ ...a, _type: a._type || (a.url.includes('video') ? 'video' : 'image') })),
    ...imageHistory.map(img => ({ ...img, _type: 'image' as const })),
    ...videoHistory.map(vid => ({ ...vid, _type: 'video' as const }))
  ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  
  // 根据 URL 去重
  const uniqueUrls = new Set();
  const allAssets = allAssetsRaw.filter(asset => {
     if (!asset.url) return false;
     if (uniqueUrls.has(asset.url)) return false;
     uniqueUrls.add(asset.url);
     return true;
  });

  // 拖拽打包数据
  const onDragStart = (event: React.DragEvent, asset: any) => {
    event.dataTransfer.setData('application/yr-canvas-asset', JSON.stringify(asset));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="absolute right-0 top-0 h-full z-[90] group flex items-center pr-2 py-8 pointer-events-none">
      
      {/* 隐形触发罩：鼠标靠近右侧边缘 60px 时触发展开 */}
      <div className="absolute right-0 top-0 w-[60px] h-full pointer-events-auto cursor-w-resize" />

      {/* 核心垂直玻璃抽屉 */}
      <div className="w-0 group-hover:w-[88px] h-[85vh] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                      bg-black/60 backdrop-blur-3xl border-l border-white/[0.05] group-hover:border-white/[0.15]
                      rounded-l-[32px] shadow-[-30px_0_60px_rgba(0,0,0,0.8)]
                      flex flex-col items-center py-6 overflow-y-auto custom-scrollbar opacity-0 group-hover:opacity-100 relative pointer-events-auto">
          
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity delay-200">
             Vault
          </div>

          <div className="flex flex-col items-center gap-4 w-full px-2 pb-10">
            {allAssets.map(asset => (
              /* 修复排版抖动：加入固定尺寸的外壳 */
              <div key={asset.id} className="relative w-12 h-12 flex-shrink-0">
                <div 
                    draggable
                    onDragStart={(e) => onDragStart(e, asset)}
                    title={asset.prompt || '拖入画布使用'}
                    className="absolute right-0 top-1/2 -translate-y-1/2 origin-right cursor-grab active:cursor-grabbing
                               w-12 h-12 hover:w-[72px] hover:h-[72px] hover:z-50
                               transition-all duration-300 ease-out
                               rounded-2xl overflow-hidden border border-white/5
                               hover:border-white/30 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] bg-[#0a0a0a] flex items-center justify-center"
                >
                  {asset.status === 'processing' ? (
                      <div className="w-full h-full flex items-center justify-center bg-white/5 animate-pulse">
                          {asset._type === 'image' ? <ImageIcon size={16} className="text-zinc-500"/> : <Film size={16} className="text-zinc-500"/>}
                      </div>
                  ) : (
                      asset._type === 'image' ? (
                          <img src={asset.url} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" draggable={false}/>
                      ) : (
                          <video src={asset.url} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" draggable={false} preload="metadata"/>
                      )
                  )}
                  {/* 极简角标 */}
                  <div className="absolute top-1 right-1 bg-black/80 backdrop-blur-md rounded-[6px] px-1.5 py-0.5 text-[8px] text-zinc-300 font-bold tracking-widest pointer-events-none">
                     {asset._type === 'image' ? 'IMG' : 'VID'}
                  </div>
                </div>
              </div>
            ))}
            
            {allAssets.length === 0 && (
               <div className="flex flex-col items-center mt-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                 <span className="text-[10px] text-zinc-600 font-mono text-center tracking-widest whitespace-pre-wrap">EMPTY</span>
               </div>
            )}
          </div>
      </div>
    </div>
  );
}