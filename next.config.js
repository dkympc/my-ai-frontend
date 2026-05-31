/** @type {import('next').NextConfig} */

// 这里用 FASTAPI_BASE_URL，方便以后在 Sealos 上通过环境变量注入内网地址
const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || 'http://127.0.0.1:8000';

const nextConfig = {
  output: 'standalone',   // 💡 新增：极致压缩 Docker 镜像体积，云原生部署必备
  poweredByHeader: false, // 保持：去掉 X-Powered-By: Next.js
  reactStrictMode: true,

  async rewrites() {
    return [
      {
        // 🚨 核心修改：拦截前端所有发往 /v1/ 开头的请求
        // 包括 /v1/login, /v1/chat/completions，以及获取图片的 /v1/static/media/...
        // 全部在服务端静默转发给 FastAPI 后端
        source: '/v1/:path*',
        destination: `${FASTAPI_BASE_URL}/v1/:path*`,
      },
    ];
  },

  // 👇 你的安全头配置，一行都不动，完美保留！
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'no-referrer',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;