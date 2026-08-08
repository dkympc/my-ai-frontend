// /lib/types.ts

export interface ChatMessage { 
    role: 'user' | 'assistant' | 'system'; 
    content: string | any[]; 
  }
  
  export interface ChatSession { 
    id: string; 
    title: string; 
    messages: ChatMessage[]; 
    updatedAt: number; 
    model: string; 
  }
  
  export interface AttachedFile { 
    name: string; 
    type: string; 
    size: number; 
    data: string; 
    isImage: boolean; 
  }
  
  export interface MediaMaterial { 
    id: string; 
    type: 'image' | 'video' | 'audio'; 
    url: string; 
    name: string; 
    tag: string; 
  }
  
  export interface ImageRecord { 
    id: string; 
    url: string; 
    prompt: string; 
    model: string; 
    ratio: string; 
    timestamp: number; 
    status?: 'processing' | 'succeeded' | 'failed'; 
    references?: string[]; 
  }
  
  export interface VideoRecord { 
    id: string; 
    url: string; 
    prompt: string; 
    model: string; 
    mode: string; 
    ratio: string; 
    duration?: number; 
    resolution?: string; 
    timestamp: number; 
    status?: 'processing' | 'succeeded' | 'failed'; 
    task_id?: string; 
    pollModel?: string; 
  }
  
  export interface WfSession { 
    id: string; 
    workflowId: string; 
    title: string; 
    messages: {role: 'user'|'assistant', content: string}[]; 
    updatedAt: number; 
  }
// /lib/types.ts (找到最底部的 CanvasProject 并替换)
export interface CanvasProject {
  id: string;
  title: string;
  updatedAt: number;
  previewUrl?: string; // 画布缩略图（可选）
  nodes?: any[];
  edges?: any[];
  localAssets?: any[]; // ✨ 新增：当前画布专属的拖拽资产库
}

// ★★★ 导演台节点数据类型 — 3D场景编辑器 + 人偶 + 机位
export interface DirectorStageCharacter {
  id: string;
  type: 'male' | 'female';
  position: [number, number, number]; // 3D世界坐标
  rotation: [number, number, number]; // 欧拉旋转
  scale: [number, number, number];    // 缩放
  color: string;                       // 人偶颜色 hex
  pose: 'stand' | 'walk' | 'sit';     // 姿势预设
}

export interface DirectorStageCameraPreset {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface DirectorStageNodeData {
  type: 'directorStage';
  // 场景背景
  backgroundUrl?: string;
  panoramaMode: '360' | '720' | 'flat';  // 360圆柱体 / 720球体(预留) / 平面
  // 人偶列表
  characters: DirectorStageCharacter[];
  // 机位预设
  cameraPresets: DirectorStageCameraPreset[];
  activePresetId?: string;
  // 提示词
  prompt?: string;
  status?: 'draft' | 'ready';
}