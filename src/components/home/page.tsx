import { Banner } from '@/components/ui/banner'
import { Hero } from '@/components/ui/hero'
import { FeatureCards } from '@/components/ui/feature-cards'
import { ValueProposition } from '@/components/ui/value-proposition'
import { Footer } from '@/components/ui/footer'
import { UrgencyCTA } from '@/components/ui/urgency-cta'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Full-screen Banner Section */}
      <Banner 
        primaryAction={{
          label: "Start Free Trial",
          href: "/signup"
        }}
        secondaryAction={{
          label: "Schedule Demo",
          href: "/contact"
        }}
      />
      
      {/* Value Proposition Section */}
      <ValueProposition />
      
      {/* Hero Section */}
      <Hero 
        primaryAction={{
          label: "Learn More",
          href: "/features"
        }}
        secondaryAction={{
          label: "View Documentation",
          href: "/docs"
        }}
      />
      
      {/* Feature Cards Section */}
      <FeatureCards />
      
      {/* Urgency CTA Section */}
      <UrgencyCTA />

      {/* Footer */}
      <Footer />
    </div>
  )
}
