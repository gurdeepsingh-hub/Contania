'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Lock, Mail, Building2 } from 'lucide-react'

export default function TenantHomePage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Check if user is already logged in as tenant user
    // If logged in, redirect to dashboard
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/tenant-users/me')
        if (res.ok) {
          router.push('/dashboard')
        }
      } catch (error) {
        // Not authenticated, show login page
      }
    }
    
    if (!loading && tenant) {
      checkAuth()
    }
  }, [loading, tenant, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/tenant-users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        const data = await response.json()
        // Redirect to tenant dashboard
        router.push('/dashboard')
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Invalid credentials')
      }
    } catch (error) {
      setError('Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Tenant Not Found</CardTitle>
            <CardDescription>The subdomain you&apos;re trying to access is not valid.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Contania promotional content */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 items-center justify-center p-12">
        <div className="max-w-md text-white space-y-6">
          <h1 className="text-4xl font-bold">Contania</h1>
          <p className="text-xl text-blue-100">
            The Future of Transportation Management
          </p>
          <p className="text-blue-100">
            Transform your logistics operations with intelligent precision. 
            Join industry leaders who trust Contania for their critical operations.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Real-time tracking and monitoring</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Advanced analytics and reporting</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Seamless integration capabilities</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 sm:px-6 lg:px-8 py-12">
        <Card className="shadow-xl w-full max-w-md">
          <CardHeader className="space-y-1 pb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-primary p-3 rounded-full">
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="font-bold text-2xl text-center">{tenant.companyName}</CardTitle>
            <CardDescription className="text-center">
              Sign in to access your tenant portal
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
                    placeholder="user@company.com"
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
            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>Don&apos;t have an account? Contact your administrator.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


