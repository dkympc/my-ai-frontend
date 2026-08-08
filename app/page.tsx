"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clapperboard, Layers, Sparkles, Image, Video, MessageSquare,
  Puzzle, Zap, Globe, GitBranch, Cpu, ArrowRight, Star
} from "lucide-react";

const SECTIONS = ["hero", "s1", "s2", "s3", "s4", "s5", "s6"] as const;

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isClient, setIsClient] = useState(false); // ★ SSR 水合保护：等客户端挂载后才渲染登录相关 UI
  const [activeSection, setActiveSection] = useState<string>("hero");
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    setIsClient(true);
    setIsLoggedIn(!!localStorage.getItem("yr-ai-token"));
  }, []);

  // ★ IntersectionObserver：检测当前处于视口的 section，驱动圆点高亮 + 入场动画
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        let topMost = "";
        let topRatio = 0;
        // 找出视口中占比最大的 section 作为"当前"
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > topRatio) {
            topRatio = entry.intersectionRatio;
            topMost = entry.target.dataset.section || "";
          }
          // ★ 入场动画：进入视口加 visible 类，离开视口移除，保证每次进入都重播动画
          if (entry.isIntersecting) {
            entry.target.classList.add("section-visible");
          } else {
            entry.target.classList.remove("section-visible");
          }
        });
        if (topMost) setActiveSection(topMost);
      },
      { threshold: [0.2, 0.5, 0.8], rootMargin: "0px" }
    );

    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // ★ 注册 section ref
  const setSectionRef = useCallback((key: string, el: HTMLElement | null) => {
    if (el) sectionRefs.current.set(key, el);
  }, []);

  // ★ 点击圆点平滑跳转到对应 section
  const scrollToSection = (key: string) => {
    const el = sectionRefs.current.get(key);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  // ★ 滚轮劫持：一次滚轮 = 自动跳转到下一屏/上一屏（cdDown 防连跳）
  const cdDownRef = useRef(false);
  const activeIdxRef = useRef(0);
  useEffect(() => {
    activeIdxRef.current = SECTIONS.indexOf(activeSection as any);
  }, [activeSection]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (cdDownRef.current) return; // 冷却中，吞掉滚轮
      cdDownRef.current = true;
      setTimeout(() => { cdDownRef.current = false; }, 800);

      const dir = e.deltaY > 0 ? 1 : -1;
      const idx = activeIdxRef.current;
      const next = Math.max(0, Math.min(SECTIONS.length - 1, idx + dir));
      if (next === idx) return;
      scrollToSection(SECTIONS[next]);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div className="relative bg-[#010108] text-zinc-200 font-sans antialiased overflow-x-hidden selection:bg-white/10">

      {/* ==================== 全局样式 ==================== */}
      <style jsx global>{`
        /* ★ scroll-snap：强制全屏吸附 */
        html {
          scroll-snap-type: y mandatory;
          scroll-behavior: smooth;
        }
        .snap-section {
          scroll-snap-align: start;
        }

        /* ★ 入场动画：内容默认隐藏，section-visible 时渐现滑入 */
        .section-reveal {
          opacity: 0;
          transform: translateY(60px);
          filter: blur(4px);
          transition: opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.9s cubic-bezier(0.16, 1, 0.3, 1),
                      filter 0.7s ease-out;
        }
        .section-visible .section-reveal {
          opacity: 1;
          transform: translateY(0);
          filter: blur(0);
        }
        .section-reveal-d1 { transition-delay: 0.1s; }
        .section-reveal-d2 { transition-delay: 0.25s; }
        .section-reveal-d3 { transition-delay: 0.4s; }

        @keyframes moonRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes particleFloat {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.12; }
          33% { transform: translateY(-25px) translateX(10px); opacity: 0.35; }
          66% { transform: translateY(-10px) translateX(-6px); opacity: 0.2; }
        }
        @keyframes borderFlow {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>

      {/* ==================== 背景层 0：深空底色 ==================== */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[#010108]" />

      {/* ==================== 背景层 1：大月球 — 右边缘半圆 ==================== */}
      <div className="fixed z-[1] pointer-events-none"
        style={{ top: "50%", right: "-20vw", width: "90vw", height: "90vw", maxWidth: "1200px", maxHeight: "1200px", transform: "translateY(-50%)", overflow: "visible" }}>
        {/* 月球外围软光晕——消除边缘生硬感 */}
        <div className="absolute rounded-full"
          style={{
            top: "-6%", left: "-6%", width: "112%", height: "112%",
            background: "radial-gradient(circle at 50% 50%, rgba(45,45,55,0.22) 40%, rgba(20,20,30,0.1) 70%, transparent 100%)",
            filter: "blur(40px)",
          }} />
        {/* 主体球体：高对比度纹理层 */}
        <div className="w-full h-full rounded-full relative"
          style={{
            background: `
              /* 球体基础色——冷灰蓝，匹配深空主色调 */
              radial-gradient(circle at 50% 50%, rgba(62,64,74,0.45) 0%, rgba(38,39,48,0.55) 55%, rgba(16,17,25,0.85) 100%),
              /* 月海暗斑区域——大块深色，视觉冲击力强 */
              radial-gradient(ellipse at 30% 30%, rgba(3,3,10,0.95) 0%, transparent 25%),
              radial-gradient(ellipse at 65% 70%, rgba(3,3,10,0.9) 0%, transparent 22%),
              radial-gradient(ellipse at 58% 25%, rgba(4,3,11,0.85) 0%, transparent 20%),
              radial-gradient(ellipse at 40% 50%, rgba(4,3,11,0.8) 0%, transparent 18%),
              radial-gradient(ellipse at 72% 50%, rgba(5,4,12,0.75) 0%, transparent 15%),
              /* 环形山高亮区域——点状白色，对比明显 */
              radial-gradient(circle at 20% 62%, rgba(150,155,175,0.35) 0%, transparent 6%),
              radial-gradient(circle at 42% 28%, rgba(145,150,172,0.3) 0%, transparent 5%),
              radial-gradient(circle at 30% 52%, rgba(140,145,168,0.28) 0%, transparent 4.5%),
              radial-gradient(circle at 55% 60%, rgba(148,153,175,0.25) 0%, transparent 4%),
              radial-gradient(circle at 15% 40%, rgba(155,160,180,0.22) 0%, transparent 5.5%),
              radial-gradient(circle at 48% 18%, rgba(150,155,176,0.2) 0%, transparent 4.5%),
              /* 中等亮度过渡区域 */
              radial-gradient(ellipse at 52% 58%, rgba(48,49,58,0.45) 0%, transparent 14%),
              radial-gradient(ellipse at 38% 18%, rgba(52,53,62,0.35) 0%, transparent 12%),
              radial-gradient(ellipse at 68% 38%, rgba(45,46,54,0.4) 0%, transparent 13%)
            `,
            animation: "moonRotate 55s linear infinite",
            filter: "blur(0.2px)",
          }} />
        {/* 3D 球体光照遮罩——模拟球面高光与暗部，产生立体感 */}
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle at 32% 28%, rgba(220,225,240,0.18) 0%, rgba(140,145,160,0.06) 30%, rgba(30,32,42,0.35) 60%, rgba(8,9,16,0.72) 82%, rgba(2,2,6,0.96) 100%)",
            boxShadow: "inset 0 0 120px rgba(0,2,8,0.5), inset 0 0 40px rgba(0,0,4,0.8)",
          }} />
        {/* 表面内层纹理：不同转速反向旋转，产生视差立体感 */}
        <div className="absolute inset-0 rounded-full"
          style={{
            background: `
              radial-gradient(circle at 55% 40%, rgba(170,175,195,0.12) 0%, transparent 7%),
              radial-gradient(circle at 22% 35%, rgba(155,160,180,0.1) 0%, transparent 6%),
              radial-gradient(circle at 72% 55%, rgba(148,153,172,0.09) 0%, transparent 5.5%),
              radial-gradient(circle at 45% 65%, rgba(160,165,185,0.08) 0%, transparent 5%),
              radial-gradient(ellipse at 32% 62%, rgba(35,36,44,0.4) 0%, transparent 16%),
              radial-gradient(ellipse at 60% 28%, rgba(30,31,38,0.35) 0%, transparent 14%)
            `,
            animation: "moonRotate 65s linear infinite reverse",
          }} />
        {/* 月光晕：独立一层，不受旋转影响 */}
        <div className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle at 50% 50%, rgba(40,40,50,0.05) 35%, transparent 70%)", filter: "blur(160px)", transform: "scale(1.6)" }} />
      </div>

      {/* ==================== 背景层 1.5：左侧散射光——填补空白 ==================== */}
      <div className="fixed z-[1] pointer-events-none" style={{ top: "0%", left: "-5vw", width: "55vw", height: "100vh" }}>
        <div style={{
          width: "100%", height: "100%",
          background: "radial-gradient(ellipse at 25% 50%, rgba(50,55,70,0.08) 0%, rgba(40,45,60,0.04) 45%, transparent 75%)",
          filter: "blur(200px)",
        }} />
      </div>
      {/* 左上角额外光点——进一步丰富左侧 */}
      <div className="fixed z-[1] pointer-events-none" style={{ top: "8%", left: "8%", width: "30vw", height: "30vh", maxWidth: "400px", maxHeight: "300px" }}>
        <div style={{
          width: "100%", height: "100%",
          background: "radial-gradient(ellipse at 40% 60%, rgba(80,85,100,0.06) 0%, transparent 70%)",
          filter: "blur(120px)",
        }} />
      </div>

      {/* ==================== 背景层 2：浮动粒子（suppressHydrationWarning 避 SSR 随机值差异） ==================== */}
      <div className="fixed inset-0 z-[2] pointer-events-none overflow-hidden" suppressHydrationWarning>
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="absolute rounded-full"
            style={{
              width: `${2 + Math.random() * 3.5}px`, height: `${2 + Math.random() * 3.5}px`,
              left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
              background: `rgba(${180 + Math.random() * 50},${180 + Math.random() * 40},${210 + Math.random() * 30},${0.15 + Math.random() * 0.3})`,
              animation: `particleFloat ${10 + Math.random() * 12}s ease-in-out ${Math.random() * 8}s infinite`,
              filter: "blur(0.5px)",
            }}
          />
        ))}
      </div>

      {/* ==================== 右侧圆点导航 ==================== */}
      <nav className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-3 pointer-events-auto">
        {SECTIONS.map((key) => (
          <button
            key={key}
            onClick={() => scrollToSection(key)}
            className="rounded-full transition-all duration-500"
            style={{
              width: activeSection === key ? "10px" : "6px",
              height: activeSection === key ? "10px" : "6px",
              background: activeSection === key
                ? "rgba(210,200,230,0.8)"
                : "rgba(255,255,255,0.12)",
              boxShadow: activeSection === key
                ? "0 0 10px rgba(180,170,200,0.5)"
                : "none",
            }}
            aria-label={`跳转到第 ${SECTIONS.indexOf(key) + 1} 屏`}
          />
        ))}
      </nav>

      {/* ==================== 顶栏 ==================== */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-8 md:px-14"
        style={{ background: "linear-gradient(180deg, rgba(6,6,14,0.94) 0%, rgba(6,6,14,0.25) 85%, transparent 100%)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}>
        <div className="flex items-center gap-6">
          <span className="text-base select-none">
            <span className="font-light tracking-[0.25em] text-white/90" style={{ textShadow: '0 0 30px rgba(255,255,255,0.12)' }}>无中生</span>
            <span className="mx-2 text-white/15 font-thin">|</span>
            <span className="font-light tracking-[0.3em] text-white/50" style={{ letterSpacing: '0.4em' }}>AI</span>
          </span>
          {isClient && isLoggedIn && (
            <button onClick={() => router.push("/workspace")}
              className="relative px-5 py-2 rounded-xl text-xs font-light tracking-[0.15em] transition-all duration-500"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(200,200,220,0.8)" }}>
              控制台
            </button>
          )}
          <Link href="/login" className="relative px-5 py-2 rounded-xl text-xs font-light tracking-[0.15em] transition-all duration-500"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(230,230,245,0.9)", boxShadow: "0 0 20px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
            登录
          </Link>
        </div>
        <div />
      </header>

      {/* ==================== 主内容 ==================== */}
      <main className="relative z-10">

        {/* ---- Hero ---- */}
        <section ref={(el) => setSectionRef("hero", el)} data-section="hero"
          className="snap-section flex flex-col items-center justify-center text-center h-screen px-6">
          <div className="section-reveal section-reveal-d1 inline-flex items-center gap-2 px-5 py-2 rounded-full mb-14 text-[14px] tracking-[0.28em] font-light"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", color: "rgba(170,180,200,0.5)" }}>
            <Star size={14} className="text-zinc-600" /> 每个人都是导演
          </div>
          <h1 className="section-reveal section-reveal-d2 text-8xl md:text-[9rem] lg:text-[11rem] font-thin tracking-[0.01em] text-white mb-12 select-none leading-none"
            style={{ textShadow: "0 0 140px rgba(255,255,255,0.15), 0 0 280px rgba(200,200,220,0.06), 0 0 40px rgba(255,255,255,0.08)" }}>
            <span className="bg-gradient-to-b from-white via-white to-white/70 bg-clip-text text-transparent" style={{ WebkitTextFillColor: 'transparent' }}>无中生</span>
            <span className="mx-3 md:mx-4 text-white/10 font-thin align-middle" style={{ fontSize: '0.35em', verticalAlign: 'middle' }}>|</span>
            <span className="text-white/40 font-thin tracking-[0.15em]" style={{ fontSize: '0.4em', verticalAlign: 'middle' }}>AI</span>
          </h1>
          <div className="section-reveal section-reveal-d3 relative mb-12">
            <div className="w-64 h-px mx-auto rounded-full"
              style={{ background: "linear-gradient(90deg, transparent, rgba(170,175,200,0.3) 30%, rgba(190,200,220,0.5) 50%, rgba(170,175,200,0.3) 70%, transparent)", backgroundSize: "200% 100%", animation: "borderFlow 5s linear infinite", filter: "blur(1px)" }} />
          </div>
          <p className="section-reveal section-reveal-d3 text-base md:text-xl text-zinc-500 font-light tracking-[0.18em] leading-relaxed max-w-xl select-none">
            视觉交响<span className="text-zinc-700 mx-4">·</span> 半自动化智能分镜引擎<span className="text-zinc-700 mx-4">·</span> 从灵感直达成片
          </p>
        </section>

        {/* ---- S1：半自动化分镜引擎 ---- */}
        <section ref={(el) => setSectionRef("s1", el)} data-section="s1"
          className="snap-section flex items-center h-screen px-8 md:px-20">
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="flex justify-center order-2 lg:order-1">
              <div className="section-reveal section-reveal-d1 relative w-full max-w-2xl h-[24rem]">
                {[
                  { top: "5%", left: "0%", rotate: "-5deg", color: "rgba(100,130,180,0.28)", label: "Shot 01", ratio: "16/9" },
                  { top: "20%", left: "16%", rotate: "3deg", color: "rgba(140,110,170,0.25)", label: "Shot 02", ratio: "16/9" },
                  { top: "36%", left: "8%", rotate: "-3deg", color: "rgba(120,150,140,0.25)", label: "Shot 03", ratio: "4/3" },
                ].map((card, i) => (
                  <div key={card.label} className="absolute w-[66%] rounded-2xl overflow-hidden"
                    style={{ top: card.top, left: card.left, transform: `rotate(${card.rotate})`, background: "linear-gradient(180deg, rgba(22,22,32,0.75) 0%, rgba(8,8,16,0.9) 100%)", border: `1px solid ${card.color}`, boxShadow: `0 30px 80px rgba(0,0,0,0.55), 0 0 50px ${card.color.replace("0.28", "0.05")}`, backdropFilter: "blur(24px)" }}>
                    <div className="w-full flex items-center justify-center text-zinc-700 text-sm tracking-[0.25em] font-light"
                      style={{ aspectRatio: card.ratio, background: "linear-gradient(135deg, rgba(38,38,55,0.5), rgba(12,12,24,0.8))" }}>
                      {card.label}
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3.5 border-t border-white/[0.03]">
                      <div className="w-3 h-3 rounded-full" style={{ background: "rgba(140,140,170,0.35)" }} />
                      <div className="w-20 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
                    </div>
                  </div>
                ))}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <path d="M 66% 22% Q 74% 28% 66% 36%" stroke="rgba(140,130,170,0.18)" strokeWidth="2" fill="none" strokeDasharray="5,4" />
                  <path d="M 66% 40% Q 70% 48% 66% 52%" stroke="rgba(140,130,170,0.18)" strokeWidth="2" fill="none" strokeDasharray="5,4" />
                </svg>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="section-reveal section-reveal-d1 inline-flex items-center gap-3 mb-6">
                <Clapperboard size={20} className="text-zinc-500" />
                <span className="text-xs tracking-[0.3em] text-zinc-600 font-light uppercase">Core Engine</span>
              </div>
              <h2 className="section-reveal section-reveal-d2 text-4xl md:text-6xl font-light text-white tracking-[0.05em] mb-8 leading-tight">半自动化<br />分镜引擎</h2>
              <p className="section-reveal section-reveal-d3 text-sm md:text-base text-zinc-500 leading-relaxed font-light mb-10 max-w-lg">
                输入剧本，一键生成完整分镜。AI 自动拆解镜头、计算时长、推断光影，每个分镜直接输出可用的生图提示词。从文字到画面，告别逐帧手绘。
              </p>
              <div className="section-reveal section-reveal-d3 flex flex-wrap gap-3">
                {["导演引擎", "裂变分镜", "资产表格"].map((tag) => (
                  <span key={tag} className="px-5 py-2.5 rounded-xl text-xs tracking-[0.14em] font-light"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(170,180,200,0.6)" }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---- S2：三权分立管线 ---- */}
        <section ref={(el) => setSectionRef("s2", el)} data-section="s2"
          className="snap-section flex items-center h-screen px-8 md:px-20"
          style={{ background: "linear-gradient(180deg, transparent 0%, rgba(14,14,26,0.5) 50%, transparent 100%)" }}>
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="section-reveal section-reveal-d1 inline-flex items-center gap-3 mb-6">
                <GitBranch size={20} className="text-zinc-500" />
                <span className="text-xs tracking-[0.3em] text-zinc-600 font-light uppercase">Dual-Stage Pipeline</span>
              </div>
              <h2 className="section-reveal section-reveal-d2 text-4xl md:text-6xl font-light text-white tracking-[0.05em] mb-8 leading-tight">三权分立<br />双阶段分镜管线</h2>
              <p className="section-reveal section-reveal-d3 text-sm md:text-base text-zinc-500 leading-relaxed font-light mb-8 max-w-lg">
                独创双阶段架构：调度层统一规划光影、节奏、镜头语言；执行层严格按调度结果生成画面，两层互不干扰，彻底杜绝 AI 随意发挥。
              </p>
              <div className="section-reveal section-reveal-d3 space-y-4 text-sm text-zinc-600 font-light tracking-[0.06em]">
                <div className="flex items-start gap-4"><span className="text-zinc-500 text-xs mt-0.5 w-6">01</span><span>智能时长：根据对白密度自动计算每个镜头的合理秒数</span></div>
                <div className="flex items-start gap-4"><span className="text-zinc-500 text-xs mt-0.5 w-6">02</span><span>光影兜底：角色设定 → 导演意图 → 镜头景别，三层逐级校对</span></div>
                <div className="flex items-start gap-4"><span className="text-zinc-500 text-xs mt-0.5 w-6">03</span><span>物理级严谨：空间关系、人物站位、运动方向始终一致，像实拍一样</span></div>
              </div>
            </div>
            <div className="section-reveal section-reveal-d2 flex justify-center">
              <div className="relative w-full max-w-2xl h-[18rem] flex items-center justify-center">
                <div className="absolute left-0 w-[44%] rounded-2xl p-8"
                  style={{ background: "linear-gradient(170deg, rgba(28,28,42,0.7), rgba(8,8,20,0.9))", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 25px 60px rgba(0,0,0,0.45)" }}>
                  <Cpu size={26} className="text-zinc-500 mb-4" />
                  <div className="text-sm text-white/60 tracking-[0.18em] font-light mb-2">① 调度层</div>
                  <div className="text-base text-zinc-300 font-light">统筹光影与节奏</div>
                </div>
                <div className="absolute left-[42%] w-[16%] flex items-center justify-center">
                  <ArrowRight size={20} className="text-zinc-600" />
                </div>
                <div className="absolute right-0 w-[44%] rounded-2xl p-8"
                  style={{ background: "linear-gradient(170deg, rgba(22,22,36,0.7), rgba(6,6,18,0.9))", border: "1px solid rgba(255,255,255,0.05)", boxShadow: "0 25px 60px rgba(0,0,0,0.45)" }}>
                  <Image size={26} className="text-zinc-500 mb-4" />
                  <div className="text-sm text-white/60 tracking-[0.18em] font-light mb-2">② 执行层</div>
                  <div className="text-base text-zinc-300 font-light">严格按指令出图</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---- S3：导演路由引擎 ---- */}
        <section ref={(el) => setSectionRef("s3", el)} data-section="s3"
          className="snap-section flex items-center h-screen px-8 md:px-20">
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="flex justify-center order-2 lg:order-1">
              <div className="section-reveal section-reveal-d1 relative w-full max-w-2xl h-[20rem]">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-2xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(38,38,58,0.9), rgba(10,10,24,0.95))", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 60px rgba(140,135,165,0.12)" }}>
                  <Globe size={32} className="text-zinc-500" />
                </div>
                {[
                  { label: "布光字典", sub: "100+ 种", x: "6%", y: "10%" },
                  { label: "运镜字典", sub: "60+ 项", x: "66%", y: "10%" },
                  { label: "题材预设", sub: "20+ 个", x: "6%", y: "66%" },
                  { label: "安全突变", sub: "15+ 种", x: "66%", y: "66%" },
                ].map((node) => (
                  <div key={node.label} className="absolute w-24 h-24 rounded-xl flex flex-col items-center justify-center gap-1"
                    style={{ left: node.x, top: node.y, background: "linear-gradient(135deg, rgba(30,30,46,0.8), rgba(8,8,20,0.9))", border: "1px solid rgba(255,255,255,0.05)", boxShadow: "0 12px 35px rgba(0,0,0,0.4)" }}>
                    <span className="text-[11px] tracking-[0.12em] text-zinc-500 font-light">{node.label}</span>
                    <span className="text-sm text-zinc-400 font-light">{node.sub}</span>
                  </div>
                ))}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <line x1="20%" y1="24%" x2="38%" y2="40%" stroke="rgba(140,130,170,0.12)" strokeWidth="2" />
                  <line x1="80%" y1="24%" x2="62%" y2="40%" stroke="rgba(140,130,170,0.12)" strokeWidth="2" />
                  <line x1="20%" y1="80%" x2="38%" y2="60%" stroke="rgba(140,130,170,0.12)" strokeWidth="2" />
                  <line x1="80%" y1="80%" x2="62%" y2="60%" stroke="rgba(140,130,170,0.12)" strokeWidth="2" />
                </svg>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="section-reveal section-reveal-d1 inline-flex items-center gap-3 mb-6">
                <Globe size={20} className="text-zinc-500" />
                <span className="text-xs tracking-[0.3em] text-zinc-600 font-light uppercase">Director Router</span>
              </div>
              <h2 className="section-reveal section-reveal-d2 text-4xl md:text-6xl font-light text-white tracking-[0.05em] mb-8 leading-tight">导演路由<br />引擎</h2>
              <p className="section-reveal section-reveal-d3 text-sm md:text-base text-zinc-500 leading-relaxed font-light mb-8 max-w-lg">
                覆盖主流影视题材与多档节奏，自由混搭。内置光影字典、运镜策略、色彩调色板，自动为每个分镜注入专业级的英文光影咒语。画面风格不死板、不重复，每个镜头都有独特的电影质感。
              </p>
              <div className="section-reveal section-reveal-d3 grid grid-cols-2 gap-3 max-w-sm">
                {[
                  { k: "题材", v: "悬疑 / 甜宠 / 动作 / 科幻 / 古装 ..." },
                  { k: "节奏", v: "极快 / 偏快 / 正常 / 舒缓" },
                  { k: "运镜", v: "推拉摇移跟升降 + 20 种变体" },
                  { k: "布光", v: "10 种主光 + 8 种辅光 + 12 种环境光" },
                ].map((item) => (
                  <div key={item.k} className="text-xs p-3.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <span className="text-zinc-500 font-light">{item.k}</span><br />
                    <span className="text-zinc-600 text-[11px]">{item.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---- S4：视觉交响空间 ---- */}
        <section ref={(el) => setSectionRef("s4", el)} data-section="s4"
          className="snap-section flex items-center h-screen px-8 md:px-20"
          style={{ background: "linear-gradient(180deg, transparent 0%, rgba(14,14,26,0.5) 50%, transparent 100%)" }}>
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="section-reveal section-reveal-d1 inline-flex items-center gap-3 mb-6">
                <Layers size={20} className="text-zinc-500" />
                <span className="text-xs tracking-[0.3em] text-zinc-600 font-light uppercase">Visual Symphony</span>
              </div>
              <h2 className="section-reveal section-reveal-d2 text-4xl md:text-6xl font-light text-white tracking-[0.05em] mb-8 leading-tight">视觉交响<br />空间</h2>
              <p className="section-reveal section-reveal-d3 text-sm md:text-base text-zinc-500 leading-relaxed font-light mb-8 max-w-lg">
                基于 React Flow 的节点编辑器画布，提供 9 种节点类型自由编排。拖拽即建、连线即通，支持画布内直接调用 AI 生图/生视频 API，真正的所见即所得。
              </p>
              <div className="section-reveal section-reveal-d3 flex flex-wrap gap-2.5 max-w-md">
                {["ShotNode", "MediaNode", "RenderNode", "VideoClip", "Combine", "MasterScript", "AssetTable", "ScriptTable", "TextNode"].map((tag) => (
                  <span key={tag} className="px-3.5 py-2 rounded-lg text-[11px] tracking-[0.1em] font-light"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", color: "rgba(140,150,170,0.5)" }}>{tag}</span>
                ))}
              </div>
            </div>
            <div className="section-reveal section-reveal-d2 flex justify-center">
              <div className="relative w-full max-w-2xl h-[24rem]">
                {[
                  { top: "5%", left: "6%", color: "rgba(90,130,190,0.32)", label: "Script" },
                  { top: "5%", left: "58%", color: "rgba(130,170,110,0.3)", label: "Render" },
                  { top: "38%", left: "50%", color: "rgba(150,110,160,0.3)", label: "Shot" },
                  { top: "65%", left: "10%", color: "rgba(180,130,90,0.3)", label: "VideoClip" },
                  { top: "65%", left: "54%", color: "rgba(100,140,170,0.3)", label: "Combine" },
                ].map((node) => (
                  <div key={node.label} className="absolute rounded-xl"
                    style={{ top: node.top, left: node.left, background: "linear-gradient(135deg, rgba(24,24,38,0.8), rgba(6,6,18,0.9))", border: `1px solid ${node.color}`, boxShadow: `0 0 30px ${node.color.replace("0.32", "0.08")}`, padding: "14px 22px" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ background: node.color }} />
                      <span className="text-sm text-zinc-400 tracking-[0.12em] font-light">{node.label}</span>
                    </div>
                  </div>
                ))}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <path d="M 34% 16% L 58% 16% L 58% 41%" stroke="rgba(140,140,170,0.12)" strokeWidth="2" fill="none" />
                  <path d="M 58% 53% L 28% 53% L 28% 68%" stroke="rgba(140,140,170,0.12)" strokeWidth="2" fill="none" />
                  <path d="M 58% 53% L 66% 53% L 66% 68%" stroke="rgba(140,140,170,0.12)" strokeWidth="2" fill="none" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* ---- S5：多模态 AI 引擎 ---- */}
        <section ref={(el) => setSectionRef("s5", el)} data-section="s5"
          className="snap-section flex items-center h-screen px-8 md:px-20">
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="flex justify-center order-2 lg:order-1">
              <div className="section-reveal section-reveal-d1 relative w-full max-w-2xl h-[24rem]">
                {[
                  { top: "0%", left: "0%", rotate: "-4deg", color: "rgba(110,90,170,0.28)", icon: <Image size={28} />, label: "图片生成" },
                  { top: "10%", left: "34%", rotate: "3deg", color: "rgba(170,110,90,0.25)", icon: <Video size={28} />, label: "视频生成" },
                  { top: "24%", left: "8%", rotate: "-2deg", color: "rgba(90,150,130,0.25)", icon: <MessageSquare size={28} />, label: "AI 对话" },
                ].map((card) => (
                  <div key={card.label} className="absolute w-[58%] rounded-2xl overflow-hidden"
                    style={{ top: card.top, left: card.left, transform: `rotate(${card.rotate})`, background: "linear-gradient(180deg, rgba(24,24,36,0.8), rgba(8,8,18,0.9))", border: `1px solid ${card.color}`, boxShadow: `0 25px 60px rgba(0,0,0,0.45), 0 0 40px ${card.color.replace("0.28", "0.05")}` }}>
                    <div className="w-full aspect-video flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, rgba(32,32,48,0.5), rgba(10,10,22,0.8))" }}>
                      <div className="text-zinc-700">{card.icon}</div>
                    </div>
                    <div className="px-5 py-4 border-t border-white/[0.04]">
                      <span className="text-sm text-zinc-500 tracking-[0.14em] font-light">{card.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="section-reveal section-reveal-d1 inline-flex items-center gap-3 mb-6">
                <Zap size={20} className="text-zinc-500" />
                <span className="text-xs tracking-[0.3em] text-zinc-600 font-light uppercase">Multi-Modal AI</span>
              </div>
              <h2 className="section-reveal section-reveal-d2 text-4xl md:text-6xl font-light text-white tracking-[0.05em] mb-8 leading-tight">多模态<br />AI 生成引擎</h2>
              <p className="section-reveal section-reveal-d3 text-sm md:text-base text-zinc-500 leading-relaxed font-light mb-8 max-w-lg">
                生图、生视频、AI 对话三合一。支持 banana-pro（Gemini 原生）、Seedream 5.0、Seedance、Kling 等多模型调度，最高 4K 分辨率输出。异步轮询 + Token 精准计费。
              </p>
              <div className="section-reveal section-reveal-d3 space-y-3">
                {[
                  { model: "banana-pro", desc: "Gemini 3 Pro Image 原生端点" },
                  { model: "Seedream 5.0", desc: "火山引擎 4K 品质" },
                  { model: "Seedance / Kling", desc: "视频生成 + 异步轮询" },
                ].map((m) => (
                  <div key={m.model} className="flex items-center gap-4 text-sm">
                    <span className="text-zinc-400 font-light tracking-[0.06em] w-40">{m.model}</span>
                    <span className="text-zinc-600 text-xs">{m.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---- S6：AI 对话 & 工作流 ---- */}
        <section ref={(el) => setSectionRef("s6", el)} data-section="s6"
          className="snap-section flex items-center h-screen px-8 md:px-20"
          style={{ background: "linear-gradient(180deg, transparent 0%, rgba(14,14,26,0.5) 50%, transparent 100%)" }}>
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="section-reveal section-reveal-d1 inline-flex items-center gap-3 mb-6">
                <Puzzle size={20} className="text-zinc-500" />
                <span className="text-xs tracking-[0.3em] text-zinc-600 font-light uppercase">Chat & Workflow</span>
              </div>
              <h2 className="section-reveal section-reveal-d2 text-4xl md:text-6xl font-light text-white tracking-[0.05em] mb-8 leading-tight">AI 对话 &<br />工作流引擎</h2>
              <p className="section-reveal section-reveal-d3 text-sm md:text-base text-zinc-500 leading-relaxed font-light mb-8 max-w-lg">
                内置丰富预置工作流与智能体：剧本分镜、拆帧分析、文案生成……多模型一键切换，所有会话自动云端同步。
              </p>
              <div className="section-reveal section-reveal-d3 grid grid-cols-2 gap-2.5 max-w-xs">
                {["剧本分镜", "拆帧分析", "文案生成", "联网搜索", "文件附件", "多模型切换"].map((w) => (
                  <div key={w} className="text-xs px-3.5 py-2.5 rounded-lg font-light tracking-[0.08em]"
                    style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.03)", color: "rgba(150,160,180,0.5)" }}>{w}</div>
                ))}
              </div>
            </div>
            <div className="section-reveal section-reveal-d2 flex justify-center">
              <div className="relative w-full max-w-2xl h-[18rem]">
                <div className="absolute top-[8%] left-[4%] max-w-[62%] rounded-2xl rounded-bl-sm p-5"
                  style={{ background: "linear-gradient(135deg, rgba(32,32,52,0.8), rgba(10,10,24,0.9))", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="w-24 h-2 rounded-full mb-3" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <div className="w-16 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
                </div>
                <div className="absolute bottom-[10%] right-[4%] w-[62%] rounded-2xl p-5"
                  style={{ background: "linear-gradient(135deg, rgba(28,28,42,0.8), rgba(8,8,20,0.9))", border: "1px solid rgba(255,255,255,0.05)", boxShadow: "0 20px 50px rgba(0,0,0,0.4)" }}>
                  <div className="flex items-center gap-3 mb-4">
                    <Zap size={14} className="text-zinc-600" />
                    <span className="text-[11px] text-zinc-500 tracking-[0.14em] font-light">WORKFLOW REGISTRY</span>
                  </div>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: "rgba(140,140,170,0.3)" }} />
                      <div className="w-28 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---- Footer ---- */}
        <footer className="py-16 px-6 text-center">
          <p className="text-xs text-zinc-700 tracking-[0.25em] font-light select-none">&copy; 2026 无中生</p>
        </footer>
      </main>
    </div>
  );
}
