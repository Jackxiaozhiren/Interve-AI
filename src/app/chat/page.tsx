"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { InterveSidebar, InterveSidebarItem, InterveButton } from "@/components/interve-ui";
import { 
  InterveMessageCard, 
  IntervePromptInput, 
  InterveModelSelector,
} from "@/components/interve-ui/chat";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

const ChatBackground = dynamic(() => import("@/components/interve-ui/backgrounds").then(m => m.ChatBackground), { ssr: false });

import { motion, AnimatePresence } from "framer-motion";

export default function ChatPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedModel, setSelectedModel] = useState("glm-4-flash");
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/interview-chat',
    body: {
      model: selectedModel,
      role: "Software Engineer",
      level: "Mid-Level",
      persona: "professional"
    }
  }), [selectedModel]);
  
  const { messages, sendMessage, status } = useChat({
    transport,
    messages: [
      {
        id: "1",
        role: "assistant" as const,
        content: "您好！我是 Interve AI。准备好开始今天的技术面试模拟了吗？我们可以先从 React 状态管理聊起。",
        parts: [{ type: "text" as const, text: "您好！我是 Interve AI。准备好开始今天的技术面试模拟了吗？我们可以先从 React 状态管理聊起。" }]
      }
    ]
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  const handleSend = (value: string) => {
    if (!value.trim() || isLoading) return;
    sendMessage({ text: value });
    setInputValue("");
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="flex w-full h-full bg-[#F1F3F5] text-[var(--interve-text-body)] selection:bg-[#165DFF]/20 relative overflow-hidden">
      <ChatBackground />

      {/* Sidebar */}
      <InterveSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        className="shrink-0 z-10 shadow-[var(--interve-shadow-md)]"
        header={
          <InterveButton 
            variant="secondary" 
            className="w-full justify-start border-dashed bg-transparent shadow-none"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            }
          >
            {!collapsed && "新建对话"}
          </InterveButton>
        }
        footer={
          <div className="flex items-center gap-3 w-full">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--interve-brand-accent)] to-[#6AA1FF] shrink-0" />
            {!collapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-[13px] font-medium text-[var(--interve-text-title)] truncate">面试官</span>
                <span className="text-[11px] text-[var(--interve-text-secondary)] truncate">Pro 用户</span>
              </div>
            )}
          </div>
        }
      >
        {!collapsed && (
          <div className="mb-2 px-2 text-[11px] font-semibold text-[var(--interve-text-placeholder)] uppercase tracking-wider">
            今天
          </div>
        )}
        <InterveSidebarItem
          label="React 状态管理"
          active
          collapsed={collapsed}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          }
        />
        <InterveSidebarItem
          label="系统设计：高并发秒杀"
          collapsed={collapsed}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          }
        />

        {!collapsed && (
          <div className="mt-6 mb-2 px-2 text-[11px] font-semibold text-[var(--interve-text-placeholder)] uppercase tracking-wider">
            昨天
          </div>
        )}
        <InterveSidebarItem
          label="TypeScript 高级类型"
          collapsed={collapsed}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          }
        />
      </InterveSidebar>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        
        {/* Top Status Bar */}
        <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-[var(--interve-divider)] bg-white/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <h2 className="font-medium text-[var(--interve-text-title)]">React 状态管理</h2>
            <InterveModelSelector 
              models={[
                { id: "glm-4-flash", name: "GLM-4 Flash", badge: "Fast" },
                { id: "glm-4-plus", name: "GLM-4 Plus", badge: "Pro" },
                { id: "glm-4-long", name: "GLM-4 Long", description: "长文本优化" },
              ]}
              value={selectedModel}
              onChange={setSelectedModel}
            />
          </div>
          <div className="flex items-center gap-2">
            <InterveButton variant="text" size="sm" icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                <polyline points="16 6 12 2 8 6"></polyline>
                <line x1="12" y1="2" x2="12" y2="15"></line>
              </svg>
            }>分享</InterveButton>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-8 lg:px-12 scroll-smooth">
          <div className="max-w-3xl mx-auto flex flex-col">
            <AnimatePresence initial={false} mode="popLayout">
              {messages.map((msg, index) => {
                const prevRole = index > 0 ? messages[index - 1].role : null;
                const isSameSender = prevRole === msg.role;
                return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    duration: 0.3,
                    ease: [0.2, 0, 0, 1],
                    delay: Math.min(index * 0.05, 0.5)
                  }}
                  layout
                  className={index === 0 ? "" : isSameSender ? "mt-4" : "mt-10"}
                >
                  <InterveMessageCard
                    role={msg.role as 'user' | 'assistant'}
                    content={typeof msg.content === 'string' ? msg.content : ''}
                    timestamp={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    className="!animate-none"
                  />
                </motion.div>
                );
              })}
              {isLoading && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
                  layout
                  className="mt-10"
                >
                  <InterveMessageCard
                    role="assistant"
                    content=""
                    streaming={true}
                    className="!animate-none"
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="shrink-0 p-4 lg:p-6 bg-gradient-to-t from-[#FAFAFC] via-[#FAFAFC]/90 to-transparent pt-12">
          <div className="max-w-3xl mx-auto">
            <IntervePromptInput
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSend}
              placeholder="发送消息 · Shift + Enter 换行"
              showAttach
              maxLength={4000}
            />
            <div className="text-center mt-2 text-[11px] text-[var(--interve-text-placeholder)]">
              AI 会产生不可避免的错误。请核查重要信息。
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

