'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Handle, Position, useReactFlow, useEdges, useNodes } from '@xyflow/react';
import { createPortal } from 'react-dom';
import { Clapperboard, Camera, Upload, Link2, CheckCircle2, Globe, Monitor } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/useAppStore';
import type { DirectorStageCharacter, DirectorStageCameraPreset } from '@/lib/types';

const DirectorStageEditor = dynamic(() => import('./DirectorStageEditor'), { ssr: false });

type PanoramaMode = '360' | '720' | 'flat';

const nodeBaseClass = "relative rounded-[24px] bg-[#18181b]/80 backdrop-blur-3xl shadow-[0_10px_40px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300";
const selectedBorderClass = "border border-white/30 shadow-[0_0_40px_rgba(255,255,255,0.05),0_10px_40px_rgba(0,0,0,0.8)]";
const unselectedBorderClass = "border border-white/[0.08] hover:border-white/20";
const handleBase = "!w-[24px] !h-[24px] !bg-transparent !border-none !rounded-full opacity-0 group-hover:opacity-100 z-50 flex items-center justify-center relative before:absolute before:content-[''] before:w-[12px] before:h-[12px] before:bg-white before:rounded-full before:border-[3px] before:border-[#18181b] before:shadow-[0_0_15px_rgba(255,255,255,0.9)] before:transition-all hover:before:scale-125 transition-opacity duration-300";
const handleLeft = `${handleBase} !-left-[12px]`;
const handleRight = `${handleBase} !-right-[12px]`;

interface DirectorStageNodeProps {
  id: string;
  data: {
    backgroundUrl?: string; panoramaMode?: PanoramaMode;
    characters?: DirectorStageCharacter[]; cameraPresets?: DirectorStageCameraPreset[];
    activePresetId?: string; prompt?: string; status?: 'draft' | 'ready';
  };
  selected?: boolean;
}

const _DirectorStageNode = ({ id, data, selected }: DirectorStageNodeProps) => {
  const { setNodes } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [panoramaMode, setPanoramaMode] = useState<PanoramaMode>(data.panoramaMode || '360');
  // ★ 编辑器内部的实时角色数据引用
  const liveCharsRef = useRef<DirectorStageCharacter[]>(data.characters || []);

  const edgeBackgroundUrl = useMemo(() => {
    const incomingEdge = edges.find(e => e.target === id);
    if (!incomingEdge) return null;
    const srcNode = nodes.find(n => n.id === incomingEdge.source);
    return srcNode?.data?.resultUrl || srcNode?.data?.frameUrl || null;
  }, [edges, nodes, id]);

  const backgroundUrl = edgeBackgroundUrl || data.backgroundUrl || '';
  const hasBackground = !!backgroundUrl;
  const chars = data.characters || [];
  const presets = data.cameraPresets || [];

  // ★ 使用函数式 setNodes 避免闭包陈旧数据
  const syncNodeData = useCallback((updates: Record<string, any>) => {
    setNodes((nds: any) => nds.map((n: any) => n.id === id ? { ...n, data: { ...n.data, ...updates } } : n));
  }, [id, setNodes]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { useAppStore.getState().setToastMsg('⚠️ 仅支持上传图片文件'); return; }
    const reader = new FileReader();
    reader.onload = () => { syncNodeData({ backgroundUrl: reader.result, panoramaMode }); useAppStore.getState().setToastMsg('✅ 场景背景图已上传'); };
    reader.onerror = () => useAppStore.getState().setToastMsg('❌ 图片读取失败');
    reader.readAsDataURL(file); e.target.value = '';
  }, [panoramaMode, syncNodeData]);

  // ★ 截图 → 创建新 MediaNode
  const handleCapture = useCallback((dataUrl: string) => {
    setNodes((nds: any) => {
      const thisNode = nds.find((n: any) => n.id === id);
      if (!thisNode) return nds;
      const captureNode = {
        id: `ds_capture_${Date.now()}`,
        type: 'media',
        position: { x: thisNode.position.x + 380, y: thisNode.position.y },
        data: { resultUrl: dataUrl, prompt: `导演台截图`, ratio: '16:9', model: 'gpt-image-2', status: 'done' },
      };
      return [...nds, captureNode];
    });
    useAppStore.getState().setToastMsg('📸 截图已创建为新图片节点！');
  }, [id, setNodes]);

  const handleModeChange = useCallback((mode: PanoramaMode) => {
    setPanoramaMode(mode); syncNodeData({ panoramaMode: mode });
  }, [syncNodeData]);

  const handleCharactersChange = useCallback((newChars: DirectorStageCharacter[]) => {
    liveCharsRef.current = newChars;
    syncNodeData({ characters: newChars });
  }, [syncNodeData]);

  const handleCameraPresetsChange = useCallback((newPresets: DirectorStageCameraPreset[]) => {
    syncNodeData({ cameraPresets: newPresets });
  }, [syncNodeData]);

  // ★ 关闭编辑器前同步最新角色数据
  const handleClose = useCallback(() => {
    syncNodeData({ characters: liveCharsRef.current });
    setShowEditor(false);
  }, [syncNodeData]);

  const charCount = chars.length;

  return (
    <div className="relative z-20 group">
      <Handle type="target" position={Position.Left} id="left" className={handleLeft} />
      <Handle type="source" position={Position.Right} id="right" className={handleRight} />

      <div style={{ width: '340px' }} className={`${nodeBaseClass} ${selected ? selectedBorderClass : unselectedBorderClass} flex flex-col p-4`}>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06]">
          <Clapperboard size={14} className="text-violet-400" />
          <span className="text-[11px] font-bold text-white tracking-widest uppercase">导演台</span>
          <div className="ml-auto flex items-center gap-1.5">
            {charCount > 0 && <span className="text-[9px] text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded-full">{charCount} 角色</span>}
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-zinc-500 font-medium">场景背景</span>
            <div className="flex-1" />
            <div className="flex items-center gap-0.5 bg-[#0a0a0c]/60 border border-white/[0.06] rounded-[8px] p-0.5">
              {(['360', '720', 'flat'] as PanoramaMode[]).map((mode) => (
                <button key={mode} onClick={() => handleModeChange(mode)} disabled={mode === '720'}
                  title={mode === '720' ? '720° 球体模式即将推出' : mode === '360' ? '360°圆柱全景' : '平面背景'}
                  className={`flex items-center gap-1 px-2 py-1 rounded-[6px] text-[9px] font-medium transition-all ${panoramaMode === mode ? 'bg-violet-500/20 text-violet-300' : 'text-zinc-600 hover:text-zinc-400'} ${mode === '720' ? 'opacity-30 cursor-not-allowed' : ''}`}>
                  {mode === '360' ? <Globe size={10} /> : mode === '720' ? <Globe size={10} /> : <Monitor size={10} />}
                  {mode === '360' ? '360°' : mode === '720' ? '720°' : '平面'}
                </button>
              ))}
            </div>
          </div>

          {hasBackground ? (
            <div className="relative rounded-[12px] overflow-hidden border border-white/[0.08] bg-[#020204] aspect-video mb-2">
              <img src={backgroundUrl} alt="场景背景" className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 flex items-center gap-1">
                {edgeBackgroundUrl
                  ? <span className="bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/30 text-emerald-400 text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1"><Link2 size={9} /> 连线传入</span>
                  : <span className="bg-violet-500/20 backdrop-blur-sm border border-violet-500/30 text-violet-400 text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1"><Upload size={9} /> 已上传</span>}
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="absolute top-2 right-2 bg-[#0a0a0c]/80 backdrop-blur-md border border-white/[0.08] text-zinc-400 hover:text-white text-[9px] px-2 py-1 rounded-full transition-all">更换</button>
            </div>
          ) : (
            <div onClick={() => fileInputRef.current?.click()} className="rounded-[12px] border-2 border-dashed border-white/[0.08] hover:border-violet-500/30 bg-[#0a0a0c]/40 aspect-video mb-2 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group/upload">
              <Upload size={20} className="text-zinc-600 group-hover/upload:text-violet-400 transition-colors" />
              <span className="text-[10px] text-zinc-600 group-hover/upload:text-zinc-400 transition-colors">点击上传场景图</span>
              <span className="text-[9px] text-zinc-700">或从其他节点连线传入</span>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          <div className="flex items-center gap-1.5 text-[9px]">
            {edgeBackgroundUrl
              ? <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 size={10} /> 已通过连线接收场景图</span>
              : <span className="text-zinc-600 flex items-center gap-1"><Link2 size={10} /> 左侧接口：连线其他节点传入场景图</span>}
          </div>
        </div>

        {charCount > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {chars.map((c) => (
              <div key={c.id} className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-medium"
                style={{ backgroundColor: c.color + '20', color: c.color, border: `1px solid ${c.color}30` }}>
                {c.type === 'male' ? '♂' : '♀'}{c.pose === 'stand' ? '站' : c.pose === 'walk' ? '行' : '坐'}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => setShowEditor(true)} disabled={!hasBackground}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[12px] bg-violet-500/10 backdrop-blur-sm border border-violet-500/20 text-violet-400 text-[12px] font-bold hover:bg-violet-500/20 hover:border-violet-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title={!hasBackground ? '请先上传场景图或连线传入场景图' : ''}><Clapperboard size={13} /> 打开导演台</button>
        </div>
      </div>

      {showEditor && createPortal(
        <DirectorStageEditor
          backgroundUrl={backgroundUrl} panoramaMode={panoramaMode}
          characters={chars} cameraPresets={presets}
          activePresetId={data.activePresetId}
          onCapture={handleCapture}
          onCharactersChange={handleCharactersChange}
          onCameraPresetsChange={handleCameraPresetsChange}
          onClose={handleClose}
        />,
        document.body
      )}
    </div>
  );
};

export const DirectorStageNode = React.memo(_DirectorStageNode);
