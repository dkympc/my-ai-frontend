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
import { ArrowLeft, Plus, Type, Image as ImageIconIcon, Film, ZoomIn, ZoomOut, Maximize, Clapperboard, Layers, Check, Settings, X, Loader2, RotateCcw, Sliders } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { GENRE_PRESETS, TEMPO_PROFILES } from '@/lib/director-rules';
import AssetDock from './AssetDock'; 
import { ImageRecord, VideoRecord } from '@/lib/types'; 
import { fetchApi } from '@/services/api';
import { showConfirm } from '@/lib/dialogStore';

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
  const { activeCanvasProjectId, setActiveCanvasProjectId, canvasProjects, updateCanvasProject, canvasSettings, setCanvasSettings, isFilmControlOpen, setIsFilmControlOpen } = useAppStore();
  const currentProject = (canvasProjects || []).find((p: any) => p.id === activeCanvasProjectId);

  const [nodes, setNodes, onNodesChange] = useNodesState(currentProject?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(currentProject?.edges || []);
  
  // ✨ 核心修复 1：防止 React Flow 初始挂载时死锁，强制注入后端真实数据
  const hasLoadedDataRef = useRef(false);
  useEffect(() => {
    if (currentProject && !hasLoadedDataRef.current) {
      if (currentProject.nodes && currentProject.nodes.length > 0) {
        setNodes(currentProject.nodes);
        setEdges(currentProject.edges || []);
      }
      hasLoadedDataRef.current = true;
    }
  }, [currentProject, setNodes, setEdges]);

  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // ✨ 修改 menuPos 支持记录“来源节点”，用来自动连线
  const [menuPos, setMenuPos] = useState<{ x: number, y: number, screenX: number, screenY: number, sourceNodeId?: string } | null>(null);
  
  // ✨ 新增：拦截用户的“拖拽连线”动作
  const [connecting, setConnecting] = useState<{ nodeId: string | null } | null>(null);

  // 👇👇👇 新增下面这一行 👇👇👇
  // ✨ 新增：画布“时光机”快照，专门用于抢救误删的节点与连线
  const [deleteHistory, setDeleteHistory] = useState<{nodes: any[], edges: any[]}[]>([]);
  const [deletedNodes, setDeletedNodes] = useState<any[]>([]); // ✨ 新增：时空回收站软删除备份栈
  const [isRecyclerOpen, setIsRecyclerOpen] = useState(false); // ✨ 新增：时空回收站展开状态

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

  // ✨【中控容灾】自定义节点变更拦截器 (拦截误删 + 时空软删除)
  const customOnNodesChange = useCallback((changes: any[]) => {
    const removeChanges = changes.filter(c => c.type === 'remove');
    if (removeChanges.length > 0) {
      const hasCriticalNode = removeChanges.some(change => {
        const nodeToDelete = nodes.find(n => n.id === change.id);
        return nodeToDelete && (nodeToDelete.type === 'masterScript' || nodeToDelete.type === 'assetTable');
      });
      
      if (hasCriticalNode) {
        // ★ 异步弹窗（保持回调签名同步）
        // 弹窗期间画布被遮罩锁定，nodes/edges/onNodesChange 不会变化
        const capturedNodes = nodes;
        const capturedEdges = edges;
        const capturedOnNodesChange = onNodesChange;
        showConfirm("⚠️ 主中控/资产表为分镜核心", "您确定要删除吗?", "danger").then((confirmed) => {
          if (!confirmed) return;
          // 用户确认后才执行删除 + 时空回收站捕获
          const newDeletedRecords: any[] = [];
          removeChanges.forEach(change => {
            const nodeToDelete = capturedNodes.find(n => n.id === change.id);
            if (nodeToDelete) {
              const connectedEdges = capturedEdges.filter(e => e.source === nodeToDelete.id || e.target === nodeToDelete.id);
              newDeletedRecords.push({
                id: nodeToDelete.id,
                node: nodeToDelete,
                edges: connectedEdges,
                deletedAt: Date.now()
              });
            }
          });
          if (newDeletedRecords.length > 0) {
            setDeletedNodes(prev => [...newDeletedRecords, ...prev]);
            setDeleteHistory(prev => [...prev, { nodes: capturedNodes, edges: capturedEdges }]);
          }
          capturedOnNodesChange(changes);
        });
        return; // 异步路径，不同步处理
      }
      
      // 非关键节点：同步捕获进时空回收站
      const newDeletedRecords: any[] = [];
      removeChanges.forEach(change => {
        const nodeToDelete = nodes.find(n => n.id === change.id);
        if (nodeToDelete) {
          const connectedEdges = edges.filter(e => e.source === nodeToDelete.id || e.target === nodeToDelete.id);
          newDeletedRecords.push({
            id: nodeToDelete.id,
            node: nodeToDelete,
            edges: connectedEdges,
            deletedAt: Date.now()
          });
        }
      });
      
      if (newDeletedRecords.length > 0) {
        setDeletedNodes(prev => [...newDeletedRecords, ...prev]);
        setDeleteHistory(prev => [...prev, { nodes, edges }]);
      }
    }
    
    onNodesChange(changes);
  }, [nodes, edges, onNodesChange]);

  // ✨【中控容灾】从时空裂隙中完美恢复节点与其物理连线和各种状态
  const handleRestoreNode = useCallback((recordId: string) => {
    const record = deletedNodes.find(r => r.id === recordId);
    if (!record) return;
    
    // 1. 将节点放回 nodes (防止因某种情况发生重复添加)
    setNodes(nds => {
      if (nds.some(n => n.id === record.node.id)) return nds;
      return [...nds, record.node];
    });
    
    // 2. 将连线放回 edges (只要连线的另一端在画布中，就原汁原味重连)
    setEdges(eds => {
      const restoredEdges = record.edges.filter(edge => {
        const sourceExists = getNodes().some(n => n.id === edge.source) || edge.source === record.node.id;
        const targetExists = getNodes().some(n => n.id === edge.target) || edge.target === record.node.id;
        return sourceExists && targetExists && !eds.some(e => e.id === edge.id);
      });
      return [...eds, ...restoredEdges];
    });
    
    // 3. 从时空碎片列表清除
    setDeletedNodes(prev => prev.filter(r => r.id !== recordId));
    
    const nodeTypeLabel = 
      record.node.type === 'masterScript' ? '主剧本中控台' :
      record.node.type === 'assetTable' ? '数据资产表' :
      record.node.type === 'shot' ? `🎬 分镜 ${record.node.data?.shotNumber || ''}` : '卡片节点';
    
    useAppStore.getState().setToastMsg(`✅ 【${nodeTypeLabel}】已从时空裂隙中完美复活！`);
  }, [deletedNodes, setNodes, setEdges, getNodes]);

  // ✨【中控容灾】清空时空碎片
  const handleClearRecycler = useCallback(() => {
    setDeletedNodes([]);
    setIsRecyclerOpen(false);
    useAppStore.getState().setToastMsg("🧹 时空裂隙已彻底净化清空。");
  }, []);

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
        // 👇👇👇 这是为你全新加进去的 Ctrl+Z 撤销防误删逻辑
        // =====================================
        if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
           e.preventDefault(); // 🛑 核心护盾：坚决拦截浏览器的默认撤销，防止它把你旁边文本框的剧本清空！
           
           if (deleteHistory.length > 0) {
               // 1. 取出最后一张快照
               const lastSnapshot = deleteHistory[deleteHistory.length - 1]; 
               // 2. 瞬间恢复卡片和连线
               setNodes(lastSnapshot.nodes); 
               setEdges(lastSnapshot.edges); 
               // 3. 撕掉用过的快照
               setDeleteHistory(prev => prev.slice(0, -1)); 
               useAppStore.getState().setToastMsg("↩️ 撤销成功，误删节点已复活！");
           } else {
               useAppStore.getState().setToastMsg("当前没有可撤销的误删操作");
           }
        }

      };
  
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
      
    }, [clipboard, getNodes, getEdges, setNodes, setEdges, deleteHistory]);

    useEffect(() => {
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
    }, [nodes, setEdges]);

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
               
               const newLocalAssets = [...(currentProject?.localAssets || []), asset];
               if (typeof updateCanvasProject === 'function' && activeCanvasProjectId) {
                   updateCanvasProject(activeCanvasProjectId, { localAssets: newLocalAssets });
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

  return (
    <div 
      ref={wrapperRef} 
      className="w-full h-full relative bg-[#020203] animate-in fade-in duration-500 overflow-hidden" 
      style={{ cursor: glassCursor }} 
      onDragOver={onDragOver} 
      onDrop={onDrop} 
      onClick={handleCanvasClick}
    >
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
            {/* 0. 导演引擎：题材 + 节奏选择 */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest pl-1">
                导演引擎 (Director Engine)
              </label>
              <select
                className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/50 rounded-[14px] p-2.5 text-[12px] text-zinc-300 outline-none nodrag cursor-pointer transition-colors font-mono"
                value={canvasSettings?.directorGenre || 'default'}
                onChange={(e) => setCanvasSettings({ ...canvasSettings, directorGenre: e.target.value })}
              >
                {GENRE_PRESETS.map(g => (
                  <option key={g.key} value={g.key}>{g.label}</option>
                ))}
              </select>
              <select
                className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/50 rounded-[14px] p-2.5 text-[12px] text-zinc-300 outline-none nodrag cursor-pointer transition-colors font-mono"
                value={canvasSettings?.directorTempo || ''}
                onChange={(e) => setCanvasSettings({ ...canvasSettings, directorTempo: e.target.value })}
              >
                <option value="">跟随题材默认节奏</option>
                {TEMPO_PROFILES.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
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
                  // 🚀 比例穿透：将 globalRatio 穿透到所有 ShotNode 的 globalRatioOverride 字段
                  const currentRatio = canvasSettings?.globalRatio || '16:9';
                  setNodes(nds => nds.map(node => {
                    if (node.type === 'shot') {
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          globalRatioOverride: currentRatio
                        }
                      };
                    }
                    return node;
                  }));
                  useAppStore.getState().setToastMsg(`⚡ 已将全局比例 [${currentRatio}] 一键穿透覆盖到所有分镜！`);
                }}
                className="w-full py-3 rounded-[16px] border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-[12px] font-bold tracking-widest transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
              >
                <span>⚡ 全局比例穿透覆盖</span>
              </button>
            </div>

            <div className="w-full h-px bg-white/[0.05]" />

            {/* 2. 后缀智能追加 */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest pl-1">
                全局提示词后缀 (Prompt Suffix)
              </label>
              <textarea
                className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/50 hover:bg-white/[0.01] rounded-[16px] p-3 text-[12px] text-zinc-300 outline-none w-full font-mono transition-colors nodrag nopan resize-none custom-scrollbar min-h-[90px] shadow-inner"
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
                className="w-full py-3 rounded-[16px] bg-indigo-500 hover:bg-indigo-400 text-white text-[12px] font-bold tracking-widest transition-all active:scale-[0.98] shadow-[0_10px_25px_rgba(99,102,241,0.3)] flex items-center justify-center gap-2"
              >
                <span>✨ 智能追加至所有分镜</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
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
              ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' 
              : 'bg-black/60 border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/20'
          }`}
        >
          <Sliders size={14} className={isFilmControlOpen ? 'text-indigo-400 animate-spin-slow' : 'text-zinc-500'} />
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
      {/* 右上角：全局配置齿轮 */}
      <div className="absolute top-6 right-[100px] z-50">
        <button 
          onClick={() => setIsCanvasSettingsOpen(true)} 
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-3xl border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:scale-105 hover:rotate-90 duration-500"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* 资产库组件 */}
      <AssetDock 
        imageHistory={imageHistory} 
        videoHistory={videoHistory} 
        localAssets={currentProject?.localAssets || []} 
      />

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
                        { id: 'seedream5.0', label: 'Seedream 5.0' }
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
                           className={`flex flex-col items-center justify-center p-3 rounded-[16px] border transition-all duration-300 ${canvasSettings?.globalPromptSuffix === style.id ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'bg-black/50 border-white/[0.05] text-zinc-500 hover:bg-white/5 hover:text-zinc-300 hover:border-white/10'}`}
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

      {/* ✨ 右下角：时空回收站 (Space Recycler) 悬浮舱 */}
      <div className="absolute bottom-24 right-6 z-50 flex flex-col items-end gap-3">
        {/* 回收站展开面板 */}
        {isRecyclerOpen && (
          <div className="w-[280px] max-h-[360px] flex flex-col bg-[#050507]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[24px] shadow-[0_30px_80px_rgba(0,0,0,0.95),inset_0_1px_1px_rgba(255,255,255,0.08)] overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300" onClick={e => e.stopPropagation()}>
            {/* 面板顶栏 */}
            <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.01]">
              <span className="text-[10px] font-extrabold text-zinc-300 tracking-[0.2em] flex items-center gap-1.5 uppercase">
                <RotateCcw size={12} className="text-zinc-400" />
                时空回收站 ({deletedNodes.length})
              </span>
              <button onClick={() => setIsRecyclerOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
            
            {/* 面板内容列表 */}
            <div className="flex-1 p-3 overflow-y-auto custom-scrollbar flex flex-col gap-2 min-h-[120px]">
              {deletedNodes.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-zinc-600 text-[11px] font-light">
                  <RotateCcw size={20} className="mb-2 text-zinc-700 opacity-50" />
                  时空裂隙中暂无残留碎片
                </div>
              ) : (
                deletedNodes.map((record) => {
                  const nodeTypeLabel = 
                    record.node.type === 'masterScript' ? '📝 中控台' :
                    record.node.type === 'assetTable' ? '📊 资产表' :
                    record.node.type === 'shot' ? `🎬 分镜 ${record.node.data?.shotNumber || ''}` :
                    record.node.type === 'media' ? '🖼️ 图像' :
                    record.node.type === 'render' ? '🎞️ 视频' : '📦 节点';
                  
                  return (
                    <div key={record.id} className="flex items-center justify-between p-2.5 rounded-[12px] bg-black/40 border border-white/[0.03] hover:border-white/[0.1] transition-all group/item shadow-inner">
                      <div className="flex flex-col gap-0.5 overflow-hidden pr-2">
                        <span className="text-[11px] font-bold text-zinc-200 truncate">{nodeTypeLabel}</span>
                        <span className="text-[9px] text-zinc-600 font-mono">
                          {new Date(record.deletedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      
                      <button 
                        onClick={() => handleRestoreNode(record.id)}
                        className="px-2.5 py-1.5 rounded-[8px] border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.1] text-zinc-300 hover:text-white text-[10px] font-bold tracking-widest transition-all active:scale-95 shrink-0 nodrag"
                      >
                        还原
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            
            {/* 清空回收站按钮 */}
            {deletedNodes.length > 0 && (
              <div className="p-2 border-t border-white/[0.05] bg-white/[0.01]">
                <button 
                  onClick={handleClearRecycler}
                  className="w-full py-1.5 rounded-[10px] hover:bg-red-500/10 hover:text-red-400 text-zinc-500 text-[10px] font-medium tracking-widest transition-all nodrag"
                >
                  清空全部时空碎片
                </button>
              </div>
            )}
          </div>
        )}

        {/* 悬浮圆形气泡按钮 */}
        <button 
          onClick={() => setIsRecyclerOpen(!isRecyclerOpen)}
          className={`w-10 h-10 rounded-full backdrop-blur-3xl border shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex items-center justify-center transition-all duration-300 relative group/btn hover:scale-105 active:scale-95 ${
            isRecyclerOpen 
              ? 'bg-white/20 border-white/30 text-white' 
              : 'bg-black/60 border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/20'
          }`}
          onClickCapture={e => e.stopPropagation()}
        >
          <RotateCcw size={16} className={`transition-transform duration-500 ${isRecyclerOpen ? 'rotate-180' : 'group-hover/btn:rotate-45'}`} />
          {/* 未读数字标记 */}
          {deletedNodes.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-white text-black font-mono text-[9px] font-extrabold flex items-center justify-center shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-bounce">
              {deletedNodes.length}
            </span>
          )}
        </button>
      </div>

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
  );
}

export default function VideoCanvas({ imageHistory, videoHistory }: WorkspaceProps) {
    return (
      <ReactFlowProvider>
        <CanvasWorkspace imageHistory={imageHistory} videoHistory={videoHistory} />
      </ReactFlowProvider>
    );
}