"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import AgentCustomerService from '@/components/agent-cs/AgentCustomerService';
import DeleteConfirmModal from '@/components/modals/DeleteConfirmModal';
import FilePreviewModal from '@/components/modals/FilePreviewModal';
import AdminRecordsModal from '@/components/modals/AdminRecordsModal';
import DialogManager from '@/components/modals/DialogManager';
import { showConfirm } from '@/lib/dialogStore';
import type { ChatMessage, ChatSession, AttachedFile, MediaMaterial, ImageRecord, VideoRecord, WfSession } from '@/lib/types';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export default function WorkspaceApp() {
  const router = useRouter();
  const isLoggingOutRef = useRef(false); // ★ 防 handleLogout 触发的 isAuthenticated 变更导致竞态跳转

  // 从 Zustand 状态库提取全局状态
  const { isAuthenticated, userRole, isAuthChecking, setIsAuthenticated, setUserRole, setIsAuthChecking } = useAuthStore();
  const { activeView, activeCanvasProjectId, isSettingsModalOpen, settings, toastMsg, outOfBalanceMsg, setActiveView, setIsSettingsModalOpen, setSettings, setToastMsg, setOutOfBalanceMsg } = useAppStore();
  const canvasProjects = useAppStore(state => state.canvasProjects);

  // ★ 未登录则重定向到 /login（手动退出登录时除外，避免与 router.push('/') 竞态）
  useEffect(() => {
    if (!isAuthChecking && !isAuthenticated && !isLoggingOutRef.current) {
      router.replace('/login');
    }
  }, [isAuthenticated, isAuthChecking, router]);

  // 恢复局部组件状态（移除登录/注册相关状态，其余全部保留）
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const [viewingUserChats, setViewingUserChats] = useState<any[] | null>(null);
  const [viewingSpecificChat, setViewingSpecificChat] = useState<any | null>(null);
  const [adminViewTab, setAdminViewTab] = useState<'chats' | 'images' | 'videos' | 'workflows'>('chats');
  const [viewingUsername, setViewingUsername] = useState<string>("");
  const [activeSettingsTab, setActiveSettingsTab] = useState<string>('general');
  const [selectedPromptModel, setSelectedPromptModel] = useState('gemini-3.5-flash');

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  
  const forceSyncToServer = async () => {
    // ★ Bug E 修复：同步前检查画布数据是否已加载，防止发送空/stripped canvasProjects 到服务器
    if (!isAuthenticated || !hasLoadedFromServer || !hasCanvasLoaded) return;
    const freshPayload = JSON.stringify({
      sessions: sessionsRef.current,
      imageHistory: imageHistoryRef.current,
      videoHistory: videoHistoryRef.current,
      wfSessions: wfSessionsRef.current,
      settings,
      canvasProjects: canvasProjectsRef.current
    });
    latestPayloadRef.current = freshPayload;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${API_BASE}/v1/user/sync_sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}` },
          body: freshPayload
        });
        if (res.ok) {
          // ★ 同步成功后，更新 localStorage 全量备份与云端一致（阶段13-21新增）
          const currentProject = canvasProjectsRef.current?.[0];
          if (currentProject) {
            try { localStorage.setItem('yr-canvas-full-backup', JSON.stringify(currentProject)); } catch(e) {}
          }
          return;
        }
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      } catch(e) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        } else {
          console.error("[Sync Error] 3次重试均失败，画布数据可能未写入云端：", e);
          useAppStore.getState().setToastMsg("⚠️ 云端同步失败，请检查网络！画布数据已保存在本地浏览器中。");
        }
      }
    }
  };

  // 引入聊天大脑
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
  const [videoHistory, setVideoHistory] = useState<VideoRecord[]>([]);

  // 引入工作流大脑
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

  // 头像上传处理
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setSettings(prev => ({ ...prev, avatar: event.target?.result as string }));
      reader.readAsDataURL(file);
    }
  };

  // Refs 和通用状态
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null); 
  const wfTextareaRef = useRef<HTMLTextAreaElement>(null);
  const wfResultScrollRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasLoadedFromServer, setHasLoadedFromServer] = useState(false); 
  const [hasCanvasLoaded, setHasCanvasLoaded] = useState(false);
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

  // 核心生命体征：全局心跳保活引擎
  useEffect(() => {
    let heartbeatTimer: NodeJS.Timeout;
    const sendHeartbeat = () => {
      const token = localStorage.getItem('yr-ai-token');
      if (!token) return;
      fetch(`${API_BASE}/v1/user/heartbeat`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    };
    if (isAuthenticated && hasLoadedFromServer && hasCanvasLoaded) {
      sendHeartbeat();
      heartbeatTimer = setInterval(sendHeartbeat, 30000);
    }
    return () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
  }, [isAuthenticated, hasLoadedFromServer, hasCanvasLoaded]);

  const handleContainerScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
    }
  };

  // ★ 分模块渐进式加载：画布优先，历史数据后台异步补全
  const fetchCanvasProjects = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/v1/user/sessions?modules=canvas`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.canvasProjects && Array.isArray(data.canvasProjects)) {
          useAppStore.setState({ canvasProjects: data.canvasProjects });
        }
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
        setHasCanvasLoaded(true);
      } else if (res.status === 401) {
        localStorage.removeItem('yr-ai-token');
        localStorage.removeItem('yr-ai-role');
        router.push('/login');
      }
    } catch (e) {
      console.error("[Canvas Load Error] 画布数据加载失败，尝试使用本地底稿：", e);
      try {
        const backup = localStorage.getItem('yr-canvas-full-backup');
        if (backup) {
          const projects = JSON.parse(backup);
          if (Array.isArray(projects) && projects.length > 0) {
            useAppStore.setState({ canvasProjects: projects });
            console.log("[Canvas Load] 已从本地底稿恢复画布数据，共", projects.length, "个项目");
          }
        }
      } catch (backupErr) {
        console.error("[Canvas Load Error] 本地底稿也读取失败：", backupErr);
      }
      setHasCanvasLoaded(true);
    }
  };

  const fetchHistoryData = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/v1/user/sessions?modules=chat,image,video,workflow`, { headers: { 'Authorization': `Bearer ${token}` } });
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
            // ★ pollVideoTask 来自 useVideoGen，此处未引入，仅做安全兜底。
            // 状态为 processing 且缺少 task_id/pollModel 的已在上方标记为 failed
            if (v.status === 'processing' && v.task_id && v.pollModel) {
              console.warn("[Workspace] 发现未完成的视频任务，需要 useVideoGen 引入 pollVideoTask", v.id);
            }
          });
        }
        if (data.wfSessions) setWfSessions(data.wfSessions);
      } else if (res.status === 401) {
        localStorage.removeItem('yr-ai-token');
        localStorage.removeItem('yr-ai-role');
        router.push('/login');
      }
    } catch (e) {
      console.error("[History Load Error] 历史数据后台加载失败：", e);
    } finally {
      setHasLoadedFromServer(true);
    }
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
      setHasCanvasLoaded(false);
      fetchCanvasProjects(token); 
      fetchHistoryData(token); 
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

  // 同步引擎：防抖 + 固定间隔 + 脏标记
  const latestPayloadRef = useRef("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasProjectsRef = useRef(canvasProjects);
  useEffect(() => { canvasProjectsRef.current = canvasProjects; }, [canvasProjects]);
  const sessionsRef = useRef(sessions);
  const imageHistoryRef = useRef(imageHistory);
  const videoHistoryRef = useRef(videoHistory);
  const wfSessionsRef = useRef(wfSessions);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  useEffect(() => { imageHistoryRef.current = imageHistory; }, [imageHistory]);
  useEffect(() => { videoHistoryRef.current = videoHistory; }, [videoHistory]);
  useEffect(() => { wfSessionsRef.current = wfSessions; }, [wfSessions]);
   
  const isDirtyRef = useRef(false);
  useEffect(() => { isDirtyRef.current = true; }, [sessions, imageHistory, videoHistory, wfSessions, settings, canvasProjects]);

  useEffect(() => { 
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      latestPayloadRef.current = JSON.stringify({ 
        sessions, imageHistory, videoHistory, wfSessions, settings,
        canvasProjects: canvasProjects
      }); 
    }, 300); 
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); }
  }, [sessions, imageHistory, videoHistory, wfSessions, settings, canvasProjects]);

  useEffect(() => {
    // ★ Bug H 修复：增加 hasCanvasLoaded 门控，确保画布数据加载完成前不启动同步定时器
    if (isInitialized && isAuthenticated && hasLoadedFromServer && hasCanvasLoaded) {
      const syncInterval = setInterval(() => {
        if (isDirtyRef.current) {
          isDirtyRef.current = false;
          forceSyncToServer();
        }
      }, 3000);
      return () => clearInterval(syncInterval);
    }
  }, [isInitialized, isAuthenticated, hasLoadedFromServer, hasCanvasLoaded]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      // ★ Bug I 修复：增加 hasCanvasLoaded 门控，画布数据未加载完成时不触发 beforeunload 同步
      if (isAuthenticated && hasLoadedFromServer && hasCanvasLoaded) {
        const freshPayload = JSON.stringify({
          sessions: sessionsRef.current,
          imageHistory: imageHistoryRef.current,
          videoHistory: videoHistoryRef.current,
          wfSessions: wfSessionsRef.current,
          settings,
          canvasProjects: canvasProjectsRef.current
        });
        const url = `${API_BASE}/v1/user/sync_sessions`;
        const blob = new Blob([freshPayload], { type: 'application/json' });
        if (!navigator.sendBeacon(url, blob)) {
          fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}` }, body: freshPayload, keepalive: true }).catch(() => {});
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAuthenticated, hasLoadedFromServer, hasCanvasLoaded]);

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
      intervalId = setInterval(() => { fetchAdminData(true); }, 30000);
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
    const confirmed = await showConfirm("退出登录", "确定要退出登录吗？");
    if (confirmed) {
      // ★ Bug E 修复：退出登录同步前也检查 hasCanvasLoaded
      if (isAuthenticated && hasLoadedFromServer && hasCanvasLoaded) {
        const freshPayload = JSON.stringify({
          sessions: sessionsRef.current,
          imageHistory: imageHistoryRef.current,
          videoHistory: videoHistoryRef.current,
          wfSessions: wfSessionsRef.current,
          settings,
          canvasProjects: canvasProjectsRef.current
        });
        let syncOk = false;
        try {
          const res = await fetch(`${API_BASE}/v1/user/sync_sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}` },
            body: freshPayload,
            keepalive: true
          });
          syncOk = res.ok;
        } catch(e) { console.error("[Logout] 退出前同步请求失败", e); }
        
        if (!syncOk) {
          const forceQuit = await showConfirm(
            "同步失败",
            "云端保存失败，退出后画布数据将仅保留在浏览器本地。下次登录在其他设备上可能看不到最新修改。\n\n是否强制退出？（画布数据已自动保存在本地浏览器）",
            "danger"
          );
          if (!forceQuit) return;
        }
      }
      
      try { await fetch(`${API_BASE}/v1/logout`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}` } }); } catch(e) {}
      // 清除认证凭证
      localStorage.removeItem('yr-ai-token');
      localStorage.removeItem('yr-ai-role');
      // 清除画布缓存
      sessionStorage.removeItem('yr-canvas-storage');
      localStorage.removeItem('yr-canvas-full-backup');
      // 重置 Zustand App Store 到初始状态
      useAppStore.setState({
        canvasProjects: [],
        activeCanvasProjectId: null,
        activeView: 'chat',
        isSettingsModalOpen: false,
        isFilmControlOpen: false,
        canvasSettings: { defaultLLMModel: 'deepseek-v4-pro', defaultImageModel: 'gpt-image-2', defaultVideoModel: 'doubao-seedance-2-0-260128', globalPromptSuffix: '', globalAssetPromptPrefix: '', globalRatio: '16:9', directorGenre: 'default', directorTempo: '', fissionMethod: 'general' },
        toastMsg: null,
        outOfBalanceMsg: null,
      });
      // ★ 先设标记防止 useEffect 跳转到 /login，再改变认证状态，最后跳首页
      isLoggingOutRef.current = true;
      setIsAuthenticated(false); setUserRole('user');
      router.push('/');
    }
  };

  // 认证检查中显示 loading
  if (isAuthChecking) return <div className="h-screen bg-[#0d0d0d] flex items-center justify-center text-zinc-500 font-mono text-sm">Initializing YR AI Engine...</div>;

  // ==================== 认证后的 SPA UI（原 page.tsx 第 1285 行起） ====================
  return (
    <div className="flex h-screen bg-[#020203] text-zinc-200 antialiased font-sans overflow-hidden relative selection:bg-white/20">
      
      {/* CSS 全局魔法 */}
      <style jsx global>{`
        .typing-cursor::after { content: '●'; display: inline-block; margin-left: 4px; color: #fff; animation: blink 0.8s infinite; font-size: 12px; vertical-align: middle; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .message-appear { animation: fadeIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        @keyframes aurora-flow {
          0% { transform: translate(0, 0) scale(1) rotate(0deg); }
          33% { transform: translate(3vw, -3vh) scale(1.1) rotate(5deg); }
          66% { transform: translate(-2vw, 2vh) scale(0.9) rotate(-5deg); }
          100% { transform: translate(0, 0) scale(1) rotate(0deg); }
        }
        .aurora-1 { animation: aurora-flow 20s infinite ease-in-out alternate; }
        .aurora-2 { animation: aurora-flow 25s infinite ease-in-out alternate-reverse; }
        main [class*="bg-[#171717]"], main [class*="bg-[#121212]"] {
          background-color: transparent !important;
        }
        main [class*="bg-[#1e1e1e]"] {
          background-color: rgba(15, 15, 18, 0.6) !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
          border: 1px solid rgba(255,255,255,0.06) !important;
          box-shadow: 0 4px 24px rgba(0,0,0,0.4) !important;
        }
        main [class*="grid-cols-2"] button {
          background-color: rgba(20, 20, 25, 0.5) !important;
          backdrop-filter: blur(12px) !important;
          border: 1px solid rgba(255,255,255,0.05) !important;
          padding: 10px 16px !important;
          font-size: 13px !important;
          transition: all 0.3s ease !important;
        }
        main [class*="grid-cols-2"] button:hover {
          background-color: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
          transform: translateY(-1px) !important;
        }
        main [class*="bg-[#2f2f2f]"], main [class*="bg-[#1e1e1e]"] textarea {
          background-color: rgba(20, 20, 25, 0.6) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5) !important;
        }
        main .max-w-3xl {
          max-width: 48rem !important;
        }
        main textarea {
          min-height: 44px !important;
          padding-top: 10px !important;
          padding-bottom: 10px !important;
          font-size: 14px !important;
        }
      `}</style>
      
      {/* 环境氛围灯 */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="aurora-1 absolute top-[-15%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-900/10 blur-[120px] mix-blend-screen"></div>
        <div className="aurora-2 absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-blue-900/5 blur-[120px] mix-blend-screen"></div>
        <div className="absolute top-[30%] left-[50%] -translate-x-1/2 w-[60vw] h-[30vh] rounded-full bg-purple-900/5 blur-[150px] pointer-events-none"></div>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-[#1a1a1e]/80 backdrop-blur-2xl border border-white/10 px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 fade-in z-[100001]">
          <AlertTriangle size={15} className="text-indigo-400" />
          <span className="text-xs font-medium text-white">{toastMsg}</span>
        </div>
      )}
      
      {/* 主界面框架 */}
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
          {activeView === 'video-canvas' && !activeCanvasProjectId && hasCanvasLoaded && <CanvasVault />}
          {activeView === 'video-canvas' && activeCanvasProjectId && hasCanvasLoaded && <VideoCanvas imageHistory={imageHistory} videoHistory={videoHistory} />}
          {activeView === 'agent-customer-service' && <AgentCustomerService />}
        </main>
      </div>

      <div style={{ position: 'relative', zIndex: 999990 }}>
        <SearchModal isSearchModalOpen={isSearchModalOpen} setIsSearchModalOpen={setIsSearchModalOpen} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchResults={searchResults} setCurrentSessionId={setCurrentSessionId} setActiveView={setActiveView} />
      </div>

      <SettingsModal isSettingsModalOpen={isSettingsModalOpen} setIsSettingsModalOpen={setIsSettingsModalOpen} activeSettingsTab={activeSettingsTab} setActiveSettingsTab={(val: string) => setActiveSettingsTab(val)} userRole={userRole} settings={settings} setSettings={setSettings} avatarInputRef={avatarInputRef} handleAvatarUpload={handleAvatarUpload} selectedPromptModel={selectedPromptModel} setSelectedPromptModel={setSelectedPromptModel} handleExportData={handleExportData} handleLogout={handleLogout} isAdminLoading={isAdminLoading} fetchAdminData={fetchAdminData} adminUsers={adminUsers} selectedUser={selectedUser} setSelectedUser={setSelectedUser} handleAdminUserAction={handleAdminUserAction} handleViewUserChats={handleViewUserChats} />
      <DeleteConfirmModal isDeleteModalOpen={isDeleteModalOpen} setIsDeleteModalOpen={setIsDeleteModalOpen} confirmDelete={confirmDelete} />
      <AdminRecordsModal viewingUserChats={viewingUserChats} setViewingUserChats={setViewingUserChats} viewingUsername={viewingUsername} adminViewTab={adminViewTab} setAdminViewTab={setAdminViewTab} viewingSpecificChat={viewingSpecificChat} setViewingSpecificChat={setViewingSpecificChat} handleDownloadSpecificRecord={handleDownloadSpecificRecord} setPreviewFileContent={setPreviewFileContent} />
      <FilePreviewModal previewFileContent={previewFileContent} setPreviewFileContent={setPreviewFileContent} />
      <DialogManager />
    </div>
  );
}
