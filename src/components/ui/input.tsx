import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-zinc-200/60 bg-white/50 backdrop-blur-md px-3.5 py-2 text-base text-zinc-900 transition-all duration-300 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-zinc-900 placeholder:text-zinc-400 focus-visible:border-sky-400 focus-visible:ring-[3px] focus-visible:ring-sky-400/20 focus-visible:bg-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-50 aria-invalid:border-rose-400 aria-invalid:ring-[3px] aria-invalid:ring-rose-200 md:text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] hover:border-zinc-300 hover:bg-white/80 hover:shadow-[inset_0_2px_6px_rgba(0,0,0,0.03)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
