/** @type {import('next').NextConfig} */
// ✨ 核心修复：利用 NODE_ENV 区分环境。
const FASTAPI_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://127.0.0.1:8000' 
  // 下面这行换成 Sealos 刚刚给你分配的真实内网全名！
  : 'http://49.232.57.73:8000';

const nextConfig = {
  output: 'standalone',
  poweredByHeader: false, 
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  
  // 👇 加入这块实验性配置，解除代理超时限制！
  experimental: {
    proxyTimeout: 300000, // 设置 rewrites 代理超时时间为 300 秒（5分钟）
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
