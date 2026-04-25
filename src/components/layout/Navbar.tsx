'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { CtaButton } from '@/components/auth';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    if (window.confirm('确定要退出登录吗？')) {
      await logout();
      alert('已成功退出登录');
      router.push('/');
    }
  };

  return (
    <nav className="h-[64px] bg-white border-b border-[#e5e7eb] px-[16px] sm:px-[24px] shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] flex items-center justify-between z-50 relative shrink-0">
      {/* Mobile placeholder to maintain center alignment for logo */}
      <div className="w-8 sm:hidden"></div>

      <Link href="/" className="flex items-center text-[18px] sm:text-xl font-bold text-gray-900 hover:opacity-80 transition-opacity absolute left-1/2 -translate-x-1/2 sm:static sm:translate-x-0">
        Interve AI
      </Link>
      
      {/* Desktop Menu */}
      <div className="hidden sm:flex items-center space-x-4">
        {isAuthenticated && user ? (
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold overflow-hidden">
                {user.avatar ? (
                  <Image src={user.avatar} alt="avatar" width={32} height={32} className="w-full h-full object-cover" />
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
      <div className="sm:hidden">
        <button onClick={() => setIsMenuOpen(true)} className="p-2 -mr-2 text-gray-600 hover:text-gray-900 focus:outline-none">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            >
              <div className="flex justify-end mb-8">
                <button onClick={() => setIsMenuOpen(false)} className="p-2 -mr-2 text-gray-600 hover:text-gray-900 focus:outline-none">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="flex-1 flex flex-col">
                {isAuthenticated && user ? (
                  <div className="flex flex-col space-y-6">
                    <div className="flex items-center space-x-3 pb-6 border-b border-gray-100">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold overflow-hidden text-lg">
                        {user.avatar ? (
                          <Image src={user.avatar} alt="avatar" width={48} height={48} className="w-full h-full object-cover" />
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
