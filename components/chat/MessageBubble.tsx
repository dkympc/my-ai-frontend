// components/chat/MessageBubble.tsx
import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Bot, Pencil, FileText } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore'; // 👈 引入全局通道

interface MessageBubbleProps {
  message: any;
  isTyping: boolean;
  isLast: boolean;
  onEdit: () => void;
}

const MessageBubble = memo(({ message: m, isTyping, isLast, onEdit }: MessageBubbleProps) => {
  
  // ⚡ 订阅吐字通道（只有当前气泡会因此发生无感刷新，别的组件绝对不刷新）
  const streamText = useAppStore(state => state.streamText);

  // 智能接管文本：如果在打字，显示实时文字；如果不在打字，显示历史文字
  const displayContent = (isLast && isTyping && m.role === 'assistant')
    ? (streamText || m.content)
    : m.content;

  return (
    <div className={`group flex gap-5 ${m.role === 'user' ? 'justify-end' : 'justify-start'} message-appear`}>
      {m.role !== 'user' && (
        <div className="w-8 h-8 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center border border-white/10 text-zinc-400 flex-shrink-0 shadow-lg mt-1">
          <Bot size={16}/>
        </div>
      )}
      
      {m.role === 'user' && !isTyping && (
        <button onClick={onEdit} className="opacity-0 group-hover:opacity-100 p-2 text-zinc-600 hover:text-white transition-all mt-1 hover:scale-110">
          <Pencil size={14} />
        </button>
      )}

      <div className={`max-w-[85%] rounded-[24px] px-6 py-4 ${m.role === 'user' ? 'bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] text-zinc-100' : 'text-zinc-300 bg-transparent border-none shadow-none leading-relaxed'}`}>
        <div className={m.role === 'assistant' && isLast && isTyping ? "typing-cursor" : ""}>
          {Array.isArray(displayContent) ? (
            <div className="space-y-4">
              {displayContent.map((part: any, pIdx: number) => (
                <div key={pIdx}>
                  {part.type === 'text' && (
                    <ReactMarkdown components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || ''); 
                        return !inline && match ? (
                          <div className="my-4 rounded-xl overflow-hidden border border-white/10 shadow-2xl"><SyntaxHighlighter style={vscDarkPlus as any} language={match[1]} PreTag="div" {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter></div>
                        ) : ( <code className={`${className} bg-white/10 rounded-md px-1.5 py-0.5 text-zinc-200 font-mono text-sm border border-white/5`} {...props}>{children}</code> ); 
                      }
                    }}>{part.text}</ReactMarkdown>
                  )}
                  {part.type === 'image_url' && (
                    part.image_url.url.startsWith('data:image') ? (<img src={part.image_url.url} alt="Uploaded" className="max-w-full rounded-xl border border-white/10 shadow-2xl" />) : (<div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl max-w-sm"><FileText className="text-white" size={20} /><div className="truncate text-sm font-medium text-zinc-300">已解析文件数据</div></div>)
                  )}
                </div>
              ))}
            </div>
          ) : (
            <ReactMarkdown components={{
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || ''); 
                return !inline && match ? (
                  <div className="my-4 rounded-xl overflow-hidden border border-white/10 shadow-2xl"><SyntaxHighlighter style={vscDarkPlus as any} language={match[1]} PreTag="div" {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter></div>
                ) : ( <code className={`${className} bg-white/10 rounded-md px-1.5 py-0.5 text-zinc-200 font-mono text-sm border border-white/5`} {...props}>{children}</code> ); 
              }
            }}>{displayContent}</ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // 💡 安全的底座：依靠 Zustand 的状态穿透，这边的 React 渲染对比越严格越好。
  if (prevProps.message.content !== nextProps.message.content) return false;
  if (prevProps.isTyping !== nextProps.isTyping) return false;
  if (prevProps.isLast !== nextProps.isLast) return false;
  return true; // 彻底冻结！
});

export default MessageBubble;