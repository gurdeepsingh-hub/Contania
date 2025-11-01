import React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardHeader } from '@/components/ui/card'
import { 
  Route, 
  BarChart3, 
  Truck, 
  Clock, 
  Shield, 
  Users,
  LucideIcon
} from 'lucide-react'

interface FeatureCardProps {
  icon: LucideIcon
  title: string
  description: string
  className?: string
}

const features = [
  {
    icon: Route,
    title: 'Route Optimization',
    description: 'AI-powered route planning that reduces fuel costs and delivery times by up to 25%.'
  },
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    description: 'Comprehensive dashboards and reports to track performance and identify optimization opportunities.'
  },
  {
    icon: Truck,
    title: 'Fleet Management',
    description: 'Complete fleet tracking, maintenance scheduling, and driver management in one platform.'
  },
  {
    icon: Clock,
    title: 'Delivery Scheduling',
    description: 'Intelligent scheduling that adapts to traffic, weather, and customer preferences.'
  },
  {
    icon: Shield,
    title: 'Compliance & Safety',
    description: 'Built-in compliance tools and safety monitoring to ensure regulatory adherence.'
  },
  {
    icon: Users,
    title: 'Customer Portal',
    description: 'Self-service portal for customers to track shipments and manage deliveries.'
  }
]

function FeatureCard({ icon: Icon, title, description, className }: FeatureCardProps) {
  return (
    <Card className={cn(
      "group relative rounded-none shadow-zinc-950/5 hover:shadow-lg transition-all duration-300",
      className
    )}>
      <CardDecorator />
      <CardHeader className="pb-3">
        <div className="p-6">
          <span className="text-muted-foreground flex items-center gap-2">
            <Icon className="size-4" />
            {title}
          </span>
          <p className="mt-8 text-2xl font-semibold">{description}</p>
        </div>
      </CardHeader>
    </Card>
  )
}

const CardDecorator = () => (
  <>
    <span className="border-primary absolute -left-px -top-px block size-2 border-l-2 border-t-2"></span>
    <span className="border-primary absolute -right-px -top-px block size-2 border-r-2 border-t-2"></span>
    <span className="border-primary absolute -bottom-px -left-px block size-2 border-b-2 border-l-2"></span>
    <span className="border-primary absolute -bottom-px -right-px block size-2 border-b-2 border-r-2"></span>
  </>
)

export function FeatureCards() {
  return (
    <section className="bg-muted/50 py-16 md:py-32 dark:bg-transparent">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl mb-6">
            Powerful Features for Modern Logistics
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Everything you need to streamline your transportation operations and deliver exceptional customer experiences with Containa TMS.
          </p>
        </div>
        
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              className={`animate-slide-up stagger-${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
} 