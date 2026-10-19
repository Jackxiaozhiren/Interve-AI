'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/utils/constants';

export function CtaButton() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const handleClick = () => {
    if (isAuthenticated) {
      router.push(ROUTES.DASHBOARD);
    } else {
      router.push(ROUTES.LOGIN);
    }
  };

  // This used to carry `disabled={isLoading}`, which is the mount-time session
  // probe's answer: every press inside that window (a token refresh plus a
  // `GET /user` to the auth host, 1.5-2.4 s per cold round trip measured on the
  // owner's own network) did literally nothing. The press is a router push, so it
  // needs no answer to be correct — and sending a visitor to /login while the
  // probe is still running is not a wrong turn, because /login forwards to the
  // dashboard the moment the bridge lands.

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1 }}
      onClick={handleClick}
      className="
        bg-[#6366f1] hover:bg-[#4f46e5] text-white
        rounded-[8px] px-[28px] py-[12px]
        text-[16px] font-[600]
        transition-colors duration-200 ease-in-out
      "
    >
      {isAuthenticated ? '进入控制台' : '立即免费体验'}
    </motion.button>
  );
}
