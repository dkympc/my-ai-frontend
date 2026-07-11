"use client";

import { SendHorizontal } from "lucide-react";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatBottombarProps {
  sendMessage: (content: string) => void;
}

export default function ChatBottombar({ sendMessage }: ChatBottombarProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input);
      setInput("");
    }
  };

  return (
    <div className="p-4 flex justify-between w-full items-center gap-2 border-t">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
        placeholder="输入消息..."
        className="flex-1"
      />
      <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
        <SendHorizontal className="w-5 h-5" />
      </Button>
    </div>
  );
}