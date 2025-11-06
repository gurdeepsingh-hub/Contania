'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

type User = {
  id: string | number
  email: string
  fullName?: string
  role?: string
  [key: string]: unknown
}

type LoginResponse = {
  user: User
  success?: boolean
}

type AuthContextType = {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<LoginResponse | undefined>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  setUser: (user: User | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/users/me')

      if (res.ok) {
        const data = await res.json()
        if (data.user) {
          setUser(data.user)
          setIsAuthenticated(true)
          return
        }
      }

      // Not authenticated
      setUser(null)
      setIsAuthenticated(false)
    } catch (error) {
      console.error('Error checking auth:', error)
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        setIsAuthenticated(true)
        setIsLoading(false)
        return data
      } else {
        const error = await response.json()
        setIsLoading(false)
        throw new Error(error.message || 'Login failed')
      }
    } catch (error) {
      setIsLoading(false)
      throw error
    }
  }

  const logout = async () => {
    try {
      // Call logout API to clear server-side cookie
      await fetch('/api/users/logout', {
        method: 'POST',
      })
    } catch (error) {
      console.error('Logout API error:', error)
    }

    // Clear client-side state
    setUser(null)
    setIsAuthenticated(false)
    setIsLoading(false)
  }

  // Check auth on mount only
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        checkAuth,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
