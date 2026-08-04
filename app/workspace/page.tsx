"use client";
import dynamic from "next/dynamic";

// 整个 workspace SPA 用 ssr: false 懒加载，彻底绕过 452KB 的 SSR JSON 解析崩溃
const WorkspaceApp = dynamic(() => import("./WorkspaceApp"), {
  ssr: false,
  loading: () => (
    <div className="h-screen bg-[#020203] flex items-center justify-center">
      <span className="text-zinc-600 font-mono text-sm tracking-[0.2em] animate-pulse">Loading...</span>
    </div>
  ),
});

export default function WorkspacePage() {
  return <WorkspaceApp />;
}
