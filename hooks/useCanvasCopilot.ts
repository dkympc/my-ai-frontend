// hooks/useCanvasCopilot.ts
// ★★★ 创作助手引擎 — 全局 LLM 操控画布的核心调度器 ★★★
// 设计原则：
//   1. LLM 不需要输出 JSON，只需自然语言回复 + 末尾确认标记
//   2. 前端做本地意图解析 → 确认弹窗 → 直接执行
//   3. 支持多对话管理（切换/新建/删除），避免上下文过长

import { useState, useCallback, useRef } from 'react';

// ==========================================
// 类型定义
// ==========================================

export interface CopilotMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface CopilotConversation {
  id: string;
  title: string;
  messages: CopilotMessage[];
  createdAt: number;
}

/** 本地解析出的行动计划（不经过 LLM JSON） */
export interface ParsedAction {
  type: 'batchUpdateByType' | 'batchUpdateByFilter' | 'updateField' | 'batchAppendSuffix';
  nodeType?: string;
  nodeId?: string;
  field: string;
  value?: string;
  suffix?: string;
  filter?: { field: string; operator: 'equals' | 'notEquals' | 'contains'; value: string };
  description: string; // 人类可读的描述
}

interface UseCanvasCopilotOptions {
  getNodes: () => any[];
  getEdges: () => any[];
  setNodes: (updater: any) => void;
  setEdges: (updater: any) => void;
  onBeforeAction: () => void;
  onAfterAction: () => void;
}

// ==========================================
// ★ 本地意图解析器 — 从用户输入中提取操作意图
// 不做 LLM 调用，纯正则匹配，保证速度
// ==========================================

/** 匹配：把所有/所有 [类型] 的 [字段] 改成/改为 [值] */
function parseBatchUpdateType(input: string): ParsedAction | null {
  // 1. "把所有分镜的比例改成 16:9"
  const batchTypeRegex = /(?:把|将)?\s*(?:所有|全部)\s*(分镜|shot|图像|media|视频|render|资产表|assetTable|text|文本)?\s*(?:节点|卡片)?\s*(?:的|地)?\s*(\S+?)\s*(?:改|改成|改为|设置|设定为)\s*[：:]?\s*(.+)/i;
  const match = input.match(batchTypeRegex);
  if (!match) return null;

  let nodeType = 'shot'; // 默认分镜
  const typeHint = match[1] || '';
  if (/分镜|shot/i.test(typeHint)) nodeType = 'shot';
  else if (/图像|media|图片/i.test(typeHint)) nodeType = 'media';
  else if (/视频|render|video/i.test(typeHint)) nodeType = 'render';
  else if (/资产表|asset/i.test(typeHint)) nodeType = 'assetTable';
  else if (/text|文本/i.test(typeHint)) nodeType = 'text';

  const field = normalizeFieldName(match[2]);
  const value = match[3].trim();

  return {
    type: 'batchUpdateByType',
    nodeType,
    field,
    value,
    description: `所有 ${nodeType} 节点的「${field}」→ ${value}`,
  };
}

/** 匹配：在 [字段] 后面/末尾加上/追加 [内容] */
function parseBatchAppend(input: string): ParsedAction | null {
  const appendRegex = /(?:在|给)\s*(?:所有|全部)?\s*(分镜|shot|图像|media|视频|render|节点)?\s*(?:的)?\s*(\S+?)\s*(?:后|末尾|结尾|后面)\s*(?:加|加上|追加|添加)\s*[：:]?\s*(.+)/i;
  const match = input.match(appendRegex);
  if (!match) return null;

  const nodeType = match[1] ? normalizeNodeType(match[1]) : 'shot';
  const field = normalizeFieldName(match[2]);
  const suffix = match[3].trim().replace(/^["""']|["""']$/g, '');

  return {
    type: 'batchAppendSuffix',
    nodeType,
    field,
    suffix,
    description: `所有 ${nodeType} 的「${field}」末尾追加 "${suffix}"`,
  };
}

/** 匹配：把不是 [值] 的改成 [值] */
function parseBatchUpdateFilter(input: string): ParsedAction | null {
  const filterRegex = /(?:把|将)?\s*(?:所有|全部)?\s*(?:不是|非)\s*(\S+?)\s*(?:的|地)?\s*(分镜|shot|图像|media|视频|render|节点)?\s*(?:都)?\s*改(?:成|为)\s*[：:]?\s*(.+)/i;
  const match = input.match(filterRegex);
  if (!match) return null;

  const excludeValue = match[1].trim();
  const nodeType = match[2] ? normalizeNodeType(match[2]) : 'shot';
  const newValue = match[3].trim();

  return {
    type: 'batchUpdateByFilter',
    nodeType,
    field: 'ratio',
    value: newValue,
    filter: { field: 'ratio', operator: 'notEquals', value: excludeValue },
    description: `比例不是 ${excludeValue} 的 ${nodeType} → ${newValue}`,
  };
}

/** 字段名标准化 */
function normalizeFieldName(raw: string): string {
  const clean = raw.trim().toLowerCase();
  if (/比例|ratio|宽高|横竖/i.test(clean)) return 'ratio';
  if (/提示词|prompt|描述|咒语|首帧|锚定/i.test(clean)) return 'firstFrameAnchor';
  if (/动作|视频|video|时序|运镜/i.test(clean)) return 'videoPrompt';
  if (/光影|灯光|light|布光/i.test(clean)) return 'sceneLighting';
  if (/相机|camera|机位|镜头/i.test(clean)) return 'globalCamera';
  if (/画质|quality|精度|分辨率/i.test(clean)) return 'quality';
  if (/画风|style|风格/i.test(clean)) return 'styleOverride';
  if (/时长|duration|秒/i.test(clean)) return 'duration';
  if (/模型|model|引擎/i.test(clean)) return 'model';
  if (/脚本|剧本|script|内容/i.test(clean)) return 'script';
  if (/文本|文字|text/i.test(clean)) return 'text';
  return clean; // 保持原样
}

function normalizeNodeType(raw: string): string {
  const clean = raw.trim().toLowerCase();
  if (/分镜|shot/i.test(clean)) return 'shot';
  if (/图像|media|图片/i.test(clean)) return 'media';
  if (/视频|render|video/i.test(clean)) return 'render';
  if (/资产|asset/i.test(clean)) return 'assetTable';
  if (/text|文本/i.test(clean)) return 'text';
  if (/主控|master|剧本/i.test(clean)) return 'masterScript';
  return 'shot';
}

/** ★ 解析所有用户输入，返回第一个匹配的 action */
export function parseUserIntent(input: string): ParsedAction | null {
  const parsers = [parseBatchUpdateType, parseBatchAppend, parseBatchUpdateFilter];
  for (const parser of parsers) {
    const result = parser(input);
    if (result) return result;
  }
  return null;
}

// ==========================================
// ★ 主 Hook
// ==========================================
export function useCanvasCopilot({
  getNodes,
  getEdges,
  setNodes,
  setEdges,
  onBeforeAction,
  onAfterAction
}: UseCanvasCopilotOptions) {

  // ★ 多对话管理
  const [conversations, setConversations] = useState<CopilotConversation[]>(() => [
    { id: 'conv_1', title: '新对话', messages: [], createdAt: Date.now() }
  ]);
  const [activeConvId, setActiveConvId] = useState('conv_1');
  const [isProcessing, setIsProcessing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 当前活跃对话的快捷属性
  const activeConv = conversations.find(c => c.id === activeConvId) || conversations[0];
  const messages = activeConv?.messages || [];

  // ★ 对话管理
  const createConversation = useCallback(() => {
    const newConv: CopilotConversation = {
      id: `conv_${Date.now()}`,
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConvId(newConv.id);
  }, []);

  const deleteConversation = useCallback((convId: string) => {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== convId);
      if (convId === activeConvId && filtered.length > 0) {
        setActiveConvId(filtered[0].id);
      }
      return filtered.length > 0 ? filtered : [{ id: 'conv_1', title: '新对话', messages: [], createdAt: Date.now() }];
    });
  }, [activeConvId]);

  const switchConversation = useCallback((convId: string) => {
    setActiveConvId(convId);
  }, []);

  const updateConversationTitle = useCallback((convId: string, title: string) => {
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, title } : c));
  }, []);

  // ★ 构建画布快照（给 LLM 看的上下文）
  const buildCanvasSnapshot = useCallback(() => {
    const nodes = getNodes();
    const snapshot = nodes.map((n: any) => {
      const extract = (data: any, keys: string[]) => {
        const r: Record<string, any> = {};
        for (const k of keys) {
          if (data[k]) r[k] = typeof data[k] === 'string' && data[k].length > 200
            ? data[k].slice(0, 200) + '...' : data[k];
        }
        return r;
      };
      const base: any = { id: n.id, type: n.type };
      switch (n.type) {
        case 'masterScript': base.fields = extract(n.data, ['script', 'globalRatio', 'globalPromptSuffix']); break;
        case 'shot': base.fields = extract(n.data, ['shotNumber', 'firstFrameAnchor', 'videoPrompt', 'duration', 'ratio', 'sceneLighting', 'globalCamera', 'quality', 'model', 'styleOverride']); break;
        case 'media': base.fields = extract(n.data, ['prompt', 'ratio', 'model', 'quality', 'styleOverride']); break;
        case 'render': base.fields = extract(n.data, ['prompt', 'ratio', 'model', 'quality']); break;
        case 'videoClip': base.fields = extract(n.data, ['prompt', 'ratio', 'sceneLighting', 'globalCamera']); break;
        case 'text': base.fields = extract(n.data, ['text']); break;
        case 'assetTable': base.fields = extract(n.data, ['assetType', 'ratio', 'model', 'quality']); break;
        default: base.fields = extract(n.data, ['prompt', 'text', 'ratio']); break;
      }
      return base;
    });
    return { nodes: snapshot, edges: getEdges().map((e: any) => ({ source: e.source, target: e.target })) };
  }, [getNodes, getEdges]);

  // ★ 构建 System Prompt（简单直接，不要求 JSON）
  const buildSystemPrompt = useCallback((snapshot: any) => {
    const nodeLines = snapshot.nodes.map((n: any) => {
      const fields = Object.entries(n.fields).map(([k, v]) => `    ${k}: ${JSON.stringify(v)}`).join('\n');
      return `  ● ${n.id} (${n.type})\n${fields}`;
    }).join('\n\n');

    return `你是「视觉交响空间」的创作助手，嵌入在影视级分镜画布中。

═══════════════════════════════════════
当前画布状态
═══════════════════════════════════════
${snapshot.nodes.length} 个节点，${getEdges().length} 条连线。

${nodeLines}

═══════════════════════════════════════
工作方式
═══════════════════════════════════════
- 用自然中文回复用户
- 如果用户的请求涉及修改画布，请在你的回复末尾单独一行写：【确认修改】
- 在【确认修改】之前，简明总结你将要做什么
- 不需要输出 JSON，不需要代码块，不需要长篇大论
- 像朋友聊天一样简短回复`;
  }, [getEdges]);

  // ★ 发送消息 — SSE 流式
  const sendMessage = useCallback(async (userInput: string): Promise<{ message: string; intentConfirmed: boolean }> => {
    if (isProcessing) return { message: '', intentConfirmed: false };

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const userMsg: CopilotMessage = { role: 'user', content: userInput, timestamp: Date.now() };
    updateActiveMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      // ★ 先做本地意图解析（极速路径）
      const localIntent = parseUserIntent(userInput);

      const snapshot = buildCanvasSnapshot();
      const systemPrompt = buildSystemPrompt(snapshot);

      const allMsgs = [...messages, userMsg].filter(m => !m.isStreaming).map(m => ({
        role: m.role as 'user' | 'assistant', content: m.content,
      }));

      const token = localStorage.getItem('yr-ai-token');
      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ model: 'gpt-5.4', messages: [{ role: 'system', content: systemPrompt }, ...allMsgs], stream: true }),
        signal: abortController.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let fullText = '';

      updateActiveMessages(prev => [...prev, {
        role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true,
      }]);

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
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              fullText += content;
              updateActiveMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: fullText, isStreaming: true };
                }
                return updated;
              });
            }
          } catch {}
        }
      }

      // 检测是否包含【确认修改】
      const intentConfirmed = fullText.includes('【确认修改】');
      const cleanText = fullText.replace(/【确认修改】/g, '').trim();

      // 更新最终消息
      updateActiveMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant') {
          updated[updated.length - 1] = { ...last, content: cleanText, isStreaming: false };
        }
        return updated;
      });

      // 自动更新对话标题
      const firstUserMsg = messages.length === 0 ? userInput : '';
      if (firstUserMsg && firstUserMsg.length > 0) {
        updateConversationTitle(activeConvId, firstUserMsg.slice(0, 20) + (firstUserMsg.length > 20 ? '...' : ''));
      }

      setIsProcessing(false);
      return { message: cleanText, intentConfirmed: intentConfirmed || localIntent !== null };

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('[创作助手 Error] 请求失败:', error);
        updateActiveMessages(prev => [...prev, {
          role: 'assistant', content: `⚠️ 请求失败：${error.message || '未知错误'}，请重试。`, timestamp: Date.now(),
        }]);
      }
      setIsProcessing(false);
      abortControllerRef.current = null;
      return { message: '', intentConfirmed: false };
    }
  }, [isProcessing, messages, activeConvId, buildCanvasSnapshot, buildSystemPrompt]);

  // ★ 本地意图执行（不经过 LLM）
  const executeLocalIntent = useCallback((action: ParsedAction): number => {
    onBeforeAction();
    let count = 0;
    const currentNodes = getNodes();
    let updated = [...currentNodes];

    try {
      if (action.type === 'batchUpdateByType') {
        updated = updated.map(n => {
          if (n.type !== action.nodeType) return n;
          count++;
          return { ...n, data: { ...n.data, [action.field]: action.value } };
        });
      } else if (action.type === 'batchUpdateByFilter' && action.filter) {
        const { field: ff, operator, value: fv } = action.filter;
        updated = updated.map(n => {
          const cv = String(n.data?.[ff] || '');
          const match = operator === 'notEquals' ? cv !== fv : operator === 'equals' ? cv === fv : cv.includes(fv);
          if (!match) return n;
          count++;
          return { ...n, data: { ...n.data, [action.field]: action.value } };
        });
      } else if (action.type === 'batchAppendSuffix') {
        updated = updated.map(n => {
          if (n.type !== action.nodeType) return n;
          const currentVal = n.data?.[action.field] || '';
          count++;
          return { ...n, data: { ...n.data, [action.field]: currentVal + (action.suffix || '') } };
        });
      } else if (action.type === 'updateField' && action.nodeId) {
        updated = updated.map(n => {
          if (n.id !== action.nodeId) return n;
          count++;
          return { ...n, data: { ...n.data, [action.field]: action.value } };
        });
      }

      setNodes(updated);
      onAfterAction();
      return count;
    } catch (error) {
      console.error('[创作助手 Error] 执行失败:', error);
      return count;
    }
  }, [getNodes, setNodes, onBeforeAction, onAfterAction]);

  // ★ 辅助：更新活跃对话的消息
  const updateActiveMessages = useCallback((updater: (prev: CopilotMessage[]) => CopilotMessage[]) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== activeConvId) return c;
      const newMessages = typeof updater === 'function' ? updater(c.messages) : updater;
      return { ...c, messages: newMessages };
    }));
  }, [activeConvId]);

  const abortRequest = useCallback(() => {
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; }
    setIsProcessing(false);
  }, []);

  return {
    conversations,
    activeConvId,
    messages,
    isProcessing,
    sendMessage,
    executeLocalIntent,
    createConversation,
    deleteConversation,
    switchConversation,
    abortRequest,
    parseUserIntent,
  };
}
