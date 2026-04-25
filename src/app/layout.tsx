import { Providers } from "@/components/providers";
import { Toaster } from "sonner";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-[100dvh] flex flex-col bg-background text-foreground font-sans tracking-tight">
        <a href="#main-content" className="skip-nav">
          跳转到主要内容
        </a>
        <Providers>
          <div id="main-content">{children}</div>
        </Providers>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(0, 0, 0, 0.04)',
              color: '#1D2129',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
              borderRadius: '12px',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 500,
            },
            className: 'glass-toast',
          }}
        />
      </body>
    </html>
  );
}
