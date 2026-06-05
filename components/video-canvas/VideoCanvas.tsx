"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
    ReactFlow, 
    Background, 
    Controls,
    useNodesState, 
    useEdgesState, 
    ReactFlowProvider,
    BackgroundVariant,
    useReactFlow,
    addEdge,
    useViewport,
    type Connection 
  } from '@xyflow/react';
import '@xyflow/react/dist/style.css'; 
import { ArrowLeft, Plus, Type, Image as ImageIconIcon, Film, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import AssetDock from './AssetDock'; 
import { ImageRecord, VideoRecord } from '@/lib/types'; 
import { MediaNode, TextNode, RenderNode } from './CustomNodes';

interface WorkspaceProps {
    imageHistory: ImageRecord[];
    videoHistory: VideoRecord[];
}
  
const nodeTypes = { media: MediaNode, text: TextNode, render: RenderNode };

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
  const { activeCanvasProjectId, setActiveCanvasProjectId, canvasProjects, updateCanvasProject } = useAppStore();
  // ✨ 增加防空保护：即使因为缓存导致 canvasProjects 为 undefined，也会默认 fallback 为空数组
  const currentProject = (canvasProjects || []).find((p: any) => p.id === activeCanvasProjectId);

  const [nodes, setNodes, onNodesChange] = useNodesState(currentProject?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(currentProject?.edges || []);
  
  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ x: number, y: number, screenX: number, screenY: number } | null>(null);

  // ✨ 加上防御判断：只有全局大脑准备好了这个方法才调用，否则不调用。这能瞬间阻止页面崩溃！
  useEffect(() => {
    if (activeCanvasProjectId && typeof updateCanvasProject === 'function') {
      updateCanvasProject(activeCanvasProjectId, { nodes, edges });
    }
  }, [nodes, edges, activeCanvasProjectId, updateCanvasProject]);

  // ✨ 修复 4：恢复金黄色的动态流光连线
  useEffect(() => {
    setEdges((eds) => {
      let changed = false;
      const newEdges = eds.map((edge) => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        const isSelected = sourceNode?.selected || targetNode?.selected || edge.selected;
        if (edge.animated !== isSelected) changed = true;
        
        return {
          ...edge,
          animated: isSelected,
          style: {
            // 未选中为极弱白光，选中为刺眼的金光
            stroke: isSelected ? 'rgba(253, 230, 138, 0.9)' : 'rgba(255, 255, 255, 0.1)',
            strokeWidth: isSelected ? 2.5 : 1.5,
            filter: isSelected ? 'drop-shadow(0 0 10px rgba(253, 230, 138, 0.6))' : 'none'
          }
        };
      });
      return changed ? newEdges : eds; 
    });
  }, [nodes, setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault(); event.dataTransfer.dropEffect = 'move';
  }, []);

  // ✨ 修复 3：恢复从外部电脑直接拉文件进画板的神级功能
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

    // 1. 处理画板底部的素材传送带拖入
    const assetStr = event.dataTransfer.getData('application/yr-canvas-asset');
    if (assetStr) {
      try {
        const asset = JSON.parse(assetStr);
        const newNode = { 
          id: `node_${Date.now()}`, type: asset._type === 'video' ? 'render' : 'media', position, 
          data: { asset, ratio: '16:9', model: asset._type === 'video' ? 'doubao-seedance-2-0' : 'gpt-image-2', prompt: asset.prompt || '' } 
        };
        setNodes((nds) => [...nds, newNode]);
        return;
      } catch (e) {}
    }

    // 2. 处理直接从电脑桌面拖入的文件
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      const isVideo = file.type.startsWith('video');
      const isImage = file.type.startsWith('image');
      
      if (isVideo || isImage) {
        const fileUrl = URL.createObjectURL(file); 
        const asset = {
          id: `local_${Date.now()}`, _type: isVideo ? 'video' : 'image', url: fileUrl, prompt: file.name
        };
        const newNode = { 
          id: `node_${Date.now()}`, type: isVideo ? 'render' : 'media', position, 
          data: { asset, ratio: '16:9', model: isVideo ? 'doubao-seedance-2-0' : 'gpt-image-2', prompt: file.name } 
        };
        setNodes((nds) => [...nds, newNode]);
      }
    }
  }, [screenToFlowPosition, setNodes]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, animated: false, style: { stroke: 'rgba(255, 255, 255, 0.1)', strokeWidth: 1.5 } }, eds));
  }, [setEdges]);

  const triggerMenu = useCallback((clientX: number, clientY: number) => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setMenuPos({ x: clientX - rect.left, y: clientY - rect.top, screenX: clientX, screenY: clientY });
  }, []);
  
  const onPaneDoubleClick = useCallback((event: React.MouseEvent) => { event.preventDefault(); triggerMenu(event.clientX, event.clientY); }, [triggerMenu]);
  const onPaneContextMenu = useCallback((event: React.MouseEvent) => { event.preventDefault(); triggerMenu(event.clientX, event.clientY); }, [triggerMenu]);

  const onAddNode = (type: string) => {
    if (!menuPos) return;
    const position = screenToFlowPosition({ x: menuPos.screenX, y: menuPos.screenY });
    const newNode = {
      id: `node_${Date.now()}`, type, position,
      data: type === 'text' 
        ? { text: '', model: 'gemini-3.1-pro-preview' } 
        : { asset: null, prompt: '', ratio: '16:9', model: type === 'media' ? 'gpt-image-2' : 'doubao-seedance-2-0' }, 
    };
    setNodes((nds) => [...nds, newNode]);
    setMenuPos(null);
  };

  return (
    <div ref={wrapperRef} className="w-full h-full relative bg-[#020203] animate-in fade-in duration-500 overflow-hidden" onDragOver={onDragOver} onDrop={onDrop} onClick={() => setMenuPos(null)}>
      <ReactFlow
        nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} 
        nodeTypes={nodeTypes} onPaneDoubleClick={onPaneDoubleClick} onPaneContextMenu={onPaneContextMenu} onPaneClick={() => setMenuPos(null)}
        zoomOnDoubleClick={false} minZoom={0.05} maxZoom={15} proOptions={{ hideAttribution: true }} 
      >
        <Background color="rgba(255, 255, 255, 0.15)" variant={BackgroundVariant.Dots} gap={24} size={1.5} />
        <Controls showInteractive={false} showZoom={false} showFitView={false} className="hidden" />
        <ZoomPanel />
      </ReactFlow>

      <div className="absolute top-6 left-6 z-50 flex items-center gap-3">
        <button onClick={() => setActiveCanvasProjectId(null)} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-2xl border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          <ArrowLeft size={18} />
        </button>
        <div 
          className="px-5 py-2.5 rounded-full bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center gap-3 group cursor-text"
          onDoubleClick={(e) => {
             const newTitle = window.prompt("为你的杰作命名：", currentProject?.title);
             if (newTitle) updateCanvasProject(activeCanvasProjectId as string, { title: newTitle });
          }}
          title="双击重命名"
        >
          <span className="text-[13px] font-bold text-zinc-200 tracking-wider">
             {currentProject?.title || "未命名创想宇宙"}
          </span>
        </div>
      </div>

      <AssetDock imageHistory={imageHistory} videoHistory={videoHistory} />

      {menuPos && (
        <div className="absolute z-[1000] w-[200px] bg-[#0a0a0a]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[24px] shadow-[0_30px_60px_rgba(0,0,0,0.9)] p-2 animate-in fade-in zoom-in-95 duration-100" style={{ top: menuPos.y, left: menuPos.x }} onClick={(e) => e.stopPropagation()}>
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-3 pt-3 pb-2 mb-1">添加新节点</div>
          <div className="flex flex-col gap-1">
            <button onClick={() => onAddNode('text')} className="flex items-center gap-3 px-3 py-2.5 rounded-[16px] text-[13px] font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors w-full text-left group">
              <div className="w-7 h-7 rounded-[10px] bg-[#050505] relative overflow-hidden border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.5)] flex items-center justify-center group-hover:border-white/[0.2] transition-all"><Type size={12} className="text-zinc-200" /></div>
              剧本 / 脚本
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
            <button onClick={() => { setMenuPos(null); alert('请直接将文件从桌面拖入画板中'); }} className="flex items-center gap-3 px-3 py-2.5 rounded-[16px] text-[13px] font-medium text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors w-full text-left group">
               <div className="w-7 h-7 rounded-[10px] bg-transparent border border-white/5 flex items-center justify-center group-hover:border-white/[0.15] transition-all"><Plus size={12} className="text-zinc-400" /></div>
              上传素材
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