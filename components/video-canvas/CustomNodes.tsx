import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom'; // ✨ 新增：用于渲染悬浮顶层的禅定舱
import { Handle, Position, useReactFlow, NodeResizeControl, useEdges, useNodes } from '@xyflow/react';
import { 
  Image as ImageIcon, Film, Type, Sparkles, ChevronDown, MoveUp, Scaling, Loader2, Layers, CheckCircle,
  Maximize, Wand2, Grid, UserRound, PenTool, Eraser, RefreshCcw, Download, Subtitles, Scissors, AudioWaveform, RotateCcw,
  Upload, Trash2, Play, ArrowRight, ArrowDown, Settings2, CheckSquare, Clapperboard, X, Table, Plus, Expand // ✨ 新增 Expand 图标
} from 'lucide-react';
import { fetchApi } from '@/services/api';

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
          <div className="flex-1 p-6 relative zen-mode-textarea">
            <style dangerouslySetInnerHTML={{__html: `.zen-mode-textarea textarea { min-height: 100% !important; font-size: 16px !important; leading: loose !important; }`}} />
            <MentionTextarea 
               value={value} 
               onChange={onChange} 
               placeholder={placeholder || "进入心流模式编写..."} 
               incomingAssets={incomingAssets} 
            />
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
import { useCanvasEngine } from '@/hooks/useCanvasEngine';

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
// ✨ 全新组件：支持 @ 唤出的超级输入框 (解决痛点 3)
// ==========================================
function MentionTextarea({ value, onChange, placeholder, incomingAssets }: any) {
  const [showMenu, setShowMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);
    // 检查光标前一个字符是不是 @
    const cursor = e.target.selectionStart;
    if (val.charAt(cursor - 1) === '@') {
      setShowMenu(true);
    } else {
      setShowMenu(false);
    }
  };

  const handleSelect = (asset: any, idx: number) => {
    const cursor = textareaRef.current?.selectionStart || 0;
    const textBefore = value.substring(0, cursor - 1); // 删掉那个 @
    const textAfter = value.substring(cursor);
    const label = `[@参考${asset._type === 'image' ? '图' : '视频'}-${idx + 1}]`;
    onChange(textBefore + label + " " + textAfter);
    setShowMenu(false);
    setTimeout(() => textareaRef.current?.focus(), 10);
  };

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        // ✨ 新增了 nopan 类名
        className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-zinc-100 px-6 py-4 min-h-[100px] resize-none text-[15px] leading-relaxed custom-scrollbar placeholder-zinc-600 nodrag nopan"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        // ✨ 升级为捕获阶段拦截
        onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
      />
      
      {/* 黑玻璃 @ 选择菜单 */}
      {showMenu && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-[320px] bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/20 rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.95)] p-1.5 z-[999999] animate-in fade-in slide-in-from-top-2">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 py-2 border-b border-white/[0.05] mb-1 flex justify-between items-center">
            插入参考元素 <span className="text-[8px] bg-white/10 px-1.5 py-0.5 rounded text-zinc-400 font-mono">ESC 取消</span>
          </div>
          {incomingAssets.length === 0 ? (
            <div className="px-3 py-6 text-[12px] text-zinc-500 text-center font-light">暂无输入节点，请先拉取连线</div>
          ) : (
            incomingAssets.map((asset: any, idx: number) => (
              <div key={idx} onClick={() => handleSelect(asset, idx)} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-[12px] cursor-pointer transition-all group">
                {asset._type === 'image' 
                  ? <img src={asset.url} className="w-10 h-10 rounded-[10px] object-cover border border-white/10 shadow-md group-hover:scale-110 transition-transform" />
                  : <div className="w-10 h-10 rounded-[10px] bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform"><Film size={16} className="text-zinc-300"/></div>
                }
                <div className="flex flex-col flex-1 overflow-hidden">
                  <span className="text-[13px] font-bold text-zinc-200">参考{asset._type === 'image' ? '图' : '视频'}-{idx + 1}</span>
                  <span className="text-[11px] text-zinc-500 truncate mt-0.5">{asset.prompt || '未命名媒体文件'}</span>
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 引入队列引擎
  const { enqueueTask } = useCanvasEngine();

  // 🚀 双擎批量系统 (接入全局队列)
  const handleBatchImages = () => {
    const shotNodes = getNodes().filter(n => n.type === 'shot' && (!n.data.frameUrl || n.data.status === 'draft'));
    if (shotNodes.length === 0) return useAppStore.getState().setToastMsg("当前没有需要生图的分镜！");
    
    useAppStore.getState().setToastMsg(`🚀 已将 ${shotNodes.length} 个生图任务压入全局队列！`);
    shotNodes.forEach(node => enqueueTask(node.id, 'image', getNodes, updateNodeData));
  };

  const handleBatchVideos = () => {
    const videoNodes = getNodes().filter(n => n.type === 'videoClip' && (!n.data.videoUrl || n.data.status === 'draft'));
    if (videoNodes.length === 0) return useAppStore.getState().setToastMsg("当前没有需要渲染的视频！");
    
    useAppStore.getState().setToastMsg(`🎞️ 已将 ${videoNodes.length} 个视频渲染任务压入全局队列！`);
    videoNodes.forEach(node => enqueueTask(node.id, 'video', getNodes, updateNodeData));
  };

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
      const targetModel = (data.model === 'gpt-5.4' || data.model === 'deepseek-v4-pro') ? data.model : 'deepseek-v4-pro';
      
      // ✨ 痛点 1 修复：获取当前画布全局画风设置
      const globalStyle = useAppStore.getState().canvasSettings?.globalPromptSuffix || "无特定风格";

      const payload = {
        model: targetModel,
        messages: [
          {
            role: "system",
            content: `你是一个顶尖的电影摄影指导。请阅读完整剧本，推荐1套最契合的【英文电影级摄影机与镜头组合】以及【全局风格调性】。
【全局画风硬约束】：当前项目已设定为【${globalStyle}】。你推荐的摄影机和镜头材质必须绝对符合该风格（例如：若设定为二次元，请推荐吉卜力色彩等；若设定为写实，请推荐真实物理机位）。
要求：只输出一行纯英文参数，用逗号分隔，绝不要输出任何解释或中文。示例：Shot on 35mm Kodak Vision3 500T 5219, Wong Kar-wai low saturation color palette...`
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

  const handleExtractSceneLighting = async () => {
    if (!selectedText) return;
    updateNodeData(id, { sceneInterceptState: 'extracting' });
    useAppStore.getState().setToastMsg("正在分析本场戏时空与情绪，提炼专属光影...");

    try {
      const targetModel = (data.model === 'gpt-5.4' || data.model === 'deepseek-v4-pro') ? data.model : 'deepseek-v4-pro';
      
      const payload = {
        model: targetModel,
        messages: [
          {
            role: "system",
            // ✨ 痛点 2 修复：绝对物理隔离防越权
            content: `你是一个顶尖的电影灯光师。请阅读剧本片段并结合全局机位，提炼出最契合当前情绪的光影参数。
【绝对红线】：只允许输出光源方向、光线质感、核心色彩HEX值、阴影特征。绝对禁止输出任何涉及画风(如 realistic, anime)、材质、摄像机型号(如 lens, 35mm) 的词汇！违者熔断。
要求：只输出一行纯英文参数，用逗号分隔，绝对不要输出任何解释或中文。`
          },
          { role: "user", content: `全局机位：${data.globalCamera}\n\n当前场次剧本：${selectedText}` }
        ]
      };

      const response = await fetchApi('/v1/chat/completions', { method: 'POST', body: JSON.stringify(payload) });
      const resData = await response.json();
      const lightingParams = resData.choices?.[0]?.message?.content?.trim() || "cinematic lighting, dramatic shadows";

      updateNodeData(id, { 
        sceneInterceptState: 'confirming',
        tempSceneLighting: lightingParams,
        model: targetModel
      });
      useAppStore.getState().setToastMsg("✅ 本场专属光影已生成，请在场记板确认");
    } catch (error) {
      updateNodeData(id, { sceneInterceptState: 'idle' });
      useAppStore.getState().setToastMsg("光影提炼失败，请重试");
    }
  };   

  // 🔥 这里就是你刚才漏掉的函数外壳！
  const handleFissionShots = async () => {
    if (data.isGenerating || !selectedText) return;
    updateNodeData(id, { isGenerating: true });
    
    try {
      const targetModel = (data.model === 'gpt-5.4' || data.model === 'deepseek-v4-pro') ? data.model : 'deepseek-v4-pro';

            // ✨ 自动扫描当前画布，计算下一次裂变的起始镜号
            const existingShots = getNodes().filter(n => n.type === 'shot');
            let maxShotNum = 0;
            existingShots.forEach(n => {
               const numStr = String(n.data.shotNumber).match(/\d+/);
               const num = numStr ? parseInt(numStr[0], 10) : 0;
               if (num > maxShotNum) maxShotNum = num;
            });
            const nextShotStart = maxShotNum + 1;

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

【新增时空流变判定(闪回/突变)】
如果拆解出的某个分镜属于[闪回/回忆/梦境]或[极限反打/强烈光影反差]，请在 JSON 中该分镜对象下额外输出一个 "shotLighting" 字段（如: cold blue neon lighting, high contrast...），若是普通顺接镜头则不输出该字段。

【视频分镜拆解铁律】
1. 景别参考规则：优先识别剧本中已有的景别标记(如[特写])，每个分镜时长严格控制在 4-15s 之间。
2. 对白字数与时长换算铁律（强计算逻辑）：中文字数 ÷ 3.5 = 所需最低时长(秒)。在输出每个分镜前，你必须进行计算！如果算出的时间超过15秒，必须强行拆分成两个独立的分镜（如镜号1A、镜号1B）。
3. 单分镜内的时序切分铁律（防偷懒与运镜解绑机制）：只要单个分镜时长>=8秒，或对白>15字，严禁在画面主体中只写一个时间段！你必须将其物理拆分为至少两个时序(如 0-5s 和 6-10s)。在时序切换时，不要局限于“硬切”，更鼓励使用连续长镜头内的“动态演进”(如动作连贯延展、平滑推拉跟摇、焦点转换 Rack Focus)。
4. 物理视觉化描述铁律（去文学化与微表情优化）：禁止文学形容词，必须转化为物理视觉指令。情绪必须转化为微表情(如“眉头微皱”)。详细描述肌肉牵扯、物理位移、衣服褶皱变化及道具物理交互。
5. 人物空间站位与“时序状态锚定”铁律：在每一个 timeSegments 时间段描述内，只要提及人物动作，必须强行在名字前增加当前姿态/站位状态的修辞锚定词！(如：强制写为“坐在工作台后的 @老匠人 缓缓落下镊子”)，防姿态突变。
6. 长镜头/硬切判定：若分镜内部包含硬切，严禁声明为连续长镜头。
7. 空间轴线锚定（防跳轴）：双人/多人对话，强制锁定左右站位（角色A永远在画面左，B在右），绝对不允许越轴。
8. 双人/多人 Z 轴定位：必须采用“一前一后，必有一背”的前后物理位置关系，至少一方使用过肩镜头或脏前景。

【输出规范 (JSON Format)】
必须严格按照以下 JSON 结构输出，包含后台算力、时序段、音效台词及机位规则：
- shotNumber: 镜号（注意：当前画布已有分镜，本次拆分的镜号必须严格从 ${nextShotStart} 开始依次递增！例如：${nextShotStart}, ${nextShotStart}A, ${nextShotStart + 1} 等）
- scriptFragment: 该分镜对应的剧本原文片段
- wordCount: 对白字数
- duration: 计算出的物理时长(4-15s)
- timeSegments: 时序演进数组(包含 id, time, action)。action 必须包含景别、时序状态锚定和极度详尽的纯物理动作。
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
注意：本次只需输出视频动作和时序数据，生图的光影和首帧锚定在后续处理。`
          },
          { 
            role: "user", 
            content: `【全局剧本底座】(供理解上下文人物设定)：\n${(data.text || '').substring(0, 8000)}\n\n【需进行视频分镜拆解的划选片段】：\n${selectedText}` 
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
0. 万物皆有坐标（防空间漂移）：
   无论景别多近（即使是极特写），只要画面出现人物，必须在名字前强行绑定【空间参照物 + 身体基本姿态】！绝对不允许只写“@老匠人摘下眼镜”，必须强制写为“坐在工作台后侧木椅上的 @老匠人，正在摘下眼镜”。每一帧必须重申坐标！
1. 100%继承光影与机位：你必须直接照抄提供的英文全局摄影参数和英文光线描述词，绝对不允许修改或意译，以保证图生视频的色彩连贯。
2. 中英混合公式（严格执行）：
   提示词结构 = [当前景别与机位角度(中文)] + [场景环境(中文)] + [绝对空间参照物与身体大姿态(如:站在窗前背对镜头/坐在桌后)] + [定格的局部物理动作(中文)] + [定格的微表情(中文)] + [照抄英文摄影参数] + [照抄英文光线] + [动态人物质感后缀(中文)]
3. 动态转静态的瞬间提取：
   必须根据分镜中的时序动作，将其翻译为“定格瞬间”。严禁使用 ongoing 动态词（如 ❌'奔跑着'，改为 ✅'单脚腾空跨步的悬停瞬间'；❌'双手摘下眼镜'，改为 ✅'双手正将眼镜从脸上摘下的定格瞬间'）。所有描述必须是动作的起始蓄力状态或最极致的瞬间，而非完成后的静止态。
【八大物理铁律（必须应用）】
1. 拒绝“大头贴”，强制空间关系：
   双人/多人时，严禁使用无前景的单人正面特写。必须使用过肩镜头、侧拍或带“脏前景”。示例：极特写越肩视角，前景边缘带入角色B模糊的肩膀，角色A视线越过前景锁定角色B。
2. 单人镜头视线与朝向锁定：
   单人镜头严禁默认正脸直视镜头。必须指定面部朝向（侧脸、3/4侧脸、背侧面）和视线落点（看向画外左/右、低头看手、仰头看天）。
3. 强化“运动矢量”：
   描述动作的起始瞬间或蓄力状态，使用高动态动词，描述肌肉状态和重心变化。示例：双手撑膝重心前倾，呈正欲起立的趋势。
4. 空间轴线锚定（防跳轴）：
   双人/多人对话，默认锁定左右站位（角色A永远在左，角色B永远在右），防止空间混乱。
5. 场景与光影死锁：
   同一物理场景下，环境词和光影基调必须全程继承。第一镜定下的基调，后续同场景镜头必须一致。
6. 造型零定义：
   绝对禁止描写人物的服装款式、颜色、材质以及发型、发色。只描述动作、光影和物理交互。
7. 空间轴线锚定（防跳轴）：双人/多人对话，强制锁定左右站位（角色A永远在画面左，B在右），绝对不允许越轴。
8. 双人/多人 Z 轴定位：必须采用“一前一后，必有一背”的前后物理位置关系，至少一方使用过肩镜头或脏前景。

【动态人物质感后缀规则】
- 若画面涉及人物，尾部必须强制添加肤质描述。
- 默认后缀：粗糙皮肤，1:1真实肤色，可见皱纹，可见毛孔，细微绒毛。
- 特例（红线注意）：若角色为年轻女性或小孩，必须智能剔除“粗糙”与“细纹”，保留为：1:1真实肤色，细腻毛孔，细微绒毛。
【通用禁止词汇】
- 禁止使用夸张形容词如“脖子青筋鼓起”、“双目瞪圆/充血”。
- 禁止描述任何服装款式、颜色、材质及发型。
【拆分档位参考（用于判断是否提取第二帧）】
- 若分镜仅包含一个时序段且为固定机位，只需提供首帧提示词。
- 若分镜包含两个时序段且发生硬切或镜头推进，可考虑提取首帧和尾帧（但本次输出仅要求数组中的主首帧即可，我们会根据时序信息自行处理）。
【输出格式绝对契约】
你必须输出一个 JSON 对象，其中包含 "imagePrompts" 字段，它是一个字符串数组，必须一一对应传入的分镜顺序。
\`\`\`json
{
  "imagePrompts": [
    "中景，低角度仰拍。深夜青铜工坊内，@老匠人 坐在工作台后，身体前倾，右手紧握铜镊子悬停在半空准备夹取零件的定格瞬间，额头皱纹微显。Shot on 35mm Kodak Vision3 500T 5219, Wong Kar-wai low saturation color palette... chiaroscuro dusk side lighting, volumetric golden light beams... 粗糙皮肤，1:1真实肤色，可见细纹，可见毛孔，细微绒毛",
    "越肩视角特写。@老匠人的视线锁定画外，双手正将黑框眼镜从脸上摘下的定格瞬间。Shot on 35mm Kodak Vision3 500T... high contrast side lighting... 粗糙皮肤，1:1真实肤色，可见毛孔，细微绒毛"
  ]
}
\`\`\``
          },
          { 
            role: "user", 
            content: `【照抄用的英文全局摄影参数】：\n${data.globalCamera}\n\n【照抄用并需要你补充方向的本场光线】：\n${data.tempSceneLighting}\n\n【需提取首帧图的分镜结构数组】：\n${JSON.stringify(json1.shots, null, 2)}`
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
      // ✨ 痛点修复：拉开 X 轴距离，防止覆盖主卡片
      const targetColumnX = baseX + 850; 
      
      let maxBottomY = baseY - 50; 
      getNodes().forEach(n => {
         if (Math.abs(n.position.x - targetColumnX) < 150) {
            const bottom = n.position.y + (n.measured?.height || 500);
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
            firstFrameAnchor: shot.imagePrompt || "空镜头。",
            videoPrompt: fullVideoPrompt,
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
          {/* ✨ 植入 1 级头部的双擎批量系统 */}
          <div className="flex items-center gap-2 ml-4">
             <button onClick={handleBatchImages} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white text-[10px] font-bold tracking-widest transition-all nodrag shadow-inner"><ImageIcon size={12}/> 批量生图</button>
             <button onClick={handleBatchVideos} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white text-[10px] font-bold tracking-widest transition-all nodrag shadow-inner"><Film size={12}/> 批量渲染</button>
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

      {/* 下方的场记板拦截舱 */}
      <div className={`absolute bottom-[-20px] left-1/2 -translate-x-1/2 translate-y-full flex flex-col bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/[0.1] rounded-[24px] shadow-[0_40px_100px_rgba(0,0,0,0.95)] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]  z-[100] ${data.sceneInterceptState === 'confirming' ? 'w-[480px] p-5 scale-100 opacity-100' : (!data.globalCamera || selectedText ? 'w-auto p-1.5 flex-row items-center gap-2 scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none')}`}>
        {!data.globalCamera ? (
          <>
            <CustomSelect menuPosition="left" className="w-[160px] bg-transparent" value={data.model || 'deepseek-v4-pro'} options={[{ value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' }, { value: 'gpt-5.4', label: 'GPT-5.4 (智能)' }]} onChange={(v: string) => updateNodeData(id, { model: v })} />
            <div className="w-px h-5 bg-white/10 mx-1"></div>
            <button onClick={handleExtractCamera} disabled={data.isExtractingCamera} className="flex items-center justify-center gap-2 px-5 py-2 bg-indigo-500 text-white hover:bg-indigo-400 rounded-[12px] text-[12px] font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] whitespace-nowrap nodrag">
               {data.isExtractingCamera ? <Loader2 size={14} className="animate-spin" /> : <Settings2 size={14} />} 锚定全片摄影机
            </button>
          </>
        ) : (
          <>
            {(data.sceneInterceptState === 'idle' || !data.sceneInterceptState) && (
               <>
                 <CustomSelect menuPosition="left" className="w-[160px] bg-transparent" value={data.model || 'deepseek-v4-pro'} options={[{ value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' }, { value: 'gpt-5.4', label: 'GPT-5.4 (智能)' }]} onChange={(v: string) => updateNodeData(id, { model: v })} />
                 <div className="w-px h-5 bg-white/10 mx-1"></div>
                 <button onClick={handleExtractSceneLighting} className="flex items-center justify-center gap-2 px-6 py-2 bg-white text-black hover:scale-[1.03] rounded-[12px] text-[12px] font-bold transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] whitespace-nowrap nodrag">
                    <Sparkles size={14} /> 提取本场专属光影 ({selectedText.length} 字)
                 </button>
               </>
            )}
            {data.sceneInterceptState === 'extracting' && (
               <div className="px-8 py-3 flex items-center gap-3 text-zinc-300 text-[12px] font-bold tracking-widest whitespace-nowrap"><Loader2 size={16} className="animate-spin" /> AI 场记分析中: 推断光影布局...</div>
            )}
            {data.sceneInterceptState === 'confirming' && (
               <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                     <div className="flex items-center gap-2 text-[12px] font-bold text-white tracking-widest uppercase"><Clapperboard size={16} />场记板审查: 单场光影锁定</div>
                     <span className="bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded-[6px] text-[10px] font-mono shadow-inner">SCENE LOCK</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[10px] text-zinc-500 font-mono tracking-widest px-1">本场推断光影 (可修改):</label>
                     <textarea className="w-full bg-black/60 border border-white/10 rounded-[12px] p-3 text-[12px] text-zinc-200 font-mono resize-none outline-none focus:border-white/30 focus:bg-black transition-all nodrag nopan custom-scrollbar shadow-inner" rows={4} value={data.tempSceneLighting} onChange={(e) => updateNodeData(id, { tempSceneLighting: e.target.value })} onWheelCapture={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                     <span className="text-[10px] text-zinc-600 font-light max-w-[200px] leading-tight">确认后，光影参数将被锁定并垂直裂变。</span>
                     <div className="flex gap-2">
                        <button onClick={() => updateNodeData(id, { sceneInterceptState: 'idle' })} className="px-4 py-2 text-[12px] font-medium text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-[10px] transition-colors nodrag">取消</button>
                        <button onClick={handleFissionShots} disabled={data.isGenerating} className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-white bg-white/10 border border-white/20 hover:bg-white/20 rounded-[10px] transition-all nodrag whitespace-nowrap">
                          {data.isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Layers size={12} />} 路线A: 裂变节点流
                        </button>
                        <button onClick={handleFissionTable} disabled={data.isGenerating} className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-black bg-white hover:bg-zinc-200 hover:scale-105 rounded-[10px] transition-all shadow-[0_0_15px_rgba(255,255,255,0.3)] nodrag whitespace-nowrap">
                          {data.isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Table size={12} />} 路线B: 生成表格脚本
                        </button>
                     </div>
                  </div>
               </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
// ==========================================
// ==========================================
// ==========================================
// 2. 独立分镜节点 (ShotNode) —— 双轨质检员 + 参数胶囊
// ==========================================
export const ShotNode = ({ id, data, selected }: any) => {
  const { updateNodeData, getNodes, setNodes, setEdges, getEdges } = useReactFlow();
  const edges = useEdges(); const nodes = useNodes();

  // ✨ 核心断路器：只要修改当前节点，就顺藤摸瓜把下游已生成的视频标为脏数据 (Dirty)
  const markDownstreamDirty = () => {
    const connectedEdges = getEdges().filter(e => e.source === id);
    connectedEdges.forEach(edge => {
      const targetNode = getNodes().find(n => n.id === edge.target);
      // 如果下游是视频节点，且已经生成了旧视频，直接打上过期标记
      if (targetNode && targetNode.type === 'videoClip' && targetNode.data.status === 'done') {
        updateNodeData(targetNode.id, { isDirty: true });
      }
    });
  };
  const status = data.status || 'draft';
  const [zenMode, setZenMode] = useState<any>(null);
  const [showConfig, setShowConfig] = useState(false);

  const ratioStyleMap: Record<string, React.CSSProperties> = { '16:9': { aspectRatio: '16/9' }, '9:16': { aspectRatio: '9/16' }, '1:1': { aspectRatio: '1/1' }, '4:3': { aspectRatio: '4/3' }, '3:4': { aspectRatio: '3/4' } };
  const currentStyle = ratioStyleMap[data.ratio || '16:9'] || ratioStyleMap['16:9'];

  const incomingAssets = edges.filter(e => e.target === id).map(e => {
    const srcNode = nodes.find(n => n.id === e.source);
    if (srcNode?.data?.asset) return srcNode.data.asset;
    if (srcNode?.data?.resultUrl) return { url: srcNode.data.resultUrl, _type: 'image', prompt: srcNode.data.prompt };
    return null;
  }).filter(Boolean);

  const { enqueueTask } = useCanvasEngine();
  const showToast = (msg: string) => useAppStore.getState().setToastMsg(msg);

  const handleGenerateFrame = () => {
    if (data.isGenerating) return;
    // 单点生图：直接压入队列
    enqueueTask(id, 'image', getNodes, updateNodeData);
  };

  const handleSpawnVideo = () => {
    const thisNode = nodes.find(n => n.id === id);
    if (!thisNode) return;
    const videoId = `video_${Date.now()}`;
    // 把纯净的动作轨下发，带上配置参数
    setNodes(nds => [...nds, { id: videoId, type: 'videoClip', position: { x: thisNode.position.x + 500, y: thisNode.position.y }, data: { status: 'draft', duration: data.duration || 5, ratio: data.ratio || '16:9', prompt: data.videoPrompt, sceneLighting: data.sceneLighting, globalCamera: data.globalCamera, frameUrl: data.frameUrl, isGenerating: false } }]);
    setEdges(eds => [...eds, { id: `e-${id}-${videoId}`, source: id, target: videoId, sourceHandle: 'right', targetHandle: 'left', type: 'default', animated: true, style: { stroke: 'rgba(99, 102, 241, 0.8)', strokeWidth: 2, strokeDasharray: '10 10', animationDuration: '2s' } }]);
  };

  return (
    <div className="relative w-[400px] group z-20">
      <Handle type="target" position={Position.Left} id="left" className="!w-[24px] !h-[24px] !bg-transparent opacity-0" />
      <Handle type="source" position={Position.Right} id="right" className="!w-[24px] !h-[24px] !bg-transparent opacity-0" />

      {/* ✨ 统一的高级首帧控制台 (平时隐藏，Hover浮现) */}
      {status === 'done' && data.frameUrl && (
        <div className="absolute -top-[52px] left-1/2 -translate-x-1/2 flex items-center p-1.5 bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto z-[100] scale-95 group-hover:scale-100 after:content-[''] after:absolute after:-bottom-6 after:left-0 after:w-full after:h-6">
          <button onClick={() => showToast("正在调起高清放大引擎...")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Maximize size={12}/> 高清HD</button>
          
          <div className="relative group/btn flex items-center">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Wand2 size={12}/> 重绘 <ChevronDown size={10}/></button>
            <div className="absolute left-1/2 -translate-x-1/2 top-[100%] pt-2 opacity-0 group-hover/btn:opacity-100 pointer-events-none group-hover/btn:pointer-events-auto transition-all z-[101]">
               <div className="bg-[#050505]/95 backdrop-blur-xl border border-white/10 p-1.5 rounded-[12px] shadow-2xl flex flex-col gap-0.5">
                 <button onClick={() => showToast("开启局部重绘")} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">自由重绘</button>
                 <button onClick={() => showToast("开启人脸重绘分析")} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">人脸修复</button>
               </div>
            </div>
          </div>

          <button onClick={() => showToast("开启智能笔刷擦除")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Eraser size={12}/> 擦除</button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={() => showToast("进入九宫格扩展模式")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Grid size={12}/> 九宫格</button>
          <button onClick={() => showToast("生成人物三视图")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><UserRound size={12}/> 多视图</button>
          <button onClick={() => showToast("开启画布标注工具")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><PenTool size={12}/> 标注</button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={() => showToast("已转存至侧边栏资产库")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><RefreshCcw size={12}/> 存资产</button>
          <button onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = data.frameUrl; a.download = `YR_Shot_${Date.now()}.png`; a.click(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-bold text-zinc-300 hover:text-black hover:bg-white transition-all shadow-md whitespace-nowrap"><Download size={12}/> 下载</button>
        </div>
      )}
      {status === 'done' && data.frameUrl && (
        <div className="absolute -top-[42px] left-1/2 -translate-x-1/2 flex items-center p-1.5 bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] opacity-0 group-hover/shotnode:opacity-100 transition-all duration-300 z-50 scale-95 group-hover/shotnode:scale-100 pointer-events-none group-hover/shotnode:pointer-events-auto">
          <button className="flex items-center gap-1.5 px-3 py-1 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Maximize size={12}/> 高清HD</button>
          <button className="flex items-center gap-1.5 px-3 py-1 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><RefreshCcw size={12}/> 存资产</button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = data.frameUrl; a.download = `YR_Shot_${Date.now()}.png`; a.click(); }} className="flex items-center gap-1.5 px-3 py-1 rounded-[10px] text-[11px] font-bold text-zinc-300 hover:text-black hover:bg-white transition-all shadow-md whitespace-nowrap">
            <Download size={12}/> 下载
          </button>
        </div>
      )}
      
      {zenMode && <ZenEditor label={zenMode.label} value={data[zenMode.field] || ''} onChange={(val: string) => updateNodeData(id, { [zenMode.field]: val })} onClose={() => setZenMode(null)} />}

      <div className={`relative rounded-[24px] bg-[#18181b]/80 backdrop-blur-3xl border ${selected ? 'border-white/30 shadow-2xl' : 'border-white/[0.08]'} flex flex-col p-2 transition-all duration-500`}>
        <div className="flex items-center justify-between px-2 pt-1 pb-2">
          <span className="bg-white/10 text-white px-2 py-0.5 rounded-[6px] text-[10px] font-mono font-bold shadow-inner">SHOT {data.shotNumber}</span>
          {/* 已移除无用的 SEC 时长显示，保持图节点纯粹性 */}
        </div>

        {/* ✨ 物理变形预览区 (强制内联样式比例) */}
        <div style={currentStyle} className="w-full bg-[#0a0a0c] border border-white/10 rounded-[16px] overflow-hidden relative shadow-inner transition-all duration-500 ease-out origin-center group/shotimg">
          

          {(status === 'generating' || status === 'pending') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10">
              <Loader2 size={24} className="animate-spin text-zinc-400 mb-2" />
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold animate-pulse">
                {status === 'pending' ? 'QUEUED / 排队中...' : 'Rendering...'}
              </span>
            </div>
          )}
          {status === 'done' && data.frameUrl && <img src={data.frameUrl} className="w-full h-full object-cover" />}
        </div>
      </div>

      <div className={`absolute top-[100%] pt-4 left-1/2 -translate-x-1/2 w-[540px] transition-all duration-500 ease-out origin-top ${selected ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
         <div className="bg-black/60 border border-white/[0.08] backdrop-blur-3xl rounded-[32px] p-4 shadow-2xl flex flex-col relative">
            
         <div className="flex flex-col gap-1.5 mb-3 bg-[#050505]/50 p-2.5 rounded-[16px] border border-white/5 focus-within:border-white/20 transition-colors shadow-inner">
               <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">场景光影轨</label>
               <input value={data.sceneLighting || ''} onChange={(e) => { updateNodeData(id, { sceneLighting: e.target.value }); markDownstreamDirty(); }} className="bg-transparent text-[11px] text-zinc-300 font-mono outline-none nodrag nopan w-full" />
            </div>

            <div className="flex flex-col gap-1.5 mb-3 bg-[#050505]/50 p-2.5 rounded-[16px] border border-white/5 group/zen1 focus-within:border-white/20 transition-colors shadow-inner">
               <label className="text-[9px] font-bold text-zinc-400 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    首帧锚定轨 
                    {data.styleOverride && data.styleOverride !== '继承全局预设' && <span className="bg-white/10 text-white px-1.5 py-0.5 rounded text-[8px] font-mono border border-white/20">STYLE: {data.styleOverride.split(' ')[0]}</span>}
                  </div>
                  <button onClick={() => setZenMode({ field: 'firstFrameAnchor', label: '首帧描述' })} className="opacity-0 group-hover/zen1:opacity-100 text-zinc-400 hover:text-white transition-colors"><Expand size={10}/></button>
               </label>
               <MentionTextarea value={data.firstFrameAnchor || ''} onChange={(v: string) => { updateNodeData(id, { firstFrameAnchor: v }); markDownstreamDirty(); }} incomingAssets={incomingAssets} />
            </div>
            
            <div className="flex flex-col gap-1.5 mb-2 bg-[#050505]/50 p-2.5 rounded-[16px] border border-white/5 group/zen2 focus-within:border-white/20 transition-colors shadow-inner">
               <label className="text-[9px] font-bold text-zinc-400 flex justify-between">时序演进与动作轨 <button onClick={() => setZenMode({ field: 'videoPrompt', label: '动作提示词' })} className="opacity-0 group-hover/zen2:opacity-100 text-zinc-400 hover:text-white transition-colors"><Expand size={10}/></button></label>
               <textarea value={data.videoPrompt || ''} onChange={(e) => { updateNodeData(id, { videoPrompt: e.target.value }); markDownstreamDirty(); }} className="w-full bg-black/40 border border-white/[0.05] rounded-[12px] p-3 text-[11px] text-zinc-300 outline-none resize-none custom-scrollbar min-h-[160px] nodrag nopan" onWheelCapture={(e) => e.stopPropagation() } />
            </div>

            <div className="h-px w-full bg-white/[0.05] my-3" />

            <div className="flex items-center justify-between px-2 pb-1 relative">
               <div className="flex items-center gap-2">
               <CustomSelect className="w-[140px]" value={data.model || 'gpt-image-2'} options={[{ value: 'gpt-image-2', label: 'GPT-Image-2' }, { value: 'seedream', label: 'Seedream 5.0' }]} onChange={(v: string) => updateNodeData(id, { model: v })} />
                 
                 {/* ✨ 黑玻璃参数胶囊舱 */}
                 <div className="relative group/cfg">
                    <button onClick={() => setShowConfig(!showConfig)} className={`p-2 rounded-[10px] transition-all nodrag ${showConfig ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}><Settings2 size={16}/></button>
                    {showConfig && (
                       <div className="absolute bottom-[calc(100%+10px)] left-0 w-[240px] bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/10 rounded-[16px] shadow-2xl p-3 z-50 flex flex-col gap-3 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1">
                             <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">画面比例 (Ratio)</label>
                             <div className="flex gap-1 bg-black/40 p-1 rounded-[8px] border border-white/5">
                               {['16:9', '9:16', '1:1'].map(r => (
                                 <button key={r} onClick={() => updateNodeData(id, { ratio: r })} className={`flex-1 py-1 text-[10px] rounded-[4px] transition-all nodrag ${data.ratio === r ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'}`}>{r}</button>
                               ))}
                             </div>
                          </div>
                          <div className="flex flex-col gap-1 z-10">
                             <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">画质设定 (Quality)</label>
                             <CustomSelect menuPosition="top" className="w-full bg-black/40 border border-white/5 text-zinc-300 rounded-[8px]" value={data.quality || '标准 Standard'} options={[{ value: '标准 Standard', label: '标准 Standard (2K内)' }, { value: '高清 HD (耗时)', label: '极致 Ultra (4K)' }]} onChange={(v: string) => updateNodeData(id, { quality: v })} />
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
                 {status === 'draft' ? (
                    <button onClick={handleGenerateFrame} disabled={data.isGenerating} className="h-10 px-6 rounded-full bg-white text-black text-[12px] font-bold shadow-lg hover:scale-105 nodrag">提取生成首帧</button>
                 ) : (
                    <button onClick={handleSpawnVideo} className="flex items-center gap-1.5 h-10 px-5 rounded-full bg-indigo-500 text-white text-[12px] font-bold shadow-lg hover:bg-indigo-400 nodrag"><Film size={14}/> 传给3级渲染</button>
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
  const currentStyle = ratioStyleMap[data.ratio || '16:9'] || ratioStyleMap['16:9'];

  const incomingAssets = edges.filter(e => e.target === id).map(e => {
    const srcNode = nodes.find(n => n.id === e.source);
    if (srcNode?.data?.asset) return srcNode.data.asset;
    if (srcNode?.data?.frameUrl) return { url: srcNode.data.frameUrl, _type: 'image', prompt: srcNode.data.prompt };
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
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 bg-[radial-gradient(circle_at_2px_2px,rgba(255,255,255,0.05)_1px,transparent_0)] bg-[size:16px_16px]">
              <Film size={32} className="opacity-30 mb-2" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-center px-4">
                Received Temporal Data<br/>Ready for Final Render
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
// 2. 图像节点 (MediaNode) - 搭载创作者悬浮面板
// ==========================================
export const MediaNode = ({ id, data, selected }: any) => {
  const { updateNodeData } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes();
  const [showConfig, setShowConfig] = useState(false);
  const [zenMode, setZenMode] = useState<any>(null);
  
  const isReferenceOnly = !!data.asset;
  const displayImage = isReferenceOnly ? data.asset.url : data.resultUrl;

  const incomingAssets = edges.filter(e => e.target === id).map(e => {
    const srcNode = nodes.find(n => n.id === e.source);
    if (srcNode?.data?.asset) return srcNode.data.asset;
    if (srcNode?.data?.resultUrl) return { url: srcNode.data.resultUrl, _type: 'image', prompt: srcNode.data.prompt };
    return null;
  }).filter(Boolean);

  // 核心修复：采用强制内联绑定宽高比，绝不被 CSS 引擎忽略
  const ratioStyleMap: Record<string, React.CSSProperties> = {
    '16:9': { width: '320px', aspectRatio: '16/9' }, '9:16': { width: '220px', aspectRatio: '9/16' },
    '1:1': { width: '260px', aspectRatio: '1/1' }, '4:3': { width: '280px', aspectRatio: '4/3' }, '3:4': { width: '240px', aspectRatio: '3/4' }
  };
  const currentStyle = ratioStyleMap[data.ratio || '16:9'] || ratioStyleMap['16:9'];

  const handleGenerate = async () => {
    if (data.isGenerating) return;
    updateNodeData(id, { isGenerating: true });
    try {
      const payload: any = { model: data.model || 'gpt-image-2', prompt: data.prompt || '生成绝美图像', ratio: data.ratio || '16:9', n: 1 };
      const imageRefs = incomingAssets.filter((a: any) => a._type === 'image').map((a: any) => a.url);
      if (imageRefs.length > 0) { payload.image = imageRefs[0]; payload.images = imageRefs; }

      const response = await fetchApi('/v1/images/generations', { method: 'POST', body: JSON.stringify(payload) });
      const resData = await response.json();
      const url = resData.data?.[0]?.url || resData.url;
      if (url) updateNodeData(id, { isGenerating: false, resultUrl: url });
      else throw new Error("API 未返回图片");
    } catch (e) {
      updateNodeData(id, { isGenerating: false }); 
      useAppStore.getState().setToastMsg("生图被拦截或失败，请检查网络");
    }
  };

  const showToast = (msg: string) => useAppStore.getState().setToastMsg(msg);
  
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!displayImage) return;
    const a = document.createElement('a');
    a.href = displayImage; a.download = `YR_Image_${Date.now()}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="relative z-20 group">
      {!isReferenceOnly && <Handle type="target" position={Position.Left} id="left" className={handleLeft} />}
      <Handle type="source" position={Position.Right} id="right" className={handleRight} />
      {zenMode && <ZenEditor label={zenMode.label} value={data[zenMode.field] || ''} onChange={(val: string) => updateNodeData(id, { [zenMode.field]: val })} onClose={() => setZenMode(null)} incomingAssets={incomingAssets} />}

      {/* ✨ 图像核心控制台 (平时隐藏，Hover浮现) */}
      {displayImage && (
        <div className="absolute -top-[52px] left-1/2 -translate-x-1/2 flex items-center p-1.5 bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto z-[100] scale-95 group-hover:scale-100 after:content-[''] after:absolute after:-bottom-6 after:left-0 after:w-full after:h-6">
          <button onClick={() => showToast("正在调起高清放大引擎...")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Maximize size={12}/> 高清HD</button>
          
          {/* 下拉子选项结构 */}
          <div className="relative group/btn flex items-center">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Wand2 size={12}/> 重绘 <ChevronDown size={10}/></button>
            {/* 🚀 核心修复：用隐形的 padding-top 撑开透明间隙，保证悬停不断层 */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[100%] pt-2 opacity-0 group-hover/btn:opacity-100 pointer-events-none group-hover/btn:pointer-events-auto transition-all z-[101]">
               <div className="bg-[#050505]/95 backdrop-blur-xl border border-white/10 p-1.5 rounded-[12px] shadow-2xl flex flex-col gap-0.5">
                 <button onClick={() => showToast("开启局部重绘")} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">自由重绘</button>
                 <button onClick={() => showToast("开启人脸重绘分析")} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">人脸修复</button>
                 <button onClick={() => showToast("开启服装替换")} className="px-3 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 rounded-[8px] whitespace-nowrap text-left">服装替换</button>
               </div>
            </div>
          </div>

          <button onClick={() => showToast("开启智能笔刷擦除")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Eraser size={12}/> 擦除</button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={() => showToast("进入九宫格扩展模式")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><Grid size={12}/> 九宫格</button>
          <button onClick={() => showToast("生成人物三视图")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><UserRound size={12}/> 多视图</button>
          <button onClick={() => showToast("开启画布标注工具")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><PenTool size={12}/> 标注</button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={() => showToast("已转存至侧边栏资产库")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"><RefreshCcw size={12}/> 存资产</button>
          <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-bold text-zinc-300 hover:text-black hover:bg-white transition-all shadow-md whitespace-nowrap"><Download size={12}/> 下载</button>
        </div>
      )}

      {/* ✨ 优化：应用严格的内联尺寸绑定 */}
      <div style={currentStyle} className={`${nodeBaseClass} ${selected ? selectedBorderClass : unselectedBorderClass} overflow-hidden flex flex-col p-1 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]`}>
        <div className="w-full h-full relative flex items-center justify-center bg-transparent rounded-[20px] overflow-hidden">
        {displayImage ? (
             <img src={displayImage} className="w-full h-full object-cover pointer-events-none" draggable={false} />
          ) : (
            <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#020204] overflow-hidden dynamic-particles-container">
              {/* ✨ 真实动态视差星空与星云引擎 */}
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
                /* 迷幻星云层 */
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
                /* 深渊暗角层 */
                .dynamic-particles-container::after {
                  content: "";
                  position: absolute;
                  inset: 0;
                  background: radial-gradient(circle at center, transparent 20%, rgba(2, 2, 4, 0.95) 100%);
                  pointer-events: none;
                  z-index: 2;
                }
              `}} />
              
              <input type="file" id={`upload-${id}`} className="hidden" accept="image/*" onChange={(e) => {
                 const file = e.target.files?.[0];
                 if(file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                       const result = ev.target?.result as string;
                       const img = new Image(); img.src = result;
                       img.onload = () => {
                          const ratioVal = img.naturalWidth / img.naturalHeight;
                          let finalRatio = '16:9';
                          if (ratioVal < 0.8) finalRatio = '9:16'; else if (ratioValue >= 0.8 && ratioValue < 1.2) finalRatio = '1:1'; else if (ratioValue >= 1.2 && ratioValue < 1.5) finalRatio = '4:3';
                          updateNodeData(id, { resultUrl: result, ratio: finalRatio });
                       }
                    };
                    reader.readAsDataURL(file);
                 }
              }} />
              
              {/* ✨ 区分生成中和空状态 */}
              {data.isGenerating ? (
                 <div className="z-10 flex flex-col items-center">
                    <Loader2 size={24} className="mb-3 animate-spin text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,1)]" />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-300 animate-pulse drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]">Synthesizing...</span>
                 </div>
              ) : (
                 <div 
                   onClick={() => document.getElementById(`upload-${id}`)?.click()}
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
              
              {/* ✨ 优化：删除冗余标题，全屏纯净输入框，悬浮放大按钮 */}
              <div className="relative mb-4 bg-[#050505]/50 rounded-[16px] border border-white/5 focus-within:border-white/20 transition-colors shadow-inner group/zen">
                 <div className="min-h-[120px] p-2">
                    <MentionTextarea value={data.prompt || ''} onChange={(v: string) => updateNodeData(id, { prompt: v })} placeholder="输入提示词，或输入 @ 选择已连接的参考图参与融合..." incomingAssets={incomingAssets} />
                 </div>
                 {/* 悬浮放大按钮，移至右上角 */}
                 <button onClick={() => setZenMode({ field: 'prompt', label: '生图提示词' })} className="absolute top-3 right-3 p-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg opacity-0 group-hover/zen:opacity-100 text-zinc-400 hover:text-white hover:bg-white/10 transition-all shadow-md z-10">
                    <Expand size={14}/>
                 </button>
              </div>
              
              <div className="flex items-center justify-between px-2 pb-1 relative">
                 <div className="flex items-center gap-2">
                    {/* ✨ 优化：拉宽下拉框，防止模型名字被裁断 */}
                    <CustomSelect className="w-[150px]" value={data.model || 'gpt-image-2'} options={[{ value: 'gpt-image-2', label: 'GPT-Image-2' }, { value: 'banana-pro', label: 'Banana Pro' }, { value: 'seedream5.0', label: 'Seedream 5.0' }]} onChange={(v: string) => updateNodeData(id, { model: v })} />
                    
                    {/* 新增：生成张数 */}
                    <CustomSelect className="w-[80px]" value={data.n || 1} options={[{ value: 1, label: '1 张' }, { value: 2, label: '2 张' }, { value: 3, label: '3 张' }, { value: 4, label: '4 张' }]} onChange={(v: number) => updateNodeData(id, { n: v })} />
                    
                    {/* ✨ 图片设置参数胶囊 (按ShotNode同级样式重构) */}
                    <div className="relative group/cfg">
                       <button onClick={() => setShowConfig(!showConfig)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] transition-all nodrag ${showConfig ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'}`}>
                           <span className="text-[10px] font-bold tracking-widest">{data.ratio || '16:9'} / {data.quality === '高清 HD (耗时)' ? '4K' : '2K'}</span>
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
                                <CustomSelect menuPosition="top" className="w-full bg-black/40 border border-white/5 text-zinc-300 rounded-[8px]" value={data.quality || '标准 Standard'} options={[{ value: '标准 Standard', label: '标准 Standard (2K内)' }, { value: '高清 HD (耗时)', label: '极致 Ultra (4K)' }]} onChange={(v: string) => updateNodeData(id, { quality: v })} />
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
          <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-bold text-zinc-300 hover:text-black hover:bg-white transition-all shadow-md whitespace-nowrap"><Download size={12}/> 下载</button>
        </div>
      )}

<div style={currentStyle} className={`${nodeBaseClass} ${selected ? selectedBorderClass : unselectedBorderClass} overflow-hidden flex flex-col p-1.5 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]`}>
        <div className="w-full h-full relative flex items-center justify-center bg-transparent rounded-[20px] overflow-hidden">
          {displayVideo ? (
            <video key={displayVideo} src={displayVideo} preload="metadata" className="w-full h-full max-h-[500px] object-contain rounded-[18px]" controls autoPlay loop muted playsInline />
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full p-4">
              {data.isGenerating ? (
                 <><Loader2 size={24} className="mb-3 opacity-80 animate-spin text-amber-200" /><span className="text-[10px] uppercase font-bold tracking-widest text-amber-200 animate-pulse">Rendering...</span></>
               ) : (
                 <>
                   <Film size={24} className="text-zinc-700 mb-3 opacity-50" />
                   <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-600 mb-5">Empty Video</span>
                   <div className="flex gap-2 z-10">
                      <button onClick={handleRender} className="px-3 py-1.5 border border-white/[0.05] rounded-[8px] text-[10px] text-zinc-500 hover:text-white hover:border-white/20 hover:bg-white/[0.02] transition-all nodrag">文本生成</button>
                      <button onClick={() => showToast("请先将外部媒体连入左侧节点")} className="px-3 py-1.5 border border-white/[0.05] rounded-[8px] text-[10px] text-zinc-500 hover:text-white hover:border-white/20 hover:bg-white/[0.02] transition-all nodrag">首尾合成</button>
                   </div>
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