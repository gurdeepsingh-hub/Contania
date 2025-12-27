'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ImportContainerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { tenant, loading } = useTenant()
  const bookingId = params.id as string
  const containerId = params.containerId as string
  const [container, setContainer] = useState<any>(null)
  const [allocations, setAllocations] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    if (containerId) {
      loadData()
    }
  }, [containerId])

  const loadData = async () => {
    try {
      setLoadingData(true)
      const [containerRes, allocationsRes] = await Promise.all([
        fetch(`/api/container-details/${containerId}?depth=2`),
        fetch(`/api/container-stock-allocations?containerDetailId=${containerId}&depth=2`),
      ])

      if (containerRes.ok) {
        const data = await containerRes.json()
        if (data.success) {
          setContainer(data.containerDetail)
        }
      }

      if (allocationsRes.ok) {
        const data = await allocationsRes.json()
        if (data.success) {
          setAllocations(data.containerStockAllocations || [])
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
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

  if (!container) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Container not found</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/import-container-bookings/${bookingId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Booking
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Container {container.containerNumber}</h1>
          <p className="text-muted-foreground">Container Details</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Container Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Container Number</label>
              <p className="font-medium">{container.containerNumber}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">ISO Code</label>
              <p className="font-medium">{container.isoCode || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Gross</label>
              <p className="font-medium">{container.gross || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Tare</label>
              <p className="font-medium">{container.tare || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Net</label>
              <p className="font-medium">{container.net || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {allocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stock Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allocations.map((allocation) => (
                <div key={allocation.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Stage: {allocation.stage}</span>
                  </div>
                  {allocation.productLines && allocation.productLines.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground mb-1">Product Lines:</p>
                      <ul className="list-disc list-inside text-sm">
                        {allocation.productLines.map((line: any, idx: number) => (
                          <li key={idx}>
                            {typeof line.skuId === 'object' ? line.skuId.skuCode : 'SKU'} - Batch:{' '}
                            {line.batchNumber}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

