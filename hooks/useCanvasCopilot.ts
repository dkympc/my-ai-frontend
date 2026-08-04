// hooks/useCanvasCopilot.ts
// ★★★ 创作助手引擎 — 全局 LLM 操控画布的核心调度器 ★★★
// 设计原则：
//   1. LLM 通过【确认修改】+ 自然语言 或 !command 指令格式描述操作
//   2. 前端做本地意图解析 → 确认弹窗 → 直接执行
//   3. 支持多对话管理（切换/新建/删除），避免上下文过长
//   4. LLM 拥有全部画布操作权限：增删改查节点、连线

import { useState, useCallback, useRef } from 'react';
import { CANVAS_MANUAL } from '@/lib/canvas-manual';
import { fetchApi } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

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

/** 本地解析出的行动计划 */
export interface ParsedAction {
  type: 'batchUpdateByType' | 'batchUpdateByFilter' | 'updateField' | 'batchAppendSuffix'
       | 'deleteNode' | 'addNode' | 'addEdge' | 'deleteEdge' | 'moveNode'
       | 'batchDeleteByType' | 'fission' | 'camera' | 'assetTable' | 'table';
  nodeType?: string;
  nodeId?: string;
  field: string;
  value?: string;
  suffix?: string;
  filter?: { field: string; operator: 'equals' | 'notEquals' | 'contains'; value: string };
  description: string; // 人类可读的描述
  // ★ 新增：节点/连线 CRUD 操作字段
  targetId?: string;         // deleteNode / moveNode 目标节点 ID
  edgeId?: string;           // deleteEdge 目标连线 ID
  position?: { x: number; y: number };  // addNode / moveNode 坐标
  sourceId?: string;         // addEdge 源节点 ID
  commands?: ParsedAction[]; // ★ 子命令数组：支持一次确认执行多条操作（如删除多个节点）
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
// ★ 本地意图解析器
// ==========================================

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
  return clean;
}

function normalizeNodeType(raw: string): string {
  const clean = raw.trim().toLowerCase();
  if (/分镜|shot/i.test(clean)) return 'shot';
  if (/图像|media|图片/i.test(clean)) return 'media';
  if (/视频|render|render/i.test(clean)) return 'render';
  if (/资产|asset/i.test(clean)) return 'assetTable';
  if (/text|文本/i.test(clean)) return 'text';
  if (/主控|master|剧本/i.test(clean)) return 'masterScript';
  if (/videoclip|视频片段/i.test(clean)) return 'videoClip';
  if (/combine|合成/i.test(clean)) return 'combine';
  if (/scripttable|剧本表格/i.test(clean)) return 'scriptTable';
  return 'shot';
}

// ==========================================
// 现有解析器：字段批量操作
// ==========================================

/** 匹配：把所有 [类型] 的 [字段] 改成 [值] */
function parseBatchUpdateType(input: string): ParsedAction | null {
  const batchTypeRegex = /(?:把|将)?\s*(?:所有|全部|某些|部分|一些)?\s*(分镜|shot|图像|media|视频|render|资产表|assetTable|text|文本)?\s*(?:节点|卡片)?\s*(?:的|地)?\s*(\S+?)(?:了)?\s*(?:改成|改为|更改|设置为|设定为|覆盖为|修改为|更改为|设为|换成|统一为|修改|覆盖|改|设置)\s*[：:]?\s*(.+)/i;
  const match = input.match(batchTypeRegex);
  if (!match) return null;

  let nodeType = 'shot';
  const typeHint = match[1] || '';
  if (/分镜|shot/i.test(typeHint)) nodeType = 'shot';
  else if (/图像|media|图片/i.test(typeHint)) nodeType = 'media';
  else if (/视频|render|video/i.test(typeHint)) nodeType = 'render';
  else if (/资产表|asset/i.test(typeHint)) nodeType = 'assetTable';
  else if (/text|文本/i.test(typeHint)) nodeType = 'text';

  const field = normalizeFieldName(match[2]);
  const value = match[3].trim();

  return {
    type: 'batchUpdateByType', nodeType, field, value,
    description: `所有 ${nodeType} 节点的「${field}」→ ${value}`,
  };
}

/** 匹配：在 [字段] 末尾加上 [内容] */
function parseBatchAppend(input: string): ParsedAction | null {
  const appendRegex = /(?:在|给)\s*(?:所有|全部|某些|部分)?\s*(分镜|shot|图像|media|视频|render|节点)?\s*(?:的)?\s*(\S+?)\s*(?:后|末尾|结尾|后面)\s*(?:加|加上|追加|添加|补充|拼接)\s*[：:]?\s*(.+)/i;
  const match = input.match(appendRegex);
  if (!match) return null;
  const nodeType = match[1] ? normalizeNodeType(match[1]) : 'shot';
  const field = normalizeFieldName(match[2]);
  const suffix = match[3].trim().replace(/^["""']|["""']$/g, '');
  return {
    type: 'batchAppendSuffix', nodeType, field, suffix,
    description: `所有 ${nodeType} 的「${field}」末尾追加 "${suffix}"`,
  };
}

/** 匹配：把不是 [值] 的改成 [值] */
function parseBatchUpdateFilter(input: string): ParsedAction | null {
  const filterRegex = /(?:把|将)?\s*(?:所有|全部)?\s*(?:不是|非)\s*(\S+?)\s*(?:的|地)?\s*(分镜|shot|图像|media|视频|render|节点)?\s*(?:都)?\s*(?:改(?:成|为)|修改为|覆盖|换成|统一为)\s*[：:]?\s*(.+)/i;
  const match = input.match(filterRegex);
  if (!match) return null;
  const excludeValue = match[1].trim();
  const nodeType = match[2] ? normalizeNodeType(match[2]) : 'shot';
  const newValue = match[3].trim();
  return {
    type: 'batchUpdateByFilter', nodeType, field: 'ratio', value: newValue,
    filter: { field: 'ratio', operator: 'notEquals', value: excludeValue },
    description: `比例不是 ${excludeValue} 的 ${nodeType} → ${newValue}`,
  };
}

// ==========================================
// ★ 新增解析器：!command 指令格式
// LLM 在【确认修改】后输出 !command 指令
// ==========================================

/** 解析单条 !command 指令 → ParsedAction */
function parseOneCommand(line: string): ParsedAction | null {
  // !set <nodeType> <field> <value> — 批量修改字段值（可多次使用覆盖多种类型）
  let match = line.match(/^!set\s+(\S+)\s+(\S+)\s+(.+)$/i);
  if (match) {
    const nodeType = normalizeNodeType(match[1]);
    const field = normalizeFieldName(match[2]);
    const value = match[3].trim();
    return {
      type: 'batchUpdateByType', nodeType, field, value,
      description: `所有 ${nodeType} 节点的「${field}」→ ${value}`,
    };
  }

  // !delete <nodeId>
  match = line.match(/^!delete\s+(\S+)$/i);
  if (match) {
    return {
      type: 'deleteNode', field: '', targetId: match[1],
      description: `删除节点 ${match[1]}`,
    };
  }

  // !delete_all <nodeType> — 批量删除某类型全部节点
  match = line.match(/^!delete_all\s+(\S+)$/i);
  if (match) {
    const nt = normalizeNodeType(match[1]);
    return {
      type: 'batchDeleteByType', field: '', nodeType: nt,
      description: `删除全部 ${nt} 节点`,
    };
  }

  // !delete_edge <edgeId>
  match = line.match(/^!delete_edge\s+(\S+)$/i);
  if (match) {
    return {
      type: 'deleteEdge', field: '', edgeId: match[1],
      description: `删除连线 ${match[1]}`,
    };
  }

  // !add <type> <x> <y>
  match = line.match(/^!add\s+(\S+)\s+(\d+)\s+(\d+)$/i);
  if (match) {
    const nodeType = normalizeNodeType(match[1]);
    const x = parseInt(match[2]);
    const y = parseInt(match[3]);
    return {
      type: 'addNode', field: '', nodeType, position: { x, y },
      description: `新建 ${nodeType} 节点 (${x}, ${y})`,
    };
  }

  // !connect <sourceId> <targetId>
  match = line.match(/^!connect\s+(\S+)\s+(\S+)$/i);
  if (match) {
    return {
      type: 'addEdge', field: '', sourceId: match[1], targetId: match[2],
      description: `连接 ${match[1]} → ${match[2]}`,
    };
  }

  // !move <nodeId> <x> <y>
  match = line.match(/^!move\s+(\S+)\s+(\d+)\s+(\d+)$/i);
  if (match) {
    return {
      type: 'moveNode', field: '', targetId: match[1],
      position: { x: parseInt(match[2]), y: parseInt(match[3]) },
      description: `移动节点 ${match[1]} 到 (${match[2]}, ${match[3]})`,
    };
  }

  // !fission <masterScriptNodeId> — 对指定主控节点执行裂变分镜
  match = line.match(/^!fission\s+(\S+)$/i);
  if (match) {
    return { type: 'fission', field: '', targetId: match[1], description: `对 ${match[1]} 执行分镜裂变` };
  }

  // !camera <masterScriptNodeId> — 对指定主控节点提取摄影机参数
  match = line.match(/^!camera\s+(\S+)$/i);
  if (match) {
    return { type: 'camera', field: '', targetId: match[1], description: `对 ${match[1]} 提取摄影机参数` };
  }

  // !asset <masterScriptNodeId> <type> — 提取资产表 (type: scene/character/prop，不写则全提)
  match = line.match(/^!asset\s+(\S+)(?:\s+(\S+))?$/i);
  if (match) {
    const assetType = match[2] || 'all';
    return { type: 'assetTable', field: assetType, targetId: match[1], description: `对 ${match[1]} 提取资产表(${assetType})` };
  }

  // !table <masterScriptNodeId> — 对指定主控节点生成分镜场记表
  match = line.match(/^!table\s+(\S+)$/i);
  if (match) {
    return { type: 'table', field: '', targetId: match[1], description: `对 ${match[1]} 生成分镜表格` };
  }

  return null;
}

/** 收集所有 !command 指令 → 如果只有1条返回该action，多条则包在 commands 数组里 */
function parseAllCommandDirectives(input: string): ParsedAction | null {
  const lines = input.split('\n').map(l => l.trim()).filter(l => l.startsWith('!'));
  if (lines.length === 0) return null;

  const actions: ParsedAction[] = [];
  for (const line of lines) {
    const cmd = parseOneCommand(line);
    if (cmd) actions.push(cmd);
  }
  if (actions.length === 0) return null;

  // 只有一条 → 直接返回，不包 commands 数组
  if (actions.length === 1) return actions[0];

  // 多条 → 包在 commands 数组里
  return {
    type: 'batchUpdateByType', field: '', nodeType: '', value: '',
    description: actions.map(a => a.description).join('；'),
    commands: actions,
  };
}

/** 旧版单条匹配（保留兼容） */
function parseCommandDirective(input: string): ParsedAction | null {
  return parseAllCommandDirectives(input);
}

// ★ 自然语言删除解析器（用户直接说"删除分镜3"等）
function parseDeleteNatural(input: string): ParsedAction | null {
  // 匹配：删除/移除/去掉 第X个/某个/特定节点的描述 + 可选节点ID
  const deleteRegex = /(?:删|移除|去掉|清除)\s*(?:掉|除)?\s*(?:那个|这个|第\s*(\d+)\s*个)?\s*(分镜|shot|图像|media|视频|render|文字|text|节点)?/i;
  const match = input.match(deleteRegex);
  if (!match) return null;

  const ordinalNum = match[1] ? parseInt(match[1]) : null;
  const typeHint = match[2] ? normalizeNodeType(match[2]) : 'shot';

  // 需要 getNodes() 来查找实际节点，这里只做标记
  return {
    type: 'deleteNode', field: '', targetId: '', nodeType: typeHint,
    description: ordinalNum ? `删除第 ${ordinalNum} 个 ${typeHint} 节点` : `删除指定的 ${typeHint} 节点`,
  };
}

// ★ 自然语言新建解析器
function parseAddNatural(input: string): ParsedAction | null {
  const addRegex = /(?:新建|创建|添加|加)\s*(?:一个|个)?\s*(分镜|shot|图像|media|文字|text|视频|render|资产表|assetTable)?\s*(?:节点|卡片)?/i;
  const match = input.match(addRegex);
  if (!match) return null;
  const nodeType = match[1] ? normalizeNodeType(match[1]) : 'shot';
  return {
    type: 'addNode', field: '', nodeType, position: { x: 200, y: 200 },
    description: `新建一个 ${nodeType} 节点`,
  };
}

// ★ 自然语言连线解析器
function parseConnectNatural(input: string): ParsedAction | null {
  const connectRegex = /(?:连接|连(?:起|上)|连线)\s*(\S+?)\s*(?:和|与|→|->|到)\s*(\S+)/i;
  const match = input.match(connectRegex);
  if (!match) return null;
  return {
    type: 'addEdge', field: '', sourceId: match[1], targetId: match[2],
    description: `连接 ${match[1]} → ${match[2]}`,
  };
}

/** ★ 解析 LLM 回复中的操作指令（仅 !command 格式，不做自然语言解析） */
export function parseUserIntent(input: string): ParsedAction | null {
  // ★ 只匹配 !command 指令。自然语言解析器（parseBatchUpdateType 等）已移除，
  //   因为它们会误匹配用户原始输入产生垃圾操作（如用户说"帮我把主控节点的摄影机改了"
  //   → regex 匹配出 field="帮我把主控节点的摄影机" value="了，改成XXX"）。
  //   所有操作统一走 LLM → !command 路径，精准无歧义。
  return parseCommandDirective(input);
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

  const activeConv = conversations.find(c => c.id === activeConvId) || conversations[0];
  const messages = activeConv?.messages || [];

  // ★ 对话管理
  const createConversation = useCallback(() => {
    const newConv: CopilotConversation = {
      id: `conv_${Date.now()}`, title: '新对话', messages: [], createdAt: Date.now(),
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConvId(newConv.id);
  }, []);

  const deleteConversation = useCallback((convId: string) => {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== convId);
      if (convId === activeConvId && filtered.length > 0) setActiveConvId(filtered[0].id);
      return filtered.length > 0 ? filtered : [{ id: 'conv_1', title: '新对话', messages: [], createdAt: Date.now() }];
    });
  }, [activeConvId]);

  const switchConversation = useCallback((convId: string) => { setActiveConvId(convId); }, []);
  const updateConversationTitle = useCallback((convId: string, title: string) => {
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, title } : c));
  }, []);

  // ★ 构建画布快照（给 LLM 看的上下文 — 包含完整字段 + 资产表行 + 连线ID）
  const buildCanvasSnapshot = useCallback(() => {
    const nodes = getNodes();
    const extract = (data: any, keys: string[]) => {
      const r: Record<string, any> = {};
      for (const k of keys) {
        const v = data[k];
        if (v === undefined || v === null || v === '') continue;
        if (typeof v === 'string' && v.length > 300) {
          r[k] = v.slice(0, 300) + '...(已截断)';
        } else {
          r[k] = v;
        }
      }
      return r;
    };

    const snapshot = nodes.map((n: any) => {
      const base: any = { id: n.id, type: n.type, position: { x: Math.round(n.position?.x || 0), y: Math.round(n.position?.y || 0) } };
      switch (n.type) {
        case 'masterScript':
          base.fields = extract(n.data, ['text', 'script', 'globalRatio', 'globalPromptSuffix', 'globalAssetPromptPrefix', 'globalCamera', 'model']);
          break;
        case 'shot':
          base.fields = extract(n.data, ['shotNumber', 'firstFrameAnchor', 'videoPrompt', 'duration', 'ratio', 'sceneLighting', 'globalCamera', 'quality', 'model', 'styleOverride', 'status']);
          break;
        case 'media':
          base.fields = extract(n.data, ['prompt', 'ratio', 'model', 'quality', 'styleOverride', 'status']);
          break;
        case 'render':
          base.fields = extract(n.data, ['prompt', 'ratio', 'model', 'quality', 'duration', 'status']);
          break;
        case 'videoClip':
          base.fields = extract(n.data, ['prompt', 'ratio', 'sceneLighting', 'globalCamera', 'model', 'status']);
          break;
        case 'text':
          base.fields = extract(n.data, ['text']);
          break;
        case 'combine':
          base.fields = {};
          break;
        case 'scriptTable':
          base.fields = extract(n.data, ['scriptText']);
          if (n.data?.rows) base.fields.rowCount = n.data.rows.length;
          break;
        case 'assetTable':
          base.fields = extract(n.data, ['assetType', 'ratio', 'model', 'quality', 'status']);
          // ★ 资产表的 rows 是最需要 LLM 知道的：每行 name + prompt 摘要
          if (n.data?.rows && Array.isArray(n.data.rows)) {
            base.fields.rowCount = n.data.rows.length;
            // 每行只抽取 name + prompt 前100字符，防止快照过大
            base.fields.rowsSummary = n.data.rows.map((r: any) => {
              const promptPreview = r.prompt ? (typeof r.prompt === 'string' ? r.prompt.slice(0, 100) : String(r.prompt).slice(0, 100)) : '(空)';
              return { id: r.id, name: r.name || '(无名)', prompt: promptPreview + (r.prompt && r.prompt.length > 100 ? '...' : ''), status: r.status || 'draft' };
            });
          }
          break;
        default:
          base.fields = extract(n.data, ['prompt', 'text', 'ratio']);
          break;
      }
      return base;
    });
    // ★ 连线包含 ID + 源/目标，供 !delete_edge / 理解画布结构
    return { nodes: snapshot, edges: getEdges().map((e: any) => ({ id: e.id, source: e.source, target: e.target })) };
  }, [getNodes, getEdges]);

  // ★ 构建 System Prompt（注入画布说明书 + 当前状态）
  const buildSystemPrompt = useCallback((snapshot: any) => {
    const nodeLines = snapshot.nodes.map((n: any) => {
      const fields = Object.entries(n.fields).filter(([_, v]) => v !== undefined).map(([k, v]) => `    ${k}: ${JSON.stringify(v)}`).join('\n');
      return `  ● ${n.id} (${n.type}) @ (${n.position.x},${n.position.y})${fields ? '\n' + fields : ''}`;
    }).join('\n\n');

    const edgeLines = snapshot.edges.map((e: any) => `  ${e.id}: ${e.source} → ${e.target}`).join('\n');

    return `你是「视觉交响空间」的创作助手，嵌入在分镜画布中。你拥有画布的完整操作权限。

${CANVAS_MANUAL}

═══════════════════════════════════════
当前画布状态
═══════════════════════════════════════
${snapshot.nodes.length} 个节点，${snapshot.edges.length} 条连线。

节点：
${nodeLines}

连线：
${edgeLines || '  （无连线）'}

═══════════════════════════════════════
工作方式（★ 必须严格遵守）
═══════════════════════════════════════
- 用自然中文简短回复用户，像朋友聊天一样
- ★★★ 关键规则：如果用户要你修改画布上的任何东西，你必须在回复末尾写：
  【确认修改】
  紧接着一行一行写 !command 指令
- 字段值修改 → !set <类型> <字段> <值>（每个类型一行）
- 节点增删移动/连线 → 对应的 !delete / !add / !connect / !move / !delete_edge / !delete_all
- ★ 高级画布操作 → !fission(裂变分镜) / !camera(锚定摄影机) / !asset(提取资产) / !table(生成表格)
- ★ 示例：
  用户："把主控和分镜的摄影机改成XXX"
  你回复：
  好的，帮你修改。【确认修改】
  !set masterScript globalCamera XXX
  !set shot globalCamera XXX

  用户："删除分镜2和分镜5"
  你回复：
  马上删除。【确认修改】
  !delete shot_xxx2
  !delete shot_xxx5

  用户："给我写个故事放到节点并裂变分镜"
  你回复：
  好的，我先创建主控节点填入故事，然后锁定摄影机和裂变。【确认修改】
  !add masterScript 500 300
  （等节点创建后，在下一轮对话中填入文本并执行裂变）

- ★ 不要只描述操作而不写 !command，那不叫"修改画布"，那叫聊天
- ★ 不要自己执行，必须等我弹窗确认后才执行`;
  }, []);

  // ★ 发送消息 — SSE 流式，5 分钟超时兜底
  const sendMessage = useCallback(async (userInput: string): Promise<{ message: string; intentConfirmed: boolean }> => {
    if (isProcessing) return { message: '', intentConfirmed: false };

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // ★ 5 分钟超时兜底：防止 LLM 响应卡住导致永久转圈
    const timeoutId = setTimeout(() => {
      abortController.abort();
      updateActiveMessages(prev => [...prev, { role: 'assistant', content: '⏱️ 请求超时（5分钟），请重试或简化指令。', timestamp: Date.now() }]);
      setIsProcessing(false);
      abortControllerRef.current = null;
    }, 5 * 60 * 1000);

    const userMsg: CopilotMessage = { role: 'user', content: userInput, timestamp: Date.now() };
    updateActiveMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const snapshot = buildCanvasSnapshot();
      const systemPrompt = buildSystemPrompt(snapshot);

      const allMsgs = [...messages, userMsg].filter(m => !m.isStreaming).map(m => ({
        role: m.role as 'user' | 'assistant', content: m.content,
      }));

      const token = localStorage.getItem('yr-ai-token');
      const copilotModel = useAppStore.getState().canvasSettings?.defaultLLMModel || 'gpt-5.4';
      const response = await fetchApi('/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: copilotModel, messages: [{ role: 'system', content: systemPrompt }, ...allMsgs], stream: true }),
        signal: abortController.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let fullText = '';

      updateActiveMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true }]);

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
                if (last && last.role === 'assistant') updated[updated.length - 1] = { ...last, content: fullText, isStreaming: true };
                return updated;
              });
            }
          } catch {}
        }
      }

      // ★ 检测是否包含【确认修改】— 提取标记后的内容供解析
      const intentConfirmed = fullText.includes('【确认修改】');
      const cleanText = fullText.replace(/【确认修改】/g, '').trim();

      // ★ 过滤 !command 行：用户聊天中只显示自然语言对话，不显示代码指令
      const displayText = cleanText.split('\n').filter(line => !line.trim().match(/^!\w+/)).join('\n').trim() || cleanText;

      updateActiveMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant') updated[updated.length - 1] = { ...last, content: displayText, isStreaming: false };
        return updated;
      });

      // 自动更新对话标题
      if (messages.length === 0 && userInput.length > 0) {
        updateConversationTitle(activeConvId, userInput.slice(0, 20) + (userInput.length > 20 ? '...' : ''));
      }

      setIsProcessing(false);
      clearTimeout(timeoutId);
      return { message: cleanText, intentConfirmed };

    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name !== 'AbortError') {
        console.error('[创作助手 Error] 请求失败:', error);
        updateActiveMessages(prev => [...prev, { role: 'assistant', content: `请求失败：${error.message || '未知错误'}，请重试。`, timestamp: Date.now() }]);
      }
      setIsProcessing(false);
      abortControllerRef.current = null;
      return { message: '', intentConfirmed: false };
    }
  }, [isProcessing, messages, activeConvId, buildCanvasSnapshot, buildSystemPrompt]);

  // ★ 本地意图执行 — 支持字段操作 + 节点/连线 CRUD + 子命令批量执行
  const executeLocalIntent = useCallback((action: ParsedAction): number => {
    onBeforeAction();

    // ★ 如果有 commands 子命令数组，递归执行每一条并汇总
    if (action.commands && action.commands.length > 0) {
      let total = 0;
      for (const sub of action.commands) {
        total += executeLocalIntent(sub);
      }
      onAfterAction();
      return total;
    }

    let count = 0;
    const currentNodes = getNodes();
    let updated = [...currentNodes];

    try {
      // ========== 字段批量操作 ==========
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
          count++;
          return { ...n, data: { ...n.data, [action.field]: (n.data?.[action.field] || '') + (action.suffix || '') } };
        });
      } else if (action.type === 'updateField' && action.nodeId) {
        updated = updated.map(n => {
          if (n.id !== action.nodeId) return n;
          count++;
          return { ...n, data: { ...n.data, [action.field]: action.value } };
        });
      }
      // ========== ★ 新增：节点/连线 CRUD ==========
      else if (action.type === 'deleteNode' && action.targetId) {
        updated = updated.filter(n => n.id !== action.targetId);
        // 同时删除关联的连线
        setEdges((eds: any[]) => eds.filter((e: any) => e.source !== action.targetId && e.target !== action.targetId));
        count = 1;
      } else if (action.type === 'batchDeleteByType' && action.nodeType) {
        // ★ 批量删除某类型全部节点 + 关联连线
        const idsToDelete = updated.filter(n => n.type === action.nodeType).map(n => n.id);
        updated = updated.filter(n => n.type !== action.nodeType);
        setEdges((eds: any[]) => eds.filter((e: any) => !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target)));
        count = idsToDelete.length;
      } else if (action.type === 'deleteEdge' && action.edgeId) {
        setEdges((eds: any[]) => eds.filter((e: any) => e.id !== action.edgeId));
        count = 1;
      } else if (action.type === 'addNode' && action.nodeType) {
        const newNodeId = `${action.nodeType}_${Date.now()}`;
        const newNode: any = {
          id: newNodeId,
          type: action.nodeType,
          position: action.position || { x: 200, y: 200 },
          data: { status: 'draft' },
        };
        // 根据节点类型设置默认字段
        if (action.nodeType === 'shot') newNode.data = { ...newNode.data, firstFrameAnchor: '', videoPrompt: '', ratio: '16:9', sceneLighting: '', shotNumber: '', duration: 5 };
        else if (action.nodeType === 'media') newNode.data = { ...newNode.data, prompt: '', ratio: '16:9' };
        else if (action.nodeType === 'text') newNode.data = { ...newNode.data, text: '' };
        else if (action.nodeType === 'render') newNode.data = { ...newNode.data, prompt: '', ratio: '16:9' };
        else if (action.nodeType === 'videoClip') newNode.data = { ...newNode.data, prompt: '', ratio: '16:9' };
        else if (action.nodeType === 'assetTable') newNode.data = { ...newNode.data, assetType: 'character', ratio: '16:9', rows: [] };
        else if (action.nodeType === 'combine') newNode.data = { ...newNode.data };
        else if (action.nodeType === 'scriptTable') newNode.data = { ...newNode.data, rows: [] };
        else if (action.nodeType === 'masterScript') newNode.data = { ...newNode.data, text: '', globalCamera: '' };
        updated = [...updated, newNode];
        count = 1;
      } else if (action.type === 'addEdge' && action.sourceId && action.targetId) {
        const newEdgeId = `reactflow__edge-${action.sourceId}right-${action.targetId}left`;
        setEdges((eds: any[]) => [...eds, {
          id: newEdgeId,
          source: action.sourceId,
          target: action.targetId,
          sourceHandle: 'right',
          targetHandle: 'left',
          animated: true,
          style: { stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1.5, strokeDasharray: '5,5' },
        }]);
        count = 1;
      } else if (action.type === 'moveNode' && action.targetId && action.position) {
        updated = updated.map(n => {
          if (n.id !== action.targetId) return n;
          count++;
          return { ...n, position: { x: action.position!.x, y: action.position!.y } };
        });
      }
      // ========== ★ 画布操作触发器：设置 _copilotAction 标志，由 CustomNodes.tsx 监听并执行 ==========
      else if (action.type === 'fission' && action.targetId) {
        updated = updated.map(n => {
          if (n.id !== action.targetId || n.type !== 'masterScript') return n;
          count++;
          return { ...n, data: { ...n.data, _copilotAction: { type: 'fission', timestamp: Date.now() } } };
        });
      } else if (action.type === 'camera' && action.targetId) {
        updated = updated.map(n => {
          if (n.id !== action.targetId || n.type !== 'masterScript') return n;
          count++;
          return { ...n, data: { ...n.data, _copilotAction: { type: 'camera', timestamp: Date.now() } } };
        });
      } else if (action.type === 'assetTable' && action.targetId) {
        updated = updated.map(n => {
          if (n.id !== action.targetId || n.type !== 'masterScript') return n;
          count++;
          return { ...n, data: { ...n.data, _copilotAction: { type: 'asset', subType: action.field || 'all', timestamp: Date.now() } } };
        });
      } else if (action.type === 'table' && action.targetId) {
        updated = updated.map(n => {
          if (n.id !== action.targetId || n.type !== 'masterScript') return n;
          count++;
          return { ...n, data: { ...n.data, _copilotAction: { type: 'table', timestamp: Date.now() } } };
        });
      }

      if (action.type !== 'deleteEdge' && action.type !== 'addEdge') {
        setNodes(updated);
      }
      onAfterAction();
      return count;
    } catch (error) {
      console.error('[创作助手 Error] 执行失败:', error);
      return count;
    }
  }, [getNodes, setNodes, setEdges, onBeforeAction, onAfterAction]);

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
    conversations, activeConvId, messages, isProcessing,
    sendMessage, executeLocalIntent,
    createConversation, deleteConversation, switchConversation,
    abortRequest, parseUserIntent,
  };
}
