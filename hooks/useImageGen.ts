// /hooks/useImageGen.ts
import { useState } from 'react';
import { fetchApi } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { ImageRecord } from '@/lib/types';
import { IMAGE_MODELS } from '@/lib/constants';

export function useImageGen(
  imageHistory: ImageRecord[], 
  setImageHistory: React.Dispatch<React.SetStateAction<ImageRecord[]>>,
  setActiveImageId: React.Dispatch<React.SetStateAction<string | null>>
) {
  const { setToastMsg } = useAppStore();
  
  // 生图页面专属状态
  const [imgModel, setImgModel] = useState('gpt-image-2');
  const [isImgModelMenuOpen, setIsImgModelMenuOpen] = useState(false); 
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgNegativePrompt, setImgNegativePrompt] = useState("");
  const [imgRatio, setImgRatio] = useState('1:1');
  const [imgStyle, setImgStyle] = useState('none'); 
  const [imgReferences, setImgReferences] = useState<string[]>([]);

  const handleGenerateImage = async () => {
    if (!imgPrompt.trim()) return;
    
    const taskId = Date.now().toString();
    const currentRefs = [...imgReferences];
    
    const newRecord: ImageRecord = { 
      id: taskId, url: '', prompt: imgPrompt, model: imgModel, 
      ratio: imgRatio, timestamp: Date.now(), status: 'processing', references: currentRefs 
    };
    
    // 乐观更新 UI
    setImageHistory(prev => [newRecord, ...prev].slice(0, 30));
    setActiveImageId(taskId); 
    setImgPrompt(""); 
    setImgReferences([]);

    try {
      let targetSize = '1024x1024';
      if (newRecord.model === 'seedream5.0') {
        const srMap: Record<string, string> = { '1:1': '2K', '16:9': '2560x1440', '9:16': '1440x2560', '4:3': '2048x1536' }; targetSize = srMap[newRecord.ratio] || '2K';
      } else if (newRecord.model === 'banana-pro' || newRecord.model === 'banana2') {
        const bpMap: Record<string, string> = { '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792', '4:3': '1024x768' }; targetSize = bpMap[newRecord.ratio] || '1024x1024';
      } else {
        const defaultMap: Record<string, string> = { '1:1': '1024x1024', '16:9': '1024x576', '9:16': '576x1024', '4:3': '1024x768' }; targetSize = defaultMap[newRecord.ratio] || '1024x1024';
      }
      
      const payload: any = { model: newRecord.model, prompt: newRecord.prompt, n: 1, size: targetSize, ratio: newRecord.ratio };
      if (currentRefs.length > 0) { payload.image = currentRefs[0]; payload.images = currentRefs; }
      
      const currentFeatures = IMAGE_MODELS.find(m => m.id === newRecord.model)?.features || [];
      if (currentFeatures.includes('negative') && imgNegativePrompt.trim()) payload.negative_prompt = imgNegativePrompt;
      if ((currentFeatures.includes('style') || currentFeatures.includes('stylize')) && imgStyle !== 'none') payload.prompt = `${newRecord.prompt}, style: ${imgStyle}`;
      
      let attempts = 0; 
      let finalImageUrl = null; 

      while (attempts < 2 && !finalImageUrl) {
        attempts++;
        try {
          // 👇 享受 api.ts 带来的红利！所有的 401 登出、402 余额提示都在底层自动处理了
          const response = await fetchApi('/v1/images/generations', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          
          if (!response.ok) throw new Error(`API Connection Failed: ${response.status}`);
          
          const data = await response.json();
          if (data.data && data.data.length > 0 && data.data[0].url) finalImageUrl = data.data[0].url;
          else if (data.url) finalImageUrl = data.url;
          else if (data.images && data.images.length > 0) finalImageUrl = data.images[0].url || data.images[0];
          else if (data.choices && data.choices.length > 0 && data.choices[0].message?.content) { 
            const match = data.choices[0].message.content.match(/!\[.*?\]\((.*?)\)/); 
            if (match && match[1]) finalImageUrl = match[1]; 
          }
          if (!finalImageUrl) throw new Error("解析图片 URL 失败");
        } catch (err: any) {
          // 如果抛出的是余额不足或未授权，立刻终止重试（因为这些错误重试也没用）
          if (err.message === "Insufficient Balance" || err.message === "Unauthorized" || err.message === "Forbidden") {
             setImageHistory(prev => prev.filter(img => img.id !== taskId));
             return;
          }
          if (attempts < 2) await new Promise(res => setTimeout(res, 2000));
        }
      }
      
      if (finalImageUrl) {
        setImageHistory(prev => prev.map(img => img.id === taskId ? { ...img, url: finalImageUrl, status: 'succeeded' } : img));
      } else { 
        throw new Error("图片生成失败"); 
      }
    } catch (error) {
      console.error("生成图片失败:", error); 
      setToastMsg("生图失败，请检查网络或后端的 API 配置。");
      setImageHistory(prev => prev.map(img => img.id === taskId ? { ...img, status: 'failed' } : img));
    }
  };

  return {
    imgModel, setImgModel,
    isImgModelMenuOpen, setIsImgModelMenuOpen,
    imgPrompt, setImgPrompt,
    imgNegativePrompt, setImgNegativePrompt,
    imgRatio, setImgRatio,
    imgStyle, setImgStyle,
    imgReferences, setImgReferences,
    handleGenerateImage
  };
}