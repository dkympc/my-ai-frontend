"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useAppStore } from "@/store/useAppStore";
import { fetchApi } from "@/services/api";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isAuthChecking, setIsAuthenticated, setUserRole, setIsAuthChecking } = useAuthStore();
  const { toastMsg, setToastMsg } = useAppStore();

  // 登录表单状态
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // 注册表单状态
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerInviteCode, setRegisterInviteCode] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);

  // Toast 自动消失
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // ★ 挂载时立即解除 authChecking 锁，并检查是否已登录
  useEffect(() => {
    setIsAuthChecking(false);
    const token = localStorage.getItem("yr-ai-token");
    if (token) {
      router.replace("/workspace");
    }
  }, []);

  // 登录逻辑：仅设置认证状态 + 跳转，数据拉取由 /workspace 页面自行处理
  const handleLogin = async () => {
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setToastMsg("请输入账号和密码");
      return;
    }
    setLoginLoading(true);
    try {
      const res = await fetchApi("/v1/login", {
        method: "POST",
        requireAuth: false,
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("yr-ai-token", data.access_token);
        localStorage.setItem("yr-ai-role", data.role);
        setIsAuthenticated(true);
        setUserRole(data.role);
        setToastMsg("登录成功，欢迎回来");
        router.replace("/workspace");
      } else {
        setToastMsg(data.error?.message || "账号或密码错误");
      }
    } catch (e) {
      setToastMsg("网络连接失败，请检查后端服务");
    } finally {
      setLoginLoading(false);
    }
  };

  // 注册逻辑
  const handleRegister = async () => {
    if (!registerUsername.trim() || !registerPassword.trim()) {
      setToastMsg("请填写用户名和密码");
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      setToastMsg("两次输入的密码不一致");
      return;
    }
    if (registerPassword.length < 4) {
      setToastMsg("密码长度至少 4 位");
      return;
    }
    setRegisterLoading(true);
    try {
      const res = await fetchApi("/v1/register", {
        method: "POST",
        requireAuth: false,
        body: JSON.stringify({
          username: registerUsername.trim(),
          password: registerPassword,
          invite_code: registerInviteCode.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setToastMsg("注册成功！请登录。");
        setIsRegistering(false);
        setLoginUsername(registerUsername);
        setRegisterUsername("");
        setRegisterPassword("");
        setRegisterConfirmPassword("");
        setRegisterInviteCode("");
      } else {
        setToastMsg(data.error?.message || "注册失败");
      }
    } catch (e) {
      setToastMsg("网络连接失败，请检查后端服务");
    } finally {
      setRegisterLoading(false);
    }
  };

  // ★ 登录页直接渲染，不等待 authChecking（useEffect 中已处理跳转）

  return (
    <div className="relative flex h-screen bg-[#020202] items-center justify-center overflow-hidden font-sans antialiased selection:bg-white/10">
      {/* ==================== 全局动画样式 ==================== */}
      <style jsx global>{`
        /* 液态有机光体变形动画 */
        @keyframes liquidMorph1 {
          0%,
          100% {
            border-radius: 40% 60% 60% 40% / 60% 30% 70% 40%;
          }
          25% {
            border-radius: 58% 42% 35% 65% / 42% 55% 38% 62%;
          }
          50% {
            border-radius: 32% 68% 68% 32% / 48% 58% 42% 52%;
          }
          75% {
            border-radius: 55% 45% 42% 58% / 35% 48% 55% 45%;
          }
        }
        @keyframes liquidMorph2 {
          0%,
          100% {
            border-radius: 55% 45% 35% 65% / 55% 45% 55% 45%;
          }
          33% {
            border-radius: 38% 62% 58% 42% / 48% 52% 48% 52%;
          }
          66% {
            border-radius: 62% 38% 45% 55% / 42% 58% 42% 58%;
          }
        }
        @keyframes liquidMorph3 {
          0%,
          100% {
            border-radius: 48% 52% 42% 58% / 58% 42% 58% 42%;
          }
          50% {
            border-radius: 35% 65% 60% 40% / 45% 55% 45% 55%;
          }
        }

        /* 光体漂移 */
        @keyframes drift1 {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(40px, -25px) scale(1.06);
          }
          66% {
            transform: translate(-20px, 30px) scale(0.94);
          }
        }
        @keyframes drift2 {
          0%,
          100% {
            transform: translate(0, 0) scale(1.08);
          }
          50% {
            transform: translate(-35px, -15px) scale(0.97);
          }
        }
        @keyframes drift3 {
          0%,
          100% {
            transform: translate(0, 0) scale(0.95);
          }
          50% {
            transform: translate(25px, 35px) scale(1.05);
          }
        }

        /* 星空旋转 */
        @keyframes galaxyRotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes starGlow {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(2.5);
          }
        }
        @keyframes starGlow2 {
          0%,
          100% {
            opacity: 0.15;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(3);
          }
        }
        @keyframes starSlowFlash {
          0%,
          100% {
            opacity: 0.5;
            box-shadow: 0 0 3px 1px rgba(200, 220, 255, 0.4);
          }
          50% {
            opacity: 1;
            box-shadow: 0 0 12px 4px rgba(180, 200, 255, 0.8);
          }
        }
        @keyframes nebulaPulse {
          0%,
          100% {
            opacity: 0.35;
            transform: scale(1) rotate(0deg);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1) rotate(3deg);
          }
        }

        /* 术语浮游 */
        @keyframes termFloat1 {
          0% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(18px, -12px) rotate(0.8deg);
          }
          50% {
            transform: translate(5px, -20px) rotate(1.5deg);
          }
          75% {
            transform: translate(20px, -5px) rotate(0.3deg);
          }
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
        }
        @keyframes termFloat2 {
          0% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(-15px, 10px) rotate(-1deg);
          }
          50% {
            transform: translate(-25px, 5px) rotate(-0.5deg);
          }
          75% {
            transform: translate(-10px, 15px) rotate(-2deg);
          }
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
        }
        @keyframes termFloat3 {
          0% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(8px, -15px) rotate(0.5deg);
          }
          50% {
            transform: translate(20px, -8px) rotate(1.2deg);
          }
          75% {
            transform: translate(5px, -25px) rotate(0.6deg);
          }
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
        }
        @keyframes termFloat4 {
          0% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(-20px, -5px) rotate(-1.5deg);
          }
          66% {
            transform: translate(-8px, -18px) rotate(-0.8deg);
          }
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
        }
        @keyframes termFloat5 {
          0% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(12px, 8px) rotate(0.4deg);
          }
          50% {
            transform: translate(-10px, 20px) rotate(-0.6deg);
          }
          75% {
            transform: translate(18px, -3px) rotate(1deg);
          }
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
        }

        /* 卡片表面光流 */
        @keyframes surfaceFlow {
          0% {
            top: -100%;
            left: -50%;
          }
          100% {
            top: 120%;
            left: 80%;
          }
        }
        /* 按钮光核呼吸 */
        @keyframes pulseCore {
          0%,
          100% {
            opacity: 0.25;
          }
          50% {
            opacity: 0.45;
          }
        }
        /* 表单元素淡入 */
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(14px);
            filter: blur(3px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }
        /* 底部横线光流 */
        @keyframes barFlow {
          0% {
            background-position: -200% center;
          }
          100% {
            background-position: 200% center;
          }
        }
      `}</style>

      {/* ==================== 第一层：深空底色 ==================== */}
      <div className="absolute inset-0 z-0 bg-[#010108]" />

      {/* ==================== 第二层：星系星云 ==================== */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[5%] left-[15%] w-[60vw] h-[60vw] rounded-full opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(20,30,100,0.5) 0%, rgba(10,15,50,0.2) 30%, transparent 65%)",
            filter: "blur(80px)",
            animation: "nebulaPulse 30s ease-in-out infinite",
          }}
        />
        <div
          className="absolute top-[40%] right-[10%] w-[55vw] h-[55vw] rounded-full opacity-45"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(50,15,80,0.45) 0%, rgba(25,10,40,0.18) 30%, transparent 65%)",
            filter: "blur(90px)",
            animation: "nebulaPulse 35s ease-in-out 5s infinite reverse",
          }}
        />
        <div
          className="absolute bottom-[10%] left-[30%] w-[50vw] h-[45vw] rounded-full opacity-35"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(15,25,70,0.4) 0%, rgba(5,15,35,0.15) 30%, transparent 60%)",
            filter: "blur(70px)",
            animation: "nebulaPulse 40s ease-in-out 10s infinite",
          }}
        />
      </div>

      {/* ==================== 第三层：密集星场 A（80颗，正转） ==================== */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `
              radial-gradient(1px 1px at 5% 8%, rgba(200,220,255,0.9), transparent),
              radial-gradient(1px 1px at 12% 15%, rgba(180,200,240,0.7), transparent),
              radial-gradient(1px 1px at 20% 3%, rgba(220,230,255,0.8), transparent),
              radial-gradient(1px 1px at 28% 11%, rgba(190,210,250,0.6), transparent),
              radial-gradient(1px 1px at 35% 22%, rgba(210,225,250,0.75), transparent),
              radial-gradient(1px 1px at 42% 7%, rgba(180,200,240,0.85), transparent),
              radial-gradient(1px 1px at 50% 18%, rgba(200,220,255,0.65), transparent),
              radial-gradient(1px 1px at 58% 5%, rgba(220,230,255,0.9), transparent),
              radial-gradient(1px 1px at 65% 14%, rgba(190,210,250,0.7), transparent),
              radial-gradient(1px 1px at 72% 9%, rgba(210,220,250,0.55), transparent),
              radial-gradient(1px 1px at 80% 20%, rgba(180,200,240,0.8), transparent),
              radial-gradient(1px 1px at 88% 6%, rgba(200,220,255,0.7), transparent),
              radial-gradient(1px 1px at 95% 12%, rgba(220,230,255,0.6), transparent),
              radial-gradient(1px 1px at 3% 28%, rgba(190,210,250,0.75), transparent),
              radial-gradient(1px 1px at 10% 35%, rgba(210,225,250,0.55), transparent),
              radial-gradient(1px 1px at 18% 32%, rgba(200,220,255,0.85), transparent),
              radial-gradient(1px 1px at 25% 42%, rgba(180,200,240,0.6), transparent),
              radial-gradient(1px 1px at 33% 28%, rgba(220,230,255,0.7), transparent),
              radial-gradient(1px 1px at 40% 38%, rgba(190,210,250,0.8), transparent),
              radial-gradient(1px 1px at 48% 33%, rgba(210,220,250,0.5), transparent),
              radial-gradient(1px 1px at 55% 45%, rgba(200,220,255,0.75), transparent),
              radial-gradient(1px 1px at 62% 25%, rgba(180,200,240,0.85), transparent),
              radial-gradient(1px 1px at 70% 40%, rgba(220,230,255,0.6), transparent),
              radial-gradient(1px 1px at 78% 35%, rgba(190,210,250,0.9), transparent),
              radial-gradient(1px 1px at 85% 30%, rgba(210,225,250,0.7), transparent),
              radial-gradient(1px 1px at 92% 22%, rgba(200,220,255,0.55), transparent),
              radial-gradient(1px 1px at 8% 52%, rgba(180,200,240,0.8), transparent),
              radial-gradient(1px 1px at 15% 48%, rgba(220,230,255,0.65), transparent),
              radial-gradient(1px 1px at 22% 58%, rgba(190,210,250,0.75), transparent),
              radial-gradient(1px 1px at 30% 52%, rgba(210,220,250,0.55), transparent),
              radial-gradient(1px 1px at 38% 48%, rgba(200,220,255,0.85), transparent),
              radial-gradient(1px 1px at 45% 55%, rgba(180,200,240,0.7), transparent),
              radial-gradient(1px 1px at 52% 62%, rgba(220,230,255,0.6), transparent),
              radial-gradient(1px 1px at 60% 48%, rgba(190,210,250,0.9), transparent),
              radial-gradient(1px 1px at 68% 55%, rgba(210,225,250,0.5), transparent),
              radial-gradient(1px 1px at 75% 50%, rgba(200,220,255,0.8), transparent),
              radial-gradient(1px 1px at 82% 58%, rgba(180,200,240,0.65), transparent),
              radial-gradient(1px 1px at 90% 45%, rgba(220,230,255,0.75), transparent),
              radial-gradient(1px 1px at 5% 65%, rgba(190,210,250,0.55), transparent),
              radial-gradient(1px 1px at 13% 72%, rgba(210,220,250,0.85), transparent),
              radial-gradient(1px 1px at 20% 68%, rgba(200,220,255,0.6), transparent),
              radial-gradient(1px 1px at 28% 78%, rgba(180,200,240,0.7), transparent),
              radial-gradient(1px 1px at 35% 65%, rgba(220,230,255,0.8), transparent),
              radial-gradient(1px 1px at 43% 72%, rgba(190,210,250,0.5), transparent),
              radial-gradient(1px 1px at 50% 80%, rgba(210,225,250,0.75), transparent),
              radial-gradient(1px 1px at 58% 68%, rgba(200,220,255,0.85), transparent),
              radial-gradient(1px 1px at 65% 78%, rgba(180,200,240,0.55), transparent),
              radial-gradient(1px 1px at 72% 62%, rgba(220,230,255,0.9), transparent),
              radial-gradient(1px 1px at 80% 75%, rgba(190,210,250,0.65), transparent),
              radial-gradient(1px 1px at 88% 68%, rgba(210,220,250,0.7), transparent),
              radial-gradient(1px 1px at 95% 72%, rgba(200,220,255,0.55), transparent),
              radial-gradient(1px 1px at 8% 85%, rgba(180,200,240,0.8), transparent),
              radial-gradient(1px 1px at 15% 80%, rgba(220,230,255,0.6), transparent),
              radial-gradient(1px 1px at 25% 88%, rgba(190,210,250,0.75), transparent),
              radial-gradient(1px 1px at 33% 82%, rgba(210,225,250,0.5), transparent),
              radial-gradient(1px 1px at 40% 90%, rgba(200,220,255,0.85), transparent),
              radial-gradient(1px 1px at 48% 85%, rgba(180,200,240,0.7), transparent),
              radial-gradient(1px 1px at 55% 92%, rgba(220,230,255,0.55), transparent),
              radial-gradient(1px 1px at 62% 80%, rgba(190,210,250,0.9), transparent),
              radial-gradient(1px 1px at 70% 88%, rgba(210,220,250,0.65), transparent),
              radial-gradient(1px 1px at 78% 82%, rgba(200,220,255,0.75), transparent),
              radial-gradient(1px 1px at 85% 90%, rgba(180,200,240,0.5), transparent),
              radial-gradient(1px 1px at 92% 85%, rgba(220,230,255,0.8), transparent),
              radial-gradient(1px 1px at 3% 92%, rgba(190,210,250,0.6), transparent),
              radial-gradient(1px 1px at 18% 95%, rgba(210,225,250,0.85), transparent),
              radial-gradient(1px 1px at 38% 94%, rgba(200,220,255,0.7), transparent),
              radial-gradient(1px 1px at 58% 96%, rgba(180,200,240,0.55), transparent),
              radial-gradient(1px 1px at 75% 93%, rgba(220,230,255,0.75), transparent),
              radial-gradient(1px 1px at 88% 95%, rgba(190,210,250,0.6), transparent)
            `,
          backgroundSize: "100% 100%",
          animation: "galaxyRotate 250s linear infinite",
        }}
      />

      {/* ==================== 第四层：密集星场 B（35颗中星，反转） ==================== */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `
              radial-gradient(1.5px 1.5px at 7% 20%, rgba(180,210,255,0.9), transparent),
              radial-gradient(1.5px 1.5px at 23% 8%, rgba(200,230,255,0.8), transparent),
              radial-gradient(1.5px 1.5px at 38% 15%, rgba(160,200,240,0.75), transparent),
              radial-gradient(1.5px 1.5px at 52% 5%, rgba(220,240,255,0.85), transparent),
              radial-gradient(1.5px 1.5px at 67% 12%, rgba(180,210,250,0.7), transparent),
              radial-gradient(1.5px 1.5px at 81% 25%, rgba(200,220,250,0.8), transparent),
              radial-gradient(1.5px 1.5px at 93% 10%, rgba(170,200,245,0.65), transparent),
              radial-gradient(2px 2px at 12% 40%, rgba(210,235,255,0.85), transparent),
              radial-gradient(1.5px 1.5px at 28% 35%, rgba(180,205,245,0.7), transparent),
              radial-gradient(2px 2px at 45% 28%, rgba(190,220,255,0.9), transparent),
              radial-gradient(1.5px 1.5px at 60% 42%, rgba(200,225,250,0.75), transparent),
              radial-gradient(2px 2px at 75% 30%, rgba(170,200,240,0.8), transparent),
              radial-gradient(1.5px 1.5px at 88% 38%, rgba(215,235,255,0.7), transparent),
              radial-gradient(1.5px 1.5px at 5% 55%, rgba(190,210,245,0.85), transparent),
              radial-gradient(2px 2px at 18% 50%, rgba(205,230,255,0.65), transparent),
              radial-gradient(1.5px 1.5px at 33% 60%, rgba(175,205,240,0.9), transparent),
              radial-gradient(1.5px 1.5px at 48% 48%, rgba(220,240,255,0.7), transparent),
              radial-gradient(2px 2px at 63% 55%, rgba(185,210,250,0.8), transparent),
              radial-gradient(1.5px 1.5px at 78% 50%, rgba(200,220,245,0.75), transparent),
              radial-gradient(1.5px 1.5px at 92% 58%, rgba(165,195,240,0.65), transparent),
              radial-gradient(1.5px 1.5px at 10% 72%, rgba(195,220,255,0.8), transparent),
              radial-gradient(2px 2px at 25% 68%, rgba(180,210,245,0.7), transparent),
              radial-gradient(1.5px 1.5px at 40% 78%, rgba(215,235,255,0.85), transparent),
              radial-gradient(1.5px 1.5px at 55% 65%, rgba(170,200,240,0.75), transparent),
              radial-gradient(1.5px 1.5px at 70% 75%, rgba(200,225,250,0.9), transparent),
              radial-gradient(2px 2px at 85% 68%, rgba(185,210,245,0.65), transparent),
              radial-gradient(1.5px 1.5px at 15% 85%, rgba(210,230,255,0.8), transparent),
              radial-gradient(1.5px 1.5px at 32% 90%, rgba(175,205,240,0.7), transparent),
              radial-gradient(2px 2px at 50% 82%, rgba(195,220,255,0.75), transparent),
              radial-gradient(1.5px 1.5px at 65% 88%, rgba(165,195,245,0.85), transparent),
              radial-gradient(1.5px 1.5px at 80% 78%, rgba(220,240,255,0.65), transparent),
              radial-gradient(1.5px 1.5px at 95% 82%, rgba(190,215,250,0.7), transparent),
              radial-gradient(1.5px 1.5px at 20% 92%, rgba(205,225,245,0.8), transparent),
              radial-gradient(2px 2px at 42% 95%, rgba(170,200,240,0.6), transparent),
              radial-gradient(1.5px 1.5px at 72% 92%, rgba(195,220,255,0.75), transparent)
            `,
          backgroundSize: "130% 130%",
          animation: "galaxyRotate 320s linear infinite reverse",
        }}
      />

      {/* ==================== 第五层：亮星脉冲 ==================== */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '10%', left: '22%', background: '#c8d8ff', boxShadow: '0 0 12px 4px rgba(160,180,255,0.7), 0 0 30px 8px rgba(140,160,240,0.3)', animation: 'starGlow 5s ease-in-out 0s infinite' }} />
        <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '25%', left: '78%', background: '#e0e8ff', boxShadow: '0 0 15px 5px rgba(180,200,255,0.65), 0 0 35px 10px rgba(160,180,240,0.25)', animation: 'starGlow2 6.5s ease-in-out 1.2s infinite' }} />
        <div className="absolute w-[2.5px] h-[2.5px] rounded-full" style={{ top: '8%', left: '55%', background: '#b8c8f0', boxShadow: '0 0 10px 3px rgba(140,170,240,0.6)', animation: 'starSlowFlash 7s ease-in-out 3s infinite' }} />
        <div className="absolute w-[3px] h-[3px] rounded-full" style={{ top: '45%', left: '12%', background: '#d0dcff', boxShadow: '0 0 18px 6px rgba(170,190,255,0.8), 0 0 40px 12px rgba(150,170,240,0.35)', animation: 'starGlow 4.2s ease-in-out 0.8s infinite' }} />
        <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '60%', left: '85%', background: '#c0d0f0', boxShadow: '0 0 10px 3px rgba(150,180,245,0.55)', animation: 'starSlowFlash 8s ease-in-out 1.5s infinite' }} />
        <div className="absolute w-[2.5px] h-[2.5px] rounded-full" style={{ top: '72%', left: '6%', background: '#e4ecff', boxShadow: '0 0 14px 5px rgba(180,200,255,0.7), 0 0 32px 8px rgba(160,180,240,0.3)', animation: 'starGlow2 5.8s ease-in-out 2s infinite' }} />
        <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '88%', left: '38%', background: '#a8b8e8', boxShadow: '0 0 8px 3px rgba(130,160,240,0.5)', animation: 'starGlow 6s ease-in-out 0.3s infinite' }} />
        <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '32%', left: '42%', background: '#d8e0ff', boxShadow: '0 0 12px 4px rgba(170,190,255,0.55)', animation: 'starSlowFlash 5.5s ease-in-out 4s infinite' }} />
        <div className="absolute w-[3px] h-[3px] rounded-full" style={{ top: '18%', left: '92%', background: '#ccdaff', boxShadow: '0 0 16px 5px rgba(160,185,255,0.75), 0 0 38px 10px rgba(140,165,240,0.3)', animation: 'starGlow 3.5s ease-in-out 1.8s infinite' }} />
        <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '55%', left: '30%', background: '#b0c0f0', boxShadow: '0 0 9px 3px rgba(145,175,240,0.6)', animation: 'starGlow2 7.2s ease-in-out 0.5s infinite' }} />
        <div className="absolute w-[2.5px] h-[2.5px] rounded-full" style={{ top: '38%', left: '62%', background: '#e0e8ff', boxShadow: '0 0 13px 4px rgba(175,195,255,0.7), 0 0 28px 7px rgba(155,175,240,0.3)', animation: 'starSlowFlash 4.8s ease-in-out 2.5s infinite' }} />
        <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '80%', left: '72%', background: '#c4d4fc', boxShadow: '0 0 11px 3px rgba(155,180,250,0.65)', animation: 'starGlow 5.2s ease-in-out 3.3s infinite' }} />
        <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '5%', left: '35%', background: '#d4e0ff', boxShadow: '0 0 10px 3px rgba(165,185,255,0.5)', animation: 'starGlow2 6.8s ease-in-out 4.5s infinite' }} />
        <div className="absolute w-[2.5px] h-[2.5px] rounded-full" style={{ top: '93%', left: '58%', background: '#bcc8f8', boxShadow: '0 0 13px 4px rgba(150,175,245,0.7), 0 0 30px 8px rgba(135,160,240,0.3)', animation: 'starSlowFlash 5.3s ease-in-out 0.7s infinite' }} />
        <div className="absolute w-[2px] h-[2px] rounded-full" style={{ top: '68%', left: '48%', background: '#e8f0ff', boxShadow: '0 0 8px 2px rgba(170,190,255,0.6)', animation: 'starGlow 4.5s ease-in-out 1.5s infinite' }} />
      </div>

      {/* ==================== 第六层：术语浮游 ==================== */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none" style={{ fontFamily: "'Cormorant Garamond', 'EB Garamond', 'Noto Serif SC', 'Georgia', 'Songti SC', serif" }}>
        <span className="absolute italic tracking-[0.6em] whitespace-nowrap"
          style={{ fontSize: '96px', fontWeight: 300, top: '20%', left: '10%', color: 'rgba(200,210,230,0.18)', textShadow: '0 0 80px rgba(160,180,220,0.25), 0 0 200px rgba(140,160,210,0.12)', fontStyle: 'italic', animation: 'termFloat1 60s ease-in-out -10s infinite' }}>
          &ensp;交&ensp;响&ensp;
        </span>
        <span className="absolute italic tracking-[0.5em] whitespace-nowrap"
          style={{ fontSize: '32px', fontWeight: 200, top: '12%', left: '70%', color: 'rgba(170,200,230,0.15)', textShadow: '0 0 40px rgba(150,180,220,0.18)', fontStyle: 'italic', animation: 'termFloat2 70s ease-in-out -25s infinite' }}>
          CINEMATIC
        </span>
        <span className="absolute italic tracking-[0.55em] whitespace-nowrap"
          style={{ fontSize: '38px', fontWeight: 250, top: '65%', left: '4%', color: 'rgba(180,190,210,0.16)', textShadow: '0 0 60px rgba(140,160,200,0.2)', fontStyle: 'italic', animation: 'termFloat3 55s ease-in-out -15s infinite' }}>
          &ensp;光&ensp;影&ensp;
        </span>
        <span className="absolute italic tracking-[0.5em] whitespace-nowrap"
          style={{ fontSize: '28px', fontWeight: 200, top: '60%', left: '65%', color: 'rgba(165,195,225,0.14)', textShadow: '0 0 35px rgba(140,170,210,0.16)', fontStyle: 'italic', animation: 'termFloat4 65s ease-in-out -35s infinite' }}>
          RHYTHM
        </span>
        <span className="absolute italic tracking-[0.5em] whitespace-nowrap"
          style={{ fontSize: '30px', fontWeight: 250, top: '6%', left: '48%', color: 'rgba(185,200,220,0.15)', textShadow: '0 0 45px rgba(145,170,210,0.18)', fontStyle: 'italic', animation: 'termFloat5 50s ease-in-out -5s infinite' }}>
          &ensp;视&ensp;界&ensp;
        </span>
      </div>

      {/* ==================== 第七层：液态有机光体 ==================== */}
      <div className="absolute inset-0 z-[1] overflow-hidden pointer-events-none">
        <div className="absolute -top-[15%] -left-[8%] w-[55vw] h-[55vw] opacity-50"
          style={{ background: 'radial-gradient(ellipse at center, rgba(60,60,60,0.35) 0%, rgba(30,30,30,0.15) 40%, transparent 70%)', animation: 'liquidMorph1 20s ease-in-out infinite, drift1 28s ease-in-out infinite', filter: 'blur(100px)' }} />
        <div className="absolute top-[35%] -right-[10%] w-[45vw] h-[45vw] opacity-45"
          style={{ background: 'radial-gradient(ellipse at center, rgba(50,50,50,0.3) 0%, rgba(20,20,20,0.12) 40%, transparent 70%)', animation: 'liquidMorph2 24s ease-in-out infinite, drift2 32s ease-in-out infinite', filter: 'blur(85px)' }} />
        <div className="absolute -bottom-[20%] left-[25%] w-[50vw] h-[50vw] opacity-40"
          style={{ background: 'radial-gradient(ellipse at center, rgba(55,55,55,0.3) 0%, rgba(25,25,25,0.1) 40%, transparent 70%)', animation: 'liquidMorph3 22s ease-in-out infinite, drift3 35s ease-in-out infinite', filter: 'blur(110px)' }} />
      </div>

      {/* ==================== Toast 通知 ==================== */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] px-6 py-3 rounded-full animate-in slide-in-from-top-4 fade-in"
          style={{ background: 'linear-gradient(180deg, rgba(20,20,20,0.85), rgba(8,8,8,0.9))', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
          <div className="flex items-center gap-3">
            <AlertTriangle size={14} className="text-zinc-500" />
            <span className="text-xs font-light text-zinc-300 tracking-wider">{toastMsg}</span>
          </div>
        </div>
      )}

      {/* ==================== 登录卡片：液态玻璃体 ==================== */}
      <div className="relative z-10 w-full max-w-[360px] mx-6 p-8 rounded-[36px] overflow-hidden"
        style={{
          background: 'linear-gradient(165deg, rgba(22,22,22,0.5) 0%, rgba(6,6,6,0.65) 40%, rgba(18,18,18,0.5) 100%)',
          backdropFilter: 'blur(50px)',
          WebkitBackdropFilter: 'blur(50px)',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: `0 50px 120px rgba(0,0,0,0.8), 0 15px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.01)`,
        }}>
        {/* 表面光流层 */}
        <div className="absolute z-0 pointer-events-none"
          style={{ top: '-30%', left: '-40%', width: '50%', height: '50%', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 70%)', animation: 'surfaceFlow 8s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
        <div className="absolute z-0 pointer-events-none"
          style={{ top: '50%', left: '60%', width: '40%', height: '40%', borderRadius: '60% 40% 50% 50% / 50% 50% 40% 60%', background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.03) 0%, transparent 70%)', animation: 'surfaceFlow 11s cubic-bezier(0.4, 0, 0.6, 1) infinite reverse' }} />
        {/* 顶部折射光条 */}
        <div className="absolute top-0 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        {/* 内容区 */}
        <div className="relative z-[5]">
          {/* ★ 返回首页 */}
          <Link href="/" className="inline-flex items-center gap-1.5 mb-6 text-[10px] text-zinc-600 hover:text-zinc-400 tracking-[0.15em] font-light transition-colors"
            style={{ animation: 'fadeSlideUp 0.5s ease-out both' }}>
            ← 返回首页
          </Link>

          {/* LOGO 区 */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 relative"
              style={{ background: 'linear-gradient(135deg, rgba(35,35,35,0.9), rgba(10,10,10,0.95))', boxShadow: '0 0 40px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, transparent 35%, rgba(255,255,255,0.05) 48%, transparent 65%)' }} />
              </div>
              <span className="relative text-white text-[22px] font-black tracking-tighter select-none" style={{ textShadow: '0 0 25px rgba(255,255,255,0.08)' }}>W</span>
            </div>
            <h1 className="text-lg font-thin text-white tracking-[0.4em] mb-2 select-none" style={{ letterSpacing: '0.5em' }}>WELCOME</h1>
            <p className="text-[10px] text-zinc-700 tracking-[0.3em] font-light select-none">登录以继续</p>
          </div>

          {/* 表单区 */}
          <div className="space-y-5">
            {!isRegistering ? (
              <>
                {/* 登录模式 */}
                <div style={{ animation: 'fadeSlideUp 0.7s ease-out 0.1s both' }}>
                  <label className="block text-[9px] font-light text-zinc-500 tracking-[0.25em] mb-2 ml-1 select-none">ACCOUNT</label>
                  <input type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-all" placeholder="输入账号" />
                </div>
                <div style={{ animation: 'fadeSlideUp 0.7s ease-out 0.2s both' }}>
                  <label className="block text-[9px] font-light text-zinc-500 tracking-[0.25em] mb-2 ml-1 select-none">PASSWORD</label>
                  <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-all" placeholder="输入密码" />
                </div>
                <div className="pt-3" style={{ animation: 'fadeSlideUp 0.7s ease-out 0.35s both' }}>
                  <button onClick={handleLogin} disabled={loginLoading || !loginUsername.trim() || !loginPassword.trim()}
                    className="relative w-full py-3.5 rounded-2xl font-light text-[13px] tracking-[0.2em] transition-all duration-700 disabled:opacity-20 disabled:cursor-not-allowed overflow-hidden group border border-transparent"
                    style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)', borderColor: 'rgba(255,255,255,0.12)', boxShadow: '0 0 40px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)' }}
                    onMouseEnter={(e) => { if (e.currentTarget.disabled) return; e.currentTarget.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.07) 100%)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.boxShadow = '0 0 60px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.boxShadow = '0 0 40px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; }}>
                    <div className="absolute inset-0 rounded-2xl pointer-events-none"
                      style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 45%, rgba(255,255,255,0.1) 0%, transparent 70%)', animation: 'pulseCore 3s ease-in-out infinite' }} />
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {loginLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                      {loginLoading ? "验证中..." : "SIGN IN"}
                    </span>
                  </button>
                </div>
                <div style={{ animation: 'fadeSlideUp 0.7s ease-out 0.45s both' }}>
                  <button onClick={() => setIsRegistering(true)}
                    className="w-full py-3 rounded-2xl font-light text-[12px] tracking-[0.2em] transition-all duration-700 text-zinc-500 hover:text-zinc-300"
                    style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(255,255,255,0.04)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.015)'; e.currentTarget.style.boxShadow = 'none'; }}>
                    CREATE ACCOUNT
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* 注册模式 */}
                <button onClick={() => { setIsRegistering(false); setRegisterUsername(""); setRegisterPassword(""); setRegisterConfirmPassword(""); setRegisterInviteCode(""); }}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors mb-5" style={{ animation: 'fadeSlideUp 0.5s ease-out both' }}>←</button>
                <div style={{ animation: 'fadeSlideUp 0.6s ease-out 0.08s both' }}>
                  <label className="block text-[9px] font-light text-zinc-500 tracking-[0.25em] mb-1.5 ml-1 select-none">USERNAME</label>
                  <input type="text" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-all" placeholder="设置登录账号" />
                </div>
                <div style={{ animation: 'fadeSlideUp 0.6s ease-out 0.12s both' }}>
                  <label className="block text-[9px] font-light text-zinc-500 tracking-[0.25em] mb-1.5 ml-1 select-none">PASSWORD</label>
                  <input type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-all" placeholder="至少4位" />
                </div>
                <div style={{ animation: 'fadeSlideUp 0.6s ease-out 0.16s both' }}>
                  <label className="block text-[9px] font-light text-zinc-500 tracking-[0.25em] mb-1.5 ml-1 select-none">CONFIRM</label>
                  <input type="password" value={registerConfirmPassword} onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-all" placeholder="再次输入密码" />
                </div>
                <div style={{ animation: 'fadeSlideUp 0.6s ease-out 0.2s both' }}>
                  <label className="block text-[9px] font-light text-zinc-500 tracking-[0.25em] mb-1.5 ml-1 select-none">
                    INVITE CODE <span className="text-red-400/60">*</span>
                  </label>
                  <input type="text" value={registerInviteCode} onChange={(e) => setRegisterInviteCode(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-all" placeholder="联系管理员获取" />
                </div>
                <div className="pt-2" style={{ animation: 'fadeSlideUp 0.6s ease-out 0.28s both' }}>
                  <button onClick={handleRegister} disabled={registerLoading || !registerUsername.trim() || !registerPassword.trim() || !registerConfirmPassword.trim()}
                    className="relative w-full py-3.5 rounded-2xl font-light text-[13px] tracking-[0.2em] transition-all duration-700 disabled:opacity-20 disabled:cursor-not-allowed overflow-hidden group border border-transparent"
                    style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)', borderColor: 'rgba(255,255,255,0.12)', boxShadow: '0 0 40px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)' }}>
                    <div className="absolute inset-0 rounded-2xl pointer-events-none"
                      style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 45%, rgba(255,255,255,0.1) 0%, transparent 70%)', animation: 'pulseCore 3s ease-in-out infinite' }} />
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {registerLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                      {registerLoading ? "注册中..." : "REGISTER"}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 底部反射光条 */}
        <div className="absolute bottom-0 left-[15%] right-[15%] h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03) 20%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 80%, transparent)', backgroundSize: '200% 100%', animation: 'barFlow 6s linear infinite' }} />
      </div>
    </div>
  );
}
