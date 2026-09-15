'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { CtaButton } from '@/components/auth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/practice', label: '题库' },
  { href: '/setup', label: '开始面试' },
  { href: '/dashboard', label: '控制台' },
];

/** 顶栏 API 状态点：GET /api/session 任何 HTTP 响应即在线（405 也算存活），仅网络异常判离线。 */
function ApiStatusDot() {
  const [status, setStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        await fetch('/api/session', { method: 'GET', cache: 'no-store' });
        if (!cancelled) setStatus('online');
      } catch {
        if (!cancelled) setStatus('offline');
      }
    };
    probe();
    const timer = setInterval(probe, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <span
      role="status"
      aria-label={status === 'online' ? 'API 在线' : status === 'offline' ? 'API 离线' : 'API 检查中'}
      title={status === 'online' ? 'API 在线' : status === 'offline' ? 'API 离线' : 'API 检查中'}
      className={cn(
        'h-2 w-2 rounded-full',
        status === 'online' && 'bg-emerald-500',
        status === 'offline' && 'bg-red-500',
        status === 'checking' && 'animate-pulse bg-slate-300'
      )}
    />
  );
}

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('已退出登录');
    router.push('/');
  };

  return (
    <nav
      aria-label="主导航"
      className="sticky top-0 h-[64px] bg-white/90 backdrop-blur-md border-b border-[#e5e7eb] px-[16px] sm:px-[24px] shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] flex items-center justify-between z-50 relative shrink-0"
    >
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center text-[18px] sm:text-xl font-bold text-gray-900 hover:opacity-80 transition-opacity">
          Interve AI
        </Link>
        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? 'page' : undefined}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                pathname === link.href
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Desktop Menu */}
      <div className="hidden sm:flex items-center gap-3">
        <ApiStatusDot />
        {isAuthenticated && user ? (
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold overflow-hidden">
                {user.avatar ? (
                  <Image src={user.avatar} alt={`${user.username}的头像`} width={32} height={32} className="w-full h-full object-cover" />
                ) : (
                  user.username?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <span className="text-sm font-medium text-gray-700">{user.username}</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.1 }}
              onClick={handleLogout}
              className="bg-transparent text-[#ef4444] hover:bg-[#fef2f2] border border-[#fecaca] rounded-[6px] px-[16px] py-[8px] text-[14px] transition-colors"
            >
              登出
            </motion.button>
          </div>
        ) : (
          <CtaButton />
        )}
      </div>

      {/* Mobile Menu Toggle */}
      <div className="sm:hidden flex items-center gap-3">
        <ApiStatusDot />
        <button
          onClick={() => setIsMenuOpen(true)}
          aria-label="打开菜单"
          aria-expanded={isMenuOpen}
          className="p-2 -mr-2 text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-md"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile Slide-out Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black z-40 sm:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed top-0 right-0 h-full w-[280px] bg-white shadow-xl z-50 p-6 flex flex-col sm:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="移动端菜单"
            >
              <div className="flex justify-end mb-8">
                <button
                  onClick={() => setIsMenuOpen(false)}
                  aria-label="关闭菜单"
                  className="p-2 -mr-2 text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-md"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <nav aria-label="移动端导航" className="flex flex-col gap-1 mb-8">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    aria-current={pathname === link.href ? 'page' : undefined}
                    className={cn(
                      'rounded-xl px-4 py-3 text-[15px] font-medium transition-colors',
                      pathname === link.href
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="flex-1 flex flex-col">
                {isAuthenticated && user ? (
                  <div className="flex flex-col space-y-6">
                    <div className="flex items-center space-x-3 pb-6 border-b border-gray-100">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold overflow-hidden text-lg">
                        {user.avatar ? (
                          <Image src={user.avatar} alt={`${user.username}的头像`} width={48} height={48} className="w-full h-full object-cover" />
                        ) : (
                          user.username?.charAt(0).toUpperCase() || 'U'
                        )}
                      </div>
                      <span className="text-base font-medium text-gray-900">{user.username}</span>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full bg-transparent text-[#ef4444] hover:bg-[#fef2f2] border border-[#fecaca] rounded-[6px] px-[16px] py-[12px] text-[15px] font-medium transition-colors"
                    >
                      登出
                    </motion.button>
                  </div>
                ) : (
                  <div onClick={() => setIsMenuOpen(false)} className="flex flex-col w-full">
                    <CtaButton />
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
