'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, PackageCheck } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

export default function ExportStockAllocationPage() {
  const router = useRouter()
  const params = useParams()
  const { tenant, loading } = useTenant()
  const bookingId = params.id as string
  const [allocations, setAllocations] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    if (bookingId) {
      loadData()
    }
  }, [bookingId])

  const loadData = async () => {
    try {
      setLoadingData(true)
      const res = await fetch(`/api/export-container-bookings/${bookingId}/stock-allocations?depth=2`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setAllocations(data.stockAllocations || [])
        }
      }
    } catch (error) {
      console.error('Error loading allocations:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'allocated':
        return 'bg-blue-100 text-blue-800'
      case 'picked':
        return 'bg-yellow-100 text-yellow-800'
      case 'dispatched':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
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
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/export-container-bookings/${bookingId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Stock Allocation</h1>
          <p className="text-muted-foreground">Manage stock allocations for this booking</p>
        </div>
      </div>

      {allocations.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">No stock allocations yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {allocations.map((allocation) => {
            const containerDetail =
              typeof allocation.containerDetailId === 'object'
                ? allocation.containerDetailId
                : null
            return (
              <Card key={allocation.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>
                        Container: {containerDetail?.containerNumber || allocation.containerDetailId}
                      </CardTitle>
                      <Badge className={getStageColor(allocation.stage)}>{allocation.stage}</Badge>
                    </div>
                    {allocation.stage === 'allocated' && (
                      <Button size="sm">
                        <PackageCheck className="h-4 w-4 mr-1" />
                        Pick
                      </Button>
                    )}
                    {allocation.stage === 'picked' && (
                      <Button size="sm">
                        <PackageCheck className="h-4 w-4 mr-1" />
                        Dispatch
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {allocation.productLines && allocation.productLines.length > 0 && (
                    <div className="space-y-2">
                      {allocation.productLines.map((line: any, idx: number) => (
                        <div key={idx} className="text-sm">
                          SKU: {typeof line.skuId === 'object' ? line.skuId.skuCode : 'N/A'} - Batch:{' '}
                          {line.batchNumber}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

