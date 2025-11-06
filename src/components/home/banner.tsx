import React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface BannerProps {
  title?: string
  description?: string
  primaryAction?: {
    label: string
    href: string
  }
  secondaryAction?: {
    label: string
    href: string
  }
  onClose?: () => void
  className?: string
}

export function Banner({
  title = "Introducing Containa - The Future of Transportation Management",
  description = "Transform your logistics operations with intelligent precision. Join industry leaders who trust Containa for their critical operations.",
  primaryAction,
  secondaryAction,
  onClose,
  className
}: BannerProps) {
  return (
    <section className={cn(
      "relative overflow-hidden bg-banner min-h-screen flex items-center justify-center",
      className
    )}>
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-banner-foreground sm:text-5xl lg:text-6xl mb-6 animate-fade-in">
            {title}
          </h1>
          {description && (
            <p className="mx-auto max-w-3xl text-xl text-banner-foreground/80 mb-8 animate-slide-up stagger-1">
              {description}
            </p>
          )}
          {(primaryAction || secondaryAction) && (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center animate-slide-up stagger-2">
              {primaryAction && (
                <Button variant="banner" size="lg" className="group" asChild>
                  <Link href={primaryAction.href}>{primaryAction.label}</Link>
                </Button>
              )}
              {secondaryAction && (
                <Button variant="bannerOutline" size="lg" className="group" asChild>
                  <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 text-banner-foreground/60 hover:text-banner-foreground"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </section>
  )
} 