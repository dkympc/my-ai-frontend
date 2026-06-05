// /lib/constants.tsx
import React from 'react';
import { Film, Sparkles, Layers, PenTool, FileText, Image as ImageIcon, BarChart, Globe, MessageSquare, Video } from 'lucide-react';

// ==========================================
// 🧩 工作流/智能体 配置注册表
// ==========================================
export const WORKFLOW_REGISTRY = [
  { id: 'dify-script-storyboard', name: '剧本分镜助手', desc: '将长篇剧本自动拆解为结构化的分镜脚本，包含画面、景别和台词。', category: 'content', engine: 'dify', icon: <Film size={20} className="text-purple-400" />, inputs: [{ key: 'script_text', label: '剧本内容', type: 'textarea', placeholder: '请输入完整剧本进行拆解...' }] },
  { id: 'dify-frame-splitter', name: '分镜拆帧助手', desc: '基于物理运镜逻辑，将剧本/分镜智能拆解为包含英文相机参数的连续定帧生图提示词。', category: 'content', engine: 'dify', icon: <Sparkles size={20} className="text-yellow-400" />, inputs: [{ key: 'script_content', label: '完整剧情剧本 (第一步)', type: 'textarea', placeholder: '请在此粘贴完整剧本。提交后AI将为您推荐并锁定摄影机参数...' }] },
  { id: 'dify-paragraph-storyboard', name: '段落分镜助手', desc: '专注于将单一复杂段落转化为连贯的多个分镜镜头。', category: 'content', engine: 'dify', icon: <Layers size={20} className="text-indigo-400" />, inputs: [{ key: 'paragraph', label: '段落内容', type: 'textarea', placeholder: '请输入需要拆解的具体段落...' }] },
  { id: 'dify-script-creator', name: '剧本创作助手', desc: '输入核心立意与主题，AI 自动生成符合三幕剧结构的完整短视频剧本。', category: 'content', engine: 'dify', icon: <PenTool size={20} className="text-pink-400" />, inputs: [{ key: 'theme', label: '核心主题/立意', type: 'text', placeholder: '例如：职场新人的第一次汇报' }, { key: 'genre', label: '剧本类型', type: 'select', options: ['搞笑反转', '情感走心', '悬疑惊悚', '干货科普'] }] },
  { id: 'dify-xiaohongshu-copywriter', name: '小红书爆款文案生成器', desc: '基于爆款逻辑，自动生成带 Emoji 的网感文案与标题组合。', category: 'content', engine: 'dify', icon: <PenTool size={20} className="text-pink-400" />, inputs: [{ key: 'topic', label: '核心主题', type: 'text', placeholder: '例如：秋季穿搭日常' }, { key: 'tone', label: '文案语气', type: 'select', options: ['网感种草', '干货测评', '情绪共鸣', '专业严谨'] }, { key: 'keywords', label: '必须包含的关键词', type: 'textarea', placeholder: '用逗号分隔...' }] },
  { id: 'dify-article-polish', name: '公众号文章深度润色', desc: '修正错别字，优化语序，提升文章的逻辑性与可读性。', category: 'content', engine: 'dify', icon: <FileText size={20} className="text-blue-400" />, inputs: [{ key: 'original_text', label: '原文内容', type: 'textarea', placeholder: '请粘贴需要润色的文字...' }] },
  { id: 'comfyui-product-bg', name: '电商商品白底图换景', desc: '自动识别商品主体，融合生成高级摄影棚背景。', category: 'image', engine: 'comfyui', icon: <ImageIcon size={20} className="text-emerald-400" />, inputs: [{ key: 'product_image', label: '商品白底图', type: 'file' }, { key: 'scene_prompt', label: '场景描述', type: 'text', placeholder: '例如：放在木质桌面上，阳光穿过树叶洒下斑驳光影' }] },
  { id: 'n8n-daily-report', name: '全网热点日报搜集', desc: '自动抓取微博、知乎、抖音热搜，并由 AI 总结成早报。', category: 'data', engine: 'n8n', icon: <BarChart size={20} className="text-orange-400" />, inputs: [{ key: 'focus_industry', label: '关注行业', type: 'select', options: ['科技互联网', '金融财经', '娱乐影视', '全部'] }] },
  { id: 'agent-social-media', name: '全自动社媒运营 Agent', desc: '自动抓取热点、生成图文并一键分发到多平台，全程无人值守。', category: 'agent', engine: 'agent', icon: <Globe size={20} className="text-blue-500" />, inputs: [{ key: 'topic', label: '今日关注话题', type: 'text', placeholder: '例如：人工智能最新进展' }] },
  { id: 'agent-customer-service', name: '智能客服与工单 Agent', desc: '接入知识库，自动回复用户咨询，遇到复杂问题自动生成工单流转。', category: 'agent', engine: 'agent', icon: <MessageSquare size={20} className="text-green-500" />, inputs: [{ key: 'user_query', label: '模拟用户咨询', type: 'textarea', placeholder: '输入用户的提问进行测试...' }] }
];

export const MODELS = [
  { id: 'gpt-5.4', name: 'GPT-5.4', desc: '最强逻辑与创造力' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', desc: '极致响应速度' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', desc: '复杂推理与长文本' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4', desc: '深度思考与逻辑' }
];

export const IMAGE_MODELS = [
  { id: 'gpt-image-2', name: 'GPT-Image-2', desc: '官方稳定生图', features: ['ratio', 'style'] },
  { id: 'banana2', name: 'Banana 2', desc: '极速生成引擎', features: ['ratio', 'negative', 'style'] },
  { id: 'banana-pro', name: 'Banana Pro', desc: '专业级细节把控', features: ['ratio', 'stylize', 'negative'] },
  { id: 'seedream5.0', name: 'Seedream 5.0', desc: '极致梦幻艺术', features: ['ratio', 'style', 'negative', 'sampler'] }
];

export const VIDEO_MODES = [
  { id: 't2v', label: '文生视频', icon: <FileText size={14}/> },
  { id: 'i2v', label: '首帧生视频', icon: <ImageIcon size={14}/> },
  { id: 'i2v-both', label: '首尾帧生视频', icon: <Layers size={14}/> },
  { id: 'v2v', label: '视频编辑/延长', icon: <Video size={14}/> },
];

export const VIDEO_MODELS = [
  { id: 'doubao-seedance-2-0-fast-260128', name: 'Seedance 2.0 Fast', features: ['ratio', 'duration', 'resolution'], modes: ['t2v', 'i2v', 'i2v-both', 'v2v'], ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'], resolutions: ['480p', '720p'] },
  { id: 'doubao-seedance-2-0-260128', name: 'Seedance 2.0', features: ['ratio', 'duration', 'resolution'], modes: ['t2v', 'i2v', 'i2v-both', 'v2v'], ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'], resolutions: ['480p', '720p', '1080p'] },
  { id: 'kling-o3', name: 'Kling O3', features: ['ratio', 'duration', 'resolution'], modes: ['t2v', 'i2v', 'i2v-both'], ratios: ['16:9', '9:16', '1:1'], resolutions: ['720p', '1080p', '4k'] }
];