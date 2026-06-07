// components/sidebar/Sidebar.tsx
"use client";

import React, { useState, useRef, useEffect, startTransition } from 'react';
import { 
  Plus, Search, Puzzle, Box, PenTool, 
  Image as ImageIcon, BarChart, Bot, 
  Film, MoreVertical, Pencil, Share2, 
  Archive as ArchiveIcon, Trash2, Settings, 
  MessageSquare, Clock, MonitorStop
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface SidebarProps {
  sessions: any[];
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  handleNewChat: () => void;
  setIsSearchModalOpen: (val: boolean) => void;
  isWorkflowMenuOpen: boolean;
  setIsWorkflowMenuOpen: (val: boolean) => void;
  activeWfCategory: string;
  setActiveWfCategory: (val: string) => void;
  activeMenuId: string | null;
  handleOpenMenu: (e: React.MouseEvent, id: string) => void;
  renameSession: (id: string, e: React.MouseEvent) => void;
  triggerDelete: (id: string, e: React.MouseEvent) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  menuPosition: { top: number; left: number };
  sidebarNavRef: React.RefObject<HTMLElement | null>;
}

export default function Sidebar({
  sessions, currentSessionId, setCurrentSessionId, handleNewChat,
  setIsSearchModalOpen, isWorkflowMenuOpen, setIsWorkflowMenuOpen,
  activeWfCategory, setActiveWfCategory, activeMenuId, handleOpenMenu,
  renameSession, triggerDelete, menuRef, menuPosition, sidebarNavRef
}: SidebarProps) {
  
  const { activeView, setActiveView, settings, setIsSettingsModalOpen } = useAppStore();
  const [activePopover, setActivePopover] = useState<'history' | 'workflow' | null>(null);

  const navRef = useRef<HTMLElement>(null);

  // 🚀 性能革命 1：坐标缓存 + RAF 硬件加速，彻底消灭 Layout Thrashing
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    let itemCache: { el: HTMLElement; centerY: number }[] = [];
    let rafId: number | null = null;

    // 只在鼠标刚进入侧边栏时，计算一次坐标（性能消耗降为原本的 1/1000）
    const handleMouseEnter = () => {
      const items = nav.querySelectorAll('.nav-item-btn');
      itemCache = Array.from(items).map((item) => {
        const rect = item.getBoundingClientRect();
        return { el: item as HTMLElement, centerY: rect.top + rect.height / 2 };
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (rafId) cancelAnimationFrame(rafId);
      // 将视觉更新推入 GPU 渲染队列，保证绝对顺滑
      rafId = requestAnimationFrame(() => {
        itemCache.forEach((cache) => {
          const distance = Math.abs(e.clientY - cache.centerY);
          const maxDistance = 90; 
          if (distance < maxDistance) {
            const newScale = 1 + (1 - distance / maxDistance) * 0.25; 
            cache.el.style.transform = `scale(${newScale})`;
            cache.el.style.transition = 'none'; 
          } else {
            cache.el.style.transform = `scale(1)`;
            cache.el.style.transition = 'transform 0.2s ease-out';
          }
        });
      });
    };

    const handleMouseLeave = () => {
      if (rafId) cancelAnimationFrame(rafId);
      itemCache.forEach((cache) => {
        cache.el.style.transform = `scale(1)`;
        cache.el.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
      });
    };

    nav.addEventListener('mouseenter', handleMouseEnter);
    nav.addEventListener('mousemove', handleMouseMove);
    nav.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      nav.removeEventListener('mouseenter', handleMouseEnter);
      nav.removeEventListener('mousemove', handleMouseMove);
      nav.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // 极窄高光 Dock 按钮
  const NavItem = ({ icon, label, isActive, onClick }: any) => {
    return (
      <div className="relative group w-full flex justify-center py-1.5 cursor-pointer" onClick={(e) => { e.preventDefault(); onClick(); }}>
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-300 ${isActive ? 'h-4 opacity-100' : 'h-0 opacity-0'}`} />
        <button 
          style={{ willChange: 'transform' }}
          className={`nav-item-btn w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-200
            ${isActive ? 'text-white' : 'text-zinc-500'} hover:text-white hover:bg-white/10`}
        >
          {icon}
        </button>
        <div className="absolute left-[130%] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-black/95 backdrop-blur-xl border border-white/10 text-white text-[11px] font-medium rounded-[10px] opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[100] transition-opacity duration-200 shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
          {label}
        </div>
      </div>
    );
  };

  return (
    <>
      {activePopover && <div className="fixed inset-0 z-[90]" onClick={() => setActivePopover(null)} />}

      <aside className="hidden md:flex w-[60px] flex-col items-center bg-black/40 backdrop-blur-3xl border-r border-white/5 flex-shrink-0 z-[100] relative py-5 shadow-[4px_0_24px_rgba(0,0,0,0.8)]">
        
        <div className="w-9 h-9 bg-gradient-to-b from-zinc-200 to-zinc-400 rounded-[14px] flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)] mb-8 cursor-pointer transition-all duration-500 hover:rotate-[15deg] hover:scale-110 border border-white/20" 
          onClick={() => { 
            setActivePopover(null);
            // 🚀 性能革命 2：把繁重的页面切换推入后台，优先保证动画不卡
            startTransition(() => {
              setActiveView('chat'); 
              setCurrentSessionId(null); 
            });
          }}>
          <span className="text-black text-xs font-black tracking-tighter">YR</span>
        </div>
        
        <nav ref={navRef} className="flex-1 w-full flex flex-col items-center gap-0.5">
          
          <NavItem icon={<Plus size={20} />} label="新建对话" onClick={() => { 
            setActivePopover(null); 
            startTransition(() => handleNewChat()); 
          }} isActive={activeView === 'chat' && !currentSessionId} />
          
          <NavItem icon={<Search size={20} />} label="全局搜索" onClick={() => { setIsSearchModalOpen(true); setActivePopover(null); }} />
          <div className="w-5 h-px bg-white/10 my-2 rounded-full pointer-events-none" />

          {/* 智能对话菜单 */}
          <div className="w-full relative">
            <NavItem icon={<MessageSquare size={20} />} label="智能对话" onClick={() => setActivePopover(prev => prev === 'history' ? null : 'history')} isActive={activeView === 'chat' || activePopover === 'history'} />
            
            {/* 🚀 性能革命 3：剥离 transition-all，严格只允许 GPU 渲染 transform 和 opacity，杜绝回流 */}
            <div className={`absolute left-[60px] top-0 w-72 h-[60vh] bg-[#080808]/90 backdrop-blur-3xl border border-white/10 shadow-[30px_0_60px_rgba(0,0,0,0.9)] rounded-[24px] p-3 flex flex-col origin-left transition-[opacity,transform] duration-200 ease-out ${activePopover === 'history' ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 px-2 flex items-center gap-2"><Clock size={12}/> 历史对话</div>
              
              <div ref={sidebarNavRef as React.RefObject<HTMLDivElement>} className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-1">
                {sessions.map((s) => (
                  <div key={s.id} onClick={() => { 
                      setActivePopover(null);
                      startTransition(() => {
                        setCurrentSessionId(s.id); 
                        setActiveView('chat'); 
                      });
                    }} className={`group relative flex items-center w-full px-3 py-3 rounded-xl text-sm cursor-pointer transition-colors ${currentSessionId === s.id && activeView === 'chat' ? 'bg-white/10 text-white border border-white/20 shadow-inner' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}>
                    <span className="truncate flex-1 min-w-0 font-medium">{s.title}</span>
                    <button onClick={(e) => handleOpenMenu(e, s.id)} className={`absolute right-2 p-1.5 rounded-lg hover:bg-black/50 transition-all opacity-0 group-hover:opacity-100 ${activeMenuId === s.id ? 'opacity-100' : ''}`}>
                      <MoreVertical size={14} className="text-zinc-400" />
                    </button>
                    {activeMenuId === s.id && (
                      <div ref={menuRef} style={{ position: 'fixed', top: `${menuPosition.top}px`, left: `${menuPosition.left}px`, zIndex: 999999 }} className="w-36 bg-[#050505]/95 backdrop-blur-3xl border border-white/20 rounded-xl shadow-2xl py-1.5 px-1 animate-in fade-in zoom-in-95">
                        {[ { icon: <Pencil size={14}/>, label: "重命名", onClick: (e: any) => renameSession(s.id, e) }, { icon: <Share2 size={14}/>, label: "分享", onClick: (e: any) => e.stopPropagation() }, { icon: <ArchiveIcon size={14}/>, label: "归档", onClick: (e: any) => e.stopPropagation() }, { icon: <Trash2 size={14}/>, label: "删除", onClick: (e: any) => triggerDelete(s.id, e), danger: true } ].map((m, i) => (
                          <button key={i} onClick={m.onClick} className={`flex items-center gap-3 w-full px-3 py-2 text-xs text-left rounded-lg hover:bg-white/10 transition-colors ${m.danger ? 'text-red-400 hover:bg-red-500/20' : 'text-zinc-300'}`}>
                            {m.icon} {m.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {sessions.length === 0 && <div className="text-center text-zinc-600 text-[11px] py-10">暂无历史记录</div>}
              </div>
            </div>
          </div>

          {/* 工作流中心菜单 */}
          <div className="w-full relative">
            <NavItem icon={<Puzzle size={20} />} label="工作流中心" onClick={() => setActivePopover(prev => prev === 'workflow' ? null : 'workflow')} isActive={activeView.includes('workflow') || activePopover === 'workflow'} />
            
            <div className={`absolute left-[60px] top-0 w-48 bg-[#080808]/95 backdrop-blur-3xl border border-white/10 shadow-[30px_0_60px_rgba(0,0,0,0.9)] rounded-[20px] p-2 flex flex-col origin-left transition-[opacity,transform] duration-200 ease-out ${activePopover === 'workflow' ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
               <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-3 pt-2">分类引擎</div>
               {[ { id: 'all', label: '热门应用', icon: <Box size={14}/> }, { id: 'content', label: '内容创作', icon: <PenTool size={14}/> }, { id: 'image', label: '视觉图像', icon: <ImageIcon size={14}/> }, { id: 'data', label: '数据分析', icon: <BarChart size={14}/> }, { id: 'agent', label: '自动化 Agent', icon: <Bot size={14}/> } ].map(cat => (
                  <button key={cat.id} onClick={() => { 
                      setActivePopover(null); 
                      startTransition(() => {
                        setActiveView('workflow-gallery'); 
                        setActiveWfCategory(cat.id); 
                      });
                    }} className={`flex items-center gap-3 w-full p-3 rounded-[12px] text-xs transition-colors font-medium ${activeView === 'workflow-gallery' && activeWfCategory === cat.id ? 'text-white bg-white/10 border border-white/20 shadow-inner' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
                    {cat.icon} <span>{cat.label}</span>
                  </button>
                ))}
            </div>
          </div>

          <NavItem icon={<ImageIcon size={20} />} label="图像生成" onClick={() => { setActivePopover(null); startTransition(() => setActiveView('image-gen')); }} isActive={activeView === 'image-gen'} />
          <NavItem icon={<Film size={20} />} label="视频生成" onClick={() => { setActivePopover(null); startTransition(() => setActiveView('video-gen')); }} isActive={activeView === 'video-gen'} />
          <NavItem icon={<MonitorStop size={20} />} label="视频画布" onClick={() => { setActivePopover(null); startTransition(() => setActiveView('video-canvas')); }} isActive={activeView === 'video-canvas'} />
        </nav>
        
        {/* 底部设置 */}
        <div className="mt-auto pt-4 flex flex-col items-center">
          <div className="w-5 h-px bg-white/10 mb-4 rounded-full pointer-events-none" />
          <div className="relative group cursor-pointer w-9 h-9 rounded-full bg-black flex items-center justify-center text-xs font-bold text-white hover:scale-110 transition-transform duration-300 overflow-hidden border border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.15)]" onClick={() => { setIsSettingsModalOpen(true); setActivePopover(null); }}>
            {settings.avatar?.startsWith('data:image') ? <img src={settings.avatar} className="w-full h-full object-cover" /> : (settings.avatar || 'RY')}
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Settings size={14} className="text-white" />
            </div>
            <div className="absolute left-[130%] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-black/95 backdrop-blur-xl border border-white/10 text-white text-[11px] font-medium rounded-[10px] opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[100] transition-opacity duration-200 shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
              个人设置
            </div>
          </div>
        </div>

      </aside>
    </>
  );
}