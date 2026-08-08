'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { TransformControls as TransformControlsImpl } from 'three-stdlib';
import { Loader2, Camera, X, Trash2, UserRound, User, Save, Check, Move3d, Rotate3d, ZoomIn } from 'lucide-react';

const PRESET_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#95a5a6', '#ecf0f1', '#2c3e50', '#e91e63', '#00bcd4'];
const POSE_LABELS: Record<string, string> = { stand: '站立', walk: '行走', sit: '坐下' };

import type { DirectorStageCharacter, DirectorStageCameraPreset } from '@/lib/types';
type PanoramaMode = '360' | '720' | 'flat';

interface DirectorStageEditorProps {
  backgroundUrl?: string; panoramaMode: PanoramaMode;
  characters?: DirectorStageCharacter[]; cameraPresets?: DirectorStageCameraPreset[];
  activePresetId?: string;
  onCapture: (dataUrl: string) => void;
  onCharactersChange: (chars: DirectorStageCharacter[]) => void;
  onCameraPresetsChange: (presets: DirectorStageCameraPreset[]) => void;
  onClose: () => void;
}

// ==========================================
// ★ 人形人偶 — 自然站立，双面色区分正反
// 面向 +Z（正面有鼻子+亮色胸牌），背面暗色
// ==========================================
function Humanoid({ gender, color, pose }: { gender: string; color: string; pose: string }) {
  const bodyColor = new THREE.Color(color || '#3498db');
  const skinColor = new THREE.Color('#f5d0b0');
  const darkColor = bodyColor.clone().multiplyScalar(0.45);
  const isMale = gender === 'male';
  const hdR = isMale ? 0.13 : 0.11;
  const bodyR = isMale ? 0.16 : 0.13;
  const limbR = isMale ? 0.055 : 0.045;
  const legR = isMale ? 0.075 : 0.065;

  // ★ 姿势数据 — 默认自然站立，手臂贴身体自然下垂
  const p = useMemo(() => {
    switch (pose) {
      case 'walk': return { hipY: 0.75, shoulderY: 1.2, headY: 1.6, neckY: 1.4,
        la: [0.2, 0, -0.3], ra: [0.2, 0, 0.3], ll: [-0.35, 0, 0], rl: [0.35, 0, 0], armLen: 0.42, legLen: 0.65 };
      case 'sit': return { hipY: 0.5, shoulderY: 0.85, headY: 1.2, neckY: 1.02,
        la: [0.1, 0, 0], ra: [0.1, 0, 0], ll: [Math.PI / 2, 0, 0], rl: [Math.PI / 2, 0, 0], armLen: 0.42, legLen: 0.55 };
      // ★ 自然站立：手臂下垂，略向前微弯
      default: return { hipY: 0.75, shoulderY: 1.2, headY: 1.6, neckY: 1.4,
        la: [0.12, 0, -0.08], ra: [0.12, 0, 0.08], ll: [0, 0, 0], rl: [0, 0, 0], armLen: 0.42, legLen: 0.65 };
    }
  }, [pose]);

  const bodyLen = p.shoulderY - p.hipY;
  const bodyMidY = (p.hipY + p.shoulderY) / 2;
  const neckTop = p.headY - hdR * 0.6;
  const neckBot = p.shoulderY + 0.08;
  const neckLen = neckTop - neckBot;
  const neckMidY = (neckTop + neckBot) / 2;

  return (
    <group>
      {/* 头部 */}
      <mesh position={[0, p.headY, 0]} castShadow>
        <sphereGeometry args={[hdR, 16, 16]} /><meshStandardMaterial color={skinColor} roughness={0.6} metalness={0.02} />
      </mesh>
      {/* ★ 鼻子 — 正面标识 */}
      <mesh position={[0, p.headY, hdR * 0.9]}><coneGeometry args={[hdR * 0.22, hdR * 0.35, 6]} /><meshStandardMaterial color={skinColor.clone().multiplyScalar(0.85)} roughness={0.6} /></mesh>
      {/* 耳朵 */}
      <mesh position={[hdR * 0.85, p.headY, 0]}><sphereGeometry args={[hdR * 0.25, 8, 8]} /><meshStandardMaterial color={skinColor} roughness={0.6} /></mesh>
      <mesh position={[-hdR * 0.85, p.headY, 0]}><sphereGeometry args={[hdR * 0.25, 8, 8]} /><meshStandardMaterial color={skinColor} roughness={0.6} /></mesh>

      {/* 脖子 */}
      <mesh position={[0, neckMidY, 0]} castShadow><capsuleGeometry args={[hdR * 0.35, neckLen, 6, 4]} /><meshStandardMaterial color={skinColor} roughness={0.6} /></mesh>

      {/* ★ 躯干 — 单胶囊 */}
      <mesh position={[0, bodyMidY, 0]} castShadow><capsuleGeometry args={[bodyR, bodyLen, 8, 8]} /><meshStandardMaterial color={darkColor} roughness={0.4} metalness={0.05} /></mesh>

      {/* ★ 正面胸牌 — 亮色，标识前方（+Z方向） */}
      <mesh position={[0, bodyMidY, bodyR * 0.88]}><planeGeometry args={[bodyR * 1.4, bodyLen * 0.65]} /><meshBasicMaterial color={bodyColor} side={THREE.DoubleSide} /></mesh>

      {/* 左臂 — 自然下垂，沿躯干侧面向下 */}
      <group position={[-bodyR - 0.01, p.shoulderY - 0.06, 0]} rotation={p.la as any}>
        <mesh position={[0, -p.armLen / 2, 0]} castShadow><capsuleGeometry args={[limbR, p.armLen, 8, 8]} /><meshStandardMaterial color={darkColor} roughness={0.4} /></mesh>
      </group>
      {/* 右臂 */}
      <group position={[bodyR + 0.01, p.shoulderY - 0.06, 0]} rotation={p.ra as any}>
        <mesh position={[0, -p.armLen / 2, 0]} castShadow><capsuleGeometry args={[limbR, p.armLen, 8, 8]} /><meshStandardMaterial color={darkColor} roughness={0.4} /></mesh>
      </group>

      {/* 左腿 */}
      <group position={[-bodyR * 0.3, p.hipY, 0]} rotation={p.ll as any}>
        <mesh position={[0, -p.legLen / 2, 0]} castShadow><capsuleGeometry args={[legR, p.legLen, 8, 8]} /><meshStandardMaterial color={darkColor} roughness={0.4} /></mesh>
      </group>
      {/* 右腿 */}
      <group position={[bodyR * 0.3, p.hipY, 0]} rotation={p.rl as any}>
        <mesh position={[0, -p.legLen / 2, 0]} castShadow><capsuleGeometry args={[legR, p.legLen, 8, 8]} /><meshStandardMaterial color={darkColor} roughness={0.4} /></mesh>
      </group>
    </group>
  );
}

// ==========================================
// 场景背景（与之前相同）
// ==========================================
function Cylinder360Bg({ imageUrl, onReady }: { imageUrl: string; onReady: () => void }) {
  const [geo, setGeo] = useState<THREE.CylinderGeometry | null>(null);
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const { gl } = useThree();
  useEffect(() => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { const r = 60; const h = (2 * Math.PI * r) / (img.naturalWidth / img.naturalHeight); setGeo(new THREE.CylinderGeometry(r, r, h, 128, 1, true)); new THREE.TextureLoader().load(imageUrl, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = gl.capabilities.getMaxAnisotropy?.() || 16; setTex(t); onReady(); }, undefined, () => onReady()); };
    img.onerror = () => onReady(); img.src = imageUrl;
  }, [imageUrl]);
  if (!geo) return null;
  return (<><mesh geometry={geo}>{tex ? <meshBasicMaterial map={tex} side={THREE.BackSide} toneMapped={false} /> : <meshBasicMaterial color="#0a0a14" side={THREE.BackSide} />}</mesh><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -geo.parameters.height / 2 + 0.1, 0]}><circleGeometry args={[geo.parameters.radiusTop * 0.95, 64]} /><meshBasicMaterial color="#0a0a12" side={THREE.DoubleSide} /></mesh></>);
}
function Sphere720Bg({ imageUrl, onReady }: { imageUrl: string; onReady: () => void }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const { gl } = useThree();
  useEffect(() => { new THREE.TextureLoader().load(imageUrl, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = gl.capabilities.getMaxAnisotropy?.() || 16; setTex(t); onReady(); }, undefined, () => onReady()); }, [imageUrl]);
  if (!tex) return null; return <mesh><sphereGeometry args={[60, 128, 64]} /><meshBasicMaterial map={tex} side={THREE.BackSide} toneMapped={false} /></mesh>;
}
function FlatBg({ imageUrl, onReady }: { imageUrl: string; onReady: () => void }) {
  const { size, camera } = useThree(); const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => { new THREE.TextureLoader().load(imageUrl, (t) => { t.colorSpace = THREE.SRGBColorSpace; setTex(t); onReady(); }, undefined, () => onReady()); }, [imageUrl]);
  const ps = useMemo(() => { if (!tex || !(camera instanceof THREE.PerspectiveCamera)) return [10, 10, 1]; const a = tex.image.width / tex.image.height; const va = size.width / size.height; const d = Math.abs(camera.position.z - 0); const vh = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); if (a > va) return [vh * a, vh, 1]; return [vh * va, vh * va / a, 1]; }, [tex, size, camera]);
  if (!tex) return null; return <mesh position={[0, 0, 0]} scale={ps as any}><planeGeometry args={[1, 1]} /><meshBasicMaterial map={tex} toneMapped={false} depthWrite={false} /></mesh>;
}

// ==========================================
// ★ 人偶变换控件 — 绕过 drei，用原生 THREE.TransformControls
// drei 版本的 dragging-changed 回调会干扰 OrbitControls.enabled 导致人偶只能拖一次
// ==========================================
function GizmoControls({ object, mode, onDragEnd }: { object: THREE.Object3D; mode: 'translate' | 'rotate' | 'scale'; onDragEnd: () => void }) {
  const { camera, gl, scene, invalidate } = useThree();
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;

  useEffect(() => {
    const dom = gl.domElement;
    const ctrl = new TransformControlsImpl(camera, dom);
    ctrl.attach(object);
    ctrl.setMode(mode);
    ctrl.setSize(0.7);
    ctrl.addEventListener('change' as any, () => invalidate());
    ctrl.addEventListener('mouseUp' as any, () => onDragEndRef.current());
    scene.add(ctrl);

    return () => {
      ctrl.detach();
      scene.remove(ctrl);
      ctrl.dispose();
    };
  }, [object, mode]);

  return null;
}

// ==========================================
// 3D 场景内容
// ==========================================
function SceneContent({
  backgroundUrl, panoramaMode, characters, selectedCharId, onSelectChar, charRefsRef, onReady, fov, transformMode, onDragEnd,
}: {
  backgroundUrl?: string; panoramaMode: PanoramaMode; characters: DirectorStageCharacter[];
  selectedCharId: string | null; onSelectChar: (id: string | null) => void;
  charRefsRef: React.MutableRefObject<Map<string, THREE.Group>>;
  onReady: () => void; fov: number; transformMode: 'translate' | 'rotate' | 'scale';
  onDragEnd: () => void;
}) {
  const setCharRef = useCallback((id: string, ref: THREE.Group | null) => { if (ref) charRefsRef.current.set(id, ref); else charRefsRef.current.delete(id); }, [charRefsRef]);
  const hasSelection = !!selectedCharId;
  const isPanorama = panoramaMode === '360' || panoramaMode === '720';
  const isFlat = panoramaMode === 'flat';

  // ★ 用 ref 缓存选中的 Group，只在 selectedCharId 变化时更新
  // 防止 characters 状态更新导致 object 引用变化触发 GizmoControls 重建
  const selectedRefRef = useRef<THREE.Group | null>(null);
  const prevSelectedCharId = useRef<string | null>(null);
  if (selectedCharId !== prevSelectedCharId.current) {
    prevSelectedCharId.current = selectedCharId;
    selectedRefRef.current = selectedCharId ? charRefsRef.current.get(selectedCharId) ?? null : null;
  }

  return (<>
    {backgroundUrl && panoramaMode === '360' && <Cylinder360Bg imageUrl={backgroundUrl} onReady={onReady} />}
    {backgroundUrl && panoramaMode === '720' && <Sphere720Bg imageUrl={backgroundUrl} onReady={onReady} />}
    {backgroundUrl && panoramaMode === 'flat' && <FlatBg imageUrl={backgroundUrl} onReady={onReady} />}
    {!backgroundUrl && !isFlat && <gridHelper args={[30, 30, '#ffffff20', '#ffffff08']} position={[0, -1, 0]} />}
    <ambientLight intensity={0.7} />
    <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow shadow-mapSize={[1024, 1024]} />
    <directionalLight position={[-5, 3, -5]} intensity={0.3} />
    {characters.map((char) => (
      <group key={char.id} ref={(ref) => setCharRef(char.id, ref)} position={char.position} rotation={char.rotation} scale={char.scale}
        onClick={(e) => { e.stopPropagation(); onSelectChar(char.id); }}>
        <Humanoid gender={char.type} color={char.color} pose={char.pose} />
      </group>
    ))}
    {selectedRefRef.current && <GizmoControls object={selectedRefRef.current} mode={transformMode} onDragEnd={onDragEnd} />}
    <CameraController fov={fov} />
    <OrbitControls enabled={!hasSelection} enablePan={!isPanorama} enableZoom={true} enableRotate={!isFlat}
      minDistance={1} maxDistance={isPanorama ? 15 : 30}
      minPolarAngle={panoramaMode === '360' ? Math.PI * 0.5 : panoramaMode === '720' ? 0.05 : Math.PI * 0.2}
      maxPolarAngle={panoramaMode === '360' ? Math.PI * 0.5 : panoramaMode === '720' ? Math.PI * 0.95 : Math.PI * 0.8}
      rotateSpeed={0.5} zoomSpeed={1} target={[0, 0, 0]} />
  </>);
}
function CameraController({ fov }: { fov: number }) { const { camera } = useThree(); useEffect(() => { if (camera instanceof THREE.PerspectiveCamera) { camera.fov = fov; camera.updateProjectionMatrix(); } }, [fov, camera]); return null; }

// 保存机位弹窗
function SavePresetModal({ onSave, onCancel }: { onSave: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(''); const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);
  const submit = () => { const t = name.trim(); if (t) { onSave(t); setName(''); } };
  return (<div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={(e) => e.stopPropagation()} onClick={onCancel}>
    <div className="bg-[#121214]/95 backdrop-blur-3xl border border-white/[0.08] rounded-[20px] p-6 w-[340px] shadow-[0_30px_60px_rgba(0,0,0,0.8)]" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <h3 className="text-white text-sm font-bold mb-4 tracking-wider">保存机位预设</h3>
      <input ref={inputRef} type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }} placeholder="例如：特写A、全景B、过肩C..." className="w-full bg-[#0a0a0c]/80 border border-white/[0.06] rounded-[12px] p-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-white/20 transition-all mb-5" />
      <div className="flex gap-2"><button onClick={onCancel} className="flex-1 py-2.5 rounded-[12px] bg-white/[0.04] border border-white/[0.06] text-zinc-400 text-xs font-medium hover:bg-white/[0.08] transition-all">取消</button>
      <button onClick={submit} disabled={!name.trim()} className="flex-1 py-2.5 rounded-[12px] bg-white/[0.08] border border-white/[0.12] text-zinc-200 text-xs font-bold hover:bg-white/[0.12] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"><Check size={13} /> 保存</button></div>
    </div>
  </div>);
}

// ==========================================
// 主编辑器
// ==========================================
const DirectorStageEditor: React.FC<DirectorStageEditorProps> = ({
  backgroundUrl, panoramaMode, characters: initialChars = [], cameraPresets: initialPresets = [],
  onCapture, onCharactersChange, onCameraPresetsChange, onClose,
}) => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<DirectorStageCharacter[]>(initialChars);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [cameraPresets, setCameraPresets] = useState<DirectorStageCameraPreset[]>(initialPresets);
  const [fov, setFov] = useState(75);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [showSavePreset, setShowSavePreset] = useState(false);
  const charRefsRef = useRef<Map<string, THREE.Group>>(new Map());

  useEffect(() => { setCharacters(initialChars); charRefsRef.current.clear(); }, [initialChars]);
  useEffect(() => { setCameraPresets(initialPresets); }, [initialPresets]);

  const updateChars = useCallback((newChars: DirectorStageCharacter[]) => { setCharacters(newChars); onCharactersChange(newChars); }, [onCharactersChange]);

  const handleAddChar = useCallback((gender: 'male' | 'female') => {
    const nc: DirectorStageCharacter = { id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, type: gender, position: [0, 0, -2 + characters.length * 1.5], rotation: [0, 0, 0], scale: [1, 1, 1], color: gender === 'male' ? '#3498db' : '#e91e63', pose: 'stand' };
    updateChars([...characters, nc]); setSelectedCharId(nc.id);
  }, [characters, updateChars]);

  const handleRemoveChar = useCallback((id: string) => { updateChars(characters.filter(c => c.id !== id)); charRefsRef.current.delete(id); if (selectedCharId === id) setSelectedCharId(null); }, [characters, selectedCharId, updateChars]);
  const handleUpdateChar = useCallback((id: string, updates: Partial<DirectorStageCharacter>) => { updateChars(characters.map(c => c.id === id ? { ...c, ...updates } : c)); }, [characters, updateChars]);

  // ★ 从 Group 读取变换并同步到 state（仅在拖拽结束后调用，不在拖拽过程中干扰 TransformControls）
  const syncTransforms = useCallback(() => {
    const refs = charRefsRef.current;
    if (refs.size === 0) return;
    setCharacters(prev => {
      const updated = prev.map(c => { const g = refs.get(c.id); if (!g) return c; return { ...c, position: g.position.toArray() as [number, number, number], rotation: g.rotation.toArray() as [number, number, number], scale: g.scale.toArray() as [number, number, number] }; });
      onCharactersChange(updated);
      return updated;
    });
  }, [onCharactersChange]);

  const handleDeselect = useCallback((e: React.MouseEvent) => {
    // ★ 只在点击画布本身时取消选中（TransformControls 控件点击不触发）
    if ((e.target as HTMLElement).tagName !== 'CANVAS') return;
    syncTransforms();
    setSelectedCharId(null);
  }, [syncTransforms]);

  // ★ 关闭前先同步变换
  const handleClose = useCallback(() => { syncTransforms(); onClose(); }, [syncTransforms, onClose]);

  const handleCapture = useCallback(() => { const c = canvasContainerRef.current?.querySelector('canvas'); if (c) { try { onCapture(c.toDataURL('image/png')); } catch (e) { console.error('[DirectorStageEditor] 截图失败:', e); } } }, [onCapture]);

  const handleSavePreset = useCallback((name: string) => { const np = [...cameraPresets, { id: `cam_${Date.now()}`, name, position: [0, 2, 8], target: [0, 0, 0], fov }]; setCameraPresets(np); onCameraPresetsChange(np); setShowSavePreset(false); }, [cameraPresets, fov, onCameraPresetsChange]);

  const selectedChar = characters.find(c => c.id === selectedCharId);
  const handleReady = useCallback(() => setLoading(false), []);

  return (
    <div className="fixed inset-0 z-[9999] bg-[#020204] select-none flex">
      <div className="w-[260px] flex-shrink-0 bg-[#0a0a0c]/95 backdrop-blur-3xl border-r border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]"><h2 className="text-white text-sm font-bold tracking-wider flex items-center gap-2"><UserRound size={16} className="text-zinc-400" /> 角色列表</h2></div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {characters.map((c) => (
            <button key={c.id} onClick={() => setSelectedCharId(c.id)} className={`w-full flex items-center gap-3 p-3 rounded-[12px] text-left transition-all ${selectedCharId === c.id ? 'bg-white/10 border border-white/15' : 'hover:bg-white/5 border border-transparent'}`}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c.color }}>{c.type === 'male' ? <User size={14} className="text-white/80" /> : <UserRound size={14} className="text-white/80" />}</div>
              <div className="flex-1 min-w-0"><div className="text-white text-xs font-medium truncate">{c.type === 'male' ? '男性' : '女性'}人偶</div><div className="text-zinc-500 text-[10px]">{POSE_LABELS[c.pose]}</div></div>
              <span onClick={(e) => { e.stopPropagation(); handleRemoveChar(c.id); }} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-zinc-600 hover:text-zinc-300 transition-all cursor-pointer"><Trash2 size={12} /></span>
            </button>
          ))}
          {characters.length === 0 && <div className="text-zinc-600 text-xs text-center py-8">点击下方按钮添加角色</div>}
        </div>
        <div className="p-3 border-t border-white/[0.06] flex gap-2">
          <button onClick={() => handleAddChar('male')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] bg-white/[0.06] border border-white/[0.1] text-zinc-300 text-xs font-bold hover:bg-white/[0.1] transition-all"><User size={14} /> 男</button>
          <button onClick={() => handleAddChar('female')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] bg-white/[0.06] border border-white/[0.1] text-zinc-300 text-xs font-bold hover:bg-white/[0.1] transition-all"><UserRound size={14} /> 女</button>
        </div>
      </div>

      <div ref={canvasContainerRef} className="flex-1 relative" onClick={handleDeselect}>
        {loading && backgroundUrl && (<div className="absolute inset-0 z-40 flex items-center justify-center bg-[#020204]/95 backdrop-blur-sm"><div className="flex flex-col items-center gap-4 p-8 bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/[0.06] rounded-[24px]"><Loader2 size={32} className="text-zinc-400 animate-spin" /><span className="text-white/40 text-sm font-medium">加载场景中...</span></div></div>)}
        <Canvas camera={{ position: [0, 2, 8], fov: 75, near: 0.1, far: 300 }} gl={{ preserveDrawingBuffer: true, antialias: true, alpha: false, powerPreference: 'high-performance' }} dpr={[1, Math.min(window.devicePixelRatio || 1, 3)]}>
          <Suspense fallback={null}>
            <SceneContent backgroundUrl={backgroundUrl} panoramaMode={panoramaMode} characters={characters} selectedCharId={selectedCharId} onSelectChar={(id) => setSelectedCharId(id)} charRefsRef={charRefsRef} onReady={handleReady} fov={fov} transformMode={transformMode} onDragEnd={syncTransforms} />
          </Suspense>
        </Canvas>

        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 p-1.5 bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
          <span className="text-white/30 text-[10px] px-1 font-medium tracking-wider">FOV</span>
          <input type="range" min={30} max={120} value={fov} onChange={(e) => setFov(Number(e.target.value))} className="w-24 h-1 accent-white" />
          <span className="text-white/60 text-[10px] font-mono w-8 text-right">{fov}°</span>
          <div className="w-px h-5 bg-white/10" />
          <button onClick={(e) => { e.stopPropagation(); setShowSavePreset(true); }} className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-xs text-zinc-400 hover:text-white hover:bg-white/10 transition-all"><Save size={12} /> 保存机位</button>
          <button onClick={handleCapture} className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-xs text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-all"><Camera size={12} /> 截图→新节点</button>
          <div className="w-px h-5 bg-white/10" />
          <button onClick={handleClose} className="flex items-center justify-center w-7 h-7 rounded-[8px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all"><X size={14} /></button>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none"><span className="text-white/15 text-[10px] bg-[#0a0a0c]/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/[0.04]">选中角色拖轴线操作 · 点击空白保存并取消选中 · 滚轮缩放 · 右键平移</span></div>
        {showSavePreset && <SavePresetModal onSave={handleSavePreset} onCancel={() => setShowSavePreset(false)} />}
      </div>

      <div className="w-[240px] flex-shrink-0 bg-[#0a0a0c]/95 backdrop-blur-3xl border-l border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]"><h2 className="text-white text-sm font-bold tracking-wider">属性面板</h2></div>
        {selectedChar ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            <div><div className="text-zinc-500 text-[10px] font-medium mb-2 tracking-wider uppercase">操作模式</div>
              <div className="flex gap-1">
                {([{ k: 'translate', icon: <Move3d size={13} />, label: '移动' }, { k: 'rotate', icon: <Rotate3d size={13} />, label: '旋转' }, { k: 'scale', icon: <ZoomIn size={13} />, label: '缩放' }] as const).map(({ k, icon, label }) => (
                  <button key={k} onClick={() => setTransformMode(k)} className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-[8px] text-[10px] font-medium transition-all ${transformMode === k ? 'bg-white/[0.08] text-zinc-200 border border-white/[0.12]' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'}`}>{icon}<span>{label}</span></button>))}</div>
            </div>
            <div><div className="text-zinc-500 text-[10px] font-medium mb-2 tracking-wider uppercase">颜色</div>
              <div className="grid grid-cols-6 gap-1.5">{PRESET_COLORS.map((c) => (<button key={c} onClick={() => handleUpdateChar(selectedChar.id, { color: c })} className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110" style={{ backgroundColor: c, borderColor: selectedChar.color === c ? '#ffffff' : 'transparent' }} />))}</div>
            </div>
            <div><div className="text-zinc-500 text-[10px] font-medium mb-2 tracking-wider uppercase">姿势</div>
              <div className="flex gap-1.5">{(Object.keys(POSE_LABELS) as Array<keyof typeof POSE_LABELS>).map((p) => (<button key={p} onClick={() => handleUpdateChar(selectedChar.id, { pose: p })} className={`flex-1 py-2 rounded-[8px] text-[10px] font-medium transition-all ${selectedChar.pose === p ? 'bg-white/10 text-white border border-white/15' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'}`}>{POSE_LABELS[p]}</button>))}</div>
            </div>
            <div><div className="text-zinc-500 text-[10px] font-medium mb-2 tracking-wider uppercase">尺寸 <span className="text-zinc-600 font-mono ml-1">{selectedChar.scale[0].toFixed(1)}x</span></div>
              <input type="range" min={0.2} max={20} step={0.1} value={Math.min(selectedChar.scale[0], 20)} onChange={(e) => { const v = Number(e.target.value); handleUpdateChar(selectedChar.id, { scale: [v, v, v] }); }} className="w-full h-1 accent-white" />
              <div className="flex justify-between text-[8px] text-zinc-700 mt-0.5"><span>0.2x</span><span>20x</span></div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4"><div className="text-center text-zinc-600 text-xs"><UserRound size={32} className="mx-auto mb-3 text-zinc-700" />点击场景中角色<br />或左侧列表选择<br />开始编辑</div></div>
        )}
      </div>
    </div>
  );
};

export default DirectorStageEditor;
