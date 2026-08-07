'use client';

import React, { useRef, useState, useEffect, useCallback, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Loader2, Camera, X } from 'lucide-react';

// ==========================================
// 360° 全景圆柱体场景
// ★ 完整圆柱体（360°），图片环绕包裹内壁
// ★ 大半径 60 减少弧面感，高度按宽高比自适应
// ★ 纹理翻转修复 BackSide 导致的镜像
// ==========================================
function PanoramaCylinder({ imageUrl, onReady }: { imageUrl: string; onReady: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [geo, setGeo] = useState<THREE.CylinderGeometry | null>(null);
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const { camera, gl } = useThree();

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const aspect = img.naturalWidth / img.naturalHeight;
      // ★ 大半径减少弧面感，高度按图片比例保持像素不变形
      const radius = 60;
      const circumference = 2 * Math.PI * radius;
      const height = circumference / aspect;

      const geometry = new THREE.CylinderGeometry(radius, radius, height, 128, 1, true);
      setGeo(geometry);

      const loader = new THREE.TextureLoader();
      loader.load(
        imageUrl,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          // ★ 修复镜像：BackSide 面法线反转导致 UV 水平翻转，这里反向翻转抵消
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.repeat.x = -1;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = true;
          texture.anisotropy = gl.capabilities.getMaxAnisotropy?.() || 4;
          setTex(texture);
          onReady();
        },
        undefined,
        () => { setLoadErr(true); onReady(); }
      );
    };
    img.onerror = () => { setLoadErr(true); onReady(); };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    camera.position.set(0, 0, 0.01);
    camera.lookAt(0, 0, -10);
  }, [camera]);

  return (
    <>
      {geo && (
        <mesh ref={meshRef} geometry={geo}>
          {tex ? (
            <meshBasicMaterial map={tex} side={THREE.BackSide} toneMapped={false} />
          ) : (
            <meshBasicMaterial color={loadErr ? '#331111' : '#0a0a14'} side={THREE.BackSide} />
          )}
        </mesh>
      )}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={0.5}
        maxDistance={15}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.8}
        rotateSpeed={0.5}
        zoomSpeed={1}
        target={[0, 0, 0]}
      />
    </>
  );
}

// ==========================================
// 全景查看器主组件
// ★ 黑色液态玻璃 UI 风格统一
// ==========================================
interface PanoramaViewerProps {
  imageUrl: string;
  onCapture?: (dataUrl: string) => void;
  onClose?: () => void;
}

const PanoramaViewer: React.FC<PanoramaViewerProps> = ({ imageUrl, onCapture, onClose }) => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);

  const handleReady = useCallback(() => setLoading(false), []);

  const handleCapture = useCallback(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const canvas = container.querySelector('canvas');
    if (!canvas) return;
    setCapturing(true);
    requestAnimationFrame(() => {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        onCapture?.(dataUrl);
      } catch (e) {
        console.error('[PanoramaViewer] 截图失败:', e);
      }
      setCapturing(false);
    });
  }, [onCapture]);

  return (
    <div className="fixed inset-0 z-[9999] bg-[#020204] select-none">
      {/* ★ 顶部工具栏 — 黑色液态玻璃 */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto" />
        <div className="pointer-events-auto flex items-center gap-2 p-1.5 bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
          <button
            onClick={handleCapture}
            disabled={capturing || loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
          >
            <Camera size={16} />
            {capturing ? '截取中...' : '截取当前视角'}
          </button>
          {onClose && (
            <>
              <div className="w-px h-5 bg-white/10" />
              <button
                onClick={onClose}
                className="flex items-center justify-center w-8 h-8 rounded-[10px] text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ★ 底部提示 */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <span className="text-white/20 text-xs bg-[#0a0a0c]/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/[0.04]">
          拖拽旋转 · 滚轮缩放 · 点击截取导出当前画面
        </span>
      </div>

      {/* ★ 加载遮罩 — 黑色液态玻璃 */}
      {loading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#020204]/95 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 p-8 bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/[0.06] rounded-[24px]">
            <Loader2 size={32} className="text-indigo-400 animate-spin" />
            <span className="text-white/40 text-sm font-medium">加载全景图...</span>
          </div>
        </div>
      )}

      {/* Three.js 画布 */}
      <div ref={canvasContainerRef} className="w-full h-full">
        <Canvas
          camera={{ position: [0, 0, 0.01], fov: 80, near: 0.1, far: 300 }}
          gl={{ preserveDrawingBuffer: true, antialias: true, alpha: false }}
          dpr={[1, Math.min(window.devicePixelRatio || 1, 2)]}
        >
          <Suspense fallback={null}>
            <PanoramaCylinder imageUrl={imageUrl} onReady={handleReady} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
};

export default PanoramaViewer;
