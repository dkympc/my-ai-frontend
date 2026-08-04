/** @type {import('next').NextConfig} */
// ✨ 核心修复：利用 NODE_ENV 区分环境。
const FASTAPI_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://127.0.0.1:8000' 
  // 下面这行换成 Sealos 刚刚给你分配的真实内网全名！
  : 'http://49.232.57.73:8000';

const nextConfig = {
  poweredByHeader: false, 
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  
  // 👇 代理超时对齐后端 httpx read 超时（900s），防裂变分镜长流式响应被 Next.js 代理层截断
  experimental: {
    proxyTimeout: 900000, // 15 分钟（后端 read 超时也为 900s，前端 AbortController 为 8 分钟）
  },

  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: `${FASTAPI_BASE_URL}/v1/:path*`,
      },
    ];
  },
  
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Accel-Buffering', value: 'no' } // ✨ 核心魔法：强制命令最外层 Nginx 也放弃缓冲！
        ],
      },
    ];
  },
};

module.exports = nextConfig;
