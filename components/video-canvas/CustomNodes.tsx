import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom'; // ✨ 新增：用于渲染悬浮顶层的禅定舱
import { Handle, Position, useReactFlow, NodeResizeControl, useEdges, useNodes } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { 
  Image as ImageIcon, Film, Type, Sparkles, ChevronDown, MoveUp, Scaling, Loader2, Layers, CheckCircle,
  Maximize, Wand2, Grid, UserRound, PenTool, Eraser, RefreshCcw, Download, Subtitles, Scissors, AudioWaveform, RotateCcw,
  Upload, Trash2, Play, ArrowRight, ArrowDown, Settings2, CheckSquare, Clapperboard, X, Table, Plus, Expand, Database, Map, Users, Package, MoreHorizontal, Copy, Globe, Camera, MessageSquare, Send, List
} from 'lucide-react';
import { fetchApi } from '@/services/api';
import { DirectorRouter } from '@/lib/director-rules';
import EpisodeSelectModal from './EpisodeSelectModal';
import dynamic from 'next/dynamic';

// ★ 全景查看器：动态导入避免 SSR 时加载 Three.js
const PanoramaViewer = dynamic(() => import('./PanoramaViewer'), { ssr: false });

// ★★★ 通用 Hook：读取图片/视频原始宽高比
// 用于所有节点自适应展示，消除黑边，不拉伸变形
function useMediaDimensions(url?: string) {
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    if (!url) { setDims(null); return; }
    let cancelled = false;
    // 视频文件跳过（用 video 标签读取太慢）
    if (/\.(mp4|webm|mov|avi)$/i.test(url)) { setDims(null); return; }
    const img = new Image();
    img.onload = () => { if (!cancelled) setDims({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { if (!cancelled) setDims(null); };
    img.src = url;
    return () => { cancelled = true; };
  }, [url]);
  return dims;
}

// ★ 画布 LLM 模型白名单（与 constants.tsx MODELS 同步，用于过滤掉生图/生视频模型）
const LLM_MODEL_IDS = ['deepseek-v4-flash', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-3.6-flash', 'kimi-k2.6', 'claude-haiku-4-5-20251001-thinking'];

// ★ 统一 LLM 模型解析：① 中控台全局默认（优先）→ ② 节点自选模型 → ③ 硬兜底
const resolveLLMModel = (data: any): string => {
  const globalModel = useAppStore.getState().canvasSettings?.defaultLLMModel;
  if (globalModel && LLM_MODEL_IDS.includes(globalModel)) return globalModel;
  if (data.model && LLM_MODEL_IDS.includes(data.model)) return data.model;
  return 'deepseek-v4-flash';
};

// ✨ 放在 CustomNodes.tsx 文件顶部 imports 区域下方
const compressImage = (file: File, maxWidth = 1024): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        // 强制转为 JPEG 并压缩到 80% 质量，体积缩小 90%
        resolve(canvas.toDataURL('image/jpeg', 0.8)); 
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// ✨ 新增：强制本地转换下载引擎（解决跨域图片跳页面的Bug）
const forceDownload = async (url: string, filename: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    // 降级方案：如果极端情况 fetch 失败，使用原版跳转
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.click();
  }
};

// ★★★ SSE 流式聊天辅助函数 — 解决 stream:false 导致完整缓冲等待、用户感觉"卡死"的问题
// 原理：用 SSE 逐 chunk 读取，同时通过 onChunk 回调实时展示生成进度
// 改动：统一走 fetchApi，享受 401/402/403 全局拦截 + API_BASE 前缀 + 统一 Auth
// ★ 新增 AbortSignal 支持 + 5 分钟超时兜底，防止 SSE 流挂起导致按钮永久转圈
const fetchStreamingChat = async (payload: any, onChunk?: (text: string) => void, signal?: AbortSignal, onThinking?: () => void, onConnected?: () => void): Promise<string> => {
  // ★ 分阶段超时策略：分镜裂变给更长的容忍时间，其它画布流式请求维持更保守的边界
  const promptType = String(payload?.prompt_type || '');
  const timeoutMs = promptType === 'fission-stage1'
    ? 16 * 60 * 1000
    : promptType === 'fission-stage2'
      ? 12 * 60 * 1000
      : 8 * 60 * 1000;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  let abortLogger: ((this: AbortSignal, ev: Event) => any) | null = null;

  // ★ 合并外部 signal 和超时 signal：任一触发即 abort
  const combinedSignal = signal
    ? combineAbortSignals(signal, timeoutController.signal)
    : timeoutController.signal;

  try {
    const requestBody = { ...payload, _source: 'canvas', stream: true };
    console.log('[DEBUG][fetchStreamingChat] 发送请求体:', JSON.stringify({ model: requestBody.model, reasoning_effort: requestBody.reasoning_effort, thinking: requestBody.thinking, temperature: requestBody.temperature, prompt_type: requestBody.prompt_type, stream: requestBody.stream, userLen: (requestBody.user_content || '').length }, null, 2));
    // ★ [Debug] 裂变请求时打印完整 user_content 首尾，排查上下文是否正确
    if (requestBody.prompt_type === 'fission-stage1') {
      const uc = requestBody.user_content || '';
      console.log('[DEBUG][fission-stage1 user_content]', {
        totalLen: uc.length,
        head: uc.slice(0, 500),
        tail: uc.slice(-500),
      });
    }
    console.log('[Canvas Stream Debug] 请求开始:', {
      model: requestBody.model,
      prompt_type: requestBody.prompt_type,
      userLen: (requestBody.user_content || '').length,
      hasThinking: !!requestBody.thinking,
      hasReasoningEffort: !!requestBody.reasoning_effort,
      timeoutMs
    });

    abortLogger = () => {
      console.warn('[Canvas Stream Debug] 收到 abort 信号:', {
        byOuterSignal: !!signal?.aborted,
        byTimeout: timeoutController.signal.aborted,
        outerReason: (signal as any)?.reason,
        timeoutReason: (timeoutController.signal as any)?.reason
      });
    };
    combinedSignal?.addEventListener('abort', abortLogger, { once: true });

    const fetchOptions: any = {
      method: 'POST',
      body: JSON.stringify(requestBody),
    };
    if (combinedSignal) {
      fetchOptions.signal = combinedSignal;
    }

    const response = await fetchApi('/v1/canvas/prompt', fetchOptions);
    console.log('[DEBUG][fetchStreamingChat] 后端响应状态:', response.status, response.statusText);
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('[Stream Error] 无法读取响应流');

    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    let firstChunkLogged = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (!firstChunkLogged) {
        firstChunkLogged = true;
        console.log('[Canvas Stream Debug] 收到首个流块:', {
          bytes: value?.byteLength || 0,
          bufferPreview: buffer.slice(0, 200)
        });
      }
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content || '';
          if (content) {
            fullText += content;
            if (onChunk) onChunk(fullText);
          }
          // ★ [Debug] 捕获 finish_reason，排查 DeepSeek 截断问题
          const finishReason = parsed.choices?.[0]?.finish_reason;
          if (finishReason) {
            console.log(`[Canvas Stream Debug] finish_reason=${finishReason} | 已收集文本长度=${fullText.length} | prompt_type=${requestBody.prompt_type}`);
            if (finishReason === 'length') {
              console.warn(`[Canvas Stream Debug] ⚠️ 模型输出被截断！finish_reason=length | 已收集${fullText.length}字符 | 可能原因：max_tokens不足或上游限制`);
            }
          }
        } catch {
          // 忽略解析失败的行
        }
      }
    }

    console.log('[Canvas Stream Debug] 流正常结束:', {
      finalLength: fullText.length,
      finalPreview: fullText.slice(0, 200),
      prompt_type: requestBody.prompt_type
    });
    return fullText;
  } finally {
    if (abortLogger) combinedSignal?.removeEventListener('abort', abortLogger as EventListener);
    clearTimeout(timeoutId);
  }
};

// ★ 辅助：从 last timeSegment 提取总时长。
// 这里优先取区间末尾秒数（如 6-11s → 11），如果只有单点秒数就直接取该秒数。
const parseDurationFromLastTS = (segments: any[]): number => {
  if (!segments?.length) return 5;
  const last = segments[segments.length - 1];
  if (!last.time) return 5;
  const timeText = String(last.time).trim();
  const rangeMatch = timeText.match(/-(\d+)\s*s?$/);
  if (rangeMatch) return parseInt(rangeMatch[1], 10);
  const pointMatch = timeText.match(/^(\d+)\s*s?$/);
  return pointMatch ? parseInt(pointMatch[1], 10) : 5;
};

// ★ 字符级扫描：修复 LLM 在 JSON 字符串值中输出的中文对话引号（U+0022 代替 U+201C/U+201D）
// 逐字符追踪 JSON 字符串内外状态，遇到字符串内部的 " 且处于对话上下文时自动转义为 \"
// 7 种对话引号上下文：中文4种 + 英文3种（剧本中混有英文台词如 LINDA: "Relax. Feed her..."）
// 4 种对话引号上下文：① 夹在中文中间 ② 关引号+JSON分隔符 ③ JSON值开头+开引号 ④ 关引号+破折号
const escapeChineseDialogueQuotes = (jsonStr: string): string => {
  let result = '';
  let inString = false;
  let escapeNext = false;

  const isCJK = (c: string) => /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef\u2014\u2026。，！？；：、—…]/.test(c);
  const isDash = (c: string) => /[\u2014\u2026—…]/.test(c);

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];

    if (escapeNext) { result += ch; escapeNext = false; continue; }
    if (ch === '\\') { result += ch; escapeNext = true; continue; }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        result += ch;
      } else {
        const remaining = jsonStr.slice(i + 1);
        const afterTrimmed = remaining.trimStart();

        // 优先：后面是 JSON 结构字符 → 合法结束符
        if (afterTrimmed.startsWith(',') || afterTrimmed.startsWith('}') || afterTrimmed.startsWith(']') || afterTrimmed.startsWith(':')) {
          inString = false;
          result += ch;
          continue;
        }

        const prevChar = result.length > 0 ? result[result.length - 1] : '';
        const nextChar = remaining[0] || '';
        const prevIsCJK = isCJK(prevChar);
        const nextIsCJK = isCJK(nextChar);
        const prevIsQuote = prevChar === '"';
        const nextIsQuote = nextChar === '"';
        const nextIsDash = isDash(nextChar);
        const nextIsLetter = /[a-zA-Z]/.test(nextChar);
        const prevIsLetterOrPunct = /[a-zA-Z.,!?;:]/.test(prevChar);

        // 7 种对话引号上下文（覆盖中文 + 英文台词）
        if (prevIsCJK && nextIsCJK)          { result += '\\"'; continue; }  // ① 夹在中文中间
        if (prevIsCJK && nextIsQuote)        { result += '\\"'; continue; }  // ② 关引号 + JSON分隔符
        if (prevIsQuote && nextIsCJK)        { result += '\\"'; continue; }  // ③ JSON值开头 + 开引号
        if (prevIsCJK && nextIsDash)         { result += '\\"'; continue; }  // ④ 关引号 + 破折号
        if (prevIsCJK && nextIsLetter)       { result += '\\"'; continue; }  // ⑤ CJK + " + 英文 → 英文对话开引号
        if (prevIsLetterOrPunct && nextIsCJK){ result += '\\"'; continue; }  // ⑥ 英文/标点 + " + CJK → 英文对话关引号
        if (prevIsLetterOrPunct && nextIsQuote){ result += '\\"'; continue; }// ⑦ 英文/标点 + "" → 英文关引号+JSON分隔符

        // ★ 不匹配任何对话引号上下文 → 保守按对话引号转义
        // 宁可多转义导致 JSON.parse 报错（修复链 L1-L4 兜底），也绝不能当 JSON 结束符截断内容（静默丢分镜）
        result += '\\"';
      }
    } else {
      result += ch;
    }
  }

  return result;
};



// ★ 辅助：合并多个 AbortSignal
const combineAbortSignals = (...signals: AbortSignal[]): AbortSignal => {
  const controller = new AbortController();
  const onAbort = () => {
    controller.abort();
    signals.forEach(s => s.removeEventListener('abort', onAbort));
  };
  signals.forEach(s => {
    if (s.aborted) { controller.abort(); return; }
    s.addEventListener('abort', onAbort);
  });
  return controller.signal;
};

// ★ 画布流式响应清洗：剥离上游偶发混入的运行提醒，避免污染分镜 JSON
const sanitizeCanvasStreamText = (text: string): string => {
  if (!text) return text;
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, '')
    .replace(/<\/?system-reminder>/gi, '')
    .replace(/<assistant-reminder>[\s\S]*?<\/assistant-reminder>/gi, '')
    .replace(/<\/?assistant-reminder>/gi, '');
};

// ✨ 高级黑玻璃禅定编辑器 (Zen Mode)
const ZenEditor = ({ value, onChange, label, onClose, placeholder, onWheelCapture, incomingAssets = [], dataAttrs = {} }: any) => {
  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-12 bg-black/60 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300" onClick={onClose}>
       <div className="w-full max-w-[1000px] h-[80vh] flex flex-col bg-[#050505]/90 border border-white/10 rounded-[32px] shadow-[0_50px_100px_rgba(0,0,0,1)] overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <span className="text-white font-bold tracking-widest text-[14px] flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-400"/> 禅定编辑舱 / {label}
            </span>
            <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white bg-white/5 hover:bg-red-500/80 rounded-full transition-all"><X size={16}/></button>
          </div>
          <div className="flex-1 p-6 relative flex flex-col overflow-hidden zen-mode-container">
            <style dangerouslySetInnerHTML={{__html: `
              .zen-mode-container > div { height: 100%; display: flex; flex-direction: column; }
              .zen-mode-container textarea { flex: 1; height: 100% !important; overflow-y: auto !important; font-size: 16px !important; line-height: 1.8 !important; }
            `}} />
            <MentionTextarea value={value} onChange={onChange} placeholder={placeholder || "进入心流模式编写..."} incomingAssets={incomingAssets} dataAttrs={dataAttrs} />
          </div>
          <div className="px-6 py-4 border-t border-white/10 bg-white/[0.01] flex justify-end">
             <button onClick={onClose} className="px-8 py-3 bg-white text-black text-[13px] font-bold rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 transition-all">保存并返回</button>
          </div>
       </div>
    </div>,
    document.body
  );
};

import { useAppStore } from '@/store/useAppStore'; 
import { useCanvasEngine, buildImagePayload } from '@/hooks/useCanvasEngine';

// ✨ 多模型差异化分辨率动态选项生成器
// 依据后端及 useCanvasEngine.ts 所设定的参数进行严格物理对齐，防止因比例/精度不符导致 400 报错
const getImageQualityOptions = (model: string) => {
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
  // gpt-image-2 或其它默认模型仅支持 1K（通过 prompt 拼装实现）
  return [
    { value: '1K', label: '1K (标准)' }
  ];
};

// ==========================================
// ==========================================
// 画布气质改造 — 语义化液态玻璃设计系统
// 旧 nodeBaseClass 已替换为 globals.css 中的 .glass-card
// selectedBorderClass 已替换为 .glass-card-selected（带呼吸光动画）
// unselectedBorderClass 已内置在 .glass-card 中（border + hover 态）
// ==========================================
const nodeBaseClass = "glass-card glass-card-hover";
const selectedBorderClass = "glass-card-selected";
// ✨ 只保留左右接口，彻底抛弃上下接口
const handleBase = "!w-[24px] !h-[24px] !bg-transparent !border-none !rounded-full opacity-0 group-hover:opacity-100 z-50 flex items-center justify-center relative before:absolute before:content-[''] before:w-[12px] before:h-[12px] before:bg-white before:rounded-full before:border-[3px] before:border-[#18181b] before:shadow-[0_0_15px_rgba(255,255,255,0.9)] before:transition-all hover:before:scale-125 transition-opacity duration-300";
const handleLeft = `${handleBase} !-left-[12px]`;
const handleRight = `${handleBase} !-right-[12px]`;
// (这里保留你原本的 MentionTextarea 和 CustomSelect 代码...)

// ★ 全局比例映射表（模块级常量，避免每次渲染重复创建）
const RATIO_ASPECT_ONLY: Record<string, React.CSSProperties> = { '16:9': { aspectRatio: '16/9' }, '9:16': { aspectRatio: '9/16' }, '1:1': { aspectRatio: '1/1' }, '4:3': { aspectRatio: '4/3' }, '3:4': { aspectRatio: '3/4' } };
const MEDIA_RATIO_MAP: Record<string, React.CSSProperties> = { '16:9': { width: '320px', aspectRatio: '16/9' }, '9:16': { width: '220px', aspectRatio: '9/16' }, '1:1': { width: '260px', aspectRatio: '1/1' }, '4:3': { width: '280px', aspectRatio: '4/3' }, '3:4': { width: '240px', aspectRatio: '3/4' } };
const RENDER_RATIO_MAP: Record<string, React.CSSProperties> = { '16:9': { width: '400px', aspectRatio: '16/9' }, '9:16': { width: '260px', aspectRatio: '9/16' }, '1:1': { width: '320px', aspectRatio: '1/1' }, '4:3': { width: '380px', aspectRatio: '4/3' }, '3:4': { width: '320px', aspectRatio: '3/4' } };

// ==========================================
// ==========================================
// ✨ 全新组件：支持 @ 唤出的超级输入框 (大图预览 + 实体命名)
// ==========================================
function MentionTextarea({ value, onChange, placeholder, incomingAssets = [], disableMention = false, dataAttrs = {} }: any) {
  const [showMenu, setShowMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);
    if (disableMention) {
      setShowMenu(false);
      return;
    }
    const cursor = e.target.selectionStart;
    if (val.charAt(cursor - 1) === '@') {
      setShowMenu(true);
    } else {
      setShowMenu(false);
    }
  };

  const handleSelect = (asset: any) => {
    const cursor = textareaRef.current?.selectionStart || 0;
    const textBefore = value.substring(0, cursor - 1); 
    const textAfter = value.substring(cursor);
    // 强制打上中括号标记，方便以后后端识别
    const label = `[${asset.name || '参考图'}]`;
    onChange(textBefore + label + " " + textAfter);
    setShowMenu(false);
    setTimeout(() => textareaRef.current?.focus(), 10);
  };

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-zinc-100 px-6 py-4 min-h-[100px] resize-none text-[15px] leading-relaxed custom-scrollbar placeholder-zinc-600 nodrag nopan"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
        {...dataAttrs}
      />
      
      {showMenu && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-[360px] max-h-[300px] overflow-y-auto custom-scrollbar bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/20 rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.95)] p-1.5 z-[999999] animate-in fade-in slide-in-from-top-2">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 py-2 border-b border-white/[0.05] mb-1 flex justify-between items-center">
            插入已连线参考元素 <span className="text-[8px] bg-white/10 px-1.5 py-0.5 rounded text-zinc-400 font-mono">ESC 取消</span>
          </div>
          {incomingAssets.length === 0 ? (
            <div className="px-3 py-6 text-[12px] text-zinc-500 text-center font-light">暂无输入节点，请先从资产表拉取连线</div>
          ) : (
            incomingAssets.map((asset: any, idx: number) => (
              <div key={idx} onClick={() => handleSelect(asset)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-[12px] cursor-pointer transition-all group">
                {asset._type === 'image' 
                  ? <img src={asset.url} className="w-12 h-12 rounded-[10px] object-cover border border-white/10 shadow-md group-hover:scale-110 transition-transform" />
                  : <div className="w-12 h-12 rounded-[10px] bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform"><Film size={16} className="text-zinc-300"/></div>
                }
                <div className="flex flex-col flex-1 overflow-hidden">
                  <span className="text-[13px] font-bold text-zinc-200">{asset.name || `参考图-${idx + 1}`}</span>
                  <span className="text-[11px] text-zinc-500 truncate mt-1">{asset.prompt || '未命名媒体文件'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// 悬浮下拉菜单组件 (终极防呆版：点击打开/关闭，智能向左弹出，层级最高)
function CustomSelect({ value, options, onChange, icon: Icon, className = "", menuPosition = "bottom" }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((o: any) => o.value === value) || options[0];

  // 点击外部自动关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  let positionClasses = "top-full left-0 pt-2 origin-top";
  if (menuPosition === "top") positionClasses = "bottom-full left-0 pb-2 origin-bottom";
  else if (menuPosition === "left") positionClasses = "top-1/2 -translate-y-1/2 right-full pr-3 origin-right";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className={`relative w-full flex items-center justify-between rounded-full px-4 py-2 text-[13px] font-medium cursor-pointer transition-all duration-300 ${isOpen ? 'bg-white/10 text-white' : 'bg-transparent text-zinc-300 hover:bg-white/5'}`}
      >
        <span className="truncate relative z-10 flex-1 text-left">{selectedOption?.label}</span>
        {Icon ? <Icon size={14} className="text-zinc-500 relative z-10 ml-2" /> : <ChevronDown size={14} className="text-zinc-500 relative z-10 ml-1.5" />}
      </div>
      
      <div 
        className={`absolute min-w-[160px] z-[99999] transition-all duration-300 ${positionClasses} ${isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#050505]/95 backdrop-blur-3xl border border-white/10 rounded-[16px] shadow-[0_40px_100px_rgba(0,0,0,0.95)] py-1.5 px-1">
          {options.map((opt: any) => (
            <div 
              key={opt.value} 
              onClick={() => { onChange(opt.value); setIsOpen(false); }} 
              className={`px-4 py-3 mx-1 text-[12px] font-medium cursor-pointer rounded-[10px] transition-colors ${value === opt.value ? 'text-white bg-white/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
// ==========================================
// 1. 主剧本节点 (MasterScriptNode) —— "制片人总控台" + 悬浮场记抽屉
// ==========================================
const _MasterScriptNode = ({ id, data, selected }: any) => {
  const { updateNodeData, setNodes, setEdges, getNodes, getEdges } = useReactFlow();
  const [selectedText, setSelectedText] = useState("");
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });

  // ★ 分镜方法记忆（持久化到云端，下次框选文本时自动恢复上次选择）
  const fissionMethod = useAppStore(s => s.canvasSettings?.fissionMethod || 'general');
  const setCanvasSettings = useAppStore(s => s.setCanvasSettings);

  const [extractingAsset, setExtractingAsset] = useState<string | null>(null); // ✨ 新增：控制资产表格提取状态
  const [showAssetMenu, setShowAssetMenu] = useState(false); // ✨ 新增：控制提取菜单
  const [showEpisodeSelect, setShowEpisodeSelect] = useState(false); // ★ 集数选择弹窗开关
  const [episodeSelectMode, setEpisodeSelectMode] = useState<'asset' | 'fission'>('asset'); // ★ 弹窗模式：资产提取 or 分镜选区
  const [episodeSelectAssetType, setEpisodeSelectAssetType] = useState<'scene' | 'character' | 'prop'>('scene'); // ★ 资产表提取类型
  const [cachedEpisodesForModal, setCachedEpisodesForModal] = useState<any[] | null>(null); // ★ 缓存命中时传给弹窗
  const [dialogueOpen, setDialogueOpen] = useState(false); // ★ 分镜对话面板展开/收起
  const [sd30sMode, setSd30sMode] = useState(false); // ★ 是否为长镜头30s对话模式
  const [dialogueMessages, setDialogueMessages] = useState<{role: string; content: string}[]>([]); // ★ 对话消息列表
  const [dialogueLoading, setDialogueLoading] = useState(false); // ★ 对话LLM请求中
  const [dialogueInput, setDialogueInput] = useState(''); // ★ 对话输入框
  const [previewReady, setPreviewReady] = useState(false); // ★ 首条AI回复完成后，允许用户点击确认生成
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ★ 发送分镜预览请求到 LLM（走 /v1/canvas/prompt，prompt_type=fission-preview）
  //    reset=true 时忽略旧消息，从零开始（用于重新打开预览）
  const sendPreviewToLLM = async (userMessage?: string, reset?: boolean) => {
    // ★ 从 textarea ref 实时读取选中文本，避免 React state 延迟导致字数不准
    const ta = textareaRef.current;
    const realSelectedText = ta ? ta.value.substring(ta.selectionStart, ta.selectionEnd) : selectedText;
    if (!realSelectedText && !userMessage) return;
    setDialogueLoading(true);
    setPreviewReady(false);

    const targetModel = resolveLLMModel(data);

    const baseMessages = reset ? [] : dialogueMessages;
    const displayUserMsg = userMessage || '请分析我框选的剧本段落，给出分镜预览';
    const newMessages = [...baseMessages, { role: 'user', content: displayUserMsg }];
    setDialogueMessages(newMessages);

    let userContent = '';
    if (baseMessages.length === 0) {
      userContent = `请分析以下剧本选段，输出分镜预览：\n\n${realSelectedText}`;
    } else {
      const historyStr = baseMessages
        .map(m => `[${m.role === 'user' ? '用户' : 'AI'}]: ${m.content}`)
        .join('\n\n');
      userContent = `【当前剧本选段】\n${realSelectedText}\n\n【对话历史】\n${historyStr}\n\n【用户最新消息】\n${userMessage || displayUserMsg}`;
    }

    try {
      const response = await fetchApi('/v1/canvas/prompt', {
        method: 'POST',
        body: JSON.stringify({
          model: targetModel,
          prompt_type: 'fission-preview',
          params: {},
          user_content: userContent,
          stream: true,
        }),
        useApiRoute: true, // ★ 走 Next.js API Route，绕开代理缓冲
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      // ★ 手动解析 SSE 流
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let aiContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              aiContent += delta;
              // 流式更新对话面板中的 AI 消息
              setDialogueMessages([...newMessages, { role: 'assistant', content: aiContent }]);
            }
          } catch {}
        }
      }

      // ★ 首条 AI 回复完成后，允许用户点击"确认并生成分镜"
      //    用户可继续多轮调整，按钮始终可用
      if (aiContent) {
        setPreviewReady(true);
      }
    } catch (err: any) {
      console.error('[Preview LLM Error]', err);
      setDialogueMessages([...newMessages, { role: 'assistant', content: '抱歉，预览生成失败，请重试。' }]);
    } finally {
      setDialogueLoading(false);
    }
  };

  // ★ 集数检测结果缓存（避免每次打开弹窗都调 LLM）
  // 缓存键 = 剧本哈希（长度+首尾取样），剧本变更时自动失效
  const episodeCacheRef = useRef<{ episodes: any[]; scriptHash: string } | null>(null);

  // ★ 剧本内容指纹（快速判断剧本是否变更，不做完整哈希——长度+首100字+尾100字）
  const getScriptHash = (text: string): string => {
    const len = text.length;
    const head = text.substring(0, 100).replace(/\s/g, '');
    const tail = text.substring(Math.max(0, len - 100)).replace(/\s/g, '');
    return `${len}_${head}_${tail}`;
  };

  // ★ 统一的弹窗打开入口：先检查缓存 → 命中则跳过 LLM 检测
  // 返回 cached episodes 或 null（缓存未命中），供 EpisodeSelectModal 的 preloadedEpisodes prop 使用
  const getOrOpenEpisodeSelect = (mode: 'asset' | 'fission', assetType?: 'scene' | 'character' | 'prop') => {
    const scriptText = data.text || '';
    if (!scriptText) return null;
    const hash = getScriptHash(scriptText);
    const cached = episodeCacheRef.current;

    setEpisodeSelectMode(mode);
    if (assetType) setEpisodeSelectAssetType(assetType);
    setShowEpisodeSelect(true);

    // 缓存命中且未过期 → 存到 state，供 JSX 中 preloadedEpisodes 使用
    if (cached && cached.scriptHash === hash && cached.episodes.length > 0) {
      setCachedEpisodesForModal(cached.episodes);
      return cached.episodes;
    }

    setCachedEpisodesForModal(null);
    return null; // 缓存未命中 → 弹窗内部走完整检测流程
  };

  // 引入队列引擎
  const { enqueueTask } = useCanvasEngine();

  const handleTextSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const text = target.value.substring(target.selectionStart, target.selectionEnd);
    setSelectedText(text.trim());
    setSelectionRange({ start: target.selectionStart, end: target.selectionEnd });

    if (text.trim() && data.sceneInterceptState !== 'confirming') {
      // ✨ 修复：只要重新划选文字，就清空之前书签触发的高亮连线
      updateNodeData(id, { sceneInterceptState: 'idle', activeTargetIds: [] });
    }
  };

  const handleExtractCamera = async () => {
    if (data.isExtractingCamera || !data.text) {
      if (!data.text) useAppStore.getState().setToastMsg("请先在上方输入剧本！");
      return;
    }
    // ★ 防止与其他进度条冲突
    if (useAppStore.getState().fissionProgress.status !== 'idle') {
      useAppStore.getState().setToastMsg("⚠️ 请等待当前操作完成后再提取摄影机参数");
      return;
    }
    updateNodeData(id, { isExtractingCamera: true });
    
    // ★ AbortController + 统一进度条
    const abortController = new AbortController();
    useAppStore.getState().setAbortFission(() => {
      abortController.abort();
      useAppStore.getState().setToastMsg("⏹️ 已中止摄影机提取");
    });
    let phaseInterval: NodeJS.Timeout | undefined;
    
    try {
      const targetModel = resolveLLMModel(data);
      const globalStyle = useAppStore.getState().canvasSettings?.globalPromptSuffix || "无特定风格";

      // ★ 启动进度条
      useAppStore.getState().setFissionProgress({ status: 'camera', phase: '参数生成中.', mode: 'generating' });
      const phaseTexts = ['参数生成中.', '参数生成中..', '参数生成中...'];
      let ticker = 0;
      phaseInterval = setInterval(() => {
        ticker = (ticker + 1) % phaseTexts.length;
        useAppStore.getState().setFissionProgress({ status: 'camera', phase: phaseTexts[ticker], mode: 'generating' });
      }, 800);

      const payload = {
        model: targetModel,
        max_tokens: 4096,
        ...(targetModel === 'deepseek-v4-flash' ? { thinking: { type: "disabled" } } : {}),
        prompt_type: "camera-extract",
        params: { GLOBAL_STYLE: globalStyle },
        user_content: `剧本内容：\n${data.text}`
      };

      // ★ 流式请求：不再用 Toast 蹦代码，统一走进度条
      const cameraParams = (await fetchStreamingChat(payload, undefined, abortController.signal)).trim() || "Shot on 35mm lens, cinematic lighting, 8k resolution";
      
      updateNodeData(id, { globalCamera: cameraParams });
      useAppStore.getState().setFissionProgress({ status: 'idle', phase: '', mode: 'generating' });
      useAppStore.getState().setToastMsg(`✅ 全局摄影机 & 调性已锁定！`);
    } catch (error: any) {
      console.error("提取摄影机失败:", error);
      useAppStore.getState().setFissionProgress({ status: 'idle', phase: '', mode: 'generating' });
      if (error?.name !== 'AbortError') {
        useAppStore.getState().setToastMsg(`摄影机锁定失败: ${error.message || '请检查模型或网络'}`);
      }
    } finally {
      useAppStore.getState().setFissionProgress({ status: 'idle', phase: '', mode: 'generating' });
      useAppStore.getState().setAbortFission(null);
      if (phaseInterval) clearInterval(phaseInterval);
      updateNodeData(id, { isExtractingCamera: false });
    }
  };

  // ==========================================
  // ★★★ 资产表提取：二阶段流程（集数检测 → 用户选择 → 提取）
  // ==========================================

  // 阶段①：打开集数选择弹窗（替代原来的直接提取）
  const handleExtractAssetTable = (type: 'scene' | 'character' | 'prop') => {
    if (!data.text) return useAppStore.getState().setToastMsg("请先在上方输入剧本！");
    setExtractingAsset(type);
    setShowAssetMenu(false);
    getOrOpenEpisodeSelect('asset', type);
    // ★ 弹窗检测完成后，在 handleEpisodeConfirm 中执行实际提取
  };

  // ★ 集数检测完成回调：缓存结果到 ref，下次打开弹窗跳过 LLM 调用
  const handleEpisodesDetected = (episodes: any[]) => {
    const hash = getScriptHash(data.text || '');
    episodeCacheRef.current = { episodes, scriptHash: hash };
    // ★ 同时清空状态中的缓存标记（弹窗已用 preloaded 走完首次显示，后续从 ref 读）
    setCachedEpisodesForModal(null);
  };

  // ★ 集数选择弹窗确认回调（统一入口：分镜选区 or 资产提取）
  const handleEpisodeConfirm = async (result: { episodes: any[], text: string }) => {
    setShowEpisodeSelect(false);

    if (episodeSelectMode === 'fission') {
      // 分镜「按集选择」→ 填充 selectedText，用户再手动点击「裂变分镜」
      setSelectedText(result.text);
      setSelectionRange({ start: 0, end: result.text.length });
      useAppStore.getState().setToastMsg(`✅ 已选中 ${result.episodes.length} 集（约${result.text.length}字），请点击「裂变分镜」开始裂变`);
      return;
    }

    // 资产表提取模式 → 执行实际提取
    const type = episodeSelectAssetType;
    await executeAssetExtraction(type, result);
  };

  // 阶段②：实际资产提取逻辑（由 handleEpisodeConfirm 调用，完整保留原有提取+建节点流程）
  const executeAssetExtraction = async (type: 'scene' | 'character' | 'prop', episodeResult: { episodes: any[], text: string }) => {
    const typeLabel = type === 'scene' ? '场景' : type === 'character' ? '角色' : '道具';
    
    // ★ 防止与其他进度条冲突
    if (useAppStore.getState().fissionProgress.status !== 'idle') {
      useAppStore.getState().setToastMsg("⚠️ 请等待当前操作完成后再提取资产");
      return;
    }

    // ★ AbortController + 统一进度条
    const abortController = new AbortController();
    useAppStore.getState().setAbortFission(() => {
      abortController.abort();
      useAppStore.getState().setToastMsg("⏹️ 已中止资产提取");
    });
    let phaseInterval: NodeJS.Timeout | undefined;

    // ★ 启动进度条
    useAppStore.getState().setFissionProgress({ status: 'asset', phase: `${typeLabel}提取中.`, mode: 'generating' });
    const phaseTexts = [`${typeLabel}提取中.`, `${typeLabel}提取中..`, `${typeLabel}提取中...`];
    let ticker = 0;
    phaseInterval = setInterval(() => {
      ticker = (ticker + 1) % phaseTexts.length;
      useAppStore.getState().setFissionProgress({ status: 'asset', phase: phaseTexts[ticker], mode: 'generating' });
    }, 800);

    try {
      const targetModel = resolveLLMModel(data);

      // ✨ 提取全局导演上下文
      const canvasSettings = useAppStore.getState().canvasSettings;
      const directorCtx = canvasSettings?.directorGenre && canvasSettings.directorGenre !== 'default'
        ? DirectorRouter.resolve(canvasSettings.directorGenre, canvasSettings.directorTempo || undefined)
        : null;

      const directorInjection = directorCtx
        ? `\n\n【导演全局视觉约束，提取资产时必须遵循此光影与色彩基调】：\n${directorCtx.llmContextBlock}`
        : "";

      // ★ 确定 prompt_type：三个资产类型各自对应不同的后端模板
      let promptType: string;
      if (type === 'scene') {
        promptType = 'asset-extract-scene';
      } else if (type === 'character') {
        promptType = 'asset-extract-character';
      } else {
        promptType = 'asset-extract-prop';
      }

      // ★ 构建集数过滤指令（告诉 LLM 只提取选中段落，不设 max_tokens 上限，不截断剧本）
      const episodeFilter = episodeResult.episodes && episodeResult.episodes.length > 0
        ? `\n\n【提取范围约束】：请只提取以下段落的${typeLabel}：${episodeResult.episodes.map((e: any) => e.label).join('、')}。共${episodeResult.episodes.length}个段落，每个段落都必须完整覆盖，不得遗漏任何段落的${typeLabel}。`
        : '';

      // ★ 构建 payload：不设 max_tokens（让 LLM 自由输出完整 JSON），不截断剧本（发送完整 data.text）
      const payload = {
        model: targetModel,
        prompt_type: promptType,
        params: { DIRECTOR_INJECTION: directorInjection },
        user_content: `剧本内容：\n${data.text}${episodeFilter}`
      };

      // ★ 流式请求：不再用 Toast 蹦代码，统一走进度条
      const rawContent = await fetchStreamingChat(payload, undefined, abortController.signal);

      let cleanJson = rawContent;
      const match = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) cleanJson = match[1];
      const parsedRows = JSON.parse(cleanJson.trim());

      // ✨ 核心魔法：在表格生成瞬间，立刻把 LLM 的中文 prompt 加上光影和全局摄影机！
      const finalRows = parsedRows.map((row: any) => {
        let assembledPrompt = row.prompt || '';
        const lightStr = row.lighting ? `, ${row.lighting}` : '';
        const cameraStr = data.globalCamera ? `, ${data.globalCamera}` : '';
        assembledPrompt = `${assembledPrompt}${lightStr}${cameraStr}`;
        return { ...row, prompt: assembledPrompt };
      });

      const thisNode = getNodes().find(n => n.id === id);
      const baseX = thisNode ? thisNode.position.x : 0;
      const baseY = thisNode ? thisNode.position.y : 0;
      const existingTablesCount = getNodes().filter(n => n.type === 'assetTable').length;

      const newNodeId = `asset_table_${type}_${Date.now()}`;
      // ★ 继承全局比例设置，确保资产表默认比例与中控台一致
      const inheritedRatio = useAppStore.getState().canvasSettings.globalRatio || '16:9';
      const newTableNode = {
        id: newNodeId, type: 'assetTable',
        position: { x: baseX + 650, y: baseY - 100 + (existingTablesCount * 450) },
        data: { assetType: type, rows: finalRows, ratio: inheritedRatio }
      };

      const newEdge = {
        id: `e-${id}-${newNodeId}`, source: id, target: newNodeId, sourceHandle: 'right', targetHandle: 'left',
        type: 'default', animated: true, style: { stroke: 'rgba(217, 70, 239, 0.8)', strokeWidth: 2, strokeDasharray: '8 8', animationDuration: '3s' }
      };

      setNodes((nds) => [...nds, newTableNode]);
      setEdges((eds) => [...eds, newEdge]);
      useAppStore.getState().setFissionProgress({ status: 'idle', phase: '', mode: 'generating' });
      useAppStore.getState().setToastMsg(`✅ ${typeLabel}数据表生成成功！共${finalRows.length}条`);

    } catch (error: any) {
      console.error("[Asset Extract Error]", error);
      useAppStore.getState().setFissionProgress({ status: 'idle', phase: '', mode: 'generating' });
      if (error?.name !== 'AbortError') {
        useAppStore.getState().setToastMsg(`数据表生成失败: ${error.message}`);
      }
    } finally {
      useAppStore.getState().setFissionProgress({ status: 'idle', phase: '', mode: 'generating' });
      useAppStore.getState().setAbortFission(null);
      if (phaseInterval) clearInterval(phaseInterval);
      setExtractingAsset(null);
    }
  };


  // ★★★ 构建已有分镜摘要（注入分镜裂变上下文，让 LLM 了解画布上前后的空间/时序状态）
  // 只取前后各 10 个分镜，防止上下文过长
  const buildExistingShotsSummary = (shots: any[]) => {
    if (shots.length === 0) return "暂无已拆解分镜。";

    // 按 shotNumber 排序（解析数字部分）
    const sorted = [...shots].sort((a, b) => {
      const numA = parseInt(String(a.data.shotNumber || '0').match(/\d+/)?.[0] || '0');
      const numB = parseInt(String(b.data.shotNumber || '0').match(/\d+/)?.[0] || '0');
      return numA - numB;
    });

    const MAX_SHOTS = 20; // 最多注入 20 个分镜摘要
    let selected: typeof sorted;

    if (sorted.length <= MAX_SHOTS) {
      selected = sorted;
    } else {
      // 取前10个 + 后10个
      selected = [...sorted.slice(0, 10), ...sorted.slice(-10)];
    }

    const lines = selected.map((n) => {
      const d = n.data;
      const num = d.shotNumber || '?';
      const scene = (d.scriptText || '').replace(/\n/g, ' ').substring(0, 40);
      const chars = (d.videoPrompt || '').match(/@\S+/g)?.join(', ') || '无标注';
      const duration = d.duration || '?';
      const cameraPreview = (d.videoPrompt || '').match(/机位规则[：:]\s*(.+?)(?:\n|$)/)?.[1]
        || (d.videoPrompt || '').match(/cameraRules["\']?\s*:\s*["\']?\s*(.+?)(?:["\']|\n|$)/)?.[1]
        || '未设定';
      return `💍 ${num} (${scene}): ${chars} | 时长${duration}s | ${cameraPreview.substring(0, 60)}`;
    });

    if (shots.length > MAX_SHOTS) {
      lines.splice(10, 0, `...（中间省略 ${shots.length - MAX_SHOTS} 个分镜）`);
    }

    return lines.join('\n');
  };

  // ★★★ 长剧本智能预摘要：超过 10000 字时，先做一次轻量 LLM 调用提取结构化摘要
  // 后续裂变只传摘要，不传全文，避免超长剧本（几十万字）导致 API 请求体过大
  const preSummarizeScript = async (fullScript: string, model: string): Promise<string> => {
    // 如果已有缓存摘要，直接返回
    if (data.scriptSummary) return data.scriptSummary;
    // 如果剧本不太长，无需摘要
    if (fullScript.length <= 10000) return fullScript;

    // 做一次轻量 LLM 调用，提取关键上下文
    const summaryPayload = {
      model,
      prompt_type: "script-summary",
      params: {},
      user_content: `请分析以下剧本，输出结构化摘要：\n\n${fullScript}`
    };

    try {
      // ★ 使用非流式请求（stream: false），快速获取摘要结果
      const summaryRaw = await fetchStreamingChat(summaryPayload);
      if (!summaryRaw || summaryRaw.length < 50) {
        // LLM 返回异常，回退到截断全文（取首尾各 4000 字）
        const head = fullScript.substring(0, 4000);
        const tail = fullScript.substring(Math.max(0, fullScript.length - 4000));
        return `【剧本首部】\n${head}\n\n...(中间省略约${Math.floor((fullScript.length - 8000) / 1000)}千字)...\n\n【剧本尾部】\n${tail}`;
      }
      // 缓存摘要到节点数据，下次裂变直接复用
      updateNodeData(id, { scriptSummary: summaryRaw });
      return summaryRaw;
    } catch {
      // 网络错误等，回退到截断全文
      const head = fullScript.substring(0, 4000);
      const tail = fullScript.substring(Math.max(0, fullScript.length - 4000));
      return `【剧本首部】\n${head}\n\n...(中间省略约${Math.floor((fullScript.length - 8000) / 1000)}千字)...\n\n【剧本尾部】\n${tail}`;
    }
  };


  const handleFissionShots = async (dialogueContext?: string) => {
    // ★ 修复：从 textarea ref 实时读取选区，不依赖可能过期的 React state
    const ta = textareaRef.current;
    const realSelStart = ta?.selectionStart ?? selectionRange.start;
    const realSelEnd = ta?.selectionEnd ?? selectionRange.end;
    const realSelectedText = ta ? ta.value.substring(realSelStart, realSelEnd) : selectedText;

    // ★ 防止重复点击：正在裂变时禁止再次触发
    if (data.isGenerating) {
      useAppStore.getState().setToastMsg('⚠️ 当前节点正在生成中，请等待完成');
      return;
    }
    if (!realSelectedText) {
      useAppStore.getState().setToastMsg('⚠️ 请先在剧本中框选要拆分的段落');
      return;
    }
    if (useAppStore.getState().fissionProgress.status !== 'idle') {
      useAppStore.getState().setToastMsg("⚠️ 分镜裂变正在进行中，请等待完成或点击中止");
      return;
    }
    updateNodeData(id, { isGenerating: true });

    // ★ [Debug] 选区诊断：独立日志，方便直接查看
    console.log('[DEBUG][SelectionDiagnostic]', {
      stored_vs_real: {
        storedRange: { start: selectionRange.start, end: selectionRange.end },
        realRange: { start: realSelStart, end: realSelEnd },
        MISMATCH: realSelStart !== selectionRange.start || realSelEnd !== selectionRange.end ? '⚠️ 选区不一致！' : '✅ 一致',
      },
      selectedText_len: realSelectedText.length,
      selectedText_head: realSelectedText.slice(0, 300),
      selectedText_tail: realSelectedText.slice(-300),
      fullText_len: (data.text || '').length,
      beforeText_extract: realSelStart > 0 
        ? (data.text || '').substring(Math.max(0, realSelStart - 1500), realSelStart).slice(-300)
        : '(选区从0开始)',
      afterText_extract: realSelEnd < (data.text || '').length
        ? (data.text || '').substring(realSelEnd, Math.min(realSelEnd + 300, data.text.length))
        : '(选区到末尾)',
      // ★ 目标文本完整内容（截断到1000字避免日志过大）
      targetText_full: realSelectedText.length > 1000 
        ? realSelectedText.slice(0, 500) + '\n...(中间省略)...\n' + realSelectedText.slice(-500)
        : realSelectedText,
    });

    // ★ 创建 AbortController：支持用户手动中止 + 5 分钟超时兜底
    const abortController = new AbortController();
    useAppStore.getState().setAbortFission(() => {
      abortController.abort();
      useAppStore.getState().setToastMsg("⏹️ 已中止分镜裂变");
    });

    // ★ 阶段动画定时器引用（声明在 try 外，finally 中可清理）
    let phase1Interval: NodeJS.Timeout | undefined;
    let phase2Interval: NodeJS.Timeout | undefined;
    
    try {
      const targetModel = resolveLLMModel(data);
            // ✨ [新增] 抓取画布上的资产基建表，构建 LLM 随身字典
            const assetTables = getNodes().filter(n => n.type === 'assetTable');
            let dictText = "【以下是全局基建资产字典，通读剧本时请务必自行比对人物和场景，提取对应的特征和光影(光影必须用纯英文输出)】\n";
            assetTables.forEach(table => {
              if (!table.data.rows) return;
              const type = table.data.assetType;
              table.data.rows.forEach((r: any) => {
                if (type === 'scene') dictText += `[场景: ${r.name || '未命名'}]: 英文光影氛围-${r.lighting || ''}, 场景描述-${r.prompt || ''}\n`;
                if (type === 'character') dictText += `[角色: @${r.name || '未命名'}]: 着装-${r.clothing || ''}, 角色描述-${r.prompt || ''}\n`;
                if (type === 'prop') dictText += `[道具: ${r.name || '未命名'}]: 描述-${r.prompt || ''}\n`;
              });
            });
            if (assetTables.length === 0) dictText = ""; // 没建档就不干扰

            // ★ 分组模式：每次裂变创建一个组，组内镜号从 1 开始独立编号
            const existingShots = getNodes().filter(n => n.type === 'shot');
            const nextShotStart = 1; // 组内始终从 1 开始

            // ★ 构建已有分镜上下文摘要（注入裂变 LLM 以延续空间/时序逻辑）
            const existingShotsSummary = buildExistingShotsSummary(existingShots);

      // 导演路由引擎：裂变前解析题材与节奏参数
      const canvasSettings = useAppStore.getState().canvasSettings;
      const directorCtx = canvasSettings?.directorGenre && canvasSettings.directorGenre !== 'default'
        ? DirectorRouter.resolve(canvasSettings.directorGenre, canvasSettings.directorTempo || undefined)
        : null;

      // ★ 长剧本预摘要：超过 10000 字时，先用一次轻量 LLM 调用提取故事脉络
      // 摘要缓存到 data.scriptSummary，后续裂变直接复用
      if (data.text && data.text.length > 10000 && !data.scriptSummary) {
        useAppStore.getState().setFissionProgress({ status: 'stage1', phase: '剧本摘要生成中...', mode: 'generating' });
        await preSummarizeScript(data.text, targetModel);
      }

      // ==========================================
      // 🚀 工业级管道 1: 视频分镜拆解 (100% 满血还原，绝不删减)
      // ==========================================
      console.log('[Canvas Fission Debug] Stage 1 start', {
        nodeId: id,
        model: targetModel,
        selectedTextLength: realSelectedText?.length || 0,
        fullTextLength: data.text?.length || 0,
        isFullScript: !realSelectedText || realSelectedText.trim() === (data.text || '').trim(),
        existingShotsCount: existingShots.length,
        directorEnabled: !!directorCtx,
        directorGenre: canvasSettings?.directorGenre || 'default',
        directorTempo: canvasSettings?.directorTempo || '',
      });
      // ★ 用顶部进度条替代 Toast 显示 LLM 原始输出
      useAppStore.getState().setFissionProgress({ status: 'stage1', phase: '分镜拆解中...', mode: 'generating' });
      const payloadStage1 = {
        model: targetModel,
        // ★ DeepSeek V4 Pro：分镜属于长链路推理任务，优先走 max 思考强度
        // 这里不再强行关闭 thinking，避免把模型压回普通输出路径，导致 stage1 卡在半截 JSON
        ...(targetModel === 'deepseek-v4-flash' ? { thinking: { type: "disabled" }, max_tokens: 65536 } : {}),
        // ★ GPT-5.4 系列：temperature 对该系列非法（推理模型不支持），仅设 reasoning_effort 控制推理深度
        // mini: low（防分镜过碎）  nano: medium（low 下会吞内容，只出一个镜）
        ...(targetModel === 'gpt-5.4-mini' ? { reasoning_effort: "low" } : targetModel === 'gpt-5.4-nano' ? { reasoning_effort: "medium" } : {}),
        // ★ Kimi 2.6：thinking 预算 32000（16000 仍不够处理长提示词+结构化JSON），加 temperature 稳定输出
        ...(['kimi-k2.6'].includes(targetModel) ? { thinking: { type: "enabled", budget_tokens: 32000 }, temperature: 0.3 } : {}),
        prompt_type: "fission-stage1",
        params: {
          NEXT_SHOT_START: nextShotStart,
          DIRECTOR_CONTEXT: directorCtx?.llmContextBlock || ''
        },
        user_content: (() => {
          const fullText = data.text || '';
          const targetText = realSelectedText || fullText;

          // ★ 组装辅助参考（画布已有分镜、资产字典、摄影参数）
          let auxParts: string[] = [];
          if (existingShotsSummary) auxParts.push(`画布已有分镜索引：${existingShotsSummary}`);
          if (dictText) auxParts.push(dictText);
          if (data.globalCamera) auxParts.push(`全局摄影参数：${data.globalCamera}`);

          // ★ 对话上下文（用户与AI协商的分镜方案）
          //    优先使用直接传入的参数（避免 React 状态更新异步导致读不到）
          const dialogueCtx = dialogueContext ?? data._dialogueContext;
          if (dialogueCtx) {
            auxParts.push(`【★ 用户与AI协商确认的分镜拆分方案】
以下对话记录了用户与AI助手协商分镜的全过程。请从中提取最终确认的拆分方案（每个镜号对应的原文片段覆盖范围），按此填充生产级JSON，不要再重新决策如何拆分。

[协商对话]
${dialogueCtx}
[协商结束]

请严格按照上述协商结果填充生产参数。`);
            // 使用后清除，避免下次裂变误用旧上下文
            updateNodeData(id, { _dialogueContext: undefined });
          }

          let promptBody = '';

          // ★ 块①：目标选段（最前面——LLM 顺序处理，先看到先拆分）
          promptBody += '═══════════════════════════════════════\n';
          promptBody += '★★★ 以下为本次需要拆分的目标文本 ★★★\n';
          promptBody += '═══════════════════════════════════════\n';
          promptBody += targetText;
          promptBody += '\n═══════════════════════════════════════\n\n';

          // ★ 块②：完整剧本附录（放最后——LLM 拆分完目标文本后才看到，仅作背景参考）
          promptBody += '---\n';
          promptBody += '📎 附录：完整剧本（仅供理解故事背景，目标文本已在上方拆分完毕，附录内容无需再次处理）\n';
          promptBody += '---\n';
          promptBody += fullText;
          promptBody += '\n---\n\n';

          // ★ 块③：辅助参考
          if (auxParts.length > 0) {
            promptBody += '【辅助参考】\n';
            promptBody += auxParts.join('\n\n');
          }

          return promptBody;
        })()
      };

      // ★ 流式请求：用 onThinking 回调感知模型思考状态，用 onChunk 感知实际内容产出
      // 思考中 → 进度条显示"模型思考中..."（液态玻璃呼吸动画）
      // 有内容 → 进度条切换为"分镜 JSON 生成中..."（流光动画）
      let phase1Ticker = 0;
      const phase1Texts = ['分镜拆解中.', '分镜拆解中..', '分镜拆解中...'];
      phase1Interval = setInterval(() => {
        phase1Ticker = (phase1Ticker + 1) % phase1Texts.length;
        useAppStore.getState().setFissionProgress({ status: 'stage1', phase: phase1Texts[phase1Ticker], mode: 'generating' });
      }, 800);
      const raw1 = await fetchStreamingChat(payloadStage1,
        (text) => {
          // ★ 收到实际内容时：停止点号循环，切换为"生成中"模式
          if (phase1Interval) clearInterval(phase1Interval);
          useAppStore.getState().setFissionProgress({ status: 'stage1', phase: '分镜 JSON 生成中...', mode: 'generating' });
        },
        abortController.signal,
        () => {
          // ★ 模型开始推理思考时：立即停止点号循环，切换为"思考中"呼吸动画
          if (phase1Interval) clearInterval(phase1Interval);
          useAppStore.getState().setFissionProgress({ status: 'stage1', phase: '模型正在理解剧本结构...', mode: 'thinking' });
        },
        () => {
          // ★ 收到首个 SSE 块（上游已接收请求）：切换为"已连接"微光脉冲态
          if (phase1Interval) clearInterval(phase1Interval);
          useAppStore.getState().setFissionProgress({ status: 'stage1', phase: '模型已连接，正在处理...', mode: 'connected' });
        }
      );
      clearInterval(phase1Interval);
      if (!raw1) throw new Error("阶段1：LLM未返回有效内容");
      console.log('[Canvas Fission Debug] Stage 1 raw1 received', {
        length: raw1.length,
        preview: raw1.slice(0, 500),
        tail: raw1.slice(-500)
      });
      let cleanJson1 = raw1;
      const match1 = raw1.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match1) {
          cleanJson1 = match1[1];
      } else {
          const start = raw1.indexOf('{');
          const end = raw1.lastIndexOf('}');
          if (start !== -1 && end !== -1 && end >= start) cleanJson1 = raw1.substring(start, end + 1);
      }
      console.log('[Canvas Fission Debug] Stage 1 cleaned JSON candidate', {
        length: cleanJson1.length,
        hasCodeFence: !!match1,
        preview: cleanJson1.slice(0, 500),
        tail: cleanJson1.slice(-500)
      });
      
      // ★ 字符级扫描：修复 LLM 在 JSON 字符串值中输出的中文对话引号
      // 逐字符追踪 JSON 字符串内外状态，4 种对话引号上下文自动转义
      cleanJson1 = escapeChineseDialogueQuotes(cleanJson1);
      
      // ★ JSON 修复兜底：LLM 偶尔输出畸形 JSON（尾逗号/未转义引号/注释等），先尝试直接解析，失败则逐层修复
      let json1: any;
      try {
          json1 = JSON.parse(cleanJson1.trim());
      } catch (e1: any) {
          console.warn('[JSON Repair L0] 直接解析失败:', e1.message?.slice(0, 100), '| 出错位置附近:', cleanJson1.slice(Math.max(0, (e1.message?.match(/position (\d+)/)?.[1] || 100) - 80), (e1.message?.match(/position (\d+)/)?.[1] || 100) + 80));
          // 修复 1：移除尾逗号
          let fixed = cleanJson1.replace(/,\s*([}\]])/g, '$1');
          try { json1 = JSON.parse(fixed.trim()); } catch (e2: any) {
              console.warn('[JSON Repair L1] 去尾逗号后仍失败:', e2.message?.slice(0, 100), '| 出错位置附近:', fixed.slice(Math.max(0, (e2.message?.match(/position (\d+)/)?.[1] || 100) - 80), (e2.message?.match(/position (\d+)/)?.[1] || 100) + 80));
              // 修复 2：移除 JS 注释
              fixed = fixed.replace(/\/\/[^\n]*\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
              try { json1 = JSON.parse(fixed.trim()); } catch (e3: any) {
                  console.warn('[JSON Repair L2] 去注释后仍失败:', e3.message?.slice(0, 100), '| 出错位置附近:', fixed.slice(Math.max(0, (e3.message?.match(/position (\d+)/)?.[1] || 100) - 80), (e3.message?.match(/position (\d+)/)?.[1] || 100) + 80));
                  // 修复 3：尝试用正则提取 shots 数组
                  const shotsMatch = cleanJson1.match(/"shots"\s*:\s*(\[[\s\S]*\])/);
                  if (shotsMatch) {
                      fixed = '{ "shots": ' + shotsMatch[1] + ' }';
                      try { json1 = JSON.parse(fixed.trim()); } catch (e4: any) {
                          console.warn('[JSON Repair L3] 正则提取后仍失败:', e4.message?.slice(0, 100), '| 出错位置附近:', fixed.slice(Math.max(0, (e4.message?.match(/position (\d+)/)?.[1] || 100) - 80), (e4.message?.match(/position (\d+)/)?.[1] || 100) + 80));
                          // 修复 4：逐个提取 shot 对象（按 "shotNumber" 分界，容错对话中的未转义引号）
                          try {
                              const shotObjects: any[] = [];
                              // 找到所有 shotNumber 的位置，向前找 {，向后找匹配的 }
                              const shotKeyRegex = /"shotNumber"\s*:\s*"/g;
                              let match: RegExpExecArray | null;
                              const positions: number[] = [];
                              while ((match = shotKeyRegex.exec(shotsMatch[1])) !== null) {
                                  positions.push(match.index + match[0].length);
                              }
                              for (let i = 0; i < positions.length; i++) {
                                  const shotStart = positions[i];
                                  // 从这个位置向前找最近的非转义 {
                                  const textBefore = shotsMatch[1].substring(0, shotStart);
                                  const braceIdx = textBefore.lastIndexOf('{');
                                  if (braceIdx === -1) continue;
                                  // 从这个 { 开始计数，找到匹配的 }
                                  let depth = 0;
                                  let endIdx = braceIdx;
                                  let inString = false;
                                  let escapeNext = false;
                                  for (let j = braceIdx; j < shotsMatch[1].length; j++) {
                                      const ch = shotsMatch[1][j];
                                      if (escapeNext) { escapeNext = false; continue; }
                                      if (ch === '\\') { escapeNext = true; continue; }
                                      if (ch === '"') { inString = !inString; continue; }
                                      if (inString) continue;
                                      if (ch === '{') depth++;
                                      if (ch === '}') { depth--; if (depth === 0) { endIdx = j + 1; break; } }
                                  }
                                  const shotJson = shotsMatch[1].substring(braceIdx, endIdx);
                                  try {
                                      shotObjects.push(JSON.parse(shotJson));
                                  } catch { /* 个别shot解析失败，跳过 */ }
                              }
                              if (shotObjects.length > 0) {
                                  json1 = { shots: shotObjects };
                              } else {
                                  throw new Error('no shots extracted');
                              }
                          } catch {
                              console.error('[Stage 1 JSON 修复失败 - 原始LLM输出]:', raw1.substring(0, 3000));
                              throw new Error("JSON修复失败，模型返回数据格式异常");
                          }
                      }
                  } else {
                      console.error('[Stage 1 JSON 修复失败 - 未找到shots数组 - 原始LLM输出]:', raw1.substring(0, 3000));
                      throw new Error("JSON修复失败，模型返回数据格式异常");
                  }
              }
          }
      }

      if (!json1.shots) throw new Error("大模型返回的数据缺少 shots 字段");
      console.log('[Canvas Fission Debug] Stage 1 parsed shots', {
        shotsCount: json1.shots.length,
        firstShotNumber: json1.shots[0]?.shotNumber,
        lastShotNumber: json1.shots[json1.shots.length - 1]?.shotNumber,
        shotNumbers: json1.shots.slice(0, 10).map((s: any) => s.shotNumber)
      });
      // ★★★ 诊断日志：检查 Stage 1 输出的 shotLighting 是否含约束文本
      const taintedShots = json1.shots.filter((s: any) => s.shotLighting?.includes('Photorealistic') || s.shotLighting?.includes('粗糙皮肤'));
      if (taintedShots.length > 0) {
        console.log(`[Stage 1 输出 - ${taintedShots.length}个shot的shotLighting含约束文本]:`, taintedShots.map((s: any) => ({ shotNumber: s.shotNumber, shotLighting: s.shotLighting })));
      }

      // ==========================================
      // 🚀 工业级管道 2: 首帧静帧提取 (安全独立保护)
      // ==========================================
      let json2: any = { imagePrompts: [] };
      try {
        useAppStore.getState().setFissionProgress({ status: 'stage2', phase: '首帧提取中...', mode: 'generating' });
        const payloadStage2 = {
          model: targetModel,
        // ★ DeepSeek V4 Pro：第二阶段也沿用 max 思考强度，保持与 stage1 同一条稳定链路
        ...(targetModel === 'deepseek-v4-flash' ? { thinking: { type: "disabled" }, max_tokens: 65536 } : {}),
        ...(targetModel === 'gpt-5.4-mini' ? { reasoning_effort: "low" } : targetModel === 'gpt-5.4-nano' ? { reasoning_effort: "medium" } : {}),
        ...(['kimi-k2.6'].includes(targetModel) ? { thinking: { type: "enabled", budget_tokens: 32000 }, temperature: 0.3 } : {}),
        prompt_type: "fission-stage2",
          params: {},
          user_content: `【照抄用的英文全局摄影参数】：\n${data.globalCamera}\n\n【需提取首帧图的已拆解分镜结构数组(含已由上级严格定义的shotLighting和物理动作)】：\n${JSON.stringify(json1.shots, null, 2)}`
        };

        let phase2Ticker = 0;
        const phase2Texts = ['首帧提取中.', '首帧提取中..', '首帧提取中...'];
        phase2Interval = setInterval(() => {
          phase2Ticker = (phase2Ticker + 1) % phase2Texts.length;
          useAppStore.getState().setFissionProgress({ status: 'stage2', phase: phase2Texts[phase2Ticker], mode: 'generating' });
        }, 800);
        const raw2 = await fetchStreamingChat(payloadStage2,
          (text) => {
            if (phase2Interval) clearInterval(phase2Interval);
            useAppStore.getState().setFissionProgress({ status: 'stage2', phase: '首帧咒语生成中...', mode: 'generating' });
          },
          abortController.signal,
          () => {
            if (phase2Interval) clearInterval(phase2Interval);
            useAppStore.getState().setFissionProgress({ status: 'stage2', phase: '模型正在分析分镜结构...', mode: 'thinking' });
          },
          () => {
            if (phase2Interval) clearInterval(phase2Interval);
            useAppStore.getState().setFissionProgress({ status: 'stage2', phase: '模型已连接，正在处理...', mode: 'connected' });
          }
        );
        if (typeof phase2Interval !== 'undefined') clearInterval(phase2Interval);
        
        if (raw2) {
          console.log('[Canvas Fission Debug] Stage 2 raw2 received', {
            length: raw2.length,
            preview: raw2.slice(0, 500)
          });
          let cleanJson2 = raw2;
          const match2 = raw2.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match2) {
              cleanJson2 = match2[1];
          } else {
              const start = raw2.indexOf('{');
              const end = raw2.lastIndexOf('}');
              if (start !== -1 && end !== -1 && end >= start) cleanJson2 = raw2.substring(start, end + 1);
          }
          const normalizedJson2 = cleanJson2
            .trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '');
          json2 = JSON.parse(normalizedJson2);
        }
      } catch (err: any) {
        console.error('[Canvas Stage 2 Error] - 原因是：首帧提取非致命失败，已降级使用默认图说明', {
          message: err?.message,
          preview: typeof raw2 === 'string' ? raw2.slice(0, 500) : '',
        }, err);
      } finally {
        if (typeof phase2Interval !== 'undefined') clearInterval(phase2Interval);
      }

      // ==========================================
      // 🚀 缝合输出阶段 (Data Merging)
      // ==========================================
      const fissionResult = {
        shots: json1.shots.map((shot: any, idx: number) => ({
          ...shot,
          imagePrompt: json2.imagePrompts?.[idx] || "待生成静态提示词"
        }))
      };
      console.log('[Canvas Fission Debug] Stage 1 + Stage 2 merged result', {
        mergedShotsCount: fissionResult.shots.length,
        firstShot: fissionResult.shots[0] ? {
          shotNumber: fissionResult.shots[0].shotNumber,
          hasImagePrompt: !!fissionResult.shots[0].imagePrompt,
          hasSpatialLayout: !!fissionResult.shots[0].spatialLayout,
          hasShotLighting: !!fissionResult.shots[0].shotLighting
        } : null,
        lastShot: fissionResult.shots.length > 0 ? {
          shotNumber: fissionResult.shots[fissionResult.shots.length - 1].shotNumber,
          hasImagePrompt: !!fissionResult.shots[fissionResult.shots.length - 1].imagePrompt
        } : null
      });

      const thisNode = getNodes().find(n => n.id === id);
      const baseX = thisNode ? thisNode.position.x : 0;
      const baseY = thisNode ? thisNode.position.y : 0;

      // ★★★ 网格布局：每组最多 4 列，组间自动避让
      const COLS_PER_ROW = 4;
      const COL_WIDTH = 500;   // 节点宽 + 间距
      const ROW_HEIGHT = 580;  // 节点高 + 间距
      const shotCount = fissionResult.shots.length;

      // 计算新组尺寸
      const groupRows = Math.ceil(shotCount / COLS_PER_ROW);
      const groupContentW = Math.min(shotCount, COLS_PER_ROW) * COL_WIDTH;
      const groupContentH = groupRows * ROW_HEIGHT;

      // 组起始位置：主控节点右侧
      let groupStartX = baseX + 850;
      let groupStartY = baseY - 50;

      // 扫描已有组，向右偏移避免重叠
      const existingGroups = getNodes().filter(n => n.type === 'group');
      const GROUP_PAD_X = 80;
      const GROUP_PAD_TOP = 80;
      const GROUP_PAD_BOT = 60;
      const groupW = groupContentW + GROUP_PAD_X * 2;
      const groupH = groupContentH + GROUP_PAD_TOP + GROUP_PAD_BOT;

      existingGroups.forEach(g => {
        const gw = (g.style as any)?.width || 500;
        const gh = (g.style as any)?.height || 500;
        const gRight = g.position.x + gw;
        const gBottom = g.position.y + gh;
        // 垂直重叠检测：新组Y范围与已有组Y范围有交集
        if (groupStartY < gBottom && groupStartY + groupH > g.position.y) {
          // 水平方向：推到已有组右侧
          if (groupStartX < gRight + 80 && groupStartX + groupW > g.position.x - 80) {
            groupStartX = gRight + 100;
          }
        }
      });

      // 超宽换行：超过 4500px 则换到下一行
      if (groupStartX + groupW > baseX + 4500) {
        groupStartX = baseX + 850;
        const maxBottom = existingGroups.reduce((max, g) => {
          const gb = g.position.y + ((g.style as any)?.height || 500);
          return Math.max(max, gb);
        }, baseY);
        groupStartY = maxBottom + 100;
      }
      
      let newNodes: any[] = [];
      let newEdges: any[] = [];
      let createdShotIds: string[] = []; // ✨ 记录本次生成的节点 ID

      fissionResult.shots.forEach((shot: any, index: number) => {
        // ★ 网格定位：每行最多 4 个，超出换行
        const row = Math.floor(index / COLS_PER_ROW);
        const col = index % COLS_PER_ROW;
        const targetX = groupStartX + GROUP_PAD_X + col * COL_WIDTH;
        const targetY = groupStartY + GROUP_PAD_TOP + row * ROW_HEIGHT;
        const shotId = `shot_${Date.now()}_${index}`;
        
        createdShotIds.push(shotId); // 存入记录
        
        const timeSegmentsText = (shot.timeSegments || []).map((ts: any, i: number) => `【时序段 ${i + 1}】${ts.time}：${ts.action}`).join('\n');
        
        // ★ 从 last timeSegment 的 time 字段提取总时长，并硬性锁死最大不超过 15s
        const rawDuration = parseDurationFromLastTS(shot.timeSegments);
        const actualDuration = Math.min(15, Math.max(3, rawDuration || 5));

        const fullVideoPrompt = [
          `时长：${actualDuration}s`,
          `场景：${shot.scene || '未知'}`,
          `出场人物：${shot.characters || '无'}`,
          '',
          `空间布局：`,
          shot.spatialLayout || '无',
          '',
          `光影：`,
          shot.shotLighting || '无',
          ...(shot.cameraRules ? ['', `机位：`, shot.cameraRules] : []),
          ...(shot.oneTake ? ['', shot.oneTake] : []),
          '',
          '时序演进：',
          timeSegmentsText,
          '',
          `音效：`,
          shot.soundDesign?.audio || '无',
          ...(shot.dialogueRequirements && typeof shot.dialogueRequirements === 'object' ? ['', `对白要求：`, ...Object.entries(shot.dialogueRequirements).map(([role, desc]: [string, any]) => `* ${role}：${typeof desc === 'string' ? desc : JSON.stringify(desc)}`)] : []),
          ...(shot.dialogueRequirements && typeof shot.dialogueRequirements === 'string' ? ['', `对白要求：`, shot.dialogueRequirements] : []),
        ].join('\n');

        // ✨ 裂变默认继承联动机制：新生成的 ShotNode 默认带上中控的 globalRatio 与 globalPromptSuffix
        const globalSettings = useAppStore.getState().canvasSettings;
        const inheritedRatioOverride = globalSettings?.globalRatio || '16:9';
        const inheritedSuffix = globalSettings?.globalPromptSuffix || '';

        // 智能追加后缀
        let finalFirstFrame = shot.imagePrompt || "空镜头。";
        let finalVideoPromptText = fullVideoPrompt;
        if (inheritedSuffix.trim()) {
           finalFirstFrame = `${finalFirstFrame}\n, ${inheritedSuffix}`;
           finalVideoPromptText = `${fullVideoPrompt}\n, ${inheritedSuffix}`;
        }

        const newShot = {
          id: shotId, type: 'shot', 
          position: { x: targetX, y: targetY },
          data: { 
            shotNumber: shot.shotNumber || String(index + 1).padStart(2, '0'), 
            scriptText: shot.scriptFragment || selectedText,
            globalCamera: data.globalCamera, 
            sceneLighting: shot.shotLighting || data.tempSceneLighting,
            status: 'draft', 
            referenceImage: null,
            wordCount: shot.wordCount || 0,
            duration: actualDuration,
            oneTake: shot.oneTake || null,
            spatialLayout: shot.spatialLayout || '',
            cameraRules: shot.cameraRules || '',
            dialogueRequirements: shot.dialogueRequirements || '',
            
            // 记录原始 Prompt 与 已追加后缀印记，防套娃污染
            originalFirstFrameAnchor: shot.imagePrompt || "空镜头。",
            originalVideoPrompt: fullVideoPrompt,
            firstFrameAnchor: finalFirstFrame,
            videoPrompt: finalVideoPromptText,
            lastAppliedSuffix: inheritedSuffix,
            globalRatioOverride: inheritedRatioOverride, // 自动继承全局比例

            // 导演路由引擎上下文（裂变时预计算，供后续生图/生视频使用）
            _directorContext: directorCtx ? {
              lightingPrompt: directorCtx.lightingPrompt,
              cameraPrompt: directorCtx.cameraPrompt,
              genre: directorCtx.genre,
              genreLabel: directorCtx.genreLabel,
              tempo: directorCtx.tempo,
              tempoLabel: directorCtx.tempoLabel,
            } : null,

            isParsing: false
          }
        };

        const newEdge = { 
          id: `e-${id}-${shotId}`, source: id, target: shotId, sourceHandle: 'right', targetHandle: 'left', 
          type: 'default', animated: true, 
          style: { stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1.5, strokeDasharray: '8 8', animationDuration: '10s' } 
        };

        newNodes.push(newShot);
        newEdges.push(newEdge);

        // 如果模型仍给出超长单镜，做节点层安全拆分，避免画布上出现一个塞满内容的长镜头卡片。
        if (rawDuration > 15) {
          const splitShotId = `shot_${Date.now()}_${index}_split`;
          const splitTargetY = targetY + 280;
          const splitSegments = Array.isArray(shot.timeSegments) && shot.timeSegments.length > 1
            ? shot.timeSegments.slice(1)
            : shot.timeSegments;
          const splitDuration = Math.max(3, rawDuration - 10);

          newNodes.push({
            id: splitShotId,
            type: 'shot',
            position: { x: targetX, y: splitTargetY },
            data: {
              ...newShot.data,
              shotNumber: `${newShot.data.shotNumber}B`,
              scriptText: shot.scriptFragment || selectedText,
              duration: Math.min(15, splitDuration),
              timeSegments: splitSegments,
              firstFrameAnchor: shot.imagePrompt || "空镜头。",
              videoPrompt: finalVideoPromptText,
              isParsing: false
            }
          });
          newEdges.push({
            id: `e-${id}-${splitShotId}`,
            source: id,
            target: splitShotId,
            sourceHandle: 'right',
            targetHandle: 'left',
            type: 'default',
            animated: true,
            style: { stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1.5, strokeDasharray: '8 8', animationDuration: '10s' }
          });
          createdShotIds.push(splitShotId);
        }
      });

      if (newNodes.length === 0) {
        throw new Error('模型返回了空分镜结果，未生成任何节点');
      }

      console.log('[Canvas Fission Debug] Nodes ready to render', {
        newNodesCount: newNodes.length,
        newEdgesCount: newEdges.length,
        createdShotIds,
        groupStartX,
        groupStartY,
        groupW,
        groupH,
        shotCount
      });

      // ★ 分组模式：创建 GroupNode 包裹本次裂变的全部 ShotNode
      const groupId = `group_${Date.now()}`;

      const groupNode = {
        id: groupId,
        type: 'group' as const,
        position: { x: groupStartX, y: groupStartY },
        style: { width: groupW, height: groupH, zIndex: -1 },
        data: {
          label: `分镜组 ${(getNodes().filter(n => n.type === 'group').length) + 1}`,
          memberIds: newNodes.map(n => n.id),
        },
      };

      setNodes((nds) => [...nds, groupNode, ...newNodes]);
      setEdges((eds) => [...eds, ...newEdges]);
      
      // ✨ 痛点修复：将生成的 shotIds 数组绑定到书签上
      const newExtractedScene = {
        id: `bookmark_${Date.now()}`,
        text: selectedText,
        start: selectionRange.start,
        end: selectionRange.end,
        targetIds: createdShotIds // 重点在这里
      };
      const updatedExtractedScenes = [...(data.extractedScenes || []), newExtractedScene];

      updateNodeData(id, { sceneInterceptState: 'idle', extractedScenes: updatedExtractedScenes });
      setSelectedText(""); 
      useAppStore.getState().setFissionProgress({ status: 'idle', phase: '', mode: 'generating' }); // ★ 重置进度条
      useAppStore.getState().setToastMsg(`✅ 裂变成功！已生成 ${fissionResult.shots.length} 个分镜卡片。`);

    } catch (error: any) {
      useAppStore.getState().setFissionProgress({ status: 'idle', phase: '', mode: 'generating' }); // ★ 重置进度条
      // ★ AbortError 是用户主动中止，不报错不输出控制台；其他错误正常显示
      if (error?.name !== 'AbortError') {
        console.error("[Canvas Fission Error] - 原因是：裂变解析或渲染失败", error);
        useAppStore.getState().setToastMsg(`裂变失败: ${error.message || '模型返回数据异常'}`);
      }
    } finally {
      // 🔥 最终关闭转圈状态
      useAppStore.getState().setFissionProgress({ status: 'idle', phase: '', mode: 'generating' }); // ★ 兜底重置进度条
      useAppStore.getState().setAbortFission(null); // ★ 清除中止函数
      // ★ 清理 phase interval（防御性：如果在 setInterval 之后、clearInterval 之前抛异常）
      try { if (typeof phase1Interval !== 'undefined') clearInterval(phase1Interval); } catch {}
      try { if (typeof phase2Interval !== 'undefined') clearInterval(phase2Interval); } catch {}
      updateNodeData(id, { isGenerating: false });
    }
  };

  // 🎭 SD2.5 30s 表演 — 创建 SD30sNode（内联对话模式）
  const handleSD30sFission = () => {
    const ta = textareaRef.current;
    const realSelectedText = ta ? ta.value.substring(ta.selectionStart, ta.selectionEnd) : selectedText;
    console.log('[SD30s Debug] handleSD30sFission called, selectedText length:', realSelectedText?.length);
    if (!realSelectedText) {
      useAppStore.getState().setToastMsg('⚠️ 请先在剧本中框选要拆分的段落');
      return;
    }
    // 打开对话模式（复用 dialogueOpen，但标记为 sd30s 模式）
    setSd30sMode(true);
    setDialogueOpen(true);
    setDialogueMessages([]);
    setPreviewReady(false);
    sendSD30sPreviewToLLM(undefined, true);
  };

  // ★ 发送长镜头30s分段估算请求（全程 fission-preview 流式对话，和通用分镜完全一样）
  const sendSD30sPreviewToLLM = async (userMessage?: string, reset?: boolean) => {
    const ta = textareaRef.current;
    const realSelectedText = ta ? ta.value.substring(ta.selectionStart, ta.selectionEnd) : selectedText;
    console.log('[SD30s Debug] sendSD30sPreviewToLLM called, userMessage:', userMessage, 'reset:', reset, 'text length:', realSelectedText?.length);
    if (!realSelectedText && !userMessage) return;
    setDialogueLoading(true);
    setPreviewReady(false);

    const targetModel = resolveLLMModel(data);
    const fullText = ta?.value || data.text || '';
    console.log('[SD30s Debug] model:', targetModel, 'fullText length:', fullText.length);

    const baseMessages = reset ? [] : dialogueMessages;
    const displayUserMsg = userMessage || '请分析我框选的剧本段落，给出30s的分镜方案';
    const newMessages = [...baseMessages, { role: 'user', content: displayUserMsg }];
    setDialogueMessages(newMessages);

    // ★ 使用 sd2.5-30s-preview 提示词（基于 drama-emotion-30s.md v4 规则，替代 fission-preview）
    let userContent = '';
    if (baseMessages.length === 0) {
      // 首次请求：发送剧本全文 + 选中片段，系统 prompt 已包含全部 30s 规则
      userContent = fullText
        ? `【剧本全文】\n${fullText}\n\n【本次需拆解的选中片段】\n${realSelectedText}`
        : `【本次需拆解的选中片段】\n${realSelectedText}`;
    } else {
      // 后续轮次：发送对话历史 + 用户最新消息
      const historyStr = baseMessages
        .map(m => `[${m.role === 'user' ? '用户' : 'AI'}]: ${m.content}`)
        .join('\n\n');
      userContent = `【当前剧本选段】\n${realSelectedText}\n\n【对话历史】\n${historyStr}\n\n【用户最新消息】\n${userMessage || displayUserMsg}`;
    }

    try {
      console.log('[SD30s Debug] sending request, userContent length:', userContent.length);
      // ★ 使用 30s 专属预览 prompt，基于 drama-emotion-30s.md v4 规则
      const sd30sPayload: any = {
        model: targetModel,
        prompt_type: 'sd2.5-30s-preview',
        params: {},
        user_content: userContent,
        stream: true,
      };
      if (targetModel && targetModel.includes('deepseek')) {
        sd30sPayload.thinking = { type: 'disabled' };
      }
      const response = await fetchApi('/v1/canvas/prompt', {
        method: 'POST',
        body: JSON.stringify(sd30sPayload),
        useApiRoute: true, // ★ 走 Next.js API Route，绕开代理缓冲
      });

      console.log('[SD30s Debug] response status:', response.status, response.statusText);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error('[SD30s Debug] HTTP error:', response.status, errText.substring(0, 500));
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        console.error('[SD30s Debug] no reader - response.body is null');
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let aiContent = '';
      let buffer = '';
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[SD30s Debug] stream done, total chunks:', chunkCount, 'total content length:', aiContent.length);
          break;
        }
        chunkCount++;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              if (aiContent.length === 0) console.log('[SD30s Debug] first content chunk received, delta length:', delta.length);
              aiContent += delta;
              setDialogueMessages([...newMessages, { role: 'assistant', content: aiContent }]);
            }
          } catch (e) {
            console.warn('[SD30s Debug] SSE parse error for line:', jsonStr.substring(0, 100));
          }
        }
      }

      if (aiContent) {
        console.log('[SD30s Debug] preview ready, total:', aiContent.length);
        setPreviewReady(true);
      } else {
        console.warn('[SD30s Debug] stream completed but no content received');
      }
    } catch (err: any) {
      console.error('[SD30s Debug] error:', err?.message || err);
      setDialogueMessages([...newMessages, { role: 'assistant', content: `抱歉，请求失败: ${err.message || '未知错误'}` }]);
    } finally {
      setDialogueLoading(false);
    }
  };

  /** 解析 LLM 输出的【确认分段】格式，返回段标签+内容数组 */
  function parseSD30sSegments(text: string): { label: string; content: string }[] {
    if (!text.includes('【确认分段】')) return [];
    const segments: { label: string; content: string }[] = [];
    // 用 matchAll 一次性收集所有 ===段N=== 块，避免嵌套 exec 的跳过 Bug
    const blockRegex = /===段(\d+)===\s*标签[：:]\s*(.+?)[\r\n]+\s*内容[：:]\s*([\s\S]*?)(?=\n===段|\n*$)/g;
    const matches = text.matchAll(blockRegex);
    for (const match of matches) {
      segments.push({ label: match[2].trim(), content: match[3].trim() });
    }
    return segments;
  }

  // ★ 长镜头30s确认后创建 SD30sNode（支持多段解析）
  const handleSD30sConfirm = useCallback(async () => {
    const ta = textareaRef.current;
    const realSelectedText = ta ? ta.value.substring(ta.selectionStart, ta.selectionEnd) : selectedText;
    if (!realSelectedText) {
      useAppStore.getState().setToastMsg('⚠️ 请先在剧本中框选要拆分的段落');
      return;
    }
    const fullText = ta?.value || data.text || '';
    const thisNode = getNodes().find(n => n.id === id);
    if (!thisNode) return;

    // 先从已有对话中尝试解析分段（如果 LLM 已输出【确认分段】格式）
    const lastAiMsg = dialogueMessages.filter(m => m.role === 'assistant').pop();
    let segments = parseSD30sSegments(lastAiMsg?.content || '');

    // 如果未解析到分段，发送一次最终确认请求让 LLM 输出结构化格式
    if (segments.length === 0) {
      setDialogueLoading(true);
      try {
        const historyStr = dialogueMessages
          .map(m => `[${m.role === 'user' ? '用户' : 'AI'}]: ${m.content}`)
          .join('\n\n');
        const confirmPayload = {
          model: resolveLLMModel(data),
          prompt_type: 'sd2.5-30s-preview',
          params: {},
          user_content: `【当前剧本选段】\n${realSelectedText}\n\n【对话历史】\n${historyStr}\n\n【用户最新消息】\n确认，请严格按照【确认分段】格式输出分段结果`,
          stream: false,
        };
        if (resolveLLMModel(data).includes('deepseek')) {
          (confirmPayload as any).thinking = { type: 'disabled' };
        }
        const resp = await fetchApi('/v1/canvas/prompt', {
          method: 'POST',
          body: JSON.stringify(confirmPayload),
        });
        const respData = await resp.json();
        const aiReply = respData?.choices?.[0]?.message?.content || '';
        segments = parseSD30sSegments(aiReply);
      } catch (err: any) {
        console.error('[SD30s Confirm Error] - 原因是：', err?.message || err);
      } finally {
        setDialogueLoading(false);
      }
    }

    // 记录预览对话中的最后一段方案摘要，透传给各节点
    const dialogueContext = lastAiMsg?.content?.substring(0, 2000) || '';

    if (segments.length > 1) {
      // 多段：每段创建一个节点
      const newNodes: any[] = [];
      const newEdges: any[] = [];
      segments.forEach((seg, idx) => {
        const nodeId = `sd30s_${Date.now()}_${idx}`;
        newNodes.push({
          id: nodeId,
          type: 'sd30s',
          position: { x: thisNode.position.x + 880 + idx * 40, y: thisNode.position.y + idx * 320 },
          data: {
            type: 'sd30s' as const,
            title: `30s · ${seg.label || seg.content.substring(0, 16)}`,
            sceneLabel: seg.label || '',
            status: 'planning' as const,
            selectedText: seg.content || realSelectedText,
            fullText: fullText,
            dialogueContext: dialogueContext, // ★ 预览方案摘要透传
          },
        });
        newEdges.push({
          id: `e-${id}-${nodeId}`,
          source: id,
          target: nodeId,
          sourceHandle: 'right',
          targetHandle: 'left',
          style: { stroke: '#71717a', strokeWidth: 2 },
        });
      });
      setNodes((nds: any) => [...nds, ...newNodes]);
      setEdges((eds: any) => [...eds, ...newEdges]);
      useAppStore.getState().setToastMsg(`🎭 已创建 ${segments.length} 个长镜头 30s 节点`);
    } else {
      // 单段（或解析失败）：创建单个节点，内容为整段选中文本
      const sd30sId = `sd30s_${Date.now()}`;
      const newNode = {
        id: sd30sId,
        type: 'sd30s',
        position: { x: thisNode.position.x + 880, y: thisNode.position.y },
        data: {
          type: 'sd30s' as const,
          title: `长镜头 30s · ${realSelectedText.substring(0, 20)}${realSelectedText.length > 20 ? '...' : ''}`,
          sceneLabel: '',
          status: 'planning' as const,
          selectedText: realSelectedText,
          fullText: fullText,
          dialogueContext: dialogueContext, // ★ 预览方案摘要透传
        },
      };
      const newEdge = {
        id: `e-${id}-${sd30sId}`,
        source: id,
        target: sd30sId,
        sourceHandle: 'right',
        targetHandle: 'left',
        style: { stroke: '#71717a', strokeWidth: 2 },
      };
      setNodes((nds: any) => [...nds, newNode]);
      setEdges((eds: any) => [...eds, newEdge]);
      useAppStore.getState().setToastMsg('🎭 已创建 1 个长镜头 30s 节点');
    }

    // 关闭对话面板
    setSd30sMode(false);
    setDialogueOpen(false);
    setDialogueMessages([]);
    setPreviewReady(false);
  }, [id, selectedText, getNodes, setNodes, setEdges, dialogueMessages, data]);

  const handleFissionTable = async () => {
    if (data.isGenerating || !selectedText) return;
    // ★ 防止与其他进度条冲突
    if (useAppStore.getState().fissionProgress.status !== 'idle') {
      useAppStore.getState().setToastMsg("⚠️ 请等待当前操作完成后再生成表格");
      return;
    }
    updateNodeData(id, { isGenerating: true });

    // ★ AbortController + 统一进度条
    const abortController = new AbortController();
    useAppStore.getState().setAbortFission(() => {
      abortController.abort();
      useAppStore.getState().setToastMsg("⏹️ 已中止表格生成");
    });
    let phaseInterval: NodeJS.Timeout | undefined;

    // ★ 启动进度条
    useAppStore.getState().setFissionProgress({ status: 'table', phase: '表格生成中.', mode: 'generating' });
    const phaseTexts = ['表格生成中.', '表格生成中..', '表格生成中...'];
    let ticker = 0;
    phaseInterval = setInterval(() => {
      ticker = (ticker + 1) % phaseTexts.length;
      useAppStore.getState().setFissionProgress({ status: 'table', phase: phaseTexts[ticker], mode: 'generating' });
    }, 800);

    try {
      const targetModel = resolveLLMModel(data);

      const payload = {
        model: targetModel,
        prompt_type: "field-notes",
        params: {},
        user_content: `剧本选段：\n${selectedText}\n\n全局摄影参数（照抄注入生图提示词）：\n${data.globalCamera || '无'}\n\n请生成场记表 JSON。`
      };

      const rawContent = await fetchStreamingChat(payload, undefined, abortController.signal);
      let cleanJson = rawContent;
      const match = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) cleanJson = match[1];
      const parsedRows = JSON.parse(cleanJson.trim());

      if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
        throw new Error("LLM 返回了空的表格数据");
      }

      // ✨ 注入全局摄影参数到每行的 imgPrompt
      const cameraSuffix = data.globalCamera ? `, ${data.globalCamera}` : '';
      const finalRows = parsedRows.map((row: any, idx: number) => ({
        ...row,
        id: `row_${Date.now()}_${idx}`,
        shotNumber: row.shotNumber || String(idx + 1).padStart(2, '0'),
        imgPrompt: (row.imgPrompt || row.imgDesc || '') + cameraSuffix,
      }));

      const thisNode = getNodes().find(n => n.id === id);
      const baseX = thisNode ? thisNode.position.x : 0;
      const baseY = thisNode ? thisNode.position.y : 0;
      const existingTablesCount = getNodes().filter(n => n.type === 'scriptTable').length;

      const tableId = `table_${Date.now()}`;
      const newTable = {
        id: tableId, type: 'scriptTable',
        position: { x: baseX + 650, y: baseY + (existingTablesCount * 600) },
        data: {
          scriptText: selectedText,
          globalCamera: data.globalCamera,
          sceneLighting: data.tempSceneLighting,
          status: 'draft',
          rows: finalRows
        }
      };

      const newEdge = { id: `e-${id}-${tableId}`, source: id, target: tableId, sourceHandle: 'right', targetHandle: 'left', type: 'default', animated: true, style: { stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1.5, strokeDasharray: '8 8', animationDuration: '10s' } };

      setNodes((nds) => [...nds, newTable]);
      setEdges((eds) => [...eds, newEdge]);

      const newExtractedScene = { id: tableId, text: selectedText, start: selectionRange.start, end: selectionRange.end };
      const updatedExtractedScenes = [...(data.extractedScenes || []), newExtractedScene];

      updateNodeData(id, { isGenerating: false, sceneInterceptState: 'idle', extractedScenes: updatedExtractedScenes });
      setSelectedText("");
      useAppStore.getState().setFissionProgress({ status: 'idle', phase: '', mode: 'generating' });
      useAppStore.getState().setToastMsg(`✅ 表格型脚本生成完毕！共 ${finalRows.length} 行`);

    } catch (error: any) {
      console.error("[Table Gen Error]", error);
      useAppStore.getState().setFissionProgress({ status: 'idle', phase: '', mode: 'generating' });
      if (error?.name !== 'AbortError') {
        useAppStore.getState().setToastMsg(`表格生成失败: ${error.message}`);
      }
    } finally {
      useAppStore.getState().setFissionProgress({ status: 'idle', phase: '', mode: 'generating' });
      useAppStore.getState().setAbortFission(null);
      if (phaseInterval) clearInterval(phaseInterval);
      updateNodeData(id, { isGenerating: false });
    }
  };

  // ★★★ Copilot 画布操作监听器：当 _copilotAction 被设置时，自动触发对应的画布操作 ★★★
  useEffect(() => {
    const action = data._copilotAction;
    if (!action) return;

    // 立即清除触发标志（防止重复触发）
    updateNodeData(id, { _copilotAction: null });

    const runAction = async () => {
      try {
        if (action.type === 'fission') {
          // 裂变分镜：使用全部剧本内容
          if (!data.text) {
            useAppStore.getState().setToastMsg("⚠️ 请先输入剧本内容");
            return;
          }
          if (!selectedText) setSelectedText(data.text);
          setTimeout(() => handleFissionShots(), 100);
        } else if (action.type === 'camera') {
          if (!data.text) {
            useAppStore.getState().setToastMsg("⚠️ 请先输入剧本内容");
            return;
          }
          handleExtractCamera();
        } else if (action.type === 'asset') {
          if (!data.text) {
            useAppStore.getState().setToastMsg("⚠️ 请先输入剧本内容");
            return;
          }
          const subType = (action as any).subType || 'all';
          if (subType === 'all') {
            getOrOpenEpisodeSelect('asset', 'scene');
          } else {
            getOrOpenEpisodeSelect('asset', subType);
          }
        } else if (action.type === 'table') {
          if (!data.text) {
            useAppStore.getState().setToastMsg("⚠️ 请先输入剧本内容");
            return;
          }
          if (!selectedText) setSelectedText(data.text);
          setTimeout(() => handleFissionTable(), 100);
        }
      } catch (e) {
        console.error('[Copilot Action Error]', e);
      }
    };

    runAction();
  }, [data._copilotAction]);

  return (
    <>
    <div className="relative group/node z-30 flex flex-col" style={{ width: '100%', height: '100%', minWidth: '880px', minHeight: '520px' }}>
      <NodeResizeControl minWidth={880} minHeight={520} position="bottom-right" style={{ background: 'transparent', border: 'none', width: '20px', height: '20px', right: '12px', bottom: '12px' }}>
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-zinc-600 hover:text-white cursor-se-resize opacity-0 group-hover/node:opacity-100 transition-opacity drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
             <polyline points="21 15 21 21 15 21"></polyline><line x1="21" y1="21" x2="15" y2="15"></line>
         </svg>
      </NodeResizeControl>
      
      <Handle type="source" position={Position.Right} id="right" className={handleRight} />
      
      {/* ★ 主卡片：MasterScriptNode 专属中性渐变 */}
      <div className={`w-full h-full flex-1 ${nodeBaseClass} glass-card-master ${selected ? selectedBorderClass : ''} flex flex-col p-5 overflow-hidden`}>
        
        {/* ── 头部：标题左 + 功能按钮右 ── */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.05] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[10px] bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
              <Type size={14} className="text-zinc-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-bold text-white tracking-widest">主剧本控制台</span>
              <span className="text-[9px] text-zinc-500 font-mono tracking-wider mt-0.5">MASTER SCRIPT 2.1</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 按集选择按钮 */}
            <button
              onClick={() => { getOrOpenEpisodeSelect('fission'); }}
              disabled={data.isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium text-zinc-400 bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:text-white transition-all nodrag"
            >
              <List size={12} />
              按集选择
            </button>

            {/* 摄影机锁定按钮 */}
            <button
              onClick={handleExtractCamera}
              disabled={data.isExtractingCamera}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium transition-all nodrag ${
                data.globalCamera
                  ? 'bg-white/[0.06] border-white/[0.12] text-zinc-300'
                  : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {data.isExtractingCamera ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              {data.globalCamera ? '摄影机已锁定' : '锚定摄影机'}
            </button>

            {/* 资产提取按钮（摄影机锁定后才显示） */}
            {data.globalCamera && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAssetMenu(!showAssetMenu); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium transition-all nodrag ${
                    showAssetMenu || extractingAsset
                      ? 'bg-white/[0.08] border-white/[0.15] text-white'
                      : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  {extractingAsset ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
                  资产提取
                  <ChevronDown size={12} className={showAssetMenu ? "rotate-180 transition-transform" : "transition-transform"} />
                </button>
                {showAssetMenu && (
                  <div className="absolute top-[calc(100%+6px)] right-0 w-[150px] bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/[0.12] rounded-[12px] shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 nodrag">
                    <button onClick={() => handleExtractAssetTable('scene')} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-300 hover:text-white hover:bg-white/[0.08] rounded-[8px] transition-all text-left"><Map size={12} className="text-zinc-400" /> 提取场景表</button>
                    <button onClick={() => handleExtractAssetTable('character')} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-300 hover:text-white hover:bg-white/[0.08] rounded-[8px] transition-all text-left"><Users size={12} className="text-zinc-400" /> 提取角色表</button>
                    <button onClick={() => handleExtractAssetTable('prop')} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-300 hover:text-white hover:bg-white/[0.08] rounded-[8px] transition-all text-left"><Package size={12} className="text-zinc-400" /> 提取道具表</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── 内容区：左右分栏（对话展开时三栏）── */}
        <div className="flex-1 flex gap-4 mt-4 min-h-0">

          {/* 左栏：摄影机预设 + 剧本 */}
          <div className="flex flex-col gap-3 min-h-0 w-[55%]">
            {/* 摄影机预设（可折叠） */}
            {data.globalCamera && (
              <div className="shrink-0 p-3 bg-black/30 rounded-[12px] border border-white/[0.04]">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">
                  全局摄影机预设 (Global Camera)
                </label>
                <textarea
                  data-node-id={id} data-field="globalCamera" data-field-label="全局摄影机预设"
                  className="bg-transparent border border-white/[0.04] rounded-[8px] p-2 focus:border-white/20 focus:bg-white/[0.02] text-[12px] text-zinc-300 outline-none w-full font-mono transition-colors nodrag nopan resize-none custom-scrollbar"
                  rows={2}
                  value={data.globalCamera}
                  onChange={(e) => updateNodeData(id, { globalCamera: e.target.value })}
                  onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
                />
              </div>
            )}

            {/* 剧本内容容器 */}
            <div className="flex-1 min-h-0 rounded-[14px] border border-white/[0.04] bg-black/20 overflow-hidden flex">
              <div className="w-[2px] bg-white/[0.04] shrink-0" />
              <textarea
                ref={textareaRef}
                className="flex-1 bg-transparent text-[14px] text-zinc-200 placeholder-zinc-600 resize-none outline-none custom-scrollbar leading-relaxed nodrag nopan p-4"
                placeholder="[在此粘贴几万字完整剧情大纲或剧本...]"
                value={data.text || ''}
                onChange={(e) => updateNodeData(id, { text: e.target.value })}
                onSelect={handleTextSelect}
                onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
                data-node-id={id} data-field="text" data-field-label="剧本内容"
              />
            </div>
          </div>

          {/* 右栏：分镜方法 + 预览 + 书签 */}
          <div className="flex flex-col min-h-0 w-[45%]">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1 mb-3 shrink-0">分镜</span>

            {/* ★ 已实现方法：大卡片突出 */}
            <div
              onClick={() => {
                if (dialogueLoading) return;
                if (!selectedText) {
                  useAppStore.getState().setToastMsg('请先在剧本中框选要拆分的段落');
                  return;
                }
                setSd30sMode(false); // 切换到通用分镜模式
                setDialogueOpen(true);
                setDialogueMessages([]);
                setPreviewReady(false);
                sendPreviewToLLM(undefined, true);
              }}
              className={`method-card method-card-active nodrag cursor-pointer mb-4 ${dialogueLoading ? 'opacity-40 pointer-events-none' : ''} ${!selectedText ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-7 h-7 rounded-[8px] bg-white/[0.08] border border-white/[0.1] flex items-center justify-center">
                  <Layers size={14} className="text-zinc-200" />
                </div>
                <span className="text-[13px] font-bold text-white tracking-wider">通用分镜</span>
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50" />
              </div>
              <div className="text-[11px] text-zinc-400 leading-relaxed">
                {selectedText ? `已选 ${selectedText.length} 字 · 点击开始预览` : '框选剧本后点击执行'}
              </div>
            </div>

            {/* ★ 长镜头 30s 方法卡片（已实现） */}
            <div
              onClick={() => {
                if (dialogueLoading) return;
                if (!selectedText) {
                  useAppStore.getState().setToastMsg('请先在剧本中框选要拆分的段落');
                  return;
                }
                handleSD30sFission();
              }}
              className={`method-card method-card-active nodrag cursor-pointer mb-4 ${!selectedText ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-7 h-7 rounded-[8px] bg-white/[0.08] border border-white/[0.1] flex items-center justify-center">
                  <Film size={14} className="text-zinc-200" />
                </div>
                <span className="text-[13px] font-bold text-white tracking-wider">长镜头 30s - seedance 2.5</span>
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50" />
              </div>
              <div className="text-[11px] text-zinc-400 leading-relaxed">
                {selectedText ? `已选 ${selectedText.length} 字 · 点击执行` : '框选剧本后点击执行'}
              </div>
            </div>

            {/* ★ 分割线 */}
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <div className="flex-1 h-px bg-white/[0.04]" />
              <span className="text-[9px] text-zinc-600 font-mono tracking-wider">即将上线</span>
              <div className="flex-1 h-px bg-white/[0.04]" />
            </div>

            {/* ★ 未实现方法：紧凑列表 */}
            <div className="flex flex-col gap-0.5 shrink-0">
              {([
                { key: 'long15s' as const, Icon: Film, label: '长镜头 15s' },
                { key: 'table' as const, Icon: Table, label: '表格分镜' },
              ]).map(m => (
                <div
                  key={m.key}
                  onClick={() => useAppStore.getState().setToastMsg(`⏳ ${m.label}即将上线`)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-zinc-600/50 cursor-pointer hover:bg-white/[0.02] hover:text-zinc-500 transition-all nodrag"
                >
                  <m.Icon size={13} />
                  <span className="text-[11px] font-medium">{m.label}</span>
                  <span className="ml-auto text-[9px] text-zinc-700">即将上线</span>
                </div>
              ))}
            </div>

            {/* ★ 空状态：未打开分镜预览时，居中展示引导文字 */}
            {!dialogueOpen && (
              <div className="flex-1 flex flex-col items-center justify-center min-h-0 mt-3 nodrag" style={{ cursor: 'default' }}>
                <div className="text-center px-2">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/[0.03] mb-5">
                    <Clapperboard size={20} className="text-zinc-500" />
                  </div>
                  <p className="text-[13px] font-semibold text-zinc-400 tracking-wider mb-5">分镜预览</p>
                  <p className="text-[12px] text-zinc-500 leading-relaxed">
                    选定剧本段落，选择适合你的分镜方法
                  </p>
                  <p className="text-[12px] text-zinc-500 leading-relaxed mt-1.5">
                    AI 解析叙事结构，输出分镜预案
                  </p>
                  <p className="text-[12px] text-zinc-500 leading-relaxed mt-1.5">
                    多轮协商调整后，确认执行裂变
                  </p>
                </div>
              </div>
            )}

            {/* ★ 分镜预览区（点击通用分镜后显示，flex-1 自动填满） */}
            {dialogueOpen && (
              <div
                className="flex-1 flex flex-col min-h-0 mt-3 border-t border-white/[0.05] pt-3"
                onWheelCapture={(e) => e.stopPropagation()}
              >
                {/* 预览头部 */}
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    {sd30sMode ? '长镜头30s预览' : '分镜预览'}{dialogueLoading ? ' · 分析中' : previewReady ? ' · 完成' : ''}
                  </span>
                  <button
                    onClick={() => { setSd30sMode(false); setDialogueOpen(false); setDialogueMessages([]); setPreviewReady(false); }}
                    className="text-zinc-600 hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* 消息列表（nodrag + userSelect:text 允许选中文字复制） */}
                <div
                  className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 mb-2 min-h-0 nodrag nowheel"
                  style={{ cursor: 'default' }}
                  onWheelCapture={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {dialogueMessages.length === 0 && dialogueLoading ? (
                    <div className="flex items-center gap-2 text-zinc-500 text-[12px] py-4">
                      <Loader2 size={14} className="animate-spin" />
                      AI 分析中...
                    </div>
                  ) : (
                    dialogueMessages.map((msg, i) => (
                      <div key={i} className={`${msg.role === 'assistant' ? 'dialogue-bubble-ai' : 'dialogue-bubble-user'}`} style={{ userSelect: 'text', cursor: 'text' }}>
                        <div className="whitespace-pre-wrap text-[12px] leading-relaxed" style={{ userSelect: 'text', cursor: 'text' }}>{msg.content}</div>
                      </div>
                    ))
                  )}
                </div>

                {/* 输入区 */}
                <div className="flex gap-1.5 shrink-0">
                  <input
                    type="text"
                    value={dialogueInput}
                    onChange={(e) => setDialogueInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && dialogueInput.trim() && !dialogueLoading) {
                        sendPreviewToLLM(dialogueInput.trim());
                        setDialogueInput('');
                      }
                    }}
                    placeholder="输入调整意见，回车发送..."
                    disabled={dialogueLoading}
                    className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-[8px] px-2.5 py-1.5 text-[12px] text-zinc-200 placeholder-zinc-600 outline-none focus:border-white/[0.15] transition-colors disabled:opacity-40"
                  />
                  <button
                    onClick={() => {
                      if (dialogueInput.trim() && !dialogueLoading) {
                        sendPreviewToLLM(dialogueInput.trim());
                        setDialogueInput('');
                      }
                    }}
                    disabled={!dialogueInput.trim() || dialogueLoading}
                    className="px-2.5 py-1.5 rounded-[8px] bg-white/[0.06] border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.1] transition-all disabled:opacity-30"
                  >
                    <Send size={13} />
                  </button>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center justify-between mt-2 shrink-0">
                  <button
                    onClick={() => { setSd30sMode(false); setDialogueOpen(false); setDialogueMessages([]); setPreviewReady(false); }}
                    className="px-3 py-1 rounded-[8px] text-[11px] text-zinc-500 hover:text-white hover:bg-white/[0.05] transition-all"
                  >
                    放弃
                  </button>
                  <button
                    disabled={dialogueLoading}
                    onClick={() => {
                      if (dialogueLoading) return;
                      if (sd30sMode) {
                        // 长镜头30s模式：直接调用 handleSD30sConfirm
                        handleSD30sConfirm();
                      } else {
                        // 通用分镜模式：原逻辑
                        const dialogueContext = dialogueMessages.map(m => `[${m.role}]: ${m.content}`).join('\n');
                        if (!dialogueContext) {
                          useAppStore.getState().setToastMsg('预览对话为空，请先完成分镜预览');
                          return;
                        }
                        handleFissionShots(dialogueContext);
                      }
                    }}
                    className={`px-3 py-1 rounded-[8px] text-[11px] font-medium transition-all ${
                      dialogueLoading
                        ? 'bg-white/[0.04] border border-white/[0.06] text-zinc-500 cursor-not-allowed'
                        : 'bg-white/[0.1] border border-white/[0.15] text-white hover:bg-white/[0.15] cursor-pointer'
                    }`}
                  >
                    {sd30sMode ? '确认并生成30s节点 →' : '确认并生成分镜 →'}
                  </button>
                </div>
              </div>
            )}

            {/* 书签列表（已拆分镜头） */}
            {data.extractedScenes && data.extractedScenes.length > 0 && (
              <div className="shrink-0 mt-2 flex flex-col gap-1.5 overflow-y-auto custom-scrollbar max-h-[120px]">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">
                  已拆分 ({data.extractedScenes.length})
                </span>
                {data.extractedScenes.map((scene: any, idx: number) => {
                  const isActive = data.activeTargetIds && data.activeTargetIds.length > 0 && data.activeTargetIds[0] === scene.targetIds?.[0];
                  return (
                    <div
                      key={scene.id}
                      onClick={() => {
                        if (textareaRef.current) {
                          textareaRef.current.focus();
                          textareaRef.current.setSelectionRange(scene.start, scene.end);
                          setSelectedText(scene.text);
                          setSelectionRange({ start: scene.start, end: scene.end });
                        }
                        updateNodeData(id, { activeTargetIds: scene.targetIds });
                      }}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] cursor-pointer transition-all nodrag ${
                        isActive
                          ? 'bg-white/[0.08] border border-white/[0.15]'
                          : 'bg-white/[0.02] border border-white/[0.03] hover:bg-white/[0.04] hover:border-white/[0.08]'
                      }`}
                    >
                      <span className={`text-[10px] font-mono font-bold ${isActive ? 'text-white' : 'text-zinc-500'}`}>
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[11px] text-zinc-500 truncate">{scene.text}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>

    {/* ★ 集数选择弹窗（资产提取 / 分镜按集选择 共用） */}
    {showEpisodeSelect && (
      <EpisodeSelectModal
        scriptText={data.text || ''}
        title={episodeSelectMode === 'fission' ? '选择裂变范围' : `选择${episodeSelectAssetType === 'scene' ? '场景' : episodeSelectAssetType === 'character' ? '角色' : '道具'}提取范围`}
        confirmLabel={episodeSelectMode === 'fission' ? '确认选择' : '确认提取'}
        preloadedEpisodes={cachedEpisodesForModal || undefined}
        onEpisodesDetected={handleEpisodesDetected}
        onConfirm={handleEpisodeConfirm}
        onCancel={() => { setShowEpisodeSelect(false); setCachedEpisodesForModal(null); }}
      />
    )}

  </>
  );
};
export const MasterScriptNode = React.memo(_MasterScriptNode);
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// 2. 独立分镜节点 (ShotNode) —— 双轨质检员 + 参数胶囊
// ==========================================
// ★★★ 全景制作辅助函数：从图片/分镜节点创建全景图节点
// 被 MediaNode 和 ShotNode 的悬浮工具栏「全景制作」按钮调用
const handleCreatePanorama = (sourceId: string, sourceData: any, getNodes: any, setNodes: any, setEdges: any) => {
  const sourceNode = getNodes().find((n: any) => n.id === sourceId);
  if (!sourceNode) return;

  // 取源节点的场景描述和参考图
  const sourcePrompt = sourceData.firstFrameAnchor || sourceData.prompt || sourceData.videoPrompt || '';
  const sourceImage = sourceData.resultUrl || sourceData.frameUrl || '';

  // 创建全景图节点，放在源节点右侧
  const panoramaId = `panorama_${Date.now()}`;
  const newNode = {
    id: panoramaId,
    type: 'panorama',
    position: { x: sourceNode.position.x + 550, y: sourceNode.position.y },
    data: {
      prompt: sourcePrompt,
      ratio: '21:9', // 全景默认超宽比例
      model: sourceData.model || '',
      quality: sourceData.quality || '2K',
      referenceImage: sourceImage, // 源节点的图片作为参考底图
      status: 'draft',
    }
  };

  // 创建从源节点到全景节点的连线
  const newEdge = {
    id: `e-${sourceId}-${panoramaId}-${Date.now()}`,
    source: sourceId,
    target: panoramaId,
    sourceHandle: 'right',
    targetHandle: 'left',
    style: { stroke: '#71717a', strokeWidth: 2, strokeDasharray: '5,5' }, // 全景连线
  };

  setNodes((nds: any) => [...nds, newNode]);
  setEdges((eds: any) => [...eds, newEdge]);
  useAppStore.getState().setToastMsg('🌐 全景图节点已创建！点击节点内「生成全景图」开始');
};

const _ShotNode = ({ id, data, selected }: any) => {
  const { updateNodeData, getNodes, setNodes, setEdges, getEdges } = useReactFlow();
  const edges = useEdges(); const nodes = useNodes();

  const markDownstreamDirty = () => {
    const connectedEdges = getEdges().filter(e => e.source === id);
    connectedEdges.forEach(edge => {
      const targetNode = getNodes().find(n => n.id === edge.target);
      if (targetNode && targetNode.type === 'videoClip' && targetNode.data.status === 'done') {
        updateNodeData(targetNode.id, { isDirty: true });
      }
    });
  };
  const status = data.status || 'draft';
  const [zenMode, setZenMode] = useState<any>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showHDSettings, setShowHDSettings] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  
  // ✨ 新增下拉框状态
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [brushColor, setBrushColor] = useState('#ff0000');
  const [brushSize, setBrushSize] = useState(4);
  const imgRef = useRef<HTMLImageElement>(null);

  const activeRatio = data.ratio || data.globalRatioOverride || '16:9';
  // ★ 图片真实比例自适应
  const shotImageDims = useMediaDimensions(data.frameUrl || data.resultUrl);
  const currentStyle = shotImageDims
    ? { width: (RATIO_ASPECT_ONLY[activeRatio] || RATIO_ASPECT_ONLY['16:9']).width, aspectRatio: String(shotImageDims.width / shotImageDims.height) }
    : (RATIO_ASPECT_ONLY[activeRatio] || RATIO_ASPECT_ONLY['16:9']);

  const incomingAssets = useMemo(() => edges.filter(e => e.target === id).map(e => {
    const srcNode = nodes.find(n => n.id === e.source);
    if (srcNode?.data?.asset) return { ...srcNode.data.asset, name: srcNode.data.name || srcNode.data.asset.prompt };
    const url = srcNode?.data?.resultUrl || srcNode?.data?.frameUrl || srcNode?.data?.videoUrl;
    if (url) {
       return { url, _type: url.includes('.mp4') ? 'video' : 'image', prompt: srcNode.data.prompt || srcNode.data.videoPrompt, name: srcNode.data.name || '连线参考' };
    }
    return null;
  }).filter(Boolean), [edges, nodes, id]);

  const { enqueueTask } = useCanvasEngine();
  const showToast = (msg: string) => useAppStore.getState().setToastMsg(msg);

  const availableAssets = useMemo(() => nodes.filter(n => 
    n.type === 'media' && 
    (n.data?.resultUrl || n.data?.asset?.url) && 
    n.id !== id && 
    !edges.some(e => e.source === n.id && e.target === id) 
  ), [nodes, edges, id]);

  // ✨ 新增：自动施法，创建物理连线
  const handleAddAssetEdge = (sourceId: string) => {
    setEdges((eds) => [
      ...eds,
      {
        id: `e-${sourceId}-${id}-${Date.now()}`,
        source: sourceId,
        target: id,
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'default',
        animated: true,
        style: { stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1.5, strokeDasharray: '8 8', animationDuration: '10s' }
      }
    ]);
    setShowAssetDropdown(false);
    useAppStore.getState().setToastMsg("🔗 资产连线成功！");
  };

  // 高清放大确认
  const handleHDConfirm = () => {
    const srcUrl = data.frameUrl || data.resultUrl;
    if (!srcUrl) return;
    const thisNode = getNodes().find(n => n.id === id);
    if (!thisNode) return;
    const newNode = {
      id: `hd_node_${Date.now()}`,
      type: 'media',
      position: { x: thisNode.position.x + 500, y: thisNode.position.y + 100 },
      data: {
        resultUrl: srcUrl,
        prompt: '高清放大: ' + (data.firstFrameAnchor || data.prompt || ''),
        ratio: data.ratio || '16:9',
        model: 'hd-upscale-v1',
      }
    };
    setNodes((nds) => [...nds, newNode]);
    setShowHDSettings(false);
    useAppStore.getState().setToastMsg("✅ 高清放大节点已生成！");
  };

  const handleAnnotateDone = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL('image/png');

    const thisNode = getNodes().find(n => n.id === id);
    if (!thisNode) return;
    const newNode = {
      id: `annotated_${Date.now()}`,
      type: 'media',
      position: { x: thisNode.position.x + 500, y: thisNode.position.y + 100 },
      data: {
        resultUrl: dataURL,
        prompt: '标注图: ' + (data.firstFrameAnchor || data.prompt || ''),
        ratio: data.ratio || '16:9',
        model: data.model || 'gpt-image-2',
      }
    };
    setNodes((nds) => [...nds, newNode]);
    setIsAnnotating(false);
    useAppStore.getState().setToastMsg("✅ 标注图已作为新节点添加！");
  };

  // 标注时的绘制逻辑
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isAnnotating) return;
    
    // 在进入标注模式时，重置 canvas 大小并绘制原图
    const img = imgRef.current;
    if (img) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    }

    let drawing = false;
    const start = (e: MouseEvent) => {
      drawing = true;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;   // 计算缩放比
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    };
    const move = (e: MouseEvent) => {
      if (!drawing) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        ctx.lineTo(x, y);
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    };
    const end = () => {
      drawing = false;
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('mouseleave', end);
    };
  }, [isAnnotating, brushColor, brushSize]);

  const handleGenerateFrame = () => {
    if (data.isGenerating) return;

    // 提取参考图 URL（纯字符串数组）
    const imageUrls = incomingAssets
      .filter(a => a && (a.url || a.asset?.url))
      .map(a => a.url || a.asset?.url)
      .filter(Boolean);

    // 保留写入节点数据（其他功能可能会用到），同时显式传参
    updateNodeData(id, { incomingAssets: incomingAssets });
    enqueueTask(id, 'image', getNodes, updateNodeData, imageUrls);
  };

  const handleSpawnVideo = () => {
    const thisNode = nodes.find(n => n.id === id);
    if (!thisNode) return;
    const videoId = `video_${Date.now()}`;
    setNodes(nds => [...nds, { id: videoId, type: 'videoClip', position: { x: thisNode.position.x + 500, y: thisNode.position.y }, data: { status: 'draft', duration: data.duration || 5, ratio: data.ratio || '16:9', prompt: data.videoPrompt, sceneLighting: data.sceneLighting, globalCamera: data.globalCamera, frameUrl: data.frameUrl, referenceImage: data.frameUrl, isGenerating: false } }]);
    setEdges(eds => [...eds, { id: `e-${id}-${videoId}`, source: id, target: videoId, sourceHandle: 'right', targetHandle: 'left', type: 'default', animated: true, style: { stroke: 'rgba(99, 102, 241, 0.8)', strokeWidth: 2, strokeDasharray: '10 10', animationDuration: '2s' } }]);
  };

  const handleSaveAsset = (category: string) => {
    const { activeCanvasProjectId, updateCanvasProject } = useAppStore.getState();
    const url = data.frameUrl || data.resultUrl || data.asset?.url;
    if (!url) {
      useAppStore.getState().setToastMsg("⚠️ 当前节点没有可保存的图片！");
      return;
    }
    if (!activeCanvasProjectId) {
      useAppStore.getState().setToastMsg("⚠️ 请先进入一个画布项目！");
      return;
    }
    const asset = {
      id: `local_${Date.now()}`,
      _type: 'image',
      url,
      prompt: data.firstFrameAnchor || data.prompt || '已保存资产',
      timestamp: Date.now(),
      ratio: data.ratio || '16:9',
      category,
    };
    // ★ 函数式更新：从状态机原子快照读取最新 localAssets，杜绝竞态覆盖
    updateCanvasProject(activeCanvasProjectId, (prev: any) => ({ localAssets: [asset, ...(prev?.localAssets || [])] }));
    useAppStore.getState().setToastMsg(`✅ 已存入 [${category === 'scene' ? '场景' : category === 'character' ? '人物' : '道具'}] 分类`);
  };

  return (
    <div className="relative w-[400px] group z-20">
      <Handle type="target" position={Position.Left} id="left" className={handleLeft} />
      <Handle type="source" position={Position.Right} id="right" className="!w-[24px] !h-[24px] !bg-transparent opacity-0" />

      {status === 'done' && data.frameUrl && (
        <div className="absolute -top-[52px] left-1/2 -translate-x-1/2 flex items-center p-1.5 bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto z-[100] scale-95 group-hover:scale-100 after:content-[''] after:absolute after:-bottom-6 after:left-0 after:w-full after:h-6">
          <button onClick={() => showToast("正在调起高清放大引擎...")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Maximize size={12}/> 高清HD</button>
          {showHDSettings && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/10 rounded-[16px] p-4 z-[150] shadow-2xl flex flex-col gap-3 min-w-[220px] animate-in fade-in slide-in-from-top-2">
              <div className="text-white text-[12px] font-bold flex items-center gap-2">
                <Maximize size={14} className="text-indigo-400"/> 高清放大
              </div>
              <div className="flex flex-col gap-2 text-[11px] text-zinc-300">
                <div className="flex justify-between"><span className="text-zinc-500">模型</span><span className="font-mono">hd-upscale-v1</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">放大倍率</span><span className="font-mono">2x</span></div>
              </div>
              <div className="flex gap-2 justify-end mt-1">
                <button onClick={() => setShowHDSettings(true)} className="px-3 py-1.5 rounded-full bg-white/5 text-zinc-300 text-[10px] font-bold hover:bg-white/10 transition-all">取消</button>
                <button onClick={handleHDConfirm} className="px-4 py-1.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold hover:bg-indigo-400 transition-all shadow-lg">确认放大</button>
              </div>
            </div>
          )}
          

          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={() => showToast("进入九宫格扩展模式")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Grid size={12}/> 九宫格</button>
          <button onClick={() => showToast("生成人物三视图")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><UserRound size={12}/> 多视图</button>
          <button onClick={() => setIsAnnotating(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap">
  <PenTool size={12}/> 标注
</button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={() => handleCreatePanorama(id, data, getNodes, setNodes, setEdges)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-emerald-400 hover:text-white hover:bg-emerald-500/30 transition-colors whitespace-nowrap"><Globe size={12}/> 全景制作</button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          
          <div className="relative group/save flex items-center">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><RefreshCcw size={12}/> 存资产 <ChevronDown size={10}/></button>
            <div className="absolute left-1/2 -translate-x-1/2 top-[100%] pt-2 opacity-0 group-hover/save:opacity-100 pointer-events-none group-hover/save:pointer-events-auto transition-all z-[101]">
               <div className="bg-[#050505]/95 backdrop-blur-xl border border-white/10 p-1.5 rounded-[12px] shadow-2xl flex flex-col gap-0.5">
                 <button onClick={() => handleSaveAsset('scene')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-emerald-400 hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">存为场景光影</button>
                 <button onClick={() => handleSaveAsset('character')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-amber-400 hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">存为人物造型</button>
                 <button onClick={() => handleSaveAsset('prop')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-fuchsia-400 hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">存为静图道具</button>
               </div>
            </div>
          </div>
          
          <button onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = data.frameUrl; a.download = `W_Shot_${Date.now()}.png`; a.click(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-bold text-zinc-300 hover:text-black hover:bg-white transition-all shadow-md whitespace-nowrap"><Download size={12}/> 下载</button>
        </div>
      )}
      
      {zenMode && <ZenEditor label={zenMode.label} value={data[zenMode.field] || ''} onChange={(val: string) => updateNodeData(id, { [zenMode.field]: val })} onClose={() => setZenMode(null)} dataAttrs={{ 'data-node-id': id, 'data-field': zenMode.field, 'data-field-label': zenMode.label }} />}

      <div className={`glass-card glass-card-hover ${selected ? 'glass-card-selected' : ''} flex flex-col p-2`}>
        <div className="flex items-center justify-between px-2 pt-1 pb-2">
          <span className="bg-white/10 text-white px-2 py-0.5 rounded-[6px] text-[10px] font-mono font-bold shadow-inner">SHOT {data.shotNumber}</span>
        </div>

        <div style={currentStyle} className="w-full bg-[#0a0a0c] border border-white/10 rounded-[16px] overflow-hidden relative shadow-inner transition-all duration-500 ease-out origin-center group/shotimg">
          {/* 生成中 / 排队中的覆盖层 */}
          {(status === 'generating' || status === 'pending') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10">
              <Loader2 size={24} className="animate-spin text-zinc-400 mb-2" />
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold animate-pulse">
                {status === 'pending' ? 'QUEUED / 排队中...' : 'Rendering...'}
              </span>
            </div>
          )}

          {/* 🆕 动态宇宙粒子背景（只在无图且非生成中时显示） */}
          {!data.frameUrl && status !== 'generating' && status !== 'pending' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center dynamic-particles-container">
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes space-drift {
                  0% { background-position: 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0px 0px; }
                  100% { background-position: 200px 300px, -150px 200px, 100px -200px, -200px -100px, 150px 150px; }
                }
                @keyframes nebula-pulse {
                  0% { opacity: 0.3; transform: scale(1); }
                  50% { opacity: 0.8; transform: scale(1.1); }
                  100% { opacity: 0.3; transform: scale(1); }
                }
                .dynamic-particles-container {
                  background-image: 
                    radial-gradient(1px 1px at 20px 20px, rgba(255,255,255,0.9), transparent),
                    radial-gradient(1.5px 1.5px at 40px 70px, rgba(255,255,255,0.7), transparent),
                    radial-gradient(2px 2px at 80px 120px, rgba(255,255,255,0.4), transparent),
                    radial-gradient(1px 1px at 150px 30px, rgba(255,255,255,0.8), transparent),
                    radial-gradient(1px 1px at 10px 130px, rgba(165,180,252,0.6), transparent);
                  background-size: 80px 80px, 110px 110px, 160px 160px, 90px 90px, 60px 60px;
                  animation: space-drift 50s linear infinite;
                }
                .dynamic-particles-container::before {
                  content: "";
                  position: absolute;
                  inset: -20%;
                  background: 
                    radial-gradient(circle at 20% 80%, rgba(76, 29, 149, 0.25) 0%, transparent 50%),
                    radial-gradient(circle at 80% 20%, rgba(30, 58, 138, 0.25) 0%, transparent 50%);
                  animation: nebula-pulse 8s ease-in-out infinite alternate;
                  pointer-events: none;
                  z-index: 1;
                }
                .dynamic-particles-container::after {
                  content: "";
                  position: absolute;
                  inset: 0;
                  background: radial-gradient(circle at center, transparent 20%, rgba(2, 2, 4, 0.95) 100%);
                  pointer-events: none;
                  z-index: 2;
                }
              `}} />
              <span className="z-10 text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                分镜首帧待生成
              </span>
            </div>
          )}

          {/* 有图时正常显示 */}
          {status === 'done' && data.frameUrl && (
  <div className="relative w-full h-full">
    <img 
      ref={imgRef} 
      src={data.frameUrl} 
      className="w-full h-full object-cover" 
      crossOrigin="anonymous"  // 防止 canvas 污染
    />
    {isAnnotating && (
      <>
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full nodrag nopan"
          style={{ cursor: 'crosshair' }}
        />
        <div className="absolute top-2 left-2 flex items-center gap-2 z-20 nodrag">
  <input
    type="color"
    value={brushColor}
    onChange={(e) => setBrushColor(e.target.value)}
    className="w-6 h-6 rounded cursor-pointer nodrag"
    title="画笔颜色"
  />
  <input
    type="range"
    min="2"
    max="20"
    value={brushSize}
    onChange={(e) => setBrushSize(Number(e.target.value))}
    className="w-20 h-4 nodrag"
    title="画笔粗细"
  />
  <span className="text-[10px] text-white/80">{brushSize}px</span>
</div>
        <div className="absolute bottom-2 right-2 flex gap-2 z-20">
          <button 
            onClick={handleAnnotateDone} 
            className="px-3 py-1.5 bg-green-500 text-white rounded-full text-[10px] font-bold shadow-lg nodrag"
          >
            完成
          </button>
          <button 
            onClick={() => setIsAnnotating(false)} 
            className="px-3 py-1.5 bg-white/10 text-white rounded-full text-[10px] font-bold nodrag"
          >
            取消
          </button>
        </div>
      </>
    )}
  </div>
)}
        </div>
      </div>

      <div className={`absolute top-[100%] pt-4 left-1/2 -translate-x-1/2 w-[540px] transition-all duration-500 ease-out origin-top ${selected ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
         <div className="bg-black/60 border border-white/[0.08] backdrop-blur-3xl rounded-[32px] p-4 shadow-2xl flex flex-col relative">
            
         <div className="flex flex-col gap-1.5 mb-3 bg-[#050505]/50 p-2.5 rounded-[16px] border border-white/5 focus-within:border-white/20 transition-colors shadow-inner">
               <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">场景光影轨</label>
                <input value={data.sceneLighting || ''} onChange={(e) => { updateNodeData(id, { sceneLighting: e.target.value }); markDownstreamDirty(); }} className="bg-transparent text-[11px] text-zinc-300 font-mono outline-none nodrag nopan w-full" data-node-id={id} data-field="sceneLighting" data-field-label="场景光影" />
            </div>

            <div className="flex flex-col gap-1.5 mb-3 bg-[#050505]/50 p-2.5 rounded-[16px] border border-white/5 group/zen1 focus-within:border-white/20 transition-colors shadow-inner relative">
               <div className="flex justify-between items-center relative z-50">
                 <label className="text-[9px] font-bold text-zinc-400 flex items-center gap-2">
                    首帧锚定轨 
                    {data.styleOverride && data.styleOverride !== '继承全局预设' && <span className="bg-white/10 text-white px-1.5 py-0.5 rounded text-[8px] font-mono border border-white/20">STYLE: {data.styleOverride.split(' ')[0]}</span>}
                 </label>
                 <div className="flex items-center gap-1">
                    <button onClick={() => setShowAssetDropdown(!showAssetDropdown)} className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/40 rounded-[6px] text-[9px] font-bold transition-all nodrag"><Plus size={10}/> 引入资产</button>
                    <button onClick={() => setZenMode({ field: 'firstFrameAnchor', label: '首帧描述' })} className="opacity-0 group-hover/zen1:opacity-100 text-zinc-400 hover:text-white transition-colors p-1"><Expand size={10}/></button>
                 </div>
                 
                 {/* 资产下拉框 */}
                 {showAssetDropdown && (
                    <div className="absolute top-[100%] right-0 mt-2 w-[220px] bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/20 rounded-[12px] shadow-[0_20px_60px_rgba(0,0,0,0.9)] p-1.5 z-[9999] animate-in fade-in zoom-in-95 max-h-[200px] overflow-y-auto custom-scrollbar nodrag nopan" onClick={e => e.stopPropagation()} onWheelCapture={e => e.stopPropagation()}>
                       <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest px-2 pb-1 mb-1 border-b border-white/10 flex justify-between items-center">
                          点击即可飞线
                          <button onClick={() => setShowAssetDropdown(false)} className="hover:text-white"><X size={10}/></button>
                       </div>
                       {availableAssets.length === 0 ? (
                          <div className="text-[10px] text-zinc-500 p-3 text-center font-light">
                             画布中暂无多余图片节点<br/>请先从右侧表格提取
                          </div>
                       ) : (
                          availableAssets.map((assetNode: any) => (
                             <div key={assetNode.id} onClick={() => handleAddAssetEdge(assetNode.id)} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded-[8px] cursor-pointer transition-colors group/item">
                                <img src={assetNode.data?.resultUrl || assetNode.data?.asset?.url} className="w-7 h-7 rounded-[6px] object-contain bg-black/50 border border-white/10" />
                                <span className="text-[11px] text-zinc-300 font-medium group-hover/item:text-white truncate flex-1">{assetNode.data?.name || '未命名资产'}</span>
                             </div>
                          ))
                       )}
                    </div>
                 )}
               </div>
               
               {/* 🆕 已连线参考图小预览 */}
                              {incomingAssets.filter((a:any) => a._type === 'image').length > 0 && (
                 <div className="flex gap-2 mb-1 flex-wrap">
                   {incomingAssets.filter((a:any) => a._type === 'image').map((asset: any, idx: number) => (
                    <div key={idx} className="relative group/ref w-12 h-12 rounded-[8px] overflow-hidden border border-white/20 hover:border-white/50 hover:scale-150 hover:z-50 transition-all duration-200 cursor-pointer" title={`参考图${idx+1}: ${asset.prompt || '未命名'}`}>
                       <img src={asset.url} className="w-full h-full object-cover" />
                       <span className="absolute top-0.5 left-0.5 bg-black/80 text-white text-[8px] px-1 rounded font-bold">{idx+1}</span>
                     </div>
                   ))}
                 </div>
               )}
                <MentionTextarea value={data.firstFrameAnchor || ''} onChange={(v: string) => { updateNodeData(id, { firstFrameAnchor: v }); markDownstreamDirty(); }} incomingAssets={incomingAssets} disableMention={true} dataAttrs={{ 'data-node-id': id, 'data-field': 'firstFrameAnchor', 'data-field-label': '首帧锚定提示词' }} />
                {incomingAssets.filter((a:any) => a._type === 'image').length === 0 && (
                 <div className="text-[10px] text-zinc-600 italic mb-1">
                   ⚠️ 左侧未连接参考图节点，将仅用提示词生成
                 </div>
               )}
            </div>
            
             <div className="flex flex-col gap-1.5 mb-2 bg-[#050505]/50 p-2.5 rounded-[16px] border border-white/5 group/zen2 focus-within:border-white/20 transition-colors shadow-inner relative">
               <label className="text-[9px] font-bold text-zinc-400 flex justify-between">时序演进与动作轨 <button onClick={() => setZenMode({ field: 'videoPrompt', label: '动作提示词' })} className="opacity-0 group-hover/zen2:opacity-100 text-zinc-400 hover:text-white transition-colors"><Expand size={10}/></button></label>
                <textarea value={data.videoPrompt || ''} onChange={(e) => { updateNodeData(id, { videoPrompt: e.target.value }); markDownstreamDirty(); }} className="w-full bg-black/40 border border-white/[0.05] rounded-[12px] p-3 text-[11px] text-zinc-300 outline-none resize-none custom-scrollbar min-h-[160px] nodrag nopan" onWheelCapture={(e) => e.stopPropagation() } data-node-id={id} data-field="videoPrompt" data-field-label="时序动作提示词" />
               </div>

            <div className="h-px w-full bg-white/[0.05] my-3" />

            <div className="flex items-center justify-between px-2 pb-1 relative">
               <div className="flex items-center gap-2">
               <CustomSelect 
  className="w-[150px]" 
  value={data.model || 'gpt-image-2'} 
  options={[
    { value: 'gpt-image-2', label: 'GPT-Image-2' },
    { value: 'banana-pro', label: 'Banana Pro' },
    { value: 'seedream5.0', label: 'Seedream 5.0' }
  ]} 
  onChange={(v: string) => {
    // ✨【防呆分辨率自动重置机制】
    // 自动核对新选模型是否兼容当前画质，如果不匹配，立即重设为对应模型的安全默认值
    let nextQuality = data.quality || '1K';
    if (v === 'seedream5.0') {
      if (!['2K', '3K'].includes(nextQuality)) {
        nextQuality = '2K';
      }
    } else if (v === 'banana-pro') {
      if (!['1K', '2K', '4K'].includes(nextQuality)) {
        nextQuality = '2K';
      }
    } else {
      nextQuality = '1K';
    }
    updateNodeData(id, { model: v, quality: nextQuality });
  }} 
/>
                 
                 <div className="relative group/cfg">
                    <button onClick={() => setShowConfig(!showConfig)} className={`p-2 rounded-[10px] transition-all nodrag ${showConfig ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}><Settings2 size={16}/></button>
                    {showConfig && (
                       <div className="absolute bottom-[calc(100%+10px)] left-0 w-[240px] bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/10 rounded-[16px] shadow-2xl p-3 z-50 flex flex-col gap-3 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1">
                             <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">画面比例 (Ratio)</label>
                             <div className="flex gap-1 bg-black/40 p-1 rounded-[8px] border border-white/5">
                               {['16:9', '9:16', '1:1', '4:3', '3:4'].map(r => (
                                 <button key={r} onClick={() => updateNodeData(id, { ratio: r })} className={`flex-1 py-1 text-[10px] rounded-[4px] transition-all nodrag ${data.ratio === r ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'}`}>{r}</button>
                               ))}
                             </div>
                          </div>
                          <div className="flex flex-col gap-1 z-10">
                             <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">画质设定 (Quality)</label>
                             <CustomSelect 
                                menuPosition="top" 
                                className="w-full bg-black/40 border border-white/5 text-zinc-300 rounded-[8px]" 
                                value={data.quality || (data.model === 'seedream5.0' ? '2K' : '1K')} 
                                options={getImageQualityOptions(data.model || 'gpt-image-2')} 
                                onChange={(v: string) => updateNodeData(id, { quality: v })} 
                             />
                          </div>
                          <div className="flex flex-col gap-1 z-20">
                             <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">风格强覆写 (Override)</label>
                             <CustomSelect menuPosition="top" className="w-full bg-black/40 border border-white/5 text-zinc-300 rounded-[8px]" value={data.styleOverride || '继承全局预设'} options={[{ value: '继承全局预设', label: '继承全局预设' }, { value: '🎬 电影质感', label: '🎬 电影质感' }, { value: '🌸 二次元', label: '🌸 二次元' }, { value: '📷 极致写实', label: '📷 极致写实' }, { value: '🧊 3D 渲染', label: '🧊 3D 渲染' }, { value: '🌃 赛博朋克', label: '🌃 赛博朋克' }]} onChange={(v: string) => updateNodeData(id, { styleOverride: v })} />
                          </div>
                       </div>
                    )}
                 </div>
               </div>

               <div className="flex gap-2">
                 <button 
                   onClick={handleGenerateFrame} 
                   disabled={data.isGenerating || status === 'pending'} 
                   className="h-10 px-6 rounded-full bg-white text-black text-[12px] font-bold shadow-lg hover:scale-105 nodrag disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                 >
                   {status === 'done' ? '重新生成' : '提取生成首帧'}
                 </button>
                 <button 
                   onClick={handleSpawnVideo} 
                   disabled={status !== 'done'} 
                   className="flex items-center gap-1.5 h-10 px-5 rounded-full bg-indigo-500 text-white text-[12px] font-bold shadow-lg hover:bg-indigo-400 nodrag disabled:opacity-40 disabled:hover:bg-indigo-500 disabled:cursor-not-allowed"
                 >
                   <Film size={14}/> 传给3级渲染
                 </button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};
export const ShotNode = React.memo(_ShotNode);

// ==========================================
// ==========================================
// 3. 视频片段节点 (VideoClipNode) —— 终端渲染与后处理
// ==========================================
const _VideoClipNode = ({ id, data, selected }: any) => {
  const { updateNodeData, getNodes, setNodes, setEdges } = useReactFlow();
  // ✨ 新增：用于控制美学参数微调仓的展开状态
  const [isAestheticsExpanded, setIsAestheticsExpanded] = useState(false);
  const edges = useEdges();
  const nodes = useNodes();
  const status = data.status || 'draft'; 
  const [showConfig, setShowConfig] = useState(false);
  const [zenMode, setZenMode] = useState<any>(null);
  const activeRatio = data.ratio || data.globalRatioOverride || '16:9';
  // ★ 视频/图片真实比例自适应
  const clipImageDims = useMediaDimensions(data.videoUrl || data.resultUrl);
  const currentStyle = clipImageDims
    ? { width: (RATIO_ASPECT_ONLY[activeRatio] || RATIO_ASPECT_ONLY['16:9']).width, aspectRatio: String(clipImageDims.width / clipImageDims.height) }
    : (RATIO_ASPECT_ONLY[activeRatio] || RATIO_ASPECT_ONLY['16:9']);

  const incomingAssets = useMemo(() => edges.filter(e => e.target === id).map(e => {
    const srcNode = nodes.find(n => n.id === e.source);
    if (srcNode?.data?.asset) return { ...srcNode.data.asset, name: srcNode.data.name || srcNode.data.asset.prompt };
    const url = srcNode?.data?.resultUrl || srcNode?.data?.frameUrl || srcNode?.data?.videoUrl;
    if (url) {
       return { url, _type: url.includes('.mp4') ? 'video' : 'image', prompt: srcNode.data.prompt || srcNode.data.videoPrompt, name: srcNode.data.name || '连线参考' };
    }
    return null;
  }).filter(Boolean), [edges, nodes, id]);

  const { enqueueTask } = useCanvasEngine();

  const handleGenerateVideo = () => {
    if (data.isGenerating) return;
    // 重新生成时，洗清脏污标记
    updateNodeData(id, { isDirty: false });
    enqueueTask(id, 'video', getNodes, updateNodeData);
  };

  const handleFissionClone = () => {
    const thisNode = nodes.find(n => n.id === id);
    if (!thisNode) return;
    const newId = `video_clone_${Date.now()}`;
    const newNode = {
      id: newId, type: 'videoClip',
      position: { x: thisNode.position.x, y: thisNode.position.y + 350 },
      data: { ...data, status: 'draft', videoUrl: null, isGenerating: false, postProcessLabel: null } 
    };
    const parentEdge = edges.find(e => e.target === id && e.targetHandle === 'left');
    const newEdges = [];
    if (parentEdge) {
      newEdges.push({
        id: `e-${parentEdge.source}-${newId}`, source: parentEdge.source, target: newId, 
        sourceHandle: parentEdge.sourceHandle, targetHandle: 'left', 
        type: 'default', animated: true, 
        style: { stroke: 'rgba(99, 102, 241, 0.8)', strokeWidth: 2, strokeDasharray: '10 10', animationDuration: '2s' } 
      });
    }
    setNodes(nds => [...nds, newNode]);
    if (newEdges.length > 0) setEdges(eds => [...eds, ...newEdges]);
  };

  // ✨ 新增：后处理空间裂变引擎
  const handlePostProcess = (actionType: string, label: string) => {
    const thisNode = nodes.find(n => n.id === id);
    if (!thisNode) return;
    
    useAppStore.getState().setToastMsg(`🚀 启动 [${label}]，正在创建衍生节点...`);
    
    const newId = `video_post_${actionType}_${Date.now()}`;
    
    // 创建一个带着特殊标签的新节点
    const newNode = {
      id: newId, 
      type: 'videoClip',
      position: { x: thisNode.position.x + 480, y: thisNode.position.y }, // 向右裂变
      data: { 
        ...data, 
        status: 'generating', // 直接进入生成状态
        isGenerating: true,
        videoUrl: null,
        postProcessLabel: label, // 打上后处理印记
        sourceVideoUrl: data.videoUrl // 记录源视频
      } 
    };
    
    // 生成粉紫色的专属加工连线
    const newEdge = {
      id: `e-${id}-${newId}`, 
      source: id, target: newId, 
      sourceHandle: 'right', targetHandle: 'left', 
      type: 'default', animated: true, 
      style: { stroke: 'rgba(217, 70, 239, 0.8)', strokeWidth: 2, strokeDasharray: '10 10', animationDuration: '1s' }
    };

    setNodes(nds => [...nds, newNode]);
    setEdges(eds => [...eds, newEdge]);
    
    // （模拟后端处理完毕）真实环境下这里会发 API
    setTimeout(() => {
      updateNodeData(newId, { 
        status: 'done', 
        isGenerating: false, 
        videoUrl: data.videoUrl // 模拟处理完，先复用原视频
      });
    }, 4000);
  };

  const showToast = (msg: string) => useAppStore.getState().setToastMsg(msg);

    // ✨ 新增：视频存资产函数
    const handleSaveAsset = () => {
      const { activeCanvasProjectId, updateCanvasProject } = useAppStore.getState();
      if (!activeCanvasProjectId || typeof updateCanvasProject !== 'function') return;
      const url = data.videoUrl || data.resultUrl || data.asset?.url;
      if (!url) return;
      const asset = {
        id: `local_${Date.now()}`, _type: 'video', url,
        prompt: data.prompt || data.videoPrompt || '已保存的视频',
        timestamp: Date.now(), ratio: data.ratio || '16:9'
      };
      // ★ 函数式更新：从状态机原子快照读取最新 localAssets，杜绝竞态覆盖
      updateCanvasProject(activeCanvasProjectId, (prev: any) => ({ localAssets: [asset, ...(prev?.localAssets || [])] }));
      useAppStore.getState().setToastMsg(`✅ 视频已存入侧边栏资产库！`);
  };

  return (
    <div className="relative w-[360px] group/videonode z-20">
      <Handle type="target" position={Position.Left} id="left" className={handleLeft} /> 
      <Handle type="source" position={Position.Right} id="right" className={handleRight} /> 
            {/* ✨ 禅定编辑器挂载 */}
            {zenMode && <ZenEditor label={zenMode.label} value={data[zenMode.field] || ''} onChange={(val: string) => updateNodeData(id, { [zenMode.field]: val })} onClose={() => setZenMode(null)} dataAttrs={{ 'data-node-id': id, 'data-field': zenMode.field, 'data-field-label': zenMode.label }} />}
      
      {/* ✨ 移到顶部的悬浮操作舱 (包含高级选项与下载) */}
      {status === 'done' && data.videoUrl && (
        <div className="absolute -top-[42px] left-1/2 -translate-x-1/2 flex items-center p-1.5 bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] opacity-0 group-hover/videonode:opacity-100 transition-all duration-300 z-50 scale-95 group-hover/videonode:scale-100 pointer-events-none group-hover/videonode:pointer-events-auto">
          <button onClick={() => handlePostProcess('upscale', '高清HD强化')} className="flex items-center gap-1.5 px-3 py-1 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Maximize size={12}/> 高清HD</button>
          <button onClick={() => handlePostProcess('nosub', 'AI去字幕')} className="flex items-center gap-1.5 px-3 py-1 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Subtitles size={12}/> 去字幕</button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <div className="relative group/btn flex items-center">
            <button className="flex items-center gap-1.5 px-3 py-1 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><AudioWaveform size={12}/> 音轨分离 <ChevronDown size={10}/></button>
            <div className="absolute left-1/2 -translate-x-1/2 top-[100%] pt-2 opacity-0 group-hover/btn:opacity-100 pointer-events-none group-hover/btn:pointer-events-auto transition-all z-[101]">
               <div className="bg-[#050505]/95 backdrop-blur-xl border border-white/10 p-1.5 rounded-[12px] shadow-2xl flex flex-col gap-0.5">
                 <button onClick={() => handlePostProcess('vocal', '人声提取')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">提取人声</button>
                 <button onClick={() => handlePostProcess('bgm', '环境音剥离')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">提取环境音</button>
               </div>
            </div>
          </div>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          {/* ✨ 下面这行是新加的存资产按钮 */}
          <button onClick={handleSaveAsset} className="flex items-center gap-1.5 px-3 py-1 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><RefreshCcw size={12}/> 存资产</button>
          
          <button onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = data.videoUrl; a.download = `W_Video_${Date.now()}.mp4`; a.click(); }} className="flex items-center gap-1.5 px-3 py-1 rounded-[10px] text-[11px] font-bold text-zinc-300 hover:text-black hover:bg-white transition-all shadow-md whitespace-nowrap">
            <Download size={12}/> 下载
          </button>
        </div>
      )}
      
      <div className={`${nodeBaseClass} ${selected ? selectedBorderClass : ''} flex flex-col p-2 transition-all duration-500`}>
        
        {/* 头部：展示接收到的算力时长 + 脏数据警报 */}
        <div className="flex items-center justify-between px-2 pt-1 pb-2 relative">
          <span className="text-[12px] font-bold text-white tracking-widest flex items-center gap-2">
            <Film size={14} className="text-zinc-400" />
            {data.postProcessLabel ? (
               <span className="bg-fuchsia-500/10 text-fuchsia-300 px-2 py-0.5 rounded-[6px] border border-fuchsia-500/20 text-[10px] font-bold shadow-inner">✨ {data.postProcessLabel}</span>
            ) : data.duration ? (
               <span className="bg-white/5 text-zinc-300 px-2 py-0.5 rounded-[6px] border border-white/10 text-[10px] font-mono shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]">⏱️ {data.duration} SEC</span>
            ) : 'VIDEO CLIP'}
          </span>
          <span className={`text-[10px] font-mono tracking-widest ${status === 'done' ? 'text-zinc-400' : 'text-zinc-500'}`}>
            {status.toUpperCase()}
          </span>

          {/* 🚨 脏数据断路器警报 UI */}
          {data.isDirty && (
            <div className="absolute top-[-36px] left-0 w-full flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="bg-red-500/90 backdrop-blur-md border border-red-400/50 text-white text-[10px] font-bold tracking-widest px-3 py-1 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.6)] flex items-center gap-1.5">
                  ⚠️ 上游数据已变更，当前视频已过期
               </div>
            </div>
          )}
        </div>

        {/* 视频预览区 (强制内联样式比例) */}
        <div style={currentStyle} className="w-full bg-[#0a0a0c] rounded-[16px] overflow-hidden border border-white/10 shadow-inner relative group/video transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-center">
          
          {/* ✨ 视频后处理悬浮舱 (平时隐藏，Hover浮现) */}
          {status === 'done' && data.videoUrl && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center p-1 bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[12px] shadow-[0_20px_40px_rgba(0,0,0,0.8)] opacity-0 group-hover/video:opacity-100 transition-all duration-300 z-50 scale-95 group-hover/video:scale-100">
              <button onClick={() => handlePostProcess('upscale', '高清HD强化')} className="flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-[10px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Maximize size={10}/> 高清</button>
              <button onClick={() => handlePostProcess('nosub', 'AI去字幕')} className="flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-[10px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Subtitles size={10}/> 去字幕</button>
              <div className="w-px h-3 bg-white/10 mx-0.5"></div>
              <div className="relative group/btn flex items-center">
                <button className="flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-[10px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><AudioWaveform size={10}/> 音轨分离 <ChevronDown size={8}/></button>
                <div className="absolute left-1/2 -translate-x-1/2 top-[100%] pt-2 opacity-0 group-hover/btn:opacity-100 pointer-events-none group-hover/btn:pointer-events-auto transition-all z-[101]">
                   <div className="bg-[#050505]/95 backdrop-blur-xl border border-white/10 p-1.5 rounded-[12px] shadow-2xl flex flex-col gap-0.5">
                     <button onClick={() => handlePostProcess('vocal', '人声提取')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">提取人声</button>
                     <button onClick={() => handlePostProcess('bgm', '环境音剥离')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">提取环境音</button>
                   </div>
                </div>
              </div>
              <div className="w-px h-3 bg-white/10 mx-0.5"></div>
              <button 
                onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = data.videoUrl; a.download = `W_Video_${Date.now()}.mp4`; a.click(); }} 
                className="flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-[10px] font-bold text-zinc-300 hover:text-black hover:bg-white transition-all shadow-md whitespace-nowrap"
              >
                <Download size={10}/> 下载
              </button>
            </div>
          )}

{status === 'draft' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center dynamic-particles-container">
              {/* 隐藏的文件上传 input */}
              <input
                type="file"
                id={`upload-video-${id}`}
                className="hidden"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const result = ev.target?.result as string;
                      // 读取视频比例
                      const vid = document.createElement('video');
                      vid.src = result;
                      vid.onloadedmetadata = () => {
                        const w = vid.videoWidth;
                        const h = vid.videoHeight;
                        const ratioValue = w / h;
                        let finalRatio = '16:9';
                        if (ratioValue < 0.8) finalRatio = '9:16';
                        else if (ratioValue >= 0.8 && ratioValue < 1.2) finalRatio = '1:1';
                        else if (ratioValue >= 1.2 && ratioValue < 1.5) finalRatio = '4:3';
                        // 更新节点数据，设置预览
                        updateNodeData(id, { videoUrl: result, ratio: finalRatio, prompt: file.name, isGenerating: false });
                      };
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />

              {/* 粒子动画 CSS（与上面相同的动画定义） */}
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes space-drift {
                  0% { background-position: 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0px 0px; }
                  100% { background-position: 200px 300px, -150px 200px, 100px -200px, -200px -100px, 150px 150px; }
                }
                @keyframes nebula-pulse {
                  0% { opacity: 0.3; transform: scale(1); }
                  50% { opacity: 0.8; transform: scale(1.1); }
                  100% { opacity: 0.3; transform: scale(1); }
                }
                .dynamic-particles-container {
                  background-image: 
                    radial-gradient(1px 1px at 20px 20px, rgba(255,255,255,0.9), transparent),
                    radial-gradient(1.5px 1.5px at 40px 70px, rgba(255,255,255,0.7), transparent),
                    radial-gradient(2px 2px at 80px 120px, rgba(255,255,255,0.4), transparent),
                    radial-gradient(1px 1px at 150px 30px, rgba(255,255,255,0.8), transparent),
                    radial-gradient(1px 1px at 10px 130px, rgba(165,180,252,0.6), transparent);
                  background-size: 80px 80px, 110px 110px, 160px 160px, 90px 90px, 60px 60px;
                  animation: space-drift 50s linear infinite;
                }
                .dynamic-particles-container::before {
                  content: "";
                  position: absolute;
                  inset: -20%;
                  background: 
                    radial-gradient(circle at 20% 80%, rgba(76, 29, 149, 0.25) 0%, transparent 50%),
                    radial-gradient(circle at 80% 20%, rgba(30, 58, 138, 0.25) 0%, transparent 50%);
                  animation: nebula-pulse 8s ease-in-out infinite alternate;
                  pointer-events: none;
                  z-index: 1;
                }
                .dynamic-particles-container::after {
                  content: "";
                  position: absolute;
                  inset: 0;
                  background: radial-gradient(circle at center, transparent 20%, rgba(2, 2, 4, 0.95) 100%);
                  pointer-events: none;
                  z-index: 2;
                }
              `}} />

              {/* 上传按钮 */}
              <div
                onClick={() => document.getElementById(`upload-video-${id}`)?.click()}
                className="z-10 w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center cursor-pointer shadow-[0_0_40px_rgba(76,29,149,0.3)] transition-all duration-500 hover:scale-110 hover:shadow-[0_0_60px_rgba(99,102,241,0.5),inset_0_0_20px_rgba(255,255,255,0.1)] hover:border-white/30 hover:bg-white/10 group/btn nodrag"
              >
                <Upload size={16} className="text-zinc-400 group-hover/btn:text-white transition-colors" />
              </div>
              <span className="z-10 text-[10px] uppercase font-bold tracking-widest text-zinc-500 mt-2">
                上传原始视频素材
              </span>
            </div>
          )}
          {(status === 'generating' || status === 'pending') && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10">
               <Loader2 size={24} className="animate-spin text-amber-400 mb-2" />
               <span className="text-[10px] text-amber-400 uppercase tracking-widest font-bold animate-pulse">
                 {status === 'pending' ? 'QUEUED / 排队中...' : 'Synthesizing Video...'}
               </span>
             </div>
          )}
          {status === 'done' && data.videoUrl && (
             <video src={data.videoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
          )}
        </div>
      </div>

      {/* 底部悬浮控制舱 */}
      <div className={`absolute top-[100%] pt-4 left-1/2 -translate-x-1/2 w-[520px] transition-all duration-500 ease-out origin-top ${selected ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
         <div className="bg-black/60 border border-white/[0.08] backdrop-blur-3xl rounded-[32px] p-3 shadow-[0_40px_80px_rgba(0,0,0,0.9)] flex flex-col focus-within:border-white/20 transition-all">
            
            {/* ✨ 继承的全局美学锁定区 (点击齿轮展开微调) */}
            {(data.sceneLighting || data.globalCamera) && (
               <div className={`flex flex-col gap-1.5 mb-2 bg-[#050505]/80 p-2.5 rounded-[16px] border shadow-inner transition-all duration-300 ${isAestheticsExpanded ? 'border-white/20' : 'border-white/5'}`}>
                  
                  {/* 标题栏 (可点击触发展开) */}
                  <label 
                    className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-between cursor-pointer group/aes" 
                    onClick={() => setIsAestheticsExpanded(!isAestheticsExpanded)}
                  >
                    <span className="flex items-center gap-1"><Sparkles size={10}/> {isAestheticsExpanded ? '微调美学参数 (Edit Mode)' : '已锁定美学参数 (Locked Aesthetics)'}</span>
                    <button className="p-1 rounded-[6px] hover:bg-white/10 transition-colors">
                      <Settings2 size={12} className={`transition-all duration-500 ${isAestheticsExpanded ? 'text-amber-400 rotate-90' : 'text-zinc-600 group-hover/aes:text-white'}`}/>
                    </button>
                  </label>
                  
                  {/* 展开与折叠态的内容切换 */}
                  {isAestheticsExpanded ? (
                     <div className="flex flex-col gap-2 mt-1 animate-in fade-in slide-in-from-top-1 duration-300">
                        <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-zinc-500 font-mono tracking-widest">微调单场光影 [Scene Lighting]:</span>
                           <textarea
                              data-node-id={id} data-field="sceneLighting" data-field-label="场景光影"
                              className="w-full bg-black/60 border border-white/5 rounded-[8px] p-2 text-[10px] text-zinc-200 font-mono outline-none focus:border-white/20 nodrag nopan resize-none custom-scrollbar" 
                              rows={2} 
                              value={data.sceneLighting || ''} 
                              onChange={(e) => updateNodeData(id, { sceneLighting: e.target.value })} 
                              onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
                           />
                        </div>
                        <div className="flex flex-col gap-1">
                           <span className="text-[9px] text-zinc-500 font-mono tracking-widest">微调全片机位 [Global Camera]:</span>
                           <textarea
                              data-node-id={id} data-field="globalCamera" data-field-label="全片摄影机机位"
                              className="w-full bg-black/60 border border-white/5 rounded-[8px] p-2 text-[10px] text-zinc-200 font-mono outline-none focus:border-white/20 nodrag nopan resize-none custom-scrollbar" 
                              rows={2} 
                              value={data.globalCamera || ''} 
                              onChange={(e) => updateNodeData(id, { globalCamera: e.target.value })} 
                              onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
                           />
                        </div>
                     </div>
                  ) : (
                     <div className="text-[10px] text-zinc-400 font-mono leading-relaxed line-clamp-2 mt-0.5 cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => setIsAestheticsExpanded(true)}>
                        <span className="text-zinc-500 font-bold">[光影]</span> {data.sceneLighting || '无'}<br/>
                        <span className="text-zinc-500 font-bold">[机位]</span> {data.globalCamera || '无'}
                     </div>
                  )}
               </div>
            )}

            {/* ✨ 修复：加入 group/zen2 并添加放大按钮 */}
            <div className="flex flex-col gap-1.5 mb-2 bg-[#050505]/50 p-2.5 rounded-[16px] border border-white/5 focus-within:border-white/20 transition-colors shadow-inner group/zen2">
               <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest flex items-center justify-between">
                 <span className="flex items-center gap-1"><Film size={10}/> 运镜时序轨 (Inherited Action Track)</span>
                 <button onClick={() => setZenMode({ field: 'prompt', label: '运镜时序轨' })} className="opacity-0 group-hover/zen2:opacity-100 text-zinc-400 hover:text-white transition-colors"><Expand size={10}/></button>
               </label>
                <MentionTextarea
                   value={data.prompt || ''} 
                   onChange={(v: string) => updateNodeData(id, { prompt: v })} 
                   placeholder="等待接收来自上一级的时序运镜数据..." 
                   incomingAssets={incomingAssets}
                   dataAttrs={{ 'data-node-id': id, 'data-field': 'prompt', 'data-field-label': '运镜时序轨' }}
                />
               {data.prompt && (
                 <div className="mt-1 text-[9px] text-zinc-500 font-light px-1 flex items-center gap-1">
                   <CheckCircle size={10} className="text-green-500/70"/> 数据已接力，底层渲染时将自动与上方【美学参数】进行缝合。
                 </div>
               )}
            </div>

            <div className="flex items-center justify-between px-3 pb-2 pt-2 border-t border-white/5 mt-1">
               <CustomSelect className="w-[180px]" value={data.model || 'doubao'} options={[{ value: 'doubao', label: 'Seedance 2.0' }, { value: 'kling', label: 'Kling O3' }]} onChange={(v: string) => updateNodeData(id, { model: v })} />
               
               <div className="flex items-center gap-2">
                 {status === 'draft' ? (
                    <button onClick={handleGenerateVideo} className="h-10 px-6 rounded-full bg-white text-black text-[12px] font-bold shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 transition-all">
                       一键合成视频
                    </button>
                 ) : (
                    <>
                       <button onClick={handleFissionClone} className="h-10 px-5 rounded-full bg-white/5 text-zinc-300 border border-white/10 text-[12px] font-medium hover:bg-white/10 hover:text-white transition-all">
                          克隆平行版本
                       </button>
                       <button className="h-10 px-5 rounded-full bg-transparent border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300 text-[12px] font-bold transition-all shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                          保存本地
                       </button>
                    </>
                 )}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};
export const VideoClipNode = React.memo(_VideoClipNode);
// ==========================================
// ==========================================
// ==========================================
// 2. 图像节点 (MediaNode) - 搭载创作者悬浮面板
// ==========================================
const _MediaNode = ({ id, data, selected }: any) => {
  const { updateNodeData, getNodes, setNodes, setEdges } = useReactFlow();
  const edges = useEdges();
  const { enqueueTask } = useCanvasEngine();
  const nodes = useNodes();
  const [showConfig, setShowConfig] = useState(false);
  const [showHDSettings, setShowHDSettings] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [brushColor, setBrushColor] = useState('#ff0000');
  const [brushSize, setBrushSize] = useState(4);
  const imgRef = useRef<HTMLImageElement>(null);
  const [zenMode, setZenMode] = useState<any>(null);
  
  const isReferenceOnly = !!data.asset;
  const displayImage = isReferenceOnly ? data.asset.url : data.resultUrl;
  // ★ 图片真实比例自适应
  const imageDims = useMediaDimensions(displayImage);

  const incomingAssets = useMemo(() => edges.filter(e => e.target === id).map(e => {
    const srcNode = nodes.find(n => n.id === e.source);
    if (srcNode?.data?.asset) return { ...srcNode.data.asset, name: srcNode.data.name || srcNode.data.asset.prompt };
    const url = srcNode?.data?.resultUrl || srcNode?.data?.frameUrl || srcNode?.data?.videoUrl;
    if (url) {
       return { url, _type: url.includes('.mp4') ? 'video' : 'image', prompt: srcNode.data.prompt || srcNode.data.videoPrompt, name: srcNode.data.name || '连线参考' };
    }
    return null;
  }).filter(Boolean), [edges, nodes, id]);

  const currentStyle = imageDims
    ? { width: `${data.customWidth || 320}px`, aspectRatio: String(imageDims.width / imageDims.height) }
    : data.customAspectRatio
    ? { width: `${data.customWidth || 320}px`, aspectRatio: String(data.customAspectRatio) }
    : (MEDIA_RATIO_MAP[data.ratio || '16:9'] || MEDIA_RATIO_MAP['16:9']);

  // 高清放大确认
  const handleHDConfirm = () => {
    const srcUrl = data.frameUrl || data.resultUrl;
    if (!srcUrl) return;
    const thisNode = getNodes().find(n => n.id === id);
    if (!thisNode) return;
    const newNode = {
      id: `hd_node_${Date.now()}`,
      type: 'media',
      position: { x: thisNode.position.x + 500, y: thisNode.position.y + 100 },
      data: {
        resultUrl: srcUrl,
        prompt: '高清放大: ' + (data.firstFrameAnchor || data.prompt || ''),
        ratio: data.ratio || '16:9',
        model: 'hd-upscale-v1',
      }
    };
    setNodes((nds) => [...nds, newNode]);
    setShowHDSettings(false);
    useAppStore.getState().setToastMsg("✅ 高清放大节点已生成！");
  };

  const handleAnnotateDone = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL('image/png');

    const thisNode = getNodes().find(n => n.id === id);
    if (!thisNode) return;
    const newNode = {
      id: `annotated_${Date.now()}`,
      type: 'media',
      position: { x: thisNode.position.x + 500, y: thisNode.position.y + 100 },
      data: {
        resultUrl: dataURL,
        prompt: '标注图: ' + (data.firstFrameAnchor || data.prompt || ''),
        ratio: data.ratio || '16:9',
        model: data.model || 'gpt-image-2',
      }
    };
    setNodes((nds) => [...nds, newNode]);
    setIsAnnotating(false);
    useAppStore.getState().setToastMsg("✅ 标注图已作为新节点添加！");
  };

  // 标注时的绘制监听
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isAnnotating) return;

    const img = imgRef.current;
    if (img) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    }

    let drawing = false;
    const start = (e: MouseEvent) => {
      drawing = true;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;   // 计算缩放比
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    };
    const move = (e: MouseEvent) => {
      if (!drawing) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        ctx.lineTo(x, y);
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    };
    const end = () => {
      drawing = false;
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('mouseleave', end);
    };
  }, [isAnnotating, brushColor, brushSize]);

  const handleGenerate = () => {
    if (data.isGenerating) return;

    // ✨ 收集外部拉入或已连线的参考图 URLs
    const imageRefs = incomingAssets
      .filter((a: any) => a && (a.url || a.asset?.url))
      .map((a: any) => a.url || a.asset?.url)
      .filter(Boolean);

    // ✨ 写入节点状态并加入到多路并发调度任务队列中
    updateNodeData(id, { incomingAssets: incomingAssets });
    enqueueTask(id, 'image', getNodes, updateNodeData, imageRefs);
  };

  const showToast = (msg: string) => useAppStore.getState().setToastMsg(msg);
  
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!displayImage) return;
    const a = document.createElement('a');
    a.href = displayImage; a.download = `W_Image_${Date.now()}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleSaveAsset = (category: string) => {
    const { activeCanvasProjectId, updateCanvasProject } = useAppStore.getState();
    const url = data.frameUrl || data.resultUrl || data.asset?.url;
    if (!url) {
      useAppStore.getState().setToastMsg("⚠️ 当前节点没有可保存的图片！");
      return;
    }
    if (!activeCanvasProjectId) {
      useAppStore.getState().setToastMsg("⚠️ 请先进入一个画布项目！");
      return;
    }
    const asset = {
      id: `local_${Date.now()}`,
      _type: 'image',
      url,
      prompt: data.firstFrameAnchor || data.prompt || '已保存资产',
      timestamp: Date.now(),
      ratio: data.ratio || '16:9',
      category,
    };
    // ★ 函数式更新：从状态机原子快照读取最新 localAssets，杜绝竞态覆盖
    updateCanvasProject(activeCanvasProjectId, (prev: any) => ({ localAssets: [asset, ...(prev?.localAssets || [])] }));
    useAppStore.getState().setToastMsg(`✅ 已存入 [${category === 'scene' ? '场景' : category === 'character' ? '人物' : '道具'}] 分类`);
  };

  return (
    <div className="relative z-20 group">
      {!isReferenceOnly && <Handle type="target" position={Position.Left} id="left" className={handleLeft} />}
      <Handle type="source" position={Position.Right} id="right" className={handleRight} />
      {zenMode && <ZenEditor label={zenMode.label} value={data[zenMode.field] || ''} onChange={(val: string) => updateNodeData(id, { [zenMode.field]: val })} onClose={() => setZenMode(null)} incomingAssets={incomingAssets} dataAttrs={{ 'data-node-id': id, 'data-field': zenMode.field, 'data-field-label': zenMode.label }} />}

      {displayImage && (
        <div className="absolute -top-[52px] left-1/2 -translate-x-1/2 flex items-center p-1.5 bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto z-[100] scale-95 group-hover:scale-100 after:content-[''] after:absolute after:-bottom-6 after:left-0 after:w-full after:h-6">
          <button onClick={() => setShowHDSettings(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Maximize size={12}/> 高清HD</button>
          {showHDSettings && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/10 rounded-[16px] p-4 z-[150] shadow-2xl flex flex-col gap-3 min-w-[220px] animate-in fade-in slide-in-from-top-2">
              <div className="text-white text-[12px] font-bold flex items-center gap-2">
                <Maximize size={14} className="text-indigo-400"/> 高清放大
              </div>
              <div className="flex flex-col gap-2 text-[11px] text-zinc-300">
                <div className="flex justify-between"><span className="text-zinc-500">模型</span><span className="font-mono">hd-upscale-v1</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">放大倍率</span><span className="font-mono">2x</span></div>
              </div>
              <div className="flex gap-2 justify-end mt-1">
                <button onClick={() => setShowHDSettings(false)} className="px-3 py-1.5 rounded-full bg-white/5 text-zinc-300 text-[10px] font-bold hover:bg-white/10 transition-all">取消</button>
                <button onClick={handleHDConfirm} className="px-4 py-1.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold hover:bg-indigo-400 transition-all shadow-lg">确认放大</button>
              </div>
            </div>
          )}
          
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={() => showToast("进入九宫格扩展模式")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Grid size={12}/> 九宫格</button>
          <button onClick={() => showToast("生成人物三视图")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><UserRound size={12}/> 多视图</button>
          <button onClick={() => setIsAnnotating(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><PenTool size={12}/> 标注</button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={() => handleCreatePanorama(id, data, getNodes, setNodes, setEdges)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-emerald-400 hover:text-white hover:bg-emerald-500/30 transition-colors whitespace-nowrap"><Globe size={12}/> 全景制作</button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          
          <div className="relative group/save flex items-center">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><RefreshCcw size={12}/> 存资产 <ChevronDown size={10}/></button>
            <div className="absolute left-1/2 -translate-x-1/2 top-[100%] pt-2 opacity-0 group-hover/save:opacity-100 pointer-events-none group-hover/save:pointer-events-auto transition-all z-[101]">
               <div className="bg-[#050505]/95 backdrop-blur-xl border border-white/10 p-1.5 rounded-[12px] shadow-2xl flex flex-col gap-0.5">
                 <button onClick={() => handleSaveAsset('scene')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-emerald-400 hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">存为场景光影</button>
                 <button onClick={() => handleSaveAsset('character')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-amber-400 hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">存为人物造型</button>
                 <button onClick={() => handleSaveAsset('prop')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-fuchsia-400 hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">存为静图道具</button>
               </div>
            </div>
          </div>
          
          <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-bold text-zinc-300 hover:text-black hover:bg-white transition-all shadow-md whitespace-nowrap"><Download size={12}/> 下载</button>
        </div>
      )}

      <div style={currentStyle} className={`${nodeBaseClass} ${selected ? selectedBorderClass : ''} overflow-hidden flex flex-col p-1 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]`}>
        <div className="w-full h-full relative flex items-center justify-center bg-transparent rounded-[20px] overflow-hidden">
        {displayImage ? (
            <div className="relative w-full h-full">
              <img ref={imgRef} src={displayImage} className="w-full h-full object-contain" crossOrigin="anonymous" />
              {isAnnotating && (
                <>
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full nodrag nopan"
                    style={{ cursor: 'crosshair' }}
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-2 z-20 nodrag">
  <input
    type="color"
    value={brushColor}
    onChange={(e) => setBrushColor(e.target.value)}
    className="w-6 h-6 rounded cursor-pointer nodrag"
    title="画笔颜色"
  />
  <input
    type="range"
    min="2"
    max="20"
    value={brushSize}
    onChange={(e) => setBrushSize(Number(e.target.value))}
    className="w-20 h-4 nodrag"
    title="画笔粗细"
  />
  <span className="text-[10px] text-white/80">{brushSize}px</span>
</div>
                  <div className="absolute bottom-2 right-2 flex gap-2 z-20">
                    <button onClick={handleAnnotateDone} className="px-3 py-1.5 bg-green-500 text-white rounded-full text-[10px] font-bold shadow-lg nodrag">完成</button>
                    <button onClick={() => setIsAnnotating(false)} className="px-3 py-1.5 bg-white/10 text-white rounded-full text-[10px] font-bold nodrag">取消</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#020204] overflow-hidden dynamic-particles-container">
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes space-drift {
                  0% { background-position: 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0px 0px; }
                  100% { background-position: 200px 300px, -150px 200px, 100px -200px, -200px -100px, 150px 150px; }
                }
                @keyframes nebula-pulse {
                  0% { opacity: 0.3; transform: scale(1); }
                  50% { opacity: 0.8; transform: scale(1.1); }
                  100% { opacity: 0.3; transform: scale(1); }
                }
                .dynamic-particles-container {
                  background-image: 
                    radial-gradient(1px 1px at 20px 20px, rgba(255,255,255,0.9), transparent),
                    radial-gradient(1.5px 1.5px at 40px 70px, rgba(255,255,255,0.7), transparent),
                    radial-gradient(2px 2px at 80px 120px, rgba(255,255,255,0.4), transparent),
                    radial-gradient(1px 1px at 150px 30px, rgba(255,255,255,0.8), transparent),
                    radial-gradient(1px 1px at 10px 130px, rgba(165,180,252,0.6), transparent);
                  background-size: 80px 80px, 110px 110px, 160px 160px, 90px 90px, 60px 60px;
                  animation: space-drift 50s linear infinite;
                }
                .dynamic-particles-container::before {
                  content: "";
                  position: absolute;
                  inset: -20%;
                  background: 
                    radial-gradient(circle at 20% 80%, rgba(76, 29, 149, 0.25) 0%, transparent 50%),
                    radial-gradient(circle at 80% 20%, rgba(30, 58, 138, 0.25) 0%, transparent 50%);
                  animation: nebula-pulse 8s ease-in-out infinite alternate;
                  pointer-events: none;
                  z-index: 1;
                }
                .dynamic-particles-container::after {
                  content: "";
                  position: absolute;
                  inset: 0;
                  background: radial-gradient(circle at center, transparent 20%, rgba(2, 2, 4, 0.95) 100%);
                  pointer-events: none;
                  z-index: 2;
                }
              `}} />
              

                <input
                  type="file"
                  id={`upload-media-${id}`}
                  className="hidden"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const compressedBase64 = await compressImage(file);
                      const img = new Image(); 
                      img.src = compressedBase64;
                      img.onload = () => {
                         const ratioValue = img.naturalWidth / img.naturalHeight;
                         let finalRatio = '16:9';
                         if (ratioValue < 0.8) finalRatio = '9:16'; else if (ratioValue >= 0.8 && ratioValue < 1.2) finalRatio = '1:1'; else if (ratioValue >= 1.2 && ratioValue < 1.5) finalRatio = '4:3';
                         updateNodeData(id, { resultUrl: compressedBase64, ratio: finalRatio });
                      }
                    }
                  }}
                 />
              
              {data.isGenerating ? (
                 <div className="z-10 flex flex-col items-center">
                    <Loader2 size={24} className="mb-3 animate-spin text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,1)]" />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-300 animate-pulse drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]">Synthesizing...</span>
                 </div>
              ) : (
                 <div 
                   onClick={() => document.getElementById(`upload-media-${id}`)?.click()}
                   className="z-10 w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center cursor-pointer shadow-[0_0_40px_rgba(76,29,149,0.3)] transition-all duration-500 hover:scale-110 hover:shadow-[0_0_60px_rgba(99,102,241,0.5),inset_0_0_20px_rgba(255,255,255,0.1)] hover:border-white/30 hover:bg-white/10 group/btn nodrag"
                 >
                    <Upload size={16} className="text-zinc-400 group-hover/btn:text-white transition-colors" />
                 </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!isReferenceOnly && (
        <div className={`absolute top-[100%] pt-4 left-1/2 -translate-x-1/2 w-[540px] transition-all duration-500 ease-out origin-top ${selected ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
           <div className="bg-black/60 border border-white/[0.08] backdrop-blur-3xl rounded-[32px] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.85)] focus-within:border-white/20 transition-all flex flex-col">
              
              <div className="relative mb-4 bg-[#050505]/50 rounded-[16px] border border-white/5 focus-within:border-white/20 transition-colors shadow-inner group/zen">
                 <div className="min-h-[120px] p-2">
                                 {/* 🆕 已连线参考图小预览 */}
               {incomingAssets.filter((a:any) => a._type === 'image').length > 0 && (
                 <div className="flex gap-2 mb-1 flex-wrap">
                   {incomingAssets.filter((a:any) => a._type === 'image').map((asset: any, idx: number) => (
                    <div key={idx} className="relative group/ref w-12 h-12 rounded-[8px] overflow-hidden border border-white/20 hover:border-white/50 hover:scale-150 hover:z-50 transition-all duration-200 cursor-pointer" title={`参考图${idx+1}: ${asset.prompt || '未命名'}`}>
                       <img src={asset.url} className="w-full h-full object-cover" />
                       <span className="absolute top-0.5 left-0.5 bg-black/80 text-white text-[8px] px-1 rounded font-bold">{idx+1}</span>
                     </div>
                   ))}
                 </div>
               )}
                     <MentionTextarea value={data.prompt || ''} onChange={(v: string) => updateNodeData(id, { prompt: v })} placeholder="输入提示词，或输入 @ 选择已连接的参考图参与融合..." incomingAssets={incomingAssets} disableMention={false} dataAttrs={{ 'data-node-id': id, 'data-field': 'prompt', 'data-field-label': '生图提示词' }} />
                 </div>
                 <button onClick={() => setZenMode({ field: 'prompt', label: '生图提示词' })} className="absolute top-3 right-3 p-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg opacity-0 group-hover/zen:opacity-100 text-zinc-400 hover:text-white hover:bg-white/10 transition-all shadow-md z-10">
                    <Expand size={14}/>
                 </button>
              </div>
              
              <div className="flex items-center justify-between px-2 pb-1 relative">
                 <div className="flex items-center gap-2">
                    <CustomSelect 
                      className="w-[150px]" 
                      value={data.model || 'gpt-image-2'} 
                      options={[
                        { value: 'gpt-image-2', label: 'GPT-Image-2' },
                        { value: 'banana-pro', label: 'Banana Pro' },
                        { value: 'seedream5.0', label: 'Seedream 5.0' }
                      ]} 
                      onChange={(v: string) => {
                        // ✨【防呆分辨率自动重置机制】
                        // 自动核对新选模型是否兼容当前画质，如果不匹配，立即重设为对应模型的安全默认值
                        let nextQuality = data.quality || '1K';
                        if (v === 'seedream5.0') {
                          if (!['2K', '3K'].includes(nextQuality)) {
                            nextQuality = '2K';
                          }
                        } else if (v === 'banana-pro') {
                          if (!['1K', '2K', '4K'].includes(nextQuality)) {
                            nextQuality = '2K';
                          }
                        } else {
                          nextQuality = '1K';
                        }
                        updateNodeData(id, { model: v, quality: nextQuality });
                      }} 
                    />
                    <CustomSelect className="w-[80px]" value={data.n || 1} options={[{ value: 1, label: '1 张' }, { value: 2, label: '2 张' }, { value: 3, label: '3 张' }, { value: 4, label: '4 张' }]} onChange={(v: number) => updateNodeData(id, { n: v })} />
                    
                    <div className="relative group/cfg">
                       <button onClick={() => setShowConfig(!showConfig)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] transition-all nodrag ${showConfig ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'}`}>
                           <span className="text-[10px] font-bold tracking-widest">{data.ratio || '16:9'} / {data.quality || '1K'}</span>
                           <Settings2 size={14}/>
                       </button>
                       {showConfig && (
                          <div className="absolute bottom-[calc(100%+10px)] left-0 w-[240px] bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/10 rounded-[16px] shadow-2xl p-3 z-50 flex flex-col gap-3 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                             <div className="flex flex-col gap-1">
                                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">画面比例 (Ratio)</label>
                                <div className="flex gap-1 bg-black/40 p-1 rounded-[8px] border border-white/5">
                                  {['16:9', '9:16', '1:1', '4:3'].map(r => (
                                    <button key={r} onClick={() => updateNodeData(id, { ratio: r })} className={`flex-1 py-1 text-[10px] rounded-[4px] transition-all nodrag ${data.ratio === r ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'}`}>{r}</button>
                                  ))}
                                </div>
                             </div>
                             <div className="flex flex-col gap-1 z-10">
                                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">画质设定 (Quality)</label>
                                <CustomSelect 
                                   menuPosition="top" 
                                   className="w-full bg-black/40 border border-white/5 text-zinc-300 rounded-[8px]" 
                                   value={data.quality || (data.model === 'seedream5.0' ? '2K' : '1K')} 
                                   options={getImageQualityOptions(data.model || 'gpt-image-2')} 
                                   onChange={(v: string) => updateNodeData(id, { quality: v })} 
                                />
                             </div>
                             <div className="flex flex-col gap-1 z-20">
                                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">风格强覆写 (Override)</label>
                                <CustomSelect menuPosition="top" className="w-full bg-black/40 border border-white/5 text-zinc-300 rounded-[8px]" value={data.styleOverride || '继承全局预设'} options={[{ value: '继承全局预设', label: '继承全局预设' }, { value: '🎬 电影质感', label: '🎬 电影质感' }, { value: '🌸 二次元', label: '🌸 二次元' }, { value: '📷 极致写实', label: '📷 极致写实' }, { value: '🧊 3D 渲染', label: '🧊 3D 渲染' }, { value: '🌃 赛博朋克', label: '🌃 赛博朋克' }]} onChange={(v: string) => updateNodeData(id, { styleOverride: v })} />
                             </div>
                          </div>
                       )}
                    </div>
                 </div>
                 
                 <button onClick={handleGenerate} className={`h-[40px] w-[40px] rounded-full flex items-center justify-center transition-all nodrag shadow-lg ${data.isGenerating ? 'bg-indigo-500/20 text-indigo-400 cursor-wait' : 'bg-white text-black hover:scale-110 shadow-[0_0_25px_rgba(255,255,255,0.5)]'}`}>
                   {data.isGenerating ? <Loader2 size={18} className="animate-spin" /> : <MoveUp size={18} strokeWidth={2.5} />}
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
export const MediaNode = React.memo(_MediaNode);

// ==========================================
// 3. 视频生成节点 (RenderNode) - 搭载创作者悬浮面板
// ==========================================
const _RenderNode = ({ id, data, selected }: any) => {
  const { updateNodeData } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes();
  const [showConfig, setShowConfig] = useState(false);
  
  const isReferenceOnly = !!data.asset;
  const displayVideo = isReferenceOnly ? data.asset.url : data.resultUrl;

  const incomingAssets = useMemo(() => edges.filter(e => e.target === id).map(e => {
    const srcNode = nodes.find(n => n.id === e.source);
    if (srcNode?.data?.asset) return srcNode.data.asset;
    if (srcNode?.data?.resultUrl) return { url: srcNode.data.resultUrl, _type: 'video', prompt: srcNode.data.prompt };
    return null;
  }).filter(Boolean), [edges, nodes, id]);

  // ★ 视频/图片真实比例自适应
  const renderImageDims = useMediaDimensions(displayVideo);
  const currentStyle = renderImageDims
    ? { width: (RENDER_RATIO_MAP[data.ratio || '16:9'] || RENDER_RATIO_MAP['16:9']).width, aspectRatio: String(renderImageDims.width / renderImageDims.height) }
    : (RENDER_RATIO_MAP[data.ratio || '16:9'] || RENDER_RATIO_MAP['16:9']);

  const handleRender = async () => {
    if (data.isGenerating) return;
    const imageRefs = incomingAssets.filter((a: any) => a._type === 'image').map((a: any) => a.url);
    const videoRefs = incomingAssets.filter((a: any) => a._type === 'video').map((a: any) => a.url);

    updateNodeData(id, { isGenerating: true });
    try {
      const payload: any = { model: data.model || 'doubao-seedance-2-0-260128', mode: imageRefs.length > 0 ? 'i2v' : (videoRefs.length > 0 ? 'v2v' : 't2v'), prompt: data.prompt || '生成动态视频', ratio: data.ratio || '16:9' };
      if (imageRefs.length > 0) { payload.image = imageRefs[0]; payload.images = imageRefs; }
      if (videoRefs.length > 0) { payload.video_url = videoRefs[0]; }

      const response = await fetchApi('/v1/videos/generations', { method: 'POST', body: JSON.stringify(payload) });
      const submitData = await response.json();
      
      let isPolling = true;
      while (isPolling) {
        await new Promise(resolve => setTimeout(resolve, 3500));
        const pollRes = await fetchApi('/v1/videos/status', { method: 'POST', body: JSON.stringify({ task_id: submitData.task_id, model: submitData.model }) });
        const pollData = await pollRes.json();
        if (pollData.status === 'succeeded') { updateNodeData(id, { isGenerating: false, resultUrl: pollData.url }); isPolling = false; } 
        else if (pollData.status === 'failed') { 
          updateNodeData(id, { isGenerating: false }); 
          useAppStore.getState().setToastMsg("视频生成失败"); 
          isPolling = false; 
        }
      }
    } catch (e) { 
      updateNodeData(id, { isGenerating: false }); 
      useAppStore.getState().setToastMsg("网络请求异常，请检查配置"); 
    }
  };

  const showToast = (msg: string) => useAppStore.getState().setToastMsg(msg);
    // ✨ 新增：视频存资产函数
    const handleSaveAsset = () => {
      const { activeCanvasProjectId, updateCanvasProject } = useAppStore.getState();
      if (!activeCanvasProjectId || typeof updateCanvasProject !== 'function') return;
      const url = displayVideo;
      if (!url) return;
      const asset = {
        id: `local_${Date.now()}`, _type: 'video', url,
        prompt: data.prompt || '已保存的视频',
        timestamp: Date.now(), ratio: data.ratio || '16:9'
      };
      // ★ 函数式更新：从状态机原子快照读取最新 localAssets，杜绝竞态覆盖
      updateCanvasProject(activeCanvasProjectId, (prev: any) => ({ localAssets: [asset, ...(prev?.localAssets || [])] }));
      useAppStore.getState().setToastMsg(`✅ 视频已存入侧边栏资产库！`);
    };
  
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!displayVideo) return;
    const a = document.createElement('a');
    a.href = displayVideo; a.download = `W_Video_${Date.now()}.mp4`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="relative z-20 group">
      {!isReferenceOnly && <Handle type="target" position={Position.Left} id="left" className={handleLeft} />}
      <Handle type="source" position={Position.Right} id="right" className={handleRight} />

      {/* ✨ 视频核心控制台 (平时隐藏，Hover浮现) */}
      {displayVideo && (
        <div className="absolute -top-[52px] left-1/2 -translate-x-1/2 flex items-center p-1.5 bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto z-[100] scale-95 group-hover:scale-100 after:content-[''] after:absolute after:-bottom-6 after:left-0 after:w-full after:h-6">
          <button onClick={() => showToast("调起视频高清重绘流...")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Maximize size={12}/> 高清HD</button>
          <button onClick={() => showToast("正在提取字幕遮罩层...")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Subtitles size={12}/> 去字幕</button>
          <button onClick={() => showToast("开启画幅修剪与高光剪辑")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Scissors size={12}/> 剪辑片段</button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          
          <div className="relative group/btn flex items-center">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><AudioWaveform size={12}/> 音频分离 <ChevronDown size={10}/></button>
            {/* 🚀 核心修复：用隐形的 padding-top 撑开透明间隙，保证悬停不断层 */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[100%] pt-2 opacity-0 group-hover/btn:opacity-100 pointer-events-none group-hover/btn:pointer-events-auto transition-all z-[101]">
               <div className="bg-[#050505]/95 backdrop-blur-xl border border-white/10 p-1.5 rounded-[12px] shadow-2xl flex flex-col gap-0.5">
                 <button onClick={() => showToast("正在提取独立人声轨道...")} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">提取人声</button>
                 <button onClick={() => showToast("正在剥离背景环境音...")} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">提取背景音</button>
                 <button onClick={() => showToast("人声与背景声双轨分离中...")} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">全部分离</button>
               </div>
            </div>
          </div>
          
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          {/* ✨ 下面这行是新加的存资产按钮 */}
          <button onClick={handleSaveAsset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><RefreshCcw size={12}/> 存资产</button>

          <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-bold text-zinc-300 hover:text-black hover:bg-white transition-all shadow-md whitespace-nowrap"><Download size={12}/> 下载</button>
        </div>
      )}

<div style={currentStyle} className={`${nodeBaseClass} ${selected ? selectedBorderClass : ''} overflow-hidden flex flex-col p-1.5 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]`}>
        <div className="w-full h-full relative flex items-center justify-center bg-transparent rounded-[20px] overflow-hidden">
          {displayVideo ? (
            <video key={displayVideo} src={displayVideo} preload="metadata" className="w-full h-full max-h-[500px] object-contain rounded-[18px]" controls autoPlay loop muted playsInline />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center dynamic-particles-container">
              <input
                type="file"
                id={`upload-render-${id}`}
                className="hidden"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const result = ev.target?.result as string;
                      const vid = document.createElement('video');
                      vid.src = result;
                      vid.onloadedmetadata = () => {
                        const w = vid.videoWidth;
                        const h = vid.videoHeight;
                        const ratioValue = w / h;
                        let finalRatio = '16:9';
                        if (ratioValue < 0.8) finalRatio = '9:16';
                        else if (ratioValue >= 0.8 && ratioValue < 1.2) finalRatio = '1:1';
                        else if (ratioValue >= 1.2 && ratioValue < 1.5) finalRatio = '4:3';
                        const asset = { id: `local_${Date.now()}`, _type: 'video', url: result, prompt: file.name, timestamp: Date.now(), ratio: finalRatio };
                        updateNodeData(id, { asset: asset, resultUrl: result, ratio: finalRatio, prompt: file.name, isGenerating: false });
                      };
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes space-drift {
                  0% { background-position: 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0px 0px; }
                  100% { background-position: 200px 300px, -150px 200px, 100px -200px, -200px -100px, 150px 150px; }
                }
                @keyframes nebula-pulse {
                  0% { opacity: 0.3; transform: scale(1); }
                  50% { opacity: 0.8; transform: scale(1.1); }
                  100% { opacity: 0.3; transform: scale(1); }
                }
                .dynamic-particles-container {
                  background-image: 
                    radial-gradient(1px 1px at 20px 20px, rgba(255,255,255,0.9), transparent),
                    radial-gradient(1.5px 1.5px at 40px 70px, rgba(255,255,255,0.7), transparent),
                    radial-gradient(2px 2px at 80px 120px, rgba(255,255,255,0.4), transparent),
                    radial-gradient(1px 1px at 150px 30px, rgba(255,255,255,0.8), transparent),
                    radial-gradient(1px 1px at 10px 130px, rgba(165,180,252,0.6), transparent);
                  background-size: 80px 80px, 110px 110px, 160px 160px, 90px 90px, 60px 60px;
                  animation: space-drift 50s linear infinite;
                }
                .dynamic-particles-container::before {
                  content: "";
                  position: absolute;
                  inset: -20%;
                  background: 
                    radial-gradient(circle at 20% 80%, rgba(76, 29, 149, 0.25) 0%, transparent 50%),
                    radial-gradient(circle at 80% 20%, rgba(30, 58, 138, 0.25) 0%, transparent 50%);
                  animation: nebula-pulse 8s ease-in-out infinite alternate;
                  pointer-events: none;
                  z-index: 1;
                }
                .dynamic-particles-container::after {
                  content: "";
                  position: absolute;
                  inset: 0;
                  background: radial-gradient(circle at center, transparent 20%, rgba(2, 2, 4, 0.95) 100%);
                  pointer-events: none;
                  z-index: 2;
                }
              `}} />
              {data.isGenerating ? (
                <>
                  <Loader2 size={24} className="mb-3 opacity-80 animate-spin text-amber-200" />
                  <span className="text-[10px] uppercase font-bold tracking-widest text-amber-200 animate-pulse">Synthesizing Video...</span>
                </>
              ) : (
                <>
                  <div className="flex gap-3 z-10 items-center">
                    <div
                      onClick={() => document.getElementById(`upload-render-${id}`)?.click()}
                      className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 hover:border-white/30 transition-all nodrag"
                    >
                      <Upload size={14} className="text-zinc-400" />
                    </div>
                    <button onClick={handleRender} className="px-4 py-2 border border-white/10 rounded-full text-[11px] font-bold text-zinc-300 hover:bg-white/10 hover:text-white transition-all nodrag">文本生成</button>
                    <button onClick={() => showToast("请先将外部媒体连入左侧节点")} className="px-4 py-2 border border-white/10 rounded-full text-[11px] font-bold text-zinc-300 hover:bg-white/10 hover:text-white transition-all nodrag">首尾合成</button>
                  </div>
                  <span className="z-10 text-[10px] uppercase font-bold tracking-widest text-zinc-500 mt-3">Video Node</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {!isReferenceOnly && (
        <div className={`absolute top-[100%] pt-5 left-1/2 -translate-x-1/2 w-[540px] transition-all duration-500 ease-out opacity-0 -translate-y-4 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto ${selected ? '!opacity-100 !translate-y-0 !pointer-events-auto' : ''}`}>
           <div className="bg-black/60 border border-white/[0.08] backdrop-blur-3xl rounded-[32px] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.85)] focus-within:border-white/20 transition-all flex flex-col">
              
               <MentionTextarea 
                 value={data.prompt || ''}
                 onChange={(v: string) => updateNodeData(id, { prompt: v })}
                 placeholder="描述运镜方式与视频动态细节，或输入 @ 引用镜头序列..."
                 incomingAssets={incomingAssets}
                 dataAttrs={{ 'data-node-id': id, 'data-field': 'prompt', 'data-field-label': '视频提示词' }}
               />
              
              <div className="flex items-center justify-between px-3 pb-2 pt-2 border-t border-white/5">
              <div className="flex items-center gap-2">
                    <CustomSelect className="w-[180px]" value={data.model || 'doubao-seedance-2-0'} options={[{ value: 'doubao-seedance-2-0', label: 'Seedance 2.0 (默认)' }, { value: 'kling-o3', label: 'Kling O3' }]} onChange={(v: string) => updateNodeData(id, { model: v })} />
                    
                 {/* ✨ 修复：全面升级的高级黑玻璃视频参数控制舱 */}
                 <div className="relative group/cfg">
                    <button onClick={() => setShowConfig(!showConfig)} className={`p-2 rounded-[10px] transition-all nodrag ${showConfig ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'}`}><Settings2 size={16}/></button>
                    {showConfig && (
                       <div className="absolute bottom-[calc(100%+10px)] left-0 w-[280px] bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/10 rounded-[20px] shadow-[0_40px_80px_rgba(0,0,0,0.95)] p-4 z-50 flex flex-col gap-4 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                          
                          <div className="flex flex-col gap-2">
                             <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">物理时长 (Duration)</label>
                             <div className="flex gap-1 bg-black/40 p-1.5 rounded-[12px] border border-white/5">
                               {[4, 5, 8, 10, 15].map(d => (
                                 <button key={d} onClick={() => updateNodeData(id, { duration: d })} className={`flex-1 py-1.5 text-[11px] rounded-[8px] font-bold transition-all nodrag ${data.duration === d ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-inner' : 'text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent'}`}>{d}s</button>
                               ))}
                             </div>
                          </div>

                          <div className="flex flex-col gap-2">
                             <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">画面比例 (Ratio)</label>
                             <div className="flex gap-1 bg-black/40 p-1.5 rounded-[12px] border border-white/5">
                               {['16:9', '9:16', '1:1', '4:3'].map(r => (
                                 <button key={r} onClick={() => updateNodeData(id, { ratio: r })} className={`flex-1 py-1.5 text-[11px] rounded-[8px] font-bold transition-all nodrag ${data.ratio === r ? 'bg-white/10 text-white border border-white/10 shadow-inner' : 'text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent'}`}>{r}</button>
                               ))}
                             </div>
                          </div>
                          
                          <div className="flex flex-col gap-2 z-10">
                             <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">渲染精度 (Resolution)</label>
                             <div className="flex flex-wrap gap-1 bg-black/40 p-1.5 rounded-[12px] border border-white/5">
                               {['480P', '720P', '1080P', '4K'].map(res => (
                                  <button key={res} onClick={() => updateNodeData(id, { resolution: res })} className={`flex-1 py-1.5 px-2 text-[11px] rounded-[8px] font-bold transition-all nodrag ${data.resolution === res ? 'bg-white/[0.08] text-white border border-white/20 shadow-inner' : 'text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent'}`}>{res}</button>
                               ))}
                             </div>
                          </div>
                       </div>
                    )}
                 </div>
                 </div>
                 
                 <button onClick={handleRender} className={`h-[44px] w-[44px] rounded-full flex items-center justify-center transition-all nodrag shadow-lg ${data.isGenerating ? 'bg-amber-500/20 text-amber-400 cursor-wait' : 'bg-white text-black hover:scale-110 shadow-[0_0_25px_rgba(255,255,255,0.5)]'}`}>
                   {data.isGenerating ? <Loader2 size={20} className="animate-spin" /> : <MoveUp size={20} strokeWidth={2.5} />}
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
export const RenderNode = React.memo(_RenderNode);

// ==========================================
// 4. 合成终点节点 (CombineNode)
// ==========================================
const _CombineNode = ({ data }: any) => {
  return (
    <div className="relative z-20 group">
      {/* ✨ 将触点放在外壳上 */}
      <Handle type="target" position={Position.Left} id="left" className={handleLeft} />
      
      <div className={`${nodeBaseClass} w-[400px] aspect-video overflow-hidden flex flex-col p-1.5`}>
        <div className="w-full h-full relative flex items-center justify-center bg-black rounded-[20px] overflow-hidden">
          {data.resultUrl ? (
            <video key={data.resultUrl} src={data.resultUrl} preload="auto" className="w-full h-full object-contain rounded-[20px]" controls autoPlay loop muted playsInline />
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-600">
               {data.isCombining ? (
                 <><Loader2 size={32} className="mb-3 opacity-80 animate-spin text-white" /><span className="text-[12px] uppercase font-bold text-white animate-pulse tracking-widest">Global Compiling...</span></>
               ) : (
                 <><Layers size={32} className="mb-3 opacity-50" /><span className="text-[12px] uppercase font-medium tracking-widest">Final Output</span></>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export const CombineNode = React.memo(_CombineNode);

// ==========================================
// 5. 全新路线：表格型分镜脚本节点 (ScriptTableNode)
// ==========================================
const _ScriptTableNode = ({ id, data, selected }: any) => {
  const { updateNodeData } = useReactFlow();

  const updateRow = (rowId: string, field: string, value: string) => {
    const newRows = data.rows.map((r: any) => r.id === rowId ? { ...r, [field]: value } : r);
    updateNodeData(id, { rows: newRows });
  };

  const addRow = () => {
    const newRow = { id: `row_${Date.now()}`, shotNumber: String(data.rows.length + 1).padStart(2, '0'), duration: '5s', camera: '', movement: '', shotType: '', videoDesc: '', characters: '', audio: '', imgScene: '', imgShotType: '', imgDesc: '', imgCharacters: '', imgEmotion: '', imgPrompt: '' };
    updateNodeData(id, { rows: [...data.rows, newRow] });
  };

  const InputField = ({ label, value, onChange, isTextArea = false, field = '', nodeId = '' }: any) => (
    <div className="flex flex-col gap-1 w-full">
      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest pl-0.5">{label}</span>
      {isTextArea ? (
        <textarea data-node-id={nodeId} data-field={field} data-field-label={label} className="w-full bg-black/40 border border-white/[0.05] focus:border-white/20 rounded-[8px] p-2 text-[11px] text-zinc-200 outline-none resize-none custom-scrollbar nodrag nopan transition-colors min-h-[48px]" value={value} onChange={(e) => onChange(e.target.value)} onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }} />
      ) : (
        <input data-node-id={nodeId} data-field={field} data-field-label={label} className="w-full bg-black/40 border border-white/[0.05] focus:border-white/20 rounded-[8px] p-2 text-[11px] text-zinc-200 outline-none nodrag nopan transition-colors h-[30px]" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );

  return (
    <div className="relative group/node z-20" style={{ width: '1000px' }}>
      <Handle type="target" position={Position.Left} id="left" className={handleLeft} />
      <Handle type="source" position={Position.Right} id="right" className={handleRight} />
      
      <div className={`${nodeBaseClass} ${selected ? selectedBorderClass : ''} flex flex-col p-4 transition-all duration-500`}>
        
        {/* 表格头部信息 */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-[10px] bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shadow-inner">
               <Table size={14} className="text-amber-300" />
             </div>
             <div className="flex flex-col">
               <span className="text-[14px] font-bold text-white tracking-widest">全局脚本视图</span>
               <span className="text-[9px] text-zinc-500 font-mono tracking-wider mt-0.5">SCRIPT TABLE MATRIX</span>
             </div>
          </div>
          
          <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-400">
             <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-[8px] border border-white/5 shadow-inner">
               <span className="text-amber-500">光影</span> <span className="truncate max-w-[150px]">{data.sceneLighting || '未继承'}</span>
             </div>
             <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-[8px] border border-white/5 shadow-inner">
               <span className="text-indigo-400">机位</span> <span className="truncate max-w-[150px]">{data.globalCamera || '未继承'}</span>
             </div>
          </div>
        </div>

        {/* 原文引用 */}
        <div className="mb-4 text-[11px] text-zinc-500 leading-relaxed font-light p-3 bg-white/[0.02] rounded-[12px] border border-white/[0.02] shadow-inner">
            <span className="text-zinc-400 font-bold opacity-50 mr-1">“</span>{data.scriptText}<span className="text-zinc-400 font-bold opacity-50 ml-1">”</span>
        </div>

        {/* 表格实体：多行遍历 */}
        <div className="flex flex-col gap-4">
           {data.rows?.map((row: any, index: number) => (
              <div key={row.id} className="flex flex-col bg-[#050505] border border-white/10 rounded-[16px] shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden group/row transition-all focus-within:border-white/30">
                 
                 {/* 行标题 */}
                 <div className="bg-white/[0.03] border-b border-white/5 px-4 py-2 flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-white tracking-widest px-2 py-0.5 bg-white/10 rounded-[4px] border border-white/10 shadow-inner">
                      SHOT {row.shotNumber}
                    </span>
                 </div>

                 {/* 左右双轨视图 */}
                 <div className="flex w-full">
                    
                    {/* 左侧：视频生成属性 (Video Track) */}
                    <div className="w-1/2 p-4 border-r border-white/5 flex flex-col gap-3 relative">
                       <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/[0.02] to-transparent pointer-events-none" />
                       <div className="flex items-center gap-2 mb-1">
                          <Film size={12} className="text-indigo-400"/>
                          <span className="text-[10px] font-bold text-indigo-400/80 tracking-widest uppercase">生视频运镜参数 (Video Track)</span>
                       </div>
                       <div className="grid grid-cols-4 gap-2">
                          <InputField label="镜号" value={row.shotNumber} onChange={(v:any) => updateRow(row.id, 'shotNumber', v)} field="shotNumber" nodeId={id} />
                          <InputField label="时长" value={row.duration} onChange={(v:any) => updateRow(row.id, 'duration', v)} field="duration" nodeId={id} />
                          <InputField label="机位" value={row.camera} onChange={(v:any) => updateRow(row.id, 'camera', v)} field="camera" nodeId={id} />
                          <InputField label="景别" value={row.shotType} onChange={(v:any) => updateRow(row.id, 'shotType', v)} field="shotType" nodeId={id} />
                       </div>
                       <InputField label="出场角色" value={row.characters} onChange={(v:any) => updateRow(row.id, 'characters', v)} field="characters" nodeId={id} />
                       <InputField label="运镜与演进 (Movement)" value={row.movement} isTextArea onChange={(v:any) => updateRow(row.id, 'movement', v)} field="movement" nodeId={id} />
                       <InputField label="物理动作描述 (Action)" value={row.videoDesc} isTextArea onChange={(v:any) => updateRow(row.id, 'videoDesc', v)} field="videoDesc" nodeId={id} />
                       <InputField label="音效设计" value={row.audio} onChange={(v:any) => updateRow(row.id, 'audio', v)} field="audio" nodeId={id} />
                    </div>

                    {/* 右侧：首帧图属性 (Image Track) */}
                    <div className="w-1/2 p-4 flex flex-col gap-3 relative">
                       <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-bl from-amber-500/[0.02] to-transparent pointer-events-none" />
                       <div className="flex items-center gap-2 mb-1">
                          <ImageIcon size={12} className="text-amber-400"/>
                          <span className="text-[10px] font-bold text-amber-400/80 tracking-widest uppercase">生图首帧参数 (Image Track)</span>
                       </div>
                       <div className="grid grid-cols-3 gap-2">
                          <InputField label="场景" value={row.imgScene} onChange={(v:any) => updateRow(row.id, 'imgScene', v)} field="imgScene" nodeId={id} />
                          <InputField label="景别" value={row.imgShotType} onChange={(v:any) => updateRow(row.id, 'imgShotType', v)} field="imgShotType" nodeId={id} />
                          <InputField label="情绪" value={row.imgEmotion} onChange={(v:any) => updateRow(row.id, 'imgEmotion', v)} field="imgEmotion" nodeId={id} />
                       </div>
                       <InputField label="角色" value={row.imgCharacters} onChange={(v:any) => updateRow(row.id, 'imgCharacters', v)} field="imgCharacters" nodeId={id} />
                       <InputField label="静帧动作与站位 (Pose & Blocking)" value={row.imgDesc} isTextArea onChange={(v:any) => updateRow(row.id, 'imgDesc', v)} field="imgDesc" nodeId={id} />
                       <InputField label="拼合生图提示词 (Final Prompt)" value={row.imgPrompt} isTextArea onChange={(v:any) => updateRow(row.id, 'imgPrompt', v)} field="imgPrompt" nodeId={id} />
                    </div>
                 </div>
              </div>
           ))}
        </div>

        {/* 底部加行按钮 */}
        <button onClick={addRow} className="mt-4 w-full py-3 border border-dashed border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.05] rounded-[16px] flex items-center justify-center gap-2 text-[11px] font-bold text-zinc-400 hover:text-white transition-all nodrag">
          <Plus size={14} /> 增加分镜行
        </button>
      </div>
    </div>
  );
};
export const ScriptTableNode = React.memo(_ScriptTableNode);

// ==========================================
// 6. 全新路线：前置资产基建表格 (AssetTableNode) - 终极生图版
// ==========================================
const _AssetTableNode = ({ id, data, selected }: any) => {
  const { updateNodeData, getNodes, setNodes } = useReactFlow();
  const type = data.assetType || 'scene'; 
  const [zenMode, setZenMode] = useState<any>(null); 

  // ✨ 将生成的图片存档到右侧资产库
  const saveToAssets = (url: string, promptText: string) => {
    const { activeCanvasProjectId, updateCanvasProject } = useAppStore.getState();
    if (!activeCanvasProjectId || typeof updateCanvasProject !== 'function') return;
    const asset = { id: `local_${Date.now()}`, _type: 'image', url, prompt: promptText, timestamp: Date.now(), ratio: data.ratio || '16:9' };
    // ★ 函数式更新：从状态机原子快照读取最新 localAssets，杜绝竞态覆盖
    updateCanvasProject(activeCanvasProjectId, (prev: any) => ({ localAssets: [asset, ...(prev?.localAssets || [])] }));
    useAppStore.getState().setToastMsg("✅ 已自动存入右侧资产库！");
  };

  // ✨ 核心修复：使用 setNodes 进行安全的函数式更新，彻底解决异步状态互相覆盖导致图片丢失的问题
  const updateRow = (rowId: string, field: string, value: any) => {
    setNodes(nds => nds.map(n => {
      if (n.id === id) {
         const newRows = n.data.rows?.map((r: any) => r.id === rowId ? { ...r, [field]: value } : r);
         return { ...n, data: { ...n.data, rows: newRows } };
      }
      return n;
    }));
  };

  // ✨ 新增：支持一次性同时更新多个字段（专门防覆盖）
  const updateRowMulti = (rowId: string, updates: any) => {
    setNodes(nds => nds.map(n => {
      if (n.id === id) {
         const newRows = n.data.rows?.map((r: any) => r.id === rowId ? { ...r, ...updates } : r);
         return { ...n, data: { ...n.data, rows: newRows } };
      }
      return n;
    }));
  };

  // ✨ 新增：补齐缺失的文件上传解析逻辑
  // 🔍 找到 AssetTableNode 里的 handleUpload 函数并替换
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, rowId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      // ✨ 核心修复：同样使用压缩滤网
      const compressedBase64 = await compressImage(file);
      updateRow(rowId, 'resultUrl', compressedBase64);
    }
  };

  const addRow = () => {
    const newRow = { id: `row_${Date.now()}` };
    updateNodeData(id, { rows: [...(data.rows || []), newRow] });
  };

  const deleteRow = (rowId: string) => {
    const newRows = data.rows?.filter((r: any) => r.id !== rowId);
    updateNodeData(id, { rows: newRows });
  };

  // ✨ 单行生成逻辑（统一复用 buildImagePayload + 自动重试）
  const handleGenerateRow = async (rowId: string) => {
    const row = data.rows?.find((r: any) => r.id === rowId);
    if (!row || row.isGenerating) return;

    updateRow(rowId, 'isGenerating', true);
    
    // ★ 复用引擎统一 Payload 拼装器，消除参数不一致导致 400 的风险
    const canvasSettings = useAppStore.getState().canvasSettings;
    const payload = buildImagePayload(
      { prompt: row.prompt, model: data.model, ratio: data.ratio, quality: data.quality || '1K' },
      canvasSettings
    );

    console.log("[AssetTable 生图] 统一 Payload:", payload);

    // ★ 自动重试：最多 3 次，指数退避 1s/2s/4s
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetchApi('/v1/images/generations', { method: 'POST', body: JSON.stringify(payload) });
        const resData = await response.json();
        const url = resData.data?.[0]?.url || resData.url;

        if (url) {
          updateRowMulti(rowId, { resultUrl: url, isGenerating: false });
          saveToAssets(url, payload.prompt);
          return; // 成功，退出
        }
        throw new Error("API未返回图片 URL");
      } catch (e) {
        console.error(`[AssetTable 生图] 第 ${attempt + 1}/3 次失败:`, e);
        if (attempt >= 2) {
          useAppStore.getState().setToastMsg(`❌ 生成失败（已重试3次）：${(e as Error).message || '网络错误'}`);
          updateRow(rowId, 'isGenerating', false);
          return;
        }
        // 指数退避等待后重试
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  };

  // ✨ 批量生成逻辑（加入队列控制，最大并发 2，防止 API 限流）
  const handleBatchGenerate = async () => {
    const rowsToGen = data.rows?.filter((r:any) => !r.resultUrl && !r.isGenerating) || [];
    if (rowsToGen.length === 0) return useAppStore.getState().setToastMsg("当前没有需要生成的空行！");
    useAppStore.getState().setToastMsg(`🚀 已将 ${rowsToGen.length} 个资产压入渲染队列（并发上限2）...`);
    
    // ★ 队列控制：一次最多并发 2 个，逐个放行
    let completed = 0;
    const total = rowsToGen.length;
    const queue = [...rowsToGen];
    
    const worker = async () => {
      while (queue.length > 0) {
        const row = queue.shift();
        if (row) {
          await handleGenerateRow(row.id);
          completed++;
          useAppStore.getState().setToastMsg(`📊 资产生成进度：${completed}/${total}`);
        }
      }
    };
    
    // 启动 2 个并发 worker
    await Promise.all([worker(), worker()]);
  };

  // ✨ 导出为资产 JSON 压缩包
  const handleExportTable = () => {
    const exportData = {
      yr_type: 'asset_table',
      assetType: data.assetType,
      model: data.model,
      ratio: data.ratio,
      quality: data.quality,
      styleOverride: data.styleOverride,
      rows: data.rows
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const typeName = data.assetType === 'scene' ? '场景表' : data.assetType === 'character' ? '角色表' : '道具表';
    a.download = `W_${typeName}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    useAppStore.getState().setToastMsg(`✅ ${typeName} 导出成功！`);
  };

  // ✨ 提取独立节点到画布 (比例自动检测版)
  const extractToCanvas = (row: any) => {
    const thisNode = getNodes().find(n => n.id === id);
    if (!thisNode) return;

    // ★ 先创建节点，再异步修正比例（避免阻塞 UI）
    const newNodeId = `media_ext_${Date.now()}`;
    const newNode = {
      id: newNodeId, type: 'media',
      position: { x: thisNode.position.x + (thisNode.measured?.width || 1200) + 150, y: thisNode.position.y + (Math.random() * 200) },
      data: { 
        asset: {  // 💡 关键修复：打包成完整的引用实体
           id: `ext_${Date.now()}`,
           url: row.resultUrl,
           prompt: row.prompt,
           _type: 'image',
           category: type,
           ratio: data.ratio || '16:9'
        },
        ratio: data.ratio || '16:9', // 初始用表格比例，异步检测后会修正
        model: data.model || 'gpt-image-2',
        name: type === 'character' ? `@${row.name}` : row.name
      }
    };
    setNodes(nds => [...nds, newNode]);

    // ★ 异步检测图片真实比例，修正节点 ratio（防 object-cover 表格中比例误导）
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      if (w && h) {
        const rawRatio = w / h;
        // ★ 使用图片真实比例，不做离散预设匹配。宽度自适应：横图 320px，竖图按比例缩小
        const customWidth = rawRatio >= 1 ? 320 : Math.round(220 * rawRatio);
        // 用函数式更新：写入原始比例值，画布渲染时直接使用
        setNodes(nds => nds.map(n => {
          if (n.id === newNodeId) {
            return { ...n, data: { ...n.data, ratio: w >= h ? '16:9' : '9:16', customAspectRatio: rawRatio, customWidth, asset: { ...n.data.asset, ratio: w >= h ? '16:9' : '9:16', customAspectRatio: rawRatio, customWidth } } };
          }
          return n;
        }));
      }
    };
    img.onerror = () => {}; // 图片加载失败就保持表格原比例
    img.src = row.resultUrl;

    useAppStore.getState().setToastMsg("✅ 已提取为独立图片节点（比例自动检测中...）");
  };

  const getTheme = () => {
    if (type === 'scene') return { color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', icon: Map, title: '场景光影建档表 (Scene)', width: '1300px' };
    if (type === 'character') return { color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', icon: Users, title: '角色造型建档表 (Character)', width: '1500px' };
    return { color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/20', border: 'border-fuchsia-500/30', icon: Package, title: '核心道具建档表 (Prop)', width: '1100px' };
  };
  const theme = getTheme();
  const Icon = theme.icon;

  const InputField = ({ value, onChange, placeholder, field = '', nodeId = '' }: any) => (
    <textarea
      data-node-id={nodeId} data-field={field} data-field-label={placeholder || field}
      className="w-full h-full min-h-[100px] bg-black/40 border border-white/5 focus:border-white/20 hover:bg-white/[0.02] rounded-[8px] p-2 text-[11px] text-zinc-300 outline-none resize-none custom-scrollbar nodrag nopan transition-colors" 
      value={value || ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  );

  return (
    <div className="relative group/node z-20" style={{ width: theme.width, minHeight: '200px' }}>
      <Handle type="target" position={Position.Left} id="left" className={handleLeft} />
      <Handle type="source" position={Position.Right} id="right" className={handleRight} />
      
      {/* 禅定放大编辑器 / 图片放大查看器 */}
      {zenMode && zenMode.type === 'text' && (
        <ZenEditor label={zenMode.label} value={data.rows?.find((r:any)=>r.id===zenMode.rowId)?.[zenMode.field] || ''} onChange={(val: string) => updateRow(zenMode.rowId, zenMode.field, val)} onClose={() => setZenMode(null)} dataAttrs={{ 'data-node-id': id, 'data-field': zenMode.field, 'data-field-label': zenMode.label }} />
      )}
      {zenMode && zenMode.type === 'image' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/90 backdrop-blur-md p-8" onClick={() => setZenMode(null)}>
           <img src={zenMode.url} className="max-w-[90vw] max-h-[90vh] object-contain rounded-[16px] shadow-[0_0_100px_rgba(0,0,0,1)]" onClick={e=>e.stopPropagation()}/>
           <button onClick={() => setZenMode(null)} className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-red-500 rounded-full text-white transition-colors"><X size={20}/></button>
        </div>,
        document.body
      )}

      <div className={`${nodeBaseClass} ${selected ? selectedBorderClass : ''} flex flex-col p-4 transition-all duration-500`}>
        
        {/* 头部信息 */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3 shrink-0">
          <div className="flex items-center gap-3">
             <div className={`w-8 h-8 rounded-[10px] ${theme.bg} ${theme.border} flex items-center justify-center shadow-inner`}><Icon size={14} className={theme.color} /></div>
             <div className="flex flex-col">
               <span className="text-[14px] font-bold text-white tracking-widest">{theme.title}</span>
               <span className="text-[9px] text-zinc-500 font-mono tracking-wider mt-0.5">GENERATIVE ASSET MATRIX</span>
             </div>
          </div>
          {/* ✨ 导出按钮 */}
          <button onClick={handleExportTable} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-zinc-300 hover:text-white transition-all nodrag shadow-inner">
             <Download size={12} /> 导出为表格文件
          </button>
        </div>

        {/* ✨ 全局生成参数控制舱 */}
        <div className="flex items-center gap-3 bg-black/50 p-2.5 rounded-[12px] border border-white/5 mb-3 shadow-inner shrink-0">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1"><Settings2 size={12} className="inline mr-1"/>全局参数</span>
            <div className="w-px h-4 bg-white/10 mx-1"/>
            {/* ★ 模型选项与 ShotNode/MediaNode 对齐，移除不存在的 banana2 */}
            <CustomSelect className="w-[140px]" value={data.model || 'gpt-image-2'} options={[
  { value: 'gpt-image-2', label: 'GPT-Image-2' },
  { value: 'banana-pro', label: 'Banana Pro' },
  { value: 'seedream5.0', label: 'Seedream 5.0' }
]} onChange={(v: string) => {
  // ★ 模型切换时自动重置画质到兼容值（与 ShotNode 行为一致）
  let nextQuality = data.quality || '1K';
  if (v === 'seedream5.0') {
    if (!['2K', '3K'].includes(nextQuality)) nextQuality = '2K';
  } else if (v === 'banana-pro') {
    if (!['1K', '2K', '4K'].includes(nextQuality)) nextQuality = '2K';
  } else {
    nextQuality = '1K';
  }
  updateNodeData(id, { model: v, quality: nextQuality });
}} />
            <CustomSelect className="w-[100px]" value={data.ratio || useAppStore.getState().canvasSettings.globalRatio || '16:9'} options={[{ value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' }, { value: '1:1', label: '1:1' }, { value: '4:3', label: '4:3' }, { value: '3:4', label: '3:4' }]} onChange={(v: string) => updateNodeData(id, { ratio: v })} />
            {/* ★ 画质选项：根据当前模型动态生成，与 ShotNode 标准一致 */}
            <CustomSelect className="w-[120px]" value={data.quality || getImageQualityOptions(data.model || 'gpt-image-2')[0].value} options={getImageQualityOptions(data.model || 'gpt-image-2')} onChange={(v: string) => updateNodeData(id, { quality: v })} />
            <CustomSelect className="w-[140px]" value={data.styleOverride || '继承全局预设'} options={[{ value: '继承全局预设', label: '继承全局预设' }, { value: '🎬 电影质感', label: '🎬 电影质感' }, { value: '🌸 二次元', label: '🌸 二次元' }, { value: '📷 极致写实', label: '📷 极致写实' }, { value: '🧊 3D 渲染', label: '🧊 3D 渲染' }, { value: '🌃 赛博朋克', label: '🌃 赛博朋克' }]} onChange={(v: string) => updateNodeData(id, { styleOverride: v })} />
            
            <button onClick={handleBatchGenerate} className="px-5 py-2 bg-indigo-500 text-white hover:bg-indigo-400 rounded-[8px] text-[11px] font-bold shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all ml-auto flex items-center gap-1.5 nodrag">
               <Sparkles size={14}/> 批量生成全表
            </button>
        </div>

        {/* 动态表头 */}
        <div className="flex gap-2 px-2 pb-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 mb-2">
          {type === 'scene' && (
            <><div className="w-[10%]">场景名</div><div className="w-[8%]">时间</div><div className="w-[15%]">光影氛围</div><div className="w-[10%]">出现阶段</div><div className="w-[30%]">生图提示词 (Prompt)</div><div className="w-[23%] text-center">成图列 (Asset)</div><div className="w-[4%] text-center">操作</div></>
          )}
          {type === 'character' && (
            <><div className="w-[8%]">人物名</div><div className="w-[5%]">年龄</div><div className="w-[15%]">着装</div><div className="w-[12%]">特质</div><div className="w-[8%]">出场阶段</div><div className="w-[25%]">生图提示词 (Prompt)</div><div className="w-[23%] text-center">成图列 (Asset)</div><div className="w-[4%] text-center">操作</div></>
          )}
          {type === 'prop' && (
            <><div className="w-[12%]">道具名</div><div className="w-[15%]">出现节点</div><div className="w-[46%]">生图提示词 (Prompt)</div><div className="w-[23%] text-center">成图列 (Asset)</div><div className="w-[4%] text-center">操作</div></>
          )}
        </div>

        {/* 数据行遍历 */}
        <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1 nowheel" onWheelCapture={(e) => { if (e.target instanceof HTMLTextAreaElement) return; const el = e.currentTarget; el.scrollTop += e.deltaY; e.stopPropagation(); e.preventDefault(); }}>
           {data.rows?.map((row: any) => (
              <div key={row.id} className="flex gap-2 bg-[#050505]/50 hover:bg-[#050505] border border-white/5 hover:border-white/20 p-1.5 rounded-[12px] transition-all items-stretch">
                
                {/* 各种业务列 */}
                {type === 'scene' && (
                  <><div className="w-[10%]"><InputField value={row.name} placeholder="场景名" onChange={(v:any) => updateRow(row.id, 'name', v)} field="name" nodeId={id} /></div>
                  <div className="w-[8%]"><InputField value={row.time} placeholder="时间" onChange={(v:any) => updateRow(row.id, 'time', v)} field="time" nodeId={id} /></div>
                  <div className="w-[15%]"><InputField value={row.lighting} placeholder="光影" onChange={(v:any) => updateRow(row.id, 'lighting', v)} field="lighting" nodeId={id} /></div>
                  <div className="w-[10%]"><InputField value={row.stage} placeholder="阶段" onChange={(v:any) => updateRow(row.id, 'stage', v)} field="stage" nodeId={id} /></div></>
                )}
                {type === 'character' && (
                  <><div className="w-[8%]"><InputField value={row.name} placeholder="人物名" onChange={(v:any) => updateRow(row.id, 'name', v)} field="name" nodeId={id} /></div>
                  <div className="w-[5%]"><InputField value={row.age} placeholder="年龄" onChange={(v:any) => updateRow(row.id, 'age', v)} field="age" nodeId={id} /></div>
                  <div className="w-[15%]"><InputField value={row.clothing} placeholder="着装" onChange={(v:any) => updateRow(row.id, 'clothing', v)} field="clothing" nodeId={id} /></div>
                  <div className="w-[12%]"><InputField value={row.traits} placeholder="特质" onChange={(v:any) => updateRow(row.id, 'traits', v)} field="traits" nodeId={id} /></div>
                  <div className="w-[8%]"><InputField value={row.stage} placeholder="阶段" onChange={(v:any) => updateRow(row.id, 'stage', v)} field="stage" nodeId={id} /></div></>
                )}
                {type === 'prop' && (
                  <><div className="w-[12%]"><InputField value={row.name} placeholder="道具名" onChange={(v:any) => updateRow(row.id, 'name', v)} field="name" nodeId={id} /></div>
                  <div className="w-[15%]"><InputField value={row.stage} placeholder="阶段" onChange={(v:any) => updateRow(row.id, 'stage', v)} field="stage" nodeId={id} /></div></>
                )}

                {/* ✨ 统一的生图提示词编辑列 (带放大按钮) */}
                <div className={`${type === 'scene' ? 'w-[30%]' : type === 'character' ? 'w-[25%]' : 'w-[46%]'} relative group/prompt`}>
                   <InputField value={row.prompt} placeholder="提示词" onChange={(v:any) => updateRow(row.id, 'prompt', v)} field="prompt" nodeId={id} />
                   <button onClick={()=>setZenMode({type: 'text', rowId: row.id, field: 'prompt', label: '编辑生图提示词'})} className="absolute top-2 right-2 p-1.5 bg-black/80 backdrop-blur-md rounded-lg opacity-0 group-hover/prompt:opacity-100 text-zinc-400 hover:text-white transition-all shadow-md"><Expand size={12}/></button>
                </div>

                 {/* ✨ 核心：成图列 (自适应放大与生成控制) */}
                 <div className="w-[23%] relative bg-black/60 border border-white/5 rounded-[8px] flex flex-col items-center justify-center group/img overflow-hidden min-h-[100px]">
                     {row.isGenerating ? (
                        <div className="flex flex-col items-center gap-2 text-indigo-400">
                          <Loader2 size={24} className="animate-spin" />
                          <span className="text-[10px] font-mono tracking-widest animate-pulse">RENDERING...</span>
                          {/* ★ 终止按钮：解决生图卡死/转圈时无法重试的问题 */}
                          <button onClick={() => updateRowMulti(row.id, { isGenerating: false })} className="px-3 py-1 bg-red-500/20 hover:bg-red-500/50 text-red-300 hover:text-white rounded-[6px] text-[10px] font-bold transition-all nodrag flex items-center gap-1 border border-red-500/30">
                            <X size={10}/> 终止
                          </button>
                        </div>
                    ) : row.resultUrl ? (
                       <>
                         <img src={row.resultUrl} className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500" onClick={() => setZenMode({ type: 'image', url: row.resultUrl })}/>
                         <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity">
                            <button onClick={() => extractToCanvas(row)} title="克隆到画布节点" className="p-1.5 bg-black/80 backdrop-blur-md rounded-[6px] text-white hover:bg-indigo-500 transition-colors"><Copy size={12}/></button>
                            <button onClick={() => updateRow(row.id, 'resultUrl', null)} title="清除图片" className="p-1.5 bg-black/80 backdrop-blur-md rounded-[6px] text-white hover:bg-red-500 transition-colors"><Trash2 size={12}/></button>
                         </div>
                       </>
                    ) : (
                       <div className="flex gap-2">
                         <button onClick={() => handleGenerateRow(row.id)} className="px-3 py-1.5 bg-white text-black hover:scale-105 rounded-[6px] text-[10px] font-bold flex items-center gap-1 shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all nodrag"><Wand2 size={12}/> 生成</button>
                         <label htmlFor={`upload-${row.id}`} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-[6px] text-[10px] text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer transition-all nodrag">
                            <Upload size={12}/> 上传
                            <input type="file" id={`upload-${row.id}`} className="hidden" accept="image/*" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if(file) {
                                   const compressedBase64 = await compressImage(file);
                                   // 🚀 核心修复：把图片仅写给当前的 row，而不是给整个表格大节点！
                                   updateRowMulti(row.id, { resultUrl: compressedBase64 });
                                }
                             }} />
                         </label>
                       </div>
                    )}
                 </div>

                {/* 垃圾桶删除列 */}
                <div className="w-[4%] flex items-center justify-center">
                   <button onClick={() => deleteRow(row.id)} className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-600 hover:text-white hover:bg-red-500/80 transition-all nodrag"><Trash2 size={14}/></button>
                </div>
              </div>
           ))}
        </div>

        <button onClick={addRow} className="mt-3 w-full py-2 border border-dashed border-white/10 hover:border-white/30 bg-white/[0.01] hover:bg-white/[0.05] rounded-[10px] flex items-center justify-center gap-2 text-[11px] font-bold text-zinc-500 hover:text-white transition-all nodrag">
          <Plus size={14} /> 新增自定义行
        </button>
      </div>
    </div>
  );
};
export const AssetTableNode = React.memo(_AssetTableNode);
// 🚨 核心修复2：删掉多余的反大括号，正确闭合整个组件

// ==========================================
// 6. 文本备注节点 (TextNode) —— 创作者随笔与脚本草稿
// ==========================================
const _TextNode = ({ id, data, selected }: any) => {
  const { updateNodeData } = useReactFlow();

  return (
    <div className="relative group z-20 w-[300px]">
      <Handle type="target" position={Position.Left} id="left" className={handleLeft} />
      <Handle type="source" position={Position.Right} id="right" className={handleRight} />

      <div className={`${nodeBaseClass} ${selected ? selectedBorderClass : ''} flex flex-col p-4`}>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
          <Type size={14} className="text-zinc-400" />
          <span className="text-[12px] font-bold text-white tracking-widest">文本备注 (Note)</span>
        </div>
        
        <textarea
          data-node-id={id} data-field="text" data-field-label="文本内容"
          value={data.text || ''}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
          placeholder="在此输入自定义备注或剧本草稿..."
          className="w-full bg-black/40 border border-white/[0.05] rounded-[12px] p-3 text-[11px] text-zinc-300 outline-none resize-none min-h-[120px] focus:border-white/20 transition-all nodrag nopan"
          onWheelCapture={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
};
export const TextNode = React.memo(_TextNode);

// ==========================================
// 7. 全景图节点 (PanoramaNode) — 360° 圆柱体 / 720° 球体 场景环境生成与预览
// ==========================================
const _PanoramaNode = ({ id, data, selected }: any) => {
  const { updateNodeData, getNodes, setNodes } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes();
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  // ★ 全景模式：360 圆柱体 / 720 球体，默认 360 向后兼容
  const [panoramaMode, setPanoramaMode] = useState<'360' | '720'>(data.panoramaMode || '360');
  const is720 = panoramaMode === '720';

  // 收集入边连线的参考图（用户连线控制参考图来源）
  const incomingRefs = useMemo(() => edges
    .filter(e => e.target === id)
    .map(e => {
      const src = nodes.find(n => n.id === e.source);
      return src?.data?.resultUrl || src?.data?.frameUrl || src?.data?.asset?.url || null;
    })
    .filter(Boolean), [edges, nodes, id]);

  const displayImage = data.resultUrl || data.frameUrl;
  const status = data.status || 'draft';
  const currentModel = data.model || 'gpt-image-2';

  // ★ 切换模型时自动矫正清晰度到该模型支持的档位
  const handleModelChange = (v: string) => {
    const opts = getImageQualityOptions(v);
    const currentQuality = data.quality || '';
    const isValid = opts.some((o: any) => o.value === currentQuality);
    updateNodeData(id, { model: v, quality: isValid ? currentQuality : opts[0].value });
  };

  // ★ 比例映射：有图用图片真实比例，无图用预设宽高比
  const panoImageDims = useMediaDimensions(displayImage);
  const panoStyle = useMemo(() => {
    if (panoImageDims) {
      return { width: 560, aspectRatio: String(panoImageDims.width / panoImageDims.height) };
    }
    const ratio = data.ratio || '21:9';
    const ratioMap: Record<string, { width: number; aspectRatio: string }> = {
      '21:9': { width: 560, aspectRatio: '21/9' },
      '32:9': { width: 640, aspectRatio: '32/9' },
      '16:9': { width: 480, aspectRatio: '16/9' },
    };
    return ratioMap[ratio] || ratioMap['21:9'];
  }, [panoImageDims, data.ratio]);

  // ★ 全景图生成
  const handleGenerate = async () => {
    if (isGenerating || status === 'generating') return;
    setIsGenerating(true);
    updateNodeData(id, { status: 'generating' });

    try {
      // 从后端获取全景图专用提示词
      let panoramaPrompt = '';
      try {
        const promptRes = await fetchApi('/v1/canvas/prompt', {
          method: 'POST',
          body: JSON.stringify({ prompt_type: 'panorama-gen', raw: true }),
        });
        const promptData = await promptRes.json();
        panoramaPrompt = promptData.prompt || '';
      } catch (e) {
        console.warn('[PanoramaNode] 获取全景提示词失败，使用内置兜底:', e);
      }

      // 拼接最终 prompt：用户场景描述 + 全景图制作提示词
      const userPrompt = data.prompt || '';
      const finalPrompt = userPrompt
        ? `${userPrompt}\n\n${panoramaPrompt}`
        : panoramaPrompt;

      const model = currentModel;
      const quality = data.quality || getImageQualityOptions(model)[0].value;
      // ★ 720 模式固定 2:1 equirectangular 比例，360 模式使用用户选择的比例
      const ratio = is720 ? '2:1' : (data.ratio || '21:9');

      // ★ 拼接比例前缀
      let ratioPrefix = '';
      if (model === 'gpt-image-2') {
        if (is720) {
          ratioPrefix = 'equirectangular 全景投影 2:1 画幅, 360度环绕球体全景图, ';
        } else {
          const prefixMap: Record<string, string> = {
            '21:9': '横版 21:9 超宽全景画幅, ',
            '32:9': '横版 32:9 超宽全景画幅, ',
            '16:9': '横版 16:9 电影画幅, ',
          };
          ratioPrefix = prefixMap[ratio] || '横版 21:9 超宽全景画幅, ';
        }
      } else {
        if (is720) {
          ratioPrefix = 'equirectangular panorama 2:1, 360-degree spherical panorama, seamless tiling, ';
        } else {
          const prefixMap: Record<string, string> = {
            '21:9': 'ultrawide 21:9 panoramic, ',
            '32:9': 'ultrawide 32:9 panoramic, ',
            '16:9': 'widescreen 16:9, ',
          };
          ratioPrefix = prefixMap[ratio] || 'ultrawide 21:9 panoramic, ';
        }
      }

      const payload: any = {
        model,
        prompt: ratioPrefix + finalPrompt,
        n: 1,
      };

      // ★ 不同模型的清晰度参数映射（与 useCanvasEngine.ts 严格对齐）
      if (model === 'banana-pro') {
        payload.aspectRatio = ratio;
        // banana-pro: imageSize = '1K' | '2K' | '4K'
        payload.imageSize = quality.includes('4K') ? '4K' : quality.includes('2K') ? '2K' : '1K';
      } else if (model === 'seedream5.0' || model === 'seedream-5-0-pro-260628') {
        // seedream5.0: 仅支持 2K/3K，需按比例精确映射 WxH
        const seedreamSizeMap: Record<string, Record<string, string>> = {
          '16:9': { '2K': '2736x1538', '3K': '3456x1944' },
          '9:16': { '2K': '1538x2736', '3K': '1944x3456' },
          '1:1':  { '2K': '2048x2048', '3K': '3072x3072' },
          '4:3':  { '2K': '2364x1774', '3K': '3072x2304' },
          '3:4':  { '2K': '1774x2364', '3K': '2304x3072' },
          '21:9': { '2K': '3136x1344', '3K': '3584x1536' },
          '32:9': { '2K': '4096x1152', '3K': '5120x1440' },
          // ★ 720° equirectangular 2:1 比例（Seedream 5.0 支持的自定义尺寸）
          '2:1':  { '2K': '3072x1536', '3K': '4096x2048' },
        };
        const grade = quality.includes('3K') ? '3K' : '2K';
        payload.size = (seedreamSizeMap[ratio] || seedreamSizeMap['16:9'])[grade];
      }

      // 收集参考图
      const refs = incomingRefs.filter(Boolean);
      if (refs.length > 0) {
        payload.images = refs;
      }

      console.log('[PanoramaNode] 全景图生成 payload:', payload);

      const response = await fetchApi('/v1/images/generations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      let url: string | null = null;
      if (resData.data?.[0]?.url) url = resData.data[0].url;
      else if (resData.url) url = resData.url;
      else if (resData.images?.[0]?.url || resData.images?.[0]) url = resData.images?.[0]?.url || resData.images?.[0];
      else if (resData.choices?.[0]?.message?.content) {
        const match = resData.choices[0].message.content.match(/!\[.*?\]\((.*?)\)/);
        if (match?.[1]) url = match[1];
      }

      if (url) {
        updateNodeData(id, { status: 'done', resultUrl: url, frameUrl: url, panoramaMode });
        useAppStore.getState().setToastMsg(is720 ? '✅ 720° 球体全景图生成成功！点击查看' : '✅ 全景图生成成功！点击图片查看 360° 全景');
      } else {
        throw new Error('API 未返回全景图 URL');
      }
    } catch (error: any) {
      console.error('[PanoramaNode] 全景图生成失败:', error);
      updateNodeData(id, { status: 'failed' });
      useAppStore.getState().setToastMsg(`❌ 全景图生成失败: ${error.message || '未知错误'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ★ 截图回调：从全景查看器截取当前视角，创建新图片节点
  const handleCapture = useCallback((dataUrl: string) => {
    const thisNode = getNodes().find((n: any) => n.id === id);
    if (!thisNode || !dataUrl) return;

    const captureId = `capture_${Date.now()}`;
    const captureNode = {
      id: captureId,
      type: 'media',
      position: { x: thisNode.position.x, y: thisNode.position.y + 300 },
      data: {
        resultUrl: dataUrl,
        prompt: `全景截图: ${data.prompt || ''}`,
        ratio: '16:9',
        model: data.model || 'gpt-image-2',
        status: 'done',
      }
    };

    setNodes((nds: any) => [...nds, captureNode]);
    useAppStore.getState().setToastMsg('📸 当前视角已截取为新图片节点！');
  }, [id, data.prompt, data.model, getNodes, setNodes]);

  return (
    <div className="relative z-20 group">
      <Handle type="target" position={Position.Left} id="left" className={handleLeft} />
      <Handle type="source" position={Position.Right} id="right" className={handleRight} />

      <div style={{ width: `${panoStyle.width}px` }} className={`${nodeBaseClass} ${selected ? selectedBorderClass : ''} flex flex-col p-3`}>
        {/* ★ 节点头部 — 黑色液态玻璃风格 */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06]">
          <Globe size={14} className="text-zinc-400" />
          <span className="text-[11px] font-bold text-white tracking-widest uppercase">全景图</span>
          {status === 'generating' && <Loader2 size={12} className="text-zinc-400 animate-spin ml-auto" />}
          {status === 'done' && <CheckCircle size={12} className="text-zinc-400 ml-auto" />}
          {status === 'failed' && <X size={12} className="text-zinc-400 ml-auto" />}
        </div>

        {/* 预览区域 */}
        <div style={{ aspectRatio: panoStyle.aspectRatio }} className="w-full bg-[#020204] rounded-[12px] overflow-hidden mb-3 relative border border-white/[0.04]">
          {displayImage && status === 'done' ? (
            <div className="w-full h-full relative cursor-pointer group/img" onClick={() => setShowFullscreen(true)}>
              <img src={displayImage} alt="全景图" className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 bg-[#0a0a0c]/80 backdrop-blur-md border border-white/[0.08] text-white text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                <Maximize size={10} /> {is720 ? '720°' : '360°'}
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/img:bg-black/30 transition-all">
                <span className="opacity-0 group-hover/img:opacity-100 text-white text-xs font-medium bg-[#0a0a0c]/80 backdrop-blur-md border border-white/[0.08] px-4 py-1.5 rounded-full transition-all">
                  {is720 ? '点击查看 720° 球体全景' : '点击查看 360° 全景'}
                </span>
              </div>
            </div>
          ) : status === 'generating' ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-white/[0.02] to-white/[0.04]">
              <Loader2 size={24} className="text-zinc-400 animate-spin" />
              <span className="text-zinc-500 text-[11px]">生成全景图中...</span>
            </div>
          ) : status === 'failed' ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-white/[0.02] to-white/[0.04]">
              <X size={24} className="text-zinc-400" />
              <span className="text-zinc-500 text-[11px]">生成失败，请重试</span>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-white/[0.02] to-white/[0.04]">
              <Globe size={24} className="text-white/10" />
              <span className="text-zinc-600 text-[11px]">输入场景描述后点击生成</span>
            </div>
          )}
        </div>

        {/* ★ 配置区域 — 黑色液态玻璃统一风格 */}
        <div className="flex flex-col gap-2.5">
          {/* ★ 全景模式切换：360°圆柱 / 720°球体 */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 font-medium shrink-0">模式</span>
            <div className="flex items-center gap-0.5 bg-[#0a0a0c]/60 border border-white/[0.06] rounded-[8px] p-0.5 flex-1">
              {(['360', '720'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setPanoramaMode(m);
                    updateNodeData(id, { panoramaMode: m });
                  }}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-[6px] text-[10px] font-medium transition-all ${
                    panoramaMode === m
                      ? 'bg-white/[0.08] text-zinc-200'
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  <Globe size={10} />
                  {m === '360' ? '360° 圆柱' : '720° 球体'}
                </button>
              ))}
            </div>
          </div>

          {/* 场景描述 */}
          <textarea
            data-node-id={id} data-field="prompt" data-field-label="场景描述"
            value={data.prompt || ''}
            onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
            placeholder="描述全景场景..."
            className="w-full bg-[#0a0a0c]/60 backdrop-blur-sm border border-white/[0.06] rounded-[10px] p-2.5 text-[11px] text-zinc-300 placeholder:text-zinc-600 outline-none resize-none h-14 focus:border-white/20 transition-all nodrag nopan"
            onWheelCapture={(e) => e.stopPropagation()}
          />

          {/* 模型 + 比例 + 清晰度 — 三栏均衡 */}
          <div className="flex gap-2 items-center">
            <CustomSelect
              className="flex-[2] min-w-0"
              value={currentModel}
              options={[
                { value: 'gpt-image-2', label: 'GPT-Image-2' },
                { value: 'banana-pro', label: 'Banana Pro' },
                { value: 'seedream5.0', label: 'Seedream 5.0' },
              ]}
              onChange={handleModelChange}
            />
            {/* ★ 720 模式固定 2:1 比例，隐藏比例选择器 */}
            {!is720 && (
              <CustomSelect
                className="flex-[1] min-w-0"
                value={data.ratio || '21:9'}
                options={[
                  { value: '21:9', label: '21:9' },
                  { value: '32:9', label: '32:9' },
                  { value: '16:9', label: '16:9' },
                ]}
                onChange={(v: string) => updateNodeData(id, { ratio: v })}
              />
            )}
            <CustomSelect
              className={is720 ? 'flex-[1] min-w-0' : 'flex-[1] min-w-0'}
              value={data.quality || getImageQualityOptions(currentModel)[0].value}
              options={getImageQualityOptions(currentModel)}
              onChange={(v: string) => updateNodeData(id, { quality: v })}
            />
          </div>

          {/* 生成按钮 — 黑色液态玻璃 */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || status === 'generating'}
            className="w-full py-2.5 rounded-[12px] bg-white/[0.06] backdrop-blur-sm border border-white/[0.1] text-zinc-300 text-[12px] font-bold hover:bg-white/[0.1] hover:border-white/[0.15] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
          >
            {status === 'generating' ? (
              <><Loader2 size={13} className="animate-spin" /> 生成中...</>
            ) : (
              <><Globe size={13} /> 生成全景图</>
            )}
          </button>
        </div>
      </div>

      {/* ★ 全屏查看器 — Portal 到 body 避开 ReactFlow 事件劫持 */}
      {showFullscreen && displayImage && createPortal(
        <PanoramaViewer
          imageUrl={displayImage}
          mode={panoramaMode}
          onCapture={handleCapture}
          onClose={() => setShowFullscreen(false)}
        />,
        document.body
      )}
    </div>
  );
};
export const PanoramaNode = React.memo(_PanoramaNode);

// ═══════════════════════════════════════════════════════
// ★ 分镜组容器节点 — 液态玻璃分组框（纯视觉容器，不用 React Flow parentId）
//    - 组内节点保持独立坐标，不受 parentId 约束
//    - 拖动组时手动移动所有成员节点
//    - 支持取消打组 / 批量下载 / 批量生成
// ═══════════════════════════════════════════════════════
function _GroupNode({ id, data, selected }: NodeProps) {
  const { getNodes, setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || '分镜组');
  const inputRef = useRef<HTMLInputElement>(null);

  const memberIds: string[] = data.memberIds || [];

  // ★ 取消打组：仅删除组容器节点，成员节点不变
  const handleUngroup = useCallback(() => {
    setNodes(nds => nds.filter(n => n.id !== id));
  }, [id, setNodes]);

  // ★ 批量下载组内所有节点的 resultUrl
  const handleBatchDownload = useCallback(() => {
    const allNodes = getNodes();
    let count = 0;
    memberIds.forEach(mid => {
      const n = allNodes.find(nn => nn.id === mid);
      const url = n?.data?.resultUrl || n?.data?.frameUrl || n?.data?.url;
      if (url) { window.open(url, '_blank'); count++; }
    });
    if (count === 0) useAppStore.getState().setToastMsg('组内无可下载的图片');
  }, [memberIds, getNodes]);

  // ★ 批量生成组内 shot 节点
  const handleBatchGenerate = useCallback(() => {
    const allNodes = getNodes();
    const shotIds = memberIds.filter(mid => {
      const n = allNodes.find(nn => nn.id === mid);
      return n?.type === 'shot' && n?.data?.firstFrameAnchor;
    });
    if (shotIds.length === 0) {
      useAppStore.getState().setToastMsg('组内无可生成的分镜节点');
      return;
    }
    window.dispatchEvent(new CustomEvent('canvas-batch-generate', { detail: { nodeIds: shotIds } }));
    useAppStore.getState().setToastMsg(`已提交 ${shotIds.length} 个节点的生成任务`);
  }, [memberIds, getNodes]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <div 
      className="relative w-full h-full rounded-2xl bg-[#0a0a0f]/20 border border-dashed border-white/[0.04]"
      style={{ minWidth: '200px', minHeight: '120px' }}
    >
      {/* Top-left floating label — 可点击编辑 */}
      <div 
        className="absolute -top-3.5 left-4 px-2.5 py-0.5 rounded-lg bg-[#18181b]/90 backdrop-blur-xl border border-white/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.3)] z-10 nodrag"
        onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => { setIsEditing(false); data.label = label; }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setIsEditing(false); data.label = label; } }}
            className="bg-transparent text-[11px] text-zinc-300 outline-none w-20 nowheel"
            autoFocus
          />
        ) : (
          <span className="text-[11px] text-zinc-400 cursor-text select-none">{label}</span>
        )}
      </div>

      {/* Top-right actions — 选中时可见 */}
      {selected && (
        <div className="absolute -top-3.5 right-4 flex items-center gap-1.5 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); handleBatchGenerate(); }}
            className="px-2 py-0.5 rounded-lg bg-[#18181b]/95 backdrop-blur-xl border border-white/[0.08] text-[10px] text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all nodrag"
          >
            批量生成
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleBatchDownload(); }}
            className="px-2 py-0.5 rounded-lg bg-[#18181b]/95 backdrop-blur-xl border border-white/[0.08] text-[10px] text-zinc-400 hover:text-white hover:border-white/20 transition-all nodrag"
          >
            批量下载
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleUngroup(); }}
            className="px-2 py-0.5 rounded-lg bg-[#18181b]/95 backdrop-blur-xl border border-white/[0.08] text-[10px] text-zinc-400 hover:text-red-400 hover:border-red-500/30 transition-all nodrag"
          >
            取消打组
          </button>
        </div>
      )}
    </div>
  );
}
export const GroupNode = React.memo(_GroupNode);
