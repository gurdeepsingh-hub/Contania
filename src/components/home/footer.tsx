import React from 'react'
import { cn } from '@/lib/utils'
import { Logo } from './logo'
import { getLogoProps } from '@/lib/logo-config'
import { 
  Facebook, 
  Twitter, 
  Linkedin, 
  Github, 
  Instagram
} from 'lucide-react'

interface FooterProps {
  className?: string
}

export function Footer({ className }: FooterProps) {
  const footerLogoProps = getLogoProps('footer')

  const sections = [
    {
      title: "Product",
      links: [
        { name: "Features", href: "#" },
        { name: "Pricing", href: "#" },
        { name: "Documentation", href: "#" },
        { name: "API", href: "#" },
      ],
    },
    {
      title: "Company",
      links: [
        { name: "About", href: "#" },
        { name: "Blog", href: "#" },
        { name: "Careers", href: "#" },
        { name: "Contact", href: "/contact" },
      ],
    },
    {
      title: "Support",
      links: [
        { name: "Help Center", href: "#" },
        { name: "Community", href: "#" },
        { name: "Status", href: "#" },
        { name: "Security", href: "#" },
      ],
    },
  ]

  const socialLinks = [
    { icon: Facebook, href: "#", label: "Facebook" },
    { icon: Twitter, href: "#", label: "Twitter" },
    { icon: Linkedin, href: "#", label: "LinkedIn" },
    { icon: Github, href: "#", label: "GitHub" },
    { icon: Instagram, href: "#", label: "Instagram" },
  ]

  const legalLinks = [
    { name: "Privacy Policy", href: "#" },
    { name: "Terms of Service", href: "#" },
    { name: "Cookie Policy", href: "#" },
  ]

  return (
    <footer className={cn(
      "bg-footer text-footer-foreground py-32",
      className
    )}>
      <div className="container mx-auto px-4">
        <div className="flex w-full flex-col justify-between gap-10 lg:flex-row lg:items-start lg:text-left">
          <div className="flex w-full flex-col justify-between gap-6 lg:items-start">
            {/* Logo */}
            <div className="flex items-center gap-2 lg:justify-start">
              <Logo {...footerLogoProps} />
            </div>
            <p className="max-w-[70%] text-sm text-footer-foreground/80">
              Streamlining logistics operations with our comprehensive transportation management platform.
            </p>
            <ul className="flex items-center space-x-6 text-footer-foreground/80">
              {socialLinks.map((social, idx) => (
                <li key={idx} className="font-medium hover:text-footer-foreground transition-colors">
                  <a href={social.href} aria-label={social.label}>
                    <social.icon className="h-5 w-5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="grid w-full gap-6 md:grid-cols-3 lg:gap-20">
            {sections.map((section, sectionIdx) => (
              <div key={sectionIdx}>
                <h3 className="mb-4 font-bold text-footer-foreground">{section.title}</h3>
                <ul className="space-y-3 text-sm text-footer-foreground/80">
                  {section.links.map((link, linkIdx) => (
                    <li
                      key={linkIdx}
                      className="font-medium hover:text-footer-foreground transition-colors"
                    >
                      <a href={link.href}>{link.name}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-8 flex flex-col justify-between gap-4 border-t border-footer-foreground/20 py-8 text-xs font-medium text-footer-foreground/80 md:flex-row md:items-center md:text-left">
          <p className="order-2 lg:order-1">
            © {new Date().getFullYear()} Containa. All rights reserved.
          </p>
          <ul className="order-1 flex flex-col gap-2 md:order-2 md:flex-row">
            {legalLinks.map((link, idx) => (
              <li key={idx} className="hover:text-footer-foreground transition-colors">
                <a href={link.href}>{link.name}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
} 