// components/video-canvas/CanvasVault.tsx
"use client";

import React, { useState } from 'react';
import { Plus, MonitorPlay, Clock, MoreVertical } from 'lucide-react';
import { CanvasProject } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';

export default function CanvasVault() {
  const { setActiveCanvasProjectId } = useAppStore();
  
  const [projects, setProjects] = useState<CanvasProject[]>([
    { id: 'cv_1', title: '赛博朋克微电影', updatedAt: Date.now() - 1000000 },
    { id: 'cv_2', title: '电商商品展示混剪', updatedAt: Date.now() - 86400000 },
  ]);

  const handleCreateNew = () => {
    const newId = `canvas_${Date.now()}`;
    setActiveCanvasProjectId(newId);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent select-none animate-in fade-in duration-700 w-full">
      <header className="px-12 pt-16 pb-8 shrink-0 relative z-10">
        <div className="flex flex-col gap-3">
          <h1 className="text-[32px] font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-300 to-zinc-600 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center gap-4">
            <MonitorPlay size={32} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
            视觉交响空间
          </h1>
          <p className="text-[14px] text-zinc-500 tracking-widest font-light uppercase">
            Infinite Spatial Canvas · 组织你的每一帧灵感
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-12 pb-12 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          <div 
            onClick={handleCreateNew}
            className="group relative h-56 cursor-pointer rounded-[24px] overflow-hidden transition-all duration-500 hover:-translate-y-2 flex flex-col items-center justify-center bg-white/[0.02] border border-white/[0.05] hover:border-white/20 hover:bg-white/[0.05] shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none blur-2xl" />
            <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all duration-500 mb-4 z-10">
              <Plus size={24} />
            </div>
            <h3 className="text-[14px] font-medium text-zinc-300 group-hover:text-white tracking-widest z-10">新建空白画布</h3>
          </div>

          {projects.map(proj => (
            <div 
              key={proj.id}
              onClick={() => setActiveCanvasProjectId(proj.id)}
              className="group relative h-56 cursor-pointer rounded-[24px] overflow-hidden transition-all duration-500 hover:-translate-y-2 bg-black/40 backdrop-blur-xl border border-white/[0.05] hover:border-white/[0.15] shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex flex-col"
            >
              <div className="flex-1 bg-[#0a0a0a] relative overflow-hidden flex items-center justify-center border-b border-white/[0.02]">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_2px_2px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:20px_20px]" />
                <MonitorPlay size={32} className="text-zinc-800 group-hover:scale-110 transition-transform duration-700" />
              </div>
              <div className="p-5 flex items-center justify-between bg-white/[0.02]">
                <div>
                  <h3 className="text-[15px] font-medium text-zinc-200 mb-1 tracking-wide">{proj.title}</h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 font-mono">
                    <Clock size={12} /> {new Date(proj.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <button className="p-2 text-zinc-600 hover:text-white hover:bg-white/10 rounded-full transition-all opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}