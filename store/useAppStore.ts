// store/useAppStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware'; // ✨ 引入持久化魔法

// ★ 救命底稿：localStorage 键名，存储完整画布项目（含 nodes/edges/localAssets）
const CANVAS_BACKUP_KEY = 'yr-canvas-full-backup';

// ★ 写入 localStorage 完整备份（同步操作，Zustand set() 中可直接调用）
const writeCanvasBackup = (projects: any[]) => {
  try {
    localStorage.setItem(CANVAS_BACKUP_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error("[Canvas Backup Error] localStorage 写入失败，可能数据过大：", e);
  }
};

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
  updateCanvasProject?: (id: string, data: any | ((prev: any) => any)) => void; 
    // ✨ 新增画布全局设置
  canvasSettings: { defaultImageModel: string; defaultVideoModel: string; globalPromptSuffix: string; globalRatio: string; directorGenre: string; directorTempo: string; };
  setCanvasSettings: (updater: any) => void;
  activeView: 'chat' | 'image-gen' | 'video-gen' | 'workflow-gallery' | 'workflow-execution' | 'video-canvas';
  activeCanvasProjectId: string | null;
  isSettingsModalOpen: boolean;
  isFilmControlOpen: boolean; // ✨ 新增：影视中控台抽屉开关状态
  settings: AppSettings;
  toastMsg: string | null;
  outOfBalanceMsg: string | null;
  streamText: string; 
  setActiveView: (view: 'chat' | 'image-gen' | 'video-gen' | 'workflow-gallery' | 'workflow-execution' | 'video-canvas') => void;
  setActiveCanvasProjectId: (id: string | null) => void;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
  setIsFilmControlOpen: (isOpen: boolean) => void; // ✨ 新增：设置开关函数
  setSettings: (settings: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
  setToastMsg: (msg: string | null) => void;
  setOutOfBalanceMsg: (msg: string | null) => void;
  setStreamText: (text: string) => void;
}

// ✨ 使用 persist 包裹，告诉它只缓存 canvasProjects，别的东西不缓存
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      canvasSettings: { defaultImageModel: 'gpt-image-2', defaultVideoModel: 'doubao-seedance-2-0-260128', globalPromptSuffix: '', globalRatio: '16:9', directorGenre: 'default', directorTempo: '' },
      setCanvasSettings: (updater) => set((state) => ({
        canvasSettings: typeof updater === 'function' ? updater(state.canvasSettings) : updater
      })),
      
      activeView: 'chat',
      canvasProjects: [], 
      updateCanvasProject: (id, data) => set((state: any) => {
        const exists = (state.canvasProjects || []).find((p:any) => p.id === id);
        // ★ 支持函数式更新：调用方可传 function(prev) 读取原子快照，消除竞态条件
        const mergeData = typeof data === 'function' ? data(exists) : data;
        let newProjects;
        if (exists) {
          newProjects = state.canvasProjects.map((p: any) => p.id === id ? { ...p, ...mergeData, updatedAt: Date.now() } : p);
        } else {
          newProjects = [...(state.canvasProjects || []), { id, ...mergeData, updatedAt: Date.now() }];
        }
        // ★ 救命底稿：每次画布变更都完整写入 localStorage（含 nodes/edges/localAssets）
        // 确保即使云端同步失败、页面崩溃，刷新后也能从本地恢复完整画布
        writeCanvasBackup(newProjects);
        return { canvasProjects: newProjects };
      }),
      activeCanvasProjectId: null,
      isSettingsModalOpen: false,
      isFilmControlOpen: false, // ✨ 新增：中控台默认关闭
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
      setIsFilmControlOpen: (isOpen) => set({ isFilmControlOpen: isOpen }), // ✨ 新增：中控台开关绑定
      setSettings: (updater) => set((state) => ({
        settings: typeof updater === 'function' ? updater(state.settings) : updater
      })),
      setToastMsg: (msg) => set({ toastMsg: msg }),
      setOutOfBalanceMsg: (msg) => set({ outOfBalanceMsg: msg }),
      setStreamText: (text) => set({ streamText: text }),
    }),
    {
      name: 'yr-canvas-storage',
      storage: createJSONStorage(() => sessionStorage), // ★ 改用 sessionStorage：自动按浏览器会话隔离，杜绝跨账号数据污染
      // ✨ 核心修复：把页面路由状态和画布ID一起加入缓存白名单！
      partialize: (state) => ({
        // 只保留项目的基本信息（避免撑爆 localStorage）
        canvasProjects: (state.canvasProjects || []).map((p: any) => ({
          id: p.id,
          title: p.title,
          updatedAt: p.updatedAt
        })),
        activeView: state.activeView,
        activeCanvasProjectId: state.activeCanvasProjectId,
        isFilmControlOpen: state.isFilmControlOpen // ✨ 核心修复：将抽屉开启状态加入白名单
      }),
    }
  )
);