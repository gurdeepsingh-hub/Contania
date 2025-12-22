import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

interface UrgencyCTAProps {
  className?: string
}

export function UrgencyCTA({ className }: UrgencyCTAProps) {
  return (
    <section className={cn(
      "py-20 sm:py-32 bg-background",
      className
    )}>
      <div className="container mx-auto px-4">
        <div className="text-center animate-fade-in">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl mb-6">
            Ready to Transform Your Logistics?
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground mb-8">
            Join thousands of companies that have already revolutionized their transportation operations with Containa TMS.
          </p>
        </div>
      </div>
    </section>
  )
} 