"use client";

import React, { useState } from "react";
import { ChatList } from "./chat-list";
import ChatBottombar from "./chat-bottombar";

// 这是一个简化的布局，暂时不带复杂的侧边栏折叠逻辑，方便你先跑通
export function ChatLayout() {
  const [messages, setMessages] = useState([
    { id: 1, role: "assistant", content: "你好！我是你的 AI 助手，有什么可以帮你的吗？" }
  ]);

  const handleSendMessage = (content: string) => {
    const userMsg = { id: Date.now(), role: "user", content };
    setMessages(prev => [...prev, userMsg]);
    
    // 这里留给对接你的 FastAPI 逻辑
    console.log("即将发送给后端:", content);
  };

  return (
    <div className="flex h-[80vh] w-full bg-background border rounded-xl overflow-hidden shadow-xl">
      {/* 侧边栏可以以后再加，现在先做核心聊天区 */}
      <div className="flex flex-col h-full w-full">
        <div className="p-4 border-b font-semibold flex justify-between items-center bg-card">
          <span>依然AI V2.0</span>
          <div className="text-xs text-muted-foreground">FastAPI + Next.js</div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <ChatList messages={messages} />
        </div>

        <ChatBottombar sendMessage={handleSendMessage} />
      </div>
    </div>
  );
}