// /lib/types.ts

export interface ChatMessage { 
    role: 'user' | 'assistant' | 'system'; 
    content: string | any[]; 
  }
  
  export interface ChatSession { 
    id: string; 
    title: string; 
    messages: ChatMessage[]; 
    updatedAt: number; 
    model: string; 
  }
  
  export interface AttachedFile { 
    name: string; 
    type: string; 
    size: number; 
    data: string; 
    isImage: boolean; 
  }
  
  export interface MediaMaterial { 
    id: string; 
    type: 'image' | 'video' | 'audio'; 
    url: string; 
    name: string; 
    tag: string; 
  }
  
  export interface ImageRecord { 
    id: string; 
    url: string; 
    prompt: string; 
    model: string; 
    ratio: string; 
    timestamp: number; 
    status?: 'processing' | 'succeeded' | 'failed'; 
    references?: string[]; 
  }
  
  export interface VideoRecord { 
    id: string; 
    url: string; 
    prompt: string; 
    model: string; 
    mode: string; 
    ratio: string; 
    duration?: number; 
    resolution?: string; 
    timestamp: number; 
    status?: 'processing' | 'succeeded' | 'failed'; 
    task_id?: string; 
    pollModel?: string; 
  }
  
  export interface WfSession { 
    id: string; 
    workflowId: string; 
    title: string; 
    messages: {role: 'user'|'assistant', content: string}[]; 
    updatedAt: number; 
  }
  export interface CanvasProject {
  id: string;
  title: string;
  updatedAt: number;
  previewUrl?: string; // 画布缩略图（可选）
}