import React from 'react'
import { cn } from '@/lib/utils'
import { logoVariants, premiumLogoConfig } from '@/lib/design-tokens'

// Premium Logo Component with sophisticated design tokens
interface LogoProps {
  variant?:
    | 'default'
    | 'full'
    | 'icon-only'
    | 'professional'
    | 'homepage'
    | 'homepage-hero'
    | 'premium'
    | 'minimal'
    | 'display'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl'
  color?: 'default' | 'primary' | 'secondary' | 'premium' | 'monochrome' | 'inverse'
  animated?: boolean
  className?: string
  href?: string
  showIcon?: boolean
  showTagline?: boolean
}

export function Logo({
  variant = 'default',
  size = 'lg',
  color = 'default',
  animated = false,
  className,
  href,
  showIcon: _showIcon = false, // Removed icon by default
  showTagline: _showTagline = false, // Removed tagline by default
}: LogoProps) {
  // Get design token configurations
  const sizeConfig = logoVariants.sizes[size]
  const colorConfig = logoVariants.colors[color]
  const styleConfig = logoVariants.styles[variant] || logoVariants.styles.default

  // Premium content variants
  const variantContent = {
    default: premiumLogoConfig.brand.name,
    full: premiumLogoConfig.brand.name,
    'icon-only': 'CT',
    professional: premiumLogoConfig.brand.name,
    homepage: premiumLogoConfig.brand.name,
    'homepage-hero': premiumLogoConfig.brand.name,
    premium: premiumLogoConfig.brand.name,
    minimal: premiumLogoConfig.brand.name,
    display: premiumLogoConfig.brand.name,
  }

  // Premium animation classes
  const animationClasses = {
    hover: 'hover:scale-105 hover:drop-shadow-lg',
    pulse: 'animate-pulse',
    bounce: 'animate-bounce',
    fade: 'animate-fade-in',
    none: '',
  }

  const logoElement = (
    <div
      className={cn(
        'flex items-center font-sans', // Removed gap since no icon
        sizeConfig.fontSize,
        colorConfig.text,
        styleConfig.fontWeight,
        styleConfig.letterSpacing,
        animated && animationClasses.hover,
        variant === 'homepage' && animationClasses.pulse,
        variant === 'homepage-hero' && animationClasses.bounce,
        'transition-all duration-300 ease-out',
        className,
      )}
    >
      {/* Premium Typography - Text only */}
      <div className="flex flex-col min-w-0">
        <span
          className={cn(
            'whitespace-nowrap', // Prevent text wrapping
          )}
        >
          {variantContent[variant]}
        </span>
      </div>
    </div>
  )

  if (href) {
    return (
      <a
        href={href}
        className={cn(
          'hover:opacity-90 transition-opacity duration-200',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded',
        )}
        aria-label={`${premiumLogoConfig.brand.name} - ${premiumLogoConfig.brand.description}`}
      >
        {logoElement}
      </a>
    )
  }

  return logoElement
}

// Premium Logo with Background Component
interface LogoWithBackgroundProps {
  background?: 'none' | 'solid' | 'gradient' | 'homepage' | 'premium' | 'glass'
  padding?: 'sm' | 'md' | 'lg' | 'xl'
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
  children?: React.ReactNode
}

export function LogoWithBackground({
  background = 'none',
  padding = 'md',
  rounded = 'md',
  className,
  children,
}: LogoWithBackgroundProps) {
  const backgroundClasses = {
    none: '',
    solid: 'bg-card border border-border shadow-sm',
    gradient: 'bg-gradient-to-r from-primary/10 to-primary/20 border border-primary/20 shadow-md',
    homepage: 'bg-primary/5 border border-primary/20 backdrop-blur-xs shadow-lg',
    premium: 'bg-primary shadow-xl',
    glass: 'bg-white/10 backdrop-blur-sm border border-white/20 shadow-2xl',
  }

  const paddingClasses = {
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  }

  const roundedClasses = {
    sm: 'rounded',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
    full: 'rounded-full',
  }

  return (
    <div
      className={cn(
        backgroundClasses[background],
        paddingClasses[padding],
        roundedClasses[rounded],
        'transition-all duration-300 hover:shadow-lg',
        className,
      )}
    >
      {children}
    </div>
  )
}

// Premium Homepage Logo Component
interface HomepageLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl'
  animated?: boolean
  className?: string
  withBackground?: boolean
  showTagline?: boolean
}

export function HomepageLogo({
  size = 'xl',
  animated = true,
  className,
  withBackground = false,
  showTagline: _showTagline = false, // Removed tagline by default
}: HomepageLogoProps) {
  const logoElement = (
    <Logo
      variant="premium"
      size={size}
      color="premium"
      animated={animated}
      className={className}
      showIcon={false} // No icon
      showTagline={false}
    />
  )

  if (withBackground) {
    return (
      <LogoWithBackground background="premium" padding="lg" rounded="xl">
        {logoElement}
      </LogoWithBackground>
    )
  }

  return logoElement
}
