/** @type {import('next').NextConfig} */

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || 'http://127.0.0.1:8000';

const nextConfig = {
  poweredByHeader: false, // 去掉 X-Powered-By: Next.js

  reactStrictMode: true,

  async rewrites() {
    return [
      {
        // 前端请求这个地址：
        // fetch('/api/chat/completions')
        // Next.js 会在服务端转发到你的 FastAPI：
        // {FASTAPI_BASE_URL}/v1/chat/completions
        source: '/api/chat/completions',
        destination: `${FASTAPI_BASE_URL}/v1/chat/completions`,
      },
    ];
  },

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
