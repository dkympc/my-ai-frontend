import { create } from 'zustand';

interface AppSettings {
  nickname: string;
  avatar: string;
  globalSystemPrompt: string;
  modelSystemPrompts: Record<string, string>;
  temperature: number;
  topP: number;
  maxTokens: string | number;
}

interface AppState {
  canvasProjects?: any[]; // 新增：安全可选的画布列表
  updateCanvasProject?: (id: string, data: any) => void; // 新增：安全可选的更新函数
  activeView: 'chat' | 'image-gen' | 'video-gen' | 'workflow-gallery' | 'workflow-execution' | 'video-canvas';
  activeCanvasProjectId: string | null;
  isSettingsModalOpen: boolean;
  settings: AppSettings;
  toastMsg: string | null;
  outOfBalanceMsg: string | null;
  streamText: string; // 🚀 专属吐字通道
  setActiveView: (view: 'chat' | 'image-gen' | 'video-gen' | 'workflow-gallery' | 'workflow-execution' | 'video-canvas') => void;
  setActiveCanvasProjectId: (id: string | null) => void;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
  setSettings: (settings: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
  setToastMsg: (msg: string | null) => void;
  setOutOfBalanceMsg: (msg: string | null) => void;
  setStreamText: (text: string) => void;
  
}

export const useAppStore = create<AppState>((set) => ({
  activeView: 'chat',
  canvasProjects: [], // 初始为空数组
updateCanvasProject: (id, data) => set((state: any) => ({
  canvasProjects: (state.canvasProjects || []).map((p: any) => 
    p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p
  )
})),
  activeCanvasProjectId: null,
  isSettingsModalOpen: false,
  settings: {
    nickname: '', avatar: '', globalSystemPrompt: '', modelSystemPrompts: {},
    temperature: 0.7, topP: 1.0, maxTokens: ''
  },
  toastMsg: null,
  outOfBalanceMsg: null,
  streamText: '',
  setActiveView: (view) => set({ activeView: view }),
  setActiveCanvasProjectId: (id) => set({ activeCanvasProjectId: id }),
  setIsSettingsModalOpen: (isOpen) => set({ isSettingsModalOpen: isOpen }),
  setSettings: (updater) => set((state) => ({
    settings: typeof updater === 'function' ? updater(state.settings) : updater
  })),
  setToastMsg: (msg) => set({ toastMsg: msg }),
  setOutOfBalanceMsg: (msg) => set({ outOfBalanceMsg: msg }),
  setStreamText: (text) => set({ streamText: text }),
}));