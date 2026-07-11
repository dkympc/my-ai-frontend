// components/modals/DeleteConfirmModal.tsx
"use client";
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  isDeleteModalOpen: boolean;
  setIsDeleteModalOpen: (val: boolean) => void;
  confirmDelete: () => void;
}

export default function DeleteConfirmModal({ isDeleteModalOpen, setIsDeleteModalOpen, confirmDelete }: DeleteConfirmModalProps) {
  if (!isDeleteModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsDeleteModalOpen(false)} />
      <div className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500"><AlertTriangle size={24} /></div>
          <div><h3 className="text-lg font-bold text-zinc-100">确认删除对话？</h3><p className="text-sm text-zinc-500 leading-relaxed">此操作不可撤销，该对话的所有记录都将从本地丢失。</p></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors text-sm">取消</button>
          <button onClick={confirmDelete} className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors shadow-lg shadow-red-500/20 text-sm">确认删除</button>
        </div>
        <button onClick={() => setIsDeleteModalOpen(false)} className="absolute top-4 right-4 p-1 text-zinc-500 hover:text-zinc-200 transition-colors"><X size={18} /></button>
      </div>
    </div>
  );
}