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
  updateCanvasProject?: (id: string, data: any | ((prev: any) => any)) => void; 
    // ✨ 新增画布全局设置
  canvasSettings: { defaultLLMModel: string; defaultImageModel: string; defaultVideoModel: string; globalPromptSuffix: string; globalAssetPromptPrefix: string; globalRatio: string; directorGenre: string; directorTempo: string; fissionMethod: 'general' | 'long15s' | 'long30s' | 'table'; };
  setCanvasSettings: (updater: any) => void;
  activeView: 'chat' | 'image-gen' | 'video-gen' | 'workflow-gallery' | 'workflow-execution' | 'video-canvas' | 'agent-customer-service';
  activeCanvasProjectId: string | null;
  isSettingsModalOpen: boolean;
  isFilmControlOpen: boolean; // ✨ 新增：影视中控台抽屉开关状态
  copilotIsOpen: boolean; // ✨ 新增：AI 副驾驶抽屉开关状态
  selectionAssistEnabled: boolean; // ✨ 新增：全局文字选中 AI 助手开关
  fissionProgress: { status: 'idle' | 'stage1' | 'stage2' | 'camera' | 'asset' | 'table'; phase: string; mode: 'connected' | 'thinking' | 'generating' }; // ✨ 三态：connected(已连接) / thinking(推理中) / generating(生成中)
  setFissionProgress: (progress: { status: 'idle' | 'stage1' | 'stage2' | 'camera' | 'asset' | 'table'; phase: string; mode: 'connected' | 'thinking' | 'generating' }) => void;
  abortFission: (() => void) | null; // ★ 分镜中止函数（由 VideoCanvas 进度条的中止按钮调用）
  setAbortFission: (fn: (() => void) | null) => void;
  settings: AppSettings;
  toastMsg: string | null;
  outOfBalanceMsg: string | null;
  streamText: string; 
  setActiveView: (view: 'chat' | 'image-gen' | 'video-gen' | 'workflow-gallery' | 'workflow-execution' | 'video-canvas' | 'agent-customer-service') => void;
  setActiveCanvasProjectId: (id: string | null) => void;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
  setIsFilmControlOpen: (isOpen: boolean) => void; // ✨ 新增：设置开关函数
  setCopilotIsOpen: (isOpen: boolean) => void; // ✨ 新增：AI 副驾驶开关
  setSelectionAssistEnabled: (enabled: boolean) => void; // ✨ 新增：全局文字选中 AI 助手开关
  setSettings: (settings: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
  setToastMsg: (msg: string | null) => void;
  setOutOfBalanceMsg: (msg: string | null) => void;
  setStreamText: (text: string) => void;
}

// ✨ 使用 persist 包裹，告诉它只缓存 canvasProjects，别的东西不缓存
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      canvasSettings: { defaultLLMModel: 'deepseek-v4-pro', defaultImageModel: 'gpt-image-2', defaultVideoModel: 'doubao-seedance-2-0-260128', globalPromptSuffix: '', globalAssetPromptPrefix: '', globalRatio: '16:9', directorGenre: 'default', directorTempo: '', fissionMethod: 'general' },
      setCanvasSettings: (updater) => set((state) => ({
        canvasSettings: typeof updater === 'function' ? updater(state.canvasSettings) : updater
      })),
      
      activeView: 'chat',
      canvasProjects: [], 
      updateCanvasProject: (id, data) => set((state: any) => {
        const exists = (state.canvasProjects || []).find((p:any) => p.id === id);
        // ★ 支持函数式更新：调用方可传 function(prev) 读取原子快照，消除竞态条件
        const mergeData = typeof data === 'function' ? data(exists) : data;
        let updatedProjects;
        if (exists) {
          updatedProjects = state.canvasProjects.map((p: any) => p.id === id ? { ...p, ...mergeData, updatedAt: Date.now() } : p);
        } else {
          updatedProjects = [...(state.canvasProjects || []), { id, ...mergeData, updatedAt: Date.now() }];
        }
        // ★ P0 存储加固：每次画布数据变更后，异步写入 localStorage 全量备份（防刷新/换浏览器丢失）
        // 使用 requestIdleCallback 推迟到浏览器空闲时执行，避免阻塞拖拽动画帧
        const projectForBackup = updatedProjects.find((p: any) => p.id === id);
        if (projectForBackup) {
          const doBackup = () => {
            try { localStorage.setItem('yr-canvas-full-backup', JSON.stringify(projectForBackup)); } catch(e) {}
          };
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(doBackup, { timeout: 3000 });
          } else {
            setTimeout(doBackup, 0);
          }
        }
        return { canvasProjects: updatedProjects };
      }),
      activeCanvasProjectId: null,
      isSettingsModalOpen: false,
      isFilmControlOpen: false, // ✨ 新增：中控台默认关闭
      copilotIsOpen: false, // ✨ 新增：副驾驶默认关闭
      selectionAssistEnabled: true, // ✨ 新增：全局文字选中 AI 助手默认开启
      fissionProgress: { status: 'idle', phase: '', mode: 'generating' }, // ✨ 新增：分镜裂变进度条默认空闲
      setFissionProgress: (progress) => set({ fissionProgress: progress }),
      abortFission: null, // ★ 分镜中止函数默认无操作
      setAbortFission: (fn) => set({ abortFission: fn }),
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
      setCopilotIsOpen: (isOpen) => set({ copilotIsOpen: isOpen }), // ✨ 新增：副驾驶开关绑定
      setSelectionAssistEnabled: (enabled) => set({ selectionAssistEnabled: enabled }), // ✨ 新增：全局文字选中 AI 助手开关绑定
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
      // ★ 只持久化轻量 UI 状态到 sessionStorage，画布数据走 localStorage 备份
      partialize: (state) => ({
        activeView: state.activeView,
        activeCanvasProjectId: state.activeCanvasProjectId,
        isFilmControlOpen: state.isFilmControlOpen,
        copilotIsOpen: state.copilotIsOpen,
        selectionAssistEnabled: state.selectionAssistEnabled,
      }),
    }
  )
);