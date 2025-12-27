'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

export default function ExportDriverAllocationPage() {
  const router = useRouter()
  const params = useParams()
  const { tenant, loading } = useTenant()
  const bookingId = params.id as string
  const [allocation, setAllocation] = useState<any>(null)
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    if (bookingId) {
      loadData()
    }
  }, [bookingId])

  const loadData = async () => {
    try {
      setLoadingData(true)
      const res = await fetch(`/api/export-container-bookings/${bookingId}/driver-allocation`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setAllocation(data.driverAllocation)
        }
      }
    } catch (error) {
      console.error('Error loading driver allocation:', error)
    } finally {
      setLoadingData(false)
    }
  }

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/export-container-bookings/${bookingId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Driver Allocation</h1>
            <p className="text-muted-foreground">Manage driver allocation for this booking</p>
          </div>
        </div>
        <Button>
          <Save className="h-4 w-4 mr-1" />
          Save Changes
        </Button>
      </div>

      {allocation ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {allocation.emptyContainer && allocation.emptyContainer.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Empty Container Routes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {allocation.emptyContainer.map((leg: any, idx: number) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="text-sm space-y-1">
                        <div>
                          <span className="font-medium">From:</span> {leg.from || '-'}
                        </div>
                        <div>
                          <span className="font-medium">To:</span> {leg.to || '-'}
                        </div>
                        {leg.date && (
                          <div>
                            <span className="font-medium">Date:</span>{' '}
                            {new Date(leg.date).toLocaleDateString()}
                          </div>
                        )}
                        {leg.driverId && (
                          <div>
                            <span className="font-medium">Driver:</span>{' '}
                            {typeof leg.driverId === 'object' ? leg.driverId.fullName : '-'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {allocation.fullContainer && allocation.fullContainer.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Full Container Routes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {allocation.fullContainer.map((leg: any, idx: number) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="text-sm space-y-1">
                        <div>
                          <span className="font-medium">From:</span> {leg.from || '-'}
                        </div>
                        <div>
                          <span className="font-medium">To:</span> {leg.to || '-'}
                        </div>
                        {leg.date && (
                          <div>
                            <span className="font-medium">Date:</span>{' '}
                            {new Date(leg.date).toLocaleDateString()}
                          </div>
                        )}
                        {leg.driverId && (
                          <div>
                            <span className="font-medium">Driver:</span>{' '}
                            {typeof leg.driverId === 'object' ? leg.driverId.fullName : '-'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">No driver allocation configured</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

