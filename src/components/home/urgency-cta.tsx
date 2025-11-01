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
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button variant="cta" size="lg" className="group">
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button variant="ctaOutline" size="lg" className="group">
              Schedule Demo
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
} 