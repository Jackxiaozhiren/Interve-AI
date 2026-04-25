'use client';

import { CtaButton } from '@/components/auth';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] text-center px-4 overflow-hidden">
      <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 sm:mb-6 leading-tight">Interve AI - 智能面试助手</h1>
      <p className="text-lg sm:text-xl text-gray-600 mb-8 sm:mb-10 max-w-2xl">
        提供最真实的 AI 面试模拟体验，助力您的求职之旅。
      </p>
      <CtaButton />
    </div>
  );
}
