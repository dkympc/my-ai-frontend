// components/sidebar/Sidebar.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
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
  
  // 管理弹出层状态：'history' | 'workflow' | null
  const [activePopover, setActivePopover] = useState<'history' | 'workflow' | null>(null);

  // 记录鼠标 Y 轴坐标，用于计算水波纹缩放
  const [mouseY, setMouseY] = useState<number | null>(null);

  // 极窄高光 Dock 按钮 (底层 DOM 直驱，绝对 0 延迟防闪烁)
  const NavItem = ({ icon, label, isActive, onClick }: any) => {
    const itemRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
      if (!itemRef.current) return;
      const el = itemRef.current;

      if (mouseY === null) {
        // 鼠标移出侧边栏：交给 CSS 丝滑回弹
        el.style.transform = `scale(1)`;
        el.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s, color 0.2s';
        return;
      }
      
      // 鼠标在侧边栏移动：完全剥夺 CSS 的动画权，由 JS 实时算出大小并瞬间应用
      const rect = el.getBoundingClientRect();
      const itemCenterY = rect.top + rect.height / 2;
      const distance = Math.abs(mouseY - itemCenterY);
      
      const maxDistance = 90; 
      if (distance < maxDistance) {
        const newScale = 1 + (1 - distance / maxDistance) * 0.25; // 最大放大 1.25 倍
        el.style.transform = `scale(${newScale})`;
        el.style.transition = 'none'; // 核心：瞬间跟随，绝不闪烁
      } else {
        el.style.transform = `scale(1)`;
        el.style.transition = 'transform 0.2s ease-out';
      }
    }, [mouseY]);

    return (
      <div 
        className="relative group w-full flex justify-center py-1.5 cursor-pointer" 
        onClick={(e) => { e.preventDefault(); onClick(); }}
      >
        {/* 左侧发光微胶囊：保持精致 */}
        <div 
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-300 ${isActive ? 'h-4 opacity-100' : 'h-0 opacity-0'}`} 
        />

        <button 
          ref={itemRef}
          style={{ willChange: 'transform' }} // 开启 GPU 硬件加速
          className={`w-9 h-9 rounded-xl flex items-center justify-center
            ${isActive ? 'text-white' : 'text-zinc-500'}
            hover:text-white hover:bg-white/10
          `}
        >
          {icon}
        </button>

        {/* 悬浮文字提示 */}
        <div className="absolute left-[130%] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-black/95 backdrop-blur-xl border border-white/10 text-white text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[100] transition-opacity duration-200 shadow-2xl">
          {label}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 隐形遮罩层，点击屏幕空白处关闭菜单 */}
      {activePopover && (
        <div 
          className="fixed inset-0 z-[90]" 
          onClick={() => setActivePopover(null)} 
        />
      )}

      <aside className="hidden md:flex w-[60px] flex-col items-center bg-black/40 backdrop-blur-3xl border-r border-white/5 flex-shrink-0 z-[100] relative py-5 shadow-[4px_0_24px_rgba(0,0,0,0.8)]">
        
        {/* Logo 区 */}
        <div 
          className="w-9 h-9 bg-gradient-to-b from-zinc-200 to-zinc-400 rounded-[14px] flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)] mb-8 cursor-pointer transition-all duration-500 hover:rotate-[15deg] hover:scale-110 border border-white/20" 
          onClick={() => { 
            setActiveView('chat'); 
            setCurrentSessionId(null); 
            setActivePopover(null); 
          }}
        >
          <span className="text-black text-xs font-black tracking-tighter">YR</span>
        </div>
        
        <nav 
          className="flex-1 w-full flex flex-col items-center gap-0.5"
          onMouseMove={(e) => setMouseY(e.clientY)}
          onMouseLeave={() => setMouseY(null)}
        >
          <NavItem 
            icon={<Plus size={20} />} 
            label="新建对话" 
            onClick={() => { handleNewChat(); setActivePopover(null); }} 
            isActive={activeView === 'chat' && !currentSessionId} 
          />
          <NavItem 
            icon={<Search size={20} />} 
            label="全局搜索" 
            onClick={() => { setIsSearchModalOpen(true); setActivePopover(null); }} 
          />
          
          <div className="w-5 h-px bg-white/10 my-2 rounded-full pointer-events-none"></div>

          {/* ✨ 智能对话 (修改为：仅控制菜单弹窗，禁止直接跳转) */}
          <div className="w-full relative">
            <NavItem 
              icon={<MessageSquare size={20} />} 
              label="智能对话" 
              onClick={() => {
                // 仅打开/关闭面板，不执行 setActiveView('chat')
                setActivePopover(prev => prev === 'history' ? null : 'history');
              }} 
              isActive={activeView === 'chat' || activePopover === 'history'} // 如果菜单打开，依然保持高亮
            />
            
            <div className={`absolute left-[60px] top-0 w-72 h-[60vh] bg-[#080808]/90 backdrop-blur-3xl border border-white/10 shadow-[30px_0_60px_rgba(0,0,0,0.9)] rounded-2xl p-3 flex flex-col transition-all duration-300 origin-left ${activePopover === 'history' ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 px-2 flex items-center gap-2">
                <Clock size={12}/> 历史对话
              </div>
              
              {/* 🚀 核心性能修复：当菜单关闭时，彻底销毁内部的 DOM 循环渲染，释放海量 CPU 算力！ */}
              {activePopover === 'history' && (
                <div ref={sidebarNavRef as React.RefObject<HTMLDivElement>} className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-1">
                  {sessions.map((s) => (
                    <div key={s.id} onClick={() => { setCurrentSessionId(s.id); setActiveView('chat'); setActivePopover(null); }} className={`group relative flex items-center w-full px-3 py-3 rounded-xl text-sm cursor-pointer transition-all ${currentSessionId === s.id && activeView === 'chat' ? 'bg-white/10 text-white border border-white/20 shadow-inner' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}>
                      <span className="truncate flex-1 min-w-0 font-medium">{s.title}</span>
                      <button onClick={(e) => handleOpenMenu(e, s.id)} className={`absolute right-2 p-1.5 rounded-lg hover:bg-black/50 transition-all opacity-0 group-hover:opacity-100 ${activeMenuId === s.id ? 'opacity-100' : ''}`}>
                        <MoreVertical size={14} className="text-zinc-400" />
                      </button>
                      {activeMenuId === s.id && (
                        <div ref={menuRef} style={{ position: 'fixed', top: `${menuPosition.top}px`, left: `${menuPosition.left}px`, zIndex: 999999 }} className="w-36 bg-[#050505]/95 backdrop-blur-3xl border border-white/20 rounded-xl shadow-2xl py-1.5 px-1 animate-in fade-in zoom-in-95">
                          {[
                            { icon: <Pencil size={14}/>, label: "重命名", onClick: (e: any) => renameSession(s.id, e) },
                            { icon: <Share2 size={14}/>, label: "分享", onClick: (e: any) => e.stopPropagation() },
                            { icon: <ArchiveIcon size={14}/>, label: "归档", onClick: (e: any) => e.stopPropagation() },
                            { icon: <Trash2 size={14}/>, label: "删除", onClick: (e: any) => triggerDelete(s.id, e), danger: true },
                          ].map((m, i) => (
                            <button key={i} onClick={m.onClick} className={`flex items-center gap-3 w-full px-3 py-2 text-xs text-left rounded-lg hover:bg-white/10 transition-colors ${m.danger ? 'text-red-400 hover:bg-red-500/20' : 'text-zinc-300'}`}>
                              {m.icon} {m.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {sessions.length === 0 && <div className="text-center text-zinc-600 text-xs py-10">暂无历史记录</div>}
                </div>
              )}
            </div>
          </div>

          {/* ✨ 工作流中心 (修改为：仅控制菜单弹窗，禁止直接跳转) */}
          <div className="w-full relative">
            <NavItem 
              icon={<Puzzle size={20} />} 
              label="工作流中心" 
              onClick={() => { 
                // 仅打开/关闭面板，不执行 setActiveView 等页面跳转逻辑
                setActivePopover(prev => prev === 'workflow' ? null : 'workflow');
              }} 
              isActive={activeView.includes('workflow') || activePopover === 'workflow'} // 菜单打开时保持高亮
            />
            
            <div className={`absolute left-[60px] top-0 w-48 bg-[#080808]/95 backdrop-blur-3xl border border-white/10 shadow-[30px_0_60px_rgba(0,0,0,0.9)] rounded-2xl p-2 flex flex-col transition-all duration-300 origin-left ${activePopover === 'workflow' ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
               <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-3 pt-2">分类引擎</div>
               {[
                  { id: 'all', label: '热门应用', icon: <Box size={14}/> },
                  { id: 'content', label: '内容创作', icon: <PenTool size={14}/> },
                  { id: 'image', label: '视觉图像', icon: <ImageIcon size={14}/> },
                  { id: 'data', label: '数据分析', icon: <BarChart size={14}/> },
                  { id: 'agent', label: '自动化 Agent', icon: <Bot size={14}/> },
                ].map(cat => (
                  <button key={cat.id} onClick={() => { setActiveView('workflow-gallery'); setActiveWfCategory(cat.id); setActivePopover(null); }} className={`flex items-center gap-3 w-full p-3 rounded-xl text-xs transition-all font-medium ${activeView === 'workflow-gallery' && activeWfCategory === cat.id ? 'text-white bg-white/10 border border-white/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
                    {cat.icon} <span>{cat.label}</span>
                  </button>
                ))}
            </div>
          </div>

          {/* 生图和视频因为没有子菜单，保留原生直接跳转逻辑 */}
          <NavItem icon={<ImageIcon size={20} />} label="图像生成" onClick={() => { setActiveView('image-gen'); setActivePopover(null); }} isActive={activeView === 'image-gen'} />
          <NavItem icon={<Film size={20} />} label="视频生成" onClick={() => { setActiveView('video-gen'); setActivePopover(null); }} isActive={activeView === 'video-gen'} />
          <NavItem icon={<MonitorStop size={20} />} label="视频画布" onClick={() => { setActiveView('video-canvas'); setActivePopover(null); }} isActive={activeView === 'video-canvas'} />
        </nav>
        
        {/* 底部头像设置区 */}
        <div className="mt-auto pt-4 flex flex-col items-center">
          <div className="w-5 h-px bg-white/10 mb-4 rounded-full pointer-events-none"></div>
          <div 
            className="relative group cursor-pointer w-9 h-9 rounded-full bg-black flex items-center justify-center text-xs font-bold text-white hover:scale-110 transition-all duration-300 overflow-hidden border border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.15)]"
            onClick={() => { setIsSettingsModalOpen(true); setActivePopover(null); }}
          >
            {settings.avatar?.startsWith('data:image') ? <img src={settings.avatar} className="w-full h-full object-cover" /> : (settings.avatar || 'RY')}
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Settings size={14} className="text-white" />
            </div>
            <div className="absolute left-[130%] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-black/95 backdrop-blur-xl border border-white/10 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[100] transition-opacity duration-200 shadow-2xl">
              个人设置
            </div>
          </div>
        </div>

      </aside>
    </>
  );
}