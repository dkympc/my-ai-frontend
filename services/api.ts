// /services/api.ts
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

// 定义配置项，支持传入原生 fetch 的所有参数
interface FetchOptions extends RequestInit {
  requireAuth?: boolean; // 是否需要带上 Token，默认 true
  useApiRoute?: boolean; // ★ 新增：为 true 时走 Next.js API Route（绕开 async rewrites 代理缓冲）
}

export async function fetchApi(endpoint: string, options: FetchOptions = {}) {
  const { requireAuth = true, useApiRoute = false, ...customConfig } = options;
  
  // ★ 如果 useApiRoute，路径改为 /api/...（去掉 /v1 前缀，对应 Next.js API Route 路径）
  const url = useApiRoute ? `/api${endpoint.replace(/^\/v1/, '')}` : `${API_BASE}${endpoint}`;

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
    const response = await fetch(url, config);
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