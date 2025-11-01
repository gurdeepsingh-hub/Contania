import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

interface HeroProps {
  title?: string
  subtitle?: string
  description?: string
  primaryAction?: {
    label: string
    href: string
  }
  secondaryAction?: {
    label: string
    href: string
  }
  className?: string
}

export function Hero({
  title = "Streamline Complex Transportation Challenges",
  subtitle = "Join industry leaders who trust Containa for their critical operations",
  description = "Discover how leading companies reduce costs by 30% and improve delivery accuracy by 95%. See how real-time visibility transforms decision-making.",
  primaryAction,
  secondaryAction,
  className
}: HeroProps) {
  return (
    <section className={cn(
      "relative overflow-hidden bg-hero py-24 sm:py-32",
      className
    )}>
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl animate-fade-in">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-6 text-xl text-muted-foreground animate-slide-up stagger-1">
              {subtitle}
            </p>
          )}
          {description && (
            <p className="mt-6 text-lg leading-8 text-muted-foreground animate-slide-up stagger-2">
              {description}
            </p>
          )}
          {(primaryAction || secondaryAction) && (
            <div className="mt-10 flex items-center justify-center gap-x-6 animate-slide-up stagger-3">
              {primaryAction && (
                <Button asChild variant="hero" size="lg" className="group">
                  <a href={primaryAction.href}>
                    {primaryAction.label}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </a>
                </Button>
              )}
              {secondaryAction && (
                <Button variant="heroOutline" asChild size="lg" className="group">
                  <a href={secondaryAction.href}>
                    {secondaryAction.label}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
} 