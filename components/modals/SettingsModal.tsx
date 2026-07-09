import React from 'react';
import { 
  X, User, Cpu, Sliders, Database, Shield, RotateCcw, 
  Loader2, CircleDot, MessageSquare, Settings, 
  Image as ImageIcon, Film, Puzzle, Download, LogOut 
} from 'lucide-react';
import { MODELS } from '@/lib/constants';

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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/v1/admin/users/${targetUsername}/recharge`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('yr-ai-token')}` }
      });
      if (res.ok) {
        alert(`💰 成功给 ${targetUsername} 充值了 1000 万算力！`);
        // 充值成功后，自动静默刷新大屏数据，让数字立刻变大！
        fetchAdminData(false); 
      } else {
        alert("充值失败，请查看后端日志。");
      }
    } catch (e) {
      alert("网络错误");
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

          {activeSettingsTab === 'data' && (
            <div className="space-y-8 max-w-xl animate-in slide-in-from-bottom-4 fade-in duration-500">
              <div>
                <h2 className="text-[28px] font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500 mb-2">数据与存储</h2>
                <p className="text-[13px] text-zinc-500 font-light">管理存储在本地浏览器中的所有对话与生成记录。</p>
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