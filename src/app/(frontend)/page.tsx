'use client'

import { Banner } from '@/components/home/banner'
import { Hero } from '@/components/home/hero'
import { FeatureCards } from '@/components/home/feature-cards'
import { ValueProposition } from '@/components/home/value-proposition'
import { Footer } from '@/components/home/footer'
import { UrgencyCTA } from '@/components/home/urgency-cta'
import { useAuthStore } from '@/lib/store'
import Link from 'next/link'

export default function HomePage() {
  const { user, isAuthenticated } = useAuthStore()

  return (
    <div className="bg-background min-h-screen">
      {/* Full-screen Banner Section */}
      <Banner
        primaryAction={{
          label: 'Start Free Trial',
          href: '/signup',
        }}
        secondaryAction={{
          label: 'Schedule Demo',
          href: '/contact',
        }}
      />

      {/* Value Proposition Section */}
      <ValueProposition />

      {/* Hero Section */}
      <Hero
        primaryAction={{
          label: 'Learn More',
          href: '/features',
        }}
        secondaryAction={{
          label: 'View Documentation',
          href: '/docs',
        }}
      />

      {/* Feature Cards Section */}
      <FeatureCards />

      {/* Urgency CTA Section */}
      <UrgencyCTA />

      {/* Footer */}
      <Footer />

      {/* Admin Panel Link for authenticated users */}
      {isAuthenticated && user && (
        <div className="right-4 bottom-4 z-50 fixed">
          <Link
            href="/admin"
            className="bg-primary hover:bg-primary/90 shadow-lg px-4 py-2 rounded-lg text-primary-foreground transition-colors"
          >
            Admin Panel
          </Link>
        </div>
      )}
    </div>
  )
}
