// components/video-canvas/AssetDock.tsx
"use client";

import React from 'react';
import { ImageRecord, VideoRecord } from '@/lib/types';
import { Image as ImageIcon, Film } from 'lucide-react';

interface AssetDockProps {
  imageHistory: ImageRecord[];
  videoHistory: VideoRecord[];
}

export default function AssetDock({ imageHistory, videoHistory }: AssetDockProps) {
  // 1. 将图片和视频合并，并按时间倒序排序（最新的在最左边）
  const allAssets = [
    ...imageHistory.map(img => ({ ...img, _type: 'image' as const })),
    ...videoHistory.map(vid => ({ ...vid, _type: 'video' as const }))
  ].sort((a, b) => b.timestamp - a.timestamp);

  // 2. 拖拽开始时的事件（把数据打包，等用户松手时在画布生成节点）
  const onDragStart = (event: React.DragEvent, asset: any) => {
    event.dataTransfer.setData('application/yr-canvas-asset', JSON.stringify(asset));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[100] group flex flex-col items-center">
      
      {/* 隐形触发罩：增加鼠标感应面积，防止鼠标稍微移开传送带就缩回去 */}
      <div className="absolute bottom-0 w-[120%] h-40 -translate-y-4 pointer-events-auto" />

      {/* 顶部状态指示灯 (平时缩小态看到的东西) */}
      <div className="w-12 h-1 bg-white/20 rounded-full mb-3 transition-all duration-500 group-hover:w-32 group-hover:bg-white/40 group-hover:shadow-[0_0_15px_rgba(255,255,255,0.4)] pointer-events-none" />

      {/* 核心玻璃胶囊容器 */}
      <div className="h-0 group-hover:h-[100px] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                      bg-black/60 backdrop-blur-3xl border border-white/[0.08] group-hover:border-white/[0.15]
                      rounded-[28px] shadow-[0_30px_60px_rgba(0,0,0,0.8)]
                      flex items-center px-4 overflow-x-auto custom-scrollbar max-w-[80vw] opacity-0 group-hover:opacity-100 relative pointer-events-auto">
          
          {/* 资产渲染区 */}
          <div className="flex items-center gap-3 h-full pt-4 pb-4">
            {allAssets.map(asset => (
              <div 
                  key={asset.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, asset)}
                  title={asset.prompt}
                  // 🚀 核心黑科技 CSS：原点设在底部(origin-bottom)，悬停时使用 !important 强行放大并产生白金辉光
                  className="relative flex-shrink-0 origin-bottom cursor-grab active:cursor-grabbing
                             w-12 h-12 hover:!w-[88px] hover:!h-[88px] hover:z-50 hover:-translate-y-2
                             transition-all duration-300 ease-out
                             rounded-2xl overflow-hidden border border-white/10
                             hover:border-amber-100/60 hover:shadow-[0_0_30px_rgba(253,230,138,0.3)] bg-[#0a0a0a]"
              >
                {asset.status === 'processing' ? (
                    <div className="w-full h-full flex items-center justify-center bg-white/5 animate-pulse">
                        {asset._type === 'image' ? <ImageIcon size={16} className="text-zinc-500"/> : <Film size={16} className="text-zinc-500"/>}
                    </div>
                ) : (
                    asset._type === 'image' ? (
                        <img src={asset.url} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" draggable={false}/>
                    ) : (
                        <video src={asset.url} className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" draggable={false}/>
                    )
                )}

                {/* 极简角标 */}
                <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-md rounded border border-white/10 px-1 py-0.5 text-[8px] text-zinc-300 font-bold tracking-widest">
                   {asset._type === 'image' ? 'IMG' : 'VID'}
                </div>
              </div>
            ))}

            {allAssets.length === 0 && (
               <span className="text-[11px] text-zinc-500 font-mono tracking-widest px-6 whitespace-nowrap">
                 无可用资产 / EMPTY VAULT
               </span>
            )}
          </div>
      </div>
    </div>
  );
}