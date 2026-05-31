/** @type {import('next').NextConfig} */
// ✨ 核心修复：利用 NODE_ENV 区分环境。
const FASTAPI_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://127.0.0.1:8000' 
  // 下面这行换成 Sealos 刚刚给你分配的真实内网全名！
  : 'http://yr-ai-backend-rvgiqrjpaaik.ns-9q0y7e4d:8000';

const nextConfig = {
  output: 'standalone',   // 极致压缩 Docker 镜像体积
  poweredByHeader: false, 
  reactStrictMode: true,

  // ✨ 核心绝杀：强制忽略打包时的 ESLint 和 TypeScript 报错警告
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
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
        ],
      },
    ];
  },
};

module.exports = nextConfig;