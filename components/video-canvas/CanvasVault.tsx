// components/video-canvas/CanvasVault.tsx
"use client";

import React, { useState } from 'react';
import { Plus, MonitorPlay, Clock, MoreVertical, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function CanvasVault() {
  // 🚀 核心修复：直接从全局状态读取 canvasProjects，并引入 update 和 set 函数
  const { canvasProjects, setActiveCanvasProjectId, updateCanvasProject, setCanvasSettings } = useAppStore();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const handleCreateNew = () => {
    const newId = `canvas_${Date.now()}`;
    // 🚀 新建时直接在数据库里占个位置，赋予默认名字
    if (typeof updateCanvasProject === 'function') {
        updateCanvasProject(newId, { title: '未命名创想宇宙', nodes: [], edges: [], localAssets: [] });
    }
    setActiveCanvasProjectId(newId);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("确定要删除这个画布吗？所有未导出的节点数据都将丢失。")) {
        // 直接更新全局数组过滤掉这个ID
        useAppStore.setState((state: any) => ({
            canvasProjects: state.canvasProjects.filter((p: any) => p.id !== id)
        }));
    }
    setActiveMenuId(null);
  };

  // 兜底渲染，防止没数据时报错
  const displayProjects = canvasProjects || [];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent select-none animate-in fade-in duration-700 w-full" onClick={() => setActiveMenuId(null)}>
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
          
          {/* 新建按钮 */}
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

          {/* 渲染真实历史列表 */}
          {displayProjects.sort((a, b) => b.updatedAt - a.updatedAt).map(proj => (
            <div 
              key={proj.id}
              onClick={() => setActiveCanvasProjectId(proj.id)}
              className="group relative h-56 cursor-pointer rounded-[24px] overflow-hidden transition-all duration-500 hover:-translate-y-2 bg-black/40 backdrop-blur-xl border border-white/[0.05] hover:border-white/[0.15] shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex flex-col"
            >
              <div className="flex-1 bg-[#0a0a0a] relative overflow-hidden flex items-center justify-center border-b border-white/[0.02]">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_2px_2px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:20px_20px]" />
                <MonitorPlay size={32} className="text-zinc-800 group-hover:scale-110 transition-transform duration-700" />
              </div>
              <div className="p-5 flex items-center justify-between bg-white/[0.02] relative">
                <div>
                  <h3 className="text-[15px] font-medium text-zinc-200 mb-1 tracking-wide truncate max-w-[180px]">{proj.title}</h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 font-mono">
                    <Clock size={12} /> {new Date(proj.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                
                {/* 悬浮菜单按钮 */}
                <button 
                  className={`p-2 text-zinc-600 hover:text-white hover:bg-white/10 rounded-full transition-all ${activeMenuId === proj.id ? 'opacity-100 bg-white/10' : 'opacity-0 group-hover:opacity-100'}`} 
                  onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === proj.id ? null : proj.id); }}
                >
                  <MoreVertical size={16} />
                </button>

                {/* 菜单弹窗 */}
                {activeMenuId === proj.id && (
                  <div className="absolute right-6 bottom-14 w-32 bg-[#050505]/95 backdrop-blur-3xl border border-white/10 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] py-1.5 px-1 animate-in zoom-in-95 z-50">
                    <button 
                      onClick={(e) => handleDelete(proj.id, e)} 
                      className="flex items-center gap-3 w-full px-3 py-2 text-xs text-left rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 size={14}/> 删除画布
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}