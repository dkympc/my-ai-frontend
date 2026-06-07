// hooks/useCanvasEngine.ts
import { fetchApi } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

// ✨ 全局交通管制中心（内存单例）
const taskQueue: Array<{ nodeId: string, type: 'image' | 'video', getNodes: any, updateNodeData: any }> = [];
const activeTasks = new Set<string>();
const MAX_CONCURRENCY = 2; // 最大并发数：2，防止 API 封号

export function useCanvasEngine() {
  
  // 内部核心：处理队列
  const processQueue = async () => {
    if (activeTasks.size >= MAX_CONCURRENCY || taskQueue.length === 0) return;

    // 从队列头部取出一个任务
    const task = taskQueue.shift();
    if (!task) return;

    activeTasks.add(task.nodeId);
    
    try {
      if (task.type === 'image') {
        await executeImageTask(task.nodeId, task.getNodes, task.updateNodeData);
      } else if (task.type === 'video') {
        await executeVideoTask(task.nodeId, task.getNodes, task.updateNodeData);
      }
    } finally {
      // 无论成功失败，释放当前车道，并递归叫号下一个
      activeTasks.delete(task.nodeId);
      processQueue();
    }
  };

  // 🚀 对外暴露的入队方法
  const enqueueTask = (nodeId: string, type: 'image' | 'video', getNodes: any, updateNodeData: any) => {
    // 标记节点进入“排队”状态
    updateNodeData(nodeId, { status: 'pending', isGenerating: true });
    taskQueue.push({ nodeId, type, getNodes, updateNodeData });
    useAppStore.getState().setToastMsg(`🚦 节点已加入${type === 'image' ? '生图' : '渲染'}队列 (排队中: ${taskQueue.length})`);
    
    // 呼叫交通灯检查是否可以放行
    processQueue();
  };

  // ==========================================
  // ==========================================
  // 🛡️ 核心中间件：Payload 组装与参数翻译 (Middleware Adapter)
  // ==========================================
  const buildImagePayload = (data: any, settings: any) => {
    // 1. 风格拦截与覆写逻辑
    const styleOverride = data.styleOverride || '继承全局预设';
    const globalSuffix = settings?.globalPromptSuffix ? `, ${settings.globalPromptSuffix}` : '';
    let finalStyle = '';
    
    if (styleOverride === '继承全局预设') {
        finalStyle = globalSuffix;
      } else if (styleOverride === '🎬 电影质感') {
        finalStyle = ', Cinematic lighting, 8k resolution, highly detailed, masterpiece, 85mm lens';
      } else if (styleOverride === '🌸 二次元') {
        finalStyle = ', Anime style, studio ghibli, ultra-detailed, beautiful composition';
      } else if (styleOverride === '📷 极致写实') {
        finalStyle = ', Photorealistic, RAW photo, highly detailed skin texture, ultra-realistic';
      } else if (styleOverride === '🧊 3D 渲染') {
        finalStyle = ', 3D render, Octane Render, Unreal Engine 5, ray tracing';
      } else if (styleOverride === '🌃 赛博朋克') {
        finalStyle = ', Cyberpunk style, neon lights, futuristic city, highly detailed';
      }

    // 2. 提示词拼装（强制用户 basePrompt 放在最前面，获得最高权重）
    const basePrompt = data.firstFrameAnchor || data.prompt || '';
    const lighting = data.sceneLighting ? `, ${data.sceneLighting}` : '';
    const camera = data.globalCamera ? `, ${data.globalCamera}` : '';
    const finalPrompt = `${basePrompt}${lighting}${camera}${finalStyle}`;

    // 3. 模型与画质转换 (翻译给后端)
    const targetModel = data.model || settings?.defaultImageModel || 'gpt-image-2';
    const isHD = data.quality === '高清 HD (耗时)'; // UI 中的画质选项

    let targetSize = '1024x1024';
    if (targetModel.includes('seedream')) {
      const srMap: Record<string, string> = { '1:1': '1920x1920', '16:9': '2560x1440', '9:16': '1440x2560', '4:3': '2048x1536' };
      targetSize = srMap[data.ratio || '16:9'] || '2560x1440';
    } else {
      // 如果选了高清，且不是 seedream，强制升维分辨率
      if (isHD) {
        const hdMap: Record<string, string> = { '1:1': '2048x2048', '16:9': '1920x1080', '9:16': '1080x1920', '4:3': '2048x1536' };
        targetSize = hdMap[data.ratio || '16:9'] || '1920x1080';
      } else {
        const defaultMap: Record<string, string> = { '1:1': '1024x1024', '16:9': '1024x576', '9:16': '576x1024', '4:3': '1024x768' };
        targetSize = defaultMap[data.ratio || '16:9'] || '1024x576';
      }
    }

    return { 
      model: targetModel, 
      prompt: finalPrompt, 
      ratio: data.ratio || '16:9', 
      size: targetSize,
      n: data.n || 1 
    };
  };

  const buildVideoPayload = (data: any, settings: any) => {
    // 1. 视频专属提示词拼装
    const finalVideoPrompt = `【摄影与光影限制】\n机位：${data.globalCamera || '无'}\n光线：${data.sceneLighting || '无'}\n\n【主体动作】\n${data.prompt || ''}`;
    const targetModel = data.model || settings?.defaultVideoModel || 'doubao-seedance-2-0-260128';
    
    // 2. 渲染精度转换
    let resolutionParam = '720p';
    if (data.resolution === '1080P') resolutionParam = '1080p';

    // ✨ 核心红线拦截：检查 prompt 中是否显式输入了 [@参考 ]，防强买强卖
    const hasAssetMention = data.prompt?.includes('[@参考') || false;

    const payload: any = { 
      model: targetModel, 
      // 只有既有图，且用户显式 @ 了，才走 i2v，否则一律 t2v
      mode: (data.frameUrl && hasAssetMention) ? 'i2v' : 't2v', 
      prompt: finalVideoPrompt, 
      ratio: data.ratio || '16:9',
      duration: data.duration || 5,
      resolution: resolutionParam
    };

    if (data.frameUrl && hasAssetMention) {
       payload.image = data.frameUrl;
       payload.images = [data.frameUrl];
    }
    return payload;
  };

  // ==========================================
  // 执行器：生图逻辑 (防烧钱 Mock 模式)
  // ==========================================
  const executeImageTask = async (nodeId: string, getNodes: any, updateNodeData: any) => {
    const node = getNodes().find((n: any) => n.id === nodeId);
    if (!node) return;
    
    updateNodeData(nodeId, { status: 'generating' }); 
    const payload = buildImagePayload(node.data, useAppStore.getState().canvasSettings);
    
    // 打印真实 payload 到控制台供你检查，但不发真实请求
    console.log("【中间件输出】生图 API Payload:", payload);
    
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const mockImageUrl = 'https://images.unsplash.com/photo-1618331835717-801e976710b2?q=80&w=1024&auto=format&fit=crop';
        updateNodeData(nodeId, { status: 'done', isGenerating: false, frameUrl: mockImageUrl, resultUrl: mockImageUrl });
        resolve();
      }, 3000);
    });
  };

  // ==========================================
  // 执行器：生视频逻辑 (防烧钱 Mock 模式)
  // ==========================================
  const executeVideoTask = async (nodeId: string, getNodes: any, updateNodeData: any) => {
    const node = getNodes().find((n: any) => n.id === nodeId);
    if (!node) return;

    updateNodeData(nodeId, { status: 'generating' }); 
    const payload = buildVideoPayload(node.data, useAppStore.getState().canvasSettings);
    
    // 打印真实 payload 到控制台供你检查
    console.log("【中间件输出】视频 API Payload:", payload);
    
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        updateNodeData(nodeId, { 
          status: 'done', 
          isGenerating: false, 
          videoUrl: 'https://cdn.pixabay.com/video/2020/05/25/40134-424823908_large.mp4', 
          resultUrl: 'https://cdn.pixabay.com/video/2020/05/25/40134-424823908_large.mp4' 
        });
        resolve();
      }, 5000);
    });
  };

  return { enqueueTask };
}