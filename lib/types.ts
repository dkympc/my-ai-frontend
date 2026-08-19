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

// ============================================================
// SD30sNode — 30秒表演节点数据类型
// ============================================================

/** 单个镜头项 */
export interface ShotItem {
  number: number;           // 镜号 1-20
  shotType: string;         // 景别/机位（如"过肩中景"）
  content: string;          // 镜头描述
  dialogue?: string;        // 台词（角色：台词全文）
  duration?: string;        // 建议时长
}

/** 定场图数据（可选）— 支持多个场景 */
export interface TopDownMapData {
  scenes: Record<string, { abstractUrl: string; realisticUrl: string }>;
  spaceAnalysis: string;
}

/** 情绪剧本分析数据 */
export interface EmotionScriptData {
  protagonistArc: string;     // 主角 4-5 状态弧线
  opponentEcho: string;       // 对手回声线
  thirdRole?: string;         // 第三角色推动线（可选）
  coreProp: string;           // 核心道具
  suggestedDialogue: string;  // 建议台词
  rawAnalysis: string;        // 完整分析文本（用户可编辑）
}

/** 30s 表演提示词数据（Seedance 2.5 兼容格式） */
export interface PerformancePromptData {
  missionTask: string;      // 【本次任务】核心叙事目标与剧情走势
  mainSubjects: string;     // 【主要主体】主要角色
  sceneState: string;       // 【场景与环境状态】详细场景描写
  emotionalGoal: string;    // 【情绪目标】整体情绪基调
  shots: ShotItem[];        // 【分段脚本】镜头列表
  negativePrompt: string;   // 【负面提示词】禁止出现的内容
}

/** SD30sNode 节点完整数据类型 */
export interface SD30sNodeData {
  type: 'sd30s';
  // 节点标题（如"30s · 书房对峙"）
  title: string;
  // 场景标签
  sceneLabel: string;
  // 节点状态
  status: 'planning' | 'generating' | 'done';
  // 定场图（可选）
  topDownMap?: TopDownMapData;
  // 情绪剧本分析
  emotionScript?: EmotionScriptData;
  // 30s 表演提示词
  performancePrompt?: PerformancePromptData;
  // ★ 定场图生图参数（用户可自选，参考生图节点）
  imageModel?: string;       // 生图模型 ID（gpt-image-2 / banana-pro / seedream5.0）
  imageQuality?: string;     // 画质（1K / 2K / 3K / 4K，随模型动态）
  imageRatio?: string;       // 画面比例（16:9 / 9:16 / 1:1 / 4:3 / 3:4）
  imageStyle?: string;       // 风格覆写（继承全局预设 / 🎬 电影质感 / ...）
}