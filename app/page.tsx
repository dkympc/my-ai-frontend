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
import DialogManager from '@/components/modals/DialogManager';
import { showConfirm } from '@/lib/dialogStore';
import type { ChatMessage, ChatSession, AttachedFile, MediaMaterial, ImageRecord, VideoRecord, WfSession } from '@/lib/types';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";
export default function ChatPage() {

  // 1. 从 Zustand 状态库提取全局状态
  const { isAuthenticated, userRole, isAuthChecking, setIsAuthenticated, setUserRole, setIsAuthChecking } = useAuthStore();
  const { activeView, activeCanvasProjectId, isSettingsModalOpen, settings, toastMsg, outOfBalanceMsg, setActiveView, setIsSettingsModalOpen, setSettings, setToastMsg, setOutOfBalanceMsg } = useAppStore();
  const canvasProjects = useAppStore(state => state.canvasProjects);

  // 2. 恢复尚未迁移的局部组件状态
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  // 🆕 注册相关状态
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerInviteCode, setRegisterInviteCode] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
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
    // 提前声明文件状态，给聊天和工作流一起使用
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const forceSyncToServer = () => {
    if (!isAuthenticated || !hasLoadedFromServer) return;
    // ★ 直接从实时 ref 构建 payload，绕过防抖延迟
    const freshPayload = JSON.stringify({
      sessions: sessionsRef.current,
      imageHistory: imageHistoryRef.current,
      videoHistory: videoHistoryRef.current,
      wfSessions: wfSessionsRef.current,
      settings,
      canvasProjects: canvasProjectsRef.current
    });
    latestPayloadRef.current = freshPayload;
    fetch(`${API_BASE}/v1/user/sync_sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}` },
      body: freshPayload
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
  // ✨ 核心生命体征：全局心跳保活引擎
  // ==========================================
  useEffect(() => {
    let heartbeatTimer: NodeJS.Timeout;

    const sendHeartbeat = () => {
      const token = localStorage.getItem('yr-ai-token');
      if (!token) return;
      
      // 🚀 使用原生 fetch 并且抓取所有错误，静默执行
      // 这样即便用户网络波动、断网一两秒，也不会在界面上弹出烦人的报错红框
      fetch(`${API_BASE}/v1/user/heartbeat`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    };

    if (isAuthenticated && hasLoadedFromServer) {
      sendHeartbeat(); // 刚进系统立刻跳一下
      heartbeatTimer = setInterval(sendHeartbeat, 30000); // 之后每 30 秒跳一下
    }

    return () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
  }, [isAuthenticated, hasLoadedFromServer]);
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

  // 🆕 注册函数
  const handleRegister = async () => {
    if (!registerUsername.trim() || !registerPassword.trim()) {
      setToastMsg("请填写用户名和密码");
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      setToastMsg("两次输入的密码不一致");
      return;
    }
    if (registerPassword.length < 4) {
      setToastMsg("密码长度至少 4 位");
      return;
    }
    setRegisterLoading(true);
    try {
      const res = await fetchApi('/v1/register', {
        method: 'POST',
        requireAuth: false,
        body: JSON.stringify({
          username: registerUsername.trim(),
          password: registerPassword,
          invite_code: registerInviteCode.trim(),
        })
      });
      const data = await res.json();
      if (res.ok) {
        setToastMsg("注册成功！请登录。");
        // 切回登录页，清空注册表单
        setIsRegistering(false);
        setLoginUsername(registerUsername); // 预填用户名方便登录
        setRegisterUsername(""); setRegisterPassword(""); setRegisterConfirmPassword("");
        setRegisterInviteCode("");
      } else {
        setToastMsg(data.error?.message || "注册失败");
      }
    } catch (e) {
      setToastMsg("网络连接失败，请检查后端服务");
    } finally {
      setRegisterLoading(false);
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

        // ✨ 画布项目数据拉取
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
        setTimeout(() => setHasLoadedFromServer(true), 500);
      } else if (res.status === 401) {
        // ✨ 新增：如果后端返回 401（Token过期或被踢下线），强制清空并弹回登录页
        localStorage.removeItem('yr-ai-token');
        localStorage.removeItem('yr-ai-role');
        window.location.reload();
      }
    } catch (e) {
      console.error("[Canvas Sync Error] 云端数据加载失败，回退到本地缓存：", e);
      setToastMsg("云端数据加载失败，使用本地缓存");
      setHasLoadedFromServer(true); // ★ 网络故障时允许画布继续使用本地缓存工作
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
  // ★ 画布数据实时引用，绕过防抖延迟，确保 sendBeacon 发送最新数据
  const canvasProjectsRef = useRef(canvasProjects);
  useEffect(() => { canvasProjectsRef.current = canvasProjects; }, [canvasProjects]);
  // ★ 同步关键数据实时引用，退出登录/beforeunload 时直接从 ref 构建 payload
  const sessionsRef = useRef(sessions);
  const imageHistoryRef = useRef(imageHistory);
  const videoHistoryRef = useRef(videoHistory);
  const wfSessionsRef = useRef(wfSessions);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  useEffect(() => { imageHistoryRef.current = imageHistory; }, [imageHistory]);
  useEffect(() => { videoHistoryRef.current = videoHistory; }, [videoHistory]);
  useEffect(() => { wfSessionsRef.current = wfSessions; }, [wfSessions]);
   

  useEffect(() => { 
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    
    debounceTimerRef.current = setTimeout(() => {
      latestPayloadRef.current = JSON.stringify({ 
        sessions, 
        imageHistory, 
        videoHistory, 
        wfSessions, 
        settings,
        canvasProjects: canvasProjects
      }); 
    }, 300); 
    
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); }
  }, [sessions, imageHistory, videoHistory, wfSessions, settings, canvasProjects]);
  useEffect(() => {
    if (isInitialized && isAuthenticated && hasLoadedFromServer) {
      const syncTimer = setTimeout(() => { forceSyncToServer(); }, 2000); 
      return () => clearTimeout(syncTimer);
    }
  }, [sessions, imageHistory, videoHistory, wfSessions, settings, canvasProjects, isInitialized, isAuthenticated, hasLoadedFromServer]);
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isAuthenticated && hasLoadedFromServer) {
        // ★ 直接从实时 ref 构建 payload，完全绕过防抖延迟
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
      // ★ 退出前强制同步最新数据到云端（绕过防抖，直接构建 payload 并等待完成）
      if (isAuthenticated && hasLoadedFromServer) {
        const freshPayload = JSON.stringify({
          sessions: sessionsRef.current,
          imageHistory: imageHistoryRef.current,
          videoHistory: videoHistoryRef.current,
          wfSessions: wfSessionsRef.current,
          settings,
          canvasProjects: canvasProjectsRef.current
        });
        try {
          await fetch(`${API_BASE}/v1/user/sync_sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}` },
            body: freshPayload,
            keepalive: true
          });
        } catch(e) { console.error("[Logout] 退出前同步失败", e); }
      }
      
      try { await fetch(`${API_BASE}/v1/logout`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}` } }); } catch(e) {}
      // ★ 清除认证凭证
      localStorage.removeItem('yr-ai-token');
      localStorage.removeItem('yr-ai-role');
      // ★ 清除画布缓存（sessionStorage），杜绝跨账号数据残留
      sessionStorage.removeItem('yr-canvas-storage');
      // ★ 重置 Zustand App Store 到初始状态
      useAppStore.setState({
        canvasProjects: [],
        activeCanvasProjectId: null,
        activeView: 'chat',
        isSettingsModalOpen: false,
        isFilmControlOpen: false,
        canvasSettings: { defaultImageModel: 'gpt-image-2', defaultVideoModel: 'doubao-seedance-2-0-260128', globalPromptSuffix: '', globalRatio: '16:9', directorGenre: 'default', directorTempo: '' },
        toastMsg: null,
        outOfBalanceMsg: null,
      });
      setIsAuthenticated(false); setUserRole('user'); window.location.reload();
    }
  };

  if (isAuthChecking) return <div className="h-screen bg-[#0d0d0d] flex items-center justify-center text-zinc-500 font-mono text-sm">Initializing YR AI Engine...</div>;
  if (!isAuthenticated) {
    return (
      <div className="relative flex h-screen bg-[#020202] items-center justify-center overflow-hidden font-sans antialiased selection:bg-white/10">

        {/* ========================================== */}
        {/* 全局样式：保留已有动画 + 新增液态玻璃动画   */}
        {/* ========================================== */}
        <style jsx global>{`
          .typing-cursor::after { content: '●'; display: inline-block; margin-left: 4px; color: #6366f1; animation: blink 0.8s infinite; font-size: 12px; vertical-align: middle; }
          @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
          .message-appear { animation: fadeIn 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); filter: blur(2px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }

          /* ===== 液态有机光体变形动画 ===== */
          @keyframes liquidMorph1 {
            0%, 100% { border-radius: 40% 60% 60% 40% / 60% 30% 70% 40%; }
            25%  { border-radius: 58% 42% 35% 65% / 42% 55% 38% 62%; }
            50%  { border-radius: 32% 68% 68% 32% / 48% 58% 42% 52%; }
            75%  { border-radius: 55% 45% 42% 58% / 35% 48% 55% 45%; }
          }
          @keyframes liquidMorph2 {
            0%, 100% { border-radius: 55% 45% 35% 65% / 55% 45% 55% 45%; }
            33%  { border-radius: 38% 62% 58% 42% / 48% 52% 48% 52%; }
            66%  { border-radius: 62% 38% 45% 55% / 42% 58% 42% 58%; }
          }
          @keyframes liquidMorph3 {
            0%, 100% { border-radius: 48% 52% 42% 58% / 58% 42% 58% 42%; }
            50%  { border-radius: 35% 65% 60% 40% / 45% 55% 45% 55%; }
          }

          /* ===== 光体漂移 ===== */
          @keyframes drift1 { 0%, 100% { transform: translate(0,0) scale(1); } 33% { transform: translate(40px,-25px) scale(1.06); } 66% { transform: translate(-20px,30px) scale(0.94); } }
          @keyframes drift2 { 0%, 100% { transform: translate(0,0) scale(1.08); } 50% { transform: translate(-35px,-15px) scale(0.97); } }
          @keyframes drift3 { 0%, 100% { transform: translate(0,0) scale(0.95); } 50% { transform: translate(25px,35px) scale(1.05); } }

          /* ===== 3D网格地板旋转 ===== */
          @keyframes rotate3d { 0% { transform: rotateX(58deg) rotateZ(0deg) translateY(25%) scale(2.6); } 100% { transform: rotateX(58deg) rotateZ(6deg) translateY(25%) scale(2.6); } }

          /* ===== 星空旋转 ===== */
          @keyframes galaxyRotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          @keyframes galaxyDrift { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(15px,-8px) scale(1.03); } }
          @keyframes starGlow {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(2.5); }
          }
          @keyframes starGlow2 {
            0%, 100% { opacity: 0.15; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(3); }
          }
          @keyframes starSlowFlash {
            0%, 100% { opacity: 0.5; box-shadow: 0 0 3px 1px rgba(200,220,255,0.4); }
            50% { opacity: 1; box-shadow: 0 0 12px 4px rgba(180,200,255,0.8); }
          }
          @keyframes nebulaPulse {
            0%, 100% { opacity: 0.35; transform: scale(1) rotate(0deg); }
            50% { opacity: 0.6; transform: scale(1.1) rotate(3deg); }
          }

          /* ===== 术语浮游漂移动画 ===== */
          @keyframes termFloat1 { 0% { transform: translate(0, 0) rotate(0deg); } 25% { transform: translate(18px, -12px) rotate(0.8deg); } 50% { transform: translate(5px, -20px) rotate(1.5deg); } 75% { transform: translate(20px, -5px) rotate(0.3deg); } 100% { transform: translate(0, 0) rotate(0deg); } }
          @keyframes termFloat2 { 0% { transform: translate(0, 0) rotate(0deg); } 25% { transform: translate(-15px, 10px) rotate(-1deg); } 50% { transform: translate(-25px, 5px) rotate(-0.5deg); } 75% { transform: translate(-10px, 15px) rotate(-2deg); } 100% { transform: translate(0, 0) rotate(0deg); } }
          @keyframes termFloat3 { 0% { transform: translate(0, 0) rotate(0deg); } 25% { transform: translate(8px, -15px) rotate(0.5deg); } 50% { transform: translate(20px, -8px) rotate(1.2deg); } 75% { transform: translate(5px, -25px) rotate(0.6deg); } 100% { transform: translate(0, 0) rotate(0deg); } }
          @keyframes termFloat4 { 0% { transform: translate(0, 0) rotate(0deg); } 33% { transform: translate(-20px, -5px) rotate(-1.5deg); } 66% { transform: translate(-8px, -18px) rotate(-0.8deg); } 100% { transform: translate(0, 0) rotate(0deg); } }
          @keyframes termFloat5 { 0% { transform: translate(0, 0) rotate(0deg); } 25% { transform: translate(12px, 8px) rotate(0.4deg); } 50% { transform: translate(-10px, 20px) rotate(-0.6deg); } 75% { transform: translate(18px, -3px) rotate(1deg); } 100% { transform: translate(0, 0) rotate(0deg); } }

          /* ===== 卡片表面光流 ===== */
          @keyframes surfaceFlow { 0% { top: -100%; left: -50%; } 100% { top: 120%; left: 80%; } }

          /* ===== 按钮光核呼吸 ===== */
          @keyframes pulseCore { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.45; } }

          /* ===== 表单元素淡入 ===== */
          @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(14px); filter: blur(3px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }

          /* ===== 底部横线光流 ===== */
          @keyframes barFlow {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
        `}</style>

        {/* ========================================== */}
        {/* 根层：深空底色                          */}
        {/* ========================================== */}
        <div className="absolute inset-0 z-0 bg-[#010108]" />

        {/* ========================================== */}
        {/* 第一层：星系星云（深蓝/紫色大团旋转）        */}
        {/* ========================================== */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[5%] left-[15%] w-[60vw] h-[60vw] rounded-full opacity-40"
               style={{ background: 'radial-gradient(ellipse at center, rgba(20,30,100,0.5) 0%, rgba(10,15,50,0.2) 30%, transparent 65%)', filter: 'blur(80px)', animation: 'nebulaPulse 30s ease-in-out infinite' }} />
          <div className="absolute top-[40%] right-[10%] w-[55vw] h-[55vw] rounded-full opacity-45"
               style={{ background: 'radial-gradient(ellipse at center, rgba(50,15,80,0.45) 0%, rgba(25,10,40,0.18) 30%, transparent 65%)', filter: 'blur(90px)', animation: 'nebulaPulse 35s ease-in-out 5s infinite reverse' }} />
          <div className="absolute bottom-[10%] left-[30%] w-[50vw] h-[45vw] rounded-full opacity-35"
               style={{ background: 'radial-gradient(ellipse at center, rgba(15,25,70,0.4) 0%, rgba(5,15,35,0.15) 30%, transparent 60%)', filter: 'blur(70px)', animation: 'nebulaPulse 40s ease-in-out 10s infinite' }} />
        </div>

        {/* ========================================== */}
        {/* 第二层：密集星场 — 层A 小星（80颗，正转）   */}
        {/* ========================================== */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: `
              radial-gradient(1px 1px at 5% 8%, rgba(200,220,255,0.9), transparent),
              radial-gradient(1px 1px at 12% 15%, rgba(180,200,240,0.7), transparent),
              radial-gradient(1px 1px at 20% 3%, rgba(220,230,255,0.8), transparent),
              radial-gradient(1px 1px at 28% 11%, rgba(190,210,250,0.6), transparent),
              radial-gradient(1px 1px at 35% 22%, rgba(210,225,250,0.75), transparent),
              radial-gradient(1px 1px at 42% 7%, rgba(180,200,240,0.85), transparent),
              radial-gradient(1px 1px at 50% 18%, rgba(200,220,255,0.65), transparent),
              radial-gradient(1px 1px at 58% 5%, rgba(220,230,255,0.9), transparent),
              radial-gradient(1px 1px at 65% 14%, rgba(190,210,250,0.7), transparent),
              radial-gradient(1px 1px at 72% 9%, rgba(210,220,250,0.55), transparent),
              radial-gradient(1px 1px at 80% 20%, rgba(180,200,240,0.8), transparent),
              radial-gradient(1px 1px at 88% 6%, rgba(200,220,255,0.7), transparent),
              radial-gradient(1px 1px at 95% 12%, rgba(220,230,255,0.6), transparent),
              radial-gradient(1px 1px at 3% 28%, rgba(190,210,250,0.75), transparent),
              radial-gradient(1px 1px at 10% 35%, rgba(210,225,250,0.55), transparent),
              radial-gradient(1px 1px at 18% 32%, rgba(200,220,255,0.85), transparent),
              radial-gradient(1px 1px at 25% 42%, rgba(180,200,240,0.6), transparent),
              radial-gradient(1px 1px at 33% 28%, rgba(220,230,255,0.7), transparent),
              radial-gradient(1px 1px at 40% 38%, rgba(190,210,250,0.8), transparent),
              radial-gradient(1px 1px at 48% 33%, rgba(210,220,250,0.5), transparent),
              radial-gradient(1px 1px at 55% 45%, rgba(200,220,255,0.75), transparent),
              radial-gradient(1px 1px at 62% 25%, rgba(180,200,240,0.85), transparent),
              radial-gradient(1px 1px at 70% 40%, rgba(220,230,255,0.6), transparent),
              radial-gradient(1px 1px at 78% 35%, rgba(190,210,250,0.9), transparent),
              radial-gradient(1px 1px at 85% 30%, rgba(210,225,250,0.7), transparent),
              radial-gradient(1px 1px at 92% 22%, rgba(200,220,255,0.55), transparent),
              radial-gradient(1px 1px at 8% 52%, rgba(180,200,240,0.8), transparent),
              radial-gradient(1px 1px at 15% 48%, rgba(220,230,255,0.65), transparent),
              radial-gradient(1px 1px at 22% 58%, rgba(190,210,250,0.75), transparent),
              radial-gradient(1px 1px at 30% 52%, rgba(210,220,250,0.55), transparent),
              radial-gradient(1px 1px at 38% 48%, rgba(200,220,255,0.85), transparent),
              radial-gradient(1px 1px at 45% 55%, rgba(180,200,240,0.7), transparent),
              radial-gradient(1px 1px at 52% 62%, rgba(220,230,255,0.6), transparent),
              radial-gradient(1px 1px at 60% 48%, rgba(190,210,250,0.9), transparent),
              radial-gradient(1px 1px at 68% 55%, rgba(210,225,250,0.5), transparent),
              radial-gradient(1px 1px at 75% 50%, rgba(200,220,255,0.8), transparent),
              radial-gradient(1px 1px at 82% 58%, rgba(180,200,240,0.65), transparent),
              radial-gradient(1px 1px at 90% 45%, rgba(220,230,255,0.75), transparent),
              radial-gradient(1px 1px at 5% 65%, rgba(190,210,250,0.55), transparent),
              radial-gradient(1px 1px at 13% 72%, rgba(210,220,250,0.85), transparent),
              radial-gradient(1px 1px at 20% 68%, rgba(200,220,255,0.6), transparent),
              radial-gradient(1px 1px at 28% 78%, rgba(180,200,240,0.7), transparent),
              radial-gradient(1px 1px at 35% 65%, rgba(220,230,255,0.8), transparent),
              radial-gradient(1px 1px at 43% 72%, rgba(190,210,250,0.5), transparent),
              radial-gradient(1px 1px at 50% 80%, rgba(210,225,250,0.75), transparent),
              radial-gradient(1px 1px at 58% 68%, rgba(200,220,255,0.85), transparent),
              radial-gradient(1px 1px at 65% 78%, rgba(180,200,240,0.55), transparent),
              radial-gradient(1px 1px at 72% 62%, rgba(220,230,255,0.9), transparent),
              radial-gradient(1px 1px at 80% 75%, rgba(190,210,250,0.65), transparent),
              radial-gradient(1px 1px at 88% 68%, rgba(210,220,250,0.7), transparent),
              radial-gradient(1px 1px at 95% 72%, rgba(200,220,255,0.55), transparent),
              radial-gradient(1px 1px at 8% 85%, rgba(180,200,240,0.8), transparent),
              radial-gradient(1px 1px at 15% 80%, rgba(220,230,255,0.6), transparent),
              radial-gradient(1px 1px at 25% 88%, rgba(190,210,250,0.75), transparent),
              radial-gradient(1px 1px at 33% 82%, rgba(210,225,250,0.5), transparent),
              radial-gradient(1px 1px at 40% 90%, rgba(200,220,255,0.85), transparent),
              radial-gradient(1px 1px at 48% 85%, rgba(180,200,240,0.7), transparent),
              radial-gradient(1px 1px at 55% 92%, rgba(220,230,255,0.55), transparent),
              radial-gradient(1px 1px at 62% 80%, rgba(190,210,250,0.9), transparent),
              radial-gradient(1px 1px at 70% 88%, rgba(210,220,250,0.65), transparent),
              radial-gradient(1px 1px at 78% 82%, rgba(200,220,255,0.75), transparent),
              radial-gradient(1px 1px at 85% 90%, rgba(180,200,240,0.5), transparent),
              radial-gradient(1px 1px at 92% 85%, rgba(220,230,255,0.8), transparent),
              radial-gradient(1px 1px at 3% 92%, rgba(190,210,250,0.6), transparent),
              radial-gradient(1px 1px at 18% 95%, rgba(210,225,250,0.85), transparent),
              radial-gradient(1px 1px at 38% 94%, rgba(200,220,255,0.7), transparent),
              radial-gradient(1px 1px at 58% 96%, rgba(180,200,240,0.55), transparent),
              radial-gradient(1px 1px at 75% 93%, rgba(220,230,255,0.75), transparent),
              radial-gradient(1px 1px at 88% 95%, rgba(190,210,250,0.6), transparent)
            `,
            backgroundSize: '100% 100%',
            animation: 'galaxyRotate 250s linear infinite',
          }}
        />

        {/* ========================================== */}
        {/* 第二层：密集星场 — 层B 中星（35颗，反转）   */}
        {/* ========================================== */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: `
              radial-gradient(1.5px 1.5px at 7% 20%, rgba(180,210,255,0.9), transparent),
              radial-gradient(1.5px 1.5px at 23% 8%, rgba(200,230,255,0.8), transparent),
              radial-gradient(1.5px 1.5px at 38% 15%, rgba(160,200,240,0.75), transparent),
              radial-gradient(1.5px 1.5px at 52% 5%, rgba(220,240,255,0.85), transparent),
              radial-gradient(1.5px 1.5px at 67% 12%, rgba(180,210,250,0.7), transparent),
              radial-gradient(1.5px 1.5px at 81% 25%, rgba(200,220,250,0.8), transparent),
              radial-gradient(1.5px 1.5px at 93% 10%, rgba(170,200,245,0.65), transparent),
              radial-gradient(2px 2px at 12% 40%, rgba(210,235,255,0.85), transparent),
              radial-gradient(1.5px 1.5px at 28% 35%, rgba(180,205,245,0.7), transparent),
              radial-gradient(2px 2px at 45% 28%, rgba(190,220,255,0.9), transparent),
              radial-gradient(1.5px 1.5px at 60% 42%, rgba(200,225,250,0.75), transparent),
              radial-gradient(2px 2px at 75% 30%, rgba(170,200,240,0.8), transparent),
              radial-gradient(1.5px 1.5px at 88% 38%, rgba(215,235,255,0.7), transparent),
              radial-gradient(1.5px 1.5px at 5% 55%, rgba(190,210,245,0.85), transparent),
              radial-gradient(2px 2px at 18% 50%, rgba(205,230,255,0.65), transparent),
              radial-gradient(1.5px 1.5px at 33% 60%, rgba(175,205,240,0.9), transparent),
              radial-gradient(1.5px 1.5px at 48% 48%, rgba(220,240,255,0.7), transparent),
              radial-gradient(2px 2px at 63% 55%, rgba(185,210,250,0.8), transparent),
              radial-gradient(1.5px 1.5px at 78% 50%, rgba(200,220,245,0.75), transparent),
              radial-gradient(1.5px 1.5px at 92% 58%, rgba(165,195,240,0.65), transparent),
              radial-gradient(1.5px 1.5px at 10% 72%, rgba(195,220,255,0.8), transparent),
              radial-gradient(2px 2px at 25% 68%, rgba(180,210,245,0.7), transparent),
              radial-gradient(1.5px 1.5px at 40% 78%, rgba(215,235,255,0.85), transparent),
              radial-gradient(1.5px 1.5px at 55% 65%, rgba(170,200,240,0.75), transparent),
              radial-gradient(1.5px 1.5px at 70% 75%, rgba(200,225,250,0.9), transparent),
              radial-gradient(2px 2px at 85% 68%, rgba(185,210,245,0.65), transparent),
              radial-gradient(1.5px 1.5px at 15% 85%, rgba(210,230,255,0.8), transparent),
              radial-gradient(1.5px 1.5px at 32% 90%, rgba(175,205,240,0.7), transparent),
              radial-gradient(2px 2px at 50% 82%, rgba(195,220,255,0.75), transparent),
              radial-gradient(1.5px 1.5px at 65% 88%, rgba(165,195,245,0.85), transparent),
              radial-gradient(1.5px 1.5px at 80% 78%, rgba(220,240,255,0.65), transparent),
              radial-gradient(1.5px 1.5px at 95% 82%, rgba(190,215,250,0.7), transparent),
              radial-gradient(1.5px 1.5px at 20% 92%, rgba(205,225,245,0.8), transparent),
              radial-gradient(2px 2px at 42% 95%, rgba(170,200,240,0.6), transparent),
              radial-gradient(1.5px 1.5px at 72% 92%, rgba(195,220,255,0.75), transparent)
            `,
            backgroundSize: '130% 130%',
            animation: 'galaxyRotate 320s linear infinite reverse',
          }}
        />

        {/* ========================================== */}
        {/* 第三层：亮星（15颗脉冲大星，蓝/白/紫混合） */}
        {/* ========================================== */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '10%', left: '22%', background: '#c8d8ff', boxShadow: '0 0 12px 4px rgba(160,180,255,0.7), 0 0 30px 8px rgba(140,160,240,0.3)', animation: 'starGlow 5s ease-in-out 0s infinite' }} />
          <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '25%', left: '78%', background: '#e0e8ff', boxShadow: '0 0 15px 5px rgba(180,200,255,0.65), 0 0 35px 10px rgba(160,180,240,0.25)', animation: 'starGlow2 6.5s ease-in-out 1.2s infinite' }} />
          <div className="absolute w-[2.5px] h-[2.5px] rounded-full" style={{ top: '8%', left: '55%', background: '#b8c8f0', boxShadow: '0 0 10px 3px rgba(140,170,240,0.6)', animation: 'starSlowFlash 7s ease-in-out 3s infinite' }} />
          <div className="absolute w-[3px] h-[3px] rounded-full" style={{ top: '45%', left: '12%', background: '#d0dcff', boxShadow: '0 0 18px 6px rgba(170,190,255,0.8), 0 0 40px 12px rgba(150,170,240,0.35)', animation: 'starGlow 4.2s ease-in-out 0.8s infinite' }} />
          <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '60%', left: '85%', background: '#c0d0f0', boxShadow: '0 0 10px 3px rgba(150,180,245,0.55)', animation: 'starSlowFlash 8s ease-in-out 1.5s infinite' }} />
          <div className="absolute w-[2.5px] h-[2.5px] rounded-full" style={{ top: '72%', left: '6%', background: '#e4ecff', boxShadow: '0 0 14px 5px rgba(180,200,255,0.7), 0 0 32px 8px rgba(160,180,240,0.3)', animation: 'starGlow2 5.8s ease-in-out 2s infinite' }} />
          <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '88%', left: '38%', background: '#a8b8e8', boxShadow: '0 0 8px 3px rgba(130,160,240,0.5)', animation: 'starGlow 6s ease-in-out 0.3s infinite' }} />
          <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '32%', left: '42%', background: '#d8e0ff', boxShadow: '0 0 12px 4px rgba(170,190,255,0.55)', animation: 'starSlowFlash 5.5s ease-in-out 4s infinite' }} />
          <div className="absolute w-[3px] h-[3px] rounded-full" style={{ top: '18%', left: '92%', background: '#ccdaff', boxShadow: '0 0 16px 5px rgba(160,185,255,0.75), 0 0 38px 10px rgba(140,165,240,0.3)', animation: 'starGlow 3.5s ease-in-out 1.8s infinite' }} />
          <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '55%', left: '30%', background: '#b0c0f0', boxShadow: '0 0 9px 3px rgba(145,175,240,0.6)', animation: 'starGlow2 7.2s ease-in-out 0.5s infinite' }} />
          <div className="absolute w-[2.5px] h-[2.5px] rounded-full" style={{ top: '38%', left: '62%', background: '#e0e8ff', boxShadow: '0 0 13px 4px rgba(175,195,255,0.7), 0 0 28px 7px rgba(155,175,240,0.3)', animation: 'starSlowFlash 4.8s ease-in-out 2.5s infinite' }} />
          <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '80%', left: '72%', background: '#c4d4fc', boxShadow: '0 0 11px 3px rgba(155,180,250,0.65)', animation: 'starGlow 5.2s ease-in-out 3.3s infinite' }} />
          <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '5%', left: '35%', background: '#d4e0ff', boxShadow: '0 0 10px 3px rgba(165,185,255,0.5)', animation: 'starGlow2 6.8s ease-in-out 4.5s infinite' }} />
          <div className="absolute w-[2.5px] h-[2.5px] rounded-full" style={{ top: '93%', left: '58%', background: '#bcc8f8', boxShadow: '0 0 13px 4px rgba(150,175,245,0.7), 0 0 30px 8px rgba(135,160,240,0.3)', animation: 'starSlowFlash 5.3s ease-in-out 0.7s infinite' }} />
          <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '68%', left: '48%', background: '#e8f0ff', boxShadow: '0 0 8px 2px rgba(170,190,255,0.6)', animation: 'starGlow 4.5s ease-in-out 1.5s infinite' }} />
        </div>

        {/* ========================================== */}
        {/* 术语浮游层：5词中英混搭，稀疏散落深空       */}
        {/* ========================================== */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none" style={{ fontFamily: "'Cormorant Garamond', 'EB Garamond', 'Noto Serif SC', 'Georgia', 'Songti SC', serif" }}>
          {/* 主锚：交响 — 96px 大字，左上，极慢漂移 */}
          <span
            className="absolute italic tracking-[0.6em] whitespace-nowrap"
            style={{
              fontSize: '96px',
              fontWeight: 300,
              top: '20%',
              left: '10%',
              color: 'rgba(200,210,230,0.18)',
              textShadow: '0 0 80px rgba(160,180,220,0.25), 0 0 200px rgba(140,160,210,0.12)',
              fontStyle: 'italic',
              animation: 'termFloat1 60s ease-in-out -10s infinite',
            }}
          >
            &ensp;交&ensp;响&ensp;
          </span>

          {/* CINEMATIC — 32px，右上，意大利斜体 */}
          <span
            className="absolute italic tracking-[0.5em] whitespace-nowrap"
            style={{
              fontSize: '32px',
              fontWeight: 200,
              top: '12%',
              left: '70%',
              color: 'rgba(170,200,230,0.15)',
              textShadow: '0 0 40px rgba(150,180,220,0.18)',
              fontStyle: 'italic',
              animation: 'termFloat2 70s ease-in-out -25s infinite',
            }}
          >
            CINEMATIC
          </span>

          {/* 光影 — 38px，左下 */}
          <span
            className="absolute italic tracking-[0.55em] whitespace-nowrap"
            style={{
              fontSize: '38px',
              fontWeight: 250,
              top: '65%',
              left: '4%',
              color: 'rgba(180,190,210,0.16)',
              textShadow: '0 0 60px rgba(140,160,200,0.2)',
              fontStyle: 'italic',
              animation: 'termFloat3 55s ease-in-out -15s infinite',
            }}
          >
            &ensp;光&ensp;影&ensp;
          </span>

          {/* RHYTHM — 28px，右下偏中 */}
          <span
            className="absolute italic tracking-[0.5em] whitespace-nowrap"
            style={{
              fontSize: '28px',
              fontWeight: 200,
              top: '60%',
              left: '65%',
              color: 'rgba(165,195,225,0.14)',
              textShadow: '0 0 35px rgba(140,170,210,0.16)',
              fontStyle: 'italic',
              animation: 'termFloat4 65s ease-in-out -35s infinite',
            }}
          >
            RHYTHM
          </span>

          {/* 视界 — 30px，中上偏右 */}
          <span
            className="absolute italic tracking-[0.5em] whitespace-nowrap"
            style={{
              fontSize: '30px',
              fontWeight: 250,
              top: '6%',
              left: '48%',
              color: 'rgba(185,200,220,0.15)',
              textShadow: '0 0 45px rgba(145,170,210,0.18)',
              fontStyle: 'italic',
              animation: 'termFloat5 50s ease-in-out -5s infinite',
            }}
          >
            &ensp;视&ensp;界&ensp;
          </span>
        </div>

        {/* ========================================== */}
        {/* 第二层：液态有机光体（缓慢变形流动）        */}
        {/* ========================================== */}
        <div className="absolute inset-0 z-[1] overflow-hidden pointer-events-none">
          <div
            className="absolute -top-[15%] -left-[8%] w-[55vw] h-[55vw] opacity-50"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(60,60,60,0.35) 0%, rgba(30,30,30,0.15) 40%, transparent 70%)',
              animation: 'liquidMorph1 20s ease-in-out infinite, drift1 28s ease-in-out infinite',
              filter: 'blur(100px)',
            }}
          />
          <div
            className="absolute top-[35%] -right-[10%] w-[45vw] h-[45vw] opacity-45"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(50,50,50,0.3) 0%, rgba(20,20,20,0.12) 40%, transparent 70%)',
              animation: 'liquidMorph2 24s ease-in-out infinite, drift2 32s ease-in-out infinite',
              filter: 'blur(85px)',
            }}
          />
          <div
            className="absolute -bottom-[20%] left-[25%] w-[50vw] h-[50vw] opacity-40"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(55,55,55,0.3) 0%, rgba(25,25,25,0.1) 40%, transparent 70%)',
              animation: 'liquidMorph3 22s ease-in-out infinite, drift3 35s ease-in-out infinite',
              filter: 'blur(110px)',
            }}
          />
        </div>

        {/* ========================================== */}
        {/* Toast 通知（风格统一为液态玻璃）            */}
        {/* ========================================== */}
        {toastMsg && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] px-6 py-3 rounded-full animate-in slide-in-from-top-4 fade-in"
               style={{
                 background: 'linear-gradient(180deg, rgba(20,20,20,0.85), rgba(8,8,8,0.9))',
                 backdropFilter: 'blur(20px)',
                 border: '1px solid rgba(255,255,255,0.06)',
                 boxShadow: '0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)',
               }}>
            <div className="flex items-center gap-3">
              <AlertTriangle size={14} className="text-zinc-500" />
              <span className="text-xs font-light text-zinc-300 tracking-wider">{toastMsg}</span>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 登录卡片：液态玻璃体                        */}
        {/* ========================================== */}
        <div
          className="relative z-10 w-full max-w-[360px] mx-6 p-8 rounded-[36px] overflow-hidden"
          style={{
            background: 'linear-gradient(165deg, rgba(22,22,22,0.5) 0%, rgba(6,6,6,0.65) 40%, rgba(18,18,18,0.5) 100%)',
            backdropFilter: 'blur(50px)',
            WebkitBackdropFilter: 'blur(50px)',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: `
              0 50px 120px rgba(0,0,0,0.8),
              0 15px 40px rgba(0,0,0,0.6),
              inset 0 1px 0 rgba(255,255,255,0.04),
              inset 0 -1px 0 rgba(0,0,0,0.6),
              0 0 0 1px rgba(255,255,255,0.01)
            `,
          }}
        >
          {/* 表面光流层（caustics 模拟） */}
          <div
            className="absolute z-0 pointer-events-none"
            style={{
              top: '-30%', left: '-40%',
              width: '50%', height: '50%',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 70%)',
              animation: 'surfaceFlow 8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          />
          <div
            className="absolute z-0 pointer-events-none"
            style={{
              top: '50%', left: '60%',
              width: '40%', height: '40%',
              borderRadius: '60% 40% 50% 50% / 50% 50% 40% 60%',
              background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.03) 0%, transparent 70%)',
              animation: 'surfaceFlow 11s cubic-bezier(0.4, 0, 0.6, 1) infinite reverse',
            }}
          />

          {/* 顶部折射光条 */}
          <div className="absolute top-0 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          {/* 内容区 */}
          <div className="relative z-[5]">
            {/* ===== LOGO 区 ===== */}
            <div className="flex flex-col items-center mb-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 relative"
                style={{
                  background: 'linear-gradient(135deg, rgba(35,35,35,0.9), rgba(10,10,10,0.95))',
                  boxShadow: '0 0 40px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, transparent 35%, rgba(255,255,255,0.05) 48%, transparent 65%)' }} />
                </div>
                <span className="relative text-white text-[22px] font-black tracking-tighter select-none"
                      style={{ textShadow: '0 0 25px rgba(255,255,255,0.08)' }}>
                  YR
                </span>
              </div>
              <h1 className="text-lg font-thin text-white tracking-[0.4em] mb-2 select-none"
                  style={{ letterSpacing: '0.5em' }}>
                WELCOME
              </h1>
              <p className="text-[10px] text-zinc-700 tracking-[0.3em] font-light select-none">登录以继续</p>
            </div>

            {/* ===== 表单区 ===== */}
            <div className="space-y-5">
              {!isRegistering ? (
                <>
                  {/* ===== 登录模式 ===== */}
                  {/* 账号输入框 */}
                  <div style={{ animation: 'fadeSlideUp 0.7s ease-out 0.1s both' }}>
                    <label className="block text-[9px] font-light text-zinc-500 tracking-[0.25em] mb-2 ml-1 select-none">
                      ACCOUNT
                    </label>
                    <input
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-all"
                      placeholder="输入账号"
                    />
                  </div>

                  {/* 密码输入框 */}
                  <div style={{ animation: 'fadeSlideUp 0.7s ease-out 0.2s both' }}>
                    <label className="block text-[9px] font-light text-zinc-500 tracking-[0.25em] mb-2 ml-1 select-none">
                      PASSWORD
                    </label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-all"
                      placeholder="输入密码"
                    />
                  </div>

                  {/* 登录按钮 */}
                  <div className="pt-3" style={{ animation: 'fadeSlideUp 0.7s ease-out 0.35s both' }}>
                    <button
                      onClick={handleLogin}
                      disabled={loginLoading || !loginUsername.trim() || !loginPassword.trim()}
                      className="relative w-full py-3.5 rounded-2xl font-light text-[13px] tracking-[0.2em] transition-all duration-700 disabled:opacity-20 disabled:cursor-not-allowed overflow-hidden group border border-transparent"
                      style={{
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)',
                        borderColor: 'rgba(255,255,255,0.12)',
                        boxShadow: '0 0 40px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.9)',
                      }}
                      onMouseEnter={(e) => {
                        if (e.currentTarget.disabled) return;
                        e.currentTarget.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.07) 100%)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
                        e.currentTarget.style.boxShadow = '0 0 60px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.1)';
                        e.currentTarget.style.color = 'rgba(255,255,255,1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                        e.currentTarget.style.boxShadow = '0 0 40px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)';
                        e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
                      }}
                    >
                      <div className="absolute inset-0 rounded-2xl pointer-events-none"
                           style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 45%, rgba(255,255,255,0.1) 0%, transparent 70%)', animation: 'pulseCore 3s ease-in-out infinite' }} />
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {loginLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                        {loginLoading ? "验证中..." : "SIGN IN"}
                      </span>
                    </button>
                  </div>

                  {/* 切换到注册 */}
                  <div style={{ animation: 'fadeSlideUp 0.7s ease-out 0.45s both' }}>
                    <button
                      onClick={() => setIsRegistering(true)}
                      className="w-full py-3 rounded-2xl font-light text-[12px] tracking-[0.2em] transition-all duration-700 text-zinc-500 hover:text-zinc-300"
                      style={{
                        background: 'rgba(255,255,255,0.015)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                        e.currentTarget.style.boxShadow = '0 0 20px rgba(255,255,255,0.04)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.015)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      CREATE ACCOUNT
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* ===== 注册模式 ===== */}
                  {/* 左上角返回箭头 */}
                  <button
                    onClick={() => { setIsRegistering(false); setRegisterUsername(""); setRegisterPassword(""); setRegisterConfirmPassword(""); setRegisterInviteCode(""); }}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors mb-5"
                    style={{ animation: 'fadeSlideUp 0.5s ease-out both' }}
                  >
                    ←
                  </button>

                  {/* 用户名 */}
                  <div style={{ animation: 'fadeSlideUp 0.6s ease-out 0.08s both' }}>
                    <label className="block text-[9px] font-light text-zinc-500 tracking-[0.25em] mb-1.5 ml-1 select-none">USERNAME</label>
                    <input type="text" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-all" placeholder="设置登录账号" />
                  </div>

                  {/* 密码 */}
                  <div style={{ animation: 'fadeSlideUp 0.6s ease-out 0.12s both' }}>
                    <label className="block text-[9px] font-light text-zinc-500 tracking-[0.25em] mb-1.5 ml-1 select-none">PASSWORD</label>
                    <input type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-all" placeholder="至少4位" />
                  </div>

                  {/* 确认密码 */}
                  <div style={{ animation: 'fadeSlideUp 0.6s ease-out 0.16s both' }}>
                    <label className="block text-[9px] font-light text-zinc-500 tracking-[0.25em] mb-1.5 ml-1 select-none">CONFIRM</label>
                    <input type="password" value={registerConfirmPassword} onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-all" placeholder="再次输入密码" />
                  </div>

                  {/* 邀请码 */}
                  <div style={{ animation: 'fadeSlideUp 0.6s ease-out 0.2s both' }}>
                    <label className="block text-[9px] font-light text-zinc-500 tracking-[0.25em] mb-1.5 ml-1 select-none">
                      INVITE CODE <span className="text-red-400/60">*</span>
                    </label>
                    <input type="text" value={registerInviteCode} onChange={(e) => setRegisterInviteCode(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-all" placeholder="联系管理员获取" />
                  </div>

                  {/* 注册按钮 */}
                  <div className="pt-2" style={{ animation: 'fadeSlideUp 0.6s ease-out 0.28s both' }}>
                    <button
                      onClick={handleRegister}
                      disabled={registerLoading || !registerUsername.trim() || !registerPassword.trim() || !registerConfirmPassword.trim()}
                      className="relative w-full py-3.5 rounded-2xl font-light text-[13px] tracking-[0.2em] transition-all duration-700 disabled:opacity-20 disabled:cursor-not-allowed overflow-hidden group border border-transparent"
                      style={{
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)',
                        borderColor: 'rgba(255,255,255,0.12)',
                        boxShadow: '0 0 40px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.9)',
                      }}
                    >
                      <div className="absolute inset-0 rounded-2xl pointer-events-none"
                           style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 45%, rgba(255,255,255,0.1) 0%, transparent 70%)', animation: 'pulseCore 3s ease-in-out infinite' }} />
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {registerLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                        {registerLoading ? "注册中..." : "REGISTER"}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 底部反射光条 */}
          <div
            className="absolute bottom-0 left-[15%] right-[15%] h-px pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03) 20%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 80%, transparent)',
              backgroundSize: '200% 100%',
              animation: 'barFlow 6s linear infinite',
            }}
          />
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
          {/* 👇 全新的画布路由控制（增加 hasLoadedFromServer 拦截，防覆盖死锁） 👇 */}
          {activeView === 'video-canvas' && !activeCanvasProjectId && hasLoadedFromServer && <CanvasVault />}
          {activeView === 'video-canvas' && activeCanvasProjectId && hasLoadedFromServer && <VideoCanvas imageHistory={imageHistory} videoHistory={videoHistory} />}
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