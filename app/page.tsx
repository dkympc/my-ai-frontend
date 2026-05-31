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
// 🧩 工作流/智能体 配置注册表
// ==========================================
export const WORKFLOW_REGISTRY = [
  {
    id: 'dify-script-storyboard',
    name: '剧本分镜助手',
    desc: '将长篇剧本自动拆解为结构化的分镜脚本，包含画面、景别和台词。',
    category: 'content', 
    engine: 'dify',   
    icon: <Film size={20} className="text-purple-400" />,
    inputs: [
      { key: 'script_text', label: '剧本内容', type: 'textarea', placeholder: '请输入完整剧本进行拆解...' }
    ]
  },
  {
    id: 'dify-frame-splitter',
    name: '分镜拆帧助手',
    desc: '基于物理运镜逻辑，将剧本/分镜智能拆解为包含英文相机参数的连续定帧生图提示词。',
    category: 'content', 
    engine: 'dify',   
    icon: <Sparkles size={20} className="text-yellow-400" />,
    inputs: [
      { key: 'script_content', label: '完整剧情剧本 (第一步)', type: 'textarea', placeholder: '请在此粘贴完整剧本。提交后AI将为您推荐并锁定摄影机参数...' }
    ]
  },
  {
    id: 'dify-paragraph-storyboard',
    name: '段落分镜助手',
    desc: '专注于将单一复杂段落转化为连贯的多个分镜镜头。',
    category: 'content', 
    engine: 'dify',   
    icon: <Layers size={20} className="text-indigo-400" />,
    inputs: [
      { key: 'paragraph', label: '段落内容', type: 'textarea', placeholder: '请输入需要拆解的具体段落...' }
    ]
  },
  {
    id: 'dify-script-creator',
    name: '剧本创作助手',
    desc: '输入核心立意与主题，AI 自动生成符合三幕剧结构的完整短视频剧本。',
    category: 'content', 
    engine: 'dify',   
    icon: <PenTool size={20} className="text-pink-400" />,
    inputs: [
      { key: 'theme', label: '核心主题/立意', type: 'text', placeholder: '例如：职场新人的第一次汇报' },
      { key: 'genre', label: '剧本类型', type: 'select', options: ['搞笑反转', '情感走心', '悬疑惊悚', '干货科普'] }
    ]
  },
  {
    id: 'dify-xiaohongshu-copywriter',
    name: '小红书爆款文案生成器',
    desc: '基于爆款逻辑，自动生成带 Emoji 的网感文案与标题组合。',
    category: 'content', 
    engine: 'dify',   
    icon: <PenTool size={20} className="text-pink-400" />,
    inputs: [
      { key: 'topic', label: '核心主题', type: 'text', placeholder: '例如：秋季穿搭日常' },
      { key: 'tone', label: '文案语气', type: 'select', options: ['网感种草', '干货测评', '情绪共鸣', '专业严谨'] },
      { key: 'keywords', label: '必须包含的关键词', type: 'textarea', placeholder: '用逗号分隔...' }
    ]
  },
  {
    id: 'dify-article-polish',
    name: '公众号文章深度润色',
    desc: '修正错别字，优化语序，提升文章的逻辑性与可读性。',
    category: 'content',
    engine: 'dify',
    icon: <FileText size={20} className="text-blue-400" />,
    inputs: [
      { key: 'original_text', label: '原文内容', type: 'textarea', placeholder: '请粘贴需要润色的文字...' }
    ]
  },
  {
    id: 'comfyui-product-bg',
    name: '电商商品白底图换景',
    desc: '自动识别商品主体，融合生成高级摄影棚背景。',
    category: 'image',
    engine: 'comfyui',
    icon: <ImageIcon size={20} className="text-emerald-400" />,
    inputs: [
      { key: 'product_image', label: '商品白底图', type: 'file' },
      { key: 'scene_prompt', label: '场景描述', type: 'text', placeholder: '例如：放在木质桌面上，阳光穿过树叶洒下斑驳光影' }
    ]
  },
  {
    id: 'n8n-daily-report',
    name: '全网热点日报搜集',
    desc: '自动抓取微博、知乎、抖音热搜，并由 AI 总结成早报。',
    category: 'data',
    engine: 'n8n',
    icon: <BarChart size={20} className="text-orange-400" />,
    inputs: [
      { key: 'focus_industry', label: '关注行业', type: 'select', options: ['科技互联网', '金融财经', '娱乐影视', '全部'] }
    ]
  },
  {
    id: 'agent-social-media',
    name: '全自动社媒运营 Agent',
    desc: '自动抓取热点、生成图文并一键分发到多平台，全程无人值守。',
    category: 'agent',
    engine: 'agent',
    icon: <Globe size={20} className="text-blue-500" />,
    inputs: [
      { key: 'topic', label: '今日关注话题', type: 'text', placeholder: '例如：人工智能最新进展' }
    ]
  },
  {
    id: 'agent-customer-service',
    name: '智能客服与工单 Agent',
    desc: '接入知识库，自动回复用户咨询，遇到复杂问题自动生成工单流转。',
    category: 'agent',
    engine: 'agent',
    icon: <MessageSquare size={20} className="text-green-500" />,
    inputs: [
      { key: 'user_query', label: '模拟用户咨询', type: 'textarea', placeholder: '输入用户的提问进行测试...' }
    ]
  }
];

const MODELS = [
  { id: 'gpt-5.4', name: 'GPT-5.4', desc: '最强逻辑与创造力' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', desc: '极致响应速度' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', desc: '复杂推理与长文本' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4', desc: '深度思考与逻辑' },
];
const IMAGE_MODELS = [
  { id: 'gpt-image-2', name: 'GPT-Image-2', desc: '官方稳定生图', features: ['ratio', 'style'] },
  { id: 'banana2', name: 'Banana 2', desc: '极速生成引擎', features: ['ratio', 'negative', 'style'] },
  { id: 'banana-pro', name: 'Banana Pro', desc: '专业级细节把控', features: ['ratio', 'stylize', 'negative'] },
  { id: 'seedream5.0', name: 'Seedream 5.0', desc: '极致梦幻艺术', features: ['ratio', 'style', 'negative', 'sampler'] }
];

const VIDEO_MODES = [
  { id: 't2v', label: '文生视频', icon: <FileText size={14}/> },
  { id: 'i2v', label: '首帧生视频', icon: <ImageIcon size={14}/> },
  { id: 'i2v-both', label: '首尾帧生视频', icon: <Layers size={14}/> },
  { id: 'v2v', label: '视频编辑/延长', icon: <Video size={14}/> },
];

const VIDEO_MODELS = [
  { id: 'doubao-seedance-2-0-fast-260128', name: 'Seedance 2.0 Fast', features: ['ratio', 'duration', 'resolution'], modes: ['t2v', 'i2v', 'i2v-both', 'v2v'], ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'], resolutions: ['480p', '720p'] },
  { id: 'doubao-seedance-2-0-260128', name: 'Seedance 2.0', features: ['ratio', 'duration', 'resolution'], modes: ['t2v', 'i2v', 'i2v-both', 'v2v'], ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'], resolutions: ['480p', '720p', '1080p'] },
  { id: 'kling-o3', name: 'Kling O3', features: ['ratio', 'duration', 'resolution'], modes: ['t2v', 'i2v', 'i2v-both'], ratios: ['16:9', '9:16', '1:1'], resolutions: ['720p', '1080p', '4k'] }
];

interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string | any[]; }
interface ChatSession { id: string; title: string; messages: ChatMessage[]; updatedAt: number; model: string; }
interface AttachedFile { name: string; type: string; size: number; data: string; isImage: boolean; }
interface MediaMaterial { id: string; type: 'image' | 'video' | 'audio'; url: string; name: string; tag: string; }
interface ImageRecord { id: string; url: string; prompt: string; model: string; ratio: string; timestamp: number; status?: 'processing' | 'succeeded' | 'failed'; }
interface VideoRecord { id: string; url: string; prompt: string; model: string; mode: string; ratio: string; duration?: number; resolution?: string; timestamp: number; status?: 'processing' | 'succeeded' | 'failed'; task_id?: string; pollModel?: string; }
interface WfSession { id: string; workflowId: string; title: string; messages: {role: 'user'|'assistant', content: string}[]; updatedAt: number; }

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export default function ChatPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>('user'); 
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [outOfBalanceMsg, setOutOfBalanceMsg] = useState<string | null>(null);

  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const [viewingUserChats, setViewingUserChats] = useState<any[] | null>(null);
  const [viewingSpecificChat, setViewingSpecificChat] = useState<any | null>(null);
  const [adminViewTab, setAdminViewTab] = useState<'chats' | 'images' | 'videos' | 'workflows'>('chats');
  const [viewingUsername, setViewingUsername] = useState<string>("");

  const [activeView, setActiveView] = useState<'chat' | 'image-gen' | 'video-gen' | 'workflow-gallery' | 'workflow-execution'>('chat'); 

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'instructions' | 'parameters' | 'data' | 'admin'>('general');
  const [settings, setSettings] = useState({
    nickname: '',
    avatar: '',
    globalSystemPrompt: '',
    modelSystemPrompts: {} as Record<string, string>,
    temperature: 0.7,
    topP: 1.0,
    maxTokens: '' as string | number
  });
  const [selectedPromptModel, setSelectedPromptModel] = useState('gpt-5.4');

  const [isWorkflowMenuOpen, setIsWorkflowMenuOpen] = useState(false);
  const [activeWfCategory, setActiveWfCategory] = useState<string>('all');
  const [activeWfId, setActiveWfId] = useState<string | null>(null);
  const [wfFormValues, setWfFormValues] = useState<Record<string, any>>({});
  const [isWfRunning, setIsWfRunning] = useState(false);
  const [wfInput, setWfInput] = useState("");
  
  const [wfSessions, setWfSessions] = useState<WfSession[]>([]);
  const [activeWfSessionId, setActiveWfSessionId] = useState<string | null>(null);
  const [isWfHistoryMenuOpen, setIsWfHistoryMenuOpen] = useState(false);

  const currentWfSession = useMemo(() => wfSessions.find(s => s.id === activeWfSessionId) || null, [wfSessions, activeWfSessionId]);
  const wfMessages = currentWfSession?.messages || [];

  const [input, setInput] = useState("");
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null); 
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [defaultModel, setDefaultModel] = useState('gpt-5.4');
  
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [imgModel, setImgModel] = useState('gpt-image-2');
  const [isImgModelMenuOpen, setIsImgModelMenuOpen] = useState(false); 
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgNegativePrompt, setImgNegativePrompt] = useState("");
  const [imgRatio, setImgRatio] = useState('1:1');
  const [imgStyle, setImgStyle] = useState('none'); 
  const [imgReferences, setImgReferences] = useState<string[]>([]);
  const [imageHistory, setImageHistory] = useState<ImageRecord[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);

  const [vidModel, setVidModel] = useState('doubao-seedance-2-0-260128');
  const [vidMode, setVidMode] = useState('t2v');
  const [vidPrompt, setVidPrompt] = useState("");
  const [vidRatio, setVidRatio] = useState('16:9');
  const [vidDuration, setVidDuration] = useState<number>(5);
  const [vidResolution, setVidResolution] = useState('720p');
  const [vidMaterials, setVidMaterials] = useState<MediaMaterial[]>([]); 
  const [videoHistory, setVideoHistory] = useState<VideoRecord[]>([]);
  
  const [isVidModelMenuOpen, setIsVidModelMenuOpen] = useState(false);
  const [isVidModeMenuOpen, setIsVidModeMenuOpen] = useState(false);
  const [isVidRatioMenuOpen, setIsVidRatioMenuOpen] = useState(false);
  const [isVidDurationMenuOpen, setIsVidDurationMenuOpen] = useState(false);
  const [isVidResMenuOpen, setIsVidResMenuOpen] = useState(false);
  const [showAtDropdown, setShowAtDropdown] = useState(false); 

  const [isVideoDeleteModalOpen, setIsVideoDeleteModalOpen] = useState(false);
  const [videoToDeleteId, setVideoToDeleteId] = useState<string | null>(null);

  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null); 
  const wfTextareaRef = useRef<HTMLTextAreaElement>(null);
  const imgFileInputRef = useRef<HTMLInputElement>(null); 
  const vidFileInputRef = useRef<HTMLInputElement>(null);
  const vidFeedScrollRef = useRef<HTMLDivElement>(null); 
  const wfResultScrollRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [hasLoadedFromServer, setHasLoadedFromServer] = useState(false); 
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(null);
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
  // 🎬 独立视频轮询引擎 (支持无限并发)
  // ==========================================
  const pollVideoTask = async (recordId: string, taskId: string, pollModel: string) => {
    let isPolling = true;
    let attempts = 0;
    while (isPolling && attempts < 100) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 3500)); 
      try {
        const pollRes = await fetch(`${API_BASE}/v1/videos/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}` },
          body: JSON.stringify({ task_id: taskId, model: pollModel })
        });
        const pollData = await pollRes.json();
        
        if (pollData.status === 'succeeded') {
          setVideoHistory(prev => prev.map(v => v.id === recordId ? { ...v, status: 'succeeded', url: pollData.url } : v));
          isPolling = false;
        } else if (pollData.status === 'failed') {
          setVideoHistory(prev => prev.map(v => v.id === recordId ? { ...v, status: 'failed' } : v));
          isPolling = false;
          setToastMsg("部分后台视频生成失败");
        }
      } catch (e) {}
    }
    if (isPolling) {
       setVideoHistory(prev => prev.map(v => v.id === recordId ? { ...v, status: 'failed' } : v));
    }
  };

  const handleLogin = async () => {
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setToastMsg("请输入账号和密码");
      return;
    }
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('yr-ai-token', data.access_token);
        localStorage.setItem('yr-ai-role', data.role);
        setIsAuthenticated(true);
        setUserRole(data.role);
        setToastMsg("登录成功，欢迎回来");
        
        // 🚨 核心防线：登录成功瞬间，立刻锁死同步功能，等数据拉取完再开
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

  // ✨ 核心重构：从后端 SQLite 数据库拉取所有数据 (大清洗加固版)
  const fetchUserData = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/v1/user/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sessions) {
          setSessions(data.sessions);
          if (data.sessions.length > 0) setCurrentSessionId(data.sessions[0].id);
        }

        // 🚨 大清洗：清理幽灵生图任务
        if (data.imageHistory) {
          const cleanedImages = data.imageHistory.map((img: ImageRecord) => {
            if (img.status === 'processing') {
              return { ...img, status: 'failed', prompt: img.prompt + " [因刷新页面中断]" };
            }
            return img;
          });
          setImageHistory(cleanedImages);
          
          if (cleanedImages.length > 0) {
             // 默认选中第一张成功的图片，避免刷新后满屏报错
             const firstSuccess = cleanedImages.find((img: ImageRecord) => img.status === 'succeeded' || !img.status);
             setActiveImageId(firstSuccess ? firstSuccess.id : cleanedImages[0].id);
          }
        }

        // 🚨 大清洗：清理幽灵视频任务
        if (data.videoHistory) {
          const cleanedVideos = data.videoHistory.map((v: VideoRecord) => {
             // 如果没拿到 task_id 就刷新了，神仙也救不回来，标为失败
             if (v.status === 'processing' && (!v.task_id || !v.pollModel)) {
                return { ...v, status: 'failed', prompt: v.prompt + " [因刷新页面中断]" };
             }
             return v;
          });
          setVideoHistory(cleanedVideos);

          // 自动恢复正常的后台渲染轮询
          cleanedVideos.forEach((v: VideoRecord) => {
            if (v.status === 'processing' && v.task_id && v.pollModel) {
              pollVideoTask(v.id, v.task_id, v.pollModel);
            }
          });
        }

        if (data.wfSessions) setWfSessions(data.wfSessions);
        
        let currentUsername = 'User';
        try { 
          currentUsername = JSON.parse(atob(token.split('.')[1])).sub; 
        } catch(e) {}
        
        const dbSettings = data.settings || {};
        if (dbSettings.nickname === '依然开发者') dbSettings.nickname = currentUsername;
        if (dbSettings.avatar === 'RY') dbSettings.avatar = currentUsername.charAt(0).toUpperCase();

        setSettings(prev => ({ 
          ...prev, 
          ...dbSettings,
          nickname: dbSettings.nickname || currentUsername,
          avatar: dbSettings.avatar || currentUsername.charAt(0).toUpperCase()
        }));

        setTimeout(() => {
          setHasLoadedFromServer(true);
        }, 500);

      } else {
        console.error("云端数据拉取失败，为保护数据，锁定同步功能");
      }
    } catch (e) {
      console.error("同步云端数据失败", e);
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
      // 🚨 初始化拉取时，必须先锁死同步
      setHasLoadedFromServer(false);
      fetchUserData(token); 
    } else {
      // 🚨 如果没登录，直接设为 false，绝对不让它触发同步！
      setHasLoadedFromServer(false);
    }
    setIsAuthChecking(false);
    setIsInitialized(true);

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setActiveMenuId(null);
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) setIsModelMenuOpen(false);
      if (imgModelMenuRef.current && !imgModelMenuRef.current.contains(e.target as Node)) setIsImgModelMenuOpen(false);
      if (!(e.target as Element).closest('.wf-history-dropdown')) setIsWfHistoryMenuOpen(false);
      if (!(e.target as Element).closest('.vid-toolbar-menu')) {
        setIsVidModelMenuOpen(false); setIsVidModeMenuOpen(false);
        setIsVidRatioMenuOpen(false); setIsVidDurationMenuOpen(false); setIsVidResMenuOpen(false);
      }
      if (!(e.target as Element).closest('.at-dropdown-container') && !(e.target as Element).closest('#vid-textarea')) {
        setShowAtDropdown(false);
      }
    };

    const handleScroll = () => {
      setActiveMenuId(null); setIsModelMenuOpen(false); setIsImgModelMenuOpen(false); 
      setIsVidModelMenuOpen(false); setIsVidModeMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    sidebarNavRef.current?.addEventListener('scroll', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      sidebarNavRef.current?.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // ✨ 核心防线 1：日常防抖静默同步
  useEffect(() => {
    if (isInitialized && isAuthenticated && hasLoadedFromServer) {
      const payload = JSON.stringify({ sessions, imageHistory, videoHistory, wfSessions, settings });
      const syncTimer = setTimeout(() => {
        fetch(`${API_BASE}/v1/user/sync_sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}`
          },
          body: payload
          // 🚨 修复：彻底删除 keepalive: true，解除 64KB 的封印！
        })
        .then(res => {
          if (res.status === 401) {
            localStorage.removeItem('yr-ai-token');
            localStorage.removeItem('yr-ai-role');
            window.location.reload();
          }
        })
        .catch(e => console.error("Sync failed", e));
      }, 2000); 
      
      return () => clearTimeout(syncTimer);
    }
  }, [sessions, imageHistory, videoHistory, wfSessions, settings, isInitialized, isAuthenticated, hasLoadedFromServer]);

  // 🚨 核心防线 2：用户关网页/刷新瞬间强制回传（绝不丢图！）
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isAuthenticated && hasLoadedFromServer) {
        const payload = JSON.stringify({ sessions, imageHistory, videoHistory, wfSessions, settings });
        fetch(`${API_BASE}/v1/user/sync_sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}` },
          body: payload,
          // 🚨 修复：超过 60KB 强制关闭 keepalive，避免被浏览器无情拦截
          keepalive: payload.length < 60000 
        }).catch(e => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessions, imageHistory, videoHistory, wfSessions, settings, isAuthenticated, hasLoadedFromServer]);

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
        const usersData = await res.json();
        setAdminUsers(usersData.data || []);
      } else if (!isPolling && (res.status === 401 || res.status === 403)) {
        setToastMsg("无权访问或登录过期");
      }
    } catch (e) {
      if (!isPolling) setToastMsg("获取用户数据失败");
    } finally {
      if (!isPolling) setIsAdminLoading(false);
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (activeSettingsTab === 'admin' && userRole === 'admin') {
      fetchAdminData(false); 
      intervalId = setInterval(() => { fetchAdminData(true); }, 3000);
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [activeSettingsTab, userRole]);

  const handleViewUserChats = async (username: string) => {
    try {
      const res = await fetch(`${API_BASE}/v1/admin/users/${username}/chats`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setViewingUserChats(data.data || { chats: [], images: [], videos: [], workflows: [] });
        setViewingUsername(username);
        setAdminViewTab('chats'); 
      }
    } catch (e) {
      setToastMsg("获取记录失败");
    }
  };

  const handleDownloadSpecificRecord = () => {
    if (!viewingSpecificChat) return;

    const { _type, title, messages, url, id, model, workflowId, updatedAt, timestamp } = viewingSpecificChat;

    if (_type === 'chat' || _type === 'workflow') {
      let mdContent = `# ${title || '智能对话记录'}\n\n`;
      mdContent += `> **记录类型**: ${_type === 'chat' ? '智能对话' : '工作流引擎'}\n`;
      mdContent += `> **底层引擎**: ${model || workflowId || '未知'}\n`;
      mdContent += `> **生成时间**: ${new Date(updatedAt || timestamp).toLocaleString()}\n\n---\n\n`;

      if (messages && Array.isArray(messages)) {
        messages.forEach((msg: any) => {
          const roleName = msg.role === 'user' ? '🧑 **User (用户)**' : '🤖 **AI (助手)**';
          const content = typeof msg.content === 'string' ? msg.content : '[多模态内容/文件]';
          mdContent += `### ${roleName}:\n\n${content}\n\n---\n\n`;
        });
      }

      const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `YR_${_type === 'chat' ? 'Chat' : 'Workflow'}_${id}.md`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } 
    else if (_type === 'image' || _type === 'video') {
      const link = document.createElement('a');
      link.href = url;
      link.download = `YR_AI_${_type === 'image' ? 'Image' : 'Video'}_${id}.${_type === 'image' ? 'png' : 'mp4'}`;
      link.click();
    }
  };

  const handleAdminUserAction = async (username: string, action: string, extraData: any = {}) => {
    try {
      await fetch(`${API_BASE}/v1/admin/users/${username}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}`
        },
        body: JSON.stringify({ action, ...extraData })
      });
      setToastMsg("操作成功");
      fetchAdminData(true); 
      if (action === 'kick') setSelectedUser(null);
      if (action === 'reset_tokens') setSelectedUser((prev: any) => ({...prev, tokens_used: 0}));
      // ✨ 权限切换成功后，实时热更新 UI 状态
      if (action === 'update_permission') {
         setSelectedUser((prev: any) => ({...prev, [extraData.perm_type]: extraData.perm_value}));
      }
    } catch (e) {
      setToastMsg("操作失败");
    }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return sessions.map(session => {
      const titleMatch = session.title.toLowerCase().includes(query);
      const matchingMessages = session.messages.filter(msg => {
        if (typeof msg.content === 'string') return msg.content.toLowerCase().includes(query);
        if (Array.isArray(msg.content)) return msg.content.some(part => part.type === 'text' && part.text && part.text.toLowerCase().includes(query));
        return false;
      });

      if (titleMatch || matchingMessages.length > 0) {
        let snippet = "";
        if (matchingMessages.length > 0) {
           const firstMsg = matchingMessages[0];
           const text = typeof firstMsg.content === 'string' ? firstMsg.content : firstMsg.content.find((p:any) => p.type === 'text')?.text || "";
           const idx = text.toLowerCase().indexOf(query);
           if (idx !== -1) {
             const start = Math.max(0, idx - 15);
             const end = Math.min(text.length, idx + query.length + 15);
             snippet = (start > 0 ? "..." : "") + text.substring(start, end).replace(/\n/g, ' ') + (end < text.length ? "..." : "");
           } else { snippet = text.substring(0, 40).replace(/\n/g, ' ') + "..."; }
        }
        return { ...session, matchCount: matchingMessages.length, snippet };
      }
      return null;
    }).filter(Boolean);
  }, [searchQuery, sessions]);

  const currentSession = useMemo(() => sessions.find(s => s.id === currentSessionId) || null, [sessions, currentSessionId]);
  const currentModelId = currentSession?.model || defaultModel;
  const messages = currentSession?.messages || [];
  const isChatStarted = messages.length > 0;

  useEffect(() => {
    if (scrollRef.current && autoScrollRef.current && activeView === 'chat') {
      const { scrollHeight, clientHeight } = scrollRef.current;
      scrollRef.current.scrollTo({ top: scrollHeight - clientHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping, activeView]);

  useEffect(() => {
    if (vidFeedScrollRef.current && activeView === 'video-gen') {
      vidFeedScrollRef.current.scrollTo({ top: vidFeedScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [videoHistory, activeView]);

  const handleContainerScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 100;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setAttachedFile({ name: file.name, type: file.type, size: file.size, data: event.target?.result as string, isImage: file.type.startsWith('image/') });
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSettings(prev => ({ ...prev, avatar: event.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImgReferenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImgReferences(prev => {
          if (prev.length >= 4) return prev;
          return [...prev, event.target?.result as string];
        });
      };
      reader.readAsDataURL(file);
    });
    if (imgFileInputRef.current) imgFileInputRef.current.value = '';
  };

  const handleVidMaterialUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    let imgCount = vidMaterials.filter(m => m.type === 'image').length;
    let vidCount = vidMaterials.filter(m => m.type === 'video').length;
    let audCount = vidMaterials.filter(m => m.type === 'audio').length;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        let type: 'image' | 'video' | 'audio' = 'image';
        let tag = '';
        
        if (file.type.startsWith('video/')) { type = 'video'; vidCount++; tag = `@视频${vidCount}`; }
        else if (file.type.startsWith('audio/')) { type = 'audio'; audCount++; tag = `@音频${audCount}`; }
        else { type = 'image'; imgCount++; tag = `@图片${imgCount}`; }

        const newMaterial: MediaMaterial = { id: Date.now().toString() + Math.random(), type, url, name: file.name, tag };
        
        setVidMaterials(prev => {
          if (prev.length >= 12) return prev; 
          return [...prev, newMaterial];
        });
      };
      reader.readAsDataURL(file);
    });
    if (vidFileInputRef.current) vidFileInputRef.current.value = '';
  };

  const handleVidPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setVidPrompt(val);
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex !== -1 && !textBeforeCursor.substring(lastAtIndex).includes(' ')) {
      setShowAtDropdown(true);
    } else {
      setShowAtDropdown(false);
    }
  };

  const insertMaterialTag = (tag: string) => {
    const ta = document.getElementById('vid-textarea') as HTMLTextAreaElement;
    const cursor = ta?.selectionStart || vidPrompt.length;
    const textBeforeCursor = vidPrompt.substring(0, cursor);
    const textAfterCursor = vidPrompt.substring(cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const newText = textBeforeCursor.substring(0, lastAtIndex) + tag + ' ' + textAfterCursor;
      setVidPrompt(newText);
    } else {
      setVidPrompt(vidPrompt + tag + ' ');
    }
    setShowAtDropdown(false);
    ta?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (activeView !== 'chat') return;
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setAttachedFile({ name: file.name, type: file.type, size: file.size, data: event.target?.result as string, isImage: file.type.startsWith('image/') });
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handleExportData = () => {
    const data = { sessions, imageHistory, videoHistory, settings, wfSessions };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yr_ai_export_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = async () => {
    if (window.confirm("确定要退出登录吗？")) {
      try {
        await fetch(`${API_BASE}/v1/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}` }
        });
      } catch(e) {}
      localStorage.removeItem('yr-ai-token');
      localStorage.removeItem('yr-ai-role');
      setIsAuthenticated(false);
      setUserRole('user');
      window.location.reload();
    }
  };

  const handleOpenMenu = (e: React.MouseEvent, sessionId: string) => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setMenuPosition({ top: rect.top, left: rect.left + 30 }); setActiveMenuId(sessionId); };
  const handleModelChange = (e: React.MouseEvent, modelId: string) => { e.stopPropagation(); if (isChatStarted) return; setDefaultModel(modelId); if (currentSessionId) setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, model: modelId } : s)); setIsModelMenuOpen(false); };
  const handleNewChat = () => { setActiveView('chat'); if (sessions.length > 0 && sessions[0].messages.length === 0) { setCurrentSessionId(sessions[0].id); return; } const newId = Date.now().toString(); const newSession: ChatSession = { id: newId, title: "新对话", messages: [], updatedAt: Date.now(), model: defaultModel }; setSessions(prev => [newSession, ...prev]); setCurrentSessionId(newId); };
  const triggerDelete = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setSessionToDeleteId(id); setIsDeleteModalOpen(true); setActiveMenuId(null); };
  const confirmDelete = () => { if (sessionToDeleteId) { setSessions(prev => prev.filter(s => s.id !== sessionToDeleteId)); if (currentSessionId === sessionToDeleteId) setCurrentSessionId(null); setIsDeleteModalOpen(false); setSessionToDeleteId(null); } };
  const triggerVideoDelete = (id: string) => { setVideoToDeleteId(id); setIsVideoDeleteModalOpen(true); };
  const confirmVideoDelete = () => { if (videoToDeleteId) { setVideoHistory(prev => prev.filter(v => v.id !== videoToDeleteId)); setIsVideoDeleteModalOpen(false); setVideoToDeleteId(null); } };
  const renameSession = (id: string, e: React.MouseEvent) => { e.stopPropagation(); const newTitle = window.prompt("输入新的标题："); if (newTitle) setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s)); setActiveMenuId(null); };

  const generateAutoTitle = async (sessionId: string, userMsg: string, aiMsg: string, model: string) => {
    try {
      const response = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: "你是一个标题生成助手。请根据用户的提问和你的回答，生成一个 15-20 字左右的专业标题。要求：涵盖核心意图，不要过于缩减，不要包含标点符号，直接输出标题。" },
            { role: "user", content: `用户问：${userMsg}\nAI答：${aiMsg}` }
          ],
          stream: false,
        }),
      });
      const data = await response.json();
      const newTitle = data.choices[0]?.message?.content?.replace(/[#*\"'思维导图“”]/g, '').trim();
      if (newTitle) {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s));
      }
    } catch (e) { console.error("生成标题失败", e); }
  };

  const handleSend = async (overrideInput?: string) => {
     const textToSend = overrideInput || input;
     if ((!textToSend.trim() && !attachedFile) || isTyping) return;
     autoScrollRef.current = true;
     let activeId = currentSessionId;
     let targetModel = currentModelId;
     if (!activeId) {
       const newId = Date.now().toString();
       const newSession: ChatSession = { id: newId, title: "正在生成标题...", messages: [], updatedAt: Date.now(), model: defaultModel };
       setSessions(prev => [newSession, ...prev]);
       setCurrentSessionId(newId); activeId = newId; targetModel = defaultModel;
     }
     let userContent: any = textToSend;
     if (attachedFile) userContent = [ { type: "text", text: textToSend || `分析文件: ${attachedFile.name}` }, { type: "image_url", image_url: { url: attachedFile.data } } ];
     const userMessage: ChatMessage = { role: 'user', content: userContent };
     const currentFullHistory = [...messages, userMessage];
     
     setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages, userMessage, { role: 'assistant', content: "" }], updatedAt: Date.now() } : s));
     setInput(""); setAttachedFile(null); setIsTyping(true);
 
     const sysPrompt = settings.modelSystemPrompts[targetModel] || settings.globalSystemPrompt;
     const payload: any = { 
       model: targetModel, 
       messages: currentFullHistory,
       user_system_prompt: sysPrompt, 
       stream: true,
       temperature: settings.temperature,
       top_p: settings.topP
     };

     // ✨ 核心：开启联网搜索参数（终极暴力兼容版）
     if (isWebSearchEnabled) {
       // 1. 兼容绝大多数第三方中转的通用开关
       payload.search = true;
       payload.enable_search = true;
       payload.network = true; 
       
       // 2. 专门兼容 New-API 映射到 Gemini 的原生搜索协议 (下划线/驼峰双管齐下)
       if (targetModel.toLowerCase().includes('gemini')) {
         payload.tools = [
           { type: "google_search" },
           { type: "googleSearch" }
         ];
       }
     }

     if (settings.maxTokens) payload.max_tokens = parseInt(settings.maxTokens as string);
     try {
      const response = await fetch(`${API_BASE}/v1/chat/completions`, {
         method: 'POST', 
         headers: { 
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}`
         },
         body: JSON.stringify(payload),
       });
       
       if (response.status === 401) {
        localStorage.removeItem('yr-ai-token');
        localStorage.removeItem('yr-ai-role');
        window.location.reload();
        return;
      }
      if (response.status === 402) {
        const err = await response.json();
        setOutOfBalanceMsg(err.detail || "余额不足");
        setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: s.messages.slice(0, -1) } : s));
        setIsTyping(false);
        return;
      }
            // ✨ 新增：处理聊天区的 403 权限拦截
      if (response.status === 403) {
        const err = await response.json();
        setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages, { role: 'assistant', content: `🚨 **拦截提醒**：${err.detail}` }] } : s));
        setIsTyping(false);
        return;
      }
       if (!response.ok) throw new Error("API Connection Failed");
       
       const reader = response.body?.getReader();
       const decoder = new TextDecoder();
       let assistantContent = ""; let buffer = ""; 
       if (!reader) return;
       while (true) {
         const { done, value } = await reader.read();
         if (done) break;
         buffer += decoder.decode(value, { stream: true });
         let parts = buffer.split('\n\n'); buffer = parts.pop() || "";
         for (const part of parts) {
           const line = part.trim();
           if (line.startsWith('data: ') && line !== 'data: [DONE]') {
             try {
               const delta = JSON.parse(line.substring(6)).choices[0]?.delta?.content || "";
               assistantContent += delta;
               setSessions(prev => prev.map(s => {
                 if (s.id === activeId) {
                   const updatedMsgs = [...s.messages];
                   if (updatedMsgs.length > 0) updatedMsgs[updatedMsgs.length - 1].content = assistantContent;
                   return { ...s, messages: updatedMsgs };
                 } return s;
               }));
             } catch (e) {}
           }
         }
       }
       if (messages.length === 0) {
         generateAutoTitle(activeId!, textToSend, assistantContent, targetModel);
       }
     } catch (error) { 
       setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages, { role: 'assistant', content: "消息发送失败，请检查网络或后端配置。" }] } : s));
     } finally { setIsTyping(false); }
  };

  const handleGenerateImage = async () => {
    if (!imgPrompt.trim()) return;

    const taskId = Date.now().toString();
    const newRecord: ImageRecord = { 
      id: taskId, url: '', prompt: imgPrompt, model: imgModel, 
      ratio: imgRatio, timestamp: Date.now(), status: 'processing' 
    };

    setImageHistory(prev => [newRecord, ...prev].slice(0, 30));
    setActiveImageId(taskId);
    setImgPrompt(""); 
    const currentRefs = [...imgReferences];
    setImgReferences([]);

    try {
      let targetSize = '1024x1024';
      if (newRecord.model === 'seedream5.0') {
        const seedreamRatioToSize: Record<string, string> = { '1:1': '1920x1920', '16:9': '2560x1440', '9:16': '1440x2560', '4:3': '2048x1536' };
        targetSize = seedreamRatioToSize[newRecord.ratio] || '1920x1920';
      } else if (newRecord.model === 'banana-pro' || newRecord.model === 'banana2') {
        const bananaRatioToSize: Record<string, string> = { '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792', '4:3': '1024x768' };
        targetSize = bananaRatioToSize[newRecord.ratio] || '1024x1024';
      } else {
        const ratioToSize: Record<string, string> = { '1:1': '1024x1024', '16:9': '1024x576', '9:16': '576x1024', '4:3': '1024x768' };
        targetSize = ratioToSize[newRecord.ratio] || '1024x1024';
      }
      
      const payload: any = { model: newRecord.model, prompt: newRecord.prompt, n: 1, size: targetSize, ratio: newRecord.ratio };
      if (currentRefs.length > 0) {
        payload.image = currentRefs[0]; 
        payload.images = currentRefs;   
      }
      const currentFeatures = IMAGE_MODELS.find(m => m.id === newRecord.model)?.features || [];
      if (currentFeatures.includes('negative') && imgNegativePrompt.trim()) payload.negative_prompt = imgNegativePrompt;
      if ((currentFeatures.includes('style') || currentFeatures.includes('stylize')) && imgStyle !== 'none') payload.prompt = `${newRecord.prompt}, style: ${imgStyle}`;

      const response = await fetch(`${API_BASE}/v1/images/generations`, {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}`
        }, 
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        localStorage.removeItem('yr-ai-token');
        localStorage.removeItem('yr-ai-role');
        window.location.reload();
        return;
      }
      if (response.status === 402) {
        const err = await response.json();
        setOutOfBalanceMsg(err.detail || "余额不足");
        setImageHistory(prev => prev.filter(img => img.id !== taskId));
        return;
      }
            // ✨ 新增：处理生图区的 403 权限拦截
      if (response.status === 403) {
        const err = await response.json();
        setToastMsg(err.detail || "无权限");
        setImageHistory(prev => prev.filter(img => img.id !== taskId));
        return;
      }
      if (!response.ok) throw new Error(`API Connection Failed: ${response.status}`);
      const data = await response.json();
      let finalImageUrl = null;
      if (data.data && data.data.length > 0 && data.data[0].url) finalImageUrl = data.data[0].url;
      else if (data.url) finalImageUrl = data.url;
      else if (data.images && data.images.length > 0) finalImageUrl = data.images[0].url || data.images[0];
      else if (data.choices && data.choices.length > 0 && data.choices[0].message?.content) {
        const match = data.choices[0].message.content.match(/!\[.*?\]\((.*?)\)/); 
        if (match && match[1]) finalImageUrl = match[1];
      }

      if (finalImageUrl) {
        setImageHistory(prev => prev.map(img => img.id === taskId ? { ...img, url: finalImageUrl, status: 'succeeded' } : img));
      } else throw new Error("解析图片 URL 失败");
    } catch (error) {
      console.error("生成图片失败:", error);
      setToastMsg("生图失败，请检查网络或后端的 API 配置。");
      setImageHistory(prev => prev.map(img => img.id === taskId ? { ...img, status: 'failed' } : img));
    }
  };

  const handleVidModelChange = (modelId: string) => {
    setVidModel(modelId);
    setIsVidModelMenuOpen(false);
    const selectedModel = VIDEO_MODELS.find(m => m.id === modelId);
    if (selectedModel) {
      if (!selectedModel.ratios.includes(vidRatio)) setVidRatio(selectedModel.ratios[0]);
      if (!selectedModel.resolutions.includes(vidResolution)) setVidResolution(selectedModel.resolutions[selectedModel.resolutions.length - 1]); 
      if (!selectedModel.modes.includes(vidMode)) setVidMode(selectedModel.modes[0]);
    }
  };

  const getVidPlaceholder = () => {
    if(vidMode === 'i2v-both') return "请按顺序上传图片（先传首帧，再传尾帧），并输入过渡描述...";
    if(vidMode === 'v2v') return "请上传参考视频，并输入编辑、重绘或延长描述...";
    if(vidMode === 'i2v') return "请上传首帧图片，并输入动作描述...";
    return "输入分镜描述或上传参考素材，自由组合图、文、音多元素。例如：@图片1 模仿 @视频1 的动作...";
  };

  const handleGenerateVideo = async () => {
    if (!vidPrompt.trim() && vidMaterials.length === 0) return;

    const tempId = Date.now().toString();
    const newRecord: VideoRecord = { 
      id: tempId, url: '', prompt: vidPrompt, model: vidModel, mode: vidMode, 
      ratio: vidRatio, duration: vidDuration, resolution: vidResolution, 
      timestamp: Date.now(), status: 'processing' 
    };

    setVideoHistory(prev => [newRecord, ...prev].slice(0, 20));
    const currentMaterials = [...vidMaterials];
    const currentPrompt = vidPrompt;
    setVidPrompt(""); 
    setVidMaterials([]);

    try {
      const imageRefs = currentMaterials.filter(m => m.type === 'image').map(m => m.url);
      const videoRefs = currentMaterials.filter(m => m.type === 'video').map(m => m.url);
      const payload: any = { 
        model: newRecord.model, mode: newRecord.mode, prompt: currentPrompt, 
        ratio: newRecord.ratio, duration: newRecord.duration, resolution: newRecord.resolution
      };
      if (imageRefs.length > 0) { payload.image = imageRefs[0]; payload.images = imageRefs; }
      if (videoRefs.length > 0) { payload.video_url = videoRefs[0]; }
      
      const response = await fetch(`${API_BASE}/v1/videos/generations`, {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}`
        }, 
        body: JSON.stringify(payload)
      });
      if (response.status === 401) {
        localStorage.removeItem('yr-ai-token');
        localStorage.removeItem('yr-ai-role');
        window.location.reload();
        return;
      }
      // ...
      if (response.status === 402) {
        const err = await response.json();
        setOutOfBalanceMsg(err.detail || "余额不足");
        setVideoHistory(prev => prev.filter(v => v.id !== tempId));
        return;
      }
      
      // ✨ 新增这段 403 权限拦截的 UI 提示
      if (response.status === 403) {
        const err = await response.json();
        setToastMsg(err.detail || "无权限");
        // 把占位的视频任务从列表中移除
        setVideoHistory(prev => prev.filter(v => v.id !== tempId));
        return;
      }

      if (!response.ok) throw new Error(`API Connection Failed: ${response.status}`);
      // ...
      
      const submitData = await response.json();
      const taskId = submitData.task_id;
      const pollModel = submitData.model;
      if (!taskId) throw new Error("未能解析出任务 ID");

      setVideoHistory(prev => prev.map(v => v.id === tempId ? { ...v, task_id: taskId, pollModel: pollModel } : v));
      
      // 开始轮询
      pollVideoTask(tempId, taskId, pollModel);

    } catch (error) {
      console.error("生成视频失败:", error);
      setToastMsg("视频生成失败，请检查网络或后端的 API 配置。");
      setVideoHistory(prev => prev.map(v => v.id === tempId ? { ...v, status: 'failed' } : v));
    }
  };

  const loadVideoToEdit = (record: VideoRecord) => {
    setVidPrompt(record.prompt); setVidModel(record.model);
    setVidMode(record.mode || 't2v'); setVidRatio(record.ratio);
    if(record.duration) setVidDuration(record.duration);
    if(record.resolution) setVidResolution(record.resolution);
    document.getElementById('vid-textarea')?.focus();
  };

  const currentImgFeatures = IMAGE_MODELS.find(m => m.id === imgModel)?.features || [];
  const currentVidModelData = VIDEO_MODELS.find(m => m.id === vidModel);
  const currentVidFeatures = currentVidModelData?.features || [];
  const currentVidModes = currentVidModelData?.modes || ['t2v'];
  const imageMaterials = vidMaterials.filter(m => m.type === 'image');

  const activeWorkflowData = WORKFLOW_REGISTRY.find(w => w.id === activeWfId);

  const handleRunWorkflow = async (isChat: boolean = false, chatText: string = "") => {
    if (!activeWorkflowData) return;
    if (isChat && !chatText.trim()) return;

    setIsWfRunning(true);
    
    let userMsgContent = "";
    if (isChat) {
      userMsgContent = chatText;
      setWfInput(""); 
    } else {
      const inputSummary = Object.entries(wfFormValues)
        .filter(([_, v]) => v)
        .map(([k, v]) => `${activeWorkflowData.inputs.find(i=>i.key===k)?.label || k}: ${v}`)
        .join('\n');
      userMsgContent = inputSummary ? `[应用配置]\n${inputSummary}` : `启动了 ${activeWorkflowData.name}`;
    }

    let currentSessionId = activeWfSessionId;
    if (!currentSessionId) {
      currentSessionId = Date.now().toString();
      const newSession: WfSession = {
        id: currentSessionId,
        workflowId: activeWorkflowData.id,
        title: userMsgContent.substring(0, 15) + "...", 
        messages: [],
        updatedAt: Date.now()
      };
      setWfSessions(prev => [newSession, ...prev]);
      setActiveWfSessionId(currentSessionId);
    }

    setWfSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, messages: [...s.messages, { role: 'user', content: userMsgContent }, { role: 'assistant', content: "" }], updatedAt: Date.now() };
      }
      return s;
    }));

    const existingHistory = wfSessions.find(s => s.id === currentSessionId)?.messages || [];
    const messagesToSend = [...existingHistory, { role: 'user', content: userMsgContent }];

    try {
      const response = await fetch(`${API_BASE}/v1/workflows/run`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}`
        },
        body: JSON.stringify({
          workflow_id: activeWorkflowData.id,
          engine: activeWorkflowData.engine,
          inputs: wfFormValues,
          query: chatText,     
          history: messagesToSend
        }),
      });

      if (response.status === 401) {
        localStorage.removeItem('yr-ai-token');
        localStorage.removeItem('yr-ai-role');
        window.location.reload();
        return;
      }
      if (response.status === 402) {
        const err = await response.json();
        setOutOfBalanceMsg(err.detail || "余额不足");
        setWfSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: s.messages.slice(0, -1) } : s));
        setIsWfRunning(false);
        return;
      }
      if (!response.ok) throw new Error("Workflow Execution Failed");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      if (!reader) return;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let parts = buffer.split('\n\n');
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.trim();
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const delta = JSON.parse(line.substring(6)).choices[0]?.delta?.content || "";
              assistantContent += delta;
              
              setWfSessions(prev => prev.map(s => {
                if (s.id === currentSessionId) {
                  const newMsgs = [...s.messages];
                  newMsgs[newMsgs.length - 1].content = assistantContent;
                  return { ...s, messages: newMsgs, updatedAt: Date.now() };
                }
                return s;
              }));
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      console.error(error);
      setWfSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const newMsgs = [...s.messages];
          newMsgs[newMsgs.length - 1].content = "工作流执行失败，请检查后端引擎配置。";
          return { ...s, messages: newMsgs };
        }
        return s;
      }));
    } finally {
      setIsWfRunning(false);
    }
  };

  if (isAuthChecking) {
    return <div className="h-screen bg-[#0d0d0d] flex items-center justify-center text-zinc-500 font-mono text-sm">Initializing YR AI Engine...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen bg-[#0d0d0d] items-center justify-center relative overflow-hidden font-sans">
         <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
         <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none"></div>
         
         <div className="relative z-10 w-full max-w-[420px] bg-[#1a1a1a]/80 backdrop-blur-3xl border border-white/10 rounded-[32px] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col items-center mb-10">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-xl mb-5 transition-transform hover:rotate-[10deg] duration-500">
                 <span className="text-black text-2xl font-black tracking-tighter">YR</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">依然AI (YR AI)</h1>
              <p className="text-[13px] text-zinc-500 mt-2 font-medium tracking-wide">工业级多模态 AI 生产力平台</p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest pl-1">账号 (Username)</label>
                <div className="relative group">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                  <input 
                    type="text" 
                    value={loginUsername} 
                    onChange={e => setLoginUsername(e.target.value)} 
                    className="w-full bg-black/40 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-zinc-200 placeholder-zinc-700 focus:border-indigo-500/50 focus:bg-black/60 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all shadow-inner" 
                    placeholder="输入管理员分配的账号" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest pl-1">凭证 (Password)</label>
                <div className="relative group">
                  <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                  <input 
                    type="password" 
                    value={loginPassword} 
                    onChange={e => setLoginPassword(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleLogin()} 
                    className="w-full bg-black/40 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-zinc-200 placeholder-zinc-700 focus:border-indigo-500/50 focus:bg-black/60 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all shadow-inner" 
                    placeholder="输入访问凭证" 
                  />
                </div>
              </div>

              <div className="pt-2">
                <button 
                  onClick={handleLogin} 
                  disabled={loginLoading} 
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                >
                  {loginLoading ? <Loader2 size={18} className="animate-spin" /> : '进入系统'}
                </button>

                <button 
                  onClick={() => setToastMsg("暂不开放公众注册，请联系管理员获取邀请码")} 
                  className="w-full bg-transparent border border-white/5 hover:bg-white/[0.03] text-zinc-500 hover:text-zinc-300 font-medium py-3.5 rounded-2xl transition-all text-sm mt-3"
                >
                  申请加入内测
                </button>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-[10px] text-zinc-600 font-mono flex items-center justify-center gap-1.5"><Lock size={10} /> Private Access Only</p>
            </div>
         </div>

         {toastMsg && (
           <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-[#2a2a2a] border border-white/10 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 fade-in z-50">
             <AlertTriangle size={16} className="text-yellow-500" />
             <span className="text-sm font-medium text-zinc-200">{toastMsg}</span>
           </div>
         )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0d0d0d] text-zinc-200 antialiased font-sans overflow-hidden relative">
      <style jsx global>{`
        .typing-cursor::after { content: '●'; display: inline-block; margin-left: 4px; color: #6366f1; animation: blink 0.8s infinite; font-size: 12px; vertical-align: middle; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .message-appear { animation: fadeIn 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); filter: blur(2px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
        @keyframes flowEffect { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .hover-flow:hover { background: linear-gradient(90deg, #202020, #2a2a2a, #202020); background-size: 200% 200%; animation: flowEffect 3s ease infinite; }
        .nav-item-active { background-color: #2a2a2a !important; color: white !important; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
      `}</style>
      
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-[#2a2a2a]/90 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 fade-in z-[99999]">
          <AlertTriangle size={16} className="text-yellow-500" />
          <span className="text-sm font-medium text-zinc-200">{toastMsg}</span>
        </div>
      )}

      {outOfBalanceMsg && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setOutOfBalanceMsg(null)} />
          <div className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 fade-in duration-200 text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <Database size={36} className="text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">额度已耗尽</h2>
            <p className="text-sm text-zinc-400 leading-relaxed mb-8">{outOfBalanceMsg}</p>
            <div className="flex gap-4">
              <button onClick={() => setOutOfBalanceMsg(null)} className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-all">知道了</button>
              <button onClick={() => { setOutOfBalanceMsg(null); setToastMsg("请联系系统管理员充值额度"); }} className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20">联系充值</button>
            </div>
          </div>
        </div>
      )}

      <aside className="hidden md:flex w-72 flex-col bg-[#0d0d0d] border-r border-zinc-800/30 flex-shrink-0 z-30 relative">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 font-semibold px-1 text-zinc-100 group cursor-pointer" onClick={() => { setActiveView('chat'); setCurrentSessionId(null); }}>
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-lg transition-transform duration-500 group-hover:rotate-[10deg]">
               <span className="text-black text-[13px] font-black tracking-tighter">YR</span>
            </div>
            <span className="tracking-tight text-lg font-bold">依然AI</span>
          </div>
          <button className="p-2 hover:bg-zinc-800/60 rounded-lg transition-all text-zinc-500 hover:text-zinc-200">
             <LayoutGrid size={18} />
          </button>
        </div>

        <nav ref={sidebarNavRef} className="flex-1 overflow-y-auto px-3 space-y-1 mt-2 custom-scrollbar">
          <button onClick={handleNewChat} className={`flex items-center gap-3 w-full p-2.5 rounded-xl text-sm transition-all group ${activeView === 'chat' && !currentSessionId ? 'bg-indigo-500/10 text-indigo-400 font-semibold' : 'text-zinc-400 hover-flow'}`}>
            <Plus size={18} className="group-hover:text-indigo-400" /> <span className="font-medium">新对话</span>
          </button>
          
          <button onClick={() => setIsSearchModalOpen(true)} className="flex items-center gap-3 w-full p-2.5 rounded-xl text-sm transition-all group text-zinc-400 hover-flow">
            <Search size={18} className="group-hover:text-white" /> <span className="font-medium">搜索</span>
          </button>

          <div className="pt-2">
            <button 
              onClick={() => setIsWorkflowMenuOpen(!isWorkflowMenuOpen)}
              className={`flex items-center justify-between w-full p-2.5 rounded-xl text-sm transition-all group ${activeView.includes('workflow') ? 'bg-indigo-500/5 text-indigo-300 font-semibold' : 'text-zinc-400 hover-flow'}`}
            >
              <div className="flex items-center gap-3">
                <Puzzle size={18} className={activeView.includes('workflow') ? 'text-indigo-400' : 'group-hover:text-white'} /> 
                <span className="font-medium">工作流中心</span>
              </div>
              <ChevronDown size={14} className={`transition-transform duration-300 ${isWorkflowMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            
            <div className={`overflow-hidden transition-all duration-300 ${isWorkflowMenuOpen ? 'max-h-64 mt-1 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="pl-9 pr-2 space-y-0.5 border-l border-white/5 ml-5">
                {[
                  { id: 'all', label: '热门应用', icon: <Box size={14}/> },
                  { id: 'content', label: '内容创作', icon: <PenTool size={14}/> },
                  { id: 'image', label: '视觉图像', icon: <ImageIcon size={14}/> },
                  { id: 'data', label: '数据分析', icon: <BarChart size={14}/> },
                  { id: 'agent', label: '自动化 Agent', icon: <Bot size={14}/> },
                ].map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => { setActiveView('workflow-gallery'); setActiveWfCategory(cat.id); }}
                    className={`flex items-center gap-2.5 w-full p-2 rounded-lg text-[13px] transition-all ${activeView === 'workflow-gallery' && activeWfCategory === cat.id ? 'text-indigo-400 bg-white/5' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'}`}
                  >
                    {cat.icon} <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="my-2 border-t border-white/[0.05]"></div>

          <button onClick={() => setActiveView('image-gen')} className={`flex items-center gap-3 w-full p-2.5 rounded-xl text-sm transition-all group ${activeView === 'image-gen' ? 'bg-indigo-500/10 text-indigo-400 font-semibold' : 'text-zinc-400 hover-flow'}`}>
            <ImageIcon size={18} className={activeView === 'image-gen' ? 'text-indigo-400' : 'group-hover:text-indigo-400'} /> <span className="font-medium">图像生成</span>
          </button>
          
          <button onClick={() => setActiveView('video-gen')} className={`flex items-center gap-3 w-full p-2.5 rounded-xl text-sm transition-all group ${activeView === 'video-gen' ? 'bg-indigo-500/10 text-indigo-400 font-semibold' : 'text-zinc-400 hover-flow'}`}>
            <Film size={18} className={activeView === 'video-gen' ? 'text-indigo-400' : 'group-hover:text-indigo-400'} /> <span className="font-medium">视频生成</span>
          </button>

          <div className="pt-6 pb-2 px-2 text-[11px] font-bold text-zinc-600 uppercase tracking-widest text-white/50">历史记录</div>
          
          <div className="space-y-1">
            {sessions.map((s) => (
              <div key={s.id} onClick={() => { setCurrentSessionId(s.id); setActiveView('chat'); }} className={`group relative flex items-center w-full pl-2.5 py-2.5 pr-10 rounded-xl text-sm cursor-pointer transition-all hover-flow ${currentSessionId === s.id && activeView === 'chat' ? 'nav-item-active' : 'text-zinc-500 hover:text-zinc-300'}`}>
                <span className="truncate flex-1 min-w-0 pl-1 font-medium">{s.title}</span>
                <button onClick={(e) => handleOpenMenu(e, s.id)} className={`absolute right-2.5 p-1 rounded-md hover:bg-zinc-700/50 transition-opacity opacity-0 group-hover:opacity-100 ${activeMenuId === s.id ? 'opacity-100' : ''}`}>
                  <MoreVertical size={14} className="text-zinc-500" />
                </button>

                {activeMenuId === s.id && (
                  <div ref={menuRef} style={{ position: 'fixed', top: `${menuPosition.top}px`, left: `${menuPosition.left}px`, zIndex: 9999 }} className="w-36 bg-[#1a1a1a] backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] py-2 px-1 animate-in fade-in zoom-in-95 duration-200">
                    {[
                      { icon: <Pencil size={14}/>, label: "重命名", onClick: (e: any) => renameSession(s.id, e) },
                      { icon: <Share2 size={14}/>, label: "分享", onClick: (e: any) => e.stopPropagation() },
                      { icon: <ArchiveIcon size={14}/>, label: "归档", onClick: (e: any) => e.stopPropagation() },
                      { icon: <Trash2 size={14}/>, label: "删除", onClick: (e: any) => triggerDelete(s.id, e), danger: true },
                    ].map((m, i) => (
                      <button key={i} onClick={m.onClick} className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left rounded-lg hover:bg-white/5 transition-colors ${m.danger ? 'text-red-400 hover:text-red-300' : 'text-zinc-300'}`}>
                        {m.icon} {m.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-zinc-800/50 flex items-center gap-3 mt-auto cursor-pointer hover:bg-white/5 transition-colors rounded-t-xl" onClick={() => setIsSettingsModalOpen(true)}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-indigo-500/20 overflow-hidden">
            {settings.avatar?.startsWith('data:image') ? <img src={settings.avatar} className="w-full h-full object-cover" /> : (settings.avatar || 'RY')}
          </div>
          <span className="text-sm font-medium text-zinc-400 flex-1 truncate">{settings.nickname || '依然开发者'}</span>
          <Settings size={14} className="text-zinc-500" />
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative bg-[#171717] z-0">
        
        {activeView === 'workflow-gallery' && (
          <div className="flex flex-col h-full overflow-hidden">
            <header className="p-6 pb-2 shrink-0">
              <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                <Puzzle className="text-indigo-400" /> 
                {activeWfCategory === 'all' ? '热门智能应用' : 
                 activeWfCategory === 'content' ? '内容创作引擎' :
                 activeWfCategory === 'image' ? '视觉图像处理' : 
                 activeWfCategory === 'data' ? '数据自动化' : '自动化 Agent'}
              </h1>
              <p className="text-sm text-zinc-500">选择一个工作流，将繁琐的步骤交给 AI 自动完成。</p>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {WORKFLOW_REGISTRY
                  .filter(wf => activeWfCategory === 'all' || wf.category === activeWfCategory)
                  .map(wf => (
                    <div 
                    key={wf.id}
                    onClick={() => { 
                      setActiveWfId(wf.id); 
                      setActiveView('workflow-execution'); 
                      setWfFormValues({}); 
                      setWfInput("");
                      const existingSessions = wfSessions.filter(s => s.workflowId === wf.id).sort((a, b) => b.updatedAt - a.updatedAt);
                      setActiveWfSessionId(existingSessions.length > 0 ? existingSessions[0].id : null);
                    }}
                    className="group relative bg-[#1e1e1e] border border-white/5 rounded-2xl p-5 cursor-pointer hover:bg-[#252525] hover:border-white/10 transition-all duration-300 shadow-lg hover:shadow-2xl hover:-translate-y-1 flex flex-col h-48"
                  >
                    <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md border border-white/10 px-2 py-1 rounded-md flex items-center gap-1.5 z-10 shadow-sm">
                      <div className={`w-1.5 h-1.5 rounded-full ${wf.engine === 'dify' ? 'bg-blue-400' : wf.engine === 'comfyui' ? 'bg-pink-400' : wf.engine === 'agent' ? 'bg-green-400' : 'bg-orange-400'}`}></div>
                      <span className="text-[9px] font-mono font-bold text-zinc-300 uppercase tracking-widest">{wf.engine}</span>
                    </div>

                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 border border-white/5 group-hover:scale-110 transition-transform shadow-inner">
                      {wf.icon}
                    </div>
                    
                    <h3 className="text-base font-bold text-zinc-200 mb-2 truncate">{wf.name}</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2 flex-1">{wf.desc}</p>
                    
                    <div className="mt-auto flex items-center text-[11px] text-indigo-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                      开始使用 <ChevronRight size={14} className="ml-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeView === 'workflow-execution' && activeWorkflowData && (
          <div className="flex h-full w-full overflow-hidden bg-[#0d0d0d]">
            {activeWorkflowData.engine !== 'dify' && (
              <div className="w-[360px] shrink-0 bg-[#171717] border-r border-white/5 flex flex-col h-full shadow-2xl z-10 relative">
                <header className="p-4 border-b border-white/5 flex items-center gap-3 shrink-0 bg-white/[0.02]">
                  <button onClick={() => setActiveView('workflow-gallery')} className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"><ArrowLeft size={18} /></button>
                  <div className="flex-1 truncate">
                    <div className="text-sm font-bold text-zinc-200 truncate">{activeWorkflowData.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono uppercase">Engine: {activeWorkflowData.engine}</div>
                  </div>
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                  <div className="text-xs text-zinc-400 leading-relaxed bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20">{activeWorkflowData.desc}</div>
                  <div className="space-y-5">
                    {activeWorkflowData.inputs.map(input => (
                      <div key={input.key} className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{input.label}</label>
                        {input.type === 'text' && <input type="text" value={wfFormValues[input.key] || ''} onChange={(e) => setWfFormValues({...wfFormValues, [input.key]: e.target.value})} placeholder={input.placeholder} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none" />}
                        {input.type === 'textarea' && <textarea value={wfFormValues[input.key] || ''} onChange={(e) => setWfFormValues({...wfFormValues, [input.key]: e.target.value})} placeholder={input.placeholder} className="w-full h-24 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none resize-none custom-scrollbar" />}
                        {input.type === 'select' && (
                          <div className="relative">
                            <select value={wfFormValues[input.key] || (input.options ? input.options[0] : '')} onChange={(e) => setWfFormValues({...wfFormValues, [input.key]: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none appearance-none cursor-pointer">
                              {input.options?.map(opt => <option key={opt} value={opt} className="bg-[#1a1a1a]">{opt}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                          </div>
                        )}
                        {input.type === 'file' && (
                          <div className="w-full py-4 border border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all cursor-pointer">
                            <Upload size={18} />
                            <span className="text-[10px] font-medium">点击上传文件</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 border-t border-white/5 bg-black/20 shrink-0">
                  <button onClick={() => handleRunWorkflow(false)} disabled={isWfRunning} className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold transition-all shadow-lg ${isWfRunning ? 'bg-white/10 text-zinc-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-[1.02] hover:shadow-indigo-500/30'}`}>
                    {isWfRunning ? <><Loader2 size={16} className="animate-spin" /> 引擎运转中...</> : <><Play size={16} className="fill-white" /> 执行工作流</>}
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col relative bg-[#121212]">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>
              
              {activeWorkflowData.engine === 'dify' && (
                <header className="p-4 flex items-center gap-3 shrink-0 bg-[#171717]/80 backdrop-blur-md sticky top-0 z-20 border-b border-white/[0.03]">
                  <button onClick={() => setActiveView('workflow-gallery')} className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"><ArrowLeft size={18} /></button>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-indigo-500/20 flex items-center justify-center">{activeWorkflowData.icon}</div>
                    <span className="text-sm font-bold text-zinc-200">{activeWorkflowData.name}</span>
                    <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full ml-2 font-medium tracking-wide">Chatflow</span>
                  </div>

                  <div className="flex-1"></div>
                  
                  <div className="relative wf-history-dropdown">
                    <button onClick={() => setIsWfHistoryMenuOpen(!isWfHistoryMenuOpen)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-all">
                      <Clock size={14} /> <span>历史记录 ({wfSessions.filter(s => s.workflowId === activeWfId).length})</span>
                    </button>
                    
                    {isWfHistoryMenuOpen && (
                      <div className="absolute top-full right-0 mt-2 w-64 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                        <button onClick={() => { setActiveWfSessionId(null); setIsWfHistoryMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs font-bold text-indigo-400 hover:bg-indigo-500/10 rounded-lg mb-1 flex items-center gap-2 transition-all">
                          <Plus size={14} strokeWidth={3} /> 开启全新对话
                        </button>
                        
                        <div className="max-h-64 overflow-y-auto custom-scrollbar border-t border-white/5 pt-1">
                          {wfSessions.filter(s => s.workflowId === activeWfId).sort((a,b) => b.updatedAt - a.updatedAt).map(s => (
                            <div key={s.id} className={`group flex items-center justify-between px-3 py-2.5 text-xs rounded-lg cursor-pointer transition-all ${activeWfSessionId === s.id ? 'bg-white/10 text-white font-medium' : 'text-zinc-400 hover:bg-white/5'}`} onClick={() => { setActiveWfSessionId(s.id); setIsWfHistoryMenuOpen(false); }}>
                              <span className="truncate flex-1 pr-2">{s.title}</span>
                              <button onClick={(e) => { e.stopPropagation(); setWfSessions(prev => prev.filter(x => x.id !== s.id)); if (activeWfSessionId === s.id) setActiveWfSessionId(null); }} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all"><Trash2 size={14} /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </header>
              )}

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative z-10" ref={wfResultScrollRef}>
                {wfMessages.length === 0 && !isWfRunning ? (
                  activeWorkflowData.engine === 'dify' ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                      <div className="w-20 h-20 mb-6 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 shadow-2xl"><PenTool size={32} className="text-indigo-400" /></div>
                      <h3 className="text-xl font-bold text-zinc-300 mb-2">{activeWorkflowData.name}</h3>
                      <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">{activeWorkflowData.desc}</p>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                      <div className="w-24 h-24 mb-6 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 shadow-2xl">{activeWorkflowData.icon}</div>
                      <h3 className="text-xl font-bold text-zinc-300 mb-2">等待输入参数</h3>
                      <p className="text-sm text-zinc-500 max-w-sm">在左侧配置好对应参数后，点击“执行”按钮，AI 将为你自动完成任务。</p>
                    </div>
                  )
                ) : (
                  <div className="max-w-3xl mx-auto space-y-6 pb-24">
                    {wfMessages.map((msg, idx) => (
                      <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} message-appear`}>
                        {msg.role !== 'user' && (
                          <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400 flex-shrink-0 shadow-lg mt-1"><Bot size={18}/></div>
                        )}
                        <div className={`max-w-[85%] rounded-[20px] px-5 py-4 ${msg.role === 'user' ? 'bg-[#2f2f2f] text-zinc-100 border border-white/5 shadow-2xl' : 'bg-[#1e1e1e] border border-white/10 shadow-xl text-zinc-300'}`}>
                          <div className={msg.role === 'assistant' && idx === wfMessages.length - 1 && isWfRunning ? "typing-cursor" : ""}>
                            <ReactMarkdown components={{
                              code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <div className="my-4 rounded-lg overflow-hidden border border-white/5 shadow-2xl"><SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter></div>
                                ) : ( <code className={`${className} bg-zinc-800 rounded px-1.5 py-0.5 text-zinc-200 font-mono text-sm`} {...props}>{children}</code> );
                              },
                            }}>{msg.content}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(activeWorkflowData.engine === 'dify' || wfMessages.length > 0) && (
                <div className="p-4 bg-gradient-to-t from-[#121212] via-[#121212]/90 to-transparent absolute bottom-0 left-0 right-0 z-20">
                  <div className="max-w-3xl mx-auto bg-[#2f2f2f]/40 border border-white/[0.05] backdrop-blur-2xl rounded-[20px] p-2 shadow-2xl focus-within:border-white/[0.15] transition-all flex items-end gap-2">
                  <textarea
                      ref={wfTextareaRef}
                      value={wfInput}
                      onChange={(e) => setWfInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleRunWorkflow(true, wfInput))}
                      placeholder="发送消息以启动或继续对话..."
                      className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-zinc-200 px-4 py-2.5 min-h-[44px] resize-none text-[14px] leading-relaxed custom-scrollbar"
                      style={{ height: 'auto' }}
                    />
                    <button onClick={() => handleRunWorkflow(true, wfInput)} disabled={!wfInput.trim() || isWfRunning} className={`p-2.5 rounded-full transition-all mb-1 mr-1 ${wfInput.trim() && !isWfRunning ? 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105 shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-white/5 text-zinc-600'}`}>
                      <ArrowUp size={18} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === 'chat' && (
          <>
            <header className="p-4 flex justify-between items-center bg-[#171717]/80 backdrop-blur-md sticky top-0 z-10 border-b border-white/[0.03]">
              <div className="relative" ref={modelMenuRef}>
                <button onClick={() => !isChatStarted && setIsModelMenuOpen(!isModelMenuOpen)} className={`flex items-center gap-2 group px-3 py-1.5 rounded-xl transition-all border border-transparent ${isChatStarted ? 'cursor-default opacity-80' : 'cursor-pointer hover:bg-zinc-800/50 hover:border-white/5'}`}>
                  <span className={`text-sm font-bold transition-colors uppercase tracking-tight ${isChatStarted ? 'text-zinc-500' : 'text-zinc-400 group-hover:text-zinc-100'}`}>{MODELS.find(m => m.id === currentModelId)?.name || currentModelId}</span>
                  {!isChatStarted && <ChevronDown size={14} className={`text-zinc-600 group-hover:text-zinc-400 transition-transform duration-300 ${isModelMenuOpen ? 'rotate-180' : ''}`} />}
                </button>

                {isModelMenuOpen && !isChatStarted && (
                  <div className="absolute left-0 mt-2 w-64 bg-[#1a1a1a]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-[100] py-2 px-1 animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">选择模型</div>
                    {MODELS.map((model) => (
                      <button key={model.id} onClick={(e) => handleModelChange(e, model.id)} className={`flex items-center justify-between w-full px-3 py-3 text-sm rounded-xl transition-all mb-0.5 ${currentModelId === model.id ? 'bg-white/5 text-white' : 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200'}`}>
                        <div className="flex flex-col items-start"><span className="font-semibold">{model.name}</span><span className="text-[10px] text-zinc-500 opacity-80">{model.desc}</span></div>
                        {currentModelId === model.id && <Check size={14} className="text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 text-zinc-500">
                <Github size={18} className="hover:text-white cursor-pointer transition-colors" />
                <Settings size={18} className="hover:text-white cursor-pointer transition-colors" onClick={() => setIsSettingsModalOpen(true)} />
              </div>
            </header>

            <div ref={scrollRef} onScroll={handleContainerScroll} className="flex-1 overflow-y-auto px-4 py-8 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="mt-20 flex flex-col items-center max-w-4xl mx-auto text-center">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-8 shadow-xl"><span className="text-black font-black text-lg tracking-tighter">YR</span></div>
                  <div className="mb-10"><h2 className="text-2xl font-bold text-zinc-100 mb-2 font-sans tracking-tight">{MODELS.find(m => m.id === currentModelId)?.name}</h2><h1 className="text-3xl font-medium text-zinc-500">有什么我能帮您的吗？</h1></div>
                  <div className="flex items-center justify-center gap-2 mb-6 text-zinc-500 font-bold text-xs uppercase tracking-widest text-white/40"><Zap size={14} className="text-yellow-500/80 fill-yellow-500/20" /> <span>建议</span></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-3xl px-4">
                    {["Give me ideas", "Explain options trading", "Overcome procrastination", "Help me study"].map((t, i) => (
                      <div key={i} className="group cursor-pointer p-4 rounded-2xl border border-transparent hover:bg-[#2f2f2f]/30 hover:border-white/[0.05] transition-all bg-[#232323]/20" onClick={() => handleSend(t)}><div className="text-[15px] font-bold text-zinc-300 group-hover:text-white">{t}</div></div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-10">
                  {messages.map((m, i) => (
                    <div key={`${currentSessionId}-${i}`} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'} message-appear`}>
                      {m.role !== 'user' && <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 text-zinc-400 flex-shrink-0 shadow-lg mt-1"><Bot size={18}/></div>}
                      <div className={`max-w-[85%] rounded-[20px] px-5 py-3 ${m.role === 'user' ? 'bg-[#2f2f2f] text-zinc-100 border border-white/5 shadow-2xl' : 'text-zinc-300 bg-transparent border-none shadow-none'}`}>
                        <div className={m.role === 'assistant' && i === messages.length - 1 && isTyping ? "typing-cursor" : ""}>
                          {Array.isArray(m.content) ? (
                            <div className="space-y-4">
                              {m.content.map((part, pIdx) => (
                                <div key={pIdx}>
                                  {part.type === 'text' && <ReactMarkdown components={{code({ node, inline, className, children, ...props }: any) {const match = /language-(\w+)/.exec(className || ''); return !inline && match ? (<div className="my-4 rounded-lg overflow-hidden border border-white/5 shadow-2xl"><SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter></div>) : ( <code className={`${className} bg-zinc-800 rounded px-1.5 py-0.5 text-zinc-200 font-mono text-sm`} {...props}>{children}</code> ); }}}>{part.text}</ReactMarkdown>}
                                  {part.type === 'image_url' && (part.image_url.url.startsWith('data:image') ? (<img src={part.image_url.url} alt="Uploaded" className="max-w-full rounded-lg border border-white/10 shadow-lg" />) : (<div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl max-w-sm"><FileText className="text-indigo-400" size={24} /><div className="truncate text-sm font-medium">已解析文件数据</div></div>))}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <ReactMarkdown components={{code({ node, inline, className, children, ...props }: any) {const match = /language-(\w+)/.exec(className || ''); return !inline && match ? (<div className="my-4 rounded-lg overflow-hidden border border-white/5 shadow-2xl"><SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter></div>) : ( <code className={`${className} bg-zinc-800 rounded px-1.5 py-0.5 text-zinc-200 font-mono text-sm`} {...props}>{children}</code> ); }}}>{m.content}</ReactMarkdown>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 flex flex-col items-center"> 
              <div className="max-w-3xl w-full relative px-4">
                {attachedFile && (
                  <div className="absolute -top-24 left-6 animate-in slide-in-from-bottom-2 duration-300 z-50">
                    <div className="relative group flex items-center gap-3 bg-[#1e1e1e] border border-white/10 p-3 rounded-2xl shadow-2xl min-w-[200px]">
                      {attachedFile.isImage ? (<img src={attachedFile.data} className="w-12 h-12 object-cover rounded-lg border border-white/10" />) : (<div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center text-indigo-400">{attachedFile.type.includes('pdf') ? <FileText size={24} /> : attachedFile.type.includes('code') ? <FileCode size={24} /> : <File size={24} />}</div>)}
                      <div className="flex flex-col max-w-[140px]"><span className="text-xs font-bold text-zinc-100 truncate">{attachedFile.name}</span><span className="text-[10px] text-zinc-500 font-mono">{(attachedFile.size / 1024).toFixed(1)} KB</span></div>
                      <button onClick={() => setAttachedFile(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform"><X size={10} /></button>
                    </div>
                  </div>
                )}

<div className="bg-[#2f2f2f]/40 border border-white/[0.05] backdrop-blur-2xl rounded-[28px] p-2 shadow-2xl focus-within:border-white/[0.15] transition-all overflow-hidden">
                  <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} onPaste={handlePaste} placeholder={`给 ${MODELS.find(m => m.id === currentModelId)?.name} 发送消息...`} className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-zinc-200 px-4 py-3 min-h-[44px] resize-none text-[15px] leading-relaxed custom-scrollbar" style={{ height: 'auto' }} />
                  <div className="flex items-center justify-between px-3 pb-2">
                    <div className="flex items-center gap-1">
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="*" />
                      <button onClick={() => fileInputRef.current?.click()} className="p-2 text-zinc-500 hover:text-zinc-200 rounded-full transition-all hover:bg-white/5"><PlusCircle size={20} /></button>
                      
                      {/* ✨ 替换后的联网搜索按钮，带状态控制和高亮动画 */}
                      <button 
                        onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)} 
                        className={`p-2 rounded-full transition-all duration-300 ${
                          isWebSearchEnabled 
                            ? 'text-blue-400 bg-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.3)] scale-110' 
                            : 'text-zinc-500 hover:text-blue-400 hover:bg-white/5'
                        }`}
                        title={isWebSearchEnabled ? "内置联网搜索已开启" : "开启联网搜索"}
                      >
                        <Globe size={18} className={isWebSearchEnabled ? "animate-pulse" : ""} />
                      </button>

                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-zinc-500 hover:text-zinc-200 rounded-full transition-all hover:bg-white/5"><Mic size={20} /></button>
                      <button onClick={() => handleSend()} disabled={(!input.trim() && !attachedFile) || isTyping} className={`p-2 rounded-full transition-all ${(input.trim() || attachedFile) && !isTyping ? "bg-white text-black hover:scale-105 active:scale-95 shadow-xl" : "bg-zinc-800 text-zinc-600"}`}><ArrowUp size={18} strokeWidth={3} /></button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-center pb-8"><p className="text-[11px] text-zinc-500 font-medium tracking-wide opacity-60">依然引擎开发，AI 生成可能有误，请仔细甄别。</p></div>
              </div>
            </div>
          </>
        )}
        
        {activeView === 'image-gen' && (
          <div className="flex h-full w-full overflow-hidden bg-[#0d0d0d]">
            <div className="w-[340px] flex-shrink-0 p-4 h-full">
              <div className="bg-[#171717] border border-white/[0.05] rounded-3xl h-full flex flex-col shadow-2xl overflow-hidden">
                <div className="p-5 border-b border-white/[0.05] flex items-center gap-3 bg-gradient-to-b from-white/[0.02] to-transparent">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400"><Wand2 size={18} /></div>
                  <h2 className="font-bold text-lg tracking-tight">图像参数</h2>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                  <div className="space-y-2.5 relative" ref={imgModelMenuRef}>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex justify-between"><span>图像引擎</span><span className="text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full text-[10px]">Pro</span></label>
                    <button onClick={() => setIsImgModelMenuOpen(!isImgModelMenuOpen)} className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all">
                      <div className="flex flex-col items-start text-left"><span className="text-sm font-semibold text-indigo-400">{IMAGE_MODELS.find(m => m.id === imgModel)?.name || imgModel}</span><span className="text-[10px] text-zinc-500 mt-0.5">{IMAGE_MODELS.find(m => m.id === imgModel)?.desc}</span></div>
                      <ChevronDown size={16} className={`text-zinc-500 transition-transform ${isImgModelMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isImgModelMenuOpen && (
                      <div className="absolute top-[70px] left-0 right-0 bg-[#1a1a1a]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 py-1.5 animate-in fade-in zoom-in-95 duration-200">
                        {IMAGE_MODELS.map(m => (
                          <button key={m.id} onClick={() => { setImgModel(m.id); setIsImgModelMenuOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-all ${imgModel === m.id ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}>
                            <div className="flex flex-col items-start text-left"><span className="font-semibold">{m.name}</span><span className="text-[10px] opacity-60 mt-0.5">{m.desc}</span></div>
                            {imgModel === m.id && <Check size={14} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">画面描述 (Prompt)</label>
                    <textarea value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} placeholder="描述你想看到的画面，例如：一只赛博朋克风格的猫，霓虹灯背景，8k分辨率..." className="w-full h-32 bg-black/40 border border-white/[0.05] rounded-xl p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none custom-scrollbar" />
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex justify-between"><span>参考图 (Image to Image)</span>{imgReferences.length > 0 && <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">{imgReferences.length} / 4</span>}</label>
                    <input type="file" ref={imgFileInputRef} onChange={handleImgReferenceChange} className="hidden" accept="image/*" multiple />
                    {imgReferences.length === 0 ? (
                      <button onClick={() => imgFileInputRef.current?.click()} className="w-full py-5 border border-dashed border-white/[0.15] rounded-xl flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all"><Upload size={20} /><span className="text-xs font-medium">点击上传参考图 (支持多选)</span></button>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {imgReferences.map((img, idx) => (
                          <div key={idx} className="relative w-full h-24 rounded-xl border border-white/[0.1] overflow-hidden group shadow-md">
                            <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-[10px] font-bold text-white z-10 border border-white/10 shadow-sm pointer-events-none">{idx + 1}</div>
                            <img src={img} alt={`Ref ${idx}`} className="w-full h-full object-cover opacity-80" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20"><button onClick={() => setImgReferences(prev => prev.filter((_, i) => i !== idx))} className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-all shadow-lg"><Trash2 size={16} /></button></div>
                          </div>
                        ))}
                        {imgReferences.length < 4 && (<button onClick={() => imgFileInputRef.current?.click()} className="w-full h-24 border border-dashed border-white/[0.15] rounded-xl flex flex-col items-center justify-center gap-1 text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all"><Plus size={20} /><span className="text-[10px]">添加</span></button>)}
                      </div>
                    )}
                  </div>

                  <div className={`space-y-2.5 transition-opacity ${!currentImgFeatures.includes('negative') ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex justify-between"><span>反向描述 (Negative)</span>{!currentImgFeatures.includes('negative') && <span className="text-[10px] text-zinc-600">当前模型不支持</span>}</label>
                    <textarea value={imgNegativePrompt} onChange={(e) => setImgNegativePrompt(e.target.value)} placeholder="不想在画面中出现的元素..." className="w-full h-16 bg-black/40 border border-white/[0.05] rounded-xl p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none custom-scrollbar" />
                  </div>

                  <div className={`space-y-2.5 transition-opacity ${!currentImgFeatures.includes('ratio') ? 'opacity-40 pointer-events-none' : ''}`}>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">画面比例</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[{ id: '1:1', icon: <Square size={16} /> }, { id: '16:9', icon: <Monitor size={16} /> }, { id: '9:16', icon: <Smartphone size={16} /> }, { id: '4:3', icon: <Layers size={16} /> }].map(r => (
                        <button key={r.id} onClick={() => setImgRatio(r.id)} className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border transition-all ${imgRatio === r.id ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400' : 'bg-white/[0.02] border-white/[0.05] text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300'}`}>{r.icon}<span className="text-[10px] font-mono font-bold">{r.id}</span></button>
                      ))}
                    </div>
                  </div>

                  <div className={`space-y-2.5 transition-opacity ${!currentImgFeatures.includes('style') && !currentImgFeatures.includes('stylize') ? 'opacity-40 pointer-events-none' : ''}`}>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">风格倾向</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ id: 'none', label: '智能/不选' }, { id: 'photorealistic', label: '真实摄影' }, { id: 'anime', label: '二次元' }, { id: '3d-model', label: '3D 渲染' }, { id: 'cyberpunk', label: '赛博朋克' }, { id: 'watercolor', label: '水彩艺术' }].map(s => (
                        <button key={s.id} onClick={() => setImgStyle(s.id)} className={`py-2 px-1.5 rounded-lg border text-[11px] transition-all whitespace-nowrap overflow-hidden text-ellipsis ${imgStyle === s.id ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400 font-bold' : 'bg-white/[0.02] border-white/[0.05] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200'}`}>{s.label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-5 border-t border-white/[0.05] bg-black/20 backdrop-blur-md">
                  <button onClick={handleGenerateImage} disabled={!imgPrompt.trim()} className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold transition-all ${!imgPrompt.trim() ? 'bg-white/5 text-zinc-500 cursor-not-allowed' : 'bg-white text-black hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.2)]'}`}>
                    <><Sparkles size={18} /> 生成图像</>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col p-4 pl-0">
              <div className="bg-[#171717] border border-white/[0.05] rounded-3xl h-full flex flex-col relative overflow-hidden shadow-2xl">
                <div className="flex-1 relative flex items-center justify-center p-8 overflow-hidden">
                  <div className="absolute top-4 right-4 flex gap-2 z-10">
                    {activeImageId && (<button onClick={() => { const img = imageHistory.find(i => i.id === activeImageId); if(img && img.url) { const link = document.createElement('a'); link.href = img.url; link.download = `YR_AI_Image_${img.id}.png`; link.click(); } }} className="p-2.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl text-zinc-400 hover:text-white transition-all hover:bg-black/80 shadow-lg"><Download size={18} /></button>)}
                  </div>
                  
                  {(() => {
                    const activeImg = imageHistory.find(i => i.id === activeImageId);
                    if (activeImg?.status === 'processing') {
                      return (
                        <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
                          <div className="relative w-24 h-24 flex items-center justify-center">
                            <div className="absolute inset-0 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
                            <div className="absolute inset-2 border-r-2 border-purple-500 rounded-full animate-spin-reverse" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                            <Sparkles className="text-indigo-400 animate-pulse" size={28} />
                          </div>
                          <div className="text-center space-y-2"><h3 className="text-lg font-bold text-zinc-200">正在唤醒潜意识...</h3><p className="text-sm text-zinc-500 font-mono">Model: {activeImg.model} • Ratio: {activeImg.ratio}</p></div>
                        </div>
                      );
                    } else if (activeImg?.status === 'failed') {
                      return (
                         <div className="flex flex-col items-center text-center text-red-400 animate-in fade-in duration-500">
                            <AlertTriangle size={48} className="mb-4 opacity-80" />
                            <h3 className="text-xl font-bold mb-2">图像生成失败或被中断</h3>
                            <p className="text-sm text-red-400/60">{activeImg.prompt}</p>
                         </div>
                      );
                    } else if (activeImg?.url) {
                      return (
                        <div className="w-full h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
                          <img src={activeImg.url} alt="Generated AI Art" className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10" />
                          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-xl w-[90%] bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-300 shadow-2xl">
                             <p className="text-sm text-zinc-200 line-clamp-2 leading-relaxed">{activeImg.prompt}</p>
                             <div className="flex gap-3 mt-2 text-[10px] font-mono text-indigo-400"><span>{activeImg.model}</span><span>Ratio: {activeImg.ratio}</span></div>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex flex-col items-center text-center max-w-sm opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                          <div className="w-20 h-20 mb-6 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-2xl rotate-3 hover:rotate-0 transition-transform"><ImageIcon size={32} className="text-zinc-400" /></div>
                          <h3 className="text-xl font-bold text-zinc-300 mb-2">构想你的画面</h3>
                          <p className="text-sm text-zinc-500 leading-relaxed">在左侧控制台输入描述词并调整参数，<br/>让 AI 为你呈现独一无二的视觉艺术。</p>
                        </div>
                      );
                    }
                  })()}
                </div>

                {imageHistory.length > 0 && (
                  <div className="h-[120px] bg-black/30 backdrop-blur-md border-t border-white/[0.05] p-3 flex gap-3 overflow-x-auto custom-scrollbar items-center flex-shrink-0">
                    {imageHistory.map((record) => (
                      <div key={record.id} onClick={() => setActiveImageId(record.id)} className={`group relative w-20 h-20 rounded-xl flex-shrink-0 cursor-pointer overflow-hidden transition-all duration-300 ${activeImageId === record.id ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#171717] scale-100 opacity-100' : 'border border-white/10 opacity-50 hover:opacity-100 hover:scale-105'}`}>
                        {record.status === 'processing' ? (
                           <div className="w-full h-full flex items-center justify-center bg-white/5"><Loader2 size={20} className="animate-spin text-indigo-400"/></div>
                        ) : record.status === 'failed' ? (
                           <div className="w-full h-full flex items-center justify-center bg-red-500/10 text-red-500"><AlertTriangle size={20}/></div>
                        ) : (
                           <img src={record.url} className="w-full h-full object-cover" />
                        )}
                        <button onClick={(e) => { e.stopPropagation(); const newHistory = imageHistory.filter(i => i.id !== record.id); setImageHistory(newHistory); if (activeImageId === record.id) setActiveImageId(newHistory.length > 0 ? newHistory[0].id : null); }} className="absolute top-1 right-1 p-1.5 bg-red-500/80 backdrop-blur-md text-white rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all shadow-lg"><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeView === 'video-gen' && (
          <div className="flex flex-col h-full w-full relative">
            <header className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-[#171717] to-transparent z-10 pointer-events-none flex justify-between items-center">
              <div className="text-zinc-400 font-medium text-sm flex items-center gap-2 pointer-events-auto bg-black/40 px-4 py-2 rounded-full backdrop-blur-md border border-white/5"><Clapperboard size={16} className="text-purple-400"/> 视频创作工作台</div>
            </header>

            <div ref={vidFeedScrollRef} className="flex-1 overflow-y-auto p-6 pt-20 pb-64 custom-scrollbar">
              <div className="max-w-4xl mx-auto space-y-12">
                {videoHistory.length === 0 && (
                  <div className="mt-32 flex flex-col items-center text-center opacity-50 grayscale">
                    <div className="w-20 h-20 mb-6 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 shadow-2xl"><MonitorPlay size={32} className="text-zinc-400" /></div>
                    <h3 className="text-xl font-bold text-zinc-300 mb-2">构想你的动态视界</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">在下方选择创作模式并上传参考素材，<br/>让 AI 为你导演一部专属大片。</p>
                  </div>
                )}

                {videoHistory.map((record, idx) => {
                  if (record.status === 'processing') {
                     return (
                       <div key={record.id} className="bg-[#1e1e1e] border border-purple-500/30 rounded-3xl p-5 shadow-[0_0_30px_rgba(168,85,247,0.1)] animate-pulse">
                          <div className="flex gap-4 mb-4">
                            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center"><Loader2 size={14} className="text-purple-400 animate-spin" /></div>
                            <div className="flex-1 space-y-2 py-1"><div className="h-4 bg-white/10 rounded w-3/4"></div><div className="h-3 bg-white/5 rounded w-1/2"></div></div>
                          </div>
                          <div className="w-full h-64 bg-black/50 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-3"><Film className="text-purple-500/50" size={32} /><span className="text-sm text-purple-400/80 font-mono">引擎正在逐帧渲染中 (约需1~3分钟)...</span></div>
                       </div>
                     );
                  } else if (record.status === 'failed') {
                     return (
                       <div key={record.id} className="bg-[#1e1e1e] border border-red-500/30 rounded-3xl p-5 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                          <div className="flex items-center gap-2 text-red-400 mb-2"><AlertTriangle size={18}/> <span className="font-bold">视频生成失败或被中断</span></div>
                          <p className="text-sm text-zinc-500 leading-relaxed">{record.prompt}</p>
                          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-red-500/10">
                             <button onClick={() => loadVideoToEdit(record)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium transition-all"><RotateCcw size={14} /> 重新编辑</button>
                             <div className="flex-1"></div>
                             <button onClick={() => triggerVideoDelete(record.id)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={16} /></button>
                          </div>
                       </div>
                     );
                  } else {
                     return (
                       <div key={record.id} className="bg-[#1e1e1e] border border-white/[0.05] rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
                         <div className="flex gap-4 mb-4">
                           <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 flex-shrink-0 mt-1"><span className="text-[12px] font-black">AI</span></div>
                           <div className="flex-1">
                             <div className="text-sm text-zinc-200 leading-relaxed mb-2 font-medium">
                               {record.prompt.split(/(@\S+)/g).map((part, i) => part.startsWith('@') ? <span key={i} className="text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-md mx-0.5">{part}</span> : part)}
                             </div>
                             <div className="flex flex-wrap gap-2 text-[11px] font-mono text-zinc-500">
                               <span className="bg-white/5 px-2 py-1 rounded-md border border-white/5">{VIDEO_MODES.find(m=>m.id===record.mode)?.label || '文生视频'}</span>
                               <span className="bg-white/5 px-2 py-1 rounded-md border border-white/5">{VIDEO_MODELS.find(m=>m.id===record.model)?.name || record.model}</span>
                               <span className="bg-white/5 px-2 py-1 rounded-md border border-white/5">{record.ratio}</span>
                               {record.duration && <span className="bg-white/5 px-2 py-1 rounded-md border border-white/5">{record.duration}s</span>}
                               {record.resolution && <span className="bg-white/5 px-2 py-1 rounded-md border border-white/5">{record.resolution.toUpperCase()}</span>}
                             </div>
                           </div>
                         </div>

                         <div className="rounded-2xl overflow-hidden bg-black border border-white/10 relative group">
                           <video src={record.url} controls loop playsInline className="w-full max-h-[500px] object-contain" />
                         </div>

                         <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
                           <button onClick={() => loadVideoToEdit(record)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium transition-all"><RotateCcw size={14} /> 重新编辑</button>
                           <button onClick={() => { const link = document.createElement('a'); link.href = record.url; link.download = `Video_${record.id}.mp4`; link.click(); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium transition-all"><Download size={14} /> 下载视频</button>
                           <div className="flex-1"></div>
                           <button onClick={() => triggerVideoDelete(record.id)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={16} /></button>
                         </div>
                       </div>
                     );
                  }
                })}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#171717] via-[#171717]/95 to-transparent pt-10 pb-6 px-6">
              <div className="max-w-4xl mx-auto bg-[#232323] rounded-[24px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-3 flex flex-col gap-3 transition-all focus-within:border-white/20 focus-within:shadow-[0_20px_50px_rgba(168,85,247,0.1)]">
                
                {vidMaterials.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1 px-1">
                    {vidMaterials.map((m) => {
                      let roleBadge = null;
                      if (m.type === 'image') {
                        if (vidMode === 'i2v-both') {
                          if (m.id === imageMaterials[0]?.id) roleBadge = "首帧";
                          else if (imageMaterials.length > 1 && m.id === imageMaterials[imageMaterials.length - 1]?.id) roleBadge = "尾帧";
                        } else if (vidMode === 'i2v') {
                          if (m.id === imageMaterials[0]?.id) roleBadge = "首帧";
                        }
                      }
                      return (
                        <div key={m.id} className="relative w-16 h-16 rounded-xl border border-white/10 overflow-hidden group flex-shrink-0 bg-black/50">
                          {roleBadge && (<div className="absolute top-0 left-0 bg-pink-500/90 text-white text-[8px] px-1.5 py-0.5 rounded-br-lg z-10 font-bold tracking-widest shadow-sm">{roleBadge}</div>)}
                          {m.type === 'image' ? <img src={m.url} className="w-full h-full object-cover opacity-80" /> : m.type === 'video' ? <div className="w-full h-full flex items-center justify-center text-blue-400"><Video size={20}/></div> : <div className="w-full h-full flex items-center justify-center text-emerald-400"><Music size={20}/></div>}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-center py-0.5 text-white truncate px-1">{m.tag}</div>
                          <button onClick={() => setVidMaterials(prev => prev.filter(item => item.id !== m.id))} className="absolute top-1 right-1 p-1 bg-red-500/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity scale-75 hover:scale-100 z-20"><X size={10}/></button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-3 items-start px-2">
                  <input type="file" ref={vidFileInputRef} onChange={handleVidMaterialUpload} className="hidden" accept="image/*,video/*,audio/*" multiple />
                  <button onClick={() => vidFileInputRef.current?.click()} className="w-16 h-16 flex-shrink-0 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-all group">
                    <Plus size={20} className="mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] font-medium tracking-wide">参考内容</span>
                  </button>

                  <div className="flex-1 relative at-dropdown-container">
                    {showAtDropdown && vidMaterials.length > 0 && (
                      <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                        <div className="text-[10px] text-zinc-500 mb-2 px-1">选择参考素材</div>
                        <div className="max-h-40 overflow-y-auto custom-scrollbar">
                          {vidMaterials.map(m => (
                            <button key={m.id} onClick={() => insertMaterialTag(m.tag)} className="w-full text-left px-2 py-1.5 hover:bg-white/5 rounded-lg flex items-center gap-2 transition-colors">
                              {m.type === 'image' ? <ImageIcon size={14} className="text-zinc-400"/> : m.type === 'video' ? <Video size={14} className="text-blue-400"/> : <Music size={14} className="text-emerald-400"/>}
                              <span className="text-sm text-zinc-300">{m.tag}</span><span className="text-[10px] text-zinc-500 truncate flex-1 text-right">{m.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <textarea id="vid-textarea" value={vidPrompt} onChange={handleVidPromptChange} placeholder={getVidPlaceholder()} className="w-full bg-transparent resize-none outline-none text-[15px] text-zinc-200 placeholder-zinc-600 min-h-[64px] py-1 leading-relaxed custom-scrollbar" />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 px-2 relative vid-toolbar-menu">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <button onClick={() => setIsVidModeMenuOpen(!isVidModeMenuOpen)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 text-zinc-300 text-xs font-medium transition-colors"><Wand2 size={14} className="text-pink-400" /><span>{VIDEO_MODES.find(m => m.id === vidMode)?.label}</span><ChevronDown size={12} className="text-zinc-500" /></button>
                      {isVidModeMenuOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-36 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95">
                          {VIDEO_MODES.map(m => {
                            const isSupported = currentVidModes.includes(m.id);
                            return (
                              <button key={m.id} disabled={!isSupported} onClick={() => {setVidMode(m.id); setIsVidModeMenuOpen(false);}} className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${!isSupported ? 'opacity-30' : 'hover:bg-white/5 text-zinc-300'} ${vidMode === m.id ? 'text-pink-400' : ''}`}>
                                {m.icon} <span className="flex-1">{m.label}</span> {vidMode === m.id && <Check size={12}/>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="w-px h-4 bg-white/10 mx-1"></div>

                    <div className="relative">
                      <button onClick={() => setIsVidModelMenuOpen(!isVidModelMenuOpen)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 text-zinc-300 text-xs font-medium transition-colors"><Sparkles size={14} className="text-indigo-400" /><span>{VIDEO_MODELS.find(m => m.id === vidModel)?.name}</span><ChevronDown size={12} className="text-zinc-500" /></button>
                      {isVidModelMenuOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95">
                          {VIDEO_MODELS.map(m => (
                            <button key={m.id} onClick={() => handleVidModelChange(m.id)} className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center justify-between ${vidModel === m.id ? 'text-indigo-400' : 'text-zinc-300'}`}>{m.name} {vidModel === m.id && <Check size={12}/>}</button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button onClick={() => currentVidFeatures.includes('ratio') && setIsVidRatioMenuOpen(!isVidRatioMenuOpen)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!currentVidFeatures.includes('ratio') ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/5 text-zinc-300'}`}><Monitor size={14} /> <span>{vidRatio}</span> <ChevronDown size={12} className="text-zinc-500" /></button>
                      {isVidRatioMenuOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-32 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl py-1 z-50 flex flex-col">
                          {['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'].map(r => {
                            const isSupported = currentVidModelData?.ratios?.includes(r);
                            return (
                              <button key={r} disabled={!isSupported} onClick={() => {setVidRatio(r); setIsVidRatioMenuOpen(false);}} className={`w-full text-left px-3 py-2 text-xs flex justify-between ${!isSupported ? 'opacity-30' : 'hover:bg-white/5 text-zinc-300'} ${vidRatio === r ? 'text-purple-400' : ''}`}>{r} {vidRatio === r && <Check size={12}/>}</button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button onClick={() => currentVidFeatures.includes('duration') && setIsVidDurationMenuOpen(!isVidDurationMenuOpen)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!currentVidFeatures.includes('duration') ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/5 text-zinc-300'}`}><Clock size={14} /> <span>{vidDuration}s</span> <ChevronDown size={12} className="text-zinc-500" /></button>
                      {isVidDurationMenuOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl p-3 z-50">
                          <div className="flex items-center gap-3"><span className="text-[10px] text-zinc-500">4s</span><input type="range" min="4" max="15" step="1" value={vidDuration} onChange={(e) => setVidDuration(parseInt(e.target.value))} className="flex-1 h-1 bg-white/10 rounded-lg appearance-none accent-purple-500" /><span className="text-[10px] text-zinc-500">15s</span></div>
                        </div>
                      )}
                    </div>

                    <div className="relative hidden sm:block">
                      <button onClick={() => currentVidFeatures.includes('resolution') && setIsVidResMenuOpen(!isVidResMenuOpen)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!currentVidFeatures.includes('resolution') ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/5 text-zinc-300'}`}><Layers size={14} /> <span>{vidResolution.toUpperCase()}</span> <ChevronDown size={12} className="text-zinc-500" /></button>
                      {isVidResMenuOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-32 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl py-1 z-50 flex flex-col">
                          {['480p', '720p', '1080p', '4k'].map(r => {
                            const isSupported = currentVidModelData?.resolutions?.includes(r);
                            return (
                              <button key={r} disabled={!isSupported} onClick={() => {setVidResolution(r); setIsVidResMenuOpen(false);}} className={`w-full text-left px-3 py-2 text-xs flex justify-between ${!isSupported ? 'opacity-30' : 'hover:bg-white/5 text-zinc-300'} ${vidResolution === r ? 'text-purple-400' : ''}`}>{r.toUpperCase()} {vidResolution === r && <Check size={12}/>}</button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button onClick={handleGenerateVideo} disabled={!vidPrompt.trim() && vidMaterials.length === 0} className={`p-2.5 rounded-full transition-all ${(!vidPrompt.trim() && vidMaterials.length === 0) ? 'bg-white/5 text-zinc-600' : 'bg-purple-600 text-white hover:bg-purple-500 hover:scale-105 shadow-[0_0_15px_rgba(168,85,247,0.4)]'}`}>
                      <ArrowUp size={18} strokeWidth={3} />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- 设置中心弹窗 --- */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsSettingsModalOpen(false)} />
          <div className="relative w-full max-w-5xl bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl flex overflow-hidden animate-in zoom-in-95 fade-in duration-200 h-[75vh]">
            
            <div className="w-56 bg-[#121212] border-r border-white/5 flex flex-col p-4 flex-shrink-0">
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 pl-2">平台设置</div>
              <div className="flex flex-col gap-1">
                {[
                  { id: 'general', icon: <User size={16} />, label: '通用设置' },
                  { id: 'instructions', icon: <Cpu size={16} />, label: '个性化指令' },
                  { id: 'parameters', icon: <Sliders size={16} />, label: '模型微调' },
                  { id: 'data', icon: <Database size={16} />, label: '数据与存储' },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveSettingsTab(tab.id as any)} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${activeSettingsTab === tab.id ? 'bg-indigo-500/10 text-indigo-400 font-bold' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}>
                    {tab.icon} {tab.label}
                  </button>
                ))}
                
                {userRole === 'admin' && (
                  <>
                    <div className="my-2 border-t border-white/5"></div>
                    <button onClick={() => setActiveSettingsTab('admin')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${activeSettingsTab === 'admin' ? 'bg-red-500/10 text-red-400 font-bold' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}>
                      <Shield size={16} /> 用户管理 (Admin)
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar relative bg-[#1a1a1a]">
              <button onClick={() => setIsSettingsModalOpen(false)} className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-zinc-200 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X size={16} /></button>
              
              {activeSettingsTab === 'general' && (
                <div className="space-y-8 max-w-xl">
                  <div><h2 className="text-xl font-bold text-zinc-100 mb-1">通用设置</h2><p className="text-sm text-zinc-500">定制你在工作台中的身份标识与视觉偏好。</p></div>
                  <div className="space-y-4">
                    <label className="text-sm font-bold text-zinc-300">用户头像</label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-lg font-bold text-white shadow-lg overflow-hidden border border-white/10">
                        {settings.avatar.startsWith('data:image') ? <img src={settings.avatar} className="w-full h-full object-cover" /> : settings.avatar || 'RY'}
                      </div>
                      <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
                      <button onClick={() => avatarInputRef.current?.click()} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-300 hover:bg-white/10 transition-colors">上传新头像</button>
                      <button onClick={() => setSettings(prev => ({...prev, avatar: 'RY'}))} className="px-4 py-2 bg-transparent text-sm text-zinc-500 hover:text-zinc-300 transition-colors">恢复默认</button>
                    </div>
                  </div>
                  <div className="space-y-2"><label className="text-sm font-bold text-zinc-300">用户昵称</label><input type="text" value={settings.nickname} onChange={(e) => setSettings(prev => ({...prev, nickname: e.target.value}))} placeholder="例如：依然开发者" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" /></div>
                  <div className="space-y-2"><label className="text-sm font-bold text-zinc-300">UI 主题</label><select disabled className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-500 outline-none appearance-none cursor-not-allowed opacity-70"><option>极夜黑 (Dark Night Black) - 默认</option></select><p className="text-xs text-zinc-500 mt-1">浅色主题功能正在开发中，敬请期待。</p></div>
                </div>
              )}

              {activeSettingsTab === 'instructions' && (
                <div className="space-y-8 max-w-xl">
                  <div><h2 className="text-xl font-bold text-zinc-100 mb-1">个性化指令</h2><p className="text-sm text-zinc-500">类似于 Custom Instructions，为 AI 设定默认的性格、语气或背景知识。</p></div>
                  <div className="space-y-3"><label className="text-sm font-bold text-zinc-300 flex items-center gap-2">全局 System Prompt <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full">所有模型生效</span></label><textarea value={settings.globalSystemPrompt} onChange={(e) => setSettings(prev => ({...prev, globalSystemPrompt: e.target.value}))} placeholder="例如：请用简短专业的中文回答，不要说废话..." className="w-full h-28 bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-none custom-scrollbar" /></div>
                  <div className="w-full h-px bg-white/5 my-6"></div>
                  <div className="space-y-3"><label className="text-sm font-bold text-zinc-300">特定模型专属 Prompt</label><p className="text-xs text-zinc-500 mb-2">如果为特定模型设置了专属 Prompt，它将覆盖上方的全局设置。</p><select value={selectedPromptModel} onChange={(e) => setSelectedPromptModel(e.target.value)} className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-200 outline-none mb-3 cursor-pointer">{MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select><textarea value={settings.modelSystemPrompts[selectedPromptModel] || ''} onChange={(e) => setSettings(prev => ({...prev, modelSystemPrompts: {...prev.modelSystemPrompts, [selectedPromptModel]: e.target.value}}))} placeholder={`为 ${MODELS.find(m => m.id === selectedPromptModel)?.name} 设定专属指令...`} className="w-full h-28 bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-none custom-scrollbar" /></div>
                </div>
              )}

              {activeSettingsTab === 'parameters' && (
                <div className="space-y-10 max-w-xl">
                  <div><h2 className="text-xl font-bold text-zinc-100 mb-1">模型微调 (Parameters)</h2><p className="text-sm text-zinc-500">通过核心参数调整底层大模型的输出倾向与风格。</p></div>
                  <div className="space-y-4"><div className="flex justify-between items-center"><div><label className="text-sm font-bold text-zinc-300">发散度 (Temperature)</label><p className="text-xs text-zinc-500 mt-1">控制随机性：0 = 严谨死板，2 = 天马行空。</p></div><span className="text-sm font-mono text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg">{settings.temperature.toFixed(1)}</span></div><input type="range" min="0" max="2" step="0.1" value={settings.temperature} onChange={(e) => setSettings(prev => ({...prev, temperature: parseFloat(e.target.value)}))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-indigo-500 cursor-pointer" /></div>
                  <div className="space-y-4"><div className="flex justify-between items-center"><div><label className="text-sm font-bold text-zinc-300">核心采样 (Top-P)</label><p className="text-xs text-zinc-500 mt-1">控制词汇的丰富度与生成的多样性范围。</p></div><span className="text-sm font-mono text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg">{settings.topP.toFixed(1)}</span></div><input type="range" min="0" max="1" step="0.1" value={settings.topP} onChange={(e) => setSettings(prev => ({...prev, topP: parseFloat(e.target.value)}))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-indigo-500 cursor-pointer" /></div>
                  <div className="space-y-4"><div><label className="text-sm font-bold text-zinc-300">最大输出 (Max Tokens)</label><p className="text-xs text-zinc-500 mt-1">限制单次回答的最大长度，自定义，不填为默认模型最大值。</p></div><input type="number" value={settings.maxTokens} onChange={(e) => setSettings(prev => ({...prev, maxTokens: e.target.value}))} placeholder="例如：2048" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" /></div>
                </div>
              )}

              {activeSettingsTab === 'data' && (
                <div className="space-y-8 max-w-xl">
                  <div><h2 className="text-xl font-bold text-zinc-100 mb-1">数据与存储</h2><p className="text-sm text-zinc-500">管理存储在本地浏览器中的所有对话与生成记录。</p></div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between"><div><h3 className="text-sm font-bold text-zinc-200">导出所有记录</h3><p className="text-xs text-zinc-500 mt-1">一键将对话、图片、视频历史导出为 JSON 文件。</p></div><button onClick={handleExportData} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all shadow-lg"><Download size={16} /> 导出数据</button></div>
                  <div className="w-full h-px bg-white/5 my-6"></div>
                  <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-5"><h3 className="text-sm font-bold text-red-400">危险操作</h3><p className="text-xs text-red-400/60 mt-1 mb-4">退出登录将清除当前浏览器中的所有数据记录（包括对话和配置），此操作不可逆。</p><button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-sm font-medium rounded-xl transition-all"><LogOut size={16} /> 退出登录并清空</button></div>
                </div>
              )}

              {/* ✨ 管理员专属面板 */}
              {activeSettingsTab === 'admin' && userRole === 'admin' && (
                <div className="space-y-6 max-w-5xl w-full pb-10">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-zinc-100 mb-1 flex items-center gap-2"><Shield className="text-indigo-400" size={20} /> 用户管理控制台</h2>
                      <p className="text-sm text-zinc-500">查看全站用户真实在线状态与消耗数据 (每3秒自动刷新)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full text-[10px] text-zinc-400">
                        <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
                        实时同步中
                      </div>
                      <button onClick={() => fetchAdminData(false)} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium transition-colors text-zinc-300">
                        <RotateCcw size={14} /> 强制刷新
                      </button>
                    </div>
                  </div>

                  {isAdminLoading ? (
                     <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-zinc-500" size={32} /></div>
                  ) : (
                    <div className="bg-black/20 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                      <table className="w-full text-left text-sm text-zinc-300">
                        <thead className="bg-white/[0.02] border-b border-white/5 text-xs uppercase tracking-wider text-zinc-500">
                          <tr>
                            <th className="px-6 py-4 font-semibold">账号</th>
                            <th className="px-6 py-4 font-semibold">系统角色</th>
                            <th className="px-6 py-4 font-semibold">在线状态</th>
                            <th className="px-6 py-4 font-semibold">可用余额 / 消耗</th>
                            <th className="px-6 py-4 font-semibold">最后登录</th>
                            <th className="px-6 py-4 font-semibold text-right">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {adminUsers.map((u, i) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-6 py-4 font-medium text-zinc-200">{u.username}</td>
                              <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide ${u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-500/20 text-zinc-400'}`}>{u.role.toUpperCase()}</span></td>
                              <td className="px-6 py-4"><div className="flex items-center gap-2"><CircleDot size={12} className={u.online ? "text-green-500" : "text-zinc-600"} /><span className={u.online ? "text-zinc-300" : "text-zinc-500"}>{u.online ? "当前在线" : "离线"}</span></div></td>
                              
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-mono text-xs font-bold text-indigo-400" title="可用余额">{u.token_balance?.toLocaleString() || 0}</span>
                                  <span className="font-mono text-[10px] text-zinc-500 line-through" title="已消耗">{u.tokens_used?.toLocaleString() || 0}</span>
                                </div>
                              </td>

                              <td className="px-6 py-4 text-xs text-zinc-500 font-mono">{u.last_login}</td>
                              <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                                <button onClick={() => handleViewUserChats(u.username)} className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors" title="查看对话记录"><MessageSquare size={16} /></button>
                                <button onClick={() => setSelectedUser(u)} className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="管理用户"><Settings size={16} /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedUser && (
                    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedUser(null)} />
                      <div className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-3xl p-6 z-10 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-2xl font-black shadow-lg">
                              {selectedUser.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-white tracking-tight">{selectedUser.username}</h3>
                              <span className="text-[10px] text-zinc-400 font-mono uppercase bg-white/5 px-2 py-0.5 rounded-md mt-1 inline-block">{selectedUser.role}</span>
                            </div>
                          </div>
                          <button onClick={() => setSelectedUser(null)} className="text-zinc-500 hover:text-white bg-white/5 p-1.5 rounded-full transition-colors"><X size={16}/></button>
                        </div>
                        
                        <div className="space-y-3 mb-6">
                          <div className="flex justify-between items-center p-3.5 bg-[#121212] border border-white/5 rounded-xl"><span className="text-sm text-zinc-400 font-medium">当前可用余额</span><span className="text-lg font-black text-indigo-400 font-mono">{selectedUser.token_balance?.toLocaleString() || 0}</span></div>
                          <div className="flex justify-between items-center p-3.5 bg-[#121212] border border-white/5 rounded-xl"><span className="text-sm text-zinc-400 font-medium">历史累计消耗</span><span className="text-sm font-bold text-zinc-500 font-mono line-through">{selectedUser.tokens_used?.toLocaleString() || 0}</span></div>
                          <div className="flex justify-between items-center p-3.5 bg-[#121212] border border-white/5 rounded-xl"><span className="text-sm text-zinc-400 font-medium">当前状态</span><span className={`text-sm font-bold flex items-center gap-1.5 ${selectedUser.online ? 'text-green-400' : 'text-zinc-500'}`}><CircleDot size={10} /> {selectedUser.online ? '正在使用' : '已下线'}</span></div>
                        </div>

                        {/* ✨ 新增：四大模块精细化权限控制开关 */}
                        <div className="mb-6">
                          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">模块访问权限</h4>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { key: 'allow_chat', label: '智能对话', icon: <MessageSquare size={14}/> },
                              { key: 'allow_image', label: '图像生成', icon: <ImageIcon size={14}/> },
                              { key: 'allow_video', label: '视频创作', icon: <Film size={14}/> },
                              { key: 'allow_workflow', label: '工作流引擎', icon: <Puzzle size={14}/> },
                            ].map(perm => (
                              <div key={perm.key} className="flex items-center justify-between p-3 bg-[#121212] border border-white/5 rounded-xl">
                                <span className="text-xs text-zinc-300 flex items-center gap-1.5 font-medium">{perm.icon} {perm.label}</span>
                                <button 
                                  onClick={() => handleAdminUserAction(selectedUser.username, 'update_permission', { perm_type: perm.key, perm_value: !selectedUser[perm.key] })}
                                  className={`w-9 h-5 rounded-full relative transition-colors duration-300 ${selectedUser[perm.key] ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                                >
                                  {/* 丝滑的开关小白球动画 */}
                                  <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${selectedUser[perm.key] ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={() => handleAdminUserAction(selectedUser.username, 'recharge')} className="col-span-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20">💰 充值 100,000 额度 (1元)</button>
                          <button onClick={() => handleAdminUserAction(selectedUser.username, 'reset_tokens')} className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-all">清零消耗</button>
                          <button onClick={() => handleAdminUserAction(selectedUser.username, 'kick')} className="py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-sm font-bold transition-all">强制下线</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* --- 会话删除二次确认弹窗 --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500"><AlertTriangle size={24} /></div>
              <div><h3 className="text-lg font-bold text-zinc-100">确认删除对话？</h3><p className="text-sm text-zinc-500 leading-relaxed">此操作不可撤销，该对话的所有记录都将从本地丢失。</p></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors text-sm">取消</button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors shadow-lg shadow-red-500/20 text-sm">确认删除</button>
            </div>
            <button onClick={() => setIsDeleteModalOpen(false)} className="absolute top-4 right-4 p-1 text-zinc-500 hover:text-zinc-200 transition-colors"><X size={18} /></button>
          </div>
        </div>
      )}

      {/* --- 视频删除二次确认弹窗 --- */}
      {isVideoDeleteModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsVideoDeleteModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500"><AlertTriangle size={24} /></div>
              <div><h3 className="text-lg font-bold text-zinc-100">确认删除此视频？</h3><p className="text-sm text-zinc-500 leading-relaxed">此操作不可撤销，视频生成记录将从本地清除。</p></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsVideoDeleteModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors text-sm">取消</button>
              <button onClick={confirmVideoDelete} className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors shadow-lg shadow-red-500/20 text-sm">确认删除</button>
            </div>
            <button onClick={() => setIsVideoDeleteModalOpen(false)} className="absolute top-4 right-4 p-1 text-zinc-500 hover:text-zinc-200 transition-colors"><X size={18} /></button>
          </div>
        </div>
      )}

      {/* --- 全局搜索弹窗 --- */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-[15vh] p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsSearchModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 fade-in duration-200 max-h-[70vh] overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-white/5 bg-white/[0.02]">
              <Search size={20} className="text-zinc-400" />
              <input autoFocus type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索历史对话的标题或内容..." className="flex-1 bg-transparent border-none outline-none text-zinc-200 placeholder-zinc-600 text-base" />
              <button onClick={() => setIsSearchModalOpen(false)} className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/10 transition-colors rounded-lg"><X size={18} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-[#171717]">
              {!searchQuery.trim() ? (
                <div className="p-10 text-center text-zinc-600 text-sm flex flex-col items-center gap-3"><Search size={32} className="text-zinc-700 opacity-50" /><span>输入关键词，快速定位历史记录</span></div>
              ) : searchResults.length === 0 ? (
                <div className="p-10 text-center text-zinc-600 text-sm">未找到与 <span className="text-zinc-300 font-medium">"{searchQuery}"</span> 相关的记录</div>
              ) : (
                <div className="space-y-1">
                  {searchResults.map((result: any) => (
                    <div key={result.id} onClick={() => { setCurrentSessionId(result.id); setActiveView('chat'); setIsSearchModalOpen(false); setSearchQuery(""); }} className="group cursor-pointer p-3.5 rounded-xl hover:bg-white/5 transition-all flex flex-col gap-2">
                      <div className="flex items-center justify-between"><div className="flex items-center gap-2.5 text-zinc-200 font-medium text-sm"><MessageSquare size={16} className="text-indigo-400 opacity-80" /><span>{result.title}</span></div><div className="text-[10px] text-zinc-600 font-mono">{new Date(result.updatedAt).toLocaleDateString()}</div></div>
                      {result.snippet && <div className="text-xs text-zinc-500 pl-7 line-clamp-1 leading-relaxed">{result.snippet}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 用户全维度记录列表弹窗 */}
      {viewingUserChats !== null && !viewingSpecificChat && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setViewingUserChats(null)} />
          <div className="relative w-full max-w-4xl bg-[#171717] border border-white/10 rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 fade-in duration-200 h-[75vh] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/[0.02]">
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2"><User size={18} className="text-indigo-400"/> {viewingUsername} 的生成记录库</h2>
              <button onClick={() => setViewingUserChats(null)} className="p-1.5 text-zinc-500 hover:text-white rounded-lg transition-colors"><X size={18} /></button>
            </div>
            
            <div className="flex items-center gap-6 px-6 pt-4 border-b border-white/5 bg-white/[0.01]">
              {[
                { id: 'chats', label: '智能对话', icon: <MessageSquare size={14}/> },
                { id: 'workflows', label: '工作流引擎', icon: <Puzzle size={14}/> },
                { id: 'images', label: '视觉图像', icon: <ImageIcon size={14}/> },
                { id: 'videos', label: '视频创作', icon: <Film size={14}/> }
              ].map(tab => (
                <button key={tab.id} onClick={() => setAdminViewTab(tab.id as any)} className={`flex items-center gap-2 pb-3 text-sm font-bold border-b-2 transition-all ${adminViewTab === tab.id ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
                  {tab.icon} {tab.label} <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px]">{viewingUserChats[tab.id]?.length || 0}</span>
                </button>
              ))}
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
              {(!viewingUserChats[adminViewTab] || viewingUserChats[adminViewTab].length === 0) ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                  <ArchiveIcon size={32} className="mb-3 opacity-50" />
                  <p>该分类下暂无任何生成记录</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {adminViewTab === 'chats' && viewingUserChats.chats.map((chat: any) => (
                    <div key={chat.id} onClick={() => setViewingSpecificChat({ ...chat, _type: 'chat' })} className="group flex items-center px-4 py-3 hover:bg-white/[0.03] rounded-xl cursor-pointer transition-colors">
                      <div className="flex-1 flex items-center gap-3 truncate pr-4"><MessageSquare size={16} className="text-indigo-400 opacity-70" /><span className="text-sm text-zinc-200 font-medium truncate">{chat.title}</span></div>
                      <div className="w-32 text-right text-xs text-zinc-500 font-mono">{new Date(chat.updatedAt).toLocaleDateString()}</div>
                    </div>
                  ))}

                  {adminViewTab === 'workflows' && viewingUserChats.workflows.map((wf: any) => (
                    <div key={wf.id} onClick={() => setViewingSpecificChat({ ...wf, _type: 'workflow' })} className="group flex items-center px-4 py-3 hover:bg-white/[0.03] rounded-xl cursor-pointer transition-colors">
                      <div className="flex-1 flex items-center gap-3 truncate pr-4"><Puzzle size={16} className="text-indigo-400 opacity-70" /><span className="text-sm text-zinc-200 font-medium truncate">{wf.title}</span><span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md border border-indigo-500/20">{wf.workflowId}</span></div>
                      <div className="w-32 text-right text-xs text-zinc-500 font-mono">{new Date(wf.updatedAt).toLocaleDateString()}</div>
                    </div>
                  ))}

                  {adminViewTab === 'images' && (
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-3 p-2">
                      {viewingUserChats.images.map((img: any) => (
                        <div key={img.id} onClick={() => setViewingSpecificChat({ ...img, _type: 'image' })} className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group border border-white/10 bg-[#121212]">
                          <img src={img.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                            <p className="text-[10px] text-white line-clamp-2 leading-relaxed">{img.prompt}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {adminViewTab === 'videos' && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-2">
                      {viewingUserChats.videos.map((vid: any) => (
                        <div key={vid.id} onClick={() => setViewingSpecificChat({ ...vid, _type: 'video' })} className="relative aspect-video rounded-xl overflow-hidden cursor-pointer group border border-white/10 bg-black">
                          <video src={vid.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md px-1.5 py-1 rounded-md text-[10px] text-white flex items-center gap-1"><Film size={10}/> {vid.duration || 5}s</div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                            <p className="text-[11px] text-white line-clamp-2 leading-relaxed">{vid.prompt || '[无文本描述]'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 单条详情阅读器 */}
      {viewingSpecificChat && (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setViewingSpecificChat(null)} />
          <div className="relative w-full max-w-4xl bg-[#171717] border border-white/10 rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 fade-in duration-200 h-[85vh] overflow-hidden">
            <div className="flex flex-col p-4 border-b border-white/5 bg-[#1a1a1a]">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <button onClick={() => setViewingSpecificChat(null)} className="p-1 text-zinc-500 hover:text-white rounded-lg transition-colors"><ArrowLeft size={18} /></button>
                  <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                    {viewingSpecificChat._type === 'chat' ? <MessageSquare size={18} className="text-indigo-400" /> :
                     viewingSpecificChat._type === 'workflow' ? <Puzzle size={18} className="text-indigo-400" /> :
                     viewingSpecificChat._type === 'image' ? <ImageIcon size={18} className="text-indigo-400" /> :
                     <Film size={18} className="text-indigo-400" />}
                    {viewingSpecificChat.title || '生成媒体详情'}
                  </h2>
                </div>
                
                <div className="flex items-center gap-2">
                  <button onClick={handleDownloadSpecificRecord} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg transition-all text-sm font-bold border border-indigo-500/30 shadow-lg">
                    <Download size={14} /> 立即下载
                  </button>
                  <button onClick={() => { setViewingSpecificChat(null); setViewingUserChats(null); }} className="p-1.5 text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"><X size={18} /></button>
                </div>
              </div>
              <div className="text-[11px] text-zinc-500 font-mono ml-9 flex gap-3">
                {(viewingSpecificChat._type === 'chat' || viewingSpecificChat._type === 'image' || viewingSpecificChat._type === 'video') && <span>Model: {viewingSpecificChat.model}</span>}
                {viewingSpecificChat._type === 'workflow' && <span>Engine: {viewingSpecificChat.workflowId}</span>}
                {(viewingSpecificChat._type === 'image' || viewingSpecificChat._type === 'video') && <span>Ratio: {viewingSpecificChat.ratio}</span>}
                <span>Time: {new Date(viewingSpecificChat.updatedAt || viewingSpecificChat.timestamp).toLocaleString()}</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#121212]">
              {(viewingSpecificChat._type === 'chat' || viewingSpecificChat._type === 'workflow') && (
                <div className="max-w-3xl mx-auto space-y-6">
                  {viewingSpecificChat.messages.map((m: any, i: number) => (
                    <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {m.role !== 'user' && <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 text-zinc-400 flex-shrink-0 mt-1"><Bot size={16}/></div>}
                      <div className={`max-w-[85%] rounded-2xl px-5 py-3 ${m.role === 'user' ? 'bg-[#2f2f2f] text-zinc-100 border border-white/5' : 'text-zinc-300 bg-transparent'}`}>
                        <ReactMarkdown components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <div className="my-4 rounded-lg overflow-hidden border border-white/5"><SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter></div>
                            ) : ( <code className={`${className} bg-zinc-800 rounded px-1.5 py-0.5 text-zinc-200 font-mono text-sm`} {...props}>{children}</code> );
                          }
                        }}>
                          {typeof m.content === 'string' ? m.content : '[多模态图文记录，暂不支持预览]'}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {viewingSpecificChat._type === 'image' && (
                <div className="flex flex-col items-center justify-center min-h-full gap-6 max-w-3xl mx-auto pb-10">
                  <img src={viewingSpecificChat.url} className="max-w-full max-h-[60vh] object-contain rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10" />
                  <div className="w-full bg-[#1e1e1e] p-5 rounded-2xl border border-white/5 text-sm text-zinc-300 leading-relaxed shadow-xl">
                    <div className="flex items-center gap-2 mb-3 text-zinc-500 font-bold uppercase text-xs tracking-wider"><PenTool size={14}/> Prompt (提示词)</div>
                    {viewingSpecificChat.prompt}
                  </div>
                </div>
              )}

              {viewingSpecificChat._type === 'video' && (
                <div className="flex flex-col items-center justify-center min-h-full gap-6 max-w-3xl mx-auto pb-10">
                  <video src={viewingSpecificChat.url} controls autoPlay loop className="max-w-full max-h-[60vh] object-contain rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 bg-black" />
                  <div className="w-full bg-[#1e1e1e] p-5 rounded-2xl border border-white/5 text-sm text-zinc-300 leading-relaxed shadow-xl">
                    <div className="flex items-center gap-2 mb-3 text-zinc-500 font-bold uppercase text-xs tracking-wider"><Clapperboard size={14}/> Prompt & Mode</div>
                    <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded text-xs mr-2 font-mono">{viewingSpecificChat.mode}</span>
                    {viewingSpecificChat.prompt || '[该视频仅使用参考图生成，无文本描述]'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}