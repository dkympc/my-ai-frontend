// components/modals/FilePreviewModal.tsx
"use client";
import React from 'react';
import { FileText, Download, X } from 'lucide-react';

interface FilePreviewModalProps {
  previewFileContent: { name: string; content: string } | null;
  setPreviewFileContent: (val: { name: string; content: string } | null) => void;
}

export default function FilePreviewModal({ previewFileContent, setPreviewFileContent }: FilePreviewModalProps) {
  if (!previewFileContent) return null;

  return (
    <div className="fixed inset-0 z-[200000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setPreviewFileContent(null)} />
      <div className="relative w-full max-w-3xl bg-[#171717] border border-white/10 rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 fade-in duration-200 h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/[0.04] rounded-lg flex items-center justify-center text-zinc-400">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">{previewFileContent.name}</h3>
              <p className="text-[10px] text-zinc-500 font-mono">从附件中智能提取的文本内容</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const blob = new Blob([previewFileContent.content], { type: 'text/plain;charset=utf-8' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `提取内容_${previewFileContent.name}.txt`;
                link.click();
              }} 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-lg transition-all text-xs font-medium"
            >
              <Download size={14} /> 另存为 TXT
            </button>
            <button onClick={() => setPreviewFileContent(null)} className="p-1.5 text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-[#121212] custom-scrollbar">
          <div className="max-w-2xl mx-auto bg-[#1e1e1e] border border-white/5 rounded-xl p-6 shadow-xl">
            <pre className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
              {previewFileContent.content}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}