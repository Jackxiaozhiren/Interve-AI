'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/utils/constants';

export function CtaButton() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const handleClick = () => {
    if (isAuthenticated) {
      router.push(ROUTES.DASHBOARD);
    } else {
      router.push(ROUTES.LOGIN);
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1 }}
      onClick={handleClick}
      disabled={isLoading}
      className={`
        bg-[#6366f1] hover:bg-[#4f46e5] text-white
        rounded-[8px] px-[28px] py-[12px]
        text-[16px] font-[600]
        transition-colors duration-200 ease-in-out
        ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}
      `}
    >
      {isAuthenticated ? '进入控制台' : '立即免费体验'}
    </motion.button>
  );
}
