'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Truck, ArrowRight, MapPin } from 'lucide-react'
import Link from 'next/link'

type BookingType = 'import' | 'export'

interface DriverAllocationLeg {
  from?: string
  to?: string
  via?: string[]
  date?: string
  time?: string
  vehicleId?: number | { id: number; registrationNumber?: string }
  driverId?: number | { id: number; fullName?: string }
}

interface DriverAllocation {
  emptyContainer?: DriverAllocationLeg[]
  fullContainer?: DriverAllocationLeg[]
}

interface DriverAllocationSummaryProps {
  allocation: DriverAllocation | null
  bookingId: number
  bookingType: BookingType
}

export function DriverAllocationSummary({
  allocation,
  bookingId,
  bookingType,
}: DriverAllocationSummaryProps) {
  const emptyLegs = allocation?.emptyContainer || []
  const fullLegs = allocation?.fullContainer || []
  const totalLegs = emptyLegs.length + fullLegs.length

  const getDriverName = (driverId?: number | { id: number; fullName?: string }): string => {
    if (!driverId) return 'Not assigned'
    if (typeof driverId === 'object') {
      return driverId.fullName || 'Unknown'
    }
    return 'Unknown'
  }

  const getVehicleReg = (vehicleId?: number | { id: number; registrationNumber?: string }): string => {
    if (!vehicleId) return 'Not assigned'
    if (typeof vehicleId === 'object') {
      return vehicleId.registrationNumber || 'Unknown'
    }
    return 'Unknown'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Driver Allocation</CardTitle>
            <CardDescription>
              {totalLegs} leg{totalLegs !== 1 ? 's' : ''} configured
            </CardDescription>
          </div>
          <Link
            href={
              bookingType === 'import'
                ? `/dashboard/import-container-bookings/${bookingId}/driver-allocation`
                : `/dashboard/export-container-bookings/${bookingId}/driver-allocation`
            }
          >
            <Button variant="outline" size="sm">
              Manage
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {bookingType === 'import' ? (
            <>
              {fullLegs.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Full Container</h4>
                  <div className="space-y-2">
                    {fullLegs.slice(0, 3).map((leg, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {leg.from} → {leg.to}
                        </span>
                        {leg.driverId && (
                          <span className="text-muted-foreground">
                            • {getDriverName(leg.driverId)}
                          </span>
                        )}
                      </div>
                    ))}
                    {fullLegs.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{fullLegs.length - 3} more leg{fullLegs.length - 3 !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {emptyLegs.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Empty Container</h4>
                  <div className="space-y-2">
                    {emptyLegs.slice(0, 3).map((leg, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {leg.from} → {leg.to}
                        </span>
                        {leg.driverId && (
                          <span className="text-muted-foreground">
                            • {getDriverName(leg.driverId)}
                          </span>
                        )}
                      </div>
                    ))}
                    {emptyLegs.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{emptyLegs.length - 3} more leg{emptyLegs.length - 3 !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {emptyLegs.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Empty Container</h4>
                  <div className="space-y-2">
                    {emptyLegs.slice(0, 3).map((leg, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {leg.from} → {leg.to}
                        </span>
                        {leg.driverId && (
                          <span className="text-muted-foreground">
                            • {getDriverName(leg.driverId)}
                          </span>
                        )}
                      </div>
                    ))}
                    {emptyLegs.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{emptyLegs.length - 3} more leg{emptyLegs.length - 3 !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {fullLegs.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Full Container</h4>
                  <div className="space-y-2">
                    {fullLegs.slice(0, 3).map((leg, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {leg.from} → {leg.to}
                        </span>
                        {leg.driverId && (
                          <span className="text-muted-foreground">
                            • {getDriverName(leg.driverId)}
                          </span>
                        )}
                      </div>
                    ))}
                    {fullLegs.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{fullLegs.length - 3} more leg{fullLegs.length - 3 !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          {totalLegs === 0 && (
            <p className="text-muted-foreground text-center py-2">No driver allocation configured</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

