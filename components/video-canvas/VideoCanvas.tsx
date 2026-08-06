// components/video-canvas/VideoCanvas.tsx
"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom'; // ✨ 新增：用于将总控抽屉传送到 HTML 根节点顶层渲染
import { 
    ReactFlow, 
    Background, 
    Controls,
    MiniMap,
    useNodesState, 
    useEdgesState, 
    ReactFlowProvider,
    BackgroundVariant,
    useReactFlow,
    addEdge,
    useViewport,
    SelectionMode,
    BaseEdge,             // ✨ 新增
    EdgeLabelRenderer,    // ✨ 新增
    getBezierPath,        // ✨ 新增
    type Connection 
  } from '@xyflow/react';
import '@xyflow/react/dist/style.css'; 

// 🚀 唯一引用的 lucide-react，完美避开所有重名报错
import { ArrowLeft, Plus, Type, Image as ImageIconIcon, Film, ZoomIn, ZoomOut, Maximize, Clapperboard, Layers, Check, Settings, X, Loader2, Sliders, ChevronDown, MessageSquare } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { GENRE_PRESETS, TEMPO_PROFILES } from '@/lib/director-rules';
import { MODELS } from '@/lib/constants';
import { ImageRecord, VideoRecord } from '@/lib/types'; 
import { fetchApi } from '@/services/api';
import { showConfirm } from '@/lib/dialogStore';
import { useCanvasCopilot } from '@/hooks/useCanvasCopilot';
import CopilotPanel from './CopilotPanel';
import SelectionAssist from './SelectionAssist'; // ★ 全局文字选中 AI 助手

interface WorkspaceProps {
    imageHistory: ImageRecord[];
    videoHistory: VideoRecord[];
}
  
import { MediaNode, TextNode, RenderNode, CombineNode, MasterScriptNode, ShotNode, VideoClipNode, ScriptTableNode, AssetTableNode } from './CustomNodes';
const nodeTypes = { media: MediaNode, text: TextNode, render: RenderNode, combine: CombineNode, masterScript: MasterScriptNode, shot: ShotNode, videoClip: VideoClipNode, scriptTable: ScriptTableNode, assetTable: AssetTableNode };

// ✨ 自定义可悬停删除的连线组件
function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd }: any) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }} className="nodrag nopan group">
          <button
            className="w-5 h-5 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_15px_rgba(239,68,68,0.5)]"
            onClick={() => setEdges((edges) => edges.filter((e) => e.id !== id))}
            title="断开连线"
          >
            <X size={12} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
const edgeTypes = { default: DeletableEdge };

// 极简右下角缩放器
function ZoomPanel() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <div className="absolute bottom-6 right-6 z-50 flex items-center gap-1 bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[20px] shadow-[0_20px_40px_rgba(0,0,0,0.8)] p-1.5">
      <button onClick={() => zoomOut({ duration: 300 })} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-xl transition-all">
        <ZoomOut size={16} />
      </button>
      <div className="w-16 text-center text-[11px] font-mono font-medium text-zinc-300 tracking-wider select-none cursor-pointer hover:text-white transition-colors" onClick={() => fitView({ duration: 500 })}>
        {Math.round(zoom * 100)}%
      </div>
      <button onClick={() => zoomIn({ duration: 300 })} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-xl transition-all">
        <ZoomIn size={16} />
      </button>
      <div className="w-px h-4 bg-white/10 mx-1" />
      <button onClick={() => fitView({ duration: 500 })} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-xl transition-all">
        <Maximize size={16} />
      </button>
    </div>
  );
}

function CanvasWorkspace({ imageHistory, videoHistory }: WorkspaceProps) {
  const activeCanvasProjectId = useAppStore((s: any) => s.activeCanvasProjectId);
  const setActiveCanvasProjectId = useAppStore((s: any) => s.setActiveCanvasProjectId);
  const canvasProjects = useAppStore((s: any) => s.canvasProjects);
  const updateCanvasProject = useAppStore((s: any) => s.updateCanvasProject);
  const canvasSettings = useAppStore((s: any) => s.canvasSettings);
  const setCanvasSettings = useAppStore((s: any) => s.setCanvasSettings);
  const isFilmControlOpen = useAppStore((s: any) => s.isFilmControlOpen);
  const setIsFilmControlOpen = useAppStore((s: any) => s.setIsFilmControlOpen);
  const copilotIsOpen = useAppStore((s: any) => s.copilotIsOpen);
  const setCopilotIsOpen = useAppStore((s: any) => s.setCopilotIsOpen);
  const selectionAssistEnabled = useAppStore((s: any) => s.selectionAssistEnabled);
  const setSelectionAssistEnabled = useAppStore((s: any) => s.setSelectionAssistEnabled);
  const fissionProgress = useAppStore((s: any) => s.fissionProgress);
  const abortFission = useAppStore((s: any) => s.abortFission);
  const currentProject = (canvasProjects || []).find((p: any) => p.id === activeCanvasProjectId);

  const [nodes, setNodes, onNodesChange] = useNodesState(currentProject?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(currentProject?.edges || []);
  
  // ★ Bug K 修复：仅当数据真正注入成功后才标记已加载，防止 sessionStorage 水合的空数据死锁
  const hasLoadedDataRef = useRef(false);
  useEffect(() => {
    if (currentProject && !hasLoadedDataRef.current) {
      if (currentProject.nodes && currentProject.nodes.length > 0) {
        setNodes(currentProject.nodes);
        setEdges(currentProject.edges || []);
        hasLoadedDataRef.current = true; // ★ 移到 if 内部：只有成功注入 nodes 后才锁死
      }
      // 旧代码将 hasLoadedDataRef.current = true 放在 if 外部，导致空数据也标记"已加载"，后续真实数据永远被忽略
    }
  }, [currentProject, setNodes, setEdges]);

  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // ★ 性能优化：用 ref 持有最新 nodes/edges，避免 customOnNodesChange 因依赖变化而重建
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  // ★ 性能优化：连线视觉指纹缓存——仅当节点选中/生成/脏数据/书签状态变化时重算连线样式，跳过纯拖拽位置更新
  const lastEdgeVisualHashRef = useRef<string>('');
  const getNodesVisualHash = useCallback((ns: any[]) => {
    return ns.map(n => `${n.id}|${n.selected}|${n.data?.isGenerating}|${n.data?.isDirty}|${n.data?.activeTargetIds?.join(',')}`).join('__');
  }, []);
  
  // ✨ 修改 menuPos 支持记录“来源节点”，用来自动连线
  const [menuPos, setMenuPos] = useState<{ x: number, y: number, screenX: number, screenY: number, sourceNodeId?: string } | null>(null);
  
  // ✨ 新增：拦截用户的“拖拽连线”动作
  const [connecting, setConnecting] = useState<{ nodeId: string | null } | null>(null);

  // 👇👇👇 新增下面这一行 👇👇👇
  // ✨ 新增：画布“时光机”快照，专门用于抢救误删的节点与连线
  const [deleteHistory, setDeleteHistory] = useState<{nodes: any[], edges: any[]}[]>([]);
  // ★ 通用撤销快照堆栈（覆盖文本编辑、节点移动等非删除变更），节流采集防内存溢出
  const [undoHistory, setUndoHistory] = useState<{nodes: any[], edges: any[]}[]>([]);
  const undoThrottleRef = useRef<NodeJS.Timeout | null>(null);
  // ★ 时空回收站已移除：用户使用 Ctrl+Z 撤销即可

  // ★★★ AI 画布副驾驶引擎 ★★★
  const copilot = useCanvasCopilot({
    getNodes,
    getEdges,
    setNodes,
    setEdges,
    // 执行前拍快照：推入 undoHistory，确保用户可 Ctrl+Z 回退
    onBeforeAction: () => {
      const snapNodes = getNodes();
      const snapEdges = getEdges();
      setUndoHistory(prev => [...prev.slice(-49), { nodes: JSON.parse(JSON.stringify(snapNodes)), edges: JSON.parse(JSON.stringify(snapEdges)) }]);
    },
    // 执行后触发同步：标记脏数据，自动保存到云端
    onAfterAction: () => {
      if (activeCanvasProjectId && typeof updateCanvasProject === 'function') {
        updateCanvasProject(activeCanvasProjectId, { nodes: getNodes(), edges: getEdges() });
      }
    },
  });

  // ✨ 全局状态锁
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [isCanvasSettingsOpen, setIsCanvasSettingsOpen] = useState(false);

  // ✨ 新增：水波纹涟漪状态管理
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);

  // ✨ 新增：全局点击水波纹触发器
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    setMenuPos(null);
    if ((e.target as HTMLElement).closest('.react-flow__node')) return;
    
    // 🚀 核心修复：精准计算相对坐标，消除偏移！
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const newRipple = { x, y, id: Date.now() };
      setRipples(prev => [...prev, newRipple]);
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== newRipple.id));
      }, 800);
    }
  }, []);

  // ✨ 修复痛点：在捕获阶段（最高优先级）拦截 Ctrl + 滚轮，彻底防止浏览器原生的页面缩放
  useEffect(() => {
    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    // capture: true 是核心魔法，保证在任何节点吃掉事件之前，我们先拦截默认缩放行为！
    window.addEventListener('wheel', preventBrowserZoom, { passive: false, capture: true });
    return () => window.removeEventListener('wheel', preventBrowserZoom, { capture: true });
  }, []);

  // ✨ 自定义节点变更拦截器 (核心节点误删保护 + 删除历史快照供 Ctrl+Z 撤销)
  const customOnNodesChange = useCallback((changes: any[]) => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const removeChanges = changes.filter(c => c.type === 'remove');
    if (removeChanges.length > 0) {
      const hasCriticalNode = removeChanges.some(change => {
        const nodeToDelete = currentNodes.find(n => n.id === change.id);
        return nodeToDelete && (nodeToDelete.type === 'masterScript' || nodeToDelete.type === 'assetTable');
      });
      
      if (hasCriticalNode) {
        showConfirm("⚠️ 主中控/资产表为分镜核心", "您确定要删除吗?", "danger").then((confirmed) => {
          if (!confirmed) return;
          // 删除前拍快照，供 Ctrl+Z 撤销
          setDeleteHistory(prev => [...prev.slice(-4), { nodes: JSON.parse(JSON.stringify(currentNodes)), edges: JSON.parse(JSON.stringify(currentEdges)) }]);
          onNodesChange(changes);
        });
        return;
      }
      
      // 普通节点删除：拍快照供 Ctrl+Z 撤销
      setDeleteHistory(prev => [...prev.slice(-4), { nodes: JSON.parse(JSON.stringify(currentNodes)), edges: JSON.parse(JSON.stringify(currentEdges)) }]);
    }
    
    onNodesChange(changes);
  }, [onNodesChange]);

  // ✨ 实时监测变动并触发自动保存 (加入防抖与初次挂载拦截)
  const isFirstRender = useRef(true);
  useEffect(() => {
    // 核心修复 2：防止组件刚挂载时，把空数组 [] 错误地覆写回云端
    if (isFirstRender.current) {
       isFirstRender.current = false;
       return;
    }

    if (activeCanvasProjectId && typeof updateCanvasProject === 'function') {
      setSaveStatus('saving');
      
      const timer = setTimeout(() => {
        updateCanvasProject(activeCanvasProjectId, { nodes, edges });
        setSaveStatus('saved');
      }, 1500); 
      
      return () => clearTimeout(timer); 
    }
  }, [nodes, edges, activeCanvasProjectId]);

    // ✨ 新增：节点剪贴板状态
    const [clipboard, setClipboard] = useState<{nodes: any[], edges: any[]} | null>(null);
  
    // ✨ 新增：监听全局 Ctrl+C / Ctrl+V 以及 Ctrl+Z (误删撤销)
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // 保护机制：如果焦点在输入框里，不要触发画布的快捷键，保留浏览器打字默认逻辑
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
  
        // Ctrl + C 复制
        if (isCmdOrCtrl && e.key.toLowerCase() === 'c') {
           const selectedNodes = getNodes().filter(n => n.selected);
           if (selectedNodes.length === 0) return;
           
           const selectedNodeIds = selectedNodes.map(n => n.id);
           // 仅复制“两端都在选中节点内部”的连线
           const selectedEdges = getEdges().filter(edge => selectedNodeIds.includes(edge.source) && selectedNodeIds.includes(edge.target));
           
           setClipboard({ nodes: selectedNodes, edges: selectedEdges });
           useAppStore.getState().setToastMsg(`已复制 ${selectedNodes.length} 个剧本节点`);
        }
  
        // Ctrl + V 粘贴
        if (isCmdOrCtrl && e.key.toLowerCase() === 'v') {
           if (!clipboard || clipboard.nodes.length === 0) return;
           
           const idMap = new Map();
           // 深度拷贝节点数据，并偏移 50px 防止重叠
           const newNodes = clipboard.nodes.map((node: any) => {
              const newId = `${node.type}_copy_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              idMap.set(node.id, newId);
              return {
                 ...node,
                 id: newId,
                 selected: true, // 粘贴出来的新节点自动处于选中状态
                 position: { x: node.position.x + 50, y: node.position.y + 50 },
                 data: JSON.parse(JSON.stringify(node.data)) // 深拷贝 data，切断引用，携带全部参数！
              };
           });
  
           const newEdges = clipboard.edges.map((edge: any) => ({
              ...edge,
              id: `e-${idMap.get(edge.source)}-${idMap.get(edge.target)}`,
              source: idMap.get(edge.source),
              target: idMap.get(edge.target),
              selected: true
           }));
  
           // 取消当前选中，添加新节点
           setNodes(nds => nds.map(n => ({...n, selected: false})).concat(newNodes));
           setEdges(eds => eds.map(e => ({...e, selected: false})).concat(newEdges));
           useAppStore.getState().setToastMsg(`成功粘贴并克隆 ${newNodes.length} 个节点及内部逻辑`);
        }

        // =====================================
        // 👇👇👇 Ctrl+Z 撤销：先检查删除历史（紧急），再检查通用快照（文本/拖移）
        // =====================================
        if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
           e.preventDefault(); // 🛑 核心护盾：坚决拦截浏览器的默认撤销，防止它把你旁边文本框的剧本清空！
           
           if (deleteHistory.length > 0) {
               // 优先：撤销最近一次节点/连线删除
               const lastSnapshot = deleteHistory[deleteHistory.length - 1]; 
               setNodes(lastSnapshot.nodes); 
               setEdges(lastSnapshot.edges); 
               setDeleteHistory(prev => prev.slice(0, -1)); 
               useAppStore.getState().setToastMsg("↩️ 撤销成功，误删节点已复活！");
           } else if (undoHistory.length > 0) {
               // 其次：撤销最近一次文本编辑 / 节点移位的通用快照
               const lastSnapshot = undoHistory[undoHistory.length - 1];
               setNodes(lastSnapshot.nodes);
               setEdges(lastSnapshot.edges);
               setUndoHistory(prev => prev.slice(0, -1));
               useAppStore.getState().setToastMsg("↩️ 撤销成功，已恢复到上一步编辑状态！");
           } else {
               useAppStore.getState().setToastMsg("当前没有可撤销的操作");
           }
        }

      };
  
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
      
    }, [clipboard, getNodes, getEdges, setNodes, setEdges, deleteHistory, undoHistory]);

    // ★ 通用撤销快照采集：每次 nodes/edges 变化时，节流推入 undoHistory
    // 覆盖文本编辑、节点拖移等非删除操作，让 Ctrl+Z 不止能撤销删除
    useEffect(() => {
      if (undoThrottleRef.current) clearTimeout(undoThrottleRef.current);
      undoThrottleRef.current = setTimeout(() => {
        const currentNodes = getNodes();
        const currentEdges = getEdges();
        // 仅在状态与上一次快照不同时才推入（避免无变更重复）
        const lastSnapshot = undoHistory[undoHistory.length - 1];
        const sameAsLast = lastSnapshot &&
          JSON.stringify(lastSnapshot.nodes) === JSON.stringify(currentNodes) &&
          JSON.stringify(lastSnapshot.edges) === JSON.stringify(currentEdges);
        if (!sameAsLast && currentNodes.length > 0) {
          setUndoHistory(prev => [...prev.slice(-49), { nodes: JSON.parse(JSON.stringify(currentNodes)), edges: JSON.parse(JSON.stringify(currentEdges)) }]);
        }
        undoThrottleRef.current = null;
      }, 5000);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes, edges]);

    // ★ 连线样式重算：仅当节点视觉属性（选中/生成/脏数据/书签）变化时才执行，跳过纯拖拽位置更新
    useEffect(() => {
      const currentHash = getNodesVisualHash(nodes);
      if (currentHash === lastEdgeVisualHashRef.current) return; // 拖拽位置变化，跳过
      lastEdgeVisualHashRef.current = currentHash;
      setEdges((eds) => {
        let changed = false;
        const newEdges = eds.map((edge) => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          
          const isSelected = sourceNode?.selected || targetNode?.selected || edge.selected;
          const isGenerating = targetNode?.data?.isGenerating;
          // ✨ 新增：脏数据断路器检测
          const isDirty = targetNode?.data?.isDirty;
  
          const shouldAnimate = true; 
          
          let strokeColor = 'rgba(255, 255, 255, 0.2)';
          let strokeWidth = 1.5;
          let filter = 'none';
          let dashArray = '8 8';
          let animationDuration = '10s'; 

          // ✨ 新增：书签精准映射过滤
          let isFadedOutByBookmark = false;
          if (sourceNode?.type === 'masterScript' && sourceNode.data?.activeTargetIds?.length > 0) {
              if (!sourceNode.data.activeTargetIds.includes(edge.target)) {
                 isFadedOutByBookmark = true; // 如果不是该书签关联的连线，变暗
              } else {
                 // ✨ 目标达成：仅仅这个连线被强高亮！
                 strokeColor = 'rgba(255, 255, 255, 0.9)';
                 strokeWidth = 2.5;
                 filter = 'drop-shadow(0 0 15px rgba(255, 255, 255, 0.6))';
                 dashArray = '10 10';
                 animationDuration = '2s'; 
              }
          }
  
          if (isDirty) {
            strokeColor = 'rgba(239, 68, 68, 0.8)'; // Red-500
            strokeWidth = 2;
            filter = 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))';
            dashArray = '5 15';
            animationDuration = '5s'; 
        } else if (isGenerating) {
            // ✨ 恢复：生成中呈现耀眼的纯金流光
            strokeColor = 'rgba(253, 230, 138, 1)'; 
            strokeWidth = 3;
            filter = 'drop-shadow(0 0 15px rgba(253, 230, 138, 0.9))';
            dashArray = '15 15';
            animationDuration = '0.3s'; 
        } else if (isSelected && !isFadedOutByBookmark && !(sourceNode?.data?.activeTargetIds?.length > 0)) {
            // ✨ 恢复：普通选中时的琥珀金光
            strokeColor = 'rgba(253, 230, 138, 0.7)';
            strokeWidth = 2;
            filter = 'drop-shadow(0 0 10px rgba(253, 230, 138, 0.4))';
            dashArray = '10 10';
            animationDuration = '2s'; 
        }

          if (isFadedOutByBookmark) {
              strokeColor = 'rgba(255, 255, 255, 0.03)'; // 彻底变淡隐形
              filter = 'none';
          }
          
          // 我们需要比对 strokeColor 是否一致，如果不同就触发渲染更新
          if (edge.animated !== shouldAnimate || edge.style?.stroke !== strokeColor || edge.style?.animationDuration !== animationDuration) {
             changed = true;
          }
          
          return {
            ...edge,
            animated: shouldAnimate,
            style: { stroke: strokeColor, strokeWidth: strokeWidth, filter: filter, strokeDasharray: dashArray, animationDuration: animationDuration }
          };
        });
        return changed ? newEdges : eds; 
      });
    }, [nodes, setEdges, getNodesVisualHash]);

  // 👈 彻底删除了 handleGlobalCombine 及其所有残余代码

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault(); event.dataTransfer.dropEffect = 'move';
  }, []);

  // ✨ 同步画布设置到外部拖拽
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

    // 1. 处理右侧资产传送带拖入
    const assetStr = event.dataTransfer.getData('application/yr-canvas-asset');
    if (assetStr) {
      try {
        const asset = JSON.parse(assetStr);
        const isVideo = asset._type === 'video';
        
        // ✨ 智能比例侦测：在后台静默加载媒体，读取真实宽高比
        const media = isVideo ? document.createElement('video') : new Image();
        media.src = asset.url;
        
        const createNodeWithRatio = (finalRatio: string) => {
          const newNode = { 
            id: `node_${Date.now()}`, type: isVideo ? 'render' : 'media', position, 
            data: { 
              asset, ratio: finalRatio, 
              model: isVideo ? (canvasSettings?.defaultVideoModel || 'doubao-seedance-2-0') : (canvasSettings?.defaultImageModel || 'gpt-image-2'), 
              prompt: asset.prompt || '' // 🚨 移除隐式拼接
            } 
          };
           setNodes((nds) => [...nds, newNode]);
        };

        // 🚀 核心优化：瞬间生成节点，不再等待网络下载媒体！拖拉极其丝滑！
        createNodeWithRatio(asset.ratio || '16:9');
        return;
      } catch (e) {}
    }

    // 2. 处理直接从电脑桌面拖入的文件
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      const isVideo = file.type.startsWith('video');
      const isImage = file.type.startsWith('image');
      const isJson = file.type === 'application/json' || file.name.endsWith('.json');
      
      // ✨ 拦截处理资产 JSON 文件的导入
      if (isJson) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const parsed = JSON.parse(e.target?.result as string);
            if (parsed.yr_type === 'asset_table') {
              const newNodeId = `asset_table_imported_${Date.now()}`;
              const newNode = {
                id: newNodeId, type: 'assetTable', position,
                data: {
                  assetType: parsed.assetType || 'scene', model: parsed.model || 'gpt-image-2',
                  ratio: parsed.ratio || '16:9', quality: parsed.quality || '标准 Standard',
                  styleOverride: parsed.styleOverride || '继承全局预设', rows: parsed.rows || []
                }
              };
              
              setNodes((nds) => [...nds, newNode]);
              
              // 自动去寻找画布上的主剧本节点并建立连接
              setTimeout(() => {
                 const currentNodes = getNodes();
                 const masterScriptNode = currentNodes.find(n => n.type === 'masterScript');
                 if (masterScriptNode) {
                    setEdges((eds) => addEdge({
                      id: `e-${masterScriptNode.id}-${newNodeId}`, source: masterScriptNode.id, target: newNodeId, sourceHandle: 'right', targetHandle: 'left',
                      type: 'default', animated: true, style: { stroke: 'rgba(217, 70, 239, 0.8)', strokeWidth: 2, strokeDasharray: '8 8', animationDuration: '3s' }
                    }, eds));
                 }
              }, 100);

              const typeName = parsed.assetType === 'scene' ? '场景表' : parsed.assetType === 'character' ? '角色表' : '道具表';
              useAppStore.getState().setToastMsg(`✅ 成功导入最新的 ${typeName}，并在裂变时优先使用！`);
            } else {
              useAppStore.getState().setToastMsg("⚠️ 无法识别的 JSON 格式，请拖入系统导出的表格包");
            }
          } catch (err) {
            useAppStore.getState().setToastMsg("⚠️ JSON 文件解析失败");
          }
        };
        reader.readAsText(file);
        return;
      }

      if (isVideo || isImage) {
        const processMedia = (fileUrl: string) => {
            const media = isVideo ? document.createElement('video') : new Image();
            media.src = fileUrl;
            
            const handleLoad = () => {
               const w = isVideo ? (media as HTMLVideoElement).videoWidth : (media as HTMLImageElement).naturalWidth;
               const h = isVideo ? (media as HTMLVideoElement).videoHeight : (media as HTMLImageElement).naturalHeight;
               const ratioValue = w / h;
               
               let finalRatio = '16:9';
               if (ratioValue < 0.8) finalRatio = '9:16';
               else if (ratioValue >= 0.8 && ratioValue < 1.2) finalRatio = '1:1';
               else if (ratioValue >= 1.2 && ratioValue < 1.5) finalRatio = '4:3';
               
                // ✨ 修复：在存入本地资产库时，强行把计算出的 ratio 写进去
                const asset = { id: `local_${Date.now()}`, _type: isVideo ? 'video' : 'image', url: fileUrl, prompt: file.name, timestamp: Date.now(), ratio: finalRatio };
                
                if (typeof updateCanvasProject === 'function' && activeCanvasProjectId) {
                    // ★ 函数式更新：从状态机原子快照读取最新 localAssets，杜绝竞态覆盖
                    updateCanvasProject(activeCanvasProjectId, (prev: any) => ({ localAssets: [...(prev?.localAssets || []), asset] }));
                }

               const newNode = { 
                id: `node_${Date.now()}`, type: isVideo ? 'render' : 'media', position, 
                data: { 
                  asset, ratio: finalRatio,
                  model: isVideo ? (canvasSettings?.defaultVideoModel || 'doubao-seedance-2-0') : (canvasSettings?.defaultImageModel || 'gpt-image-2'), 
                  prompt: file.name // 🚨 移除隐式拼接
                } 
              };
               setNodes((nds) => [...nds, newNode]);
            };

            if (isVideo) { media.onloadedmetadata = handleLoad; } else { media.onload = handleLoad; }
        };

        if ((isImage || isVideo) && file.size < 8 * 1024 * 1024) { 
           if (isVideo) useAppStore.getState().setToastMsg("✅ 小体积视频已作为永久资产保存入库！");
           const reader = new FileReader();
           reader.onload = (e) => processMedia(e.target?.result as string);
           reader.readAsDataURL(file);
        } else {
           if (isVideo) useAppStore.getState().setToastMsg("⚠️ 该视频超过 8MB，属于临时预览，刷新网页会断开连接");
           if (isImage) useAppStore.getState().setToastMsg("⚠️ 该图片超过 8MB，属于临时预览，刷新网页会断开连接");
           processMedia(URL.createObjectURL(file));
        }
      }
    }
  }, [screenToFlowPosition, setNodes, currentProject, activeCanvasProjectId, updateCanvasProject, canvasSettings]);

  // ✨ 补回刚才被不小心覆盖掉的常规连线函数
  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ 
      ...params, 
      type: 'default', 
      animated: true, 
      style: { stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1.5, strokeDasharray: '8 8', animationDuration: '10s' },
    }, eds));
  }, [setEdges]);

  // 修改：触发菜单时支持传入源节点
  const triggerMenu = useCallback((clientX: number, clientY: number, sourceNodeId?: string) => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setMenuPos({ x: clientX - rect.left, y: clientY - rect.top, screenX: clientX, screenY: clientY, sourceNodeId });
  }, []);
  
  const onPaneDoubleClick = useCallback((event: React.MouseEvent) => { event.preventDefault(); triggerMenu(event.clientX, event.clientY); }, [triggerMenu]);
  const onPaneContextMenu = useCallback((event: React.MouseEvent) => { event.preventDefault(); triggerMenu(event.clientX, event.clientY); }, [triggerMenu]);

  // ✨ 最重要的修复：从菜单添加节点并自动连线
  const onAddNode = (type: string) => {
    if (!menuPos) return;
    const position = screenToFlowPosition({ x: menuPos.screenX, y: menuPos.screenY });
    const nodeId = `node_${Date.now()}`;
    const newNode = {
      id: nodeId, type, position,
      // ✨ 接入全局设定：新建空节点也继承默认模型
      data: type === 'text' 
        ? { text: '', model: 'gemini-3.1-pro-preview' } 
        : { 
            asset: null, ratio: '16:9', 
            prompt: canvasSettings?.globalPromptSuffix ? canvasSettings.globalPromptSuffix : '', 
            model: type === 'media' ? (canvasSettings?.defaultImageModel || 'gpt-image-2') : (canvasSettings?.defaultVideoModel || 'doubao-seedance-2-0')
          }, 
    };
    setNodes((nds) => [...nds, newNode]);

    // ✨ 核心魔法：如果这个菜单是从“拉线”唤出的，自动完成连接！
    if (menuPos.sourceNodeId) {
       setEdges((eds) => addEdge({
          id: `e-${menuPos.sourceNodeId}-${nodeId}`,
          source: menuPos.sourceNodeId,
          target: nodeId,
          type: 'default',
          animated: true,
          style: { stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1.5, strokeDasharray: '8 8', animationDuration: '10s' }
       }, eds));
    }

    setMenuPos(null);
  };

  // 👇👇👇 新增下面这两个函数 👇👇👇
  // ✨ 新增：在节点或连线被删除的瞬间，拍下案发现场快照，存入时光机
  const onNodesDelete = useCallback(() => {
    setDeleteHistory(prev => [...prev, { nodes, edges }]);
  }, [nodes, edges]);

  const onEdgesDelete = useCallback(() => {
    setDeleteHistory(prev => [...prev, { nodes, edges }]);
  }, [nodes, edges]);
  // 👆👆👆 ------------------- 👆👆👆

  // ✨ React Flow 连线拦截器 (这是原有的代码)
  const onConnectStart = useCallback((event: any, params: any) => {
    setConnecting({ nodeId: params.nodeId }); 
  }, []);
  
  // 🚀 核心修复：加入 setTimeout 延迟，彻底躲开 onClick 的误杀！
  const onConnectEnd = useCallback((event: any) => {
    if (!connecting?.nodeId) return;
    
    const target = event.target as Element;
    const isOverNode = target.closest('.react-flow__node');
    
    // 如果没有连到节点上（扔在了虚空）
    if (!isOverNode) {
      const clientX = 'clientX' in event ? event.clientX : event.changedTouches?.[0].clientX;
      const clientY = 'clientY' in event ? event.clientY : event.changedTouches?.[0].clientY;
      
      const sourceId = connecting.nodeId; // 提前存好，防止被清空
      
      // 🔥 致命魔法：延迟 50 毫秒！等浏览器的 Click 误杀事件执行完，我们再把菜单弹出来！
      setTimeout(() => {
        triggerMenu(clientX, clientY, sourceId);
      }, 50);
    }
    
    setConnecting(null);
  }, [connecting, triggerMenu]);

  // ✨ 自定义全局鼠标样式 (SVG 转 Data URL，黑玻璃水滴形)
  const glassCursor = `url('data:image/svg+xml;utf8,<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 3.5L18.5 11.5L11.5 13.5L7.5 20.5L5.5 3.5Z" fill="rgba(10, 10, 12, 0.5)" stroke="rgba(255, 255, 255, 0.8)" stroke-width="1.5" stroke-linejoin="round" style="backdrop-filter: blur(4px)"/><circle cx="9" cy="9" r="1.5" fill="rgba(255,255,255,0.9)"/></svg>') 5 3, auto`;

  // ★ 自定义下拉选择器 — 替代原生 <select>，深色液态玻璃风格
  // 使用 createPortal 渲染到 body，彻底避免被抽屉 overflow 裁剪
  const DirectorSelect = ({ value, onChange, options, placeholder }: {
    value: string; onChange: (v: string) => void; options: { key: string; label: string }[]; placeholder?: string;
  }) => {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

    const selectedLabel = options.find(o => o.key === value)?.label || placeholder || '';
    const isPlaceholder = !value || value === 'default' || (placeholder && value === '');

    const handleToggle = () => {
      if (!open && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
      }
      setOpen(prev => !prev);
    };

    // 点击外部关闭 + Esc 关闭
    useEffect(() => {
      if (!open) return;
      const handle = (e: MouseEvent | KeyboardEvent) => {
        if (e instanceof KeyboardEvent && e.key === 'Escape') { setOpen(false); return; }
        if (e instanceof MouseEvent) {
          const target = e.target as Node;
          if (triggerRef.current?.contains(target)) return;
          // 下拉菜单在 portal 中，不在 trigger 子树里，需要单独判断
          const dropdownEl = document.querySelector('[data-dir-select-dropdown]');
          if (dropdownEl?.contains(target)) return;
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handle);
      document.addEventListener('keydown', handle);
      return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('keydown', handle); };
    }, [open]);

    return (
      <>
        <button
          ref={triggerRef}
          onClick={handleToggle}
          className="w-full flex items-center justify-between bg-black/40 border border-white/5 hover:border-white/10 rounded-[14px] p-2.5 text-[12px] outline-none cursor-pointer transition-all nodrag group"
        >
          <span className={isPlaceholder ? 'text-zinc-500' : 'text-zinc-200'}>
            {selectedLabel}
          </span>
          <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-200 group-hover:text-zinc-300 ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && typeof window !== 'undefined' && createPortal(
          <div
            data-dir-select-dropdown
            ref={dropdownRef}
            className="fixed bg-[#0d0d0f]/98 backdrop-blur-3xl border border-white/[0.08] rounded-[14px] shadow-[0_25px_70px_rgba(0,0,0,0.95)] py-1 max-h-[260px] overflow-y-auto custom-scrollbar z-[9999999] animate-in fade-in slide-in-from-top-2 duration-150"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            {options.map(opt => (
              <button
                key={opt.key}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onChange(opt.key); setOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-[12px] transition-colors ${
                  opt.key === value
                    ? 'text-white bg-white/[0.08] font-medium'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body
        )}
      </>
    );
  };

  return (
    <div 
      ref={wrapperRef} 
      className="w-full h-full flex bg-[#020203] animate-in fade-in duration-500 overflow-hidden" 
      style={{ cursor: glassCursor }} 
    >
      {/* ===== 左侧：画布主区域 ===== */}
      <div className="flex-1 min-w-0 relative" onDragOver={onDragOver} onDrop={onDrop} onClick={handleCanvasClick}>
      {/* ========================================== */}
      {/* 🎬 黑色液态玻璃影视总控抽屉 (Film Control Center) */}
      {/* ========================================== */}
      {typeof window !== 'undefined' && createPortal(
        <div 
          className={`fixed top-24 left-6 bottom-24 w-[360px] z-[999999] rounded-[32px] bg-[#050507]/90 backdrop-blur-3xl border border-white/[0.08] shadow-[0_30px_100px_rgba(0,0,0,0.95),inset_0_1px_1px_rgba(255,255,255,0.08)] flex flex-col overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isFilmControlOpen ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 -translate-x-12 pointer-events-none'
          }`}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-6 py-5 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.01]">
            <span className="text-[12px] font-extrabold text-zinc-200 tracking-[0.2em] flex items-center gap-2 uppercase">
              <Sliders size={14} className="text-zinc-400 animate-pulse" />
              影视级中控台 (Film Control)
            </span>
            <button 
              onClick={() => setIsFilmControlOpen(false)} 
              className="w-6 h-6 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all border border-white/5"
            >
              <X size={12} />
            </button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
            {/* 0. LLM 模型选择器 — 画布所有文本调用（摄影机锚定、裂变分镜、资产表提取、创作助手等）统一使用此模型 */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest pl-1">
                LLM 模型 (Canvas Chat Model)
              </label>
              <select
                className="w-full bg-black/40 border border-white/5 focus:border-white/20 hover:bg-white/[0.01] rounded-[16px] p-3 text-[13px] text-zinc-300 outline-none cursor-pointer transition-all nodrag"
                value={canvasSettings?.defaultLLMModel || 'deepseek-v4-pro'}
                onChange={(e) => setCanvasSettings({ ...canvasSettings, defaultLLMModel: e.target.value })}
              >
                {MODELS.map(m => (
                  <option key={m.id} value={m.id} className="bg-[#121212] text-zinc-200">{m.name}</option>
                ))}
              </select>
              <p className="text-[9px] text-zinc-600 pl-1 leading-relaxed">
                画布中所有 AI 文本调用（摄影机锚定、裂变分镜、资产表提取、创作助手等）统一使用此模型。
                {canvasSettings?.defaultLLMModel ? ` 当前：${MODELS.find(m => m.id === canvasSettings.defaultLLMModel)?.name || canvasSettings.defaultLLMModel}` : ' 使用默认模型'}
              </p>
            </div>

            <div className="w-full h-px bg-white/[0.05]" />

            {/* 0. 导演引擎：题材 + 节奏选择 */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest pl-1">
                导演引擎 (Director Engine)
              </label>
              <DirectorSelect
                value={canvasSettings?.directorGenre || 'default'}
                onChange={(val) => setCanvasSettings({ ...canvasSettings, directorGenre: val })}
                options={GENRE_PRESETS.map(g => ({ key: g.key, label: g.label }))}
              />
              <DirectorSelect
                value={canvasSettings?.directorTempo || ''}
                onChange={(val) => setCanvasSettings({ ...canvasSettings, directorTempo: val })}
                options={TEMPO_PROFILES.map(t => ({ key: t.key, label: t.label }))}
                placeholder="跟随题材默认节奏"
              />
              <p className="text-[10px] text-zinc-600 leading-relaxed pl-1">
                选择题材后，裂变分镜将自动注入导演审美引导。题材默认为"通用"状态，不注入风格化参数。以上为建议，不锁死。
              </p>
            </div>

            <div className="w-full h-px bg-white/[0.05]" />

            {/* 1. 比例一键穿透 */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest pl-1">
                影视分镜比例 (Global Ratio)
              </label>
              <div className="grid grid-cols-5 gap-1.5 bg-black/40 p-1.5 rounded-[16px] border border-white/5 shadow-inner">
                {['16:9', '9:16', '1:1', '4:3', '3:4'].map(r => (
                  <button 
                    key={r} 
                    onClick={() => setCanvasSettings({ ...canvasSettings, globalRatio: r })} 
                    className={`py-2 text-[11px] font-mono rounded-[10px] transition-all border ${
                      canvasSettings?.globalRatio === r 
                        ? 'bg-white text-black border-white shadow-[0_5px_15px_rgba(255,255,255,0.15)] font-bold' 
                        : 'text-zinc-500 hover:text-white hover:bg-white/5 border-transparent'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => {
                  // 🚀 比例穿透：将 globalRatio 穿透到所有可视化节点类型（shot/videoClip/media/render/assetTable）
                  const currentRatio = canvasSettings?.globalRatio || '16:9';
                  // 需要穿透的节点类型（全部支持比例的节点）
                  const targetTypes = new Set(['shot', 'videoClip', 'media', 'render', 'assetTable']);
                  setNodes(nds => nds.map(node => {
                    if (targetTypes.has(node.type || '')) {
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          globalRatioOverride: currentRatio,
                          // assetTable 也同步更新自己的独立 ratio 字段
                          ...(node.type === 'assetTable' ? { ratio: currentRatio } : {})
                        }
                      };
                    }
                    return node;
                  }));
                  useAppStore.getState().setToastMsg(`⚡ 已将全局比例 [${currentRatio}] 穿透覆盖到所有节点！`);
                }}
                className="w-full py-3 rounded-[16px] border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-[12px] font-bold tracking-widest transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
              >
                <span>⚡ 全局比例穿透覆盖</span>
              </button>
            </div>

            <div className="w-full h-px bg-white/[0.05]" />

            {/* 2. 资产表生图全局前缀（拼在 Prompt 最顶部） */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest pl-1">
                全局资产表前缀 (Asset Prompt Prefix)
              </label>
              <textarea
                className="w-full bg-black/40 border border-white/5 focus:border-white/20 hover:bg-white/[0.01] rounded-[16px] p-3 text-[12px] text-zinc-300 outline-none w-full font-mono transition-colors nodrag nopan resize-none custom-scrollbar min-h-[70px] shadow-inner"
                placeholder="例如：电影质感，胶片颗粒，柔光摄影..."
                value={canvasSettings?.globalAssetPromptPrefix || ''}
                onChange={(e) => setCanvasSettings({ ...canvasSettings, globalAssetPromptPrefix: e.target.value })}
                onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
              />
              <p className="text-[9px] text-zinc-600 pl-1">此内容将拼接到所有资产表生图 Prompt 的最顶部（globalRatio 前缀之前）</p>
              
              <button
                onClick={() => {
                  const currentPrefix = canvasSettings?.globalAssetPromptPrefix || '';
                  
                  setNodes(nds => nds.map(node => {
                    if (node.type !== 'assetTable' || !node.data.rows) return node;
                    
                    const newRows = node.data.rows.map((row: any) => {
                      let cleanPrompt = row.prompt || '';
                      const lastApplied = row._lastAppliedPrefix || '';
                      
                      // 清洗上一次追加的前缀（防套娃堆叠）
                      if (lastApplied && lastApplied.trim() && cleanPrompt.startsWith(lastApplied)) {
                        cleanPrompt = cleanPrompt.slice(lastApplied.length).trim();
                      }
                      
                      // 追加新的全局前缀到 Prompt 最顶部
                      const newPrompt = currentPrefix.trim() 
                        ? `${currentPrefix}, ${cleanPrompt}`
                        : cleanPrompt;
                      
                      return { ...row, prompt: newPrompt, _lastAppliedPrefix: currentPrefix || '' };
                    });
                    
                    return { ...node, data: { ...node.data, rows: newRows } };
                  }));
                  
                  if (currentPrefix.trim()) {
                    useAppStore.getState().setToastMsg(`✨ 全局前缀已穿透覆盖至所有资产表 Prompt 顶部`);
                  } else {
                    useAppStore.getState().setToastMsg(`🧹 已安全清除所有资产表的全局提示词前缀`);
                  }
                }}
                className="w-full py-3 rounded-[16px] bg-white/10 hover:bg-white/15 text-white text-[12px] font-bold tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span>⚡ 穿透覆盖至所有资产表</span>
              </button>
            </div>

            <div className="w-full h-px bg-white/[0.05]" />

            {/* 3. 后缀智能追加 */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest pl-1">
                全局提示词后缀 (Prompt Suffix)
              </label>
              <textarea
                className="w-full bg-black/40 border border-white/5 focus:border-white/20 hover:bg-white/[0.01] rounded-[16px] p-3 text-[12px] text-zinc-300 outline-none w-full font-mono transition-colors nodrag nopan resize-none custom-scrollbar min-h-[90px] shadow-inner"
                placeholder="例如：Cinematic, highly detailed, masterpieces, 35mm film still look..."
                value={canvasSettings?.globalPromptSuffix || ''}
                onChange={(e) => setCanvasSettings({ ...canvasSettings, globalPromptSuffix: e.target.value })}
                onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
              />

              <button
                onClick={() => {
                  const currentSuffix = canvasSettings?.globalPromptSuffix || '';
                  
                  setNodes(nds => nds.map(node => {
                    if (node.type === 'shot') {
                      // 1. 恢复原始纯净的 firstFrameAnchor 和 videoPrompt 状态
                      // 如果存在 originalFirstFrameAnchor，使用原始数据，否则初始化它
                      const originalFirst = node.data.originalFirstFrameAnchor !== undefined 
                        ? node.data.originalFirstFrameAnchor 
                        : (node.data.firstFrameAnchor || '');
                      const originalVideo = node.data.originalVideoPrompt !== undefined 
                        ? node.data.originalVideoPrompt 
                        : (node.data.videoPrompt || '');

                      // 2. 清洗上一次被追加的后缀 (防止套娃堆叠)
                      const lastApplied = node.data.lastAppliedSuffix || '';

                      let cleanFirst = originalFirst;
                      let cleanVideo = originalVideo;

                      if (lastApplied && lastApplied.trim()) {
                        // 严格在句尾剔除上一次追加的内容
                        const suffixPattern = new RegExp(`\\n?,\\s*${lastApplied.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`);
                        cleanFirst = cleanFirst.replace(suffixPattern, '').trim();
                        cleanVideo = cleanVideo.replace(suffixPattern, '').trim();
                      }

                      // 3. 追加新的全局后缀 (如果存在的话)
                      let newFirst = cleanFirst;
                      let newVideo = cleanVideo;

                      if (currentSuffix.trim()) {
                        newFirst = `${cleanFirst}\n, ${currentSuffix}`;
                        newVideo = `${cleanVideo}\n, ${currentSuffix}`;
                      }

                      return {
                        ...node,
                        data: {
                          ...node.data,
                          // 首次追加时，备份原始 Prompt，以便未来清洗时使用
                          originalFirstFrameAnchor: originalFirst,
                          originalVideoPrompt: originalVideo,
                          firstFrameAnchor: newFirst,
                          videoPrompt: newVideo,
                          lastAppliedSuffix: currentSuffix
                        }
                      };
                    }
                    return node;
                  }));

                  if (currentSuffix.trim()) {
                    useAppStore.getState().setToastMsg(`✨ 智能全局后缀已成功追加（已去重、防套娃污染）`);
                  } else {
                    useAppStore.getState().setToastMsg(`🧹 已安全清除所有分镜的全局提示词后缀`);
                  }
                }}
                className="w-full py-3 rounded-[16px] bg-white/10 hover:bg-white/15 text-white text-[12px] font-bold tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span>✨ 智能追加至所有分镜</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ★★★ 全局文字选中 AI 助手 — 仅当用户在设置中开启时渲染 ★★★ */}
      {selectionAssistEnabled && <SelectionAssist />}
      {ripples.map(r => (
        <div
          key={r.id}
          className="absolute z-0 pointer-events-none rounded-full border border-white/20 opacity-0"
          style={{
            left: r.x - 50, top: r.y - 50, width: 100, height: 100,
            animation: 'ripple-expand 0.8s cubic-bezier(0.1, 0.8, 0.3, 1) forwards',
            boxShadow: 'inset 0 0 20px rgba(255,255,255,0.1), 0 0 20px rgba(255,255,255,0.05)'
          }}
        />
      ))}
      {/* 🚀 核心修复：用最高权重强行覆盖 React Flow 内部的小巴掌！ */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes ripple-expand {
          0% { transform: scale(0.1); opacity: 1; border-width: 4px; }
          100% { transform: scale(1.5); opacity: 0; border-width: 1px; }
        }
        .react-flow__pane {
          cursor: url('data:image/svg+xml;utf8,<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 3.5L18.5 11.5L11.5 13.5L7.5 20.5L5.5 3.5Z" fill="rgba(10, 10, 12, 0.5)" stroke="rgba(255, 255, 255, 0.8)" stroke-width="1.5" stroke-linejoin="round" style="backdrop-filter: blur(4px)"/><circle cx="9" cy="9" r="1.5" fill="rgba(255,255,255,0.9)"/></svg>') 5 3, auto !important;
        }
        .react-flow__pane:active {
          cursor: url('data:image/svg+xml;utf8,<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 3.5L18.5 11.5L11.5 13.5L7.5 20.5L5.5 3.5Z" fill="rgba(255, 255, 255, 0.2)" stroke="rgba(255, 255, 255, 0.9)" stroke-width="1.5" stroke-linejoin="round" style="backdrop-filter: blur(8px)"/><circle cx="9" cy="9" r="1.5" fill="rgba(255,255,255,1)"/></svg>') 5 3, auto !important;
        }
      `}}/>

<ReactFlow
        nodes={nodes} edges={edges} onNodesChange={customOnNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} 
        
        onNodesDelete={onNodesDelete} onEdgesDelete={onEdgesDelete} 
        
        onConnectStart={onConnectStart} onConnectEnd={onConnectEnd} 
        nodeTypes={nodeTypes} edgeTypes={edgeTypes} onPaneDoubleClick={onPaneDoubleClick} onPaneContextMenu={onPaneContextMenu} onPaneClick={() => setMenuPos(null)}
  zoomOnDoubleClick={false} minZoom={0.05} maxZoom={15} proOptions={{ hideAttribution: true }} 
  connectionRadius={80}
  selectionKeyCode={['Control', 'Meta']} 
  multiSelectionKeyCode={['Control', 'Meta', 'Shift']} 
  selectionMode={SelectionMode.Partial} 
  selectionStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px dashed rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(4px)' }}
  panOnScroll={true} zoomOnScroll={false}
>
        <Background color="rgba(255, 255, 255, 0.15)" variant={BackgroundVariant.Dots} gap={24} size={1.5} />
        
        {/* 🚀 核心修复：平时半透明+缩小到 60%，鼠标悬停时丝滑放大恢复 */}
        <MiniMap 
          className="!bg-[#050505]/80 !backdrop-blur-3xl !border !border-white/[0.08] !rounded-[24px] !shadow-[0_20px_40px_rgba(0,0,0,0.8)] !m-6 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] scale-50 opacity-40 hover:scale-100 hover:opacity-100 origin-bottom-left cursor-crosshair"
          nodeColor={(n) => {
            if (n.type === 'masterScript') return '#f59e0b'; 
            if (n.type === 'shot') return '#ffffff'; 
            if (n.type === 'videoClip') return '#818cf8'; 
            return '#3f3f46'; 
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
          position="bottom-left"
          zoomable pannable
        />

        <Controls showInteractive={false} showZoom={false} showFitView={false} className="hidden" />
        <ZoomPanel />
      </ReactFlow>

      {/* 左上角：返回舱 + 原位极简编辑框 + 保存指示灯 */}
      <div className="absolute top-6 left-6 z-50 flex items-center gap-3">
        <button onClick={() => setActiveCanvasProjectId(null)} className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-3xl border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:scale-105">
          <ArrowLeft size={18} />
        </button>
        
        {/* ✨ 新增：中控台一键开关 Pill 按钮 */}
        <button 
          onClick={() => setIsFilmControlOpen(!isFilmControlOpen)}
          className={`h-10 px-4 rounded-full backdrop-blur-3xl border flex items-center gap-2 text-[12px] font-bold tracking-widest transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:scale-105 ${
            isFilmControlOpen 
              ? 'bg-white/[0.08] border-white/[0.15] text-zinc-200' 
              : 'bg-black/60 border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/20'
          }`}
        >
          <Sliders size={14} className={isFilmControlOpen ? 'text-zinc-300 animate-spin-slow' : 'text-zinc-500'} />
          影视总控
        </button>

        <div className="h-10 px-4 rounded-full bg-black/60 backdrop-blur-3xl border border-white/[0.08] shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex items-center gap-3 group hover:border-white/20 transition-all duration-300">
          <input
            type="text"
            value={currentProject?.title || ''}
            onChange={(e) => {
              if (activeCanvasProjectId && typeof updateCanvasProject === 'function') {
                 updateCanvasProject(activeCanvasProjectId, { title: e.target.value });
              }
            }}
            placeholder="未命名创想宇宙"
            className="bg-transparent border-none outline-none text-[13px] font-bold text-zinc-200 placeholder-zinc-600 w-32 focus:w-48 transition-all duration-500"
          />
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-1.5 min-w-[60px] justify-center">
            {saveStatus === 'saving' ? (
              <>
                <Loader2 size={12} className="animate-spin text-amber-200/80" />
                <span className="text-[10px] font-mono text-amber-200/80 tracking-widest">SAVING</span>
              </>
            ) : (
              <>
                <Check size={12} className="text-zinc-500" />
                <span className="text-[10px] font-mono text-zinc-500 tracking-widest">SAVED</span>
              </>
            )}
          </div>
        </div>
      </div>
      {/* 右上角：创作助手 + 全局配置齿轮 */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
        {/* 创作助手 */}
        <button 
          onClick={() => setCopilotIsOpen(!copilotIsOpen)}
          className={`h-10 px-4 rounded-full backdrop-blur-3xl border flex items-center gap-2 text-[12px] font-bold tracking-widest transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:scale-105 ${
            copilotIsOpen 
              ? 'bg-white/[0.08] border-white/[0.15] text-zinc-300' 
              : 'bg-black/60 border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/20'
          }`}
        >
          <MessageSquare size={14} className={copilotIsOpen ? 'text-zinc-300' : 'text-zinc-500'} />
          创作助手
        </button>
        {/* 设置齿轮 */}
        <button 
          onClick={() => setIsCanvasSettingsOpen(true)} 
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-3xl border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:scale-105 hover:rotate-90 duration-500"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* ★ 统一进度条：分镜裂变 / 摄影机 / 资产提取 / 表格生成 共用 */}
      {fissionProgress.status !== 'idle' && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-2 rounded-full bg-black/70 backdrop-blur-3xl border border-white/[0.08] shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
          {/* 阶段标签 */}
          <span className="text-[11px] font-bold text-white tracking-widest whitespace-nowrap">
            {fissionProgress.status === 'stage1' ? '🧩 阶段 1/2' :
             fissionProgress.status === 'stage2' ? '🎨 阶段 2/2' :
             fissionProgress.status === 'camera' ? '📷 摄影机参数' :
             fissionProgress.status === 'asset' ? '📋 资产提取' :
             fissionProgress.status === 'table' ? '📊 表格生成' : ''}
          </span>
          <span className="text-[10px] text-zinc-400 font-mono whitespace-nowrap">{fissionProgress.phase}</span>
          {/* 动画光条：不计算百分比，纯视觉反馈 */}
          <div className="relative w-32 h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-full animate-[shimmer_1.2s_ease-in-out_infinite]" />
          </div>
          {/* ★ 中止按钮：点击后 abort 所有 LLM 请求 */}
          {abortFission && (
            <button
              onClick={() => abortFission()}
              className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 transition-all ml-1"
              title="中止分镜裂变"
            >
              <X size={12} className="text-red-400" />
            </button>
          )}
        </div>
      )}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>

      {/* Assets dock removed — new asset entry point coming later */}

      {/* 全局设置弹窗 (晶体药丸网格版) */}
      {isCanvasSettingsOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setIsCanvasSettingsOpen(false)} />
           <div className="relative w-full max-w-[480px] bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[32px] p-8 shadow-[0_40px_100px_rgba(0,0,0,0.9)] animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-start mb-8">
                 <div>
                    <h3 className="text-white font-bold text-xl tracking-wide flex items-center gap-2">
                      <Settings size={20} className="text-zinc-400" /> 画布全局引擎配置
                    </h3>
                    <p className="text-zinc-500 text-[11px] mt-1.5 font-light tracking-widest uppercase">Global Engine Variables</p>
                 </div>
                 <button onClick={() => setIsCanvasSettingsOpen(false)} className="p-2 text-zinc-500 hover:text-white bg-white/5 border border-white/10 rounded-full transition-all hover:scale-110">
                    <X size={14} />
                 </button>
              </div>

              <div className="space-y-7">
                 {/* 1. 生图模型药丸 */}
                 <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 pl-1">生图默认引擎</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'gpt-image-2', label: 'GPT-Image-2' },
                        { id: 'banana-pro', label: 'Banana Pro' },
                        { id: 'seedream5.0', label: 'Seedream 5.0' },
                        { id: 'seedream-5-0-pro-260628', label: 'Seedream 5.0 Pro' }
                      ].map(m => (
                        <button 
                          key={m.id} 
                          onClick={() => setCanvasSettings({ ...canvasSettings, defaultImageModel: m.id })} 
                          className={`px-4 py-2.5 rounded-[14px] text-[12px] font-medium transition-all duration-300 ${canvasSettings?.defaultImageModel === m.id ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-black/50 border border-white/[0.08] text-zinc-400 hover:bg-white/10 hover:text-white'}`}
                        >
                           {m.label}
                        </button>
                      ))}
                    </div>
                 </div>

                 {/* 2. 视频模型药丸 */}
                 <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 pl-1">视频默认引擎</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'doubao-seedance-2-0-260128', label: 'Seedance 2.0' },
                        { id: 'doubao-seedance-2-0-fast-260128', label: 'Seedance Fast' },
                        { id: 'seedance-2.5', label: 'Seedance 2.5' },
                        { id: 'kling-o3', label: 'Kling O3' }
                      ].map(m => (
                        <button 
                          key={m.id} 
                          onClick={() => setCanvasSettings({ ...canvasSettings, defaultVideoModel: m.id })} 
                          className={`px-4 py-2.5 rounded-[14px] text-[12px] font-medium transition-all duration-300 ${canvasSettings?.defaultVideoModel === m.id ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-black/50 border border-white/[0.08] text-zinc-400 hover:bg-white/10 hover:text-white'}`}
                        >
                           {m.label}
                        </button>
                      ))}
                    </div>
                 </div>

                 <div className="w-full h-px bg-white/[0.05] my-2" />

                 {/* ★ 画布功能开关 */}
                 <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 pl-1">画布功能</label>
                    <div className="flex items-center justify-between p-3 bg-black/40 border border-white/[0.08] rounded-[16px]">
                      <div>
                        <span className="text-[12px] text-zinc-300 font-medium">全局助手</span>
                        <p className="text-[10px] text-zinc-600 mt-0.5">选中画布文字时弹出 AI 辅助工具条</p>
                      </div>
                      <button
                        onClick={() => setSelectionAssistEnabled(!selectionAssistEnabled)}
                        className={`w-10 h-6 rounded-full relative transition-colors duration-300 flex-shrink-0 ${selectionAssistEnabled ? 'bg-white' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-[2px] left-[2px] w-5 h-5 rounded-full transition-transform duration-300 shadow-sm ${selectionAssistEnabled ? 'translate-x-4 bg-black' : 'translate-x-0 bg-zinc-500'}`} />
                      </button>
                    </div>
                 </div>

                 <div className="w-full h-px bg-white/[0.05] my-2" />

                 {/* 3. 全局画风卡片网格 */}
                 <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 pl-1 flex items-center justify-between">
                      全局画风预设 <span className="bg-white/10 px-2 py-0.5 rounded-[4px] text-[8px] tracking-wider">GLOBAL STYLE</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: '', label: '无预设' },
                        { id: 'Cinematic lighting, 8k resolution, highly detailed, masterpiece', label: '🎬 电影质感' },
                        { id: 'Anime style, studio ghibli, ultra-detailed, beautiful composition', label: '🌸 二次元' },
                        { id: 'Photorealistic, RAW photo, 85mm lens, ultra-realistic', label: '📷 极致写实' },
                        { id: '3D render, Octane Render, Unreal Engine 5, ray tracing', label: '🧊 3D 渲染' },
                        { id: 'Cyberpunk style, neon lights, futuristic city, highly detailed', label: '🌃 赛博朋克' }
                      ].map(style => (
                         <button 
                           key={style.id} 
                           onClick={() => setCanvasSettings({ ...canvasSettings, globalPromptSuffix: style.id })} 
                            className={`flex flex-col items-center justify-center p-3 rounded-[16px] border transition-all duration-300 ${canvasSettings?.globalPromptSuffix === style.id ? 'bg-white/[0.06] border-white/20 text-white' : 'bg-black/50 border-white/[0.05] text-zinc-500 hover:bg-white/5 hover:text-zinc-300 hover:border-white/10'}`}
                         >
                           <span className="text-[12px] font-medium">{style.label}</span>
                         </button>
                      ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* 双击/右键菜单 */}
      {menuPos && (
        <div className="absolute z-[1000] w-[200px] bg-[#0a0a0a]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[24px] shadow-[0_30px_60px_rgba(0,0,0,0.9)] p-2 animate-in fade-in zoom-in-95 duration-100" style={{ top: menuPos.y, left: menuPos.x }} onClick={(e) => e.stopPropagation()}>
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-3 pt-3 pb-2 mb-1">添加新节点</div>
          <div className="flex flex-col gap-1">
<button onClick={() => onAddNode('masterScript')} className="flex items-center gap-3 px-3 py-2.5 rounded-[16px] text-[13px] font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors w-full text-left group">
  <div className="w-7 h-7 rounded-[10px] bg-[#050505] relative overflow-hidden border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.5)] flex items-center justify-center group-hover:border-white/[0.2] transition-all"><Type size={12} className="text-zinc-200" /></div>
  剧本中控台 (Script)
</button>
            <button onClick={() => onAddNode('media')} className="flex items-center gap-3 px-3 py-2.5 rounded-[16px] text-[13px] font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors w-full text-left group">
               <div className="w-7 h-7 rounded-[10px] bg-[#050505] relative overflow-hidden border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.5)] flex items-center justify-center group-hover:border-white/[0.2] transition-all"><ImageIconIcon size={12} className="text-zinc-200" /></div>
              图像节点
            </button>
            <button onClick={() => onAddNode('render')} className="flex items-center gap-3 px-3 py-2.5 rounded-[16px] text-[13px] font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors w-full text-left group">
               <div className="w-7 h-7 rounded-[10px] bg-[#050505] relative overflow-hidden border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.5)] flex items-center justify-center group-hover:border-white/[0.2] transition-all"><Film size={12} className="text-zinc-200" /></div>
              视频节点
            </button>
            
            <div className="h-px bg-white/[0.05] my-1 mx-2" />
            
            <button onClick={() => onAddNode('combine')} className="flex items-center gap-3 px-3 py-2.5 rounded-[16px] text-[13px] font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors w-full text-left group">
               <div className="w-7 h-7 rounded-[10px] bg-[#050505] relative overflow-hidden border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.5)] flex items-center justify-center group-hover:border-white/[0.2] transition-all"><Layers size={12} className="text-zinc-200" /></div>
              合成节点
            </button>
           </div>
        </div>
      )}
      </div>
      {/* ===== 左侧画布区域结束 ===== */}

      {/* ===== 右侧：创作助手侧边栏 ===== */}
      <div className={`h-full flex-shrink-0 transition-all duration-300 ease-in-out border-l border-white/[0.06] bg-[#08080a]/95 backdrop-blur-3xl flex flex-col ${copilotIsOpen ? 'w-[420px]' : 'w-0 overflow-hidden border-l-0'}`}>
        <CopilotPanel isOpen={copilotIsOpen} onClose={() => setCopilotIsOpen(false)} copilot={copilot} />
      </div>
    </div>
  );
}

export default function VideoCanvas({ imageHistory, videoHistory }: WorkspaceProps) {
    return (
      <ReactFlowProvider>
        <CanvasWorkspace imageHistory={imageHistory} videoHistory={videoHistory} />
      </ReactFlowProvider>
    );
}