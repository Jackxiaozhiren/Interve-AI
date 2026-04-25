import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-xl border border-zinc-200/60 bg-white/50 backdrop-blur-md px-3.5 py-3 text-base text-zinc-900 transition-all duration-300 outline-none placeholder:text-zinc-400 focus-visible:border-sky-400 focus-visible:ring-[3px] focus-visible:ring-sky-400/20 focus-visible:bg-white disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-50 aria-invalid:border-rose-400 aria-invalid:ring-3 aria-invalid:ring-rose-200 md:text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] hover:border-zinc-300 hover:bg-white/80",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
