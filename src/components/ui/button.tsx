import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors duration-300 outline-none select-none focus-visible:border-sky-400 focus-visible:ring-3 focus-visible:ring-sky-400/20 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-b from-sky-400 to-sky-500 text-white shadow-[0_4px_16px_rgba(14,165,233,0.25)] hover:shadow-[0_8px_32px_rgba(14,165,233,0.35)] ring-1 ring-sky-300/50",
        outline:
          "glass hover:bg-sky-50/50 hover:text-sky-900 shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-zinc-200/50",
        secondary:
          "bg-zinc-100 text-zinc-900 hover:bg-zinc-200/80 border border-zinc-200/50",
        ghost:
          "hover:bg-zinc-100/60 hover:text-zinc-900",
        destructive:
          "bg-rose-500 text-white hover:bg-rose-600 focus-visible:border-rose-500/50 focus-visible:ring-rose-500/30 shadow-[0_4px_16px_rgba(244,63,94,0.2)]",
        link: "text-sky-600 underline-offset-4 hover:underline",
        glass: "glass-card hover:bg-white/90 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
      },
      size: {
        default:
          "h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-[min(var(--radius-md),12px)] px-3 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-6 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 text-base",
        icon: "size-9",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(
        "interve-hoverable interve-focus-glow",
        buttonVariants({ variant, size, className })
      )}
      {...props}
    />
  );
}

export { Button, buttonVariants }
