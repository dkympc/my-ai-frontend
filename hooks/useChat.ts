// /hooks/useChat.ts
import { useState, useRef, useMemo } from 'react';
import { fetchApi } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { showPrompt } from '@/lib/dialogStore';
import { ChatSession, ChatMessage, AttachedFile } from '@/lib/types';
import { MODELS } from '@/lib/constants';

export function useChat(
  sessions: ChatSession[],
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>,
  attachedFile: AttachedFile | null,
  setAttachedFile: React.Dispatch<React.SetStateAction<AttachedFile | null>>,
  forceSyncToServer: () => void
) {
  const { settings, setToastMsg, activeView, setActiveView } = useAppStore();

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [defaultModel, setDefaultModel] = useState('gemini-3.5-flash');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null); 
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const stopTyping = () => {
    abortControllerRef.current?.abort();
    setIsTyping(false);
  };

  const processAndAttachFile = (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isText = file.type.startsWith('text/') || file.name.match(/\.(md|csv|json|js|ts|py|html|css|txt)$/i);
    const isDocx = file.name.match(/\.(docx)$/i);
    const isOtherDoc = file.name.match(/\.(doc|pdf|ppt|pptx|xls|xlsx)$/i);
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img; const MAX_SIZE = 1200; 
          if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } 
          else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
          canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx?.drawImage(img, 0, 0, width, height);
          const compressedData = canvas.toDataURL('image/jpeg', 0.8);
          setAttachedFile({ name: file.name, type: file.type, size: file.size, data: compressedData, isImage: true });
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else if (isText) {
      const reader = new FileReader();
      reader.onload = (event) => setAttachedFile({ name: file.name, type: 'text/plain', size: file.size, data: event.target?.result as string, isImage: false });
      reader.readAsText(file);
    } else if (isDocx) {
      setToastMsg(`正在智能提取 ${file.name} 的文字，请稍候...`);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const b64Data = event.target?.result as string;
          const res = await fetchApi('/v1/utils/parse_doc', { method: 'POST', body: JSON.stringify({ filename: file.name, b64_data: b64Data }) });
          const data = await res.json();
          if (data.text) { setAttachedFile({ name: file.name, type: 'text/plain', size: file.size, data: data.text, isImage: false }); setToastMsg(`✅ ${file.name} 解析成功！`); } 
          else setToastMsg(`解析失败: ${data.error?.message || '文件损坏'}`);
        } catch (e) {
          setToastMsg("网络请求失败，无法解析文档");
        }
      };
      reader.readAsDataURL(file);
    } else if (isOtherDoc) {
      setToastMsg(`暂不支持直接解析 ${file.name.split('.').pop()} 格式，请另存为 .docx 或 .txt 格式。`);
    } else {
      setToastMsg(`不支持解析该文件类型，请上传图片或文档。`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; 
    if (file) processAndAttachFile(file); 
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (activeView !== 'chat') return;
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i]; if (item.kind === 'file') { const file = item.getAsFile(); if (file) processAndAttachFile(file); }
    }
  };

  const handleOpenMenu = (e: React.MouseEvent, sessionId: string) => { e.stopPropagation(); setActiveMenuId(sessionId); };
  const handleModelChange = (e: React.MouseEvent, modelId: string) => { e.stopPropagation(); setDefaultModel(modelId); if (currentSessionId) setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, model: modelId } : s)); setIsModelMenuOpen(false); };
  
  const handleNewChat = () => { 
    setActiveView('chat'); 
    if (sessions.length > 0 && sessions[0].messages.length === 0) { setCurrentSessionId(sessions[0].id); return; } 
    const newId = Date.now().toString(); 
    const newSession: ChatSession = { id: newId, title: "新对话", messages: [ ], updatedAt: Date.now(), model: defaultModel }; 
    setSessions(prev => [newSession, ...prev]); 
    setCurrentSessionId(newId); 
  };
  
  const triggerDelete = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setSessionToDeleteId(id); setIsDeleteModalOpen(true); setActiveMenuId(null); };
  
  const confirmDelete = () => { 
    if (sessionToDeleteId) { 
      if (isTyping && sessionToDeleteId === currentSessionId) stopTyping();
      setSessions(prev => prev.filter(s => s.id !== sessionToDeleteId)); 
      if (currentSessionId === sessionToDeleteId) setCurrentSessionId(null); 
      setIsDeleteModalOpen(false); setSessionToDeleteId(null); 
    } 
  };
  
  const renameSession = async (id: string, e: React.MouseEvent) => { e.stopPropagation(); const newTitle = await showPrompt("重命名会话", "输入新的标题："); if (newTitle) setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s)); setActiveMenuId(null); };
  
  const generateAutoTitle = async (sessionId: string, userMsg: string, aiMsg: string, model: string) => {
    try {
      const response = await fetchApi('/v1/chat/completions', {
        method: 'POST', 
        body: JSON.stringify({ model: model, messages: [ { role: "system", content: "你是一个标题生成助手。请根据用户的提问和你的回答，生成一个 15-20 字左右的专业标题。要求：涵盖核心意图，不要过于缩减，不要包含标点符号，直接输出标题。" }, { role: "user", content: `用户问：${userMsg}\nAI答：${aiMsg}` } ], stream: false }),
      });
      const data = await response.json(); const newTitle = data.choices[0]?.message?.content?.replace(/[#*\"'思维导图“”]/g, '').trim();
      if (newTitle) setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s));
    } catch (e) { console.error("生成标题失败", e); }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [ ];
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
             const start = Math.max(0, idx - 15); const end = Math.min(text.length, idx + query.length + 15);
             snippet = (start > 0 ? "..." : "") + text.substring(start, end).replace(/\n/g, ' ') + (end < text.length ? "..." : "");
           } else snippet = text.substring(0, 40).replace(/\n/g, ' ') + "...";
        }
        return { ...session, matchCount: matchingMessages.length, snippet };
      }
      return null;
    }).filter(Boolean);
  }, [searchQuery, sessions]);

  const currentSession = useMemo(() => sessions.find(s => s.id === currentSessionId) || null, [sessions, currentSessionId]);
  const currentModelId = currentSession?.model || defaultModel;
  const messages = currentSession?.messages || [ ];
  const isChatStarted = messages.length > 0;

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if ((!textToSend.trim() && !attachedFile) || isTyping) return;
    
    let activeId = currentSessionId;
    let targetModel = currentModelId;
    
    if (!activeId) {
      const newId = Date.now().toString();
      const newSession: ChatSession = { id: newId, title: "正在生成标题...", messages: [ ], updatedAt: Date.now(), model: defaultModel };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newId); activeId = newId; targetModel = defaultModel;
    }
    
    let userContent: any = textToSend;
    if (attachedFile) {
      if (attachedFile.isImage || (attachedFile.data.startsWith('data:image'))) {
        userContent = [ { type: "text", text: textToSend || `分析图片: ${attachedFile.name}` }, { type: "image_url", image_url: { url: attachedFile.data } } ];
      } else {
        userContent = [ { type: "text", text: textToSend || `分析文件: ${attachedFile.name}` }, { type: "image_url", image_url: { url: `file-text:${attachedFile.name}`, _fileData: attachedFile.data } } ];
      }
    }
    
    const userMessage: ChatMessage = { role: 'user', content: userContent };
    const currentFullHistory = [...(sessions.find(s => s.id === activeId)?.messages || [ ]), userMessage];
    
    setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages, userMessage, { role: 'assistant', content: "" }], updatedAt: Date.now() } : s));
    setInput(""); setAttachedFile(null); setIsTyping(true);
    
    // 🚀 核心：初始化专属穿透通道
    useAppStore.getState().setStreamText("");
    
    const sysPrompt = settings.modelSystemPrompts[targetModel] || settings.globalSystemPrompt;
    const apiMessages = currentFullHistory.map(m => {
      if (Array.isArray(m.content)) {
        return { ...m, content: m.content.map((part:any) => {
          if (part.type === 'image_url' && part.image_url._fileData) return { type: "text", text: `\n\n【用户附件内容】\n\`\`\`\n${part.image_url._fileData}\n\`\`\`\n` };
          if (part.type === 'image_url') return { type: "image_url", image_url: { url: part.image_url.url } };
          return part;
        })};
      }
      return m;
    });
    
    const payload: any = { 
      model: targetModel, messages: apiMessages, user_system_prompt: sysPrompt, 
      stream: true, temperature: settings.temperature, top_p: settings.topP,
      // ★ 关闭 DeepSeek 思考模式：仅对 DeepSeek 系列模型生效，GPT 等其他模型不支持此参数格式
      ...(targetModel?.includes('deepseek') ? { thinking: { type: "disabled" } } : {})
    };
    if (isWebSearchEnabled) {
      payload.search = true; payload.enable_search = true; payload.network = true; 
      if (targetModel.toLowerCase().includes('gemini')) payload.tools = [{ type: "google_search" }, { type: "googleSearch" }];
    }
    if (settings.maxTokens) payload.max_tokens = parseInt(settings.maxTokens as string);
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetchApi('/v1/chat/completions', { method: 'POST', body: JSON.stringify(payload), signal: abortControllerRef.current.signal });
      const reader = response.body?.getReader(); 
      const decoder = new TextDecoder(); 
      let finalContent = ""; 
      let buffer = ""; 
      
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read(); 
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true }); 
        const lines = buffer.split('\n'); 
        buffer = lines.pop() || ""; 

        let hasUpdate = false;
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
            try {
              const dataStr = trimmed.substring(6);
              if (dataStr === '[DONE]') continue;
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                finalContent += delta;
                hasUpdate = true;
              }
            } catch (e) {}
          }
        }
        
        if (hasUpdate) {
          // ⚡ 状态穿透：直接丢给气泡组件，此时页面处于完全静止状态！
          useAppStore.getState().setStreamText(finalContent);
        }
      }

      // 🏁 吐字彻底结束后，做唯一一次全局写入
      setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages.slice(0, -1), { role: 'assistant', content: finalContent }] } : s));
      useAppStore.getState().setStreamText(""); // 清理通道

      if (messages.length === 0) generateAutoTitle(activeId!, textToSend, finalContent, targetModel);
    } catch (error: any) { 
      // 错误打断时，也要提取已有的半截句子
      const currentStream = useAppStore.getState().streamText;
      if (error.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
         setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages.slice(0, -1), { role: 'assistant', content: currentStream + " [已主动中断]" }] } : s));
      } else if (error.message === "Insufficient Balance") {
         setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: s.messages.slice(0, -1) } : s));
      } else if (error.message === "Forbidden") {
         setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages.slice(0, -1), { role: 'assistant', content: currentStream + `\n\n🚨 **拦截提醒**：无权限` }] } : s));
      } else {
         setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages.slice(0, -1), { role: 'assistant', content: currentStream + "\n\n消息发送失败，请检查网络或后端配置。" }] } : s));
      }
      useAppStore.getState().setStreamText(""); 
    } finally {
       setIsTyping(false); 
       setTimeout(() => forceSyncToServer(), 100); 
    }
  };

  return {
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
  };
}