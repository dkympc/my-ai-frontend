import React, { useState } from 'react';
import { Handle, Position, useReactFlow, NodeResizer } from '@xyflow/react';
import { Image as ImageIcon, Film, Type, Sparkles, ChevronDown, MoveUp, Scaling } from 'lucide-react';

// ==========================================
// 极简碳灰卡片基底 (绝不使用纯黑)
// ==========================================
const nodeBaseClass = "relative rounded-[24px] bg-[#18181b]/80 backdrop-blur-3xl shadow-[0_10px_40px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300";
const selectedBorderClass = "border border-white/30 shadow-[0_0_40px_rgba(255,255,255,0.05),0_10px_40px_rgba(0,0,0,0.8)]";
const unselectedBorderClass = "border border-white/[0.08] hover:border-white/20";

// 引力接线点 (平时全透明，鼠标靠近闪耀白光)
const baseHandleClass = "!bg-transparent !border-none !rounded-none opacity-0 hover:opacity-100 flex items-center justify-center transition-all duration-300 z-50 " +
  "after:content-[''] after:w-2.5 after:h-2.5 after:bg-white after:rounded-full after:shadow-[0_0_15px_rgba(255,255,255,0.9)]";
const handleX = `${baseHandleClass} !w-[80%] !h-8`;
const handleY = `${baseHandleClass} !h-[80%] !w-8`;

// ==========================================
// ✨ 修复 2 & 3：纯悬浮下拉菜单 (向下展开 + 悬停桥梁修复)
// ==========================================
function CustomSelect({ value, options, onChange, icon: Icon, className = "" }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o: any) => o.value === value) || options[0];

  return (
    <div className={`relative ${className}`} onMouseLeave={() => setIsOpen(false)}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-full flex items-center justify-between bg-transparent hover:bg-white/10 rounded-full px-3 py-2 text-[12px] font-medium text-zinc-300 cursor-pointer transition-all duration-300 group"
      >
        <span className="truncate relative z-10 flex-1 text-left">{selectedOption.label}</span>
        {Icon ? <Icon size={14} className="text-zinc-500 relative z-10 ml-2" /> : <ChevronDown size={14} className={`text-zinc-500 relative z-10 ml-1.5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />}
      </div>
      
      {/* 
        ✨ 修复重点：
        1. top-full：强制往下展开
        2. pt-1.5：这是一个看不见的透明桥梁，鼠标滑过时不会判定为离开菜单，彻底解决闪退！ 
      */}
      <div className={`absolute top-full left-0 min-w-[140px] pt-1.5 z-[9999] transition-all duration-300 origin-top ${isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
        <div className="bg-[#18181b]/95 backdrop-blur-3xl border border-white/[0.08] rounded-[20px] shadow-[0_30px_60px_rgba(0,0,0,0.9)] py-1.5 px-1">
          {options.map((opt: any) => (
            <div 
              key={opt.value} 
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`px-3 py-2.5 mx-1 text-[11px] font-medium cursor-pointer rounded-[12px] transition-colors ${value === opt.value ? 'text-white bg-white/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
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
// 节点 1：文本剧本节点 (TextNode)
// ==========================================
export const TextNode = ({ id, data, selected }: any) => {
  const { updateNodeData } = useReactFlow();

  return (
    <>
      <NodeResizer minWidth={300} minHeight={200} isVisible={selected} lineClassName="!border-transparent" handleClassName="!bg-transparent !border-transparent !shadow-none !w-6 !h-6" />
      
      {/* ✨ 修复 1：背景改回高级碳灰 bg-[#18181b]/80 */}
      <div className={`${selected ? selectedBorderClass : unselectedBorderClass} relative rounded-[32px] bg-[#18181b]/80 backdrop-blur-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)] flex flex-col w-full h-full min-w-[300px] min-h-[200px] p-5 group z-20 transition-all duration-500`}>
        <Handle type="target" position={Position.Top} id="top" className={handleX} />
        <Handle type="target" position={Position.Left} id="left" className={handleY} />
        <Handle type="source" position={Position.Bottom} id="bottom" className={handleX} />
        <Handle type="source" position={Position.Right} id="right" className={handleY} />

        <div className="flex items-center gap-3 mb-4 border-b border-white/[0.05] pb-3 pointer-events-none">
          <div className="w-7 h-7 rounded-[8px] bg-[#050505] relative overflow-hidden border border-white/[0.1] flex items-center justify-center">
             <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent" />
             <Type size={12} className="text-zinc-200 drop-shadow-md relative z-10" />
          </div>
          <span className="text-[12px] font-bold text-zinc-300 uppercase tracking-widest">Script</span>
        </div>

        <textarea 
          className="flex-1 w-full bg-transparent text-[14px] text-zinc-200 placeholder-zinc-600 resize-none outline-none custom-scrollbar leading-relaxed nodrag"
          placeholder="在此输入画面剧本或提示词..."
          value={data.text || ''}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
        />
        
        {/* 底部悬浮抽屉 */}
        <div className={`absolute top-[calc(100%+12px)] left-0 w-full flex items-center justify-between gap-3 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${selected ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
           <CustomSelect 
             className="w-[180px] bg-black/40 backdrop-blur-3xl rounded-full border border-white/[0.05]"
             value={data.model || 'gemini-3.1-pro-preview'}
             options={[
               { value: 'gpt-5.4', label: 'GPT-5.4' }, { value: 'deepseek-r4', label: 'DeepSeek R4' },
               { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' }, { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
               { value: 'kimi-2.6', label: 'Kimi 2.6' }
             ]}
             onChange={(v: string) => updateNodeData(id, { model: v })}
           />
           <button className="flex items-center justify-center gap-1.5 flex-1 py-2 bg-transparent hover:bg-white/10 backdrop-blur-3xl rounded-full border border-white/[0.05] text-[12px] font-bold text-zinc-200 transition-all nodrag group shadow-lg">
              <Sparkles size={14} className="text-amber-200 group-hover:scale-110 transition-transform" />
              导演分镜
           </button>
        </div>
      </div>
    </>
  );
};

// ==========================================
// 节点 2：图像生成节点 (ImageNode)
// ==========================================
export const MediaNode = ({ id, data, selected }: any) => {
  const { updateNodeData } = useReactFlow();
  const hasAsset = !!data.asset;

  const aspectClassMap: Record<string, string> = {
    '16:9': 'w-[320px] aspect-video', '9:16': 'w-[200px] aspect-[9/16]',
    '1:1': 'w-[260px] aspect-square', '4:3': 'w-[280px] aspect-[4/3]', '3:4': 'w-[240px] aspect-[3/4]'
  };

  return (
    <div className="relative z-20">
      <div className={`${nodeBaseClass} ${selected ? selectedBorderClass : unselectedBorderClass} ${aspectClassMap[data.ratio || '16:9']} overflow-hidden flex flex-col`}>
        <Handle type="target" position={Position.Top} id="top" className={handleX} />
        <Handle type="target" position={Position.Left} id="left" className={handleY} />
        <Handle type="source" position={Position.Bottom} id="bottom" className={handleX} />
        <Handle type="source" position={Position.Right} id="right" className={handleY} />

        <div className="w-full h-full relative flex items-center justify-center bg-transparent">
          {hasAsset ? (
            <img src={data.asset.url} className="w-full h-full object-cover pointer-events-none" draggable={false} />
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-600">
               <ImageIcon size={24} className="mb-2 opacity-50" />
               <span className="text-[10px] uppercase tracking-widest font-medium">Empty Frame</span>
            </div>
          )}
        </div>
      </div>

      <div className={`absolute top-[calc(100%+16px)] left-1/2 -translate-x-1/2 w-[480px] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${selected ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
         
         <div className="bg-black/40 border border-white/10 backdrop-blur-3xl rounded-[32px] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.8)] focus-within:border-white/30 focus-within:shadow-[0_20px_60px_rgba(255,255,255,0.05)] transition-all duration-500 flex flex-col group">
            
            <textarea 
              className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-zinc-200 px-5 py-3 min-h-[80px] resize-none text-[14px] leading-relaxed custom-scrollbar placeholder-zinc-600 nodrag"
              placeholder="描述你想要的画面细节，长篇输入也毫无压力..."
              value={data.prompt || ''}
              onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
            />
            
            <div className="flex items-center justify-between px-3 pb-1 pt-2">
               <div className="flex items-center gap-1">
                  <CustomSelect 
                    className="w-[140px]"
                    value={data.model || 'gpt-image-2'}
                    options={[
                      { value: 'gpt-image-2', label: 'GPT-Image-2' },
                      { value: 'banana-pro', label: 'Banana Pro' },
                      { value: 'seedream5.0', label: 'Seedream 5.0' }
                    ]}
                    onChange={(v: string) => updateNodeData(id, { model: v })}
                  />
                  <CustomSelect 
                    className="w-[100px]"
                    value={data.ratio || '16:9'}
                    icon={Scaling}
                    options={[
                      { value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' },
                      { value: '1:1', label: '1:1' }, { value: '4:3', label: '4:3' }, { value: '3:4', label: '3:4' }
                    ]}
                    onChange={(v: string) => updateNodeData(id, { ratio: v })}
                  />
               </div>
               
               <button className="h-[36px] w-[36px] rounded-full bg-white text-black hover:scale-110 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-all active:scale-95 nodrag">
                 <MoveUp size={18} strokeWidth={2.5} />
              </button>
            </div>
         </div>
      </div>
    </div>
  );
};

// ==========================================
// 节点 3：视频生成节点 (RenderNode)
// ==========================================
export const RenderNode = ({ id, data, selected }: any) => {
  const { updateNodeData } = useReactFlow();
  const hasAsset = !!data.resultUrl; 

  const aspectClassMap: Record<string, string> = {
    '16:9': 'w-[320px] aspect-video', '9:16': 'w-[200px] aspect-[9/16]',
    '1:1': 'w-[260px] aspect-square', '21:9': 'w-[360px] aspect-[21/9]'
  };

  return (
    <div className="relative z-20">
      <div className={`${nodeBaseClass} ${selected ? selectedBorderClass : unselectedBorderClass} ${aspectClassMap[data.ratio || '16:9']} overflow-hidden flex flex-col`}>
        <Handle type="target" position={Position.Top} id="top" className={handleX} />
        <Handle type="target" position={Position.Left} id="left" className={handleY} />
        <Handle type="source" position={Position.Bottom} id="bottom" className={handleX} />
        <Handle type="source" position={Position.Right} id="right" className={handleY} />

        <div className="w-full h-full relative flex items-center justify-center bg-transparent">
          {hasAsset ? (
            <video src={data.resultUrl} className="w-full h-full object-cover pointer-events-none" autoPlay loop muted playsInline />
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-600">
               <Film size={24} className="mb-2 opacity-50" />
               <span className="text-[10px] uppercase tracking-widest font-medium text-center px-4">
                  Video Render<br/><span className="text-[8px] opacity-60">Wait for inputs</span>
               </span>
            </div>
          )}
        </div>
      </div>

      <div className={`absolute top-[calc(100%+16px)] left-1/2 -translate-x-1/2 w-[480px] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${selected ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
         
         <div className="bg-black/40 border border-white/10 backdrop-blur-3xl rounded-[32px] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.8)] focus-within:border-white/30 focus-within:shadow-[0_20px_60px_rgba(255,255,255,0.05)] transition-all duration-500 flex flex-col group">
            
            <textarea 
              className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-zinc-200 px-5 py-3 min-h-[80px] resize-none text-[14px] leading-relaxed custom-scrollbar placeholder-zinc-600 nodrag"
              placeholder="描述运镜方式与视频动态细节..."
              value={data.prompt || ''}
              onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
            />
            
            <div className="flex items-center justify-between px-3 pb-1 pt-2">
               <div className="flex items-center gap-1">
                  <CustomSelect 
                    className="w-[160px]"
                    value={data.model || 'doubao-seedance-2-0'}
                    options={[
                      { value: 'doubao-seedance-2-0', label: 'Seedance 2.0 (默认)' },
                      { value: 'doubao-seedance-2-0-fast', label: 'Seedance 2.0 Fast' },
                      { value: 'kling-o3', label: 'Kling O3' }
                    ]}
                    onChange={(v: string) => updateNodeData(id, { model: v })}
                  />
                  <CustomSelect 
                    className="w-[100px]"
                    value={data.ratio || '16:9'}
                    icon={Scaling}
                    options={[
                      { value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' },
                      { value: '1:1', label: '1:1' }, { value: '21:9', label: '21:9' }
                    ]}
                    onChange={(v: string) => updateNodeData(id, { ratio: v })}
                  />
               </div>
               
               <button className="h-[36px] w-[36px] rounded-full bg-white text-black hover:scale-110 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-all active:scale-95 nodrag">
                 <MoveUp size={18} strokeWidth={2.5} />
              </button>
            </div>
         </div>
      </div>
    </div>
  );
};