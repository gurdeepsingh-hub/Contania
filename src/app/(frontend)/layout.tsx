import React from 'react'
import './globals.css'
import { ConditionalAuthProvider } from '@/components/common/conditional-auth-provider'
import { RootHeaderbarWrapper } from '@/components/common/root-headerbar-wrapper'
import { ConditionalHeader } from '@/components/common/conditional-header'

export const metadata = {
  description: 'Containa - Transport Management System. Streamline your logistics operations with intelligent precision.',
  title: 'Containa - Transport Management System',
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
