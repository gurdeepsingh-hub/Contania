import React from 'react'
import './globals.css'
import { ConditionalAuthProvider } from '@/components/common/conditional-auth-provider'
import { RootHeaderbarWrapper } from '@/components/common/root-headerbar-wrapper'
import { ConditionalHeader } from '@/components/common/conditional-header'

export const metadata = {
  description: 'A blank template using Payload in a Next.js app.',
  title: 'Payload Blank Template',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <ConditionalAuthProvider>
          <ConditionalHeader />
          <RootHeaderbarWrapper />
          <main>{children}</main>
        </ConditionalAuthProvider>
      </body>
    </html>
  )
}
