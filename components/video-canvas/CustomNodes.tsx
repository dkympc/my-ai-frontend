import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom'; // ✨ 新增：用于渲染悬浮顶层的禅定舱
import { Handle, Position, useReactFlow, NodeResizeControl, useEdges, useNodes } from '@xyflow/react';
import { 
  Image as ImageIcon, Film, Type, Sparkles, ChevronDown, MoveUp, Scaling, Loader2, Layers, CheckCircle,
  Maximize, Wand2, Grid, UserRound, PenTool, Eraser, RefreshCcw, Download, Subtitles, Scissors, AudioWaveform, RotateCcw,
  Upload, Trash2, Play, ArrowRight, ArrowDown, Settings2, CheckSquare, Clapperboard, X, Table, Plus, Expand, Database, Map, Users, Package, MoreHorizontal, Copy
} from 'lucide-react';
import { fetchApi } from '@/services/api';
import { DirectorRouter } from '@/lib/director-rules';

// ✨ 放在 CustomNodes.tsx 文件顶部 imports 区域下方
const compressImage = (file: File, maxWidth = 1024): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        // 强制转为 JPEG 并压缩到 80% 质量，体积缩小 90%
        resolve(canvas.toDataURL('image/jpeg', 0.8)); 
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// ✨ 新增：强制本地转换下载引擎（解决跨域图片跳页面的Bug）
const forceDownload = async (url: string, filename: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    // 降级方案：如果极端情况 fetch 失败，使用原版跳转
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.click();
  }
};

// ✨ 高级黑玻璃禅定编辑器 (Zen Mode)
const ZenEditor = ({ value, onChange, label, onClose, placeholder, onWheelCapture, incomingAssets = [] }: any) => {
  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-12 bg-black/60 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300" onClick={onClose}>
       <div className="w-full max-w-[1000px] h-[80vh] flex flex-col bg-[#050505]/90 border border-white/10 rounded-[32px] shadow-[0_50px_100px_rgba(0,0,0,1)] overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <span className="text-white font-bold tracking-widest text-[14px] flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-400"/> 禅定编辑舱 / {label}
            </span>
            <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white bg-white/5 hover:bg-red-500/80 rounded-full transition-all"><X size={16}/></button>
          </div>
          <div className="flex-1 p-6 relative flex flex-col overflow-hidden zen-mode-container">
            <style dangerouslySetInnerHTML={{__html: `
              .zen-mode-container > div { height: 100%; display: flex; flex-direction: column; }
              .zen-mode-container textarea { flex: 1; height: 100% !important; overflow-y: auto !important; font-size: 16px !important; line-height: 1.8 !important; }
            `}} />
            <MentionTextarea value={value} onChange={onChange} placeholder={placeholder || "进入心流模式编写..."} incomingAssets={incomingAssets} />
          </div>
          <div className="px-6 py-4 border-t border-white/10 bg-white/[0.01] flex justify-end">
             <button onClick={onClose} className="px-8 py-3 bg-white text-black text-[13px] font-bold rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 transition-all">保存并返回</button>
          </div>
       </div>
    </div>,
    document.body
  );
};

import { useAppStore } from '@/store/useAppStore'; 
import { useCanvasEngine, buildImagePayload } from '@/hooks/useCanvasEngine';

// ✨ 多模型差异化分辨率动态选项生成器
// 依据后端及 useCanvasEngine.ts 所设定的参数进行严格物理对齐，防止因比例/精度不符导致 400 报错
const getImageQualityOptions = (model: string) => {
  if (model === 'seedream5.0') {
    return [
      { value: '2K', label: '2K (高清)' },
      { value: '3K', label: '3K (极致)' }
    ];
  }
  if (model === 'banana-pro') {
    return [
      { value: '1K', label: '1K (标准)' },
      { value: '2K', label: '2K (高清)' },
      { value: '4K', label: '4K (极致)' }
    ];
  }
  // gpt-image-2 或其它默认模型仅支持 1K（通过 prompt 拼装实现）
  return [
    { value: '1K', label: '1K (标准)' }
  ];
};

// ==========================================
// ==========================================
// 极简碳灰卡片基底 & 悬浮发光小白点
// ==========================================
const nodeBaseClass = "relative rounded-[24px] bg-[#18181b]/80 backdrop-blur-3xl shadow-[0_10px_40px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300";
const selectedBorderClass = "border border-white/30 shadow-[0_0_40px_rgba(255,255,255,0.05),0_10px_40px_rgba(0,0,0,0.8)]";
const unselectedBorderClass = "border border-white/[0.08] hover:border-white/20";
// ✨ 只保留左右接口，彻底抛弃上下接口
const handleBase = "!w-[24px] !h-[24px] !bg-transparent !border-none !rounded-full opacity-0 group-hover:opacity-100 z-50 flex items-center justify-center relative before:absolute before:content-[''] before:w-[12px] before:h-[12px] before:bg-white before:rounded-full before:border-[3px] before:border-[#18181b] before:shadow-[0_0_15px_rgba(255,255,255,0.9)] before:transition-all hover:before:scale-125 transition-opacity duration-300";
const handleLeft = `${handleBase} !-left-[12px]`;
const handleRight = `${handleBase} !-right-[12px]`;
// (这里保留你原本的 MentionTextarea 和 CustomSelect 代码...)

// ==========================================
// ==========================================
// ✨ 全新组件：支持 @ 唤出的超级输入框 (大图预览 + 实体命名)
// ==========================================
function MentionTextarea({ value, onChange, placeholder, incomingAssets = [], disableMention = false }: any) {
  const [showMenu, setShowMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);
    if (disableMention) {
      setShowMenu(false);
      return;
    }
    const cursor = e.target.selectionStart;
    if (val.charAt(cursor - 1) === '@') {
      setShowMenu(true);
    } else {
      setShowMenu(false);
    }
  };

  const handleSelect = (asset: any) => {
    const cursor = textareaRef.current?.selectionStart || 0;
    const textBefore = value.substring(0, cursor - 1); 
    const textAfter = value.substring(cursor);
    // 强制打上中括号标记，方便以后后端识别
    const label = `[${asset.name || '参考图'}]`;
    onChange(textBefore + label + " " + textAfter);
    setShowMenu(false);
    setTimeout(() => textareaRef.current?.focus(), 10);
  };

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-zinc-100 px-6 py-4 min-h-[100px] resize-none text-[15px] leading-relaxed custom-scrollbar placeholder-zinc-600 nodrag nopan"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
      />
      
      {showMenu && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-[360px] max-h-[300px] overflow-y-auto custom-scrollbar bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/20 rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.95)] p-1.5 z-[999999] animate-in fade-in slide-in-from-top-2">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 py-2 border-b border-white/[0.05] mb-1 flex justify-between items-center">
            插入已连线参考元素 <span className="text-[8px] bg-white/10 px-1.5 py-0.5 rounded text-zinc-400 font-mono">ESC 取消</span>
          </div>
          {incomingAssets.length === 0 ? (
            <div className="px-3 py-6 text-[12px] text-zinc-500 text-center font-light">暂无输入节点，请先从资产表拉取连线</div>
          ) : (
            incomingAssets.map((asset: any, idx: number) => (
              <div key={idx} onClick={() => handleSelect(asset)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-[12px] cursor-pointer transition-all group">
                {asset._type === 'image' 
                  ? <img src={asset.url} className="w-12 h-12 rounded-[10px] object-cover border border-white/10 shadow-md group-hover:scale-110 transition-transform" />
                  : <div className="w-12 h-12 rounded-[10px] bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform"><Film size={16} className="text-zinc-300"/></div>
                }
                <div className="flex flex-col flex-1 overflow-hidden">
                  <span className="text-[13px] font-bold text-zinc-200">{asset.name || `参考图-${idx + 1}`}</span>
                  <span className="text-[11px] text-zinc-500 truncate mt-1">{asset.prompt || '未命名媒体文件'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// 悬浮下拉菜单组件 (终极防呆版：点击打开/关闭，智能向左弹出，层级最高)
function CustomSelect({ value, options, onChange, icon: Icon, className = "", menuPosition = "bottom" }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((o: any) => o.value === value) || options[0];

  // 点击外部自动关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  let positionClasses = "top-full left-0 pt-2 origin-top";
  if (menuPosition === "top") positionClasses = "bottom-full left-0 pb-2 origin-bottom";
  else if (menuPosition === "left") positionClasses = "top-1/2 -translate-y-1/2 right-full pr-3 origin-right";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className={`relative w-full flex items-center justify-between rounded-full px-4 py-2 text-[13px] font-medium cursor-pointer transition-all duration-300 ${isOpen ? 'bg-white/10 text-white' : 'bg-transparent text-zinc-300 hover:bg-white/5'}`}
      >
        <span className="truncate relative z-10 flex-1 text-left">{selectedOption?.label}</span>
        {Icon ? <Icon size={14} className="text-zinc-500 relative z-10 ml-2" /> : <ChevronDown size={14} className="text-zinc-500 relative z-10 ml-1.5" />}
      </div>
      
      <div 
        className={`absolute min-w-[160px] z-[99999] transition-all duration-300 ${positionClasses} ${isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#050505]/95 backdrop-blur-3xl border border-white/10 rounded-[16px] shadow-[0_40px_100px_rgba(0,0,0,0.95)] py-1.5 px-1">
          {options.map((opt: any) => (
            <div 
              key={opt.value} 
              onClick={() => { onChange(opt.value); setIsOpen(false); }} 
              className={`px-4 py-3 mx-1 text-[12px] font-medium cursor-pointer rounded-[10px] transition-colors ${value === opt.value ? 'text-white bg-white/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
// ==========================================
// 1. 主剧本节点 (MasterScriptNode) —— "制片人总控台" + 悬浮场记抽屉
// ==========================================
export const MasterScriptNode = ({ id, data, selected }: any) => {
  const { updateNodeData, setNodes, setEdges, getNodes, getEdges } = useReactFlow();
  const [selectedText, setSelectedText] = useState("");
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });
  
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [extractingAsset, setExtractingAsset] = useState<string | null>(null); // ✨ 新增：控制资产表格提取状态
  const [showAssetMenu, setShowAssetMenu] = useState(false); // ✨ 新增：控制提取菜单
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 引入队列引擎
  const { enqueueTask } = useCanvasEngine();

  const handleTextSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const text = target.value.substring(target.selectionStart, target.selectionEnd);
    setSelectedText(text.trim());
    setSelectionRange({ start: target.selectionStart, end: target.selectionEnd });

    if (text.trim() && data.sceneInterceptState !== 'confirming') {
      // ✨ 修复：只要重新划选文字，就清空之前书签触发的高亮连线
      updateNodeData(id, { sceneInterceptState: 'idle', activeTargetIds: [] });
    }
  };

  const handleExtractCamera = async () => {
    if (data.isExtractingCamera || !data.text) {
      if (!data.text) useAppStore.getState().setToastMsg("请先在上方输入剧本！");
      return;
    }
    updateNodeData(id, { isExtractingCamera: true });
    useAppStore.getState().setToastMsg("正在通读全剧本，锁定电影级全局机位...");
    
    try {
      const targetModel = data.model || 'deepseek-v4-pro';
      
      // ✨ 痛点 1 修复：获取当前画布全局画风设置
      const globalStyle = useAppStore.getState().canvasSettings?.globalPromptSuffix || "无特定风格";

      const payload = {
        model: targetModel,
        messages: [
          {
            role: "system",
            content: `你是一个顶尖的影视视觉总监（兼任摄影指导与美术指导）。请阅读完整剧本，推荐1套最契合的【英文全局视觉基建（涵盖介质/画风/光影基调）】。

【全局画风硬约束】：当前项目已设定为【${globalStyle}】。你的所有推荐必须绝对契合此风格大类！

【最严格的双轨物理隔离法则（绝对红线）】：
1. 如果上方画风属于【二次元/动画/动漫】类：绝对禁止出现任何实拍物理摄影机（如 ARRI, RED）、胶片型号（如 35mm, Kodak Vision3）、实体镜头（如 Anamorphic, C-Series, 50mm）的词汇！二次元哪来的胶片和镜头？！你必须使用纯动画术语，如：Studio Ghibli animation, Cel shading, flat colors, Anime aesthetic, Kyoto Animation style。
2. 如果上方画风属于【3D渲染】类：禁止使用实拍物理设备，必须使用：Unreal Engine 5 render, Octane render, Ray tracing, 3D CGI。
3. 只有当上方画风属于【写实/电影/无特定风格】类时：才允许并必须使用顶级电影工业设备，如：Shot on ARRI Alexa 65, 35mm film, vintage anamorphic lenses。

【参数生成逻辑（不要将推理过程输出）】：
1. 视觉介质 (Medium & Engine)：极简定义底层渲染质感（必须遵照上述双轨法则）。
2. 光学/笔触特性：实拍定义镜头畸变/质感（不写死焦距）；动画定义线条/手绘质感。
3. 全局色彩底片 (Color Science & LUT)：极简定义全片色彩逻辑（如 Bleach Bypass，或 Anime pastel color palette）。
4. 全局光影反差 (Macro Contrast)：定义软硬基调（如 Hard-contrast）。【时间与光源方向必须 100% 留白交由分镜决定！】

【最终输出铁律】：
你必须将上述四项参数用逗号自动拼接成【纯英文的一句话】。
绝对禁止输出任何中文、前言后语、序号或解释！
错误示范（二次元里掺杂实拍）：Shot on 35mm Kodak, Anime style...
正确示范（纯二次元）：Studio Ghibli animation, soft watercolor pastel palette, Cel shading, cinematic low-contrast light
正确示范（纯实拍）：Shot on ARRI Alexa 65, Vintage Cooke Anamorphic lenses, Bleach Bypass LUT, Hard-contrast cinematic lighting`
          },
          { role: "user", content: `剧本内容：\n${data.text.substring(0, 8000)}` }
        ]
      };

      const response = await fetchApi('/v1/chat/completions', { method: 'POST', body: JSON.stringify(payload) });
      const resData = await response.json();
      const cameraParams = resData.choices?.[0]?.message?.content?.trim() || "Shot on 35mm lens, cinematic lighting, 8k resolution";
      
      updateNodeData(id, { globalCamera: cameraParams, model: targetModel });
      useAppStore.getState().setToastMsg(`✅ 全局摄影机 & 调性已锁定！`);
    } catch (error: any) {
      console.error("提取摄影机失败:", error);
      useAppStore.getState().setToastMsg(`摄影机锁定失败: ${error.message || '请检查模型或网络'}`);
    } finally {
      // 🔥 无论成功失败，确保关闭转圈
      updateNodeData(id, { isExtractingCamera: false });
    }
  };

  // ✨ 全新：盘点并直接裂变出【资产表格节点】(强制中文+自动硬拼接)
  const handleExtractAssetTable = async (type: 'scene' | 'character' | 'prop') => {
    if (!data.text) return useAppStore.getState().setToastMsg("请先在上方输入剧本！");
    setExtractingAsset(type);
    setShowAssetMenu(false);
    useAppStore.getState().setToastMsg(`正在通读剧本，提炼${type === 'scene' ? '场景' : type === 'character' ? '角色' : '道具'}数据表...`);
    
    try {
      const targetModel = data.model || 'deepseek-v4-pro';
      
      // ✨ 核心修复：提取全局导演上下文，让提取资产表格时拥有导演审美意志
      const canvasSettings = useAppStore.getState().canvasSettings;
      const directorCtx = canvasSettings?.directorGenre && canvasSettings.directorGenre !== 'default'
        ? DirectorRouter.resolve(canvasSettings.directorGenre, canvasSettings.directorTempo || undefined)
        : null;
      
      // 组装注入块，如果存在导演规则，则强行附加在 systemPrompt 尾部
      const directorInjection = directorCtx 
        ? `\n\n【导演全局视觉约束，提取资产时必须遵循此光影与色彩基调】：\n${directorCtx.llmContextBlock}` 
        : "";

      let systemPrompt = "";
      
      if (type === 'scene') {
        systemPrompt = `你是一个顶尖的电影美术指导。通读剧本，提取所有核心场景，场景要符合剧本元素特征，输出正确的空间描述，全部提取为正面全景。
如剧本中未标明剧本背景（如西方，统一设定为东方风格设定）
【绝对红线】：场景提示词(prompt)中绝对不允许出现任何人物角色！这只是一张空镜头环境概念设定图！场景中不可以出现元素之间的冲突违和，比如现代办公室不允许出现与时代或者环境不符的元素，例如清冷科技感的办公室出现粗糙的木制办公桌（除非剧本元素中包含），禁止使用夸张的色调，尽量以柔光为主，三点布光原则。
要求返回 JSON 数组格式，字段严格为：
[{"id": "s1", "name": "场景名", "time": "白天/夜晚/傍晚等", "lighting": "极简纯英文光影描述(如: diffuse light, low contrast)", "stage": "该场景在剧本哪几个阶段出现", "prompt": "纯中文场景环境描述。请参考此结构：
示例：
正面全景
核心氛围：死寂、诡异、压抑。这里是生命被遗忘的角落，也是故事开始的宿命之地。
关键元素：
 环境：遍地是杂乱无章的低矮坟包和断裂、歪斜的残碑。枯死的黑色树枝像鬼爪般伸向天空...等环境里的元素。
特殊细节：空气中弥漫着极淡的、似有似无的灰绿色雾气。绝对不要写摄影机参数，绝对不要写任何人物！"}]`;
      } else if (type === 'character') {
        systemPrompt = `你是一个顶尖的电影造型指导。通读剧本，提取所有出场人物。
【绝对红线】：这是角色设定图/静态立绘，绝对不要描写人物的具体剧情动作或场景交互！若同一人物在不同时期着装不同，必须分为两个独立人物行。
【人物面容与种族自动识别约束】：请根据剧本的世界观和故事区域，自动识别并生成符合逻辑的人物种族面貌描述。若剧本背景为中国本土、东方文化地域、或未明确标明任何地域/种族特征，一概默认所有出场人物均为【中国华人】面容，保留亚洲人的五官骨架、肤色和毛发特征。若剧本明确标注为西方、异世界、奇幻、科幻等非中国背景地域，则严格按照剧本本身的暗示生成对应种族面孔。在你的 prompt 字段中，必须在最前面明确描述这个人物的具体人种与五官特征。
要求返回 JSON 数组格式，字段严格为：
[{"id": "c1", "name": "人物名称", "age": "年龄", "clothing": "极简中文着装描述", "traits": "人物性格与特质", "stage": "出场阶段", "prompt": "纯中文角色设定描述。只需详细描写：性别、年龄、长相、外貌特征、体态、穿着款式材质、特殊细节(如伤疤/配饰)。保持静态站立姿态，绝对不要写动作、光影或画质参数！"}]`;
      } else if (type === 'prop') {
        systemPrompt = `你是一个顶尖的电影道具师。通读剧本，提取核心道具。
要求返回 JSON 数组格式，字段严格为：
[{"id": "p1", "name": "道具名", "stage": "出现节点", "prompt": "纯中文道具细节描述(详细描述材质、颜色、磨损程度和外观细节，保持静态单独展示)"}]`;
      }

      // 将 systemPrompt 与 directorInjection 拼接发送
      const payload = { 
        model: targetModel, 
        messages: [
          { role: "system", content: systemPrompt + directorInjection }, 
          { role: "user", content: `剧本内容：\n${data.text.substring(0, 15000)}` }
        ] 
      };
      
      const response = await fetchApi('/v1/chat/completions', { method: 'POST', body: JSON.stringify(payload) });
      const resData = await response.json();
      const rawContent = resData.choices?.[0]?.message?.content || "";
      
      let cleanJson = rawContent;
      const match = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) cleanJson = match[1];
      const parsedRows = JSON.parse(cleanJson.trim());

      // ✨ 核心魔法：在表格生成瞬间，立刻把 LLM 的中文 prompt 加上光影和全局摄影机！
      const finalRows = parsedRows.map((row: any) => {
         let assembledPrompt = row.prompt || '';
         const lightStr = row.lighting ? `, ${row.lighting}` : '';
         const cameraStr = data.globalCamera ? `, ${data.globalCamera}` : '';
         assembledPrompt = `${assembledPrompt}${lightStr}${cameraStr}`;
         return { ...row, prompt: assembledPrompt };
      });

      const thisNode = getNodes().find(n => n.id === id);
      const baseX = thisNode ? thisNode.position.x : 0;
      const baseY = thisNode ? thisNode.position.y : 0;
      const existingTablesCount = getNodes().filter(n => n.type === 'assetTable').length;
      
      const newNodeId = `asset_table_${type}_${Date.now()}`;
      // ★ 继承全局比例设置，确保资产表默认比例与中控台一致
      const inheritedRatio = useAppStore.getState().canvasSettings.globalRatio || '16:9';
      const newTableNode = {
        id: newNodeId, type: 'assetTable',
        position: { x: baseX + 650, y: baseY - 100 + (existingTablesCount * 450) },
        data: { assetType: type, rows: finalRows, ratio: inheritedRatio } // 继承全局比例 + 组装好的 finalRows
      };

      const newEdge = { 
        id: `e-${id}-${newNodeId}`, source: id, target: newNodeId, sourceHandle: 'right', targetHandle: 'left', 
        type: 'default', animated: true, style: { stroke: 'rgba(217, 70, 239, 0.8)', strokeWidth: 2, strokeDasharray: '8 8', animationDuration: '3s' } 
      };

      setNodes((nds) => [...nds, newTableNode]);
      setEdges((eds) => [...eds, newEdge]);
      useAppStore.getState().setToastMsg(`✅ ${type === 'scene' ? '场景' : type === 'character' ? '角色' : '道具'}数据表生成成功！`);

    } catch (error: any) {
      useAppStore.getState().setToastMsg(`数据表生成失败: ${error.message}`);
    } finally {
      setExtractingAsset(null);
    }
  };



  const handleFissionShots = async () => {
    if (data.isGenerating || !selectedText) return;
    updateNodeData(id, { isGenerating: true });
    
    try {
      const targetModel = data.model || 'deepseek-v4-pro';
            // ✨ [新增] 抓取画布上的资产基建表，构建 LLM 随身字典
            const assetTables = getNodes().filter(n => n.type === 'assetTable');
            let dictText = "【以下是全局基建资产字典，通读剧本时请务必自行比对人物和场景，提取对应的特征和光影(光影必须用纯英文输出)】\n";
            assetTables.forEach(table => {
              if (!table.data.rows) return;
              const type = table.data.assetType;
              table.data.rows.forEach((r: any) => {
                if (type === 'scene') dictText += `[场景: ${r.name || '未命名'}]: 英文光影氛围-${r.lighting || ''}, 场景描述-${r.prompt || ''}\n`;
                if (type === 'character') dictText += `[角色: @${r.name || '未命名'}]: 着装-${r.clothing || ''}, 角色描述-${r.prompt || ''}\n`;
                if (type === 'prop') dictText += `[道具: ${r.name || '未命名'}]: 描述-${r.prompt || ''}\n`;
              });
            });
            if (assetTables.length === 0) dictText = ""; // 没建档就不干扰

            // ✨ 自动扫描当前画布，计算下一次裂变的起始镜号
            const existingShots = getNodes().filter(n => n.type === 'shot');
            let maxShotNum = 0;
            existingShots.forEach(n => {
               const numStr = String(n.data.shotNumber).match(/\d+/);
               const num = numStr ? parseInt(numStr[0], 10) : 0;
               if (num > maxShotNum) maxShotNum = num;
            });
            const nextShotStart = maxShotNum + 1;

      // 导演路由引擎：裂变前解析题材与节奏参数
      const canvasSettings = useAppStore.getState().canvasSettings;
      const directorCtx = canvasSettings?.directorGenre && canvasSettings.directorGenre !== 'default'
        ? DirectorRouter.resolve(canvasSettings.directorGenre, canvasSettings.directorTempo || undefined)
        : null;

      // ==========================================
      // 🚀 工业级管道 1: 视频分镜拆解 (100% 满血还原，绝不删减)
      // ==========================================
      useAppStore.getState().setToastMsg("阶段 1/2：正在执行工业级分镜拆解 (运镜与时序推断)...");
      const payloadStage1 = {
        model: targetModel,
        messages: [
          {
            role: "system",
            content: `你是一名大师级分镜师兼 AI 提示词专家。你的任务是通读剧本，将剧本高级地转化为符合 AI 视频生成大模型底层逻辑的生产级分镜 JSON 数据。

【智能光影推断 (shotLighting 字段)】
你必须在 JSON 中为每一个分镜强制输出纯英文的 "shotLighting" 字段！
推断优先级与打光规则（严格按以下顺序执行）：
1. 优先查表与氛围继承（资产表为最高准则）：首先比对你在上下文中看到的【资产字典】。如果该场景在字典中已定义了“英文光影氛围”，你必须 100% 继承其核心色温与反差基调（如始终保持冷暖对比、低照度等），并以此为底色。
2. 导演规则补底（降级回退）：如果未提供资产字典，或字典中该场景没有光影描述，你才需要去查阅下方《导演审美引导》中的光影倾向，使用导演推荐的英文光影咒语（English Lighting Prompts）进行打光推断。
3. 景别裁剪（防画面污染）：基调确立后，必须结合当前分镜的具体动作与【景别】推断物理光线方向。若为[特写/极特写/近景]，绝对禁止描写画外背景光源的实体，只能输出打在主体面部/身上的纯物理光线方向与质感（如: cool blue edge light on right cheek, high contrast）。
4. 全景保留：若为[全景/远景]，则需展现整体环境的体积光或主光源分布。

【视频分镜拆解铁律】
1. 景别参考规则：优先识别剧本中已有的景别标记(如[特写]、[全景]、[中景]、[近景])，每个分镜时长严格控制在 4-15s 之间。
2. 对白时长 vs 导演节奏的优先级铁律（数学红线）：
强制计算公式：【本镜对白总中文字数 ÷ 3.5 = 必须满足的最低物理安全时长（秒）】。AI 在输出每个分镜前，必须严格执行此数学计算！
 - 优先级判定：物理计算此时长绝对优先于《导演审美引导》中的节奏建议！例如：若导演建议节奏为 1-3秒，但当前台词计算需要 8秒，你必须将 duration 设定为 8秒！
 - 节奏补偿法则：如何在被台词拉长的分镜中体现导演的“快节奏”？通过切碎 timeSegments 内部的时序段来完成！（例如：8 秒的镜头，内部切分为 3-4 个剧烈的物理动作或机位转折，以此制造高密度的视觉快感）。
 - 强制拆镜红线：绝不允许将超过计算时长的台词强塞入短时长的分镜中，绝不允许两人在同一时序内静止站立说出长篇大论！若某段连续台词耗时超过 15 秒（或总字数超过 40 字），除非导演引擎明确要求“舒缓/长镜头”，否则强制要求你将此分镜拆分为多个独立镜号（如 2A 拍陈医生说话，2B 拍顾医生反应或回复）交替消化对白！
3. 单分镜内的时序切分铁律（防偷懒与运镜解绑机制）：只要单个分镜时长>=8秒，或对白>15字，严禁在画面主体中只写一个时间段！你必须将其物理拆分为至少两个时序(如 0-5s 和 6-10s)。在时序切换时，不要局限于“硬切”，更鼓励使用连续长镜头内的“动态演进”(如动作连贯延展、平滑推拉跟摇、焦点转换 Rack Focus)。
4. 物理视觉化描述铁律（去文学化与微表情优化）：禁止文学形容词，必须转化为物理视觉指令。情绪必须转化为微表情(如“眉头微皱”)。详细描述肌肉牵扯、物理位移、衣服褶皱变化及道具物理交互。
5. 人物空间站位与“时序状态锚定”铁律：在每一个 timeSegments 时间段描述内，只要提及人物动作，必须强行在名字前增加当前姿态/站位状态的修辞锚定词！(如：强制写为“坐在工作台后的 @老匠人 缓缓落下镊子”)，防姿态突变。
6. 长镜头/硬切判定：若分镜内部包含“硬切”、“黑屏”或任何形式的画面跳转，严禁在该镜号中声明其为“连续长镜头（continuous shot / single take）”。只有完全无间断、仅靠运镜和焦点变化完成全部时序的镜头，才允许冠以长镜头描述。
7. 空间轴线锚定（防跳轴）：在双人、多人对话或同场景连续分镜中，强制锁定左右站位关系。角色 A 永远留在画面左区，角色 B 永远留在画面右区。绝对不允许越轴，除非中间插入明确越过轴线的过渡镜头（如中性空镜、第三视角游移镜头）。
8. 双人/多人 Z 轴定位：必须采用“一前一后，必有一背”的前后物理位置关系，至少一方使用过肩镜头或脏前景。
9. 禁止描写人物穿着：严禁在首帧或画面主体中描写人物的服装款式、颜色、材质以及发型发色（这些由参考原图或人设控制）

【输出规范 (JSON Format)】
必须严格按照以下 JSON 结构输出，包含后台算力、时序段、音效台词及机位规则：
- shotNumber: 镜号（注意：当前画布已有分镜，本次拆分的镜号必须严格从 ${nextShotStart} 开始依次递增！例如：${nextShotStart}, ${nextShotStart}A, ${nextShotStart + 1} 等）
- scriptFragment: 该分镜对应的剧本原文片段
- wordCount: 对白字数
- duration: 计算出的物理时长(4-15s)
- scene: 物理场景描述
- characters: 本镜头出场角色（如 @老匠人）
- timeSegments: 时序演进数组(包含 id, time, action)。action 必须包含景别、具体画面的物理运动、人物具体的身体/面部物理动作变化等描述，若为首个时序则无需写切换方式。要求使用纯粹的物理动作指令，禁止使用抽象形容词。。
- soundDesign: 音效与台词设计(包含 audio 和 dialogue)
- cameraRules: 机位规则(如 nodal pan locked tripod)
- scene: 物理场景描述
- characters: 本镜头出场角色（如 @老匠人）

【完整示例参考（长安青铜工坊：暮色机械美学）】
(用户剧本：[全景]昏暗的青铜工坊里。老匠人坐在堆满图纸的工作台前。[特写]生锈的青铜手臂放在桌上。老匠人拿着镊子夹齿轮。[中景]老匠人神色疲惫。他缓缓摘下眼镜，擦了擦。[特写]老匠人看着未完成的机械臂，痛苦地说了一长段长台词：“他们都走了...连一块墓碑也留不下了...”)

\`\`\`json
{
  "shots": [
    {
      "shotNumber": "1",
      "scene": "昏暗的青铜工坊",
      "characters": "@老匠人",
      "scriptFragment": "[全景]昏暗的青铜工坊里。老匠人坐在堆满图纸的工作台前。[特写]生锈的青铜手臂放在桌上。老匠人拿着镊子夹齿轮。",
      "wordCount": 0,
      "duration": 8,
      "timeSegments": [
        { "id": "ts1", "time": "0-4s", "action": "特写镜头，坐在工作台后侧、身体前倾的 @老匠人 缓缓沉下右手。他手中的铜镊子尖端精准咬合住机械臂内的一颗微型齿轮并向内按压，齿轮下陷，机械臂的手指关节随之产生微小的受力回弹。" },
        { "id": "ts2", "time": "5-8s", "action": "动作连贯延展，特写镜头，保持微俯姿势的 @老匠人，右手手指松开镊子，顺势拨动机械臂旁边的发条手柄。手背的肌肉线条因发力而拉紧，夕阳斜照下，工作台上的阴影随着他的手部转动动作缓缓拉长。" }
      ],
      "soundDesign": { "audio": "低频机械嘀嗒声，镊子与铜器轻微碰撞声，远处沉闷的风啸声。", "dialogue": "无" },
      "cameraRules": "0-8s: nodal pan locked tripod, static shot."
    },
    {
      "shotNumber": "2A",
      "scene": "昏暗的青铜工坊",
      "characters": "@老匠人",
      "scriptFragment": "[中景] 老匠人神色疲惫。他缓缓摘下眼镜，擦了擦。痛苦地说：“他们都走了，只剩我这个半截入土的罪人。这只手，我拼上这条命也必须要将它拼完……”",
      "wordCount": 32,
      "duration": 10,
      "timeSegments": [
        { "id": "ts1", "time": "0-5s", "action": "中景镜头，坐在木椅上的 @老匠人，双手动作迟缓地将眼镜从脸上摘下并移至胸前，用粗糙的衣袖用力在镜片上擦拭了两下，他的胸口起伏，完成一次沉重的呼吸。" },
        { "id": "ts2", "time": "6-10s", "action": "镜头缓慢推进 (Slow push-in)，近景镜头，戴回眼镜且坐在木椅上的 @老匠人 头部微垂。随着镜头的逼近，他的眼角肌肉产生疲惫的微颤，下巴微收，视线没有聚焦，双眼缓缓向下游离。" }
      ],
      "soundDesign": { "audio": "老匠人疲惫的深呼吸声，金属关节摩擦的响声。", "dialogue": "[02-10s] @老匠人（凄凉，低语）：“他们都走了，只剩我这个半截入土的罪人。这只手，我拼上这条命也必须要将它拼完……”" },
      "cameraRules": "0-5s: static camera. 6-10s: slow continuous camera push-in."
    },
    {
      "shotNumber": "2B",
      "scene": "昏暗的青铜工坊",
      "characters": "@老匠人",
      "scriptFragment": "“如果连我都放弃了，那长安城内三十万死去的冤魂，就真的连一块墓碑也留不下了……”",
      "wordCount": 38,
      "duration": 11,
      "timeSegments": [
        { "id": "ts1", "time": "0-5s", "action": "近景镜头，双手抱头且上半身俯在工作台前的 @老匠人 双眼紧闭。随着他情绪的抽动，额头的皱纹明显加深，嘴角向下紧抿，一滴反光的泪水顺着粗糙的面部皮肤缓缓向下滑落。" },
        { "id": "ts2", "time": "6-11s", "action": "焦点转换 (Rack Focus) 伴随动作延展，微特写镜头，保持抱头伏案姿态不动的 @老匠人，镜头焦点完全锁定在他面部下半段。他的下巴肌肉因哭泣而产生细微且短促的颤动，嘴唇微张。" }
      ],
      "soundDesign": { "audio": "老匠人颤抖的哭腔，沙哑的喉音，远处沉闷的钟声。", "dialogue": "[01-11s] @老匠人（痛苦咽泣）：“如果连我都放弃了，那长安城内三十万死去的冤魂，就真的连一块墓碑也留不下了……”" },
      "cameraRules": "0-5s: static camera. 6-11s: macro lens, rack focus on the mouth and chin."
    }
  ]
}
\`\`\`
 注意：本次只需输出视频动作和时序数据，生图的光影和首帧锚定在后续处理。
${directorCtx?.llmContextBlock || ''}`
          },
          { 
            role: "user", 
            content: `${dictText}\n\n【照抄用的英文全局摄影参数】：\n${data.globalCamera}\n\n【需拆解的分镜剧本选段】：\n${selectedText}`
          }
        ]
      };

      const res1 = await fetchApi('/v1/chat/completions', { method: 'POST', body: JSON.stringify(payloadStage1) });
      const data1 = await res1.json();
      if (!res1.ok || data1.error) throw new Error(`阶段1请求失败: ${data1.error?.message || res1.statusText}`);
      
      const raw1 = data1.choices?.[0]?.message?.content || "";
      let cleanJson1 = raw1;
      const match1 = raw1.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match1) {
          cleanJson1 = match1[1];
      } else {
          const start = raw1.indexOf('{');
          const end = raw1.lastIndexOf('}');
          if (start !== -1 && end !== -1 && end >= start) cleanJson1 = raw1.substring(start, end + 1);
      }
      
      const json1 = JSON.parse(cleanJson1.trim());
      if (!json1.shots) throw new Error("大模型返回的数据缺少 shots 字段");

      // ==========================================
      // 🚀 工业级管道 2: 首帧静帧提取 (融合《依然拆帧》+《六大铁律》)
      // ==========================================
      useAppStore.getState().setToastMsg("阶段 2/2：正在提炼顶级生图咒语 (光影注入与空间锚定)...");
      const payloadStage2 = {
        model: targetModel,
        messages: [
          {
            role: "system",
            content: `你是一名顶级AI生图提示词专家。你的任务是根据提供的【视频分镜结构】，为每一个分镜生成严格符合规范的首帧图生图提示词。

【绝对核心准则】
0. 物理空间站位与调度约束（万物皆有坐标）：
   无论景别多近，只要画面出现人物，必须在名字前强行绑定【空间参照物 + 身体基本姿态】！包含：相对距离（如紧贴、相距一臂）、高低落差（如形成以A为低点、B为高点的三角站位）以及当前姿态（站/蹲/跪）。若原分镜未提及，必须根据逻辑主动推演补充。
1. 100%物理照抄光影与机位（防闪烁法则）：
必须直接照抄提供的【英文全局摄影参数】，以及上一级为你智能推断出的【shotLighting 参数】！绝对不允许你自行修改、意译，绝对禁止你自行补充任何新的光线方向或光效词汇！ 你的任务只是将它们无缝拼接到提示词中。
2. 中英混合公式（严格按此顺序拼接）：
   提示词结构 = [当前景别与具体机位角度(含前景遮挡,中文)] + [光影光源方向(中文)] + [画面主体与场景环境(含Z轴站位,中文)] + [面部朝向与视线落点(中文)] + [定格物理动作/蓄力势能(中文)] + [定格微表情(中文)] + [动作引发的视觉动态(如飞溅/飘动,中文)] + [照抄英文全局摄影机参数] + [原样照抄分镜结构里的 shotLighting] + [动态人物肤质后缀(中文)]
3. 定格动作约束（首帧势能法则）：
   严禁使用 ongoing 动态词（如 ❌ '奔跑着'，改为 ✅ '单脚腾空跨步的悬停瞬间'）。动作必须写成起始瞬间、肌肉紧绷状态或重心失衡趋势，展现出即将发生下一秒动作的【运动势能】。

【八大物理铁律（必须严格应用）】
1. 拒绝“大头贴”，强制空间与Z轴关系：
   双人/多人时，严禁无前景的单人正面特写。强制启用 Z 轴定位（口诀：一前一后，必有一背），必须使用带“脏前景”（如画面边缘带入角色B模糊的肩膀）或过肩镜头（OTS）。
2. 机位角度与视线轴线锚定：
   必须明确当前画面的摄影机物理角度（平视/低角度仰拍/高角度俯拍）。单人镜头严禁正脸直视镜头！必须指定面部朝向（侧脸/四分之三侧脸）和视线落点（看向画外左/右、低头看手），以暗示画外空间。
3. 强化“运动矢量”与“视觉动态”：
   除了描述肌肉状态和重心变化，若有激烈动作，必须补充视觉动态（如：完全刺出的剑带出的飞溅物、衣摆因剧烈动作的撕裂状飞舞、发丝被风吹乱）。
4. 空间轴线死锁（防跳轴）：
   双人对话锁定左右站位关系。禁止使用抽象的“画面左侧/右侧”，必须以角色自身的左右或明确的物理空间参照物来描述。
5. 环境与光影死锁（造型零定义）：
   同一物理场景光影必须全程继承。绝对禁止在 Prompt 中描写人物的服装款式、颜色、材质以及发型发色（这些由外置原图控制），只描述物理交互。
6. 空镜头雷区：
   纯场景/空镜头描述中，绝对禁止出现任何人物、动物或生物的描绘。
7. 视频运镜特效词禁忌（防 AI 崩坏）：
   绝对禁止在静帧描述中写入视频运镜词或时间词（如：❌残影、❌虚化、❌晃动、❌镜头推近、❌开始、❌然后），所有描述必须是一瞬间的纯静态视觉画面！
8. 微表情写实化：
   禁止使用夸张失真的抽象情绪词（如：❌脖子青筋鼓起、❌双目瞪圆/充血），必须改为可画出的肌肉微表情（如：眼角肌肉抽动、眉头紧锁）。

【动态人物质感后缀规则】
- 若画面涉及人物，尾部必须强制添加肤质描述。
- 默认后缀：1:1真实肤色，可见皱纹，可见毛孔，细微绒毛。
- 特例（红线注意）：若角色为年轻女性或小孩，必须智能剔除“粗糙”与“皱纹”，保留为：1:1真实肤色，细腻毛孔，细微绒毛。

【输出格式绝对契约】
你必须输出一个 JSON 对象，包含 "imagePrompts" 字段（字符串数组），必须一一对应传入的分镜顺序。
\`\`\`json
{
  "imagePrompts": [
    "特写，低角度仰拍，越肩视角，边缘带入模糊的木柱前景。侧面暖色硬光。昏暗青铜工坊内，坐在工作台后侧木椅上的 @老匠人，身体重心前倾，面部呈现3/4侧脸，视线向下锁定手中的机械零件。右手紧握铜镊子悬停在半空正欲夹取齿轮的蓄力瞬间，额头皱纹微显，灰尘在光柱中悬浮。Shot on 35mm Kodak Vision3 500T 5219, Wong Kar-wai low saturation... warm macro side light, deep shadow... 1:1真实肤色，可见皱纹，可见毛孔，细微绒毛"
  ]
}
\`\`\``
          },
          { 
            role: "user", 
            content: `【照抄用的英文全局摄影参数】：\n${data.globalCamera}\n\n【需提取首帧图的已拆解分镜结构数组(含已由上级严格定义的shotLighting和物理动作)】：\n${JSON.stringify(json1.shots, null, 2)}`
          }
        ]
      };

      const res2 = await fetchApi('/v1/chat/completions', { method: 'POST', body: JSON.stringify(payloadStage2) });
      const data2 = await res2.json();
      if (!res2.ok || data2.error) throw new Error(`阶段2请求失败: ${data2.error?.message || res2.statusText}`);

      const raw2 = data2.choices?.[0]?.message?.content || "";
      let cleanJson2 = raw2;
      const match2 = raw2.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match2) {
          cleanJson2 = match2[1];
      } else {
          const start = raw2.indexOf('{');
          const end = raw2.lastIndexOf('}');
          if (start !== -1 && end !== -1 && end >= start) cleanJson2 = raw2.substring(start, end + 1);
      }
      const json2 = JSON.parse(cleanJson2.trim());

      // ==========================================
      // 🚀 缝合输出阶段 (Data Merging)
      // ==========================================
      const fissionResult = {
        shots: json1.shots.map((shot: any, idx: number) => ({
          ...shot,
          imagePrompt: json2.imagePrompts?.[idx] || "提取失败，请手动编写静态提示词"
        }))
      };

      const thisNode = getNodes().find(n => n.id === id);
      const baseX = thisNode ? thisNode.position.x : 0;
      const baseY = thisNode ? thisNode.position.y : 0;

      // ★★★ 智能列布局：不同裂变批次自动排列到不同列，永不重叠
      // 扫描画布上所有已有 ShotNode，按 X 坐标归列（X差 < 200px 算同一列）
      const allShotNodes = existingShots; // 复用上方已声明的 existingShots
      const columns: number[] = []; // 每列的 X 坐标中位数
      allShotNodes.forEach(n => {
        // 检查是否属于已存在的列
        const foundCol = columns.find(colX => Math.abs(n.position.x - colX) < 200);
        if (!foundCol) columns.push(n.position.x);
      });
      // 新批次排到下一列
      const colIndex = columns.length;
      const targetColumnX = baseX + 850 + colIndex * 650;

      // 计算该列的 Y 起始位置（取该列最底部节点的 bottom）
      let maxBottomY = baseY - 50;
      allShotNodes.forEach(n => {
        if (Math.abs(n.position.x - targetColumnX) < 200) {
          // 优先使用 React Flow 测量的真实高度，回退取 DOM 实际高度，再不行用预估 560px
          let height = n.measured?.height;
          if (!height) {
            const el = document.querySelector(`[data-id="${n.id}"]`) as HTMLElement;
            height = el?.offsetHeight || 560;
          }
          const bottom = n.position.y + height;
          if (bottom > maxBottomY) maxBottomY = bottom;
        }
      });
      
      let newNodes: any[] = [];
      let newEdges: any[] = [];
      let createdShotIds: string[] = []; // ✨ 记录本次生成的节点 ID

      fissionResult.shots.forEach((shot: any, index: number) => {
        // ✨ 痛点修复：大幅拉大 Y 轴间距，避免 2 级卡片挤在一起
        const targetY = maxBottomY + 80 + (index * 560); 
        const shotId = `shot_${Date.now()}_${index}`;
        
        createdShotIds.push(shotId); // 存入记录
        
        const timeSegmentsText = (shot.timeSegments || []).map((ts: any, i: number) => `【时序段 ${i + 1}】${ts.time}：${ts.action}`).join('\n');
        
        const fullVideoPrompt = `时长：${shot.duration || 5}s\n场景：${shot.scene || '未知'} / 出场人物：${shot.characters || '无'}\n\n画面主体（包含场景变化等等）：\n${timeSegmentsText}\n\n音效与台词设计：\n* 音效：${shot.soundDesign?.audio || '无'}\n* 台词：${shot.soundDesign?.dialogue || '无'}\n\n每个时间段的机位规则：\n${shot.cameraRules || '无'}\n\n全局约束：\n* 禁止：字幕、BGM、人物滤镜，完美人物，画面闪烁，人物漂移，手部畸形。\n* 通用基础约束：Photorealistic film still look, cinematic lighting, not 3D render, not CGI, not anime, no subtitles, no watermark, organic film noise.\n* 角色肤质约束：[粗糙皮肤，可见毛孔，细微绒毛，皮肤瑕疵，明显细纹，1:1真实肤色]`;

        // ✨ 裂变默认继承联动机制：新生成的 ShotNode 默认带上中控的 globalRatio 与 globalPromptSuffix
        const globalSettings = useAppStore.getState().canvasSettings;
        const inheritedRatioOverride = globalSettings?.globalRatio || '16:9';
        const inheritedSuffix = globalSettings?.globalPromptSuffix || '';

        // 智能追加后缀
        let finalFirstFrame = shot.imagePrompt || "空镜头。";
        let finalVideoPromptText = fullVideoPrompt;
        if (inheritedSuffix.trim()) {
           finalFirstFrame = `${finalFirstFrame}\n, ${inheritedSuffix}`;
           finalVideoPromptText = `${fullVideoPrompt}\n, ${inheritedSuffix}`;
        }

        const newShot = {
          id: shotId, type: 'shot', 
          position: { x: targetColumnX, y: targetY },
          data: { 
            shotNumber: shot.shotNumber || String(index + 1).padStart(2, '0'), 
            scriptText: shot.scriptFragment || selectedText,
            globalCamera: data.globalCamera, 
            sceneLighting: shot.shotLighting || data.tempSceneLighting,
            status: 'draft', 
            referenceImage: null,
            wordCount: shot.wordCount || 0,
            duration: shot.duration || 5,
            
            // 记录原始 Prompt 与 已追加后缀印记，防套娃污染
            originalFirstFrameAnchor: shot.imagePrompt || "空镜头。",
            originalVideoPrompt: fullVideoPrompt,
            firstFrameAnchor: finalFirstFrame,
            videoPrompt: finalVideoPromptText,
            lastAppliedSuffix: inheritedSuffix,
            globalRatioOverride: inheritedRatioOverride, // 自动继承全局比例

            // 导演路由引擎上下文（裂变时预计算，供后续生图/生视频使用）
            _directorContext: directorCtx ? {
              lightingPrompt: directorCtx.lightingPrompt,
              cameraPrompt: directorCtx.cameraPrompt,
              genre: directorCtx.genre,
              genreLabel: directorCtx.genreLabel,
              tempo: directorCtx.tempo,
              tempoLabel: directorCtx.tempoLabel,
            } : null,

            isParsing: false
          }
        };

        const newEdge = { 
          id: `e-${id}-${shotId}`, source: id, target: shotId, sourceHandle: 'right', targetHandle: 'left', 
          type: 'default', animated: true, 
          style: { stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1.5, strokeDasharray: '8 8', animationDuration: '10s' } 
        };

        newNodes.push(newShot);
        newEdges.push(newEdge);
      });

      setNodes((nds) => [...nds, ...newNodes]);
      setEdges((eds) => [...eds, ...newEdges]);
      
      // ✨ 痛点修复：将生成的 shotIds 数组绑定到书签上
      const newExtractedScene = {
        id: `bookmark_${Date.now()}`,
        text: selectedText,
        start: selectionRange.start,
        end: selectionRange.end,
        targetIds: createdShotIds // 重点在这里
      };
      const updatedExtractedScenes = [...(data.extractedScenes || []), newExtractedScene];

      setShowBookmarks(true);
      updateNodeData(id, { sceneInterceptState: 'idle', extractedScenes: updatedExtractedScenes });
      setSelectedText(""); 
      useAppStore.getState().setToastMsg(`✅ 裂变成功！已生成 ${fissionResult.shots.length} 个分镜卡片。`);

    } catch (error: any) {
      console.error("裂变解析错误:", error);
      useAppStore.getState().setToastMsg(`裂变失败: ${error.message || '模型返回数据异常'}`);
    } finally {
      // 🔥 最终关闭转圈状态
      updateNodeData(id, { isGenerating: false });
    }
  };
        

  const handleFissionTable = () => {
    if (data.isGenerating) return;
    updateNodeData(id, { isGenerating: true });
    useAppStore.getState().setToastMsg(`场记板已确认，正在生成全局表格视图...`);

    setTimeout(() => {
      const thisNode = getNodes().find(n => n.id === id);
      const baseX = thisNode ? thisNode.position.x : 0;
      const baseY = thisNode ? thisNode.position.y : 0;
      const existingTablesCount = getNodes().filter(n => n.type === 'scriptTable').length;
      const targetY = baseY + (existingTablesCount * 600); 

      const tableId = `table_${Date.now()}`;
      
      const newTable = {
        id: tableId, type: 'scriptTable', 
        position: { x: baseX + 650, y: targetY },
        data: { 
          scriptText: selectedText, 
          globalCamera: data.globalCamera, 
          sceneLighting: data.tempSceneLighting,
          status: 'draft',
          rows: [
            { id: `row_${Date.now()}`, shotNumber: '01', duration: '8s', camera: 'static', movement: 'nodal pan', shotType: '中景', videoDesc: '人物动作连贯延展...', characters: '@角色', audio: '环境音', imgScene: '室内', imgShotType: '中景', imgDesc: '坐在椅子上，手持道具...', imgCharacters: '@角色', imgEmotion: '平静', imgPrompt: '中景，坐在椅子上...' }
          ]
        }
      };

      const newEdge = { id: `e-${id}-${tableId}`, source: id, target: tableId, sourceHandle: 'right', targetHandle: 'left', type: 'default', animated: true, style: { stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1.5, strokeDasharray: '8 8', animationDuration: '10s' } };

      setNodes((nds) => [...nds, newTable]);
      setEdges((eds) => [...eds, newEdge]);

      
      
      const newExtractedScene = { id: tableId, text: selectedText, start: selectionRange.start, end: selectionRange.end };
      const updatedExtractedScenes = [...(data.extractedScenes || []), newExtractedScene];
      
      setShowBookmarks(true);
      updateNodeData(id, { isGenerating: false, sceneInterceptState: 'idle', extractedScenes: updatedExtractedScenes });
      setSelectedText(""); 
      useAppStore.getState().setToastMsg("✅ 表格型脚本生成完毕！");
    }, 1500);
  };

  return (
    <div className="relative group/node z-30 flex flex-col" style={{ width: '100%', height: '100%', minWidth: '480px', minHeight: '420px' }}>
      <NodeResizeControl minWidth={480} minHeight={420} position="bottom-right" style={{ background: 'transparent', border: 'none', width: '20px', height: '20px', right: '12px', bottom: '12px' }}>
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-zinc-600 hover:text-white cursor-se-resize opacity-0 group-hover/node:opacity-100 transition-opacity drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
             <polyline points="21 15 21 21 15 21"></polyline><line x1="21" y1="21" x2="15" y2="15"></line>
         </svg>
      </NodeResizeControl>
      
      <Handle type="source" position={Position.Right} id="right" className={handleRight} />
      
      <div className={`w-full h-full flex-1 ${nodeBaseClass} ${selected ? selectedBorderClass : unselectedBorderClass} flex flex-col p-5 overflow-hidden relative`}>
        
      <div className="flex items-center gap-3 mb-4 border-b border-white/[0.05] pb-3 shrink-0">
          <div className="w-8 h-8 rounded-[10px] bg-white/10 border border-white/20 flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] pointer-events-none">
            <Type size={14} className="text-white" />
          </div>
          <div className="flex flex-col pointer-events-none">
            <span className="text-[14px] font-bold text-white tracking-widest">主剧本控制台</span>
            <span className="text-[9px] text-zinc-500 font-mono tracking-wider mt-0.5">MASTER SCRIPT 2.1</span>
          </div>
          
          {(data.extractedScenes && data.extractedScenes.length > 0) && (
            <button 
              onClick={(e) => { e.stopPropagation(); setShowBookmarks(!showBookmarks); }}
              className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-mono tracking-widest transition-all shadow-md nodrag ${showBookmarks ? 'bg-white/20 border-white/30 text-white' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white'}`}
            >
              <Clapperboard size={12} className={showBookmarks ? "text-white" : "text-zinc-500"} />
              已拆分 ({data.extractedScenes.length})
            </button>
          )}
          {/* ✨ 全新：前置资产数据表裂变入口 */}
          {data.globalCamera && (
            <div className="relative ml-2">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowAssetMenu(!showAssetMenu); setShowBookmarks(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold tracking-widest transition-all shadow-md nodrag ${showAssetMenu || extractingAsset ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400/70 hover:bg-indigo-500/20 hover:text-indigo-300'}`}
              >
                {extractingAsset ? <Loader2 size={12} className="animate-spin"/> : <Database size={12} />}
                前置资产建档 <ChevronDown size={12} className={showAssetMenu ? "rotate-180 transition-transform" : "transition-transform"}/>
              </button>
              {/* 下拉菜单 */}
              {showAssetMenu && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-[160px] bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/20 rounded-[12px] shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95">
                  <button onClick={() => handleExtractAssetTable('scene')} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-300 hover:text-white hover:bg-white/10 rounded-[8px] transition-all text-left"><Map size={12} className="text-emerald-400"/> 提取场景表</button>
                  <button onClick={() => handleExtractAssetTable('character')} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-300 hover:text-white hover:bg-white/10 rounded-[8px] transition-all text-left"><Users size={12} className="text-amber-400"/> 提取角色表</button>
                  <button onClick={() => handleExtractAssetTable('prop')} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-300 hover:text-white hover:bg-white/10 rounded-[8px] transition-all text-left"><Package size={12} className="text-fuchsia-400"/> 提取道具表</button>
                </div>
              )}
            </div>
          )}
        </div>

        {data.globalCamera && (
          <div className="mb-4 p-3 bg-black/50 rounded-[16px] border border-white/10 shadow-inner shrink-0 group/cam transition-all">
             <div className="flex flex-col">
             <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 pl-1 flex items-center justify-between pointer-events-none">
                 全局摄影机预设 (Global Camera) <Settings2 size={12} className="text-zinc-400 group-hover/cam:rotate-90 transition-transform duration-500"/>
               </label>
               <textarea 
                 className="bg-transparent border border-white/[0.05] rounded-[8px] p-2 focus:border-white/30 focus:bg-white/[0.02] text-[12px] text-zinc-300 outline-none w-full font-mono transition-colors nodrag nopan resize-none custom-scrollbar"
                 rows={3} value={data.globalCamera} onChange={(e) => updateNodeData(id, { globalCamera: e.target.value })} onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
               />
             </div>
          </div>
        )}

        <textarea 
          ref={textareaRef}
          className="flex-1 w-full h-full bg-transparent text-[14px] text-zinc-200 placeholder-zinc-600 resize-none outline-none custom-scrollbar leading-relaxed nodrag nopan"
          placeholder="[在此粘贴几万字完整剧情大纲或剧本...]"
          value={data.text || ''} onChange={(e) => updateNodeData(id, { text: e.target.value })} onSelect={handleTextSelect} onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
        />
      </div>

      {/* ✨ 侧边悬浮黑玻璃书签抽屉 */}
      {showBookmarks && (data.extractedScenes && data.extractedScenes.length > 0) && (
        <div className="absolute top-0 right-[-260px] w-[240px] h-full flex flex-col bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/[0.1] rounded-[24px] shadow-[0_40px_100px_rgba(0,0,0,0.95)] animate-in fade-in slide-in-from-left-4 z-40 overflow-hidden nodrag nopan">
          <div className="px-4 py-3.5 border-b border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0">
             <span className="text-[11px] font-bold text-zinc-300 tracking-widest flex items-center gap-2">
               <Clapperboard size={12} className="text-zinc-400"/> 场记书签库
             </span>
             <button onClick={() => { setShowBookmarks(false); updateNodeData(id, { activeTargetIds: [] }); }} className="text-zinc-500 hover:text-white transition-colors"><X size={14}/></button>
          </div>
          
          <div className="p-3 flex flex-col gap-2 overflow-y-auto custom-scrollbar flex-1">
            {data.extractedScenes.map((scene: any, idx: number) => {
               // ✨ 修正高亮判断逻辑：比对 targetIds 数组的第一个元素是否匹配
               const isActive = data.activeTargetIds && data.activeTargetIds.length > 0 && data.activeTargetIds[0] === scene.targetIds?.[0];
               
               return (
               <div
                 key={scene.id}
                 onClick={() => {
                  if (textareaRef.current) {
                    textareaRef.current.focus();
                    textareaRef.current.setSelectionRange(scene.start, scene.end);
                    setSelectedText(scene.text);
                    setSelectionRange({ start: scene.start, end: scene.end });
                  }
                  // ✨ 修复：点击书签时，触发边缘高亮！告诉全局只有这些连线要发光
                  updateNodeData(id, { activeTargetIds: scene.targetIds });
                }}
                 className={`flex flex-col gap-1.5 p-3 rounded-[12px] bg-[#050505] border cursor-pointer transition-all group/slice shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.5)] ${isActive ? 'border-white/40 bg-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.1)]' : 'border-white/5 hover:border-white/30 hover:bg-white/10 shadow-inner'}`}
               >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-zinc-400 group-hover/slice:text-white">SHOT {String(idx+1).padStart(2,'0')}</span>
                  </div>
                  <div className="text-[11px] text-zinc-500 line-clamp-3 leading-relaxed group-hover/slice:text-zinc-300 transition-colors">
                    {scene.text}
                  </div>
               </div>
               );
            })}
          </div>
        </div>
      )}


      {/* 下方的场记板拦截舱 (直接无脑裂变版) */}
      <div className={`absolute bottom-[-20px] left-1/2 -translate-x-1/2 translate-y-full flex flex-col bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/[0.1] rounded-[24px] shadow-[0_40px_100px_rgba(0,0,0,0.95)] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-[100] ${(!data.globalCamera || selectedText ? 'w-auto p-1.5 flex-row items-center gap-2 scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none')}`}>
        {!data.globalCamera ? (
          <>
            <CustomSelect menuPosition="left" className="w-[170px] bg-transparent" value={data.model || 'deepseek-v4-pro'} options={[{ value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' }, { value: 'gpt-5.4', label: 'GPT-5.4 (智能)' }, { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' }, { value: 'gemini-3.5-flash', label: 'Gemini 3.5' }]} onChange={(v: string) => updateNodeData(id, { model: v })} />
            <div className="w-px h-5 bg-white/10 mx-1"></div>
            <button onClick={handleExtractCamera} disabled={data.isExtractingCamera} className="flex items-center justify-center gap-2 px-5 py-2 bg-indigo-500 text-white hover:bg-indigo-400 rounded-[12px] text-[12px] font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] whitespace-nowrap nodrag">
               {data.isExtractingCamera ? <Loader2 size={14} className="animate-spin" /> : <Settings2 size={14} />} 锚定全片摄影机
            </button>
          </>
        ) : (
          <>
            <CustomSelect menuPosition="left" className="w-[170px] bg-transparent" value={data.model || 'deepseek-v4-pro'} options={[{ value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' }, { value: 'gpt-5.4', label: 'GPT-5.4 (智能)' }, { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' }, { value: 'gemini-3.5-flash', label: 'Gemini 3.5' }]} onChange={(v: string) => updateNodeData(id, { model: v })} />
            <div className="w-px h-5 bg-white/10 mx-1"></div>
            
            <button onClick={handleFissionShots} disabled={data.isGenerating} className="flex items-center gap-1.5 px-6 py-2 text-[12px] font-bold text-white bg-indigo-500 hover:bg-indigo-400 rounded-[12px] transition-all shadow-[0_0_20px_rgba(99,102,241,0.5)] nodrag whitespace-nowrap">
              {data.isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />} 裂变分镜 ({selectedText.length}字)
            </button>
            <button onClick={handleFissionTable} disabled={data.isGenerating} className="flex items-center gap-1.5 px-6 py-2 text-[12px] font-bold text-black bg-white hover:bg-zinc-200 hover:scale-105 rounded-[12px] transition-all shadow-[0_0_15px_rgba(255,255,255,0.3)] nodrag whitespace-nowrap">
              {data.isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Table size={14} />} 生成表格
            </button>
          </>
        )}
      </div>
    </div>
  );
};
// ==========================================
// ==========================================
// ==========================================
// ==========================================
// 2. 独立分镜节点 (ShotNode) —— 双轨质检员 + 参数胶囊
// ==========================================
export const ShotNode = ({ id, data, selected }: any) => {
  const { updateNodeData, getNodes, setNodes, setEdges, getEdges } = useReactFlow();
  const edges = useEdges(); const nodes = useNodes();

  const markDownstreamDirty = () => {
    const connectedEdges = getEdges().filter(e => e.source === id);
    connectedEdges.forEach(edge => {
      const targetNode = getNodes().find(n => n.id === edge.target);
      if (targetNode && targetNode.type === 'videoClip' && targetNode.data.status === 'done') {
        updateNodeData(targetNode.id, { isDirty: true });
      }
    });
  };
  const status = data.status || 'draft';
  const [zenMode, setZenMode] = useState<any>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showHDSettings, setShowHDSettings] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  
  // ✨ 新增下拉框状态
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [brushColor, setBrushColor] = useState('#ff0000');
  const [brushSize, setBrushSize] = useState(4);
  const imgRef = useRef<HTMLImageElement>(null);

  const ratioStyleMap: Record<string, React.CSSProperties> = { '16:9': { aspectRatio: '16/9' }, '9:16': { aspectRatio: '9/16' }, '1:1': { aspectRatio: '1/1' }, '4:3': { aspectRatio: '4/3' }, '3:4': { aspectRatio: '3/4' } };
  
  // ✨ 核心机制：比例优先级。单分镜节点 ratio 属性最高，其次为全局穿透的 globalRatioOverride，最后默认 16:9
  const activeRatio = data.ratio || data.globalRatioOverride || '16:9';
  const currentStyle = ratioStyleMap[activeRatio] || ratioStyleMap['16:9'];

  const incomingAssets = edges.filter(e => e.target === id).map(e => {
    const srcNode = nodes.find(n => n.id === e.source);
    if (srcNode?.data?.asset) return { ...srcNode.data.asset, name: srcNode.data.name || srcNode.data.asset.prompt };
    const url = srcNode?.data?.resultUrl || srcNode?.data?.frameUrl || srcNode?.data?.videoUrl;
    if (url) {
       return { url, _type: url.includes('.mp4') ? 'video' : 'image', prompt: srcNode.data.prompt || srcNode.data.videoPrompt, name: srcNode.data.name || '连线参考' };
    }
    return null;
  }).filter(Boolean);
  console.log("🔍 ShotNode 连线信息来源:", incomingAssets);

  const { enqueueTask } = useCanvasEngine();
  const showToast = (msg: string) => useAppStore.getState().setToastMsg(msg);

  // ✨ 新增：扫描画布上所有可用的独立资产节点
  const availableAssets = nodes.filter(n => 
    n.type === 'media' && 
    (n.data?.resultUrl || n.data?.asset?.url) && 
    n.id !== id && 
    !edges.some(e => e.source === n.id && e.target === id) 
  );

  // ✨ 新增：自动施法，创建物理连线
  const handleAddAssetEdge = (sourceId: string) => {
    setEdges((eds) => [
      ...eds,
      {
        id: `e-${sourceId}-${id}-${Date.now()}`,
        source: sourceId,
        target: id,
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'default',
        animated: true,
        style: { stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1.5, strokeDasharray: '8 8', animationDuration: '10s' }
      }
    ]);
    setShowAssetDropdown(false);
    useAppStore.getState().setToastMsg("🔗 资产连线成功！");
  };

  // 高清放大确认
  const handleHDConfirm = () => {
    const srcUrl = data.frameUrl || data.resultUrl;
    if (!srcUrl) return;
    const thisNode = getNodes().find(n => n.id === id);
    if (!thisNode) return;
    const newNode = {
      id: `hd_node_${Date.now()}`,
      type: 'media',
      position: { x: thisNode.position.x + 500, y: thisNode.position.y + 100 },
      data: {
        resultUrl: srcUrl,
        prompt: '高清放大: ' + (data.firstFrameAnchor || data.prompt || ''),
        ratio: data.ratio || '16:9',
        model: 'hd-upscale-v1',
      }
    };
    setNodes((nds) => [...nds, newNode]);
    setShowHDSettings(false);
    useAppStore.getState().setToastMsg("✅ 高清放大节点已生成！");
  };

  const handleAnnotateDone = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL('image/png');

    const thisNode = getNodes().find(n => n.id === id);
    if (!thisNode) return;
    const newNode = {
      id: `annotated_${Date.now()}`,
      type: 'media',
      position: { x: thisNode.position.x + 500, y: thisNode.position.y + 100 },
      data: {
        resultUrl: dataURL,
        prompt: '标注图: ' + (data.firstFrameAnchor || data.prompt || ''),
        ratio: data.ratio || '16:9',
        model: data.model || 'gpt-image-2',
      }
    };
    setNodes((nds) => [...nds, newNode]);
    setIsAnnotating(false);
    useAppStore.getState().setToastMsg("✅ 标注图已作为新节点添加！");
  };

  // 标注时的绘制逻辑
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isAnnotating) return;
    
    // 在进入标注模式时，重置 canvas 大小并绘制原图
    const img = imgRef.current;
    if (img) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    }

    let drawing = false;
    const start = (e: MouseEvent) => {
      drawing = true;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;   // 计算缩放比
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    };
    const move = (e: MouseEvent) => {
      if (!drawing) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        ctx.lineTo(x, y);
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    };
    const end = () => {
      drawing = false;
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('mouseleave', end);
    };
  }, [isAnnotating, brushColor, brushSize]);

  const handleGenerateFrame = () => {
    if (data.isGenerating) return;

    // 提取参考图 URL（纯字符串数组）
    const imageUrls = incomingAssets
      .filter(a => a && (a.url || a.asset?.url))
      .map(a => a.url || a.asset?.url)
      .filter(Boolean);

    console.log("🚀 ShotNode 传参参考图:", imageUrls);

    // 保留写入节点数据（其他功能可能会用到），同时显式传参
    updateNodeData(id, { incomingAssets: incomingAssets });
    enqueueTask(id, 'image', getNodes, updateNodeData, imageUrls);
  };

  const handleSpawnVideo = () => {
    const thisNode = nodes.find(n => n.id === id);
    if (!thisNode) return;
    const videoId = `video_${Date.now()}`;
    setNodes(nds => [...nds, { id: videoId, type: 'videoClip', position: { x: thisNode.position.x + 500, y: thisNode.position.y }, data: { status: 'draft', duration: data.duration || 5, ratio: data.ratio || '16:9', prompt: data.videoPrompt, sceneLighting: data.sceneLighting, globalCamera: data.globalCamera, frameUrl: data.frameUrl, referenceImage: data.frameUrl, isGenerating: false } }]);
    setEdges(eds => [...eds, { id: `e-${id}-${videoId}`, source: id, target: videoId, sourceHandle: 'right', targetHandle: 'left', type: 'default', animated: true, style: { stroke: 'rgba(99, 102, 241, 0.8)', strokeWidth: 2, strokeDasharray: '10 10', animationDuration: '2s' } }]);
  };

  const handleSaveAsset = (category: string) => {
    const { activeCanvasProjectId, updateCanvasProject } = useAppStore.getState();
    const url = data.frameUrl || data.resultUrl || data.asset?.url;
    if (!url) {
      useAppStore.getState().setToastMsg("⚠️ 当前节点没有可保存的图片！");
      return;
    }
    if (!activeCanvasProjectId) {
      useAppStore.getState().setToastMsg("⚠️ 请先进入一个画布项目！");
      return;
    }
    const asset = {
      id: `local_${Date.now()}`,
      _type: 'image',
      url,
      prompt: data.firstFrameAnchor || data.prompt || '已保存资产',
      timestamp: Date.now(),
      ratio: data.ratio || '16:9',
      category,
    };
    // ★ 函数式更新：从状态机原子快照读取最新 localAssets，杜绝竞态覆盖
    updateCanvasProject(activeCanvasProjectId, (prev: any) => ({ localAssets: [asset, ...(prev?.localAssets || [])] }));
    useAppStore.getState().setToastMsg(`✅ 已存入 [${category === 'scene' ? '场景' : category === 'character' ? '人物' : '道具'}] 分类`);
  };

  return (
    <div className="relative w-[400px] group z-20">
      <Handle type="target" position={Position.Left} id="left" className={handleLeft} />
      <Handle type="source" position={Position.Right} id="right" className="!w-[24px] !h-[24px] !bg-transparent opacity-0" />

      {status === 'done' && data.frameUrl && (
        <div className="absolute -top-[52px] left-1/2 -translate-x-1/2 flex items-center p-1.5 bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto z-[100] scale-95 group-hover:scale-100 after:content-[''] after:absolute after:-bottom-6 after:left-0 after:w-full after:h-6">
          <button onClick={() => showToast("正在调起高清放大引擎...")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Maximize size={12}/> 高清HD</button>
          {showHDSettings && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/10 rounded-[16px] p-4 z-[150] shadow-2xl flex flex-col gap-3 min-w-[220px] animate-in fade-in slide-in-from-top-2">
              <div className="text-white text-[12px] font-bold flex items-center gap-2">
                <Maximize size={14} className="text-indigo-400"/> 高清放大
              </div>
              <div className="flex flex-col gap-2 text-[11px] text-zinc-300">
                <div className="flex justify-between"><span className="text-zinc-500">模型</span><span className="font-mono">hd-upscale-v1</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">放大倍率</span><span className="font-mono">2x</span></div>
              </div>
              <div className="flex gap-2 justify-end mt-1">
                <button onClick={() => setShowHDSettings(true)} className="px-3 py-1.5 rounded-full bg-white/5 text-zinc-300 text-[10px] font-bold hover:bg-white/10 transition-all">取消</button>
                <button onClick={handleHDConfirm} className="px-4 py-1.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold hover:bg-indigo-400 transition-all shadow-lg">确认放大</button>
              </div>
            </div>
          )}
          

          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={() => showToast("进入九宫格扩展模式")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Grid size={12}/> 九宫格</button>
          <button onClick={() => showToast("生成人物三视图")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><UserRound size={12}/> 多视图</button>
          <button onClick={() => setIsAnnotating(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap">
  <PenTool size={12}/> 标注
</button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          
          <div className="relative group/save flex items-center">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><RefreshCcw size={12}/> 存资产 <ChevronDown size={10}/></button>
            <div className="absolute left-1/2 -translate-x-1/2 top-[100%] pt-2 opacity-0 group-hover/save:opacity-100 pointer-events-none group-hover/save:pointer-events-auto transition-all z-[101]">
               <div className="bg-[#050505]/95 backdrop-blur-xl border border-white/10 p-1.5 rounded-[12px] shadow-2xl flex flex-col gap-0.5">
                 <button onClick={() => handleSaveAsset('scene')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-emerald-400 hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">存为场景光影</button>
                 <button onClick={() => handleSaveAsset('character')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-amber-400 hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">存为人物造型</button>
                 <button onClick={() => handleSaveAsset('prop')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-fuchsia-400 hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">存为静图道具</button>
               </div>
            </div>
          </div>
          
          <button onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = data.frameUrl; a.download = `YR_Shot_${Date.now()}.png`; a.click(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-bold text-zinc-300 hover:text-black hover:bg-white transition-all shadow-md whitespace-nowrap"><Download size={12}/> 下载</button>
        </div>
      )}
      
      {zenMode && <ZenEditor label={zenMode.label} value={data[zenMode.field] || ''} onChange={(val: string) => updateNodeData(id, { [zenMode.field]: val })} onClose={() => setZenMode(null)} />}

      <div className={`relative rounded-[24px] bg-[#18181b]/80 backdrop-blur-3xl border ${selected ? 'border-white/30 shadow-2xl' : 'border-white/[0.08]'} flex flex-col p-2 transition-all duration-500`}>
        <div className="flex items-center justify-between px-2 pt-1 pb-2">
          <span className="bg-white/10 text-white px-2 py-0.5 rounded-[6px] text-[10px] font-mono font-bold shadow-inner">SHOT {data.shotNumber}</span>
        </div>

        <div style={currentStyle} className="w-full bg-[#0a0a0c] border border-white/10 rounded-[16px] overflow-hidden relative shadow-inner transition-all duration-500 ease-out origin-center group/shotimg">
          {/* 生成中 / 排队中的覆盖层 */}
          {(status === 'generating' || status === 'pending') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10">
              <Loader2 size={24} className="animate-spin text-zinc-400 mb-2" />
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold animate-pulse">
                {status === 'pending' ? 'QUEUED / 排队中...' : 'Rendering...'}
              </span>
            </div>
          )}

          {/* 🆕 动态宇宙粒子背景（只在无图且非生成中时显示） */}
          {!data.frameUrl && status !== 'generating' && status !== 'pending' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center dynamic-particles-container">
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes space-drift {
                  0% { background-position: 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0px 0px; }
                  100% { background-position: 200px 300px, -150px 200px, 100px -200px, -200px -100px, 150px 150px; }
                }
                @keyframes nebula-pulse {
                  0% { opacity: 0.3; transform: scale(1); }
                  50% { opacity: 0.8; transform: scale(1.1); }
                  100% { opacity: 0.3; transform: scale(1); }
                }
                .dynamic-particles-container {
                  background-image: 
                    radial-gradient(1px 1px at 20px 20px, rgba(255,255,255,0.9), transparent),
                    radial-gradient(1.5px 1.5px at 40px 70px, rgba(255,255,255,0.7), transparent),
                    radial-gradient(2px 2px at 80px 120px, rgba(255,255,255,0.4), transparent),
                    radial-gradient(1px 1px at 150px 30px, rgba(255,255,255,0.8), transparent),
                    radial-gradient(1px 1px at 10px 130px, rgba(165,180,252,0.6), transparent);
                  background-size: 80px 80px, 110px 110px, 160px 160px, 90px 90px, 60px 60px;
                  animation: space-drift 50s linear infinite;
                }
                .dynamic-particles-container::before {
                  content: "";
                  position: absolute;
                  inset: -20%;
                  background: 
                    radial-gradient(circle at 20% 80%, rgba(76, 29, 149, 0.25) 0%, transparent 50%),
                    radial-gradient(circle at 80% 20%, rgba(30, 58, 138, 0.25) 0%, transparent 50%);
                  animation: nebula-pulse 8s ease-in-out infinite alternate;
                  pointer-events: none;
                  z-index: 1;
                }
                .dynamic-particles-container::after {
                  content: "";
                  position: absolute;
                  inset: 0;
                  background: radial-gradient(circle at center, transparent 20%, rgba(2, 2, 4, 0.95) 100%);
                  pointer-events: none;
                  z-index: 2;
                }
              `}} />
              <span className="z-10 text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                分镜首帧待生成
              </span>
            </div>
          )}

          {/* 有图时正常显示 */}
          {status === 'done' && data.frameUrl && (
  <div className="relative w-full h-full">
    <img 
      ref={imgRef} 
      src={data.frameUrl} 
      className="w-full h-full object-cover" 
      crossOrigin="anonymous"  // 防止 canvas 污染
    />
    {isAnnotating && (
      <>
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full nodrag nopan"
          style={{ cursor: 'crosshair' }}
        />
        <div className="absolute top-2 left-2 flex items-center gap-2 z-20 nodrag">
  <input
    type="color"
    value={brushColor}
    onChange={(e) => setBrushColor(e.target.value)}
    className="w-6 h-6 rounded cursor-pointer nodrag"
    title="画笔颜色"
  />
  <input
    type="range"
    min="2"
    max="20"
    value={brushSize}
    onChange={(e) => setBrushSize(Number(e.target.value))}
    className="w-20 h-4 nodrag"
    title="画笔粗细"
  />
  <span className="text-[10px] text-white/80">{brushSize}px</span>
</div>
        <div className="absolute bottom-2 right-2 flex gap-2 z-20">
          <button 
            onClick={handleAnnotateDone} 
            className="px-3 py-1.5 bg-green-500 text-white rounded-full text-[10px] font-bold shadow-lg nodrag"
          >
            完成
          </button>
          <button 
            onClick={() => setIsAnnotating(false)} 
            className="px-3 py-1.5 bg-white/10 text-white rounded-full text-[10px] font-bold nodrag"
          >
            取消
          </button>
        </div>
      </>
    )}
  </div>
)}
        </div>
      </div>

      <div className={`absolute top-[100%] pt-4 left-1/2 -translate-x-1/2 w-[540px] transition-all duration-500 ease-out origin-top ${selected ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
         <div className="bg-black/60 border border-white/[0.08] backdrop-blur-3xl rounded-[32px] p-4 shadow-2xl flex flex-col relative">
            
         <div className="flex flex-col gap-1.5 mb-3 bg-[#050505]/50 p-2.5 rounded-[16px] border border-white/5 focus-within:border-white/20 transition-colors shadow-inner">
               <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">场景光影轨</label>
               <input value={data.sceneLighting || ''} onChange={(e) => { updateNodeData(id, { sceneLighting: e.target.value }); markDownstreamDirty(); }} className="bg-transparent text-[11px] text-zinc-300 font-mono outline-none nodrag nopan w-full" />
            </div>

            <div className="flex flex-col gap-1.5 mb-3 bg-[#050505]/50 p-2.5 rounded-[16px] border border-white/5 group/zen1 focus-within:border-white/20 transition-colors shadow-inner">
               <div className="flex justify-between items-center relative z-50">
                 <label className="text-[9px] font-bold text-zinc-400 flex items-center gap-2">
                    首帧锚定轨 
                    {data.styleOverride && data.styleOverride !== '继承全局预设' && <span className="bg-white/10 text-white px-1.5 py-0.5 rounded text-[8px] font-mono border border-white/20">STYLE: {data.styleOverride.split(' ')[0]}</span>}
                 </label>
                 <div className="flex items-center gap-1">
                    <button onClick={() => setShowAssetDropdown(!showAssetDropdown)} className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/40 rounded-[6px] text-[9px] font-bold transition-all nodrag"><Plus size={10}/> 引入资产</button>
                    <button onClick={() => setZenMode({ field: 'firstFrameAnchor', label: '首帧描述' })} className="opacity-0 group-hover/zen1:opacity-100 text-zinc-400 hover:text-white transition-colors p-1"><Expand size={10}/></button>
                 </div>
                 
                 {/* 资产下拉框 */}
                 {showAssetDropdown && (
                    <div className="absolute top-[100%] right-0 mt-2 w-[220px] bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/20 rounded-[12px] shadow-[0_20px_60px_rgba(0,0,0,0.9)] p-1.5 z-[9999] animate-in fade-in zoom-in-95 max-h-[200px] overflow-y-auto custom-scrollbar nodrag nopan" onClick={e => e.stopPropagation()} onWheelCapture={e => e.stopPropagation()}>
                       <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest px-2 pb-1 mb-1 border-b border-white/10 flex justify-between items-center">
                          点击即可飞线
                          <button onClick={() => setShowAssetDropdown(false)} className="hover:text-white"><X size={10}/></button>
                       </div>
                       {availableAssets.length === 0 ? (
                          <div className="text-[10px] text-zinc-500 p-3 text-center font-light">
                             画布中暂无多余图片节点<br/>请先从右侧表格提取
                          </div>
                       ) : (
                          availableAssets.map((assetNode: any) => (
                             <div key={assetNode.id} onClick={() => handleAddAssetEdge(assetNode.id)} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded-[8px] cursor-pointer transition-colors group/item">
                                <img src={assetNode.data?.resultUrl || assetNode.data?.asset?.url} className="w-7 h-7 rounded-[6px] object-contain bg-black/50 border border-white/10" />
                                <span className="text-[11px] text-zinc-300 font-medium group-hover/item:text-white truncate flex-1">{assetNode.data?.name || '未命名资产'}</span>
                             </div>
                          ))
                       )}
                    </div>
                 )}
               </div>
               
               {/* 🆕 已连线参考图小预览 */}
                              {incomingAssets.filter((a:any) => a._type === 'image').length > 0 && (
                 <div className="flex gap-2 mb-1 flex-wrap">
                   {incomingAssets.filter((a:any) => a._type === 'image').map((asset: any, idx: number) => (
                    <div key={idx} className="relative group/ref w-12 h-12 rounded-[8px] overflow-hidden border border-white/20 hover:border-white/50 hover:scale-150 hover:z-50 transition-all duration-200 cursor-pointer" title={`参考图${idx+1}: ${asset.prompt || '未命名'}`}>
                       <img src={asset.url} className="w-full h-full object-cover" />
                       <span className="absolute top-0.5 left-0.5 bg-black/80 text-white text-[8px] px-1 rounded font-bold">{idx+1}</span>
                     </div>
                   ))}
                 </div>
               )}
               <MentionTextarea value={data.firstFrameAnchor || ''} onChange={(v: string) => { updateNodeData(id, { firstFrameAnchor: v }); markDownstreamDirty(); }} incomingAssets={incomingAssets} disableMention={true} />
               {incomingAssets.filter((a:any) => a._type === 'image').length === 0 && (
                 <div className="text-[10px] text-zinc-600 italic mb-1">
                   ⚠️ 左侧未连接参考图节点，将仅用提示词生成
                 </div>
               )}
            </div>
            
            <div className="flex flex-col gap-1.5 mb-2 bg-[#050505]/50 p-2.5 rounded-[16px] border border-white/5 group/zen2 focus-within:border-white/20 transition-colors shadow-inner">
               <label className="text-[9px] font-bold text-zinc-400 flex justify-between">时序演进与动作轨 <button onClick={() => setZenMode({ field: 'videoPrompt', label: '动作提示词' })} className="opacity-0 group-hover/zen2:opacity-100 text-zinc-400 hover:text-white transition-colors"><Expand size={10}/></button></label>
               <textarea value={data.videoPrompt || ''} onChange={(e) => { updateNodeData(id, { videoPrompt: e.target.value }); markDownstreamDirty(); }} className="w-full bg-black/40 border border-white/[0.05] rounded-[12px] p-3 text-[11px] text-zinc-300 outline-none resize-none custom-scrollbar min-h-[160px] nodrag nopan" onWheelCapture={(e) => e.stopPropagation() } />
            </div>

            <div className="h-px w-full bg-white/[0.05] my-3" />

            <div className="flex items-center justify-between px-2 pb-1 relative">
               <div className="flex items-center gap-2">
               <CustomSelect 
  className="w-[150px]" 
  value={data.model || 'gpt-image-2'} 
  options={[
    { value: 'gpt-image-2', label: 'GPT-Image-2' },
    { value: 'banana-pro', label: 'Banana Pro' },
    { value: 'seedream5.0', label: 'Seedream 5.0' }
  ]} 
  onChange={(v: string) => {
    // ✨【防呆分辨率自动重置机制】
    // 自动核对新选模型是否兼容当前画质，如果不匹配，立即重设为对应模型的安全默认值
    let nextQuality = data.quality || '1K';
    if (v === 'seedream5.0') {
      if (!['2K', '3K'].includes(nextQuality)) {
        nextQuality = '2K';
      }
    } else if (v === 'banana-pro') {
      if (!['1K', '2K', '4K'].includes(nextQuality)) {
        nextQuality = '2K';
      }
    } else {
      nextQuality = '1K';
    }
    updateNodeData(id, { model: v, quality: nextQuality });
  }} 
/>
                 
                 <div className="relative group/cfg">
                    <button onClick={() => setShowConfig(!showConfig)} className={`p-2 rounded-[10px] transition-all nodrag ${showConfig ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}><Settings2 size={16}/></button>
                    {showConfig && (
                       <div className="absolute bottom-[calc(100%+10px)] left-0 w-[240px] bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/10 rounded-[16px] shadow-2xl p-3 z-50 flex flex-col gap-3 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1">
                             <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">画面比例 (Ratio)</label>
                             <div className="flex gap-1 bg-black/40 p-1 rounded-[8px] border border-white/5">
                               {['16:9', '9:16', '1:1', '4:3', '3:4'].map(r => (
                                 <button key={r} onClick={() => updateNodeData(id, { ratio: r })} className={`flex-1 py-1 text-[10px] rounded-[4px] transition-all nodrag ${data.ratio === r ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'}`}>{r}</button>
                               ))}
                             </div>
                          </div>
                          <div className="flex flex-col gap-1 z-10">
                             <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">画质设定 (Quality)</label>
                             <CustomSelect 
                                menuPosition="top" 
                                className="w-full bg-black/40 border border-white/5 text-zinc-300 rounded-[8px]" 
                                value={data.quality || (data.model === 'seedream5.0' ? '2K' : '1K')} 
                                options={getImageQualityOptions(data.model || 'gpt-image-2')} 
                                onChange={(v: string) => updateNodeData(id, { quality: v })} 
                             />
                          </div>
                          <div className="flex flex-col gap-1 z-20">
                             <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">风格强覆写 (Override)</label>
                             <CustomSelect menuPosition="top" className="w-full bg-black/40 border border-white/5 text-zinc-300 rounded-[8px]" value={data.styleOverride || '继承全局预设'} options={[{ value: '继承全局预设', label: '继承全局预设' }, { value: '🎬 电影质感', label: '🎬 电影质感' }, { value: '🌸 二次元', label: '🌸 二次元' }, { value: '📷 极致写实', label: '📷 极致写实' }, { value: '🧊 3D 渲染', label: '🧊 3D 渲染' }, { value: '🌃 赛博朋克', label: '🌃 赛博朋克' }]} onChange={(v: string) => updateNodeData(id, { styleOverride: v })} />
                          </div>
                       </div>
                    )}
                 </div>
               </div>

               <div className="flex gap-2">
                 <button 
                   onClick={handleGenerateFrame} 
                   disabled={data.isGenerating || status === 'pending'} 
                   className="h-10 px-6 rounded-full bg-white text-black text-[12px] font-bold shadow-lg hover:scale-105 nodrag disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                 >
                   {status === 'done' ? '重新生成' : '提取生成首帧'}
                 </button>
                 <button 
                   onClick={handleSpawnVideo} 
                   disabled={status !== 'done'} 
                   className="flex items-center gap-1.5 h-10 px-5 rounded-full bg-indigo-500 text-white text-[12px] font-bold shadow-lg hover:bg-indigo-400 nodrag disabled:opacity-40 disabled:hover:bg-indigo-500 disabled:cursor-not-allowed"
                 >
                   <Film size={14}/> 传给3级渲染
                 </button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

// ==========================================
// ==========================================
// 3. 视频片段节点 (VideoClipNode) —— 终端渲染与后处理
// ==========================================
export const VideoClipNode = ({ id, data, selected }: any) => {
  const { updateNodeData, getNodes, setNodes, setEdges } = useReactFlow();
  // ✨ 新增：用于控制美学参数微调仓的展开状态
  const [isAestheticsExpanded, setIsAestheticsExpanded] = useState(false);
  const edges = useEdges();
  const nodes = useNodes();
  const status = data.status || 'draft'; 
  const [showConfig, setShowConfig] = useState(false);
  const [zenMode, setZenMode] = useState<any>(null);
  const ratioStyleMap: Record<string, React.CSSProperties> = { '16:9': { aspectRatio: '16/9' }, '9:16': { aspectRatio: '9/16' }, '1:1': { aspectRatio: '1/1' }, '4:3': { aspectRatio: '4/3' }, '3:4': { aspectRatio: '3/4' } };
  
  // ✨ 核心机制：比例优先级。单视频节点 ratio 属性最高，其次为全局穿透的 globalRatioOverride，最后默认 16:9
  const activeRatio = data.ratio || data.globalRatioOverride || '16:9';
  const currentStyle = ratioStyleMap[activeRatio] || ratioStyleMap['16:9'];

  const incomingAssets = edges.filter(e => e.target === id).map(e => {
    const srcNode = nodes.find(n => n.id === e.source);
    if (srcNode?.data?.asset) return { ...srcNode.data.asset, name: srcNode.data.name || srcNode.data.asset.prompt };
    const url = srcNode?.data?.resultUrl || srcNode?.data?.frameUrl || srcNode?.data?.videoUrl;
    if (url) {
       return { url, _type: url.includes('.mp4') ? 'video' : 'image', prompt: srcNode.data.prompt || srcNode.data.videoPrompt, name: srcNode.data.name || '连线参考' };
    }
    return null;
  }).filter(Boolean);

  const { enqueueTask } = useCanvasEngine();

  const handleGenerateVideo = () => {
    if (data.isGenerating) return;
    // 重新生成时，洗清脏污标记
    updateNodeData(id, { isDirty: false });
    enqueueTask(id, 'video', getNodes, updateNodeData);
  };

  const handleFissionClone = () => {
    const thisNode = nodes.find(n => n.id === id);
    if (!thisNode) return;
    const newId = `video_clone_${Date.now()}`;
    const newNode = {
      id: newId, type: 'videoClip',
      position: { x: thisNode.position.x, y: thisNode.position.y + 350 },
      data: { ...data, status: 'draft', videoUrl: null, isGenerating: false, postProcessLabel: null } 
    };
    const parentEdge = edges.find(e => e.target === id && e.targetHandle === 'left');
    const newEdges = [];
    if (parentEdge) {
      newEdges.push({
        id: `e-${parentEdge.source}-${newId}`, source: parentEdge.source, target: newId, 
        sourceHandle: parentEdge.sourceHandle, targetHandle: 'left', 
        type: 'default', animated: true, 
        style: { stroke: 'rgba(99, 102, 241, 0.8)', strokeWidth: 2, strokeDasharray: '10 10', animationDuration: '2s' } 
      });
    }
    setNodes(nds => [...nds, newNode]);
    if (newEdges.length > 0) setEdges(eds => [...eds, ...newEdges]);
  };

  // ✨ 新增：后处理空间裂变引擎
  const handlePostProcess = (actionType: string, label: string) => {
    const thisNode = nodes.find(n => n.id === id);
    if (!thisNode) return;
    
    useAppStore.getState().setToastMsg(`🚀 启动 [${label}]，正在创建衍生节点...`);
    
    const newId = `video_post_${actionType}_${Date.now()}`;
    
    // 创建一个带着特殊标签的新节点
    const newNode = {
      id: newId, 
      type: 'videoClip',
      position: { x: thisNode.position.x + 480, y: thisNode.position.y }, // 向右裂变
      data: { 
        ...data, 
        status: 'generating', // 直接进入生成状态
        isGenerating: true,
        videoUrl: null,
        postProcessLabel: label, // 打上后处理印记
        sourceVideoUrl: data.videoUrl // 记录源视频
      } 
    };
    
    // 生成粉紫色的专属加工连线
    const newEdge = {
      id: `e-${id}-${newId}`, 
      source: id, target: newId, 
      sourceHandle: 'right', targetHandle: 'left', 
      type: 'default', animated: true, 
      style: { stroke: 'rgba(217, 70, 239, 0.8)', strokeWidth: 2, strokeDasharray: '10 10', animationDuration: '1s' }
    };

    setNodes(nds => [...nds, newNode]);
    setEdges(eds => [...eds, newEdge]);
    
    // （模拟后端处理完毕）真实环境下这里会发 API
    setTimeout(() => {
      updateNodeData(newId, { 
        status: 'done', 
        isGenerating: false, 
        videoUrl: data.videoUrl // 模拟处理完，先复用原视频
      });
    }, 4000);
  };

  const showToast = (msg: string) => useAppStore.getState().setToastMsg(msg);

    // ✨ 新增：视频存资产函数
    const handleSaveAsset = () => {
      const { activeCanvasProjectId, updateCanvasProject } = useAppStore.getState();
      if (!activeCanvasProjectId || typeof updateCanvasProject !== 'function') return;
      const url = data.videoUrl || data.resultUrl || data.asset?.url;
      if (!url) return;
      const asset = {
        id: `local_${Date.now()}`, _type: 'video', url,
        prompt: data.prompt || data.videoPrompt || '已保存的视频',
        timestamp: Date.now(), ratio: data.ratio || '16:9'
      };
      // ★ 函数式更新：从状态机原子快照读取最新 localAssets，杜绝竞态覆盖
      updateCanvasProject(activeCanvasProjectId, (prev: any) => ({ localAssets: [asset, ...(prev?.localAssets || [])] }));
      useAppStore.getState().setToastMsg(`✅ 视频已存入侧边栏资产库！`);
    };

  return (
    <div className="relative w-[360px] group/videonode z-20">
      <Handle type="target" position={Position.Left} id="left" className={handleLeft} /> 
      <Handle type="source" position={Position.Right} id="right" className={handleRight} /> 
            {/* ✨ 禅定编辑器挂载 */}
            {zenMode && <ZenEditor label={zenMode.label} value={data[zenMode.field] || ''} onChange={(val: string) => updateNodeData(id, { [zenMode.field]: val })} onClose={() => setZenMode(null)} />}
      
      {/* ✨ 移到顶部的悬浮操作舱 (包含高级选项与下载) */}
      {status === 'done' && data.videoUrl && (
        <div className="absolute -top-[42px] left-1/2 -translate-x-1/2 flex items-center p-1.5 bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] opacity-0 group-hover/videonode:opacity-100 transition-all duration-300 z-50 scale-95 group-hover/videonode:scale-100 pointer-events-none group-hover/videonode:pointer-events-auto">
          <button onClick={() => handlePostProcess('upscale', '高清HD强化')} className="flex items-center gap-1.5 px-3 py-1 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Maximize size={12}/> 高清HD</button>
          <button onClick={() => handlePostProcess('nosub', 'AI去字幕')} className="flex items-center gap-1.5 px-3 py-1 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Subtitles size={12}/> 去字幕</button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <div className="relative group/btn flex items-center">
            <button className="flex items-center gap-1.5 px-3 py-1 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><AudioWaveform size={12}/> 音轨分离 <ChevronDown size={10}/></button>
            <div className="absolute left-1/2 -translate-x-1/2 top-[100%] pt-2 opacity-0 group-hover/btn:opacity-100 pointer-events-none group-hover/btn:pointer-events-auto transition-all z-[101]">
               <div className="bg-[#050505]/95 backdrop-blur-xl border border-white/10 p-1.5 rounded-[12px] shadow-2xl flex flex-col gap-0.5">
                 <button onClick={() => handlePostProcess('vocal', '人声提取')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">提取人声</button>
                 <button onClick={() => handlePostProcess('bgm', '环境音剥离')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">提取环境音</button>
               </div>
            </div>
          </div>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          {/* ✨ 下面这行是新加的存资产按钮 */}
          <button onClick={handleSaveAsset} className="flex items-center gap-1.5 px-3 py-1 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><RefreshCcw size={12}/> 存资产</button>
          
          <button onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = data.videoUrl; a.download = `YR_Video_${Date.now()}.mp4`; a.click(); }} className="flex items-center gap-1.5 px-3 py-1 rounded-[10px] text-[11px] font-bold text-zinc-300 hover:text-black hover:bg-white transition-all shadow-md whitespace-nowrap">
            <Download size={12}/> 下载
          </button>
        </div>
      )}
      
      <div className={`${nodeBaseClass} ${selected ? selectedBorderClass : unselectedBorderClass} flex flex-col p-2 transition-all duration-500`}>
        
        {/* 头部：展示接收到的算力时长 + 脏数据警报 */}
        <div className="flex items-center justify-between px-2 pt-1 pb-2 relative">
          <span className="text-[12px] font-bold text-white tracking-widest flex items-center gap-2">
            <Film size={14} className="text-zinc-400" />
            {data.postProcessLabel ? (
               <span className="bg-fuchsia-500/10 text-fuchsia-300 px-2 py-0.5 rounded-[6px] border border-fuchsia-500/20 text-[10px] font-bold shadow-inner">✨ {data.postProcessLabel}</span>
            ) : data.duration ? (
               <span className="bg-white/5 text-zinc-300 px-2 py-0.5 rounded-[6px] border border-white/10 text-[10px] font-mono shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]">⏱️ {data.duration} SEC</span>
            ) : 'VIDEO CLIP'}
          </span>
          <span className={`text-[10px] font-mono tracking-widest ${status === 'done' ? 'text-zinc-400' : 'text-zinc-500'}`}>
            {status.toUpperCase()}
          </span>

          {/* 🚨 脏数据断路器警报 UI */}
          {data.isDirty && (
            <div className="absolute top-[-36px] left-0 w-full flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="bg-red-500/90 backdrop-blur-md border border-red-400/50 text-white text-[10px] font-bold tracking-widest px-3 py-1 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.6)] flex items-center gap-1.5">
                  ⚠️ 上游数据已变更，当前视频已过期
               </div>
            </div>
          )}
        </div>

        {/* 视频预览区 (强制内联样式比例) */}
        <div style={currentStyle} className="w-full bg-[#0a0a0c] rounded-[16px] overflow-hidden border border-white/10 shadow-inner relative group/video transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-center">
          
          {/* ✨ 视频后处理悬浮舱 (平时隐藏，Hover浮现) */}
          {status === 'done' && data.videoUrl && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center p-1 bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[12px] shadow-[0_20px_40px_rgba(0,0,0,0.8)] opacity-0 group-hover/video:opacity-100 transition-all duration-300 z-50 scale-95 group-hover/video:scale-100">
              <button onClick={() => handlePostProcess('upscale', '高清HD强化')} className="flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-[10px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Maximize size={10}/> 高清</button>
              <button onClick={() => handlePostProcess('nosub', 'AI去字幕')} className="flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-[10px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Subtitles size={10}/> 去字幕</button>
              <div className="w-px h-3 bg-white/10 mx-0.5"></div>
              <div className="relative group/btn flex items-center">
                <button className="flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-[10px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><AudioWaveform size={10}/> 音轨分离 <ChevronDown size={8}/></button>
                <div className="absolute left-1/2 -translate-x-1/2 top-[100%] pt-2 opacity-0 group-hover/btn:opacity-100 pointer-events-none group-hover/btn:pointer-events-auto transition-all z-[101]">
                   <div className="bg-[#050505]/95 backdrop-blur-xl border border-white/10 p-1.5 rounded-[12px] shadow-2xl flex flex-col gap-0.5">
                     <button onClick={() => handlePostProcess('vocal', '人声提取')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">提取人声</button>
                     <button onClick={() => handlePostProcess('bgm', '环境音剥离')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">提取环境音</button>
                   </div>
                </div>
              </div>
              <div className="w-px h-3 bg-white/10 mx-0.5"></div>
              <button 
                onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = data.videoUrl; a.download = `YR_Video_${Date.now()}.mp4`; a.click(); }} 
                className="flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-[10px] font-bold text-zinc-300 hover:text-black hover:bg-white transition-all shadow-md whitespace-nowrap"
              >
                <Download size={10}/> 下载
              </button>
            </div>
          )}

{status === 'draft' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center dynamic-particles-container">
              {/* 隐藏的文件上传 input */}
              <input
                type="file"
                id={`upload-video-${id}`}
                className="hidden"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const result = ev.target?.result as string;
                      // 读取视频比例
                      const vid = document.createElement('video');
                      vid.src = result;
                      vid.onloadedmetadata = () => {
                        const w = vid.videoWidth;
                        const h = vid.videoHeight;
                        const ratioValue = w / h;
                        let finalRatio = '16:9';
                        if (ratioValue < 0.8) finalRatio = '9:16';
                        else if (ratioValue >= 0.8 && ratioValue < 1.2) finalRatio = '1:1';
                        else if (ratioValue >= 1.2 && ratioValue < 1.5) finalRatio = '4:3';
                        // 更新节点数据，设置预览
                        updateNodeData(id, { videoUrl: result, ratio: finalRatio, prompt: file.name, isGenerating: false });
                      };
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />

              {/* 粒子动画 CSS（与上面相同的动画定义） */}
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes space-drift {
                  0% { background-position: 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0px 0px; }
                  100% { background-position: 200px 300px, -150px 200px, 100px -200px, -200px -100px, 150px 150px; }
                }
                @keyframes nebula-pulse {
                  0% { opacity: 0.3; transform: scale(1); }
                  50% { opacity: 0.8; transform: scale(1.1); }
                  100% { opacity: 0.3; transform: scale(1); }
                }
                .dynamic-particles-container {
                  background-image: 
                    radial-gradient(1px 1px at 20px 20px, rgba(255,255,255,0.9), transparent),
                    radial-gradient(1.5px 1.5px at 40px 70px, rgba(255,255,255,0.7), transparent),
                    radial-gradient(2px 2px at 80px 120px, rgba(255,255,255,0.4), transparent),
                    radial-gradient(1px 1px at 150px 30px, rgba(255,255,255,0.8), transparent),
                    radial-gradient(1px 1px at 10px 130px, rgba(165,180,252,0.6), transparent);
                  background-size: 80px 80px, 110px 110px, 160px 160px, 90px 90px, 60px 60px;
                  animation: space-drift 50s linear infinite;
                }
                .dynamic-particles-container::before {
                  content: "";
                  position: absolute;
                  inset: -20%;
                  background: 
                    radial-gradient(circle at 20% 80%, rgba(76, 29, 149, 0.25) 0%, transparent 50%),
                    radial-gradient(circle at 80% 20%, rgba(30, 58, 138, 0.25) 0%, transparent 50%);
                  animation: nebula-pulse 8s ease-in-out infinite alternate;
                  pointer-events: none;
                  z-index: 1;
                }
                .dynamic-particles-container::after {
                  content: "";
                  position: absolute;
                  inset: 0;
                  background: radial-gradient(circle at center, transparent 20%, rgba(2, 2, 4, 0.95) 100%);
                  pointer-events: none;
                  z-index: 2;
                }
              `}} />

              {/* 上传按钮 */}
              <div
                onClick={() => document.getElementById(`upload-video-${id}`)?.click()}
                className="z-10 w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center cursor-pointer shadow-[0_0_40px_rgba(76,29,149,0.3)] transition-all duration-500 hover:scale-110 hover:shadow-[0_0_60px_rgba(99,102,241,0.5),inset_0_0_20px_rgba(255,255,255,0.1)] hover:border-white/30 hover:bg-white/10 group/btn nodrag"
              >
                <Upload size={16} className="text-zinc-400 group-hover/btn:text-white transition-colors" />
              </div>
              <span className="z-10 text-[10px] uppercase font-bold tracking-widest text-zinc-500 mt-2">
                上传原始视频素材
              </span>
            </div>
          )}
          {(status === 'generating' || status === 'pending') && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10">
               <Loader2 size={24} className="animate-spin text-amber-400 mb-2" />
               <span className="text-[10px] text-amber-400 uppercase tracking-widest font-bold animate-pulse">
                 {status === 'pending' ? 'QUEUED / 排队中...' : 'Synthesizing Video...'}
               </span>
             </div>
          )}
          {status === 'done' && data.videoUrl && (
             <video src={data.videoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
          )}
        </div>
      </div>

      {/* 底部悬浮控制舱 */}
      <div className={`absolute top-[100%] pt-4 left-1/2 -translate-x-1/2 w-[520px] transition-all duration-500 ease-out origin-top ${selected ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
         <div className="bg-black/60 border border-white/[0.08] backdrop-blur-3xl rounded-[32px] p-3 shadow-[0_40px_80px_rgba(0,0,0,0.9)] flex flex-col focus-within:border-white/20 transition-all">
            
            {/* ✨ 继承的全局美学锁定区 (点击齿轮展开微调) */}
            {(data.sceneLighting || data.globalCamera) && (
               <div className={`flex flex-col gap-1.5 mb-2 bg-[#050505]/80 p-2.5 rounded-[16px] border shadow-inner transition-all duration-300 ${isAestheticsExpanded ? 'border-white/20' : 'border-white/5'}`}>
                  
                  {/* 标题栏 (可点击触发展开) */}
                  <label 
                    className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-between cursor-pointer group/aes" 
                    onClick={() => setIsAestheticsExpanded(!isAestheticsExpanded)}
                  >
                    <span className="flex items-center gap-1"><Sparkles size={10}/> {isAestheticsExpanded ? '微调美学参数 (Edit Mode)' : '已锁定美学参数 (Locked Aesthetics)'}</span>
                    <button className="p-1 rounded-[6px] hover:bg-white/10 transition-colors">
                      <Settings2 size={12} className={`transition-all duration-500 ${isAestheticsExpanded ? 'text-amber-400 rotate-90' : 'text-zinc-600 group-hover/aes:text-white'}`}/>
                    </button>
                  </label>
                  
                  {/* 展开与折叠态的内容切换 */}
                  {isAestheticsExpanded ? (
                     <div className="flex flex-col gap-2 mt-1 animate-in fade-in slide-in-from-top-1 duration-300">
                        <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-zinc-500 font-mono tracking-widest">微调单场光影 [Scene Lighting]:</span>
                           <textarea 
                              className="w-full bg-black/60 border border-white/5 rounded-[8px] p-2 text-[10px] text-zinc-200 font-mono outline-none focus:border-white/20 nodrag nopan resize-none custom-scrollbar" 
                              rows={2} 
                              value={data.sceneLighting || ''} 
                              onChange={(e) => updateNodeData(id, { sceneLighting: e.target.value })} 
                              onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
                           />
                        </div>
                        <div className="flex flex-col gap-1">
                           <span className="text-[9px] text-zinc-500 font-mono tracking-widest">微调全片机位 [Global Camera]:</span>
                           <textarea 
                              className="w-full bg-black/60 border border-white/5 rounded-[8px] p-2 text-[10px] text-zinc-200 font-mono outline-none focus:border-white/20 nodrag nopan resize-none custom-scrollbar" 
                              rows={2} 
                              value={data.globalCamera || ''} 
                              onChange={(e) => updateNodeData(id, { globalCamera: e.target.value })} 
                              onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
                           />
                        </div>
                     </div>
                  ) : (
                     <div className="text-[10px] text-zinc-400 font-mono leading-relaxed line-clamp-2 mt-0.5 cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => setIsAestheticsExpanded(true)}>
                        <span className="text-zinc-500 font-bold">[光影]</span> {data.sceneLighting || '无'}<br/>
                        <span className="text-zinc-500 font-bold">[机位]</span> {data.globalCamera || '无'}
                     </div>
                  )}
               </div>
            )}

            {/* ✨ 修复：加入 group/zen2 并添加放大按钮 */}
            <div className="flex flex-col gap-1.5 mb-2 bg-[#050505]/50 p-2.5 rounded-[16px] border border-white/5 focus-within:border-white/20 transition-colors shadow-inner group/zen2">
               <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest flex items-center justify-between">
                 <span className="flex items-center gap-1"><Film size={10}/> 运镜时序轨 (Inherited Action Track)</span>
                 <button onClick={() => setZenMode({ field: 'prompt', label: '运镜时序轨' })} className="opacity-0 group-hover/zen2:opacity-100 text-zinc-400 hover:text-white transition-colors"><Expand size={10}/></button>
               </label>
               <MentionTextarea
                  value={data.prompt || ''} 
                  onChange={(v: string) => updateNodeData(id, { prompt: v })} 
                  placeholder="等待接收来自上一级的时序运镜数据..." 
                  incomingAssets={incomingAssets} 
               />
               {data.prompt && (
                 <div className="mt-1 text-[9px] text-zinc-500 font-light px-1 flex items-center gap-1">
                   <CheckCircle size={10} className="text-green-500/70"/> 数据已接力，底层渲染时将自动与上方【美学参数】进行缝合。
                 </div>
               )}
            </div>

            <div className="flex items-center justify-between px-3 pb-2 pt-2 border-t border-white/5 mt-1">
               <CustomSelect className="w-[180px]" value={data.model || 'doubao'} options={[{ value: 'doubao', label: 'Seedance 2.0' }, { value: 'kling', label: 'Kling O3' }]} onChange={(v: string) => updateNodeData(id, { model: v })} />
               
               <div className="flex items-center gap-2">
                 {status === 'draft' ? (
                    <button onClick={handleGenerateVideo} className="h-10 px-6 rounded-full bg-white text-black text-[12px] font-bold shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 transition-all">
                       一键合成视频
                    </button>
                 ) : (
                    <>
                       <button onClick={handleFissionClone} className="h-10 px-5 rounded-full bg-white/5 text-zinc-300 border border-white/10 text-[12px] font-medium hover:bg-white/10 hover:text-white transition-all">
                          克隆平行版本
                       </button>
                       <button className="h-10 px-5 rounded-full bg-transparent border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300 text-[12px] font-bold transition-all shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                          保存本地
                       </button>
                    </>
                 )}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};
// ==========================================
// ==========================================
// ==========================================
// 2. 图像节点 (MediaNode) - 搭载创作者悬浮面板
// ==========================================
export const MediaNode = ({ id, data, selected }: any) => {
  const { updateNodeData, getNodes, setNodes } = useReactFlow();
  const edges = useEdges();
  const { enqueueTask } = useCanvasEngine();
  const nodes = useNodes();
  const [showConfig, setShowConfig] = useState(false);
  const [showHDSettings, setShowHDSettings] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [brushColor, setBrushColor] = useState('#ff0000');
  const [brushSize, setBrushSize] = useState(4);
  const imgRef = useRef<HTMLImageElement>(null);
  const [zenMode, setZenMode] = useState<any>(null);
  
  const isReferenceOnly = !!data.asset;
  const displayImage = isReferenceOnly ? data.asset.url : data.resultUrl;

  const incomingAssets = edges.filter(e => e.target === id).map(e => {
    const srcNode = nodes.find(n => n.id === e.source);
    if (srcNode?.data?.asset) return { ...srcNode.data.asset, name: srcNode.data.name || srcNode.data.asset.prompt };
    const url = srcNode?.data?.resultUrl || srcNode?.data?.frameUrl || srcNode?.data?.videoUrl;
    if (url) {
       return { url, _type: url.includes('.mp4') ? 'video' : 'image', prompt: srcNode.data.prompt || srcNode.data.videoPrompt, name: srcNode.data.name || '连线参考' };
    }
    return null;
  }).filter(Boolean);

  const ratioStyleMap: Record<string, React.CSSProperties> = {
    '16:9': { width: '320px', aspectRatio: '16/9' }, '9:16': { width: '220px', aspectRatio: '9/16' },
    '1:1': { width: '260px', aspectRatio: '1/1' }, '4:3': { width: '280px', aspectRatio: '4/3' }, '3:4': { width: '240px', aspectRatio: '3/4' }
  };
  // ★ 优先使用图片真实比例（来自资产表提取），否则回退预设比例表
  const currentStyle = data.customAspectRatio
    ? { width: `${data.customWidth || 320}px`, aspectRatio: String(data.customAspectRatio) }
    : (ratioStyleMap[data.ratio || '16:9'] || ratioStyleMap['16:9']);

  // 高清放大确认
  const handleHDConfirm = () => {
    const srcUrl = data.frameUrl || data.resultUrl;
    if (!srcUrl) return;
    const thisNode = getNodes().find(n => n.id === id);
    if (!thisNode) return;
    const newNode = {
      id: `hd_node_${Date.now()}`,
      type: 'media',
      position: { x: thisNode.position.x + 500, y: thisNode.position.y + 100 },
      data: {
        resultUrl: srcUrl,
        prompt: '高清放大: ' + (data.firstFrameAnchor || data.prompt || ''),
        ratio: data.ratio || '16:9',
        model: 'hd-upscale-v1',
      }
    };
    setNodes((nds) => [...nds, newNode]);
    setShowHDSettings(false);
    useAppStore.getState().setToastMsg("✅ 高清放大节点已生成！");
  };

  const handleAnnotateDone = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL('image/png');

    const thisNode = getNodes().find(n => n.id === id);
    if (!thisNode) return;
    const newNode = {
      id: `annotated_${Date.now()}`,
      type: 'media',
      position: { x: thisNode.position.x + 500, y: thisNode.position.y + 100 },
      data: {
        resultUrl: dataURL,
        prompt: '标注图: ' + (data.firstFrameAnchor || data.prompt || ''),
        ratio: data.ratio || '16:9',
        model: data.model || 'gpt-image-2',
      }
    };
    setNodes((nds) => [...nds, newNode]);
    setIsAnnotating(false);
    useAppStore.getState().setToastMsg("✅ 标注图已作为新节点添加！");
  };

  // 标注时的绘制监听
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isAnnotating) return;

    const img = imgRef.current;
    if (img) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    }

    let drawing = false;
    const start = (e: MouseEvent) => {
      drawing = true;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;   // 计算缩放比
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    };
    const move = (e: MouseEvent) => {
      if (!drawing) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        ctx.lineTo(x, y);
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    };
    const end = () => {
      drawing = false;
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('mouseleave', end);
    };
  }, [isAnnotating, brushColor, brushSize]);

  const handleGenerate = () => {
    if (data.isGenerating) return;

    // ✨ 收集外部拉入或已连线的参考图 URLs
    const imageRefs = incomingAssets
      .filter((a: any) => a && (a.url || a.asset?.url))
      .map((a: any) => a.url || a.asset?.url)
      .filter(Boolean);

    // ✨ 写入节点状态并加入到多路并发调度任务队列中
    updateNodeData(id, { incomingAssets: incomingAssets });
    enqueueTask(id, 'image', getNodes, updateNodeData, imageRefs);
  };

  const showToast = (msg: string) => useAppStore.getState().setToastMsg(msg);
  
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!displayImage) return;
    const a = document.createElement('a');
    a.href = displayImage; a.download = `YR_Image_${Date.now()}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleSaveAsset = (category: string) => {
    const { activeCanvasProjectId, updateCanvasProject } = useAppStore.getState();
    const url = data.frameUrl || data.resultUrl || data.asset?.url;
    if (!url) {
      useAppStore.getState().setToastMsg("⚠️ 当前节点没有可保存的图片！");
      return;
    }
    if (!activeCanvasProjectId) {
      useAppStore.getState().setToastMsg("⚠️ 请先进入一个画布项目！");
      return;
    }
    const asset = {
      id: `local_${Date.now()}`,
      _type: 'image',
      url,
      prompt: data.firstFrameAnchor || data.prompt || '已保存资产',
      timestamp: Date.now(),
      ratio: data.ratio || '16:9',
      category,
    };
    // ★ 函数式更新：从状态机原子快照读取最新 localAssets，杜绝竞态覆盖
    updateCanvasProject(activeCanvasProjectId, (prev: any) => ({ localAssets: [asset, ...(prev?.localAssets || [])] }));
    useAppStore.getState().setToastMsg(`✅ 已存入 [${category === 'scene' ? '场景' : category === 'character' ? '人物' : '道具'}] 分类`);
  };

  return (
    <div className="relative z-20 group">
      {!isReferenceOnly && <Handle type="target" position={Position.Left} id="left" className={handleLeft} />}
      <Handle type="source" position={Position.Right} id="right" className={handleRight} />
      {zenMode && <ZenEditor label={zenMode.label} value={data[zenMode.field] || ''} onChange={(val: string) => updateNodeData(id, { [zenMode.field]: val })} onClose={() => setZenMode(null)} incomingAssets={incomingAssets} />}

      {displayImage && (
        <div className="absolute -top-[52px] left-1/2 -translate-x-1/2 flex items-center p-1.5 bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto z-[100] scale-95 group-hover:scale-100 after:content-[''] after:absolute after:-bottom-6 after:left-0 after:w-full after:h-6">
          <button onClick={() => setShowHDSettings(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Maximize size={12}/> 高清HD</button>
          {showHDSettings && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/10 rounded-[16px] p-4 z-[150] shadow-2xl flex flex-col gap-3 min-w-[220px] animate-in fade-in slide-in-from-top-2">
              <div className="text-white text-[12px] font-bold flex items-center gap-2">
                <Maximize size={14} className="text-indigo-400"/> 高清放大
              </div>
              <div className="flex flex-col gap-2 text-[11px] text-zinc-300">
                <div className="flex justify-between"><span className="text-zinc-500">模型</span><span className="font-mono">hd-upscale-v1</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">放大倍率</span><span className="font-mono">2x</span></div>
              </div>
              <div className="flex gap-2 justify-end mt-1">
                <button onClick={() => setShowHDSettings(false)} className="px-3 py-1.5 rounded-full bg-white/5 text-zinc-300 text-[10px] font-bold hover:bg-white/10 transition-all">取消</button>
                <button onClick={handleHDConfirm} className="px-4 py-1.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold hover:bg-indigo-400 transition-all shadow-lg">确认放大</button>
              </div>
            </div>
          )}
          
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={() => showToast("进入九宫格扩展模式")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Grid size={12}/> 九宫格</button>
          <button onClick={() => showToast("生成人物三视图")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><UserRound size={12}/> 多视图</button>
          <button onClick={() => setIsAnnotating(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><PenTool size={12}/> 标注</button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          
          <div className="relative group/save flex items-center">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><RefreshCcw size={12}/> 存资产 <ChevronDown size={10}/></button>
            <div className="absolute left-1/2 -translate-x-1/2 top-[100%] pt-2 opacity-0 group-hover/save:opacity-100 pointer-events-none group-hover/save:pointer-events-auto transition-all z-[101]">
               <div className="bg-[#050505]/95 backdrop-blur-xl border border-white/10 p-1.5 rounded-[12px] shadow-2xl flex flex-col gap-0.5">
                 <button onClick={() => handleSaveAsset('scene')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-emerald-400 hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">存为场景光影</button>
                 <button onClick={() => handleSaveAsset('character')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-amber-400 hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">存为人物造型</button>
                 <button onClick={() => handleSaveAsset('prop')} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-fuchsia-400 hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">存为静图道具</button>
               </div>
            </div>
          </div>
          
          <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-bold text-zinc-300 hover:text-black hover:bg-white transition-all shadow-md whitespace-nowrap"><Download size={12}/> 下载</button>
        </div>
      )}

      <div style={currentStyle} className={`${nodeBaseClass} ${selected ? selectedBorderClass : unselectedBorderClass} overflow-hidden flex flex-col p-1 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]`}>
        <div className="w-full h-full relative flex items-center justify-center bg-transparent rounded-[20px] overflow-hidden">
        {displayImage ? (
            <div className="relative w-full h-full">
              <img ref={imgRef} src={displayImage} className="w-full h-full object-contain" crossOrigin="anonymous" />
              {isAnnotating && (
                <>
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full nodrag nopan"
                    style={{ cursor: 'crosshair' }}
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-2 z-20 nodrag">
  <input
    type="color"
    value={brushColor}
    onChange={(e) => setBrushColor(e.target.value)}
    className="w-6 h-6 rounded cursor-pointer nodrag"
    title="画笔颜色"
  />
  <input
    type="range"
    min="2"
    max="20"
    value={brushSize}
    onChange={(e) => setBrushSize(Number(e.target.value))}
    className="w-20 h-4 nodrag"
    title="画笔粗细"
  />
  <span className="text-[10px] text-white/80">{brushSize}px</span>
</div>
                  <div className="absolute bottom-2 right-2 flex gap-2 z-20">
                    <button onClick={handleAnnotateDone} className="px-3 py-1.5 bg-green-500 text-white rounded-full text-[10px] font-bold shadow-lg nodrag">完成</button>
                    <button onClick={() => setIsAnnotating(false)} className="px-3 py-1.5 bg-white/10 text-white rounded-full text-[10px] font-bold nodrag">取消</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#020204] overflow-hidden dynamic-particles-container">
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes space-drift {
                  0% { background-position: 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0px 0px; }
                  100% { background-position: 200px 300px, -150px 200px, 100px -200px, -200px -100px, 150px 150px; }
                }
                @keyframes nebula-pulse {
                  0% { opacity: 0.3; transform: scale(1); }
                  50% { opacity: 0.8; transform: scale(1.1); }
                  100% { opacity: 0.3; transform: scale(1); }
                }
                .dynamic-particles-container {
                  background-image: 
                    radial-gradient(1px 1px at 20px 20px, rgba(255,255,255,0.9), transparent),
                    radial-gradient(1.5px 1.5px at 40px 70px, rgba(255,255,255,0.7), transparent),
                    radial-gradient(2px 2px at 80px 120px, rgba(255,255,255,0.4), transparent),
                    radial-gradient(1px 1px at 150px 30px, rgba(255,255,255,0.8), transparent),
                    radial-gradient(1px 1px at 10px 130px, rgba(165,180,252,0.6), transparent);
                  background-size: 80px 80px, 110px 110px, 160px 160px, 90px 90px, 60px 60px;
                  animation: space-drift 50s linear infinite;
                }
                .dynamic-particles-container::before {
                  content: "";
                  position: absolute;
                  inset: -20%;
                  background: 
                    radial-gradient(circle at 20% 80%, rgba(76, 29, 149, 0.25) 0%, transparent 50%),
                    radial-gradient(circle at 80% 20%, rgba(30, 58, 138, 0.25) 0%, transparent 50%);
                  animation: nebula-pulse 8s ease-in-out infinite alternate;
                  pointer-events: none;
                  z-index: 1;
                }
                .dynamic-particles-container::after {
                  content: "";
                  position: absolute;
                  inset: 0;
                  background: radial-gradient(circle at center, transparent 20%, rgba(2, 2, 4, 0.95) 100%);
                  pointer-events: none;
                  z-index: 2;
                }
              `}} />
              

                <input
                  type="file"
                  id={`upload-media-${id}`}
                  className="hidden"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const compressedBase64 = await compressImage(file);
                      const img = new Image(); 
                      img.src = compressedBase64;
                      img.onload = () => {
                         const ratioValue = img.naturalWidth / img.naturalHeight;
                         let finalRatio = '16:9';
                         if (ratioValue < 0.8) finalRatio = '9:16'; else if (ratioValue >= 0.8 && ratioValue < 1.2) finalRatio = '1:1'; else if (ratioValue >= 1.2 && ratioValue < 1.5) finalRatio = '4:3';
                         updateNodeData(id, { resultUrl: compressedBase64, ratio: finalRatio });
                      }
                    }
                  }}
                 />
              
              {data.isGenerating ? (
                 <div className="z-10 flex flex-col items-center">
                    <Loader2 size={24} className="mb-3 animate-spin text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,1)]" />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-300 animate-pulse drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]">Synthesizing...</span>
                 </div>
              ) : (
                 <div 
                   onClick={() => document.getElementById(`upload-media-${id}`)?.click()}
                   className="z-10 w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center cursor-pointer shadow-[0_0_40px_rgba(76,29,149,0.3)] transition-all duration-500 hover:scale-110 hover:shadow-[0_0_60px_rgba(99,102,241,0.5),inset_0_0_20px_rgba(255,255,255,0.1)] hover:border-white/30 hover:bg-white/10 group/btn nodrag"
                 >
                    <Upload size={16} className="text-zinc-400 group-hover/btn:text-white transition-colors" />
                 </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!isReferenceOnly && (
        <div className={`absolute top-[100%] pt-4 left-1/2 -translate-x-1/2 w-[540px] transition-all duration-500 ease-out origin-top ${selected ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
           <div className="bg-black/60 border border-white/[0.08] backdrop-blur-3xl rounded-[32px] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.85)] focus-within:border-white/20 transition-all flex flex-col">
              
              <div className="relative mb-4 bg-[#050505]/50 rounded-[16px] border border-white/5 focus-within:border-white/20 transition-colors shadow-inner group/zen">
                 <div className="min-h-[120px] p-2">
                                 {/* 🆕 已连线参考图小预览 */}
               {incomingAssets.filter((a:any) => a._type === 'image').length > 0 && (
                 <div className="flex gap-2 mb-1 flex-wrap">
                   {incomingAssets.filter((a:any) => a._type === 'image').map((asset: any, idx: number) => (
                    <div key={idx} className="relative group/ref w-12 h-12 rounded-[8px] overflow-hidden border border-white/20 hover:border-white/50 hover:scale-150 hover:z-50 transition-all duration-200 cursor-pointer" title={`参考图${idx+1}: ${asset.prompt || '未命名'}`}>
                       <img src={asset.url} className="w-full h-full object-cover" />
                       <span className="absolute top-0.5 left-0.5 bg-black/80 text-white text-[8px] px-1 rounded font-bold">{idx+1}</span>
                     </div>
                   ))}
                 </div>
               )}
                    <MentionTextarea value={data.prompt || ''} onChange={(v: string) => updateNodeData(id, { prompt: v })} placeholder="输入提示词，或输入 @ 选择已连接的参考图参与融合..." incomingAssets={incomingAssets} disableMention={false} />
                 </div>
                 <button onClick={() => setZenMode({ field: 'prompt', label: '生图提示词' })} className="absolute top-3 right-3 p-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg opacity-0 group-hover/zen:opacity-100 text-zinc-400 hover:text-white hover:bg-white/10 transition-all shadow-md z-10">
                    <Expand size={14}/>
                 </button>
              </div>
              
              <div className="flex items-center justify-between px-2 pb-1 relative">
                 <div className="flex items-center gap-2">
                    <CustomSelect 
                      className="w-[150px]" 
                      value={data.model || 'gpt-image-2'} 
                      options={[
                        { value: 'gpt-image-2', label: 'GPT-Image-2' },
                        { value: 'banana-pro', label: 'Banana Pro' },
                        { value: 'seedream5.0', label: 'Seedream 5.0' }
                      ]} 
                      onChange={(v: string) => {
                        // ✨【防呆分辨率自动重置机制】
                        // 自动核对新选模型是否兼容当前画质，如果不匹配，立即重设为对应模型的安全默认值
                        let nextQuality = data.quality || '1K';
                        if (v === 'seedream5.0') {
                          if (!['2K', '3K'].includes(nextQuality)) {
                            nextQuality = '2K';
                          }
                        } else if (v === 'banana-pro') {
                          if (!['1K', '2K', '4K'].includes(nextQuality)) {
                            nextQuality = '2K';
                          }
                        } else {
                          nextQuality = '1K';
                        }
                        updateNodeData(id, { model: v, quality: nextQuality });
                      }} 
                    />
                    <CustomSelect className="w-[80px]" value={data.n || 1} options={[{ value: 1, label: '1 张' }, { value: 2, label: '2 张' }, { value: 3, label: '3 张' }, { value: 4, label: '4 张' }]} onChange={(v: number) => updateNodeData(id, { n: v })} />
                    
                    <div className="relative group/cfg">
                       <button onClick={() => setShowConfig(!showConfig)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] transition-all nodrag ${showConfig ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'}`}>
                           <span className="text-[10px] font-bold tracking-widest">{data.ratio || '16:9'} / {data.quality || '1K'}</span>
                           <Settings2 size={14}/>
                       </button>
                       {showConfig && (
                          <div className="absolute bottom-[calc(100%+10px)] left-0 w-[240px] bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/10 rounded-[16px] shadow-2xl p-3 z-50 flex flex-col gap-3 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                             <div className="flex flex-col gap-1">
                                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">画面比例 (Ratio)</label>
                                <div className="flex gap-1 bg-black/40 p-1 rounded-[8px] border border-white/5">
                                  {['16:9', '9:16', '1:1', '4:3'].map(r => (
                                    <button key={r} onClick={() => updateNodeData(id, { ratio: r })} className={`flex-1 py-1 text-[10px] rounded-[4px] transition-all nodrag ${data.ratio === r ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'}`}>{r}</button>
                                  ))}
                                </div>
                             </div>
                             <div className="flex flex-col gap-1 z-10">
                                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">画质设定 (Quality)</label>
                                <CustomSelect 
                                   menuPosition="top" 
                                   className="w-full bg-black/40 border border-white/5 text-zinc-300 rounded-[8px]" 
                                   value={data.quality || (data.model === 'seedream5.0' ? '2K' : '1K')} 
                                   options={getImageQualityOptions(data.model || 'gpt-image-2')} 
                                   onChange={(v: string) => updateNodeData(id, { quality: v })} 
                                />
                             </div>
                             <div className="flex flex-col gap-1 z-20">
                                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">风格强覆写 (Override)</label>
                                <CustomSelect menuPosition="top" className="w-full bg-black/40 border border-white/5 text-zinc-300 rounded-[8px]" value={data.styleOverride || '继承全局预设'} options={[{ value: '继承全局预设', label: '继承全局预设' }, { value: '🎬 电影质感', label: '🎬 电影质感' }, { value: '🌸 二次元', label: '🌸 二次元' }, { value: '📷 极致写实', label: '📷 极致写实' }, { value: '🧊 3D 渲染', label: '🧊 3D 渲染' }, { value: '🌃 赛博朋克', label: '🌃 赛博朋克' }]} onChange={(v: string) => updateNodeData(id, { styleOverride: v })} />
                             </div>
                          </div>
                       )}
                    </div>
                 </div>
                 
                 <button onClick={handleGenerate} className={`h-[40px] w-[40px] rounded-full flex items-center justify-center transition-all nodrag shadow-lg ${data.isGenerating ? 'bg-indigo-500/20 text-indigo-400 cursor-wait' : 'bg-white text-black hover:scale-110 shadow-[0_0_25px_rgba(255,255,255,0.5)]'}`}>
                   {data.isGenerating ? <Loader2 size={18} className="animate-spin" /> : <MoveUp size={18} strokeWidth={2.5} />}
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 3. 视频生成节点 (RenderNode) - 搭载创作者悬浮面板
// ==========================================
export const RenderNode = ({ id, data, selected }: any) => {
  const { updateNodeData } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes();
  const [showConfig, setShowConfig] = useState(false);
  
  const isReferenceOnly = !!data.asset;
  const displayVideo = isReferenceOnly ? data.asset.url : data.resultUrl;

  const incomingAssets = edges.filter(e => e.target === id).map(e => {
    const srcNode = nodes.find(n => n.id === e.source);
    if (srcNode?.data?.asset) return srcNode.data.asset;
    if (srcNode?.data?.resultUrl) return { url: srcNode.data.resultUrl, _type: 'video', prompt: srcNode.data.prompt };
    return null;
  }).filter(Boolean);

  // 核心修复：视频节点尺寸更大，使用内联样式彻底锁死比例
  const ratioStyleMap: Record<string, React.CSSProperties> = { 
    '16:9': { width: '400px', aspectRatio: '16/9' }, '9:16': { width: '260px', aspectRatio: '9/16' }, 
    '1:1': { width: '320px', aspectRatio: '1/1' }, '4:3': { width: '380px', aspectRatio: '4/3' }, '3:4': { width: '320px', aspectRatio: '3/4' } 
  };
  const currentStyle = ratioStyleMap[data.ratio || '16:9'] || ratioStyleMap['16:9'];

  const handleRender = async () => {
    if (data.isGenerating) return;
    const imageRefs = incomingAssets.filter((a: any) => a._type === 'image').map((a: any) => a.url);
    const videoRefs = incomingAssets.filter((a: any) => a._type === 'video').map((a: any) => a.url);

    updateNodeData(id, { isGenerating: true });
    try {
      const payload: any = { model: data.model || 'doubao-seedance-2-0-260128', mode: imageRefs.length > 0 ? 'i2v' : (videoRefs.length > 0 ? 'v2v' : 't2v'), prompt: data.prompt || '生成动态视频', ratio: data.ratio || '16:9' };
      if (imageRefs.length > 0) { payload.image = imageRefs[0]; payload.images = imageRefs; }
      if (videoRefs.length > 0) { payload.video_url = videoRefs[0]; }

      const response = await fetchApi('/v1/videos/generations', { method: 'POST', body: JSON.stringify(payload) });
      const submitData = await response.json();
      
      let isPolling = true;
      while (isPolling) {
        await new Promise(resolve => setTimeout(resolve, 3500));
        const pollRes = await fetchApi('/v1/videos/status', { method: 'POST', body: JSON.stringify({ task_id: submitData.task_id, model: submitData.model }) });
        const pollData = await pollRes.json();
        if (pollData.status === 'succeeded') { updateNodeData(id, { isGenerating: false, resultUrl: pollData.url }); isPolling = false; } 
        else if (pollData.status === 'failed') { 
          updateNodeData(id, { isGenerating: false }); 
          useAppStore.getState().setToastMsg("视频生成失败"); 
          isPolling = false; 
        }
      }
    } catch (e) { 
      updateNodeData(id, { isGenerating: false }); 
      useAppStore.getState().setToastMsg("网络请求异常，请检查配置"); 
    }
  };

  const showToast = (msg: string) => useAppStore.getState().setToastMsg(msg);
    // ✨ 新增：视频存资产函数
    const handleSaveAsset = () => {
      const { activeCanvasProjectId, updateCanvasProject } = useAppStore.getState();
      if (!activeCanvasProjectId || typeof updateCanvasProject !== 'function') return;
      const url = displayVideo;
      if (!url) return;
      const asset = {
        id: `local_${Date.now()}`, _type: 'video', url,
        prompt: data.prompt || '已保存的视频',
        timestamp: Date.now(), ratio: data.ratio || '16:9'
      };
      // ★ 函数式更新：从状态机原子快照读取最新 localAssets，杜绝竞态覆盖
      updateCanvasProject(activeCanvasProjectId, (prev: any) => ({ localAssets: [asset, ...(prev?.localAssets || [])] }));
      useAppStore.getState().setToastMsg(`✅ 视频已存入侧边栏资产库！`);
    };
  
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!displayVideo) return;
    const a = document.createElement('a');
    a.href = displayVideo; a.download = `YR_Video_${Date.now()}.mp4`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="relative z-20 group">
      {!isReferenceOnly && <Handle type="target" position={Position.Left} id="left" className={handleLeft} />}
      <Handle type="source" position={Position.Right} id="right" className={handleRight} />

      {/* ✨ 视频核心控制台 (平时隐藏，Hover浮现) */}
      {displayVideo && (
        <div className="absolute -top-[52px] left-1/2 -translate-x-1/2 flex items-center p-1.5 bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto z-[100] scale-95 group-hover:scale-100 after:content-[''] after:absolute after:-bottom-6 after:left-0 after:w-full after:h-6">
          <button onClick={() => showToast("调起视频高清重绘流...")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Maximize size={12}/> 高清HD</button>
          <button onClick={() => showToast("正在提取字幕遮罩层...")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Subtitles size={12}/> 去字幕</button>
          <button onClick={() => showToast("开启画幅修剪与高光剪辑")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Scissors size={12}/> 剪辑片段</button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          
          <div className="relative group/btn flex items-center">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><AudioWaveform size={12}/> 音频分离 <ChevronDown size={10}/></button>
            {/* 🚀 核心修复：用隐形的 padding-top 撑开透明间隙，保证悬停不断层 */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[100%] pt-2 opacity-0 group-hover/btn:opacity-100 pointer-events-none group-hover/btn:pointer-events-auto transition-all z-[101]">
               <div className="bg-[#050505]/95 backdrop-blur-xl border border-white/10 p-1.5 rounded-[12px] shadow-2xl flex flex-col gap-0.5">
                 <button onClick={() => showToast("正在提取独立人声轨道...")} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">提取人声</button>
                 <button onClick={() => showToast("正在剥离背景环境音...")} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">提取背景音</button>
                 <button onClick={() => showToast("人声与背景声双轨分离中...")} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">全部分离</button>
               </div>
            </div>
          </div>
          
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          {/* ✨ 下面这行是新加的存资产按钮 */}
          <button onClick={handleSaveAsset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><RefreshCcw size={12}/> 存资产</button>

          <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-bold text-zinc-300 hover:text-black hover:bg-white transition-all shadow-md whitespace-nowrap"><Download size={12}/> 下载</button>
        </div>
      )}

<div style={currentStyle} className={`${nodeBaseClass} ${selected ? selectedBorderClass : unselectedBorderClass} overflow-hidden flex flex-col p-1.5 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]`}>
        <div className="w-full h-full relative flex items-center justify-center bg-transparent rounded-[20px] overflow-hidden">
          {displayVideo ? (
            <video key={displayVideo} src={displayVideo} preload="metadata" className="w-full h-full max-h-[500px] object-contain rounded-[18px]" controls autoPlay loop muted playsInline />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center dynamic-particles-container">
              <input
                type="file"
                id={`upload-render-${id}`}
                className="hidden"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const result = ev.target?.result as string;
                      const vid = document.createElement('video');
                      vid.src = result;
                      vid.onloadedmetadata = () => {
                        const w = vid.videoWidth;
                        const h = vid.videoHeight;
                        const ratioValue = w / h;
                        let finalRatio = '16:9';
                        if (ratioValue < 0.8) finalRatio = '9:16';
                        else if (ratioValue >= 0.8 && ratioValue < 1.2) finalRatio = '1:1';
                        else if (ratioValue >= 1.2 && ratioValue < 1.5) finalRatio = '4:3';
                        const asset = { id: `local_${Date.now()}`, _type: 'video', url: result, prompt: file.name, timestamp: Date.now(), ratio: finalRatio };
                        updateNodeData(id, { asset: asset, resultUrl: result, ratio: finalRatio, prompt: file.name, isGenerating: false });
                      };
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes space-drift {
                  0% { background-position: 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0px 0px; }
                  100% { background-position: 200px 300px, -150px 200px, 100px -200px, -200px -100px, 150px 150px; }
                }
                @keyframes nebula-pulse {
                  0% { opacity: 0.3; transform: scale(1); }
                  50% { opacity: 0.8; transform: scale(1.1); }
                  100% { opacity: 0.3; transform: scale(1); }
                }
                .dynamic-particles-container {
                  background-image: 
                    radial-gradient(1px 1px at 20px 20px, rgba(255,255,255,0.9), transparent),
                    radial-gradient(1.5px 1.5px at 40px 70px, rgba(255,255,255,0.7), transparent),
                    radial-gradient(2px 2px at 80px 120px, rgba(255,255,255,0.4), transparent),
                    radial-gradient(1px 1px at 150px 30px, rgba(255,255,255,0.8), transparent),
                    radial-gradient(1px 1px at 10px 130px, rgba(165,180,252,0.6), transparent);
                  background-size: 80px 80px, 110px 110px, 160px 160px, 90px 90px, 60px 60px;
                  animation: space-drift 50s linear infinite;
                }
                .dynamic-particles-container::before {
                  content: "";
                  position: absolute;
                  inset: -20%;
                  background: 
                    radial-gradient(circle at 20% 80%, rgba(76, 29, 149, 0.25) 0%, transparent 50%),
                    radial-gradient(circle at 80% 20%, rgba(30, 58, 138, 0.25) 0%, transparent 50%);
                  animation: nebula-pulse 8s ease-in-out infinite alternate;
                  pointer-events: none;
                  z-index: 1;
                }
                .dynamic-particles-container::after {
                  content: "";
                  position: absolute;
                  inset: 0;
                  background: radial-gradient(circle at center, transparent 20%, rgba(2, 2, 4, 0.95) 100%);
                  pointer-events: none;
                  z-index: 2;
                }
              `}} />
              {data.isGenerating ? (
                <>
                  <Loader2 size={24} className="mb-3 opacity-80 animate-spin text-amber-200" />
                  <span className="text-[10px] uppercase font-bold tracking-widest text-amber-200 animate-pulse">Synthesizing Video...</span>
                </>
              ) : (
                <>
                  <div className="flex gap-3 z-10 items-center">
                    <div
                      onClick={() => document.getElementById(`upload-render-${id}`)?.click()}
                      className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 hover:border-white/30 transition-all nodrag"
                    >
                      <Upload size={14} className="text-zinc-400" />
                    </div>
                    <button onClick={handleRender} className="px-4 py-2 border border-white/10 rounded-full text-[11px] font-bold text-zinc-300 hover:bg-white/10 hover:text-white transition-all nodrag">文本生成</button>
                    <button onClick={() => showToast("请先将外部媒体连入左侧节点")} className="px-4 py-2 border border-white/10 rounded-full text-[11px] font-bold text-zinc-300 hover:bg-white/10 hover:text-white transition-all nodrag">首尾合成</button>
                  </div>
                  <span className="z-10 text-[10px] uppercase font-bold tracking-widest text-zinc-500 mt-3">Video Node</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {!isReferenceOnly && (
        <div className={`absolute top-[100%] pt-5 left-1/2 -translate-x-1/2 w-[540px] transition-all duration-500 ease-out opacity-0 -translate-y-4 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto ${selected ? '!opacity-100 !translate-y-0 !pointer-events-auto' : ''}`}>
           <div className="bg-black/60 border border-white/[0.08] backdrop-blur-3xl rounded-[32px] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.85)] focus-within:border-white/20 transition-all flex flex-col">
              
              <MentionTextarea 
                value={data.prompt || ''}
                onChange={(v: string) => updateNodeData(id, { prompt: v })}
                placeholder="描述运镜方式与视频动态细节，或输入 @ 引用镜头序列..."
                incomingAssets={incomingAssets}
              />
              
              <div className="flex items-center justify-between px-3 pb-2 pt-2 border-t border-white/5">
              <div className="flex items-center gap-2">
                    <CustomSelect className="w-[180px]" value={data.model || 'doubao-seedance-2-0'} options={[{ value: 'doubao-seedance-2-0', label: 'Seedance 2.0 (默认)' }, { value: 'kling-o3', label: 'Kling O3' }]} onChange={(v: string) => updateNodeData(id, { model: v })} />
                    
                 {/* ✨ 修复：全面升级的高级黑玻璃视频参数控制舱 */}
                 <div className="relative group/cfg">
                    <button onClick={() => setShowConfig(!showConfig)} className={`p-2 rounded-[10px] transition-all nodrag ${showConfig ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'}`}><Settings2 size={16}/></button>
                    {showConfig && (
                       <div className="absolute bottom-[calc(100%+10px)] left-0 w-[280px] bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/10 rounded-[20px] shadow-[0_40px_80px_rgba(0,0,0,0.95)] p-4 z-50 flex flex-col gap-4 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                          
                          <div className="flex flex-col gap-2">
                             <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">物理时长 (Duration)</label>
                             <div className="flex gap-1 bg-black/40 p-1.5 rounded-[12px] border border-white/5">
                               {[4, 5, 8, 10, 15].map(d => (
                                 <button key={d} onClick={() => updateNodeData(id, { duration: d })} className={`flex-1 py-1.5 text-[11px] rounded-[8px] font-bold transition-all nodrag ${data.duration === d ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-inner' : 'text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent'}`}>{d}s</button>
                               ))}
                             </div>
                          </div>

                          <div className="flex flex-col gap-2">
                             <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">画面比例 (Ratio)</label>
                             <div className="flex gap-1 bg-black/40 p-1.5 rounded-[12px] border border-white/5">
                               {['16:9', '9:16', '1:1', '4:3'].map(r => (
                                 <button key={r} onClick={() => updateNodeData(id, { ratio: r })} className={`flex-1 py-1.5 text-[11px] rounded-[8px] font-bold transition-all nodrag ${data.ratio === r ? 'bg-white/10 text-white border border-white/10 shadow-inner' : 'text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent'}`}>{r}</button>
                               ))}
                             </div>
                          </div>
                          
                          <div className="flex flex-col gap-2 z-10">
                             <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">渲染精度 (Resolution)</label>
                             <div className="flex flex-wrap gap-1 bg-black/40 p-1.5 rounded-[12px] border border-white/5">
                               {['480P', '720P', '1080P', '4K'].map(res => (
                                 <button key={res} onClick={() => updateNodeData(id, { resolution: res })} className={`flex-1 py-1.5 px-2 text-[11px] rounded-[8px] font-bold transition-all nodrag ${data.resolution === res ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-inner' : 'text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent'}`}>{res}</button>
                               ))}
                             </div>
                          </div>
                       </div>
                    )}
                 </div>
                 </div>
                 
                 <button onClick={handleRender} className={`h-[44px] w-[44px] rounded-full flex items-center justify-center transition-all nodrag shadow-lg ${data.isGenerating ? 'bg-amber-500/20 text-amber-400 cursor-wait' : 'bg-white text-black hover:scale-110 shadow-[0_0_25px_rgba(255,255,255,0.5)]'}`}>
                   {data.isGenerating ? <Loader2 size={20} className="animate-spin" /> : <MoveUp size={20} strokeWidth={2.5} />}
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 4. 合成终点节点 (CombineNode)
// ==========================================
export const CombineNode = ({ data }: any) => {
  return (
    <div className="relative z-20 group">
      {/* ✨ 将触点放在外壳上 */}
      <Handle type="target" position={Position.Left} id="left" className={handleLeft} />
      
      <div className={`${nodeBaseClass} ${unselectedBorderClass} w-[400px] aspect-video overflow-hidden flex flex-col p-1.5`}>
        <div className="w-full h-full relative flex items-center justify-center bg-black rounded-[20px] overflow-hidden">
          {data.resultUrl ? (
            <video key={data.resultUrl} src={data.resultUrl} preload="auto" className="w-full h-full object-contain rounded-[20px]" controls autoPlay loop muted playsInline />
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-600">
               {data.isCombining ? (
                 <><Loader2 size={32} className="mb-3 opacity-80 animate-spin text-white" /><span className="text-[12px] uppercase font-bold text-white animate-pulse tracking-widest">Global Compiling...</span></>
               ) : (
                 <><Layers size={32} className="mb-3 opacity-50" /><span className="text-[12px] uppercase font-medium tracking-widest">Final Output</span></>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 5. 全新路线：表格型分镜脚本节点 (ScriptTableNode)
// ==========================================
export const ScriptTableNode = ({ id, data, selected }: any) => {
  const { updateNodeData } = useReactFlow();

  const updateRow = (rowId: string, field: string, value: string) => {
    const newRows = data.rows.map((r: any) => r.id === rowId ? { ...r, [field]: value } : r);
    updateNodeData(id, { rows: newRows });
  };

  const addRow = () => {
    const newRow = { id: `row_${Date.now()}`, shotNumber: String(data.rows.length + 1).padStart(2, '0'), duration: '5s', camera: '', movement: '', shotType: '', videoDesc: '', characters: '', audio: '', imgScene: '', imgShotType: '', imgDesc: '', imgCharacters: '', imgEmotion: '', imgPrompt: '' };
    updateNodeData(id, { rows: [...data.rows, newRow] });
  };

  const InputField = ({ label, value, onChange, isTextArea = false }: any) => (
    <div className="flex flex-col gap-1 w-full">
      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest pl-0.5">{label}</span>
      {isTextArea ? (
        <textarea className="w-full bg-black/40 border border-white/[0.05] focus:border-white/20 rounded-[8px] p-2 text-[11px] text-zinc-200 outline-none resize-none custom-scrollbar nodrag nopan transition-colors min-h-[48px]" value={value} onChange={(e) => onChange(e.target.value)} onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }} />
      ) : (
        <input className="w-full bg-black/40 border border-white/[0.05] focus:border-white/20 rounded-[8px] p-2 text-[11px] text-zinc-200 outline-none nodrag nopan transition-colors h-[30px]" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );

  return (
    <div className="relative group/node z-20" style={{ width: '1000px' }}>
      <Handle type="target" position={Position.Left} id="left" className={handleLeft} />
      <Handle type="source" position={Position.Right} id="right" className={handleRight} />
      
      <div className={`${nodeBaseClass} ${selected ? selectedBorderClass : unselectedBorderClass} flex flex-col p-4 transition-all duration-500`}>
        
        {/* 表格头部信息 */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-[10px] bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shadow-inner">
               <Table size={14} className="text-amber-300" />
             </div>
             <div className="flex flex-col">
               <span className="text-[14px] font-bold text-white tracking-widest">全局脚本视图</span>
               <span className="text-[9px] text-zinc-500 font-mono tracking-wider mt-0.5">SCRIPT TABLE MATRIX</span>
             </div>
          </div>
          
          <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-400">
             <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-[8px] border border-white/5 shadow-inner">
               <span className="text-amber-500">光影</span> <span className="truncate max-w-[150px]">{data.sceneLighting || '未继承'}</span>
             </div>
             <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-[8px] border border-white/5 shadow-inner">
               <span className="text-indigo-400">机位</span> <span className="truncate max-w-[150px]">{data.globalCamera || '未继承'}</span>
             </div>
          </div>
        </div>

        {/* 原文引用 */}
        <div className="mb-4 text-[11px] text-zinc-500 leading-relaxed font-light p-3 bg-white/[0.02] rounded-[12px] border border-white/[0.02] shadow-inner">
            <span className="text-zinc-400 font-bold opacity-50 mr-1">“</span>{data.scriptText}<span className="text-zinc-400 font-bold opacity-50 ml-1">”</span>
        </div>

        {/* 表格实体：多行遍历 */}
        <div className="flex flex-col gap-4">
           {data.rows?.map((row: any, index: number) => (
              <div key={row.id} className="flex flex-col bg-[#050505] border border-white/10 rounded-[16px] shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden group/row transition-all focus-within:border-white/30">
                 
                 {/* 行标题 */}
                 <div className="bg-white/[0.03] border-b border-white/5 px-4 py-2 flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-white tracking-widest px-2 py-0.5 bg-white/10 rounded-[4px] border border-white/10 shadow-inner">
                      SHOT {row.shotNumber}
                    </span>
                 </div>

                 {/* 左右双轨视图 */}
                 <div className="flex w-full">
                    
                    {/* 左侧：视频生成属性 (Video Track) */}
                    <div className="w-1/2 p-4 border-r border-white/5 flex flex-col gap-3 relative">
                       <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/[0.02] to-transparent pointer-events-none" />
                       <div className="flex items-center gap-2 mb-1">
                          <Film size={12} className="text-indigo-400"/>
                          <span className="text-[10px] font-bold text-indigo-400/80 tracking-widest uppercase">生视频运镜参数 (Video Track)</span>
                       </div>
                       <div className="grid grid-cols-4 gap-2">
                          <InputField label="镜号" value={row.shotNumber} onChange={(v:any) => updateRow(row.id, 'shotNumber', v)} />
                          <InputField label="时长" value={row.duration} onChange={(v:any) => updateRow(row.id, 'duration', v)} />
                          <InputField label="机位" value={row.camera} onChange={(v:any) => updateRow(row.id, 'camera', v)} />
                          <InputField label="景别" value={row.shotType} onChange={(v:any) => updateRow(row.id, 'shotType', v)} />
                       </div>
                       <InputField label="出场角色" value={row.characters} onChange={(v:any) => updateRow(row.id, 'characters', v)} />
                       <InputField label="运镜与演进 (Movement)" value={row.movement} isTextArea onChange={(v:any) => updateRow(row.id, 'movement', v)} />
                       <InputField label="物理动作描述 (Action)" value={row.videoDesc} isTextArea onChange={(v:any) => updateRow(row.id, 'videoDesc', v)} />
                       <InputField label="音效设计" value={row.audio} onChange={(v:any) => updateRow(row.id, 'audio', v)} />
                    </div>

                    {/* 右侧：首帧图属性 (Image Track) */}
                    <div className="w-1/2 p-4 flex flex-col gap-3 relative">
                       <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-bl from-amber-500/[0.02] to-transparent pointer-events-none" />
                       <div className="flex items-center gap-2 mb-1">
                          <ImageIcon size={12} className="text-amber-400"/>
                          <span className="text-[10px] font-bold text-amber-400/80 tracking-widest uppercase">生图首帧参数 (Image Track)</span>
                       </div>
                       <div className="grid grid-cols-3 gap-2">
                          <InputField label="场景" value={row.imgScene} onChange={(v:any) => updateRow(row.id, 'imgScene', v)} />
                          <InputField label="景别" value={row.imgShotType} onChange={(v:any) => updateRow(row.id, 'imgShotType', v)} />
                          <InputField label="情绪" value={row.imgEmotion} onChange={(v:any) => updateRow(row.id, 'imgEmotion', v)} />
                       </div>
                       <InputField label="角色" value={row.imgCharacters} onChange={(v:any) => updateRow(row.id, 'imgCharacters', v)} />
                       <InputField label="静帧动作与站位 (Pose & Blocking)" value={row.imgDesc} isTextArea onChange={(v:any) => updateRow(row.id, 'imgDesc', v)} />
                       <InputField label="拼合生图提示词 (Final Prompt)" value={row.imgPrompt} isTextArea onChange={(v:any) => updateRow(row.id, 'imgPrompt', v)} />
                    </div>
                 </div>
              </div>
           ))}
        </div>

        {/* 底部加行按钮 */}
        <button onClick={addRow} className="mt-4 w-full py-3 border border-dashed border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.05] rounded-[16px] flex items-center justify-center gap-2 text-[11px] font-bold text-zinc-400 hover:text-white transition-all nodrag">
          <Plus size={14} /> 增加分镜行
        </button>
      </div>
    </div>
  );
};

// ==========================================
// 6. 全新路线：前置资产基建表格 (AssetTableNode) - 终极生图版
// ==========================================
export const AssetTableNode = ({ id, data, selected }: any) => {
  const { updateNodeData, getNodes, setNodes } = useReactFlow();
  const type = data.assetType || 'scene'; 
  const [zenMode, setZenMode] = useState<any>(null); 

  // ✨ 将生成的图片存档到右侧资产库
  const saveToAssets = (url: string, promptText: string) => {
    const { activeCanvasProjectId, updateCanvasProject } = useAppStore.getState();
    if (!activeCanvasProjectId || typeof updateCanvasProject !== 'function') return;
    const asset = { id: `local_${Date.now()}`, _type: 'image', url, prompt: promptText, timestamp: Date.now(), ratio: data.ratio || '16:9' };
    // ★ 函数式更新：从状态机原子快照读取最新 localAssets，杜绝竞态覆盖
    updateCanvasProject(activeCanvasProjectId, (prev: any) => ({ localAssets: [asset, ...(prev?.localAssets || [])] }));
    useAppStore.getState().setToastMsg("✅ 已自动存入右侧资产库！");
  };

  // ✨ 核心修复：使用 setNodes 进行安全的函数式更新，彻底解决异步状态互相覆盖导致图片丢失的问题
  const updateRow = (rowId: string, field: string, value: any) => {
    setNodes(nds => nds.map(n => {
      if (n.id === id) {
         const newRows = n.data.rows?.map((r: any) => r.id === rowId ? { ...r, [field]: value } : r);
         return { ...n, data: { ...n.data, rows: newRows } };
      }
      return n;
    }));
  };

  // ✨ 新增：支持一次性同时更新多个字段（专门防覆盖）
  const updateRowMulti = (rowId: string, updates: any) => {
    setNodes(nds => nds.map(n => {
      if (n.id === id) {
         const newRows = n.data.rows?.map((r: any) => r.id === rowId ? { ...r, ...updates } : r);
         return { ...n, data: { ...n.data, rows: newRows } };
      }
      return n;
    }));
  };

  // ✨ 新增：补齐缺失的文件上传解析逻辑
  // 🔍 找到 AssetTableNode 里的 handleUpload 函数并替换
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, rowId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      // ✨ 核心修复：同样使用压缩滤网
      const compressedBase64 = await compressImage(file);
      updateRow(rowId, 'resultUrl', compressedBase64);
    }
  };

  const addRow = () => {
    const newRow = { id: `row_${Date.now()}` };
    updateNodeData(id, { rows: [...(data.rows || []), newRow] });
  };

  const deleteRow = (rowId: string) => {
    const newRows = data.rows?.filter((r: any) => r.id !== rowId);
    updateNodeData(id, { rows: newRows });
  };

  // ✨ 单行生成逻辑（统一复用 buildImagePayload + 自动重试）
  const handleGenerateRow = async (rowId: string) => {
    const row = data.rows?.find((r: any) => r.id === rowId);
    if (!row || row.isGenerating) return;

    updateRow(rowId, 'isGenerating', true);
    
    // ★ 复用引擎统一 Payload 拼装器，消除参数不一致导致 400 的风险
    const canvasSettings = useAppStore.getState().canvasSettings;
    const payload = buildImagePayload(
      { prompt: row.prompt, model: data.model, ratio: data.ratio, quality: data.quality || '1K' },
      canvasSettings
    );

    console.log("[AssetTable 生图] 统一 Payload:", payload);

    // ★ 自动重试：最多 3 次，指数退避 1s/2s/4s
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetchApi('/v1/images/generations', { method: 'POST', body: JSON.stringify(payload) });
        const resData = await response.json();
        const url = resData.data?.[0]?.url || resData.url;

        if (url) {
          updateRowMulti(rowId, { resultUrl: url, isGenerating: false });
          saveToAssets(url, payload.prompt);
          return; // 成功，退出
        }
        throw new Error("API未返回图片 URL");
      } catch (e) {
        console.error(`[AssetTable 生图] 第 ${attempt + 1}/3 次失败:`, e);
        if (attempt >= 2) {
          useAppStore.getState().setToastMsg(`❌ 生成失败（已重试3次）：${(e as Error).message || '网络错误'}`);
          updateRow(rowId, 'isGenerating', false);
          return;
        }
        // 指数退避等待后重试
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  };

  // ✨ 批量生成逻辑（加入队列控制，最大并发 2，防止 API 限流）
  const handleBatchGenerate = async () => {
    const rowsToGen = data.rows?.filter((r:any) => !r.resultUrl && !r.isGenerating) || [];
    if (rowsToGen.length === 0) return useAppStore.getState().setToastMsg("当前没有需要生成的空行！");
    useAppStore.getState().setToastMsg(`🚀 已将 ${rowsToGen.length} 个资产压入渲染队列（并发上限2）...`);
    
    // ★ 队列控制：一次最多并发 2 个，逐个放行
    let completed = 0;
    const total = rowsToGen.length;
    const queue = [...rowsToGen];
    
    const worker = async () => {
      while (queue.length > 0) {
        const row = queue.shift();
        if (row) {
          await handleGenerateRow(row.id);
          completed++;
          useAppStore.getState().setToastMsg(`📊 资产生成进度：${completed}/${total}`);
        }
      }
    };
    
    // 启动 2 个并发 worker
    await Promise.all([worker(), worker()]);
  };

  // ✨ 导出为资产 JSON 压缩包
  const handleExportTable = () => {
    const exportData = {
      yr_type: 'asset_table',
      assetType: data.assetType,
      model: data.model,
      ratio: data.ratio,
      quality: data.quality,
      styleOverride: data.styleOverride,
      rows: data.rows
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const typeName = data.assetType === 'scene' ? '场景表' : data.assetType === 'character' ? '角色表' : '道具表';
    a.download = `YR_${typeName}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    useAppStore.getState().setToastMsg(`✅ ${typeName} 导出成功！`);
  };

  // ✨ 提取独立节点到画布 (比例自动检测版)
  const extractToCanvas = (row: any) => {
    const thisNode = getNodes().find(n => n.id === id);
    if (!thisNode) return;

    // ★ 先创建节点，再异步修正比例（避免阻塞 UI）
    const newNodeId = `media_ext_${Date.now()}`;
    const newNode = {
      id: newNodeId, type: 'media',
      position: { x: thisNode.position.x + (thisNode.measured?.width || 1200) + 150, y: thisNode.position.y + (Math.random() * 200) },
      data: { 
        asset: {  // 💡 关键修复：打包成完整的引用实体
           id: `ext_${Date.now()}`,
           url: row.resultUrl,
           prompt: row.prompt,
           _type: 'image',
           category: type,
           ratio: data.ratio || '16:9'
        },
        ratio: data.ratio || '16:9', // 初始用表格比例，异步检测后会修正
        model: data.model || 'gpt-image-2',
        name: type === 'character' ? `@${row.name}` : row.name
      }
    };
    setNodes(nds => [...nds, newNode]);

    // ★ 异步检测图片真实比例，修正节点 ratio（防 object-cover 表格中比例误导）
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      if (w && h) {
        const rawRatio = w / h;
        // ★ 使用图片真实比例，不做离散预设匹配。宽度自适应：横图 320px，竖图按比例缩小
        const customWidth = rawRatio >= 1 ? 320 : Math.round(220 * rawRatio);
        // 用函数式更新：写入原始比例值，画布渲染时直接使用
        setNodes(nds => nds.map(n => {
          if (n.id === newNodeId) {
            return { ...n, data: { ...n.data, ratio: w >= h ? '16:9' : '9:16', customAspectRatio: rawRatio, customWidth, asset: { ...n.data.asset, ratio: w >= h ? '16:9' : '9:16', customAspectRatio: rawRatio, customWidth } } };
          }
          return n;
        }));
      }
    };
    img.onerror = () => {}; // 图片加载失败就保持表格原比例
    img.src = row.resultUrl;

    useAppStore.getState().setToastMsg("✅ 已提取为独立图片节点（比例自动检测中...）");
  };

  const getTheme = () => {
    if (type === 'scene') return { color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', icon: Map, title: '场景光影建档表 (Scene)', width: '1300px' };
    if (type === 'character') return { color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', icon: Users, title: '角色造型建档表 (Character)', width: '1500px' };
    return { color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/20', border: 'border-fuchsia-500/30', icon: Package, title: '核心道具建档表 (Prop)', width: '1100px' };
  };
  const theme = getTheme();
  const Icon = theme.icon;

  const InputField = ({ value, onChange, placeholder }: any) => (
    <textarea 
      className="w-full h-full min-h-[100px] bg-black/40 border border-white/5 focus:border-white/20 hover:bg-white/[0.02] rounded-[8px] p-2 text-[11px] text-zinc-300 outline-none resize-none custom-scrollbar nodrag nopan transition-colors" 
      value={value || ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  );

  return (
    <div className="relative group/node z-20" style={{ width: theme.width, minHeight: '200px' }}>
      <Handle type="target" position={Position.Left} id="left" className={handleLeft} />
      <Handle type="source" position={Position.Right} id="right" className={handleRight} />
      
      {/* 禅定放大编辑器 / 图片放大查看器 */}
      {zenMode && zenMode.type === 'text' && (
        <ZenEditor label={zenMode.label} value={data.rows?.find((r:any)=>r.id===zenMode.rowId)?.[zenMode.field] || ''} onChange={(val: string) => updateRow(zenMode.rowId, zenMode.field, val)} onClose={() => setZenMode(null)} />
      )}
      {zenMode && zenMode.type === 'image' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/90 backdrop-blur-md p-8" onClick={() => setZenMode(null)}>
           <img src={zenMode.url} className="max-w-[90vw] max-h-[90vh] object-contain rounded-[16px] shadow-[0_0_100px_rgba(0,0,0,1)]" onClick={e=>e.stopPropagation()}/>
           <button onClick={() => setZenMode(null)} className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-red-500 rounded-full text-white transition-colors"><X size={20}/></button>
        </div>,
        document.body
      )}

      <div className={`${nodeBaseClass} ${selected ? selectedBorderClass : unselectedBorderClass} flex flex-col p-4 transition-all duration-500`}>
        
        {/* 头部信息 */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3 shrink-0">
          <div className="flex items-center gap-3">
             <div className={`w-8 h-8 rounded-[10px] ${theme.bg} ${theme.border} flex items-center justify-center shadow-inner`}><Icon size={14} className={theme.color} /></div>
             <div className="flex flex-col">
               <span className="text-[14px] font-bold text-white tracking-widest">{theme.title}</span>
               <span className="text-[9px] text-zinc-500 font-mono tracking-wider mt-0.5">GENERATIVE ASSET MATRIX</span>
             </div>
          </div>
          {/* ✨ 导出按钮 */}
          <button onClick={handleExportTable} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-zinc-300 hover:text-white transition-all nodrag shadow-inner">
             <Download size={12} /> 导出为表格文件
          </button>
        </div>

        {/* ✨ 全局生成参数控制舱 */}
        <div className="flex items-center gap-3 bg-black/50 p-2.5 rounded-[12px] border border-white/5 mb-3 shadow-inner shrink-0">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1"><Settings2 size={12} className="inline mr-1"/>全局参数</span>
            <div className="w-px h-4 bg-white/10 mx-1"/>
            {/* ★ 模型选项与 ShotNode/MediaNode 对齐，移除不存在的 banana2 */}
            <CustomSelect className="w-[140px]" value={data.model || 'gpt-image-2'} options={[
  { value: 'gpt-image-2', label: 'GPT-Image-2' },
  { value: 'banana-pro', label: 'Banana Pro' },
  { value: 'seedream5.0', label: 'Seedream 5.0' }
]} onChange={(v: string) => {
  // ★ 模型切换时自动重置画质到兼容值（与 ShotNode 行为一致）
  let nextQuality = data.quality || '1K';
  if (v === 'seedream5.0') {
    if (!['2K', '3K'].includes(nextQuality)) nextQuality = '2K';
  } else if (v === 'banana-pro') {
    if (!['1K', '2K', '4K'].includes(nextQuality)) nextQuality = '2K';
  } else {
    nextQuality = '1K';
  }
  updateNodeData(id, { model: v, quality: nextQuality });
}} />
            <CustomSelect className="w-[100px]" value={data.ratio || useAppStore.getState().canvasSettings.globalRatio || '16:9'} options={[{ value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' }, { value: '1:1', label: '1:1' }, { value: '4:3', label: '4:3' }, { value: '3:4', label: '3:4' }]} onChange={(v: string) => updateNodeData(id, { ratio: v })} />
            {/* ★ 画质选项：根据当前模型动态生成，与 ShotNode 标准一致 */}
            <CustomSelect className="w-[120px]" value={data.quality || getImageQualityOptions(data.model || 'gpt-image-2')[0].value} options={getImageQualityOptions(data.model || 'gpt-image-2')} onChange={(v: string) => updateNodeData(id, { quality: v })} />
            <CustomSelect className="w-[140px]" value={data.styleOverride || '继承全局预设'} options={[{ value: '继承全局预设', label: '继承全局预设' }, { value: '🎬 电影质感', label: '🎬 电影质感' }, { value: '🌸 二次元', label: '🌸 二次元' }, { value: '📷 极致写实', label: '📷 极致写实' }, { value: '🧊 3D 渲染', label: '🧊 3D 渲染' }, { value: '🌃 赛博朋克', label: '🌃 赛博朋克' }]} onChange={(v: string) => updateNodeData(id, { styleOverride: v })} />
            
            <button onClick={handleBatchGenerate} className="px-5 py-2 bg-indigo-500 text-white hover:bg-indigo-400 rounded-[8px] text-[11px] font-bold shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all ml-auto flex items-center gap-1.5 nodrag">
               <Sparkles size={14}/> 批量生成全表
            </button>
        </div>

        {/* 动态表头 */}
        <div className="flex gap-2 px-2 pb-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 mb-2">
          {type === 'scene' && (
            <><div className="w-[10%]">场景名</div><div className="w-[8%]">时间</div><div className="w-[15%]">光影氛围</div><div className="w-[10%]">出现阶段</div><div className="w-[30%]">生图提示词 (Prompt)</div><div className="w-[23%] text-center">成图列 (Asset)</div><div className="w-[4%] text-center">操作</div></>
          )}
          {type === 'character' && (
            <><div className="w-[8%]">人物名</div><div className="w-[5%]">年龄</div><div className="w-[15%]">着装</div><div className="w-[12%]">特质</div><div className="w-[8%]">出场阶段</div><div className="w-[25%]">生图提示词 (Prompt)</div><div className="w-[23%] text-center">成图列 (Asset)</div><div className="w-[4%] text-center">操作</div></>
          )}
          {type === 'prop' && (
            <><div className="w-[12%]">道具名</div><div className="w-[15%]">出现节点</div><div className="w-[46%]">生图提示词 (Prompt)</div><div className="w-[23%] text-center">成图列 (Asset)</div><div className="w-[4%] text-center">操作</div></>
          )}
        </div>

        {/* 数据行遍历 */}
        <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1 nowheel" onWheelCapture={(e) => { if (e.target instanceof HTMLTextAreaElement) return; const el = e.currentTarget; el.scrollTop += e.deltaY; e.stopPropagation(); e.preventDefault(); }}>
           {data.rows?.map((row: any) => (
              <div key={row.id} className="flex gap-2 bg-[#050505]/50 hover:bg-[#050505] border border-white/5 hover:border-white/20 p-1.5 rounded-[12px] transition-all items-stretch">
                
                {/* 各种业务列 */}
                {type === 'scene' && (
                  <><div className="w-[10%]"><InputField value={row.name} placeholder="场景名" onChange={(v:any) => updateRow(row.id, 'name', v)} /></div>
                  <div className="w-[8%]"><InputField value={row.time} placeholder="时间" onChange={(v:any) => updateRow(row.id, 'time', v)} /></div>
                  <div className="w-[15%]"><InputField value={row.lighting} placeholder="光影" onChange={(v:any) => updateRow(row.id, 'lighting', v)} /></div>
                  <div className="w-[10%]"><InputField value={row.stage} placeholder="阶段" onChange={(v:any) => updateRow(row.id, 'stage', v)} /></div></>
                )}
                {type === 'character' && (
                  <><div className="w-[8%]"><InputField value={row.name} placeholder="人物名" onChange={(v:any) => updateRow(row.id, 'name', v)} /></div>
                  <div className="w-[5%]"><InputField value={row.age} placeholder="年龄" onChange={(v:any) => updateRow(row.id, 'age', v)} /></div>
                  <div className="w-[15%]"><InputField value={row.clothing} placeholder="着装" onChange={(v:any) => updateRow(row.id, 'clothing', v)} /></div>
                  <div className="w-[12%]"><InputField value={row.traits} placeholder="特质" onChange={(v:any) => updateRow(row.id, 'traits', v)} /></div>
                  <div className="w-[8%]"><InputField value={row.stage} placeholder="阶段" onChange={(v:any) => updateRow(row.id, 'stage', v)} /></div></>
                )}
                {type === 'prop' && (
                  <><div className="w-[12%]"><InputField value={row.name} placeholder="道具名" onChange={(v:any) => updateRow(row.id, 'name', v)} /></div>
                  <div className="w-[15%]"><InputField value={row.stage} placeholder="阶段" onChange={(v:any) => updateRow(row.id, 'stage', v)} /></div></>
                )}

                {/* ✨ 统一的生图提示词编辑列 (带放大按钮) */}
                <div className={`${type === 'scene' ? 'w-[30%]' : type === 'character' ? 'w-[25%]' : 'w-[46%]'} relative group/prompt`}>
                   <InputField value={row.prompt} placeholder="提示词" onChange={(v:any) => updateRow(row.id, 'prompt', v)} />
                   <button onClick={()=>setZenMode({type: 'text', rowId: row.id, field: 'prompt', label: '编辑生图提示词'})} className="absolute top-2 right-2 p-1.5 bg-black/80 backdrop-blur-md rounded-lg opacity-0 group-hover/prompt:opacity-100 text-zinc-400 hover:text-white transition-all shadow-md"><Expand size={12}/></button>
                </div>

                 {/* ✨ 核心：成图列 (自适应放大与生成控制) */}
                 <div className="w-[23%] relative bg-black/60 border border-white/5 rounded-[8px] flex flex-col items-center justify-center group/img overflow-hidden min-h-[100px]">
                     {row.isGenerating ? (
                        <div className="flex flex-col items-center gap-2 text-indigo-400">
                          <Loader2 size={24} className="animate-spin" />
                          <span className="text-[10px] font-mono tracking-widest animate-pulse">RENDERING...</span>
                          {/* ★ 终止按钮：解决生图卡死/转圈时无法重试的问题 */}
                          <button onClick={() => updateRowMulti(row.id, { isGenerating: false })} className="px-3 py-1 bg-red-500/20 hover:bg-red-500/50 text-red-300 hover:text-white rounded-[6px] text-[10px] font-bold transition-all nodrag flex items-center gap-1 border border-red-500/30">
                            <X size={10}/> 终止
                          </button>
                        </div>
                    ) : row.resultUrl ? (
                       <>
                         <img src={row.resultUrl} className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500" onClick={() => setZenMode({ type: 'image', url: row.resultUrl })}/>
                         <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity">
                            <button onClick={() => extractToCanvas(row)} title="克隆到画布节点" className="p-1.5 bg-black/80 backdrop-blur-md rounded-[6px] text-white hover:bg-indigo-500 transition-colors"><Copy size={12}/></button>
                            <button onClick={() => updateRow(row.id, 'resultUrl', null)} title="清除图片" className="p-1.5 bg-black/80 backdrop-blur-md rounded-[6px] text-white hover:bg-red-500 transition-colors"><Trash2 size={12}/></button>
                         </div>
                       </>
                    ) : (
                       <div className="flex gap-2">
                         <button onClick={() => handleGenerateRow(row.id)} className="px-3 py-1.5 bg-white text-black hover:scale-105 rounded-[6px] text-[10px] font-bold flex items-center gap-1 shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all nodrag"><Wand2 size={12}/> 生成</button>
                         <label htmlFor={`upload-${row.id}`} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-[6px] text-[10px] text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer transition-all nodrag">
                            <Upload size={12}/> 上传
                            <input type="file" id={`upload-${row.id}`} className="hidden" accept="image/*" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if(file) {
                                   const compressedBase64 = await compressImage(file);
                                   // 🚀 核心修复：把图片仅写给当前的 row，而不是给整个表格大节点！
                                   updateRowMulti(row.id, { resultUrl: compressedBase64 });
                                }
                             }} />
                         </label>
                       </div>
                    )}
                 </div>

                {/* 垃圾桶删除列 */}
                <div className="w-[4%] flex items-center justify-center">
                   <button onClick={() => deleteRow(row.id)} className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-600 hover:text-white hover:bg-red-500/80 transition-all nodrag"><Trash2 size={14}/></button>
                </div>
              </div>
           ))}
        </div>

        <button onClick={addRow} className="mt-3 w-full py-2 border border-dashed border-white/10 hover:border-white/30 bg-white/[0.01] hover:bg-white/[0.05] rounded-[10px] flex items-center justify-center gap-2 text-[11px] font-bold text-zinc-500 hover:text-white transition-all nodrag">
          <Plus size={14} /> 新增自定义行
        </button>
      </div>
    </div>
  );
}; // 🚨 核心修复2：删掉多余的反大括号，正确闭合整个组件

// ==========================================
// 6. 文本备注节点 (TextNode) —— 创作者随笔与脚本草稿
// ==========================================
export const TextNode = ({ id, data, selected }: any) => {
  const { updateNodeData } = useReactFlow();

  return (
    <div className="relative group z-20 w-[300px]">
      <Handle type="target" position={Position.Left} id="left" className={handleLeft} />
      <Handle type="source" position={Position.Right} id="right" className={handleRight} />

      <div className={`${nodeBaseClass} ${selected ? selectedBorderClass : unselectedBorderClass} flex flex-col p-4`}>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
          <Type size={14} className="text-zinc-400" />
          <span className="text-[12px] font-bold text-white tracking-widest">文本备注 (Note)</span>
        </div>
        
        <textarea
          value={data.text || ''}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
          placeholder="在此输入自定义备注或剧本草稿..."
          className="w-full bg-black/40 border border-white/[0.05] rounded-[12px] p-3 text-[11px] text-zinc-300 outline-none resize-none min-h-[120px] focus:border-white/20 transition-all nodrag nopan"
          onWheelCapture={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
};
