// /hooks/useVideoGen.ts
import { useState, useRef } from 'react';
import { fetchApi } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { VideoRecord, MediaMaterial } from '@/lib/types';
import { VIDEO_MODELS } from '@/lib/constants';

export function useVideoGen(
  videoHistory: VideoRecord[],
  setVideoHistory: React.Dispatch<React.SetStateAction<VideoRecord[]>>
) {
  const { setToastMsg } = useAppStore();

  // 视频专属状态
  const [vidModel, setVidModel] = useState('doubao-seedance-2-0-260128');
  const [vidMode, setVidMode] = useState('t2v');
  const [vidPrompt, setVidPrompt] = useState("");
  const [vidRatio, setVidRatio] = useState('16:9');
  const [vidDuration, setVidDuration] = useState<number>(5);
  const [vidResolution, setVidResolution] = useState('720p');
  const [vidMaterials, setVidMaterials] = useState<MediaMaterial[]>([]);
  
  const [isVidModelMenuOpen, setIsVidModelMenuOpen] = useState(false);
  const [isVidModeMenuOpen, setIsVidModeMenuOpen] = useState(false);
  const [isVidRatioMenuOpen, setIsVidRatioMenuOpen] = useState(false);
  const [isVidDurationMenuOpen, setIsVidDurationMenuOpen] = useState(false);
  const [isVidResMenuOpen, setIsVidResMenuOpen] = useState(false);
  const [showAtDropdown, setShowAtDropdown] = useState(false); 
  const [isVideoDeleteModalOpen, setIsVideoDeleteModalOpen] = useState(false);
  const [videoToDeleteId, setVideoToDeleteId] = useState<string | null>(null);

  // 👇 核心修复：用 useRef 记录正在轮询的任务，防止重渲染导致开启多个 while 死循环
  const pollingTasks = useRef<Set<string>>(new Set());

  const pollVideoTask = async (recordId: string, taskId: string, pollModel: string) => {
    if (pollingTasks.current.has(recordId)) return; // 防并发拦截
    pollingTasks.current.add(recordId);

    let isPolling = true;
    let attempts = 0;
    while (isPolling && attempts < 100) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 3500)); 
      try {
        // 使用海关 api.ts，自动带上 token
        const pollRes = await fetchApi('/v1/videos/status', {
          method: 'POST',
          body: JSON.stringify({ task_id: taskId, model: pollModel })
        });
        const pollData = await pollRes.json();
        
        if (pollData.status === 'succeeded') {
          setVideoHistory(prev => prev.map(v => v.id === recordId ? { ...v, status: 'succeeded', url: pollData.url } : v));
          isPolling = false;
        } else if (pollData.status === 'failed') {
          setVideoHistory(prev => prev.map(v => v.id === recordId ? { ...v, status: 'failed' } : v));
          isPolling = false;
          setToastMsg("模型敏感词拦截或服务器拥堵，视频生成失败");
        }
      } catch (e) {
        // 网络波动，继续轮询
      }
    }
    if (isPolling) {
       setVideoHistory(prev => prev.map(v => v.id === recordId ? { ...v, status: 'failed' } : v));
    }
    pollingTasks.current.delete(recordId); // 轮询结束，释放标记
  };

  const handleVidModelChange = (modelId: string) => {
    setVidModel(modelId); setIsVidModelMenuOpen(false);
    const selectedModel = VIDEO_MODELS.find(m => m.id === modelId);
    if (selectedModel) {
      if (!selectedModel.ratios.includes(vidRatio)) setVidRatio(selectedModel.ratios[0]);
      if (!selectedModel.resolutions.includes(vidResolution)) setVidResolution(selectedModel.resolutions[selectedModel.resolutions.length - 1]); 
      if (!selectedModel.modes.includes(vidMode)) setVidMode(selectedModel.modes[0]);
    }
  };

  const handleGenerateVideo = async () => {
    if (!vidPrompt.trim() && vidMaterials.length === 0) return;
    const tempId = Date.now().toString();
    const newRecord: VideoRecord = { id: tempId, url: '', prompt: vidPrompt, model: vidModel, mode: vidMode, ratio: vidRatio, duration: vidDuration, resolution: vidResolution, timestamp: Date.now(), status: 'processing' };
    
    setVideoHistory(prev => [newRecord, ...prev].slice(0, 20));
    const currentMaterials = [...vidMaterials]; 
    const currentPrompt = vidPrompt;
    setVidPrompt(""); setVidMaterials([]);

    try {
      const imageRefs = currentMaterials.filter(m => m.type === 'image').map(m => m.url);
      const videoRefs = currentMaterials.filter(m => m.type === 'video').map(m => m.url);
      const payload: any = { model: newRecord.model, mode: newRecord.mode, prompt: currentPrompt, ratio: newRecord.ratio, duration: newRecord.duration, resolution: newRecord.resolution };
      if (imageRefs.length > 0) { payload.image = imageRefs[0]; payload.images = imageRefs; }
      if (videoRefs.length > 0) { payload.video_url = videoRefs[0]; }
      
      // 👇 使用 api.ts，401/402等错误在底层已被自动拦截处理
      const response = await fetchApi('/v1/videos/generations', {
        method: 'POST', 
        body: JSON.stringify(payload)
      });
      
      const submitData = await response.json();
      const taskId = submitData.task_id; 
      const pollModel = submitData.model;
      if (!taskId) throw new Error("未能解析出任务 ID");
      
      setVideoHistory(prev => prev.map(v => v.id === tempId ? { ...v, task_id: taskId, pollModel: pollModel } : v));
      pollVideoTask(tempId, taskId, pollModel);
    } catch (error: any) {
      if (error.message === "Insufficient Balance" || error.message === "Unauthorized" || error.message === "Forbidden") {
         setVideoHistory(prev => prev.filter(v => v.id !== tempId));
         return;
      }
      console.error("生成视频失败:", error); 
      setToastMsg("视频生成失败，请检查网络或后端的 API 配置。");
      setVideoHistory(prev => prev.map(v => v.id === tempId ? { ...v, status: 'failed' } : v));
    }
  };

  const loadVideoToEdit = (record: VideoRecord) => {
    setVidPrompt(record.prompt); setVidModel(record.model); setVidMode(record.mode || 't2v'); setVidRatio(record.ratio);
    if(record.duration) setVidDuration(record.duration); if(record.resolution) setVidResolution(record.resolution);
    document.getElementById('vid-textarea')?.focus();
  };

  const triggerVideoDelete = (id: string) => { setVideoToDeleteId(id); setIsVideoDeleteModalOpen(true); };
  const confirmVideoDelete = () => { if (videoToDeleteId) { setVideoHistory(prev => prev.filter(v => v.id !== videoToDeleteId)); setIsVideoDeleteModalOpen(false); setVideoToDeleteId(null); } };

  return {
    vidModel, setVidModel,
    vidMode, setVidMode,
    vidPrompt, setVidPrompt,
    vidRatio, setVidRatio,
    vidDuration, setVidDuration,
    vidResolution, setVidResolution,
    vidMaterials, setVidMaterials,
    isVidModelMenuOpen, setIsVidModelMenuOpen,
    isVidModeMenuOpen, setIsVidModeMenuOpen,
    isVidRatioMenuOpen, setIsVidRatioMenuOpen,
    isVidDurationMenuOpen, setIsVidDurationMenuOpen,
    isVidResMenuOpen, setIsVidResMenuOpen,
    showAtDropdown, setShowAtDropdown,
    isVideoDeleteModalOpen, setIsVideoDeleteModalOpen,
    videoToDeleteId, setVideoToDeleteId,
    pollVideoTask,
    handleVidModelChange,
    handleGenerateVideo,
    loadVideoToEdit,
    triggerVideoDelete,
    confirmVideoDelete
  };
}