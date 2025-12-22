'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { Logo } from '@/components/home/logo'
import { getLogoProps } from '@/lib/logo-config'

export default function AdminSignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { login, isLoading } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const data = await login(email, password)
      // Check if user is super admin and redirect accordingly
      if (data?.user?.role === 'superadmin') {
        router.push('/super-admin')
      } else {
        setError('Access denied. This page is for super administrators only.')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed')
    }
  }

  const logoProps = getLogoProps('header')

  return (
    <div className="flex justify-center items-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 sm:px-6 lg:px-8 py-12 min-h-screen">
      <Card className="shadow-xl w-full max-w-md">
        <CardHeader className="space-y-1 pb-8">
          <div className="flex justify-center mb-4">
            <Logo {...logoProps} />
          </div>
          <CardTitle className="font-bold text-2xl text-center">Super Admin Login</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access the super admin panel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-medium text-sm">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="top-3 left-3 absolute w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-medium text-sm">
                Password
              </Label>
              <div className="relative">
                <Lock className="top-3 left-3 absolute w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 pl-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="top-3 right-3 absolute text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && (
              <div className="bg-destructive/10 p-3 border border-destructive/20 rounded-md text-destructive text-sm">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-muted-foreground text-sm">
              Forgot your password?{' '}
              <a href="#" className="text-primary hover:underline">
                Reset it here
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
