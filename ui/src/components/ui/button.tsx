import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/utils/utils"

// Hybrid approach: CSS fallbacks + Tailwind enhancement
const getHybridClasses = (variant?: string | null, size?: string | null) => {
  const safeVariant = variant || 'default'
  const safeSize = size || 'default'
  return [
    'btn-base',
    `btn-variant-${safeVariant}`,
    `btn-size-${safeSize}`,
  ].join(' ')
}

const buttonVariants = cva(
  // Base classes (Tailwind enhancement over CSS fallbacks)
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // NEAR Intents specific variants
        near: "bg-near-500 text-white hover:bg-near-600",
        bitcoin: "bg-bitcoin-500 text-white hover:bg-bitcoin-600",
        tee: "bg-tee-500 text-white hover:bg-tee-600 animate-solver-pulse",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    // Hybrid approach: Combine CSS fallbacks + Tailwind classes
    const hybridClasses = getHybridClasses(variant, size)
    const tailwindClasses = buttonVariants({ variant, size })
    
    return (
      <Comp
        className={cn(hybridClasses, tailwindClasses, className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }