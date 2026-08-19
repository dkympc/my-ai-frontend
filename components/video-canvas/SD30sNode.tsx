'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import { useCanvasEngine } from '@/hooks/useCanvasEngine';
import type { SD30sNodeData, ShotItem } from '@/lib/types';
import { ChevronDown, ChevronRight, Copy, FileText, Sparkles, Map, CheckCircle2, Loader2, Maximize, Minimize, Download, X, ImageIcon, MessageSquare, Send, BookText, Settings2 } from 'lucide-react';
import { fetchApi } from '@/services/api';

const nodeBaseClass = "glass-card glass-card-hover";
const selectedBorderClass = "glass-card-selected";
const handleBase = "!w-[24px] !h-[24px] !bg-transparent !border-none !rounded-full opacity-0 group-hover:opacity-100 z-50 flex items-center justify-center relative before:absolute before:content-[''] before:w-[12px] before:h-[12px] before:bg-white before:rounded-full before:border-[3px] before:border-[#18181b] before:shadow-[0_0_15px_rgba(255,255,255,0.9)] before:transition-all hover:before:scale-125 transition-opacity duration-300";
const handleLeft = `${handleBase} !-left-[12px]`;
const handleRight = `${handleBase} !-right-[12px]`;

interface SD30sNodeProps {
  id: string;
  data: SD30sNodeData & { selectedText?: string; fullText?: string };
  selected?: boolean;
}

function parseShotsFromText(text: string): ShotItem[] {
  const shots: ShotItem[] = [];
  // 优先匹配新格式：2-5秒：描述（无镜头N）
  const newShotRegex = /(\d+-\d+秒)[：:]\s*([\s\S]*?)(?=\n\d+-\d+秒[：:]|\n【负面提示词】|\n【禁止项】|\n【全局锁定】|$)/g;
  let match;
  let shotNum = 1;
  let found = false;
  while ((match = newShotRegex.exec(text)) !== null) {
    found = true;
    const content = match[2].trim();
    const dialogueMatch = content.match(/"(.*?)"/);
    shots.push({ number: shotNum++, shotType: content.split(/[，,]/)[0] || '', content, dialogue: dialogueMatch ? dialogueMatch[1] : undefined, duration: match[1] });
  }
  // 没匹配到新格式 → 回退旧格式：镜头N（X-Y秒）：描述 或 镜头N：描述
  if (!found) {
    const oldShotRegex = /镜头(\d+)(?:（([^）]*)）)?[：:]\s*([\s\S]*?)(?=\n镜头\d+(?:（[^）]*）)?[：:]|\n【禁止项】|\n【全局锁定】|$)/g;
    while ((match = oldShotRegex.exec(text)) !== null) {
      const num = parseInt(match[1]);
      const duration = match[2];
      const content = match[3].trim();
      const dialogueMatch = content.match(/"(.*?)"/);
      shots.push({ number: num, shotType: content.split(/[，,]/)[0] || '', content, dialogue: dialogueMatch ? dialogueMatch[1] : undefined, duration: duration || undefined });
    }
  }
  return shots;
}

/** 从30s表演提示词文本中提取各段落（适配 Seedance 2.5 新格式） */
function extractSections(text: string): {
  missionTask: string;
  mainSubjects: string;
  sceneState: string;
  emotionalGoal: string;
  shotsText: string;
  negativePrompt: string;
} {
  const missionMatch = text.match(/【本次任务】([\s\S]*?)(?=【主要主体】|$)/);
  const subjectsMatch = text.match(/【主要主体】([\s\S]*?)(?=【场景与环境状态】|$)/);
  const sceneMatch = text.match(/【场景与环境状态】([\s\S]*?)(?=【情绪目标】|$)/);
  const emotionMatch = text.match(/【情绪目标】([\s\S]*?)(?=【分段脚本】|$)/);
  const shotMatch = text.match(/【分段脚本】([\s\S]*?)(?=【负面提示词】|$)/);
  const negativeMatch = text.match(/【负面提示词】([\s\S]*?)$/);
  return {
    missionTask: missionMatch ? missionMatch[1].trim() : '',
    mainSubjects: subjectsMatch ? subjectsMatch[1].trim() : '',
    sceneState: sceneMatch ? sceneMatch[1].trim() : '',
    emotionalGoal: emotionMatch ? emotionMatch[1].trim() : '',
    shotsText: shotMatch ? shotMatch[1].trim() : '',
    negativePrompt: negativeMatch ? negativeMatch[1].trim() : '',
  };
}

/** 从定场图文本中提取场景列表 */
function parseScenes(text: string): { name: string; content: string }[] {
  const sceneRegex = /【场景\d*[：:]\s*([^】]+)】([\s\S]*?)(?=【场景\d*[：:]|$)/g;
  const scenes: { name: string; content: string }[] = [];
  let match;
  while ((match = sceneRegex.exec(text)) !== null) {
    scenes.push({ name: match[1].trim(), content: match[2].trim() });
  }
  return scenes;
}

/** 获取指定模型支持的画质选项 */
function getImageQualityOptions(model: string) {
  if (model === 'seedream5.0') {
    return [
      { value: '2K', label: '2K (高清)' },
      { value: '3K', label: '3K (极致)' }
    ];
  }
  if (model === 'banana-pro') {
    return [
      { value: '1K', label: '1K (标准)' },
      { value: '2K', label: '2K (高清)' },
      { value: '4K', label: '4K (极致)' }
    ];
  }
  return [{ value: '1K', label: '1K (标准)' }];
}

/** 液态玻璃风格自定义下拉菜单 */
function CustomSelect({ value, options, onChange, className = "" }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((o: any) => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div onClick={() => setIsOpen(!isOpen)}
        className={`relative w-full flex items-center justify-between rounded-full px-3 py-1.5 text-[11px] font-medium cursor-pointer transition-all duration-300 ${isOpen ? 'bg-white/10 text-white' : 'bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>
        <span className="truncate relative z-10 flex-1 text-left">{selectedOption?.label}</span>
        <ChevronDown size={12} className="text-zinc-600 relative z-10 ml-1 shrink-0" />
      </div>
      <div className={`absolute top-full left-0 pt-2 z-[99999] transition-all duration-300 ${isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
        onClick={e => e.stopPropagation()}>
        <div className="bg-[#050505]/95 backdrop-blur-3xl border border-white/10 rounded-[16px] shadow-[0_40px_100px_rgba(0,0,0,0.95)] py-1.5 px-1 min-w-[140px]">
          {options.map((opt: any) => (
            <div key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`px-3.5 py-2.5 mx-1 text-[11px] font-medium cursor-pointer rounded-[10px] transition-colors ${value === opt.value ? 'text-white bg-white/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
              {opt.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const _SD30sNode = ({ id, data, selected }: SD30sNodeProps) => {
  const { setNodes, setEdges } = useReactFlow();
  const { executeTopDownAnalysis, executeTopDownImageGen, executeEmotionTask, executePerformTask } = useCanvasEngine();
  const storeRef = useRef(useAppStore.getState());
  useEffect(() => { storeRef.current = useAppStore.getState(); }, []);

  // 选中文本（从节点创建时传入）
  const selectedText = data.selectedText || '';
  const fullText = data.fullText || '';
  // ★ 预览对话中的分段方案摘要（使用 ref 实时读取 data，不冻结初始值）
  const dialogueContextRef = useRef((data as any).dialogueContext || '');
  // 每次渲染同步最新值
  dialogueContextRef.current = (data as any).dialogueContext || '';

  // ——— 面板折叠状态 ———
  const [topDownExpanded, setTopDownExpanded] = useState(true);
  const [emotionExpanded, setEmotionExpanded] = useState(true);
  const [performExpanded, setPerformExpanded] = useState(true);
  const [shotsExpanded, setShotsExpanded] = useState(false);
  // ★ 拆分三个独立的 loading 状态，互不干扰
  const [topDownLoading, setTopDownLoading] = useState(false);
  const [emotionLoading, setEmotionLoading] = useState(false);
  const [performLoading, setPerformLoading] = useState(false);

  // ——— 第0步：定场图状态 ———
  const [topDownText, setTopDownText] = useState((data as any)._topDownText || '');
  const [topDownEditable, setTopDownEditable] = useState((data as any)._topDownText || '');
  const [sceneImages, setSceneImages] = useState<Record<string, { abstractUrl: string; realisticUrl: string }>>({});
  const [activeScene, setActiveScene] = useState(0);

  // ——— 第1步：情绪分析状态 ———
  const [emotionText, setEmotionText] = useState((data as any)._emotionText || data.emotionScript?.rawAnalysis || '');
  const [emotionEditable, setEmotionEditable] = useState((data as any)._emotionText || data.emotionScript?.rawAnalysis || '');

  // ——— 第2步：表演提示词状态 ———
  const [performText, setPerformText] = useState((data as any)._performText || '');
  const [editablePerform, setEditablePerform] = useState((data as any)._performText || '');

  // ★ 持久化辅助：将中间状态写入 node.data
  const saveToNodeData = useCallback((partial: Record<string, any>) => {
    setNodes((nds: any) => nds.map((n: any) =>
      n.id === id ? { ...n, data: { ...n.data, ...partial } } : n
    ));
  }, [id, setNodes]);

  // ——— 定场图生图参数（用户自选，参考生图节点） ———
  const [imageModel, setImageModel] = useState(data.imageModel || 'gpt-image-2');
  const [imageQuality, setImageQuality] = useState(data.imageQuality || '1K');
  const [imageRatio, setImageRatio] = useState(data.imageRatio || '16:9');
  const [imageStyle, setImageStyle] = useState(data.imageStyle || '继承全局预设');
  // 切换模型时自动重置画质到兼容值
  const handleImageModelChange = useCallback((model: string) => {
    setImageModel(model);
    let nextQuality = imageQuality;
    if (model === 'seedream5.0' && !['2K', '3K'].includes(nextQuality)) nextQuality = '2K';
    else if (model === 'banana-pro' && !['1K', '2K', '4K'].includes(nextQuality)) nextQuality = '2K';
    else if (model === 'gpt-image-2') nextQuality = '1K';
    setImageQuality(nextQuality);
    saveToNodeData({ imageModel: model, imageQuality: nextQuality });
  }, [imageQuality, saveToNodeData]);

  // ★ 齿轮设置面板：点击切换，保持打开直到用户点外面关闭
  const [configOpen, setConfigOpen] = useState(false);
  const configRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (configRef.current && !configRef.current.contains(e.target as Node)) {
        setConfigOpen(false);
      }
    };
    if (configOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [configOpen]);

  // ——— 全屏编辑器 (zenMode) ———
  const [zenMode, setZenMode] = useState<{ text: string; onChange: (t: string) => void; title: string } | null>(null);

  // ——— 图片预览 ———
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // ——— 统一对话助手 ———
  const [chatOpen, setChatOpen] = useState(false);
  // ★ 对话记录绑定节点 data（节点消失 → 记录消失）
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>((data as any)._chatMessages || []);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  // 持久化对话记录到 node.data
  const saveChatMessages = useCallback((messages: { role: string; content: string }[]) => {
    setChatMessages(messages);
    saveToNodeData({ _chatMessages: messages });
  }, [saveToNodeData]);

  // ======== 第0步：定场图分析（只出文本，接收全文+选中片段） ========
  const handleGenerateTopDownAnalysis = useCallback(async () => {
    if (!selectedText) {
      useAppStore.getState().setToastMsg('⚠️ 无选中文本，请在主控节点框选剧本');
      return;
    }
    setTopDownLoading(true);
    // 传给 LLM：全文（用于理解空间站位）+ 选中片段（用于分镜）
    const combinedText = fullText
      ? `【剧本全文】\n${fullText}\n\n【本次需分析的选中片段】\n${selectedText}`
      : selectedText;
    await executeTopDownAnalysis(
      combinedText,
      storeRef.current.canvasSettings,
      () => { setTopDownText(''); setTopDownEditable(''); setSceneImages({}); setActiveScene(0); },
      (resultText) => { setTopDownText(resultText); setTopDownEditable(resultText); setTopDownLoading(false); saveToNodeData({ _topDownText: resultText }); },
      (msg) => { setTopDownLoading(false); useAppStore.getState().setToastMsg(`❌ ${msg}`); }
    );
  }, [selectedText, fullText, executeTopDownAnalysis, saveToNodeData]);

  // ======== 第0步-生图：为指定场景生成定场图（抽象拓扑 + 白模布局） ========
  const handleGenerateTopDownImage = useCallback(async (sceneDesc: string, sceneName: string) => {
    console.log("[SD30s 生图] 当前参数:", { imageModel, imageQuality, imageRatio, imageStyle });
    setTopDownLoading(true);
    await executeTopDownImageGen(
      sceneDesc,
      sceneName,
      (abstractUrl, whiteModelUrl) => {
        setSceneImages(prev => ({ ...prev, [sceneName]: { abstractUrl, realisticUrl: whiteModelUrl } }));
        setTopDownLoading(false);
      },
      (msg) => { setTopDownLoading(false); useAppStore.getState().setToastMsg(`❌ ${msg}`); },
      // ★ 传入用户自选的生图参数
      { model: imageModel, quality: imageQuality, ratio: imageRatio, styleOverride: imageStyle }
    );
  }, [executeTopDownImageGen, imageModel, imageQuality, imageRatio, imageStyle]);

  // ======== 第1步：情绪分析 ========
  const handleGenerateEmotion = useCallback(async () => {
    if (!selectedText) {
      useAppStore.getState().setToastMsg('⚠️ 无选中文本');
      return;
    }
    setEmotionLoading(true);
    await executeEmotionTask(
      selectedText,
      storeRef.current.canvasSettings,
      '',
      () => { setEmotionText(''); setEmotionEditable(''); },
      (resultText) => { setEmotionText(resultText); setEmotionEditable(resultText); setEmotionLoading(false); saveToNodeData({ _emotionText: resultText }); },
      (msg) => { setEmotionLoading(false); useAppStore.getState().setToastMsg(`❌ ${msg}`); }
    );
  }, [selectedText, executeEmotionTask, saveToNodeData]);

  // ======== 第2步：表演提示词（接收情绪分析 + 空间分析 + 预览对话摘要） ========
  const handleGeneratePerform = useCallback(async () => {
    if (!selectedText) {
      useAppStore.getState().setToastMsg('⚠️ 无选中文本');
      return;
    }
    setPerformLoading(true);
    // 构造 user_content：选中文本标记为唯一优先级，情绪分析降级为参考
    const emotionCtx = emotionEditable || emotionText;
    let userContent = emotionCtx
      ? `【★ 唯一优先级 — 剧本原文（所有台词必须从此提取）】\n${selectedText}\n\n【参考信息 — 情绪分析（仅用于理解情绪基调，不得用于新增内容）】\n${emotionCtx}`
      : `【★ 唯一优先级 — 剧本原文】\n${selectedText}`;
    // ★ 传入空间分析内容，让 stage2 知道角色站位
    const spatialCtx = topDownEditable || topDownText;
    // ★ 传入预览对话中的分段方案摘要（从 ref 实时读取，不冻结初始值）
    const dialogueCtx = dialogueContextRef.current;

    await executePerformTask(
      userContent,
      storeRef.current.canvasSettings,
      () => { setPerformText(''); setEditablePerform(''); },
      (resultText) => { setPerformText(resultText); setEditablePerform(resultText); setPerformLoading(false); saveToNodeData({ _performText: resultText }); },
      (msg) => { setPerformLoading(false); useAppStore.getState().setToastMsg(`❌ ${msg}`); },
      spatialCtx,
      dialogueCtx  // ★ 新增：预览对话摘要透传
    );
  }, [selectedText, emotionEditable, emotionText, topDownEditable, topDownText, data, executePerformTask, saveToNodeData]);

  // ======== 确认写入：创建子节点（不覆盖当前节点） ========
  const handleConfirmWrite = useCallback(() => {
    const sections = extractSections(editablePerform);
    const shots = parseShotsFromText(sections.shotsText);
    // 当前节点保留 planning 状态，不清空编辑内容
    // 创建子节点，放在当前节点右侧
    const childId = `sd30s-done-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setNodes((nds: any) => {
      const parentNode = nds.find((n: any) => n.id === id);
      const parentPos = parentNode ? parentNode.position : { x: 0, y: 0 };
      const parentWidth = 720;
      const childNode = {
        id: childId,
        type: 'sd30s',
        position: { x: parentPos.x + parentWidth + 80, y: parentPos.y },
        data: {
          type: 'sd30s',
          title: data.title || '长镜头 30s - seedance 2.5',
          sceneLabel: data.sceneLabel || '',
          status: 'done',
          selectedText: data.selectedText,
          topDownMap: Object.keys(sceneImages).length > 0 ? {
            scenes: sceneImages,
            spaceAnalysis: topDownEditable,
          } : undefined,
          emotionScript: emotionEditable ? {
            protagonistArc: '', opponentEcho: '', coreProp: '', suggestedDialogue: '',
            rawAnalysis: emotionEditable,
          } : undefined,
          performancePrompt: {
            missionTask: sections.missionTask,
            mainSubjects: sections.mainSubjects,
            sceneState: sections.sceneState,
            emotionalGoal: sections.emotionalGoal,
            shots,
            negativePrompt: sections.negativePrompt,
          },
        },
      };
      return [...nds, childNode];
    });
    // 创建连线
    setEdges((eds: any) => [...eds, {
      id: `edge-${id}-${childId}`,
      source: id,
      target: childId,
      type: 'smoothstep',
      animated: true,
    }]);
    setZenMode(null); setImagePreview(null);
    useAppStore.getState().setToastMsg('✅ 长镜头 30s 子节点已生成');
  }, [editablePerform, sceneImages, topDownEditable, emotionEditable, data.title, data.sceneLabel, data.selectedText, id, setNodes, setEdges]);

  // ======== 复制提示词（新格式） ========
  const handleCopyPrompt = useCallback(() => {
    const perf = data.performancePrompt;
    if (!perf) return;
    navigator.clipboard.writeText(
      `【本次任务】\n${perf.missionTask}\n\n【主要主体】\n${perf.mainSubjects}\n\n【场景与环境状态】\n${perf.sceneState}\n\n【情绪目标】\n${perf.emotionalGoal}\n\n【分段脚本】\n${perf.shots.map(s => s.duration ? `${s.duration}：${s.content}` : `镜头${s.number}：${s.content}`).join('\n')}\n\n【负面提示词】\n${perf.negativePrompt}`
    );
    useAppStore.getState().setToastMsg('📋 已复制完整提示词');
  }, [data.performancePrompt]);

  // ======== 导出分镜表 ========
  const handleExport = useCallback(() => {
    const perf = data.performancePrompt;
    if (!perf) return;
    const rows = perf.shots.map(s =>
      `<tr><td>${s.number}</td><td>${s.shotType}</td><td>${s.content.replace(/"/g, '&quot;')}</td><td>${s.dialogue || '-'}</td><td>${s.duration || '-'}</td></tr>`
    ).join('');
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`<html><head><meta charset="utf-8"><title>分镜表</title>
      <style>body{font-family:'Noto Sans SC',sans-serif;padding:20px}
      table{width:100%;border-collapse:collapse}
      th{background:#1a1a1a;color:#fff;padding:12px;text-align:left}
      td{border:1px solid #e0e0e0;padding:10px;vertical-align:top}
      @media print{@page{size:A4 landscape}}</style></head><body>
      <h2>${data.title} - 分镜表</h2>
      <p><strong>本次任务：</strong>${perf.missionTask}</p>
      <p><strong>场景与环境：</strong>${perf.sceneState}</p>
      <p><strong>负面提示词：</strong>${perf.negativePrompt}</p>
      <table><thead><tr><th>镜号</th><th>景别</th><th>描述</th><th>台词</th><th>时长</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
      win.document.close();
    }
  }, [data.performancePrompt, data.title]);

  // ======== 图片下载 ========
  const handleDownloadImage = useCallback(async (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  }, []);

  // ======== 复制图片到画布（创建 MediaNode） ========
  const handleCopyImageToCanvas = useCallback((url: string, label: string) => {
    setNodes((nds: any) => {
      const parentNode = nds.find((n: any) => n.id === id);
      if (!parentNode) return nds;
      const parentPos = parentNode.position;
      const parentWidth = parentNode.measured?.width || 720;
      const newNodeId = `media_ext_${Date.now()}`;
      return [...nds, {
        id: newNodeId, type: 'media',
        position: { x: parentPos.x + parentWidth + 100, y: parentPos.y + 60 },
        data: {
          resultUrl: url,
          frameUrl: url,
          prompt: label,
          model: imageModel,
          ratio: imageRatio,
          quality: imageQuality,
          styleOverride: imageStyle,
        }
      }];
    });
    useAppStore.getState().setToastMsg('📋 已复制到画布');
  }, [id, setNodes, imageModel, imageRatio, imageQuality, imageStyle]);

  // ======== 统一对话助手 ========
  const handleChatSend = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    saveChatMessages([...chatMessages, { role: 'user', content: msg }]);
    setChatInput('');
    setChatLoading(true);
    try {
      // 构造 System Prompt：包含三个框的当前内容
      const systemContext = [
        '你是长镜头 30s 表演的创作助手。你可以修改以下三个框的内容：',
        '',
        `【定场图规划】\n${topDownEditable || '(空)'}`,
        '',
        `【情绪剧本分析】\n${emotionEditable || '(空)'}`,
        '',
        `【30s 表演提示词】\n${editablePerform || '(空)'}`,
        '',
        `【剧本选中片段】\n${selectedText.substring(0, 500)}`,
        '',
        '如果用户要求修改某个框的内容，请在回复末尾输出：',
        '!update topdown [新内容]',
        '或 !update emotion [新内容]',
        '或 !update perform [新内容]',
        '一次可以输出多个 !update 指令。',
        '不要修改用户没有要求修改的框。',
        '不要修改剧本选中片段。',
      ].join('\n');

      const response = await fetchApi('/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: storeRef.current.canvasSettings?.defaultLLMModel || 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: systemContext },
            ...chatMessages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: msg },
          ],
          stream: false,
        }),
      });
      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content || '';
      const updatedMessages = [...chatMessages, { role: 'assistant', content: reply }];
      saveChatMessages(updatedMessages);

      // 解析 !update 指令
      const updateRegex = /!update\s+(topdown|emotion|perform)\s+([\s\S]*?)(?=!update|$)/g;
      let match;
      const updatedFields: Record<string, string> = {};
      while ((match = updateRegex.exec(reply)) !== null) {
        const target = match[1];
        const newContent = match[2].trim();
        if (target === 'topdown') { setTopDownEditable(newContent); updatedFields._topDownText = newContent; }
        else if (target === 'emotion') { setEmotionEditable(newContent); setEmotionText(newContent); updatedFields._emotionText = newContent; }
        else if (target === 'perform') { setEditablePerform(newContent); setPerformText(newContent); updatedFields._performText = newContent; }
      }
      // ★ 持久化：将修改内容同步到 node.data，防止崩溃丢失
      if (Object.keys(updatedFields).length > 0) {
        saveToNodeData(updatedFields);
      }
    } catch (error: any) {
      console.error("[SD30s Chat Error] - 原因是：", error?.message || error);
      saveChatMessages([...chatMessages, { role: 'assistant', content: `❌ 请求失败: ${error.message}` }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, topDownEditable, emotionEditable, editablePerform, selectedText, saveToNodeData, saveChatMessages]);

  // ——— 全屏编辑器 ———
  const ZenEditor = zenMode ? createPortal(
    <div className="fixed inset-0 z-[100000] bg-black/90 flex items-center justify-center" onClick={() => setZenMode(null)}>
      <div className="w-[90vw] h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-zinc-400 text-sm">{zenMode.title}</span>
          <button onClick={() => setZenMode(null)} className="text-zinc-500 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all">
            <Minimize size={18} />
          </button>
        </div>
        <textarea
          value={zenMode.text}
          onChange={e => zenMode.onChange(e.target.value)}
          className="flex-1 w-full bg-[#0a0a0c] rounded-xl p-5 text-[14px] text-zinc-200 leading-relaxed border border-white/[0.08] focus:outline-none focus:border-white/20 resize-none font-mono custom-scrollbar"
        />
      </div>
    </div>,
    document.body
  ) : null;

  // ——— 图片预览模态框 ———
  const ImagePreviewModal = imagePreview ? createPortal(
    <div className="fixed inset-0 z-[100000] bg-black/90 flex items-center justify-center" onClick={() => setImagePreview(null)}>
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <img src={imagePreview} alt="预览" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
        <div className="absolute top-4 right-4 flex gap-2">
          <button onClick={() => handleCopyImageToCanvas(imagePreview, '定场图')} className="p-2 bg-black/60 rounded-lg text-zinc-300 hover:text-white hover:bg-black/80 transition-all" title="复制到画布">
            <Copy size={18} />
          </button>
          <button onClick={() => handleDownloadImage(imagePreview, '定场图')} className="p-2 bg-black/60 rounded-lg text-zinc-300 hover:text-white hover:bg-black/80 transition-all">
            <Download size={18} />
          </button>
          <button onClick={() => setImagePreview(null)} className="p-2 bg-black/60 rounded-lg text-zinc-300 hover:text-white hover:bg-black/80 transition-all">
            <X size={18} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  // ——— 渲染：已完成的节点（子节点，Seedance 2.5 格式） ———
  if (data.status === 'done' && data.performancePrompt) {
    const perf = data.performancePrompt;
    return (
      <div className={`group relative ${nodeBaseClass} ${selected ? selectedBorderClass : ''} rounded-[24px] p-0 overflow-hidden min-w-[680px] max-w-[720px]`}>
        <Handle type="target" position={Position.Left} id="left" className={handleLeft} />
        <Handle type="source" position={Position.Right} id="right" className={handleRight} />
        {ImagePreviewModal}
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎭</span>
            <span className="text-white font-medium text-sm">{data.title}</span>
          </div>
          <span className="text-[11px] text-zinc-500 bg-white/[0.04] px-2.5 py-1 rounded-full">长镜头 30s - seedance 2.5</span>
        </div>
        {/* 定场图 */}
        {data.topDownMap && data.topDownMap.scenes && (
          <div className="px-5 py-3 border-b border-white/[0.04]">
            <div className="flex flex-wrap gap-3">
              {Object.entries(data.topDownMap.scenes).map(([sceneName, images]) => (
                <div key={sceneName} className="flex-1 min-w-[200px]">
                  <div className="text-[11px] text-zinc-500 mb-1">{sceneName}</div>
                  <div className="flex gap-2">
                    {images.abstractUrl && (
                      <div className="flex-1 cursor-pointer group/img" onClick={() => setImagePreview(images.abstractUrl)}>
                        <img src={images.abstractUrl} alt={`${sceneName}拓扑图`} className="w-full h-[100px] object-contain rounded-lg bg-black/30 hover:ring-1 hover:ring-white/20 transition-all" />
                        <div className="text-[10px] text-zinc-600 mt-0.5">抽象拓扑</div>
                      </div>
                    )}
                    {images.realisticUrl && (
                      <div className="flex-1 cursor-pointer group/img" onClick={() => setImagePreview(images.realisticUrl)}>
                        <img src={images.realisticUrl} alt={`${sceneName}白模图`} className="w-full h-[100px] object-contain rounded-lg bg-black/30 hover:ring-1 hover:ring-white/20 transition-all" />
                        <div className="text-[10px] text-zinc-600 mt-0.5">白模布局</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* 【本次任务】 */}
        {perf.missionTask && (
          <div className="px-5 py-2 border-b border-white/[0.04]">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded">本次任务</span>
            </div>
            <div className="text-[12px] text-zinc-300 leading-relaxed">{perf.missionTask}</div>
          </div>
        )}
        {/* 【主要主体】+【场景与环境状态】+【情绪目标】三栏 */}
        <div className="px-5 py-2 border-b border-white/[0.04] space-y-2">
          {perf.mainSubjects && (
            <div>
              <span className="text-[10px] text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded">主要主体</span>
              <div className="text-[12px] text-zinc-400 mt-0.5">{perf.mainSubjects}</div>
            </div>
          )}
          {perf.emotionalGoal && (
            <div>
              <span className="text-[10px] text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded">情绪目标</span>
              <div className="text-[12px] text-zinc-400 mt-0.5">{perf.emotionalGoal}</div>
            </div>
          )}
        </div>
        {/* 【场景与环境状态】 */}
        {perf.sceneState && (
          <div className="px-5 py-2 border-b border-white/[0.04]">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded">场景与环境状态</span>
            </div>
            <div className="text-[12px] text-zinc-400 leading-relaxed line-clamp-3">{perf.sceneState}</div>
          </div>
        )}
        {/* 【分段脚本】镜头列表 */}
        <div className="px-5 py-2 border-b border-white/[0.04]">
          <button onClick={() => setShotsExpanded(!shotsExpanded)} className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
            {shotsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            📋 分段脚本 ({perf.shots.length}镜)
          </button>
          {shotsExpanded && (
            <div className="mt-2 space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
              {perf.shots.map(shot => (
                <div key={shot.number} className="text-[12px] text-zinc-400 bg-white/[0.02] rounded-lg p-2">
                  <span className="text-zinc-300 font-medium">{shot.duration ? shot.duration : `镜头${shot.number}`}</span>
                  <span className="text-zinc-500 ml-2">{shot.shotType}</span>
                  <div className="mt-0.5">{shot.content}</div>
                  {shot.dialogue && <div className="text-zinc-400 mt-0.5">💬 &quot;{shot.dialogue}&quot;</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* 【负面提示词】 */}
        {perf.negativePrompt && (
          <div className="px-5 py-2 border-b border-white/[0.04]">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded">负面提示词</span>
            </div>
            <div className="text-[12px] text-zinc-400">{perf.negativePrompt}</div>
          </div>
        )}
        {/* 操作按钮 */}
        <div className="flex items-center gap-2 px-5 py-3">
          <button onClick={handleCopyPrompt} className="flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1.5 rounded-lg transition-all">
            <Copy size={14} /> 复制提示词
          </button>
          <button onClick={handleExport} className="flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1.5 rounded-lg transition-all">
            <FileText size={14} /> 导出分镜表
          </button>
        </div>
      </div>
    );
  }

  // ——— 渲染：三步向导 ———
  const isDone = data.status === 'done';
  return (
    <div className={`group relative ${nodeBaseClass} ${selected ? selectedBorderClass : ''} rounded-[24px] p-0 min-w-[680px] max-w-[720px]`}>
      <Handle type="target" position={Position.Left} id="left" className={handleLeft} />
      <Handle type="source" position={Position.Right} id="right" className={handleRight} />
      {ZenEditor}
      {ImagePreviewModal}

      <div className="relative">
        {/* 主内容容器（保持圆角裁剪，但面板不受限） */}
        <div className="overflow-hidden rounded-[24px]">
        <div className="flex">
        {/* ===== 左侧主内容 ===== */}
        <div className="w-full">

        {/* 规划态显示对应剧本片段 */}
        {selectedText && (
          <div className="px-5 py-2 border-b border-white/[0.04] bg-white/[0.01]">
            <div className="flex items-center gap-1.5 mb-1">
              <BookText size={11} className="text-zinc-600" />
              <span className="text-[10px] text-zinc-600">对应剧本</span>
              <span className="text-[10px] text-zinc-700">（{selectedText.length}字）</span>
              <span className="text-[9px] text-zinc-700 bg-white/[0.03] px-1.5 py-0.5 rounded">创建时快照</span>
            </div>
            <div className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
              {selectedText.substring(0, 150)}{selectedText.length > 150 ? '...' : ''}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎭</span>
            <span className="text-white font-medium text-sm">{data.title || '长镜头 30s - seedance 2.5'}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-[11px] ${topDownExpanded ? 'text-white' : 'text-zinc-600'}`}>定场图</span>
            <span className="text-zinc-700">→</span>
            <span className={`text-[11px] ${emotionExpanded ? 'text-white' : 'text-zinc-600'}`}>情绪分析</span>
            <span className="text-zinc-700">→</span>
            <span className={`text-[11px] ${performExpanded ? 'text-white' : 'text-zinc-600'}`}>表演生成</span>
            <button onClick={() => setChatOpen(true)}
              className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg transition-all ml-2 ${chatOpen ? 'text-white bg-white/10' : 'text-zinc-400 hover:text-white bg-white/[0.06] hover:bg-white/[0.1]'}`}>
              <MessageSquare size={13} /> 创作助手
            </button>
          </div>
        </div>

        {/* ===== 第0步：定场图 ===== */}
        <div className="border-b border-white/[0.04]">
          <button onClick={() => setTopDownExpanded(!topDownExpanded)}
            className="flex items-center justify-between w-full px-5 py-2.5 text-left hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-2">
              <Map size={16} className="text-zinc-500" />
              <span className="text-[13px] text-zinc-300">定场图规划</span>
              {topDownEditable && <span className="text-[10px] text-green-500/80">✅ 已完成</span>}
              <span className="text-[10px] text-zinc-600">（内容透传表演提示词）</span>
            </div>
            {topDownExpanded ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
          </button>
        {topDownExpanded && (
          <div className="px-5 pb-4 space-y-3">
            {/* 主文本编辑区 */}
            <textarea value={topDownEditable}
              onChange={e => setTopDownEditable(e.target.value)}
              placeholder={topDownEditable ? '' : '点击「生成空间分析」或手动粘贴场景布局描述...'}
              className="w-full h-[200px] bg-black/30 rounded-lg p-3 text-[12px] text-zinc-300 custom-scrollbar overflow-y-auto border border-white/[0.06] focus:outline-none focus:border-white/20 nodrag nopan"
              onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleGenerateTopDownAnalysis} disabled={topDownLoading}
                className="flex items-center gap-1.5 text-[12px] text-zinc-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
                {topDownLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {topDownEditable ? '重新生成空间分析' : '生成空间分析'}
              </button>
              <button onClick={() => setZenMode({ text: topDownEditable, onChange: setTopDownEditable, title: '定场图规划 - 全屏编辑' })}
                className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 bg-white/[0.03] hover:bg-white/[0.06] px-3 py-1.5 rounded-lg transition-all">
                <Maximize size={14} /> 全屏编辑
              </button>
            </div>

            {/* ★ 生图参数设置栏（液态玻璃风格，参考生图节点） */}
            <div className="flex items-center gap-2 flex-wrap px-3 py-2 bg-white/[0.02] rounded-xl border border-white/[0.04]">
              <span className="text-[10px] text-zinc-600 mr-1">生图参数</span>
              <CustomSelect className="w-[130px]"
                value={imageModel}
                options={[
                  { value: 'gpt-image-2', label: 'GPT-Image-2' },
                  { value: 'banana-pro', label: 'Banana Pro' },
                  { value: 'seedream5.0', label: 'Seedream 5.0' }
                ]}
                onChange={handleImageModelChange}
              />
              <CustomSelect className="w-[90px]"
                value={imageRatio}
                options={[
                  { value: '16:9', label: '16:9' },
                  { value: '9:16', label: '9:16' },
                  { value: '1:1', label: '1:1' },
                  { value: '4:3', label: '4:3' },
                  { value: '3:4', label: '3:4' }
                ]}
                onChange={(v: string) => { setImageRatio(v); saveToNodeData({ imageRatio: v }); }}
              />
              <div ref={configRef} className="relative">
                <button onClick={() => setConfigOpen(!configOpen)}
                  className={`p-1.5 rounded-lg transition-all ${configOpen ? 'text-white bg-white/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}>
                  <Settings2 size={14} />
                </button>
                <div className={`absolute top-full left-0 pt-2 z-[99999] transition-all duration-200 ${configOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
                  <div className="bg-[#050505]/95 backdrop-blur-3xl border border-white/10 rounded-[16px] shadow-[0_40px_100px_rgba(0,0,0,0.95)] py-2 px-3 min-w-[180px] space-y-2">
                    <div>
                      <div className="text-[10px] text-zinc-600 mb-1">画质</div>
                      <CustomSelect className="w-full"
                        value={imageQuality}
                        options={getImageQualityOptions(imageModel)}
                        onChange={(v: string) => { setImageQuality(v); saveToNodeData({ imageQuality: v }); }}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-600 mb-1">风格</div>
                      <CustomSelect className="w-full"
                        value={imageStyle}
                        options={[
                          { value: '继承全局预设', label: '继承全局预设' },
                          { value: '🎬 电影质感', label: '🎬 电影质感' },
                          { value: '🌸 二次元', label: '🌸 二次元' },
                          { value: '📷 极致写实', label: '📷 极致写实' },
                          { value: '🧊 3D 渲染', label: '🧊 3D 渲染' },
                          { value: '🌃 赛博朋克', label: '🌃 赛博朋克' }
                        ]}
                        onChange={(v: string) => { setImageStyle(v); saveToNodeData({ imageStyle: v }); }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 场景列表（从文本中解析） */}
            {(() => {
              const scenes = parseScenes(topDownEditable);
              const displayScenes = scenes.length > 0 ? scenes : [{ name: '场景', content: topDownEditable }];
              return (
                <div className="space-y-3">
                  {/* 场景选项卡 */}
                  {displayScenes.length > 1 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {displayScenes.map((s, i) => (
                        <button key={i} onClick={() => setActiveScene(i)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg transition-all ${
                            activeScene === i
                              ? 'text-white bg-white/[0.1] border border-white/20'
                              : 'text-zinc-500 hover:text-zinc-300 bg-white/[0.03] border border-transparent'
                          }`}>
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* 当前场景内容 */}
                  {displayScenes.map((s, i) => (
                    <div key={i} className={i !== activeScene ? 'hidden' : ''}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-zinc-500">{s.name}</span>
                        <button onClick={() => handleGenerateTopDownImage(s.content, s.name)} disabled={topDownLoading}
                          className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.12] px-2.5 py-1 rounded-lg transition-all disabled:opacity-50">
                          <ImageIcon size={12} /> 生图
                        </button>
                      </div>
                      {/* 当前场景已生成的图片 */}
                      {sceneImages[s.name] && (
                        <div className="flex gap-3">
                          <div className="flex-1 cursor-pointer group/img relative" onClick={() => setImagePreview(sceneImages[s.name].abstractUrl)}>
                            <img src={sceneImages[s.name].abstractUrl} alt="拓扑图" className="w-full h-[110px] object-contain rounded-lg bg-black/30 hover:ring-1 hover:ring-white/20 transition-all" />
                            <button onClick={e => { e.stopPropagation(); handleCopyImageToCanvas(sceneImages[s.name].abstractUrl, `${s.name}-拓扑图`); }}
                              className="absolute top-1 left-1 p-1 bg-black/60 rounded text-zinc-400 hover:text-white opacity-0 group-hover/img:opacity-100 transition-opacity">
                              <Copy size={11} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDownloadImage(sceneImages[s.name].abstractUrl, `${s.name}-拓扑图`); }}
                              className="absolute top-1 right-1 p-1 bg-black/60 rounded text-zinc-400 hover:text-white opacity-0 group-hover/img:opacity-100 transition-opacity">
                              <Download size={12} />
                            </button>
                            <div className="text-[10px] text-zinc-600 mt-0.5">抽象拓扑</div>
                          </div>
                          <div className="flex-1 cursor-pointer group/img relative" onClick={() => setImagePreview(sceneImages[s.name].realisticUrl)}>
                            <img src={sceneImages[s.name].realisticUrl} alt="白模图" className="w-full h-[110px] object-contain rounded-lg bg-black/30 hover:ring-1 hover:ring-white/20 transition-all" />
                            <button onClick={e => { e.stopPropagation(); handleCopyImageToCanvas(sceneImages[s.name].realisticUrl, `${s.name}-白模布局`); }}
                              className="absolute top-1 left-1 p-1 bg-black/60 rounded text-zinc-400 hover:text-white opacity-0 group-hover/img:opacity-100 transition-opacity">
                              <Copy size={11} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDownloadImage(sceneImages[s.name].realisticUrl, `${s.name}-白模布局`); }}
                              className="absolute top-1 right-1 p-1 bg-black/60 rounded text-zinc-400 hover:text-white opacity-0 group-hover/img:opacity-100 transition-opacity">
                              <Download size={12} />
                            </button>
                            <div className="text-[10px] text-zinc-600 mt-0.5">白模布局</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ===== 第1步：情绪分析 ===== */}
      <div className="border-b border-white/[0.04]">
        <button onClick={() => setEmotionExpanded(!emotionExpanded)}
          className="flex items-center justify-between w-full px-5 py-2.5 text-left hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 bg-white/[0.04] w-5 h-5 rounded-full flex items-center justify-center">1</span>
            <span className="text-[13px] text-zinc-300">情绪剧本分析</span>
            {emotionText && <CheckCircle2 size={14} className="text-green-500" />}
          </div>
          {emotionExpanded ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
        </button>
        {emotionExpanded && (
          <div className="px-5 pb-4 space-y-3">
            <textarea value={emotionEditable}
              onChange={e => setEmotionEditable(e.target.value)}
              placeholder="点击「生成情绪分析」分析角色情绪弧线..."
              className="w-full h-[280px] bg-black/30 rounded-lg p-3 text-[12px] text-zinc-300 custom-scrollbar overflow-y-auto border border-white/[0.06] focus:outline-none focus:border-white/20 nodrag nopan"
              onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleGenerateEmotion} disabled={emotionLoading}
                className="flex items-center gap-1.5 text-[12px] text-zinc-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
                {emotionLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} 生成情绪分析
              </button>
              <button onClick={() => setZenMode({ text: emotionEditable, onChange: setEmotionEditable, title: '情绪剧本分析 - 全屏编辑' })}
                className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 bg-white/[0.03] hover:bg-white/[0.06] px-3 py-1.5 rounded-lg transition-all">
                <Maximize size={14} /> 全屏编辑
              </button>
              {emotionText && (
                <button onClick={() => { setPerformExpanded(true); }}
                  className="flex items-center gap-1.5 text-[12px] text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all">
                  确认 <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== 第2步：表演提示词 ===== */}
      <div className="border-b border-white/[0.04]">
        <button onClick={() => setPerformExpanded(!performExpanded)}
          className="flex items-center justify-between w-full px-5 py-2.5 text-left hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 bg-white/[0.04] w-5 h-5 rounded-full flex items-center justify-center">2</span>
            <span className="text-[13px] text-zinc-300">30s 表演提示词</span>
            {performText && <CheckCircle2 size={14} className="text-green-500" />}
          </div>
          {performExpanded ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
        </button>
        {performExpanded && (
          <div className="px-5 pb-4 space-y-3">
            <textarea value={editablePerform}
              onChange={e => setEditablePerform(e.target.value)}
              placeholder={emotionText ? '点击「生成表演提示词」...' : '请先完成情绪分析'}
              className="w-full h-[350px] bg-black/30 rounded-lg p-3 text-[12px] text-zinc-300 custom-scrollbar overflow-y-auto border border-white/[0.06] focus:outline-none focus:border-white/20 font-mono nodrag nopan"
              onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleGeneratePerform} disabled={performLoading || !emotionText}
                className="flex items-center gap-1.5 text-[12px] text-zinc-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
                {performLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} 生成表演提示词
              </button>
              <button onClick={() => setZenMode({ text: editablePerform, onChange: setEditablePerform, title: '30s 表演提示词 - 全屏编辑' })}
                className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 bg-white/[0.03] hover:bg-white/[0.06] px-3 py-1.5 rounded-lg transition-all">
                <Maximize size={14} /> 全屏编辑
              </button>
              {performText && (
                <button onClick={handleConfirmWrite}
                  className="flex items-center gap-1.5 text-[12px] text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all">
                  <CheckCircle2 size={14} /> 确认写入节点
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== 左侧主内容结束 ===== */}
      </div>
      </div>
      </div>

      {/* ===== 右侧创作助手面板 ===== */}
      {chatOpen && (
        <div className="absolute left-full top-0 w-[320px] max-h-[400px] border-l border-white/[0.06] bg-[#0a0a0c]/80 flex flex-col rounded-r-[24px] overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-zinc-400" />
              <span className="text-[13px] text-zinc-300">创作助手</span>
              <span className="text-[10px] text-zinc-600">（三步内容联动）</span>
            </div>
            <button onClick={() => setChatOpen(false)}
              className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-all">
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-2 min-h-[200px]">
            {chatMessages.length === 0 && (
              <div className="text-[12px] text-zinc-500 text-center py-8 leading-relaxed">
                <div className="text-zinc-400 font-medium mb-2">请问是否对节点分镜元素满意？</div>
                您可以在此直接修改并进行覆盖
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`text-[12px] leading-relaxed ${msg.role === 'user' ? 'text-zinc-200' : 'text-zinc-400'}`}>
                <span className="text-zinc-600 mr-1">{msg.role === 'user' ? '👤' : '🤖'}</span>
                {msg.content}
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <Loader2 size={11} className="animate-spin" /> 思考中...
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t border-white/[0.06] shrink-0">
            <div className="flex gap-2">
              <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                placeholder="输入修改意见..."
                className="flex-1 bg-black/40 rounded-lg px-3 py-2 text-[12px] text-zinc-300 border border-white/[0.06] focus:outline-none focus:border-white/20 placeholder:text-zinc-600 nodrag nopan"
              />
              <button onClick={handleChatSend} disabled={chatLoading || !chatInput.trim()}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-zinc-300 hover:text-white transition-all disabled:opacity-50">
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export const SD30sNode = React.memo(_SD30sNode);
