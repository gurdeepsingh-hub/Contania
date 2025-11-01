'use client'

import React, { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Ship,
  Container,
  Warehouse,
  Package,
  Truck,
  Map,
  FileText,
  Users2,
  Cog,
} from 'lucide-react'
import { Button } from '../ui/button'

// Icon resolver function to convert string names to Lucide components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Ship,
  Container,
  Warehouse,
  Package,
  Truck,
  Map,
  FileText,
  Users2,
  Cog,
}

const getIconComponent = (iconName: string): React.ComponentType<{ className?: string }> => {
  return iconMap[iconName] || LayoutDashboard
}

export interface NavigationItem {
  id: string
  label: string
  iconName: string
  href: string
  active?: boolean
  disabled?: boolean
}

interface NavigationMenuProps {
  items: NavigationItem[]
  onItemClick?: (item: NavigationItem) => void
  className?: string
  variant?: 'default' | 'compact' | 'minimal'
}

export function NavigationMenu({
  items,
  onItemClick,
  className,
  variant = 'default',
}: NavigationMenuProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <>
      {/* Desktop Navigation Menu */}
      <nav
        className={cn(
          'top-16 z-40 sticky bg-gradient-to-r from-background via-background to-muted/20 backdrop-blur-xs border-border/30 border-b',
          'hidden md:block', // Hide on mobile, show on tablet and up
          className,
        )}
      >
        <div className="mx-auto px-4 sm:px-6 lg:px-8 container">
          <div className="flex justify-center items-center h-16">
            <div
              className={cn(
                'flex items-center gap-1 bg-card/50 shadow-sm backdrop-blur-xs p-1 border border-border/20 rounded-2xl',
                'overflow-x-auto scrollbar-hide', // Horizontal scroll for many items
                variant === 'compact' && 'gap-0.5',
                variant === 'minimal' && 'bg-transparent border-none shadow-none',
              )}
            >
              {items.map((item) => {
                const Icon = getIconComponent(item.iconName)
                return (
                  <button
                    key={item.id}
                    className={cn(
                      'group relative flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ease-out',
                      'min-w-fit', // Prevent text wrapping
                      item.active
                        ? 'bg-gradient-to-r from-primary/10 to-accent/10 text-primary shadow-sm border border-primary/20'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      item.disabled &&
                        'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground',
                      variant === 'compact' && 'px-3 py-1.5 gap-1.5',
                      variant === 'minimal' &&
                        'px-3 py-1.5 gap-1.5 bg-transparent border-none shadow-none',
                    )}
                    onClick={() => {
                      if (!item.disabled && onItemClick) {
                        onItemClick(item)
                      }
                    }}
                    disabled={item.disabled}
                    aria-label={`Navigate to ${item.label}`}
                  >
                    {/* Active indicator */}
                    {item.active && (
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl animate-pulse-slow" />
                    )}

                    {/* Icon with active state */}
                    <div
                      className={cn(
                        'z-10 relative flex justify-center items-center transition-all duration-300',
                        item.active
                          ? 'text-primary'
                          : 'text-muted-foreground group-hover:text-foreground',
                      )}
                    >
                      <Icon
                        className={cn(
                          'transition-all duration-300',
                          variant === 'compact' ? 'h-4 w-4' : 'h-5 w-5',
                          variant === 'minimal' ? 'h-4 w-4' : 'h-5 w-5',
                          item.active ? 'scale-110' : 'group-hover:scale-105',
                        )}
                      />
                    </div>

                    {/* Label - hidden in minimal variant */}
                    {variant !== 'minimal' && (
                      <span
                        className={cn(
                          'z-10 relative font-medium text-sm whitespace-nowrap transition-all duration-300',
                          item.active
                            ? 'text-primary'
                            : 'text-muted-foreground group-hover:text-foreground',
                          variant === 'compact' && 'text-xs',
                        )}
                      >
                        {item.label}
                      </span>
                    )}

                    {/* Active indicator dot */}
                    {item.active && (
                      <div className="-bottom-1 left-1/2 absolute bg-primary rounded-full w-1 h-1 -translate-x-1/2 animate-bounce-in transform" />
                    )}

                    {/* Hover glow effect */}
                    <div
                      className={cn(
                        'absolute inset-0 opacity-0 rounded-xl transition-opacity duration-300',
                        item.active
                          ? 'bg-gradient-to-r from-primary/20 to-accent/20'
                          : 'bg-gradient-to-r from-primary/10 to-accent/10',
                        'group-hover:opacity-100',
                      )}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Toggle */}
      <div className="md:hidden top-16 z-40 sticky bg-gradient-to-r from-background via-background to-muted/20 backdrop-blur-xs border-border/30 border-b">
        <div className="mx-auto px-4 container">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground text-sm">Navigation</span>
              {/* Active page indicator */}
              {items.find((item) => item.active) && (
                <span className="font-medium text-primary text-sm">
                  {items.find((item) => item.active)?.label}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="w-10 h-10"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <MobileNavigationMenu
        items={items}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onItemClick={onItemClick}
      />
    </>
  )
}

// Mobile navigation menu for responsive design
interface MobileNavigationMenuProps {
  items: NavigationItem[]
  onItemClick?: (item: NavigationItem) => void
  className?: string
  isOpen?: boolean
  onClose?: () => void
}

export function MobileNavigationMenu({
  items,
  onItemClick,
  className: _className,
  isOpen = false,
  onClose,
}: MobileNavigationMenuProps) {
  return (
    <div className={cn('md:hidden z-50 fixed inset-0', isOpen ? 'block' : 'hidden')}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu */}
      <div className="right-0 bottom-0 left-0 absolute bg-card/95 backdrop-blur-sm p-4 border-border/50 border-t rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <div className="gap-2 grid grid-cols-4">
          {items.map((item) => {
            const Icon = getIconComponent(item.iconName)
            return (
              <button
                key={item.id}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-300',
                  'min-h-[80px] justify-center', // Touch-friendly sizing
                  item.active
                    ? 'bg-gradient-to-r from-primary/10 to-accent/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  item.disabled && 'opacity-50 cursor-not-allowed',
                )}
                onClick={() => {
                  if (!item.disabled && onItemClick) {
                    onItemClick(item)
                    onClose?.()
                  }
                }}
                disabled={item.disabled}
                aria-label={`Navigate to ${item.label}`}
              >
                <Icon className="w-6 h-6" />
                <span className="font-medium text-xs text-center leading-tight">{item.label}</span>
                {item.active && <div className="bg-primary mt-1 rounded-full w-1 h-1" />}
              </button>
            )
          })}
        </div>

        {/* Close button for better UX */}
        <div className="mt-4 pt-4 border-border/20 border-t">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Close Menu
          </Button>
        </div>
      </div>
    </div>
  )
}
