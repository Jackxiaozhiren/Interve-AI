'use client'

import { ProtectedRoute } from "@/components/auth";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Interve AI 控制台</h1>
          <Link href="/setup" className={buttonVariants({ variant: "default" })}>
            New Mock Interview
          </Link>
        </div>
      </div>
    </ProtectedRoute>
  );
}
