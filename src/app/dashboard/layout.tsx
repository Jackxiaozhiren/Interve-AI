"use client";

import { ReactNode, useState, createContext, useContext, useRef, useEffect } from "react";
import { Sparkle, SquaresFour, FileText, Gear, SignOut, CloudArrowUp } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { motion } from "framer-motion";
import { GlobalBackground } from "@/components/ui/global-background";
import { ScrollProgress } from "@/components/ui/scroll-progress";
import { OnboardingTour } from "@/components/dashboard/OnboardingTour";
import { useAuth } from "@/context";
import { IntervePageLoader } from "@/components/interve-ui/loading";

interface ModalContextType {
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}

const ModalContext = createContext<ModalContextType>({
  isModalOpen: false,
  setIsModalOpen: () => {},
});

export const useModalState = () => useContext(ModalContext);

import { Navbar } from "@/components/layout/Navbar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: SquaresFour },
    { name: "My Interviews", href: "/dashboard", icon: FileText },
    { name: "Knowledge Base", href: "/dashboard/knowledge", icon: CloudArrowUp },
    { name: "Settings", href: "/dashboard/settings", icon: Gear },
  ];

  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  // Optionally show a loading skeleton while checking auth
  if (isLoading || !user) {
    return (
      <div className="min-h-[100dvh] bg-[var(--interve-bg-secondary)] flex items-center justify-center">
        <IntervePageLoader />
      </div>
    );
  }

  return (
    <ModalContext.Provider value={{ isModalOpen, setIsModalOpen }}>
      <div className="min-h-[100dvh] bg-[var(--interve-bg-secondary)] relative font-sans overflow-hidden flex flex-col">
        <Navbar />
        <motion.div
          animate={{
            scale: isModalOpen ? 0.96 : 1,
            opacity: isModalOpen ? 0.6 : 1,
            borderRadius: isModalOpen ? "32px" : "0px",
            y: isModalOpen ? "2%" : "0%",
          }}
          transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
          style={{ transformOrigin: "top center" }}
          className="flex-1 bg-[#FAFAFA] flex selection:bg-sky-200/50 relative overflow-hidden w-full origin-top"
        >
          <ScrollProgress containerRef={mainRef} />
          <GlobalBackground />
          <OnboardingTour />

          {/* Floating Sidebar - Liquid Glassmorphism */}
          <aside className="w-[280px] m-6 rounded-[2.5rem] border border-white shadow-[0_12px_40px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.8)] flex flex-col justify-between sticky top-6 h-[calc(100vh-3rem-64px)] z-40 bg-white/70 backdrop-blur-3xl overflow-hidden group/sidebar">
            <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-white/10 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-1000 pointer-events-none" />
            <div className="p-8 relative z-10">
              <Link href="/" className="text-[22px] font-serif font-semibold tracking-tight text-[#111111] flex items-center gap-3 mb-12 pl-1 group/logo relative">
                <div className="absolute -inset-2 bg-white/50 rounded-2xl blur-lg opacity-0 group-hover/logo:opacity-100 transition-opacity duration-500" />
                <div className="p-2.5 rounded-[14px] bg-gradient-to-br from-white to-sky-50 border border-sky-100 shadow-[0_4px_12px_rgba(14,165,233,0.1)] group-hover/logo:scale-105 group-hover/logo:shadow-[0_8px_20px_rgba(14,165,233,0.2)] transition-all duration-500 ease-out relative z-10">
                  <Sparkle weight="fill" className="w-6 h-6 text-sky-500" />
                </div>
                <span className="relative z-10">Interve AI</span>
              </Link>

              <nav className="space-y-2.5" aria-label="Dashboard navigation">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link 
                      key={item.name} 
                      href={item.href} 
                      className={buttonVariants({
                        variant: "ghost",
                        className: `w-full justify-start gap-4 transition-all duration-500 rounded-[20px] font-medium h-[52px] text-[14.5px] relative overflow-hidden group/navitem ${
                          isActive 
                            ? "text-sky-800 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,1)] border border-white" 
                            : "text-slate-500 hover:text-slate-800 hover:bg-white/60 border border-transparent"
                        }`
                      })}
                    >
                        {isActive && (
                          <motion.div 
                            layoutId="sidebar-active-indicator"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-gradient-to-b from-sky-400 to-emerald-400 rounded-r-full shadow-[0_0_12px_rgba(56,189,248,0.6)]" 
                          />
                        )}
                        <Icon weight={isActive ? "fill" : "regular"} className={`w-[22px] h-[22px] transition-transform duration-500 ${isActive ? "text-sky-500" : "text-slate-400 group-hover/navitem:scale-110 group-hover/navitem:text-slate-600"}`} />
                        <span className="tracking-wide">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="p-8 relative z-10">
              <Button 
                onClick={() => logout()}
                variant="ghost" 
                className="w-full justify-start gap-4 text-slate-500 hover:text-rose-600 hover:bg-rose-50/80 border border-transparent hover:border-rose-100/50 shadow-[0_4px_20px_rgba(0,0,0,0.0)] hover:shadow-[0_4px_20px_rgba(244,63,94,0.05)] transition-all duration-500 rounded-[20px] font-medium h-[52px] text-[14.5px] group/logout"
              >
                <SignOut weight="regular" className="w-[22px] h-[22px] text-slate-400 group-hover/logout:text-rose-500 group-hover/logout:-translate-x-1 transition-all" />
                <span className="tracking-wide">Log out</span>
              </Button>
            </div>
          </aside>

          {/* Main Content Area */}
          <main ref={mainRef} className="flex-1 p-8 lg:p-12 overflow-y-auto relative z-10 w-full h-[100dvh] responsive-container" role="main">
            <div className="max-w-6xl mx-auto h-full">
              {children}
            </div>
          </main>
        </motion.div>
      </div>
    </ModalContext.Provider>
  );
}
