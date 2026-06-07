// store/useAppStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware'; // ✨ 引入持久化魔法

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
  canvasProjects?: any[]; 
  updateCanvasProject?: (id: string, data: any) => void; 
    // ✨ 新增画布全局设置
  canvasSettings: { defaultImageModel: string; defaultVideoModel: string; globalPromptSuffix: string; };
  setCanvasSettings: (updater: any) => void;
  activeView: 'chat' | 'image-gen' | 'video-gen' | 'workflow-gallery' | 'workflow-execution' | 'video-canvas';
  activeCanvasProjectId: string | null;
  isSettingsModalOpen: boolean;
  settings: AppSettings;
  toastMsg: string | null;
  outOfBalanceMsg: string | null;
  streamText: string; 
  setActiveView: (view: 'chat' | 'image-gen' | 'video-gen' | 'workflow-gallery' | 'workflow-execution' | 'video-canvas') => void;
  setActiveCanvasProjectId: (id: string | null) => void;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
  setSettings: (settings: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
  setToastMsg: (msg: string | null) => void;
  setOutOfBalanceMsg: (msg: string | null) => void;
  setStreamText: (text: string) => void;
}

// ✨ 使用 persist 包裹，告诉它只缓存 canvasProjects，别的东西不缓存
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      canvasSettings: { defaultImageModel: 'gpt-image-2', defaultVideoModel: 'doubao-seedance-2-0-260128', globalPromptSuffix: '' },
      setCanvasSettings: (updater) => set((state) => ({
        canvasSettings: typeof updater === 'function' ? updater(state.canvasSettings) : updater
      })),
      
      activeView: 'chat',
      canvasProjects: [], 
      updateCanvasProject: (id, data) => set((state: any) => {
        const exists = (state.canvasProjects || []).find((p:any) => p.id === id);
        if (exists) {
          return { canvasProjects: state.canvasProjects.map((p: any) => p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p) };
        } else {
          return { canvasProjects: [...(state.canvasProjects || []), { id, ...data, updatedAt: Date.now() }] };
        }
      }),
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
    }),
    {
      name: 'yr-canvas-storage',
      // ✨ 核心修复：把页面路由状态和画布ID一起加入缓存白名单！
      partialize: (state) => ({ 
        canvasProjects: state.canvasProjects,
        activeView: state.activeView,
        activeCanvasProjectId: state.activeCanvasProjectId
      }),
    }
  )
);