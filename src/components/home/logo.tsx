import React from 'react'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Logo({ className, size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn('flex justify-center items-center bg-primary rounded-lg', sizeClasses[size])}
      >
        <span className="font-bold text-primary-foreground text-sm">C</span>
      </div>
      <span className="font-bold text-xl">Containa</span>
    </div>
  )
}
