// lib/dialogStore.ts
// ★ 统一弹窗状态机 — 替代浏览器原生 alert / confirm / prompt
// 提供命令式 API（showConfirm / showPrompt / showMessage），无需 React 上下文
"use client";
import { create } from 'zustand';

interface DialogState {
  // 当前弹窗类型与开关
  type: 'confirm' | 'prompt' | 'message' | null;
  open: boolean;

  // ConfirmDialog 参数
  confirmTitle: string;
  confirmMessage: string;
  confirmVariant: 'danger' | 'default';

  // PromptDialog 参数
  promptTitle: string;
  promptDefaultValue: string;

  // MessageDialog 参数
  messageTitle: string;
  messageContent: string;

  // Promise resolvers — 每个弹窗关闭时调用对应的 resolver
  resolveConfirm: ((value: boolean) => void) | null;
  resolvePrompt: ((value: string | null) => void) | null;
  resolveMessage: (() => void) | null;

  // ★ 命令式 API（可在任意文件中直接 import 调用）
  showConfirm: (title: string, message: string, variant?: 'danger' | 'default') => Promise<boolean>;
  showPrompt: (title: string, defaultValue?: string) => Promise<string | null>;
  showMessage: (title: string, content: string) => Promise<void>;

  // 关闭弹窗（×按钮 / 点击遮罩）
  closeDialog: () => void;
}

export const useDialogStore = create<DialogState>((set, get) => ({
  type: null,
  open: false,
  confirmTitle: '',
  confirmMessage: '',
  confirmVariant: 'default',
  promptTitle: '',
  promptDefaultValue: '',
  messageTitle: '',
  messageContent: '',
  resolveConfirm: null,
  resolvePrompt: null,
  resolveMessage: null,

  // ─── Confirm ─────────────────────────────────────
  showConfirm: (title, message, variant = 'default') => {
    return new Promise<boolean>((resolve) => {
      set({
        open: true,
        type: 'confirm',
        confirmTitle: title,
        confirmMessage: message,
        confirmVariant: variant,
        resolveConfirm: resolve,
      });
    });
  },

  // ─── Prompt ──────────────────────────────────────
  showPrompt: (title, defaultValue = '') => {
    return new Promise<string | null>((resolve) => {
      set({
        open: true,
        type: 'prompt',
        promptTitle: title,
        promptDefaultValue: defaultValue,
        resolvePrompt: resolve,
      });
    });
  },

  // ─── Message ─────────────────────────────────────
  showMessage: (title, content) => {
    return new Promise<void>((resolve) => {
      set({
        open: true,
        type: 'message',
        messageTitle: title,
        messageContent: content,
        resolveMessage: resolve,
      });
    });
  },

  // ─── 关闭 ────────────────────────────────────────
  closeDialog: () => {
    const { type, resolveConfirm, resolvePrompt, resolveMessage } = get();
    // 先清状态，再决议（防止决议回调中再次触发状态读取死循环）
    set({
      open: false,
      type: null,
      resolveConfirm: null,
      resolvePrompt: null,
      resolveMessage: null,
    });
    if (type === 'confirm' && resolveConfirm) resolveConfirm(false);
    else if (type === 'prompt' && resolvePrompt) resolvePrompt(null);
    else if (type === 'message' && resolveMessage) resolveMessage();
  },
}));

// ★ 便捷导出：非 React 组件中可直接 import 使用（如 hooks、utils）
export const showConfirm = (title: string, message: string, variant?: 'danger' | 'default') =>
  useDialogStore.getState().showConfirm(title, message, variant);

export const showPrompt = (title: string, defaultValue?: string) =>
  useDialogStore.getState().showPrompt(title, defaultValue);

export const showMessage = (title: string, content: string) =>
  useDialogStore.getState().showMessage(title, content);
