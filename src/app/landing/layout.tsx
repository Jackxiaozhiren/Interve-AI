import React from "react";
import { LandingBackground } from "@/components/interve-ui/backgrounds";

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-[#FAFAFC] overflow-x-hidden text-[var(--interve-text-body)]">
      {/* Background layer */}
      <LandingBackground />
      
      {/* Content layer */}
      <div className="relative z-0">
        {children}
      </div>
    </div>
  );
}
