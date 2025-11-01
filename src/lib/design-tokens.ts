// Premium Design Tokens for Containa Logo System
// Based on high-end design principles from top agencies

export const logoDesignTokens = {
  // Enhanced Color Palette - Using improved contrast ratios
  colors: {
    // Primary Brand Colors - Enhanced contrast
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554',
    },

    // Secondary Accent Colors - Enhanced contrast
    secondary: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      950: '#052e16',
    },

    // Destructive Colors - Enhanced for sign out actions
    destructive: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
      950: '#450a0a',
    },

    // Success Colors - Enhanced contrast
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      950: '#052e16',
    },

    // Warning Colors - Enhanced contrast
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
      950: '#451a03',
    },

    // Premium Gradients - Using enhanced colors
    gradients: {
      primary: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%)',
      secondary: 'linear-gradient(135deg, #16a34a 0%, #22c55e 50%, #4ade80 100%)',
      premium: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)',
      dark: 'linear-gradient(135deg, #172554 0%, #1e3a8a 50%, #1e40af 100%)',
      light: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #bfdbfe 100%)',
      destructive: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)',
      success: 'linear-gradient(135deg, #16a34a 0%, #22c55e 50%, #4ade80 100%)',
      warning: 'linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%)',
    },

    // Semantic Colors - Enhanced for better accessibility
    semantic: {
      success: '#16a34a',
      warning: '#d97706',
      error: '#dc2626',
      info: '#2563eb',
    },
  },

  // Premium Typography System
  typography: {
    fontFamily: {
      primary: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: 'JetBrains Mono, "Fira Code", "Cascadia Code", monospace',
    },

    fontWeight: {
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    },

    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
      '6xl': '3.75rem',
      '7xl': '4.5rem',
      '8xl': '6rem',
      '9xl': '8rem',
    },

    lineHeight: {
      none: '1',
      tight: '1.25',
      snug: '1.375',
      normal: '1.5',
      relaxed: '1.625',
      loose: '2',
    },

    letterSpacing: {
      tighter: '-0.05em',
      tight: '-0.025em',
      normal: '0em',
      wide: '0.025em',
      wider: '0.05em',
      widest: '0.1em',
    },
  },

  // Premium Spacing System
  spacing: {
    px: '1px',
    0: '0',
    0.5: '0.125rem',
    1: '0.25rem',
    1.5: '0.375rem',
    2: '0.5rem',
    2.5: '0.625rem',
    3: '0.75rem',
    3.5: '0.875rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    7: '1.75rem',
    8: '2rem',
    9: '2.25rem',
    10: '2.5rem',
    11: '2.75rem',
    12: '3rem',
    14: '3.5rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    28: '7rem',
    32: '8rem',
    36: '9rem',
    40: '10rem',
    44: '11rem',
    48: '12rem',
    52: '13rem',
    56: '14rem',
    60: '15rem',
    64: '16rem',
    72: '18rem',
    80: '20rem',
    96: '24rem',
  },

  // Premium Border Radius System
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    base: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    full: '9999px',
  },

  // Premium Shadow System
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    none: '0 0 #0000',
  },

  // Premium Blur Effect System - Following DTCG and shadcn/ui best practices
  blur: {
    // Filter blur effects - Optimized for crisp rendering
    filter: {
      none: '0px',
      xs: '2px',
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      '2xl': '24px',
      '3xl': '32px', // Reduced from 64px to prevent excessive blur
    },

    // Backdrop blur effects - For glass morphism
    backdrop: {
      none: '0px',
      xs: '2px',
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      '2xl': '24px',
    },

    // Background blur effects - For decorative elements
    background: {
      none: '0px',
      subtle: '8px',
      soft: '16px',
      medium: '24px',
      heavy: '32px', // Reduced from 64px
    },
  },

  // Premium Animation System
  animation: {
    duration: {
      fast: '150ms',
      normal: '300ms',
      slow: '500ms',
      slower: '700ms',
    },
    easing: {
      linear: 'linear',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },

  // Premium Z-Index System - Following shadcn/ui and Radix UI patterns
  zIndex: {
    // Base layers
    hide: '-1',
    auto: 'auto',
    base: '0',

    // Content layers
    docked: '10',
    dropdown: '1000',
    sticky: '1020',
    banner: '1030',
    overlay: '1040',
    modal: '1050',
    popover: '1060',
    tooltip: '1070',
    toast: '1080',

    // High priority layers
    dialog: '1050',
    drawer: '1060',
    menu: '1070',
    notification: '1080',

    // Critical layers
    critical: '9999',
  },

  // Premium Rendering System - For crisp display
  rendering: {
    // Font smoothing - Optimized for different displays
    fontSmoothing: {
      antialiased: {
        webkit: 'antialiased',
        moz: 'grayscale',
        textRendering: 'optimizeLegibility',
      },
      subpixel: {
        webkit: 'auto',
        moz: 'auto',
        textRendering: 'auto',
      },
    },

    // Image rendering - For crisp images
    imageRendering: {
      crisp: {
        webkit: 'crisp-edges',
        moz: 'crisp-edges',
        standard: 'crisp-edges',
      },
      smooth: {
        webkit: 'smooth',
        moz: 'smooth',
        standard: 'smooth',
      },
    },
  },
}

// Premium Logo Variants Configuration - Updated with 1.5x larger text and brand blue colors (reduced from 2x)
export const logoVariants = {
  // Size Variants - Made 1.5x larger for good visibility (reduced from 2x)
  sizes: {
    xs: { fontSize: 'text-2xl', iconSize: 'w-3 h-3' },
    sm: { fontSize: 'text-3xl', iconSize: 'w-4 h-4' },
    md: { fontSize: 'text-4xl', iconSize: 'w-5 h-5' },
    lg: { fontSize: 'text-5xl', iconSize: 'w-6 h-6' },
    xl: { fontSize: 'text-6xl', iconSize: 'w-7 h-7' },
    '2xl': { fontSize: 'text-7xl', iconSize: 'w-8 h-8' },
    '3xl': { fontSize: 'text-8xl', iconSize: 'w-10 h-10' },
    '4xl': { fontSize: 'text-9xl', iconSize: 'w-12 h-12' },
    '5xl': { fontSize: 'text-10xl', iconSize: 'w-14 h-14' },
    '6xl': { fontSize: 'text-11xl', iconSize: 'w-16 h-16' },
  },

  // Color Variants - Using our brand blue palette (NO GRADIENTS)
  colors: {
    default: {
      text: 'text-blue-600',
      icon: 'text-blue-600',
      gradient: 'text-blue-600',
    },
    primary: {
      text: 'text-blue-600',
      icon: 'text-blue-600',
      gradient: 'text-blue-600',
    },
    secondary: {
      text: 'text-blue-500',
      icon: 'text-blue-500',
      gradient: 'text-blue-500',
    },
    premium: {
      text: 'text-blue-600',
      icon: 'text-blue-600',
      gradient: 'text-blue-600',
    },
    monochrome: {
      text: 'text-blue-700',
      icon: 'text-blue-700',
      gradient: 'text-blue-700',
    },
    inverse: {
      text: 'text-white',
      icon: 'text-white',
      gradient: 'text-white',
    },
  },

  // Style Variants - Updated with bold/black font weights
  styles: {
    default: {
      fontWeight: 'font-bold',
      letterSpacing: 'tracking-tight',
      iconStyle: 'fill-current',
    },
    full: {
      fontWeight: 'font-bold',
      letterSpacing: 'tracking-tight',
      iconStyle: 'fill-current',
    },
    'icon-only': {
      fontWeight: 'font-black',
      letterSpacing: 'tracking-tighter',
      iconStyle: 'fill-current',
    },
    professional: {
      fontWeight: 'font-bold',
      letterSpacing: 'tracking-tight',
      iconStyle: 'fill-current',
    },
    homepage: {
      fontWeight: 'font-black',
      letterSpacing: 'tracking-tighter',
      iconStyle: 'fill-current drop-shadow-sm',
    },
    'homepage-hero': {
      fontWeight: 'font-black',
      letterSpacing: 'tracking-tightest',
      iconStyle: 'fill-current drop-shadow-md',
    },
    premium: {
      fontWeight: 'font-black',
      letterSpacing: 'tracking-tighter',
      iconStyle: 'fill-current drop-shadow-sm',
    },
    minimal: {
      fontWeight: 'font-bold',
      letterSpacing: 'tracking-normal',
      iconStyle: 'fill-current',
    },
    display: {
      fontWeight: 'font-black',
      letterSpacing: 'tracking-tightest',
      iconStyle: 'fill-current drop-shadow-md',
    },
  },
}

// Premium Logo Configuration
export const premiumLogoConfig = {
  // Brand Identity
  brand: {
    name: 'Containa',
    tagline: 'Premium Transportation Management',
    description: 'Streamlining logistics operations with cutting-edge technology',
  },

  // Icon Design
  icon: {
    // Container-inspired geometric design
    path: `
      M 2 4 L 2 8 L 6 8 L 6 12 L 10 12 L 10 8 L 14 8 L 14 4 L 10 4 L 6 4 Z
      M 4 6 L 4 6.5 L 6 6.5 L 6 7 L 8 7 L 8 6.5 L 10 6.5 L 10 6 L 8 6 L 6 6 Z
    `,
    viewBox: '0 0 16 16',
    aspectRatio: '1:1',
  },

  // Animation Configurations
  animations: {
    hover: {
      scale: 'hover:scale-105',
      transition: 'transition-all duration-300 ease-out',
      glow: 'hover:drop-shadow-lg',
    },
    pulse: {
      animation: 'animate-pulse',
      duration: 'duration-2000',
    },
    bounce: {
      animation: 'animate-bounce',
      duration: 'duration-1000',
    },
    fade: {
      animation: 'animate-fade-in',
      duration: 'duration-500',
    },
  },
}

export default logoDesignTokens
