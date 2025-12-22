import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-[hsl(220_100%_35%)] text-[hsl(0_0%_100%)] shadow-xs hover:bg-[hsl(220_100%_30%)] hover:shadow-sm active:bg-[hsl(220_100%_28%)] focus-visible:ring-[hsl(var(--primary))]/20 dark:focus-visible:ring-[hsl(var(--primary))]/40',
        destructive:
          'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] shadow-xs hover:bg-[hsl(0_84%_40%)] hover:shadow-sm active:bg-[hsl(0_84%_38%)] focus-visible:ring-[hsl(var(--destructive))]/20 dark:focus-visible:ring-[hsl(var(--destructive))]/40',
        outline:
          'border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xs hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] hover:border-[hsl(var(--border))] hover:shadow-sm active:bg-[hsl(var(--accent))]/90 dark:bg-[hsl(var(--input))]/30 dark:border-[hsl(var(--input))] dark:hover:bg-[hsl(var(--input))]/50 dark:hover:border-[hsl(var(--input))]',
        secondary:
          'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] shadow-xs hover:bg-[hsl(142_76%_18%)] hover:shadow-sm active:bg-[hsl(142_76%_16%)] focus-visible:ring-[hsl(var(--secondary))]/20 dark:focus-visible:ring-[hsl(var(--secondary))]/40',
        ghost:
          'hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] active:bg-[hsl(var(--accent))]/90 dark:hover:bg-[hsl(var(--accent))]/50 dark:active:bg-[hsl(var(--accent))]/60',
        link: 'text-[hsl(var(--primary))] underline-offset-4 hover:underline hover:text-[hsl(220_100%_30%)] active:text-[hsl(220_100%_28%)]',
        // Enhanced custom variants using design token CSS variables
        banner:
          'bg-[hsl(var(--button-banner-primary))] text-[hsl(var(--button-banner-primary-foreground))] shadow-xs hover:bg-[hsl(0_0%_92%)] hover:shadow-sm active:bg-[hsl(0_0%_90%)] focus-visible:ring-[hsl(var(--button-banner-primary-foreground))]/20',
        bannerOutline:
          'border border-[hsl(var(--button-banner-secondary-border))] bg-[hsl(var(--button-banner-secondary))] text-[hsl(var(--button-banner-secondary-foreground))] shadow-xs hover:bg-[hsl(0_0%_100%)] hover:text-[hsl(220_100%_35%)] hover:border-[hsl(220_100%_40%)] hover:shadow-sm active:bg-[hsl(0_0%_98%)] focus-visible:ring-[hsl(var(--button-banner-secondary-foreground))]/20',
        hero: 'bg-[hsl(var(--button-hero-primary))] text-[hsl(var(--button-hero-primary-foreground))] shadow-xs hover:bg-[hsl(220_100%_30%)] hover:shadow-sm active:bg-[hsl(220_100%_28%)] focus-visible:ring-[hsl(var(--button-hero-primary-foreground))]/20',
        heroOutline:
          'border border-[hsl(var(--button-hero-secondary-border))] bg-[hsl(var(--button-hero-secondary))] text-[hsl(var(--button-hero-secondary-foreground))] shadow-xs hover:bg-[hsl(220_100%_35%)] hover:text-[hsl(0_0%_100%)] hover:border-[hsl(220_100%_35%)] hover:shadow-sm active:bg-[hsl(220_100%_32%)] focus-visible:ring-[hsl(var(--button-hero-secondary-foreground))]/20',
        cta: 'bg-[hsl(var(--button-cta-primary))] text-[hsl(var(--button-cta-primary-foreground))] shadow-xs hover:bg-[hsl(220_100%_30%)] hover:shadow-sm active:bg-[hsl(220_100%_28%)] focus-visible:ring-[hsl(var(--button-cta-primary-foreground))]/20',
        ctaOutline:
          'border border-[hsl(var(--button-cta-secondary-border))] bg-[hsl(var(--button-cta-secondary))] text-[hsl(var(--button-cta-secondary-foreground))] shadow-xs hover:bg-[hsl(220_100%_35%)] hover:text-[hsl(0_0%_100%)] hover:border-[hsl(220_100%_35%)] hover:shadow-sm active:bg-[hsl(220_100%_32%)] focus-visible:ring-[hsl(var(--button-cta-secondary-foreground))]/20',
        // New semantic variants for better accessibility
        destructivePrimary:
          'bg-[hsl(var(--button-destructive-primary))] text-[hsl(var(--button-destructive-primary-foreground))] shadow-xs hover:bg-[hsl(0_84%_40%)] hover:shadow-sm active:bg-[hsl(0_84%_38%)] focus-visible:ring-[hsl(var(--button-destructive-primary-foreground))]/20',
        destructiveOutline:
          'border border-[hsl(var(--button-destructive-secondary-border))] bg-[hsl(var(--button-destructive-secondary))] text-[hsl(var(--button-destructive-secondary-foreground))] shadow-xs hover:bg-[hsl(0_84%_50%)] hover:text-[hsl(0_0%_100%)] hover:border-[hsl(0_84%_50%)] hover:shadow-sm active:bg-[hsl(0_84%_48%)] focus-visible:ring-[hsl(var(--button-destructive-secondary-foreground))]/20',
        success:
          'bg-[hsl(var(--button-success-primary))] text-[hsl(var(--button-success-primary-foreground))] shadow-xs hover:bg-[hsl(142_76%_18%)] hover:shadow-sm active:bg-[hsl(142_76%_16%)] focus-visible:ring-[hsl(var(--button-success-primary-foreground))]/20',
        successOutline:
          'border border-[hsl(var(--button-success-secondary-border))] bg-[hsl(var(--button-success-secondary))] text-[hsl(var(--button-success-secondary-foreground))] shadow-xs hover:bg-[hsl(142_76%_22%)] hover:text-[hsl(0_0%_100%)] hover:border-[hsl(142_76%_22%)] hover:shadow-sm active:bg-[hsl(142_76%_20%)] focus-visible:ring-[hsl(var(--button-success-secondary-foreground))]/20',
        warning:
          'bg-[hsl(var(--button-warning-primary))] text-[hsl(var(--button-warning-primary-foreground))] shadow-xs hover:bg-[hsl(38_92%_30%)] hover:shadow-sm active:bg-[hsl(38_92%_28%)] focus-visible:ring-[hsl(var(--button-warning-primary-foreground))]/20',
        warningOutline:
          'border border-[hsl(var(--button-warning-secondary-border))] bg-[hsl(var(--button-warning-secondary))] text-[hsl(var(--button-warning-secondary-foreground))] shadow-xs hover:bg-[hsl(38_92%_40%)] hover:text-[hsl(0_0%_100%)] hover:border-[hsl(38_92%_40%)] hover:shadow-sm active:bg-[hsl(38_92%_38%)] focus-visible:ring-[hsl(var(--button-warning-secondary-foreground))]/20',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
