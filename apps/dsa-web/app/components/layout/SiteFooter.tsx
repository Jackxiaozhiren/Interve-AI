import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

// Source: TailAdmin footer reference (minimal link row, zinc restyle)
export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-6">
        <p className="text-xs text-zinc-500">Evidence before claim · Ask. Analyze. Verify. Reproduce.</p>
        <nav className="flex flex-wrap items-center gap-4 text-xs text-zinc-600" aria-label="Footer">
          <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-zinc-900">
            GitHub
          </a>
          <Link href="/research" className="hover:text-zinc-900">
            Docs
          </Link>
          <a href={API_BASE_URL} target="_blank" rel="noreferrer" className="hover:text-zinc-900">
            API
          </a>
          <a href={`${API_BASE_URL}/health`} target="_blank" rel="noreferrer" className="font-mono hover:text-zinc-900">
            /health
          </a>
        </nav>
      </div>
    </footer>
  );
}
