import { Banner } from '@/components/home/banner'
import { Hero } from '@/components/home/hero'
import { FeatureCards } from '@/components/home/feature-cards'
import { ValueProposition } from '@/components/home/value-proposition'
import { Footer } from '@/components/home/footer'
import { UrgencyCTA } from '@/components/home/urgency-cta'

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
