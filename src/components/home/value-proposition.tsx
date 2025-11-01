import React from 'react'
import { cn } from '@/lib/utils'
import { 
  TrendingDown, 
  Target, 
  Activity,
  Zap,
  Headphones,
  ArrowUp,
  Shield,
  Clock,
  BarChart3,
  LucideIcon
} from 'lucide-react'

interface ValuePropositionProps {
  className?: string
}

interface BenefitItem {
  icon: LucideIcon
  title: string
  description: string
}

const benefits: BenefitItem[] = [
  {
    icon: TrendingDown,
    title: 'Reduce operational costs by up to 30%',
    description: 'AI-powered route optimization and fuel management reduce expenses significantly.'
  },
  {
    icon: Target,
    title: 'Improve delivery accuracy by 95%',
    description: 'Real-time tracking and predictive analytics ensure precise delivery times.'
  },
  {
    icon: Activity,
    title: 'Real-time visibility across your entire fleet',
    description: 'Monitor every vehicle, driver, and shipment with live GPS tracking.'
  },
  {
    icon: Zap,
    title: 'Seamless integration with existing systems',
    description: 'Connect with your ERP, WMS, and other business systems effortlessly.'
  },
  {
    icon: Headphones,
    title: '24/7 customer support and training',
    description: 'Expert support team available around the clock with comprehensive training.'
  },
  {
    icon: ArrowUp,
    title: 'Scalable solution for growing businesses',
    description: 'Grow your operations without worrying about system limitations.'
  },
  {
    icon: Shield,
    title: 'Enterprise-grade security and compliance',
    description: 'Bank-level security with SOC 2 Type II certification and GDPR compliance.'
  },
  {
    icon: Clock,
    title: 'Faster implementation and onboarding',
    description: 'Get up and running in days, not months, with our streamlined setup process.'
  },
  {
    icon: BarChart3,
    title: 'Advanced analytics and reporting',
    description: 'Comprehensive insights and customizable reports to optimize your operations.'
  }
]

export function ValueProposition({ className }: ValuePropositionProps) {
  return (
    <section className={cn(
      "py-20 sm:py-32 bg-background",
      className
    )}>
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          {/* Section Heading */}
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Why Choose Containa?
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Transform your transportation operations with our comprehensive TMS platform
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon
              return (
                <div
                  key={`benefit-${index}`}
                  className="flex items-start gap-6"
                >
                  <div className="flex-shrink-0 mt-1">
                    <Icon className="h-10 w-10 text-foreground font-bold" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-foreground font-bold text-lg mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
} 