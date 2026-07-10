import React, { useState } from 'react';
import { 
  X, User, Cpu, Sliders, Database, Shield, RotateCcw, 
  Loader2, CircleDot, MessageSquare, Settings, 
  Image as ImageIcon, Film, Puzzle, Download, LogOut, Key, Lock,
  ChevronDown, Eye, EyeOff, Copy, Plus, Clock, Check, AlertCircle
} from 'lucide-react';
import { MODELS } from '@/lib/constants';
import { fetchApi } from '@/services/api';

interface SettingsModalProps {
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (val: boolean) => void;
  activeSettingsTab: string;
  setActiveSettingsTab: (val: string) => void;
  userRole: string;
  settings: any;
  setSettings: any;
  avatarInputRef: React.RefObject<HTMLInputElement>;
  handleAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedPromptModel: string;
  setSelectedPromptModel: (val: string) => void;
  handleExportData: () => void;
  handleLogout: () => void;
  isAdminLoading: boolean;
  fetchAdminData: (isPolling: boolean) => void;
  adminUsers: any[];
  selectedUser: any;
  setSelectedUser: (val: any) => void;
  handleAdminUserAction: (username: string, action: string, extraData?: any) => void;
  handleViewUserChats: (username: string) => void;
}

export default function SettingsModal({
  isSettingsModalOpen, setIsSettingsModalOpen,
  activeSettingsTab, setActiveSettingsTab,
  userRole, settings, setSettings,
  avatarInputRef, handleAvatarUpload,
  selectedPromptModel, setSelectedPromptModel,
  handleExportData, handleLogout,
  isAdminLoading, fetchAdminData,
  adminUsers, selectedUser, setSelectedUser,
  handleAdminUserAction, handleViewUserChats
}: SettingsModalProps) {

  // 👇==== 将充值函数移入组件内部，并修复类型和状态刷新 ====👇
  const handleAdminRecharge = async (targetUsername: string) => {
    if (!window.confirm(`确定要给用户 ${targetUsername} 充值 1000 万算力吗？`)) return;
    try {
      const res = await fetchApi(`/v1/admin/users/${targetUsername}/recharge`, { method: 'POST' });
      if (res.ok) {
        alert(`💰 成功给 ${targetUsername} 充值了 1000 万算力！`);
        fetchAdminData(false);
      } else {
        alert("充值失败，请查看后端日志。");
      }
    } catch (e) {
      alert("网络错误");
    }
  };

  // 🆕 邀请码管理状态与函数
  const [inviteCodes, setInviteCodes] = useState<any[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);

  const fetchInviteCodes = async () => {
    setIsLoadingInvites(true);
    try {
      const res = await fetchApi('/v1/admin/invite-codes');
      if (res.ok) {
        const data = await res.json();
        setInviteCodes(data.data || []);
      }
    } catch (e) { /* 静默 */ }
    finally { setIsLoadingInvites(false); }
  };

  const handleGenerateInviteCode = async () => {
    try {
      const res = await fetchApi('/v1/admin/invite-codes/generate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        alert(`邀请码已生成：${data.code}\n\n24小时内有效，仅供一人注册一次。\n\n请将此码发送给需要注册的用户。`);
        fetchInviteCodes();
      } else {
        const err = await res.json();
        alert(err.detail || "生成失败");
      }
    } catch (e) {
      alert("网络错误");
    }
  };

  // 进入Admin页时自动加载邀请码
  React.useEffect(() => {
    if (activeSettingsTab === 'admin' && userRole === 'admin') {
      fetchInviteCodes();
    }
  }, [activeSettingsTab, userRole]);

  // 🆕 API 配置相关状态
  const [apiKey, setApiKey] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [dmxApiKey, setDmxApiKey] = useState("");
  const [dmxBaseUrl, setDmxBaseUrl] = useState("");
  const [isSavingApiConfig, setIsSavingApiConfig] = useState(false);
  // 🆕 折叠/展开状态
  const [showApiSection, setShowApiSection] = useState(false);
  const [showDmxSection, setShowDmxSection] = useState(false);
  // 🆕 Key 掩码可见性
  const [showApiKeyVisible, setShowApiKeyVisible] = useState(false);
  const [showDmxKeyVisible, setShowDmxKeyVisible] = useState(false);
  // 🆕 修改密码折叠
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // 🆕 修改密码状态
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // 🆕 保存 API 配置
  const handleSaveApiConfig = async () => {
    setIsSavingApiConfig(true);
    try {
      const res = await fetchApi('/v1/user/update-api-config', {
        method: 'POST',
        body: JSON.stringify({
          api_key: apiKey.trim(),
          api_base_url: apiBaseUrl.trim(),
          dmx_api_key: dmxApiKey.trim(),
          dmx_base_url: dmxBaseUrl.trim(),
        })
      });
      if (res.ok) {
        alert("API 配置已更新！重新登录后生效。");
      } else {
        const data = await res.json();
        alert(data.error?.message || "保存失败");
      }
    } catch (e) {
      alert("网络错误");
    } finally {
      setIsSavingApiConfig(false);
    }
  };

  // 🆕 修改密码
  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmNewPassword) {
      alert("请填写所有密码字段");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      alert("两次输入的新密码不一致");
      return;
    }
    if (newPassword.length < 4) {
      alert("新密码长度至少 4 位");
      return;
    }
    setIsChangingPassword(true);
    try {
      const res = await fetchApi('/v1/user/change-password', {
        method: 'POST',
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
      });
      if (res.ok) {
        alert("密码修改成功！");
        setOldPassword(""); setNewPassword(""); setConfirmNewPassword("");
      } else {
        const data = await res.json();
        alert(data.error?.message || "密码修改失败");
      }
    } catch (e) {
      alert("网络错误");
    } finally {
      setIsChangingPassword(false);
    }
  };
  // 👆====================================================👆

  if (!isSettingsModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 lg:p-10">
      {/* 极简雾化遮罩 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setIsSettingsModalOpen(false)} />
      
      {/* 🚀 终极黑玻璃弹窗本体 */}
      <div className="relative w-full max-w-6xl bg-black/60 backdrop-blur-3xl border border-white/[0.08] rounded-[32px] shadow-[0_30px_100px_rgba(0,0,0,0.8)] flex overflow-hidden animate-in zoom-in-95 fade-in duration-300 h-[80vh] lg:h-[85vh]">
        
        {/* =======================
            左侧导航栏：纯净无底色
            ======================= */}
        <div className="w-64 bg-transparent border-r border-white/[0.05] flex flex-col p-6 shrink-0 relative z-10">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-6 pl-3">平台设置</div>
          <div className="flex flex-col gap-1.5">
            {[
              { id: 'general', icon: <User size={16} />, label: '通用设置' },
              { id: 'instructions', icon: <Cpu size={16} />, label: '个性化指令' },
              { id: 'parameters', icon: <Sliders size={16} />, label: '模型微调' },
              { id: 'api-config', icon: <Key size={16} />, label: 'API 配置' },
              { id: 'data', icon: <Database size={16} />, label: '数据与存储' },
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => setActiveSettingsTab(tab.id as any)} 
                className={`flex items-center gap-3 px-4 py-3 rounded-[16px] text-[13px] transition-all duration-300 ${
                  activeSettingsTab === tab.id 
                    ? 'bg-white/10 text-white font-medium shadow-[0_0_15px_rgba(255,255,255,0.05)]' 
                    : 'text-zinc-500 hover:bg-white/[0.02] hover:text-zinc-300'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
            
            {userRole === 'admin' && (
              <>
                <div className="my-3 border-t border-white/[0.05]"></div>
                <button 
                  onClick={() => setActiveSettingsTab('admin')} 
                  className={`flex items-center gap-3 px-4 py-3 rounded-[16px] text-[13px] transition-all duration-300 ${
                    activeSettingsTab === 'admin' 
                      ? 'bg-white/10 text-white font-medium shadow-[0_0_15px_rgba(255,255,255,0.05)]' 
                      : 'text-zinc-500 hover:bg-white/[0.02] hover:text-zinc-300'
                  }`}
                >
                  <Shield size={16} /> 用户管理 (Admin)
                </button>
              </>
            )}
          </div>
        </div>

        {/* =======================
            右侧内容区：悬浮黑洞质感
            ======================= */}
        <div className="flex-1 p-8 lg:p-12 overflow-y-auto custom-scrollbar relative bg-transparent z-10">
          
          <button 
            onClick={() => setIsSettingsModalOpen(false)} 
            className="absolute top-8 right-8 p-3 text-zinc-500 hover:text-white bg-white/[0.02] border border-white/[0.05] rounded-full hover:bg-white/10 transition-all hover:scale-110"
          >
            <X size={16} />
          </button>
          
          {activeSettingsTab === 'general' && (
            <div className="space-y-10 max-w-xl animate-in slide-in-from-bottom-4 fade-in duration-500">
              <div>
                <h2 className="text-[28px] font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500 mb-2">通用设置</h2>
                <p className="text-[13px] text-zinc-500 font-light">定制你在工作台中的身份标识与视觉偏好。</p>
              </div>
              
              <div className="space-y-4">
                <label className="text-[11px] font-medium text-zinc-500 tracking-wider uppercase">用户头像</label>
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-[20px] bg-white/[0.02] backdrop-blur-md flex items-center justify-center text-xl font-light text-zinc-300 overflow-hidden border border-white/[0.08] shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                    {settings.avatar.startsWith('data:image') ? <img src={settings.avatar} className="w-full h-full object-cover" /> : settings.avatar || 'YR'}
                  </div>
                  <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
                  <div className="flex gap-3">
                    <button onClick={() => avatarInputRef.current?.click()} className="px-5 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-[13px] text-zinc-300 hover:bg-white/10 hover:text-white transition-all">上传新头像</button>
                    <button onClick={() => setSettings((prev: any) => ({...prev, avatar: 'YR'}))} className="px-5 py-2.5 bg-transparent text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors">恢复默认</button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-medium text-zinc-500 tracking-wider uppercase">用户昵称</label>
                <input 
                  type="text" value={settings.nickname} 
                  onChange={(e) => setSettings((prev: any) => ({...prev, nickname: e.target.value}))} 
                  placeholder="例如：依然开发者" 
                  className="w-full bg-black/40 border border-white/[0.08] rounded-[16px] px-5 py-4 text-[13px] text-zinc-200 placeholder-zinc-600 focus:border-white/30 focus:shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-all outline-none" 
                />
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-medium text-zinc-500 tracking-wider uppercase">UI 主题</label>
                <select disabled className="w-full bg-black/40 border border-white/[0.08] rounded-[16px] px-5 py-4 text-[13px] text-zinc-500 outline-none appearance-none cursor-not-allowed opacity-60">
                  <option>极夜黑 (Deep Aurora Black) - 默认</option>
                </select>
                <p className="text-[11px] text-zinc-600 font-light mt-2 pl-2">浅色主题由于破坏极简通透感，已被引擎永久抛弃。</p>
              </div>
            </div>
          )}

          {activeSettingsTab === 'instructions' && (
            <div className="space-y-10 max-w-2xl animate-in slide-in-from-bottom-4 fade-in duration-500">
              <div>
                <h2 className="text-[28px] font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500 mb-2">个性化指令</h2>
                <p className="text-[13px] text-zinc-500 font-light">为 AI 设定默认的性格、语气或背景知识。</p>
              </div>
              
              <div className="space-y-3">
                <label className="text-[11px] font-medium text-zinc-500 tracking-wider uppercase flex items-center gap-3">
                  全局 System Prompt <span className="bg-white/10 text-white px-2 py-0.5 rounded-[6px] text-[9px] font-bold tracking-widest">GLOBAL</span>
                </label>
                <textarea 
                  value={settings.globalSystemPrompt} onChange={(e) => setSettings((prev: any) => ({...prev, globalSystemPrompt: e.target.value}))} 
                  placeholder="例如：请用简短专业的中文回答，不要说废话..." 
                  className="w-full h-32 bg-black/40 border border-white/[0.08] rounded-[20px] p-5 text-[13px] text-zinc-200 placeholder-zinc-600 focus:border-white/30 focus:shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-all resize-none custom-scrollbar outline-none leading-relaxed" 
                />
              </div>
              
              <div className="w-full h-px bg-white/[0.05] my-2"></div>
              
              <div className="space-y-3">
                <label className="text-[11px] font-medium text-zinc-500 tracking-wider uppercase">特定模型专属 Prompt</label>
                <p className="text-[11px] text-zinc-500 font-light mb-4">如果为特定模型设置了专属 Prompt，它将覆盖全局设置。</p>
                <select 
                  value={selectedPromptModel} onChange={(e) => setSelectedPromptModel(e.target.value)} 
                  className="w-full bg-black/40 border border-white/[0.08] rounded-[16px] px-5 py-4 text-[13px] text-zinc-200 outline-none mb-4 cursor-pointer appearance-none"
                >
                  {MODELS.map(m => <option key={m.id} value={m.id} className="bg-[#121212]">{m.name}</option>)}
                </select>
                <textarea 
                  value={settings.modelSystemPrompts[selectedPromptModel] || ''} 
                  onChange={(e) => setSettings((prev: any) => ({...prev, modelSystemPrompts: {...prev.modelSystemPrompts, [selectedPromptModel]: e.target.value}}))} 
                  placeholder={`为 ${MODELS.find(m => m.id === selectedPromptModel)?.name} 设定专属指令...`} 
                  className="w-full h-32 bg-black/40 border border-white/[0.08] rounded-[20px] p-5 text-[13px] text-zinc-200 placeholder-zinc-600 focus:border-white/30 focus:shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-all resize-none custom-scrollbar outline-none leading-relaxed" 
                />
              </div>
            </div>
          )}

          {activeSettingsTab === 'parameters' && (
            <div className="space-y-12 max-w-xl animate-in slide-in-from-bottom-4 fade-in duration-500">
              <div>
                <h2 className="text-[28px] font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500 mb-2">模型微调 (Parameters)</h2>
                <p className="text-[13px] text-zinc-500 font-light">通过核心参数调整底层大模型的输出倾向与风格。</p>
              </div>

              <div className="space-y-5">
                <div className="flex justify-between items-end">
                  <div>
                    <label className="text-[11px] font-medium text-zinc-500 tracking-wider uppercase">发散度 (Temperature)</label>
                    <p className="text-[11px] text-zinc-600 font-light mt-1.5">控制随机性：0 = 严谨死板，2 = 天马行空。</p>
                  </div>
                  <span className="text-[13px] font-mono font-medium text-white bg-white/10 border border-white/10 px-3 py-1 rounded-[8px] shadow-inner">{settings.temperature.toFixed(1)}</span>
                </div>
                <input 
                  type="range" min="0" max="2" step="0.1" value={settings.temperature} 
                  onChange={(e) => setSettings((prev: any) => ({...prev, temperature: parseFloat(e.target.value)}))} 
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-white cursor-pointer hover:bg-white/20 transition-all" 
                />
              </div>

              <div className="space-y-5">
                <div className="flex justify-between items-end">
                  <div>
                    <label className="text-[11px] font-medium text-zinc-500 tracking-wider uppercase">核心采样 (Top-P)</label>
                    <p className="text-[11px] text-zinc-600 font-light mt-1.5">控制词汇的丰富度与生成的多样性范围。</p>
                  </div>
                  <span className="text-[13px] font-mono font-medium text-white bg-white/10 border border-white/10 px-3 py-1 rounded-[8px] shadow-inner">{settings.topP.toFixed(1)}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" value={settings.topP} 
                  onChange={(e) => setSettings((prev: any) => ({...prev, topP: parseFloat(e.target.value)}))} 
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-white cursor-pointer hover:bg-white/20 transition-all" 
                />
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-medium text-zinc-500 tracking-wider uppercase">最大输出 (Max Tokens)</label>
                <p className="text-[11px] text-zinc-600 font-light mb-3">限制单次回答的最大长度，自定义，不填为默认模型最大值。</p>
                <input 
                  type="number" value={settings.maxTokens} 
                  onChange={(e) => setSettings((prev: any) => ({...prev, maxTokens: e.target.value}))} 
                  placeholder="例如：2048" 
                  className="w-full bg-black/40 border border-white/[0.08] rounded-[16px] px-5 py-4 text-[13px] text-zinc-200 placeholder-zinc-600 focus:border-white/30 focus:shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-all outline-none" 
                />
              </div>
            </div>
          )}

          {/* 🆕 API 配置标签页 */}
          {activeSettingsTab === 'api-config' && (
            <div className="space-y-6 max-w-xl animate-in slide-in-from-bottom-4 fade-in duration-500">
              <div>
                <h2 className="text-[28px] font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500 mb-2">API 配置</h2>
                <p className="text-[13px] text-zinc-500 font-light">配置您的专属 AI API Key 和 Base URL，系统将使用您的 Key 调用上游服务。</p>
              </div>

              {/* 提示：不填Key则无法使用AI */}
              <div className="bg-amber-500/5 border border-amber-500/15 rounded-[20px] p-5">
                <p className="text-[12px] text-amber-400/80 font-light leading-relaxed">
                  如果您未配置 API Key，系统将<strong>无法</strong>为您提供 AI 服务。请填入您在中转站（如 New-API）或官方平台申请的 Key。
                </p>
              </div>

              {/* ===== 折叠块：New-API 配置 ===== */}
              <div className="bg-white/[0.02] border border-white/[0.08] rounded-[20px] overflow-hidden">
                <button
                  onClick={() => { setShowApiSection(!showApiSection); }}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare size={14} className="text-zinc-400" />
                    <div className="text-left">
                      <span className="text-[13px] font-medium text-zinc-200">New-API（聊天 / 生图 / 工作流）</span>
                      <p className="text-[10px] text-zinc-500 font-light mt-0.5">
                        {apiKey ? '已配置 Key' : '尚未配置'}
                      </p>
                    </div>
                  </div>
                  <ChevronDown size={16} className={`text-zinc-500 transition-transform duration-300 ${showApiSection ? 'rotate-180' : ''}`} />
                </button>
                {showApiSection && (
                  <div className="px-5 pb-5 space-y-3 border-t border-white/[0.05] pt-4">
                    <div>
                      <label className="text-[10px] font-medium text-zinc-500 tracking-wider uppercase mb-1.5 block">API Key</label>
                      <div className="relative">
                        <input 
                          type={showApiKeyVisible ? "text" : "password"}
                          value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                          placeholder="sk-xxx..."
                          autoComplete="off"
                          onCopy={(e) => e.preventDefault()}
                          onCut={(e) => e.preventDefault()}
                          onContextMenu={(e) => e.preventDefault()}
                          onDragStart={(e) => e.preventDefault()}
                          style={{ userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
                          className="w-full bg-black/40 border border-white/[0.08] rounded-[14px] px-4 py-3 pr-10 text-[13px] text-zinc-200 placeholder-zinc-600 focus:border-white/30 transition-all outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKeyVisible(!showApiKeyVisible)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          {showApiKeyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-zinc-500 tracking-wider uppercase mb-1.5 block">Base URL</label>
                      <input 
                        type="text" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)}
                        placeholder="https://您的中转站地址"
                        className="w-full bg-black/40 border border-white/[0.08] rounded-[14px] px-4 py-3 text-[13px] text-zinc-200 placeholder-zinc-600 focus:border-white/30 transition-all outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ===== 折叠块：DMX API 配置 ===== */}
              <div className="bg-white/[0.02] border border-white/[0.08] rounded-[20px] overflow-hidden">
                <button
                  onClick={() => { setShowDmxSection(!showDmxSection); }}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Film size={14} className="text-zinc-400" />
                    <div className="text-left">
                      <span className="text-[13px] font-medium text-zinc-200">DMX API（视频生成）</span>
                      <p className="text-[10px] text-zinc-500 font-light mt-0.5">
                        {dmxApiKey ? '已配置 Key' : '尚未配置'}
                      </p>
                    </div>
                  </div>
                  <ChevronDown size={16} className={`text-zinc-500 transition-transform duration-300 ${showDmxSection ? 'rotate-180' : ''}`} />
                </button>
                {showDmxSection && (
                  <div className="px-5 pb-5 space-y-3 border-t border-white/[0.05] pt-4">
                    <div>
                      <label className="text-[10px] font-medium text-zinc-500 tracking-wider uppercase mb-1.5 block">DMX API Key</label>
                      <div className="relative">
                        <input 
                          type={showDmxKeyVisible ? "text" : "password"}
                          value={dmxApiKey} onChange={(e) => setDmxApiKey(e.target.value)}
                          placeholder="视频 Key（选填）"
                          autoComplete="off"
                          onCopy={(e) => e.preventDefault()}
                          onCut={(e) => e.preventDefault()}
                          onContextMenu={(e) => e.preventDefault()}
                          onDragStart={(e) => e.preventDefault()}
                          style={{ userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
                          className="w-full bg-black/40 border border-white/[0.08] rounded-[14px] px-4 py-3 pr-10 text-[13px] text-zinc-200 placeholder-zinc-600 focus:border-white/30 transition-all outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowDmxKeyVisible(!showDmxKeyVisible)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          {showDmxKeyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-zinc-500 tracking-wider uppercase mb-1.5 block">DMX Base URL</label>
                      <input 
                        type="text" value={dmxBaseUrl} onChange={(e) => setDmxBaseUrl(e.target.value)}
                        placeholder="视频 API 地址（选填）"
                        className="w-full bg-black/40 border border-white/[0.08] rounded-[14px] px-4 py-3 text-[13px] text-zinc-200 placeholder-zinc-600 focus:border-white/30 transition-all outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 保存按钮 */}
              <button 
                onClick={handleSaveApiConfig} 
                disabled={isSavingApiConfig}
                className="w-full py-4 bg-white text-black hover:bg-zinc-200 rounded-2xl text-[14px] font-bold shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSavingApiConfig ? <Loader2 size={16} className="animate-spin" /> : null}
                {isSavingApiConfig ? "保存中..." : "保存 API 配置"}
              </button>
            </div>
          )}

          {activeSettingsTab === 'data' && (
            <div className="space-y-8 max-w-xl animate-in slide-in-from-bottom-4 fade-in duration-500">
              <div>
                <h2 className="text-[28px] font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500 mb-2">数据与存储</h2>
                <p className="text-[13px] text-zinc-500 font-light">管理存储在本地浏览器中的所有对话与生成记录。</p>
              </div>

              {/* 🆕 修改密码（可折叠） */}
              <div className="bg-white/[0.02] border border-white/[0.08] rounded-[20px] overflow-hidden">
                <button
                  onClick={() => { setShowPasswordSection(!showPasswordSection); setOldPassword(""); setNewPassword(""); setConfirmNewPassword(""); }}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Lock size={14} className="text-zinc-400" />
                    <span className="text-[13px] font-medium text-zinc-200">修改密码</span>
                  </div>
                  <ChevronDown size={16} className={`text-zinc-500 transition-transform duration-300 ${showPasswordSection ? 'rotate-180' : ''}`} />
                </button>
                {showPasswordSection && (
                  <div className="px-5 pb-5 space-y-3 border-t border-white/[0.05] pt-4">
                    <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="当前密码" className="w-full bg-black/40 border border-white/[0.08] rounded-[14px] px-4 py-3 text-[13px] text-zinc-200 placeholder-zinc-600 focus:border-white/30 transition-all outline-none" />
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="新密码（至少4位）" className="w-full bg-black/40 border border-white/[0.08] rounded-[14px] px-4 py-3 text-[13px] text-zinc-200 placeholder-zinc-600 focus:border-white/30 transition-all outline-none" />
                    <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="确认新密码" className="w-full bg-black/40 border border-white/[0.08] rounded-[14px] px-4 py-3 text-[13px] text-zinc-200 placeholder-zinc-600 focus:border-white/30 transition-all outline-none" />
                    <button onClick={handleChangePassword} disabled={isChangingPassword}
                      className="flex items-center justify-center gap-2 w-full py-3 bg-white/[0.05] hover:bg-white/10 border border-white/[0.08] text-zinc-300 rounded-[14px] text-[13px] font-medium transition-all disabled:opacity-50">
                      {isChangingPassword ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                      {isChangingPassword ? "修改中..." : "确认修改"}
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white/[0.02] border border-white/[0.08] rounded-[24px] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
                <div>
                  <h3 className="text-[14px] font-medium text-zinc-200">导出所有记录</h3>
                  <p className="text-[11px] text-zinc-500 font-light mt-1.5">一键将对话、图片、视频历史导出为 JSON 文件。</p>
                </div>
                <button onClick={handleExportData} className="flex items-center gap-2 px-5 py-3 bg-white text-black hover:scale-105 text-[13px] font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] shrink-0">
                  <Download size={16} /> 立即导出
                </button>
              </div>
              
              <div className="bg-red-500/5 border border-red-500/20 rounded-[24px] p-6 shadow-lg">
                <h3 className="text-[14px] font-medium text-red-400">危险操作</h3>
                <p className="text-[11px] text-red-400/60 font-light mt-1.5 mb-6">退出登录将清除当前浏览器中的所有数据记录（包括对话和配置），此操作不可逆。</p>
                <button onClick={handleLogout} className="flex items-center justify-center w-full sm:w-auto gap-2 px-5 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] text-[13px] font-bold rounded-xl transition-all">
                  <LogOut size={16} /> 退出登录并清空
                </button>
              </div>
            </div>
          )}

          {activeSettingsTab === 'admin' && userRole === 'admin' && (
            <div className="space-y-8 max-w-5xl w-full pb-10 animate-in slide-in-from-bottom-4 fade-in duration-500">
              <div className="flex justify-between items-end border-b border-white/[0.05] pb-6">
                <div>
                  <h2 className="text-[28px] font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 flex items-center gap-3">
                    <Shield className="text-zinc-300" size={24} /> Admin 大屏
                  </h2>
                  <p className="text-[13px] text-zinc-500 font-light mt-2">实时监控全站算力流转与节点在线状态</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.02] border border-white/[0.05] rounded-full text-[11px] text-zinc-400 shadow-inner">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-300"></span>
                    </span>
                    数据已链接
                  </div>
                  <button onClick={() => fetchAdminData(false)} className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/10 border border-white/[0.08] rounded-[12px] text-[12px] font-medium transition-colors text-zinc-300">
                    <RotateCcw size={14} /> 强制刷新
                  </button>
                </div>
              </div>

              {isAdminLoading ? (
                 <div className="flex flex-col items-center justify-center py-32 opacity-50">
                   <Loader2 className="animate-spin text-white mb-4" size={32} />
                   <span className="text-xs font-mono tracking-widest uppercase text-zinc-500">Fetching Nodes...</span>
                 </div>
              ) : (
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-[24px] overflow-hidden shadow-2xl backdrop-blur-md">
                  <table className="w-full text-left text-[13px] text-zinc-300">
                    <thead className="bg-transparent border-b border-white/[0.05] text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
                      <tr>
                        <th className="px-6 py-5 font-medium">用户节点</th>
                        <th className="px-6 py-5 font-medium">系统角色</th>
                        <th className="px-6 py-5 font-medium">状态</th>
                        <th className="px-6 py-5 font-medium">算力池 / 消耗</th>
                        <th className="px-6 py-5 font-medium">最后上线</th>
                        <th className="px-6 py-5 font-medium text-right">终端操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                      {adminUsers.map((u, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="px-6 py-4 font-bold text-white tracking-wide">{u.username}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-[6px] text-[9px] font-bold tracking-widest border ${u.role === 'admin' ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/10 text-zinc-500'}`}>
                              {u.role.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <CircleDot size={10} className={u.online ? "text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]" : "text-zinc-700"} />
                              <span className={`text-[11px] font-mono ${u.online ? "text-zinc-200" : "text-zinc-600"}`}>{u.online ? "ONLINE" : "OFFLINE"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-mono text-[13px] font-bold text-zinc-200">{u.token_balance?.toLocaleString() || 0}</span>
                              <span className="font-mono text-[10px] text-zinc-600 line-through mt-0.5">{u.tokens_used?.toLocaleString() || 0}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[11px] text-zinc-500 font-mono tracking-wide">{u.last_login}</td>
                          <td className="px-6 py-4 text-right flex items-center justify-end gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleViewUserChats(u.username)} className="p-2 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 rounded-[10px] transition-all" title="查看数据库"><MessageSquare size={14} /></button>
                            <button onClick={() => setSelectedUser(u)} className="p-2 bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 rounded-[10px] transition-all" title="配置权限"><Settings size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 🆕 邀请码管理 */}
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-[24px] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-[14px] font-medium text-white flex items-center gap-2">
                      <Key size={14} className="text-zinc-400" /> 邀请码管理
                    </h3>
                    <p className="text-[11px] text-zinc-500 font-light mt-1">生成一次性邀请码（24小时有效，用后即焚）。</p>
                  </div>
                  <button
                    onClick={handleGenerateInviteCode}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white text-black hover:bg-zinc-200 rounded-xl text-[12px] font-bold transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                  >
                    <Plus size={14} /> 生成邀请码
                  </button>
                </div>

                {isLoadingInvites ? (
                  <div className="flex items-center justify-center py-8 opacity-50">
                    <Loader2 className="animate-spin text-white" size={20} />
                  </div>
                ) : inviteCodes.length === 0 ? (
                  <p className="text-[12px] text-zinc-600 font-light text-center py-6">暂无邀请码，点击上方按钮生成</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {inviteCodes.map((c, i) => (
                      <div key={i} className={`flex items-center justify-between px-4 py-3 rounded-xl border text-[12px] ${c.is_used ? 'bg-zinc-800/30 border-white/[0.03]' : c.is_expired ? 'bg-red-500/5 border-red-500/10' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                        <div className="flex items-center gap-3">
                          <span className={`font-mono text-[13px] font-bold tracking-wide ${c.is_used ? 'text-zinc-500 line-through' : c.is_expired ? 'text-red-400' : 'text-green-400'}`}>
                            {c.code}
                          </span>
                          {c.is_used ? (
                            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                              <Check size={10} /> 已被 {c.used_by} 使用
                            </span>
                          ) : c.is_expired ? (
                            <span className="flex items-center gap-1 text-[10px] text-red-400">
                              <AlertCircle size={10} /> 已过期
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] text-green-400/60">
                              <Clock size={10} /> {Math.floor(c.expires_in_seconds / 3600)}h {Math.floor((c.expires_in_seconds % 3600) / 60)}m 后过期
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(c.code);
                            alert(`已复制邀请码：${c.code}`);
                          }}
                          disabled={c.is_used || c.is_expired}
                          className="flex items-center gap-1 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/10 border border-white/[0.06] rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Copy size={10} /> 复制
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedUser && (
                <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedUser(null)} />
                  <div className="relative w-full max-w-sm bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 z-10 shadow-[0_30px_100px_rgba(0,0,0,0.9)] animate-in zoom-in-95">
                    <div className="flex justify-between items-start mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[16px] bg-white/5 border border-white/10 flex items-center justify-center text-white text-2xl font-light shadow-inner">
                          {selectedUser.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white tracking-wide">{selectedUser.username}</h3>
                          <span className="text-[9px] text-zinc-400 font-mono uppercase border border-white/10 px-2 py-0.5 rounded-[6px] mt-1.5 inline-block">{selectedUser.role}</span>
                        </div>
                      </div>
                      <button onClick={() => setSelectedUser(null)} className="text-zinc-500 hover:text-white bg-white/5 border border-white/10 p-2 rounded-full transition-all hover:scale-110"><X size={14}/></button>
                    </div>
                    
                    <div className="space-y-3 mb-8">
                      <div className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/[0.05] rounded-[16px]">
                        <span className="text-[12px] text-zinc-500 font-medium uppercase tracking-wider">剩余算力</span>
                        <span className="text-lg font-bold text-white font-mono">{selectedUser.token_balance?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/[0.05] rounded-[16px]">
                        <span className="text-[12px] text-zinc-500 font-medium uppercase tracking-wider">历史消耗</span>
                        <span className="text-[13px] text-zinc-600 font-mono line-through">{selectedUser.tokens_used?.toLocaleString() || 0}</span>
                      </div>
                    </div>

                    <div className="mb-8">
                      <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 pl-1">引擎访问授权</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { key: 'allow_chat', label: '智能对话', icon: <MessageSquare size={14}/> },
                          { key: 'allow_image', label: '图像生成', icon: <ImageIcon size={14}/> },
                          { key: 'allow_video', label: '视频创作', icon: <Film size={14}/> },
                          { key: 'allow_workflow', label: '工作流引擎', icon: <Puzzle size={14}/> },
                        ].map(perm => (
                          <div key={perm.key} className="flex flex-col gap-3 p-4 bg-black/40 border border-white/[0.08] rounded-[20px]">
                            <span className="text-[11px] text-zinc-400 flex items-center gap-2 font-medium tracking-wide">{perm.icon} {perm.label}</span>
                            <button 
                              onClick={() => handleAdminUserAction(selectedUser.username, 'update_permission', { perm_type: perm.key, perm_value: !selectedUser[perm.key] })}
                              className={`w-10 h-6 rounded-full relative transition-colors duration-300 ${selectedUser[perm.key] ? 'bg-white' : 'bg-white/10'}`}
                            >
                              <div className={`absolute top-[2px] left-[2px] w-5 h-5 rounded-full transition-transform duration-300 shadow-sm ${selectedUser[perm.key] ? 'translate-x-4 bg-black' : 'translate-x-0 bg-zinc-500'}`}></div>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      {/* 👇 这里完美替换为了 selectedUser.username，并且我帮你优化了极简白UI！ */}
                      <button 
                        onClick={() => handleAdminRecharge(selectedUser.username)} 
                        className="w-full py-3.5 bg-white text-black hover:bg-zinc-200 rounded-[16px] text-[13px] font-bold shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all flex items-center justify-center gap-2"
                      >
                        💰 强制注资 1000 万
                      </button>

                      <div className="flex gap-3">
                        <button onClick={() => handleAdminUserAction(selectedUser.username, 'reset_tokens')} className="flex-1 py-3 bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.05] text-zinc-300 rounded-[16px] text-[12px] font-medium transition-all">
                          清零消耗
                        </button>
                        <button onClick={() => handleAdminUserAction(selectedUser.username, 'kick')} className="flex-1 py-3 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 text-red-400 rounded-[16px] text-[12px] font-medium transition-all">
                          强制阻断
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}