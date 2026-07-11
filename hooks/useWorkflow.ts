// /hooks/useWorkflow.ts
import { useState, useMemo } from 'react';
import { fetchApi } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { WfSession, AttachedFile } from '@/lib/types';
import { WORKFLOW_REGISTRY } from '@/lib/constants';

export function useWorkflow(
  attachedFile: AttachedFile | null,
  setAttachedFile: React.Dispatch<React.SetStateAction<AttachedFile | null>>
) {
  const { setToastMsg } = useAppStore();

  const [isWorkflowMenuOpen, setIsWorkflowMenuOpen] = useState(false);
  const [activeWfCategory, setActiveWfCategory] = useState<string>('all');
  const [activeWfId, setActiveWfId] = useState<string | null>(null);
  const [wfFormValues, setWfFormValues] = useState<Record<string, any>>({});
  const [isWfRunning, setIsWfRunning] = useState(false);
  const [wfInput, setWfInput] = useState("");
  
  // 规避截断，加了空格
  const [wfSessions, setWfSessions] = useState<WfSession[]>([]);
  const [activeWfSessionId, setActiveWfSessionId] = useState<string | null>(null);
  const [isWfHistoryMenuOpen, setIsWfHistoryMenuOpen] = useState(false);

  const currentWfSession = useMemo(() => wfSessions.find(s => s.id === activeWfSessionId) || null, [wfSessions, activeWfSessionId]);
  const wfMessages = currentWfSession?.messages || [ ];
  const activeWorkflowData = WORKFLOW_REGISTRY.find(w => w.id === activeWfId);

  const handleWfFileUpload = (e: React.ChangeEvent<HTMLInputElement>, inputKey: string) => {
    const file = e.target.files?.[0]; 
    if (!file) return;
    
    if (file.name.match(/\.(docx)$/i)) {
      setToastMsg(`正在智能提取 ${file.name} 的文字，请稍候...`);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const b64Data = event.target?.result as string;
          // 👇 享受 api.ts 海关带来的红利，不用管 token 和报错
          const res = await fetchApi('/v1/utils/parse_doc', { 
            method: 'POST', 
            body: JSON.stringify({ filename: file.name, b64_data: b64Data }) 
          });
          const data = await res.json();
          if (data.text) { 
            setWfFormValues(prev => ({ ...prev, [inputKey]: data.text })); 
            setToastMsg(`✅ ${file.name} 提取成功，已填入表单！`); 
          } else { 
            setToastMsg(`解析失败: ${data.error?.message || '文件损坏'}`);
          }
        } catch(err) {
          setToastMsg("网络请求失败，无法解析文档");
        }
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('image/') || file.type.startsWith('text/')) {
      const reader = new FileReader(); 
      reader.onload = (event) => setWfFormValues(prev => ({ ...prev, [inputKey]: event.target?.result as string })); 
      reader.readAsDataURL(file);
    } else { 
      setToastMsg(`暂不支持直接解析该格式，请上传 Word(.docx)、TXT 或图片。`); 
    }
  };

  const handleRunWorkflow = async (isChat: boolean = false, chatText: string = "") => {
    if (!activeWorkflowData) return;
    if (isChat && !chatText.trim() && !attachedFile) return;
    setIsWfRunning(true);
    let userMsgContent: any = "";
    
    if (isChat) {
      if (attachedFile) {
        if (attachedFile.isImage || attachedFile.data.startsWith('data:image')) {
          userMsgContent = [ { type: "text", text: chatText || `分析图片: ${attachedFile.name}` }, { type: "image_url", image_url: { url: attachedFile.data } } ];
        } else {
          userMsgContent = [ { type: "text", text: chatText || `分析文件: ${attachedFile.name}` }, { type: "image_url", image_url: { url: `file-text:${attachedFile.name}`, _fileData: attachedFile.data } } ];
        }
      } else { userMsgContent = chatText; }
      setWfInput(""); setAttachedFile(null); 
    } else {
      const inputSummary = Object.entries(wfFormValues).filter(([_, v]) => v).map(([k, v]) => `${activeWorkflowData.inputs.find((i:any)=>i.key===k)?.label || k}: ${v}`).join('\n');
      userMsgContent = inputSummary ? `[应用配置]\n${inputSummary}` : `启动了 ${activeWorkflowData.name}`;
    }
    
    let currentSessionId = activeWfSessionId;
    if (!currentSessionId) {
      currentSessionId = Date.now().toString();
      const titleText = typeof userMsgContent === 'string' ? userMsgContent : (userMsgContent.find((p: any) => p.type === 'text')?.text || "发送了文件");
      const newSession: WfSession = { id: currentSessionId, workflowId: activeWorkflowData.id, title: titleText.substring(0, 15) + (titleText.length > 15 ? "..." : ""), messages: [ ], updatedAt: Date.now() };
      setWfSessions(prev => [newSession, ...prev]); 
      setActiveWfSessionId(currentSessionId);
    }
    
    setWfSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) return { ...s, messages: [...s.messages, { role: 'user', content: userMsgContent }, { role: 'assistant', content: "" }], updatedAt: Date.now() };
      return s;
    }));
    
    const existingHistory = wfSessions.find(s => s.id === currentSessionId)?.messages || [ ];
    const messagesToSend = [...existingHistory, { role: 'user', content: userMsgContent }];
    const apiMessages = messagesToSend.map(m => {
      if (Array.isArray(m.content)) {
        return { 
          ...m, 
          content: m.content.map((part:any) => {
            if (part.type === 'image_url' && part.image_url._fileData) return { type: "text", text: `\n\n【用户附件内容】\n\`\`\`\n${part.image_url._fileData}\n\`\`\`\n` };
            if (part.type === 'image_url') return { type: "image_url", image_url: { url: part.image_url.url } };
            return part;
          })
        };
      }
      return m;
    });

    try {
      const response = await fetchApi('/v1/workflows/run', {
        method: 'POST', 
        body: JSON.stringify({ workflow_id: activeWorkflowData.id, engine: activeWorkflowData.engine, inputs: wfFormValues, query: "", history: apiMessages }),
      });
      
      const reader = response.body?.getReader(); 
      const decoder = new TextDecoder(); 
      let buffer = ""; 
      let assistantContent = "";
      
      if (!reader) return;

      // 🚀 工作流专属 40ms 节流魔法
      let lastUpdateTime = Date.now();

      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true }); 
        let parts = buffer.split('\n\n'); 
        buffer = parts.pop() || "";
        
        let hasUpdate = false;

        for (const part of parts) {
          const line = part.trim();
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const delta = JSON.parse(line.substring(6)).choices[0]?.delta?.content || ""; 
              if (delta) {
                assistantContent += delta;
                hasUpdate = true;
              }
            } catch (e) {}
          }
        }

        if (hasUpdate) {
          const now = Date.now();
          if (now - lastUpdateTime > 40) {
            setWfSessions(prev => prev.map(s => {
              if (s.id === currentSessionId) { const newMsgs = [...s.messages]; newMsgs[newMsgs.length - 1].content = assistantContent; return { ...s, messages: newMsgs, updatedAt: Date.now() }; }
              return s;
            }));
            lastUpdateTime = now;
          }
        }
      }
      
      // 兜底补齐最后的数据
      setWfSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) { const newMsgs = [...s.messages]; newMsgs[newMsgs.length - 1].content = assistantContent; return { ...s, messages: newMsgs, updatedAt: Date.now() }; }
        return s;
      }));

    } catch (error: any) {
      if (error.message === "Insufficient Balance" || error.message === "Unauthorized" || error.message === "Forbidden") {
         setWfSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: s.messages.slice(0, -1) } : s));
      } else {
         setWfSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) { const newMsgs = [...s.messages]; newMsgs[newMsgs.length - 1].content = "工作流执行失败，请检查后端引擎配置。"; return { ...s, messages: newMsgs }; }
          return s;
        }));
      }
    } finally { 
      setIsWfRunning(false); 
    }
  };

  return {
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
  };
}