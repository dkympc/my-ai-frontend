"use client";

import { cn } from "@/lib/utils";
import React, { useRef, useEffect } from "react";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
// 1. 把渲染相关的导入搬到这里
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatList({ messages }: { messages: Message[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="w-full overflow-y-auto h-full flex flex-col p-4 gap-6">
      {messages.map((message, index) => (
        <div
          key={index}
          className={cn(
            "flex items-start gap-4 p-2 transition-all",
            message.role === "user" ? "flex-row-reverse" : "flex-row"
          )}
        >
          {/* 头像 */}
          <Avatar className="w-8 h-8 shrink-0 border">
            <AvatarImage src={message.role === "user" ? "/user.png" : "/bot.png"} />
          </Avatar>

          {/* 消息正文 */}
          <div className={cn(
            "rounded-2xl px-4 py-2 max-w-[85%] shadow-sm text-sm leading-relaxed",
            message.role === "user" 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted text-foreground border"
          )}>
            {/* 2. 使用 ReactMarkdown 渲染内容 */}
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <div className="my-2 rounded-md overflow-hidden">
                      <SyntaxHighlighter
                        style={vscDarkPlus as any}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code className="bg-black/10 rounded px-1" {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}