import React from "react";
import { ChatBackground } from "@/components/interve-ui/backgrounds";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-screen w-full overflow-hidden flex bg-transparent text-[var(--interve-text-body)]">
      {/* Background Layer */}
      <ChatBackground />
      
      {/* Content Layer */}
      <div className="relative z-0 flex flex-1 w-full h-full">
        {children}
      </div>
    </div>
  );
}
