import React from 'react';
import { Search, X, MessageSquare } from 'lucide-react';

interface SearchModalProps {
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: (val: boolean) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  searchResults: any[];
  setCurrentSessionId: (id: string) => void;
  setActiveView: (view: string) => void;
}

export default function SearchModal({
  isSearchModalOpen,
  setIsSearchModalOpen,
  searchQuery,
  setSearchQuery,
  searchResults,
  setCurrentSessionId,
  setActiveView
}: SearchModalProps) {
  if (!isSearchModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-[15vh] p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsSearchModalOpen(false)} />
      <div className="relative w-full max-w-2xl bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 fade-in duration-200 max-h-[70vh] overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-white/5 bg-white/[0.02]">
          <Search size={20} className="text-zinc-400" />
          <input autoFocus type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索历史对话的标题或内容..." className="flex-1 bg-transparent border-none outline-none text-zinc-200 placeholder-zinc-600 text-base" />
          <button onClick={() => setIsSearchModalOpen(false)} className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/10 transition-colors rounded-lg"><X size={18} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-[#171717]">
          {!searchQuery.trim() ? (
            <div className="p-10 text-center text-zinc-600 text-sm flex flex-col items-center gap-3"><Search size={32} className="text-zinc-700 opacity-50" /><span>输入关键词，快速定位历史记录</span></div>
          ) : searchResults.length === 0 ? (
            <div className="p-10 text-center text-zinc-600 text-sm">未找到与 <span className="text-zinc-300 font-medium">"{searchQuery}"</span> 相关的记录</div>
          ) : (
            <div className="space-y-1">
              {searchResults.map((result: any) => (
                <div key={result.id} onClick={() => { setCurrentSessionId(result.id); setActiveView('chat'); setIsSearchModalOpen(false); setSearchQuery(""); }} className="group cursor-pointer p-3.5 rounded-xl hover:bg-white/5 transition-all flex flex-col gap-2">
                  <div className="flex items-center justify-between"><div className="flex items-center gap-2.5 text-zinc-200 font-medium text-sm"><MessageSquare size={16} className="text-zinc-400 opacity-60" /><span>{result.title}</span></div><div className="text-[10px] text-zinc-600 font-mono">{new Date(result.updatedAt).toLocaleDateString()}</div></div>
                  {result.snippet && <div className="text-xs text-zinc-500 pl-7 line-clamp-1 leading-relaxed">{result.snippet}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}