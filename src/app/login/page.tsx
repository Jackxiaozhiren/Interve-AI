'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/utils/constants';

function LoginForm() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      const from = searchParams.get('from');
      router.replace(from || ROUTES.DASHBOARD);
    }
  }, [isAuthenticated, router, searchParams]);

  // Hide error after 5s
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Simulate API call and validation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // To simulate an error, you could uncomment the next line
      // throw new Error('Simulated login failure');

      await login({
        id: '1',
        username: '测试用户',
        email: 'test@example.com'
      });
      // the useEffect above handles the redirect once isAuthenticated becomes true
    } catch (_err) {
      setError('登录失败，请检查您的凭证或稍后再试。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900">
          登录 Interve AI
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] rounded-[6px] px-[16px] py-[12px] text-sm transition-all duration-300">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                邮箱地址
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  defaultValue="test@example.com"
                  className="appearance-none block w-full h-[48px] px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                密码
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  defaultValue="123456"
                  className="appearance-none block w-full h-[48px] px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <motion.button
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.1 }}
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center h-[48px] px-4 border border-transparent rounded-md shadow-sm text-[15px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed items-center"
              >
                {isSubmitting ? (
                  <>
                    <motion.svg
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="-ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </motion.svg>
                    登录中...
                  </>
                ) : (
                  '登录'
                )}
              </motion.button>
            </div>
          </form>

          <div className="mt-6 flex items-center justify-center">
            <Link 
              href={ROUTES.HOME}
              className="text-[#6b7280] hover:text-[#374151] text-[14px] transition-colors"
            >
              ← 返回首页
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-80px)] flex items-center justify-center">加载中...</div>}>
      <LoginForm />
    </Suspense>
  );
}
