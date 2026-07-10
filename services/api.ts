// /services/api.ts
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

// 定义配置项，支持传入原生 fetch 的所有参数
interface FetchOptions extends RequestInit {
  requireAuth?: boolean; // 是否需要带上 Token，默认 true
}

export async function fetchApi(endpoint: string, options: FetchOptions = {}) {
  const { requireAuth = true, ...customConfig } = options;
  
  // 1. 组装请求头
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customConfig.headers,
  };

  if (requireAuth) {
    const token = localStorage.getItem('yr-ai-token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const config: RequestInit = {
    ...customConfig,
    headers,
  };

  try {
    // 2. 发起真实请求
    const response = await fetch(`${API_BASE}${endpoint}`, config);

    // 3. 全局拦截异常状态码 (统一海关处理)
    // 🚨 401 只在已登录状态下才触发重载（排除登录接口本身的 401）
    if (response.status === 401 && requireAuth) {
      localStorage.removeItem('yr-ai-token');
      localStorage.removeItem('yr-ai-role');
      useAuthStore.getState().setIsAuthenticated(false);
      window.location.reload();
      throw new Error("Unauthorized");
    }

    if (response.status === 402) {
      // 捕获 JSON 解析错误，防止后端返回纯文本导致前端崩溃
      let err;
      try { err = await response.json(); } catch { err = { detail: "余额不足" }; }
      useAppStore.getState().setOutOfBalanceMsg(err.detail || "余额不足");
      throw new Error("Insufficient Balance");
    }

    if (response.status === 403) {
      let err;
      try { err = await response.json(); } catch { err = { detail: "无权限" }; }
      useAppStore.getState().setToastMsg(err.detail || "无权限");
      throw new Error("Forbidden");
    }

    return response;
  } catch (error) {
    console.error("API 请求异常:", error);
    throw error;
  }
}