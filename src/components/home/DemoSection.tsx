import React from "react";
import { InterveMessageCard } from "@/components/interve-ui/chat";

export function DemoSection() {
  return (
    <section id="demo" className="w-full flex flex-col items-center gap-12">
      <div className="w-full max-w-4xl interve-glass rounded-2xl border border-white/50 shadow-[var(--interve-shadow-card)] overflow-hidden">
        <div className="bg-white/40 border-b border-white/30 px-4 py-3 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56]"></div>
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E]"></div>
            <div className="w-3 h-3 rounded-full bg-[#27C93F]"></div>
          </div>
          <div className="mx-auto text-xs font-medium text-[var(--interve-text-secondary)]">AI 模拟面试演示</div>
        </div>
        <div className="p-6 md:p-8 flex flex-col gap-6 bg-white/30 backdrop-blur-md">
          <InterveMessageCard
            role="assistant"
            content="你好！我是今天的AI面试官。我们注意到你在简历中提到了丰富的 React 开发经验。能谈谈你在最近的项目中是如何处理复杂状态管理的吗？"
            timestamp="10:00"
          />
          <InterveMessageCard
            role="user"
            content="你好！在最近的电商项目中，由于涉及到购物车、用户偏好和复杂的过滤条件，我们从 Redux 迁移到了 Zustand 结合 React Query 的方案。这大大减少了样板代码，并且..."
            timestamp="10:01"
          />
          <InterveMessageCard
            role="assistant"
            content="很好的选择。React Query 处理了服务端状态，而 Zustand 管理了客户端状态。那么在迁移过程中，你们遇到了哪些性能挑战？是如何解决不必要重渲染的问题的？"
            timestamp="10:01"
          />
        </div>
      </div>
    </section>
  );
}
