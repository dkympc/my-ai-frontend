"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  Plus, Search, LayoutGrid, PlusCircle, Globe, Mic, ArrowUp, Settings, Github, 
  Image as ImageIcon, Bot, Zap, MoreVertical, Trash2, Share2, Pencil, Archive as ArchiveIcon,
  ChevronDown, ChevronRight, Check, AlertTriangle, X, FileText, FileCode, File,
  Wand2, Layers, Monitor, Smartphone, Square, Sparkles, Download, Loader2, Upload,
  Film, Clock, Clapperboard, MonitorPlay, Video, Music, RotateCcw, MessageSquare,
  Puzzle, PenTool, BarChart, ArrowLeft, Play, Box, User, Cpu, Sliders, Database, LogOut,
  Lock, Key, Shield, CircleDot
} from 'lucide-react';
// ==========================================
import { WORKFLOW_REGISTRY, MODELS, IMAGE_MODELS, VIDEO_MODES, VIDEO_MODELS } from '@/lib/constants';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { fetchApi } from '@/services/api';
import { useWorkflow } from '@/hooks/useWorkflow';
import { useChat } from '@/hooks/useChat';
import SearchModal from '@/components/modals/SearchModal';
import SettingsModal from '@/components/modals/SettingsModal';
import ImageGenerator from '@/components/image-gen/ImageGenerator';
import VideoGenerator from '@/components/video-gen/VideoGenerator';
import CanvasVault from '@/components/video-canvas/CanvasVault';
import VideoCanvas from '@/components/video-canvas/VideoCanvas';
import Sidebar from '@/components/sidebar/Sidebar';
import WorkflowCenter from '@/components/workflow/WorkflowCenter';
import ChatView from '@/components/chat/ChatView';
import DeleteConfirmModal from '@/components/modals/DeleteConfirmModal';
import FilePreviewModal from '@/components/modals/FilePreviewModal';
import AdminRecordsModal from '@/components/modals/AdminRecordsModal';
import type { ChatMessage, ChatSession, AttachedFile, MediaMaterial, ImageRecord, VideoRecord, WfSession } from '@/lib/types';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";
export default function ChatPage() {

  // 1. 从 Zustand 状态库提取全局状态
  const { isAuthenticated, userRole, isAuthChecking, setIsAuthenticated, setUserRole, setIsAuthChecking } = useAuthStore();
  const { activeView, activeCanvasProjectId, isSettingsModalOpen, settings, toastMsg, outOfBalanceMsg, setActiveView, setIsSettingsModalOpen, setSettings, setToastMsg, setOutOfBalanceMsg } = useAppStore();

  // 2. 恢复尚未迁移的局部组件状态
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const [viewingUserChats, setViewingUserChats] = useState<any[] | null>(null);
  const [viewingSpecificChat, setViewingSpecificChat] = useState<any | null>(null);
  const [adminViewTab, setAdminViewTab] = useState<'chats' | 'images' | 'videos' | 'workflows'>('chats');
  const [viewingUsername, setViewingUsername] = useState<string>("");
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'instructions' | 'parameters' | 'data' | 'admin'>('general');
  const [selectedPromptModel, setSelectedPromptModel] = useState('gemini-3.5-flash');

  const [sessions, setSessions] = useState<ChatSession[]>([]);
    // 提前声明文件状态，给聊天和工作流一起使用
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const forceSyncToServer = () => {
    if (!isAuthenticated || !hasLoadedFromServer) return;
    fetch(`${API_BASE}/v1/user/sync_sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}` },
      body: latestPayloadRef.current
    }).catch(e => console.error("Force sync failed", e));
  };
    // 6. 引入聊天大脑
  const {
    currentSessionId, setCurrentSessionId,
    input, setInput,
    isWebSearchEnabled, setIsWebSearchEnabled,
    isTyping, setIsTyping,
    defaultModel, setDefaultModel,
    activeMenuId, setActiveMenuId,
    isModelMenuOpen, setIsModelMenuOpen,
    isSearchModalOpen, setIsSearchModalOpen,
    searchQuery, setSearchQuery,
    isDeleteModalOpen, setIsDeleteModalOpen,
    sessionToDeleteId, setSessionToDeleteId,
    handleOpenMenu, handleModelChange, handleNewChat,
    triggerDelete, confirmDelete, renameSession, handleSend,
    processAndAttachFile, handleFileChange, handlePaste, stopTyping,
    searchResults, currentSession, currentModelId, messages, isChatStarted
  } = useChat(sessions, setSessions, attachedFile, setAttachedFile, forceSyncToServer);

  const [imageHistory, setImageHistory] = useState<ImageRecord[]>([]);

  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  
  const [previewFileContent, setPreviewFileContent] = useState<{name: string, content: string} | null>(null);
  
  // 1. 保留 videoHistory，因为它需要传给 Hook
  const [videoHistory, setVideoHistory] = useState<VideoRecord[]>([]);
  


  // 5. 引入工作流大脑
  const {
    isWorkflowMenuOpen, setIsWorkflowMenuOpen,
    activeWfCategory, setActiveWfCategory,
    activeWfId, setActiveWfId,
    wfFormValues, setWfFormValues,
    isWfRunning, setIsWfRunning,
    wfInput, setWfInput,
    wfSessions, setWfSessions,
    activeWfSessionId, setActiveWfSessionId,
    isWfHistoryMenuOpen, setIsWfHistoryMenuOpen,
    currentWfSession, wfMessages, activeWorkflowData,
    handleWfFileUpload, handleRunWorkflow
  } = useWorkflow(attachedFile, setAttachedFile);

    // =================================================================
  // 👇 补回在抽离 Hook 时漏掉的文件上传与 UI 计算函数 (直接放进 page.tsx)
  // =================================================================

  // 1. 头像上传处理
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setSettings(prev => ({ ...prev, avatar: event.target?.result as string }));
      reader.readAsDataURL(file);
    }
  };




  // 3. 原封不动保留下方其余的 Ref 和通用状态

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null); 
  const wfTextareaRef = useRef<HTMLTextAreaElement>(null);
  const wfResultScrollRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasLoadedFromServer, setHasLoadedFromServer] = useState(false); 
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const imgModelMenuRef = useRef<HTMLDivElement>(null); 
  const sidebarNavRef = useRef<HTMLElement>(null);
  const autoScrollRef = useRef(true); 
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);
  // ==========================================
  const handleContainerScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // 当距离底部小于 50px 时，认为是触底，继续允许自动滚动；否则用户在往上翻，暂停自动滚动
      autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
    }
  };

  const handleLogin = async () => {
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setToastMsg("请输入账号和密码");
      return;
    }
    setLoginLoading(true);
    try {
      // 👇 看这里！直接使用封装好的 fetchApi，代码变短了，而且不需要手动加 API_BASE 了
      // 因为登录接口不需要 token，我们传入 requireAuth: false
      const res = await fetchApi('/v1/login', {
        method: 'POST',
        requireAuth: false, 
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('yr-ai-token', data.access_token);
        localStorage.setItem('yr-ai-role', data.role);
        setIsAuthenticated(true);
        setUserRole(data.role);
        setToastMsg("登录成功，欢迎回来");
        setHasLoadedFromServer(false); 
        fetchUserData(data.access_token); 
      } else {
        setToastMsg(data.error?.message || "账号或密码错误");
      }
    } catch (e) {
      setToastMsg("网络连接失败，请检查后端服务");
    } finally {
      setLoginLoading(false);
    }
  };
  const fetchUserData = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/v1/user/sessions`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.sessions) {
          setSessions(data.sessions);
          if (data.sessions.length > 0) setCurrentSessionId(data.sessions[0].id);
        }
        if (data.imageHistory) {
          const cleanedImages = data.imageHistory.map((img: ImageRecord) => {
            if (img.status === 'processing') return { ...img, status: 'failed', prompt: img.prompt + " [因刷新页面中断]" };
            return img;
          });
          setImageHistory(cleanedImages);
          if (cleanedImages.length > 0) {
             const firstSuccess = cleanedImages.find((img: ImageRecord) => img.status === 'succeeded' || !img.status);
             setActiveImageId(firstSuccess ? firstSuccess.id : cleanedImages[0].id);
          }
        }
        if (data.videoHistory) {
          const cleanedVideos = data.videoHistory.map((v: VideoRecord) => {
             if (v.status === 'processing' && (!v.task_id || !v.pollModel)) {
                return { ...v, status: 'failed', prompt: v.prompt + " [因刷新页面中断]" };
             }
             return v;
          });
          setVideoHistory(cleanedVideos);
          cleanedVideos.forEach((v: VideoRecord) => {
            if (v.status === 'processing' && v.task_id && v.pollModel) pollVideoTask(v.id, v.task_id, v.pollModel);
          });
        }
        if (data.wfSessions) setWfSessions(data.wfSessions);
        
        let currentUsername = 'User';
        try { currentUsername = JSON.parse(atob(token.split('.')[1])).sub; } catch(e) {}
        
        const dbSettings = data.settings || {};
        if (dbSettings.nickname === '依然开发者') dbSettings.nickname = currentUsername;
        if (dbSettings.avatar === 'RY') dbSettings.avatar = currentUsername.charAt(0).toUpperCase();
        setSettings(prev => ({ 
          ...prev, ...dbSettings,
          nickname: dbSettings.nickname || currentUsername,
          avatar: dbSettings.avatar || currentUsername.charAt(0).toUpperCase()
        }));
        setTimeout(() => setHasLoadedFromServer(true), 500);
      }
    } catch (e) { console.error("同步云端数据失败", e); } 
  };
  useEffect(() => {
    if (textareaRef.current && activeView === 'chat') {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input, activeView]);
  useEffect(() => {
    if (wfTextareaRef.current && activeView === 'workflow-execution') {
      wfTextareaRef.current.style.height = 'auto';
      wfTextareaRef.current.style.height = `${Math.min(wfTextareaRef.current.scrollHeight, 200)}px`;
    }
  }, [wfInput, activeView]);
  useEffect(() => {
    const token = localStorage.getItem('yr-ai-token');
    const role = localStorage.getItem('yr-ai-role');
    if (token) {
      setIsAuthenticated(true);
      if (role) setUserRole(role);
      setHasLoadedFromServer(false);
      fetchUserData(token); 
    } else {
      setHasLoadedFromServer(false);
    }
    setIsAuthChecking(false);
    setIsInitialized(true);
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setActiveMenuId(null);
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) setIsModelMenuOpen(false);
      if (!(e.target as Element).closest('.wf-history-dropdown')) setIsWfHistoryMenuOpen(false);
    };
    const handleScroll = () => {
      setActiveMenuId(null); setIsModelMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    sidebarNavRef.current?.addEventListener('scroll', handleScroll);
    return () => { document.removeEventListener('mousedown', handleClickOutside); sidebarNavRef.current?.removeEventListener('scroll', handleScroll); };
  }, []);
  // 🚀 拯救性能大动脉：采用“打字时防抖”策略
  const latestPayloadRef = useRef("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => { 
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    // 只要大模型在疯狂吐字，就不断重新计时，绝对不执行致命的 JSON.stringify！
    debounceTimerRef.current = setTimeout(() => {
      latestPayloadRef.current = JSON.stringify({ sessions, imageHistory, videoHistory, wfSessions, settings }); 
    }, 1000); // 等大模型停顿 1 秒后，才去悄悄序列化。
    
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); }
  }, [sessions, imageHistory, videoHistory, wfSessions, settings]);
  useEffect(() => {
    if (isInitialized && isAuthenticated && hasLoadedFromServer) {
      const syncTimer = setTimeout(() => { forceSyncToServer(); }, 2000); 
      return () => clearTimeout(syncTimer);
    }
  }, [sessions, imageHistory, videoHistory, wfSessions, settings, isInitialized, isAuthenticated, hasLoadedFromServer]);
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isAuthenticated && hasLoadedFromServer) {
        const payload = latestPayloadRef.current;
        const url = `${API_BASE}/v1/user/sync_sessions`;
        const blob = new Blob([payload], { type: 'application/json' });
        if (!navigator.sendBeacon(url, blob)) {
          fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}` }, body: payload, keepalive: true }).catch(() => {});
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAuthenticated, hasLoadedFromServer]);
  useEffect(() => {
    if (wfResultScrollRef.current && isWfRunning) {
      wfResultScrollRef.current.scrollTo({ top: wfResultScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [wfMessages, isWfRunning]);
  const fetchAdminData = async (isPolling = false) => {
    if (!isPolling) setIsAdminLoading(true);
    try {
      const token = localStorage.getItem('yr-ai-token');
      const res = await fetch(`${API_BASE}/v1/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const usersData = await res.json(); setAdminUsers(usersData.data || []);
      } else if (!isPolling && (res.status === 401 || res.status === 403)) setToastMsg("无权访问或登录过期");
    } catch (e) {
      if (!isPolling) setToastMsg("获取用户数据失败");
    } finally {
      if (!isPolling) setIsAdminLoading(false);
    }
  };
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isSettingsModalOpen && activeSettingsTab === 'admin' && userRole === 'admin') {
      fetchAdminData(false); 
      intervalId = setInterval(() => { fetchAdminData(true); }, 3000);
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [activeSettingsTab, userRole, isSettingsModalOpen]);
  const handleViewUserChats = async (username: string) => {
    try {
      const res = await fetch(`${API_BASE}/v1/admin/users/${username}/chats`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}` } });
      if (res.ok) {
        const data = await res.json();
        setViewingUserChats(data.data || { chats: [], images: [], videos: [], workflows: [] }); setViewingUsername(username); setAdminViewTab('chats'); 
      }
    } catch (e) { setToastMsg("获取记录失败"); }
  };
  const handleDownloadSpecificRecord = () => {
    if (!viewingSpecificChat) return;
    const { _type, title, messages, url, id, model, workflowId, updatedAt, timestamp } = viewingSpecificChat;
    if (_type === 'chat' || _type === 'workflow') {
      let mdContent = `# ${title || '智能对话记录'}\n\n> **记录类型**: ${_type === 'chat' ? '智能对话' : '工作流引擎'}\n> **底层引擎**: ${model || workflowId || '未知'}\n> **生成时间**: ${new Date(updatedAt || timestamp).toLocaleString()}\n\n---\n\n`;
      if (messages && Array.isArray(messages)) {
        messages.forEach((msg: any) => {
          const roleName = msg.role === 'user' ? '🧑 **User (用户)**' : '🤖 **AI (助手)**';
          const content = typeof msg.content === 'string' ? msg.content : '[多模态内容/文件]';
          mdContent += `### ${roleName}:\n\n${content}\n\n---\n\n`;
        });
      }
      const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = objectUrl; link.download = `YR_${_type === 'chat' ? 'Chat' : 'Workflow'}_${id}.md`; link.click(); URL.revokeObjectURL(objectUrl);
    } else if (_type === 'image' || _type === 'video') {
      const link = document.createElement('a'); link.href = url; link.download = `YR_AI_${_type === 'image' ? 'Image' : 'Video'}_${id}.${_type === 'image' ? 'png' : 'mp4'}`; link.click();
    }
  };
  const handleAdminUserAction = async (username: string, action: string, extraData: any = {}) => {
    try {
      await fetch(`${API_BASE}/v1/admin/users/${username}/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}` }, body: JSON.stringify({ action, ...extraData })
      });
      setToastMsg("操作成功"); fetchAdminData(true); 
      if (action === 'kick') setSelectedUser(null);
      if (action === 'reset_tokens') setSelectedUser((prev: any) => ({...prev, tokens_used: 0}));
      if (action === 'update_permission') setSelectedUser((prev: any) => ({...prev, [extraData.perm_type]: extraData.perm_value}));
    } catch (e) { setToastMsg("操作失败"); }
  };

  const handleExportData = () => {
    const data = { sessions, imageHistory, videoHistory, settings, wfSessions };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `yr_ai_export_${new Date().getTime()}.json`; a.click(); URL.revokeObjectURL(url);
  };
  const handleLogout = async () => {
    if (window.confirm("确定要退出登录吗？")) {
      try { await fetch(`${API_BASE}/v1/logout`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}` } }); } catch(e) {}
      localStorage.removeItem('yr-ai-token'); localStorage.removeItem('yr-ai-role'); setIsAuthenticated(false); setUserRole('user'); window.location.reload();
    }
  };

  if (isAuthChecking) return <div className="h-screen bg-[#0d0d0d] flex items-center justify-center text-zinc-500 font-mono text-sm">Initializing YR AI Engine...</div>;
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen bg-[#050505] items-center justify-center text-zinc-200 antialiased font-sans overflow-hidden relative selection:bg-indigo-500/30">
        
        {/* 全局样式保持不变 */}
        <style jsx global>{`
          .typing-cursor::after { content: '●'; display: inline-block; margin-left: 4px; color: #6366f1; animation: blink 0.8s infinite; font-size: 12px; vertical-align: middle; }
          @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
          .message-appear { animation: fadeIn 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); filter: blur(2px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
        `}</style>
        
        {/* 背景光晕效果 */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] rounded-full bg-indigo-900/20 blur-[150px]"></div>
          <div className="absolute bottom-[10%] right-[20%] w-[400px] h-[400px] rounded-full bg-purple-900/10 blur-[120px]"></div>
        </div>

        {/* 顶部弹窗通知 */}
        {toastMsg && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-white/20 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 fade-in z-[99999]">
            <AlertTriangle size={16} className="text-yellow-500" />
            <span className="text-sm font-medium text-white">{toastMsg}</span>
          </div>
        )}

        {/* 登录卡片 */}
        <div className="relative z-10 w-full max-w-sm bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4 border border-white/10">
              <span className="text-white text-xl font-black tracking-tighter">YR</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">欢迎回到 YR AI</h1>
            <p className="text-sm text-zinc-500 mt-2">请登录以继续使用智能引擎</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">账号 / Username</label>
              <input 
                type="text" 
                value={loginUsername} 
                onChange={(e) => setLoginUsername(e.target.value)} 
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" 
                placeholder="输入您的系统账号"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">密码 / Password</label>
              <input 
                type="password" 
                value={loginPassword} 
                onChange={(e) => setLoginPassword(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" 
                placeholder="输入密码"
              />
            </div>

            <button 
              onClick={handleLogin} 
              disabled={loginLoading || !loginUsername.trim() || !loginPassword.trim()}
              className="w-full mt-8 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              {loginLoading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loginLoading ? "验证中..." : "进入系统"}
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    // 1. 最外层：深邃的极光黑底色 (避免纯黑带来的死寂感)
    <div className="flex h-screen bg-[#020203] text-zinc-200 antialiased font-sans overflow-hidden relative selection:bg-white/20">
      
      {/* 2. 黑客级 CSS 魔法：动态流光、强制玻璃化、紧凑排版适配笔记本 */}
      <style jsx global>{`
        /* 打字机光标 */
        .typing-cursor::after { content: '●'; display: inline-block; margin-left: 4px; color: #fff; animation: blink 0.8s infinite; font-size: 12px; vertical-align: middle; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        
        /* 消息出现动画 */
        .message-appear { animation: fadeIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        /* 优雅的细滚动条 */
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        
        /* 🌌 动态流光背景动画 */
        @keyframes aurora-flow {
          0% { transform: translate(0, 0) scale(1) rotate(0deg); }
          33% { transform: translate(3vw, -3vh) scale(1.1) rotate(5deg); }
          66% { transform: translate(-2vw, 2vh) scale(0.9) rotate(-5deg); }
          100% { transform: translate(0, 0) scale(1) rotate(0deg); }
        }
        .aurora-1 { animation: aurora-flow 20s infinite ease-in-out alternate; }
        .aurora-2 { animation: aurora-flow 25s infinite ease-in-out alternate-reverse; }

        /* 💎 核心审美：强制剔除所有的“实心砖块灰”，替换为黑玻璃质感 */
        main [class*="bg-[#171717]"], main [class*="bg-[#121212]"] {
          background-color: transparent !important;
        }
        
        /* AI 消息气泡 / 功能卡片 (高级黑玻璃) */
        main [class*="bg-[#1e1e1e]"] {
          background-color: rgba(15, 15, 18, 0.6) !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
          border: 1px solid rgba(255,255,255,0.06) !important;
          box-shadow: 0 4px 24px rgba(0,0,0,0.4) !important;
        }

        /* 🚀 拯救笔记本屏幕：针对你截图里的输入框和建议按钮进行强力排版压缩 */
        
        /* 1. 建议按钮区 (四个圆角框) */
        main [class*="grid-cols-2"] button {
          background-color: rgba(20, 20, 25, 0.5) !important;
          backdrop-filter: blur(12px) !important;
          border: 1px solid rgba(255,255,255,0.05) !important;
          padding: 10px 16px !important; /* 缩小按钮高度 */
          font-size: 13px !important;
          transition: all 0.3s ease !important;
        }
        main [class*="grid-cols-2"] button:hover {
          background-color: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
          transform: translateY(-1px) !important;
        }

        /* 2. 底部输入框容器 */
        main [class*="bg-[#2f2f2f]"], main [class*="bg-[#1e1e1e]"] textarea {
          background-color: rgba(20, 20, 25, 0.6) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5) !important;
        }
        
        /* 缩小输入框的留白，防止它在笔记本上占掉 1/3 的屏幕 */
        main .max-w-3xl {
          max-width: 48rem !important; /* 让宽度收敛，显得更精致 */
        }
        main textarea {
          min-height: 44px !important; /* 初始高度变得极窄 */
          padding-top: 10px !important;
          padding-bottom: 10px !important;
          font-size: 14px !important;
        }
      `}</style>
      
      {/* 3. 环境氛围灯：动态流光背景 */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="aurora-1 absolute top-[-15%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-900/10 blur-[120px] mix-blend-screen"></div>
        <div className="aurora-2 absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-blue-900/5 blur-[120px] mix-blend-screen"></div>
        {/* 中心微弱的高光，托起主视觉 */}
        <div className="absolute top-[30%] left-[50%] -translate-x-1/2 w-[60vw] h-[30vh] rounded-full bg-purple-900/5 blur-[150px] pointer-events-none"></div>
      </div>

      {/* 顶部提醒 */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-[#1a1a1e]/80 backdrop-blur-2xl border border-white/10 px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 fade-in z-[99999]">
          <AlertTriangle size={15} className="text-indigo-400" />
          <span className="text-xs font-medium text-white">{toastMsg}</span>
        </div>
      )}
      
      {/* 4. 主界面框架 */}
      <div className="relative z-10 flex h-full w-full bg-transparent">
        <Sidebar 
          sessions={sessions} currentSessionId={currentSessionId} setCurrentSessionId={setCurrentSessionId}
          handleNewChat={handleNewChat} setIsSearchModalOpen={setIsSearchModalOpen} isWorkflowMenuOpen={isWorkflowMenuOpen}
          setIsWorkflowMenuOpen={setIsWorkflowMenuOpen} activeWfCategory={activeWfCategory} setActiveWfCategory={setActiveWfCategory}
          activeMenuId={activeMenuId} handleOpenMenu={handleOpenMenu} renameSession={renameSession} triggerDelete={triggerDelete}
          menuRef={menuRef} menuPosition={menuPosition} sidebarNavRef={sidebarNavRef}
        />
        
        <main className="flex-1 flex flex-col relative z-0 bg-transparent">
          <WorkflowCenter
            activeWfCategory={activeWfCategory} setActiveWfCategory={setActiveWfCategory} activeWfId={activeWfId} setActiveWfId={setActiveWfId}
            wfFormValues={wfFormValues} setWfFormValues={setWfFormValues} isWfRunning={isWfRunning} wfInput={wfInput} setWfInput={setWfInput}
            wfSessions={wfSessions} setWfSessions={setWfSessions} activeWfSessionId={activeWfSessionId} setActiveWfSessionId={setActiveWfSessionId}
            isWfHistoryMenuOpen={isWfHistoryMenuOpen} setIsWfHistoryMenuOpen={setIsWfHistoryMenuOpen} wfMessages={wfMessages} activeWorkflowData={activeWorkflowData}
            handleWfFileUpload={handleWfFileUpload} handleRunWorkflow={handleRunWorkflow} wfResultScrollRef={wfResultScrollRef} wfTextareaRef={wfTextareaRef}
            attachedFile={attachedFile} setAttachedFile={setAttachedFile} handleFileChange={handleFileChange} setPreviewFileContent={setPreviewFileContent}
          />

          <ChatView
            isChatStarted={isChatStarted} isModelMenuOpen={isModelMenuOpen} setIsModelMenuOpen={setIsModelMenuOpen} currentModelId={currentModelId}
            handleModelChange={handleModelChange} modelMenuRef={modelMenuRef} scrollRef={scrollRef} handleContainerScroll={handleContainerScroll}
            messages={messages} currentSessionId={currentSessionId} setInput={setInput} setSessions={setSessions} isTyping={isTyping}
            setPreviewFileContent={setPreviewFileContent} attachedFile={attachedFile} setAttachedFile={setAttachedFile} textareaRef={textareaRef}
            input={input} handlePaste={handlePaste} handleSend={handleSend} fileInputRef={fileInputRef} handleFileChange={handleFileChange}
            isWebSearchEnabled={isWebSearchEnabled} setIsWebSearchEnabled={setIsWebSearchEnabled} stopTyping={stopTyping}
          />

          {activeView === 'image-gen' && <ImageGenerator imageHistory={imageHistory} setImageHistory={setImageHistory} activeImageId={activeImageId} setActiveImageId={setActiveImageId} />}
          {activeView === 'video-gen' && <VideoGenerator videoHistory={videoHistory} setVideoHistory={setVideoHistory} />}
          {/* 👇 全新的画布路由控制 👇 */}
          {activeView === 'video-canvas' && !activeCanvasProjectId && <CanvasVault />}
          {activeView === 'video-canvas' && activeCanvasProjectId && <VideoCanvas imageHistory={imageHistory} videoHistory={videoHistory} />}
        </main>
      </div>

      <div style={{ position: 'relative', zIndex: 999990 }}>
        <SearchModal isSearchModalOpen={isSearchModalOpen} setIsSearchModalOpen={setIsSearchModalOpen} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchResults={searchResults} setCurrentSessionId={setCurrentSessionId} setActiveView={setActiveView} />
      </div>

      <SettingsModal isSettingsModalOpen={isSettingsModalOpen} setIsSettingsModalOpen={setIsSettingsModalOpen} activeSettingsTab={activeSettingsTab} setActiveSettingsTab={setActiveSettingsTab} userRole={userRole} settings={settings} setSettings={setSettings} avatarInputRef={avatarInputRef} handleAvatarUpload={handleAvatarUpload} selectedPromptModel={selectedPromptModel} setSelectedPromptModel={setSelectedPromptModel} handleExportData={handleExportData} handleLogout={handleLogout} isAdminLoading={isAdminLoading} fetchAdminData={fetchAdminData} adminUsers={adminUsers} selectedUser={selectedUser} setSelectedUser={setSelectedUser} handleAdminUserAction={handleAdminUserAction} handleViewUserChats={handleViewUserChats} />
      <DeleteConfirmModal isDeleteModalOpen={isDeleteModalOpen} setIsDeleteModalOpen={setIsDeleteModalOpen} confirmDelete={confirmDelete} />
      <AdminRecordsModal viewingUserChats={viewingUserChats} setViewingUserChats={setViewingUserChats} viewingUsername={viewingUsername} adminViewTab={adminViewTab} setAdminViewTab={setAdminViewTab} viewingSpecificChat={viewingSpecificChat} setViewingSpecificChat={setViewingSpecificChat} handleDownloadSpecificRecord={handleDownloadSpecificRecord} setPreviewFileContent={setPreviewFileContent} />
      <FilePreviewModal previewFileContent={previewFileContent} setPreviewFileContent={setPreviewFileContent} />
    </div>
  );
}