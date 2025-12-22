'use client'

import { Banner } from '@/components/home/banner'
import { Hero } from '@/components/home/hero'
import { FeatureCards } from '@/components/home/feature-cards'
import { ValueProposition } from '@/components/home/value-proposition'
import { Footer } from '@/components/home/footer'
import { UrgencyCTA } from '@/components/home/urgency-cta'

export default function HomePage() {

  return (
    <div className="bg-background min-h-screen">
      {/* Full-screen Banner Section */}
      <Banner
        primaryAction={{
          label: 'Sign Up',
          href: '/onboarding',
        }}
        secondaryAction={{
          label: 'Schedule Demo',
          href: '/contact',
        }}
      />

      {/* Value Proposition Section */}
      <ValueProposition />

      {/* Hero Section */}
      <Hero />

      {/* Feature Cards Section */}
      <FeatureCards />

      {/* Urgency CTA Section */}
      <UrgencyCTA />
      {/* Footer */}
      <Footer />
    </div>
  )
}
