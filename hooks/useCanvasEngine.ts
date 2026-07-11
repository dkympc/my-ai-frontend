// hooks/useCanvasEngine.ts
import { fetchApi } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { DirectorRouter } from '@/lib/director-rules';

// ✨ 全局交通管制中心（内存单例）
// i2iOptions：去脏重绘专用参数 { baseImage: 底图URL, targetNodeId: 结果写入的新节点ID, prompt: 重绘提示词 }
type I2iOptions = { baseImage: string; targetNodeId: string; prompt: string };
const taskQueue: Array<{ nodeId: string, type: 'image' | 'video' | 'i2i', getNodes: any, updateNodeData: any, extraImageRefs?: string[], i2iOptions?: I2iOptions }> = [];
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
        await executeImageTask(task.nodeId, task.getNodes, task.updateNodeData, task.extraImageRefs);
      } else if (task.type === 'video') {
        await executeVideoTask(task.nodeId, task.getNodes, task.updateNodeData);
      } else if (task.type === 'i2i') {
        // ✨ 去脏重绘：结果写入右侧新 MediaNode，不覆盖源节点
        await executeI2iTask(task.nodeId, task.getNodes, task.updateNodeData, task.i2iOptions!);
      }
    } finally {
      // 无论成功失败，释放当前车道，并递归叫号下一个
      activeTasks.delete(task.nodeId);
      processQueue();
    }
  };

  // 🚀 对外暴露的入队方法
  // 对于 i2i 去脏重绘：不标记源节点为 generating（源节点不变），结果会写入 targetNodeId 指定的新节点
  const enqueueTask = (nodeId: string, type: 'image' | 'video' | 'i2i', getNodes: any, updateNodeData: any, extraImageRefs?: string[], i2iOptions?: I2iOptions) => {
    if (type !== 'i2i') {
      // 普通生图/视频：标记本节点进入"排队"状态
      updateNodeData(nodeId, { status: 'pending', isGenerating: true });
    } else if (i2iOptions) {
      // 去脏重绘：标记右侧新结果节点为排队中
      updateNodeData(i2iOptions.targetNodeId, { status: 'pending', isGenerating: true });
    }
    taskQueue.push({ nodeId, type, getNodes, updateNodeData, extraImageRefs, i2iOptions });
    useAppStore.getState().setToastMsg(`🚦 节点已加入${type === 'image' ? '生图' : type === 'video' ? '渲染' : '去脏重绘'}队列 (排队中: ${taskQueue.length})`);
    
    // 呼叫交通灯检查是否可以放行
    processQueue();
  };

  // ==========================================
  // ==========================================
  // 🛡️ 核心中间件：Payload 组装与参数翻译 (Middleware Adapter)
  // ==========================================
  const buildImagePayload = (data: any, settings: any, externalRefs?: string[]) => {
    // 1. 风格拦截与覆写逻辑
    const styleOverride = data.styleOverride || '继承全局预设';
    let finalStyle = '';
    
    // 🚨 核心切断：如果是“继承全局预设”（即没有强选下拉框里的电影/二次元），我们什么都不拼！保持 prompt 的绝对纯净和所见即所得！
    if (styleOverride === '继承全局预设') {
        finalStyle = ''; 
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

    // 3. 模型与画质转换 (翻译给后端)
    const targetModel = data.model || settings?.defaultImageModel || 'gpt-image-2';
    
    // ✨【画画分辨率精细化定义】
    // 支持 1K, 2K, 3K, 4K 的精准物理对齐
    const quality = data.quality || '1K';
    
    // ✨ 核心机制：比例优先级。单分镜节点 ratio 拥有最高优先级，其次为全局穿透的 globalRatioOverride，最后默认 16:9
    const ratio = data.ratio || data.globalRatioOverride || '16:9';

    // 4. 不同模型参数与比例尺寸的适配性拼装
    let targetSize = '1024x1024';
    let gptRatioPrefix = '';
    let extraParams: any = {};

    if (targetModel === 'gpt-image-2') {
      // 🚨 gpt-image-2: size 等参数字段不生效且易报 400，最终尺寸纯靠 Prompt 比例控制
      // 方案：生成最高权重的前缀，强制塞进 Prompt 的最开头
      const gptPrefixMap: Record<string, string> = {
        '1:1': '1024x1024 方形, ',
        '16:9': '横版 16:9 电影画幅, ',
        '9:16': '竖版 9:16 手机壁纸, ',
        '4:3': '横版 4:3, ',
        '3:4': '竖版 3:4, ',
        '21:9': '横版 21:9 电影宽幅, '
      };
      gptRatioPrefix = gptPrefixMap[ratio] || '横版 16:9 电影画幅, ';
      
      // GPT 模型不发送 size, aspect_ratio 以防校验 400 报错
      targetSize = 'auto'; // 后端会做兜底过滤，确保不触发上游限制
    } 
    else if (targetModel === 'banana-pro') {
      // 🍌 Banana Pro: 走 Gemini 原生的 aspectRatio + imageSize 控制比例和分辨率
      // ⚠️ 双保险策略：部分代理站（如 bvctfwcsoqeb.sealoshzh.site）不转发 imageConfig.aspectRatio，
      // 因此在 Prompt 中注入英文比例描述作为兜底，确保代理站也能正确出图
      const bananaRatioPrefixMap: Record<string, string> = {
        '1:1': 'square format 1:1, ',
        '16:9': 'widescreen 16:9, ',
        '9:16': 'vertical 9:16 portrait, ',
        '4:3': '4:3 aspect ratio, ',
        '3:4': '3:4 vertical, ',
        '21:9': 'ultrawide 21:9 cinematic, ',
        '2:3': '2:3 portrait, ',
        '3:2': '3:2 landscape, ',
        '4:5': '4:5 vertical, ',
        '5:4': '5:4 landscape, '
      };
      gptRatioPrefix = bananaRatioPrefixMap[ratio] || '1:1 square, ';
      
      let resolutionGrade = '1K'; // 默认 1K
      if (quality.includes('2K') || quality.includes('高清') || quality.includes('HD')) {
        resolutionGrade = '2K';
      } else if (quality.includes('4K') || quality.includes('极致') || quality.includes('Ultra')) {
        resolutionGrade = '4K';
      }

      // Gemini 原生不需要 size 字段（比例由 aspectRatio 锁定，分辨率由 imageSize 控制）
      targetSize = 'auto';
      extraParams = {
        "aspectRatio": ratio,      // 比例字符串，如 "16:9"、"9:16"（Gemini 原生字段名）
        "imageSize": resolutionGrade  // 分辨率档位，如 "1K"、"2K"、"4K"
      };
    }
    else if (targetModel === 'seedream5.0') {
      // 🚨 Seedream 5.0: 官方仅支持 2K/3K 分辨率档位，其余（如1K/4K）在5.0下调用会直接报 400 失败
      let seedreamGrade = '2K'; // 默认 2K 保证高成功率
      if (quality.includes('3K') || quality.includes('超高清') || quality.includes('极致')) {
        seedreamGrade = '3K';
      }

      // 如果是 1:1，可以使用预设黄金字符串 "2K" 或 "3K"；如果是其他非 1:1 比例，按规范传入精确像素 WxH
      if (ratio === '1:1') {
        targetSize = seedreamGrade;
      } else {
        const seedreamGrid: Record<string, Record<string, string>> = {
          '16:9': { '2K': '2736x1538', '3K': '3456x1944' },
          '9:16': { '2K': '1538x2736', '3K': '1944x3456' },
          '4:3':  { '2K': '2364x1774', '3K': '3072x2304' },
          '3:4':  { '2K': '1774x2364', '3K': '2304x3072' },
          '21:9': { '2K': '3136x1344', '3K': '3584x1536' }
        };
        const ratioGrid = seedreamGrid[ratio] || seedreamGrid['16:9'];
        targetSize = ratioGrid[seedreamGrade] || ratioGrid['2K'];
      }

      extraParams = {
        "output_format": "png", // 5.0 模型专享无损高质量格式
        "watermark": false     // 强制商用去水印
      };
    }
    else {
      // 其他模型兜底
      if (quality.includes('HD') || quality.includes('4K') || quality.includes('极致') || quality.includes('高清')) {
        const hdMap: Record<string, string> = { '1:1': '2048x2048', '16:9': '1920x1080', '9:16': '1080x1920', '4:3': '2048x1536', '3:4': '1536x2048' };
        targetSize = hdMap[ratio] || '1920x1080';
      } else {
        const defaultMap: Record<string, string> = { '1:1': '1024x1024', '16:9': '1024x576', '9:16': '576x1024', '4:3': '1024x768', '3:4': '768x1024' };
        targetSize = defaultMap[ratio] || '1024x576';
      }
    }

    // 2. 提示词拼装（强制将 ratioPrefix 放于最开头，获得大模型的极高遵循度）
    const basePrompt = data.firstFrameAnchor || data.prompt || '';

    // 导演路由引擎：优先读取裂变时预计算好的结构化导演上下文
    const directorCtx = data._directorContext;
    const lighting = directorCtx?.lightingPrompt
      ? `, ${directorCtx.lightingPrompt}`
      : (data.sceneLighting ? `, ${data.sceneLighting}` : '');
    const camera = directorCtx?.cameraPrompt
      ? `, ${directorCtx.cameraPrompt}`
      : (data.globalCamera ? `, ${data.globalCamera}` : '');
    const finalPrompt = `${gptRatioPrefix}${basePrompt}${lighting}${camera}${finalStyle}`;

    // ==========================================
    // 🆕 收集从上游节点传过来的参考图
    // ==========================================
    const refImages = (externalRefs && externalRefs.length > 0)
      ? externalRefs
      : (data.incomingAssets
          ?.filter((a: any) => a._type === 'image')
          .map((a: any) => a.url) || []);

    return { 
      model: targetModel, 
      prompt: finalPrompt, 
      ratio: ratio, 
      size: targetSize,
      n: data.n || 1,
      ...extraParams,
      ...(refImages.length > 0 ? { image: refImages[0], images: refImages } : {})
    };
  };

  const buildVideoPayload = (data: any, settings: any) => {
    // 导演路由引擎：优先读取裂变时预计算好的结构化导演上下文
    const directorCtx = data._directorContext;
    const lightingLine = directorCtx?.lightingPrompt
      ? directorCtx.lightingPrompt
      : (data.sceneLighting || '无');
    const cameraLine = directorCtx?.cameraPrompt
      ? directorCtx.cameraPrompt
      : (data.globalCamera || '无');

    // 1. 视频专属提示词拼装
    const finalVideoPrompt = `【摄影与光影限制】\n机位：${cameraLine}\n光线：${lightingLine}\n\n【主体动作】\n${data.prompt || data.videoPrompt || ''}`;
    const targetModel = data.model || settings?.defaultVideoModel || 'doubao-seedance-2-0-260128';
    
    // 2. 渲染精度转换
    let resolutionParam = '720p';
    if (data.resolution === '1080P') resolutionParam = '1080p';

    // ✨ 核心红线拦截：检查 prompt 中是否显式输入了 [@参考 ]，防强买强卖
    const hasAssetMention = (data.prompt || data.videoPrompt)?.includes('[@参考') || false;

    // ✨ 核心机制：比例优先级。单分镜节点 ratio 拥有最高优先级，其次为全局穿透的 globalRatioOverride，最后默认 16:9
    const activeVideoRatio = data.ratio || data.globalRatioOverride || '16:9';

    const payload: any = { 
      model: targetModel, 
      // 只有既有图，且用户显式 @ 了，才走 i2v，否则一律 t2v
      mode: (data.frameUrl && hasAssetMention) ? 'i2v' : 't2v', 
      prompt: finalVideoPrompt, 
      ratio: activeVideoRatio,
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
  const executeImageTask = async (nodeId: string, getNodes: any, updateNodeData: any, extraImageRefs?: string[]) => {
    const node = getNodes().find((n: any) => n.id === nodeId);
    if (!node) return;
    
    updateNodeData(nodeId, { status: 'generating' }); 
    const payload = buildImagePayload(node.data, useAppStore.getState().canvasSettings, extraImageRefs);
    
    console.log("【中间件输出】生图 API Payload:", payload);
    
    try {
      const response = await fetchApi('/v1/images/generations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      const resData = await response.json();
      
      // 🚀 核心修复：全能解析器，完美兼容各大模型的返回格式
      let url = null;
      if (resData.data && resData.data.length > 0 && resData.data[0].url) url = resData.data[0].url;
      else if (resData.url) url = resData.url;
      else if (resData.images && resData.images.length > 0) url = resData.images[0].url || resData.images[0];
      else if (resData.choices && resData.choices.length > 0 && resData.choices[0].message?.content) { 
        const match = resData.choices[0].message.content.match(/!\[.*?\]\((.*?)\)/); 
        if (match && match[1]) url = match[1]; 
      }
      
      if (url) {
        updateNodeData(nodeId, { status: 'done', isGenerating: false, frameUrl: url, resultUrl: url });
      } else {
        throw new Error("API 未返回图片 URL");
      }
    } catch (error) {
      console.error("生图失败:", error);
      updateNodeData(nodeId, { status: 'failed', isGenerating: false });
      useAppStore.getState().setToastMsg("生图失败，请查看控制台错误");
    }
  };

  // ==========================================
  // 执行器：生视频 logic
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

  // ==========================================
  // ✨ 执行器：去脏重绘 i2i 逻辑（第一阶段新增）
  // 设计逻辑：读取源节点的模型/比例/光影，用传入的重绘 prompt 覆盖首帧描述，
  // 把底图作为参考图发起图生图请求，结果写入右侧新 MediaNode（绝不覆盖源节点）。
  // 后端 i2i 链路已具备：gpt-image-2 走 /v1/images/edits，banana2 走 Gemini generateContent，
  // 其他模型走通用 images 字段，模型由用户在节点上自选，这里不做限制。
  // ==========================================
  const executeI2iTask = async (nodeId: string, getNodes: any, updateNodeData: any, options: I2iOptions) => {
    const { baseImage, targetNodeId, prompt } = options;
    const node = getNodes().find((n: any) => n.id === nodeId);
    if (!node) {
      console.error("[Canvas i2i Error] - 原因是：找不到源节点", nodeId);
      return;
    }

    // 标记右侧新结果节点为生成中
    updateNodeData(targetNodeId, { status: 'generating', isGenerating: true });

    // 复用 buildImagePayload，但用重绘 prompt 覆盖首帧描述，并把底图作为参考图传入
    const payload = buildImagePayload(
      { ...node.data, firstFrameAnchor: prompt, prompt },
      useAppStore.getState().canvasSettings,
      [baseImage]
    );

    console.log("【中间件输出】i2i 去脏重绘 Payload:", payload);

    try {
      const response = await fetchApi('/v1/images/generations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const resData = await response.json();

      // 🚀 复用全能解析器，完美兼容各大模型的返回格式
      let url = null;
      if (resData.data && resData.data.length > 0 && resData.data[0].url) url = resData.data[0].url;
      else if (resData.url) url = resData.url;
      else if (resData.images && resData.images.length > 0) url = resData.images[0].url || resData.images[0];
      else if (resData.choices && resData.choices.length > 0 && resData.choices[0].message?.content) {
        const match = resData.choices[0].message.content.match(/!\[.*?\]\((.*?)\)/);
        if (match && match[1]) url = match[1];
      }

      if (url) {
        // 结果写入右侧新 MediaNode，源节点保持不变
        updateNodeData(targetNodeId, { status: 'done', isGenerating: false, resultUrl: url, frameUrl: url });
      } else {
        throw new Error("API 未返回图片 URL");
      }
    } catch (error: any) {
      console.error("[Canvas i2i Error] - 原因是：", error?.message || error);
      updateNodeData(targetNodeId, { status: 'failed', isGenerating: false });
      useAppStore.getState().setToastMsg("🪄 去脏重绘失败，请查看控制台 [Canvas i2i Error] 日志");
    }
  };

  return { enqueueTask };
}
