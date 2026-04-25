import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-zinc-100/80 text-zinc-900 border-zinc-200/50 [a]:hover:bg-zinc-200/80 backdrop-blur-sm",
        secondary:
          "bg-white/60 border-zinc-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.02)] text-zinc-700 [a]:hover:bg-white/80 backdrop-blur-md",
        destructive:
          "bg-rose-50 border-rose-100 text-rose-600 focus-visible:ring-rose-200 [a]:hover:bg-rose-100",
        outline:
          "border-zinc-200 text-zinc-700 [a]:hover:bg-zinc-50 [a]:hover:text-zinc-900 bg-white/40",
        ghost:
          "hover:bg-zinc-100 hover:text-zinc-900 text-zinc-600",
        link: "text-zinc-900 underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
