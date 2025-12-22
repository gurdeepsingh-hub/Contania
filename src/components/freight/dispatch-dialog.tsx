'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { VehicleFormDialog } from '@/components/entity-forms/vehicle-form-dialog'
import { DriverFormDialog } from '@/components/entity-forms/driver-form-dialog'
import { toast } from 'sonner'
import { Loader2, Truck, User, Car, Plus } from 'lucide-react'

type Vehicle = {
  id?: number
  fleetNumber?: string
  rego?: string
}

type Driver = {
  id?: number
  name?: string
  phoneNumber?: string
}

interface DispatchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: number
}

export function DispatchDialog({ open, onOpenChange, jobId }: DispatchDialogProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [dispatchType, setDispatchType] = useState<'simple' | 'with-driver' | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null)
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null)

  // Quick create states
  const [showCreateVehicle, setShowCreateVehicle] = useState(false)
  const [showCreateDriver, setShowCreateDriver] = useState(false)

  useEffect(() => {
    if (open && jobId) {
      loadData()
    } else {
      // Reset form when dialog closes
      setDispatchType(null)
      setSelectedVehicleId(null)
      setSelectedDriverId(null)
    }
  }, [open, jobId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load vehicles
      const vehiclesRes = await fetch('/api/vehicles?limit=1000')
      if (vehiclesRes.ok) {
        const vehiclesData = await vehiclesRes.json()
        if (vehiclesData.success) {
          setVehicles(vehiclesData.vehicles || [])
        }
      }

      // Load drivers
      const driversRes = await fetch('/api/drivers?limit=1000')
      if (driversRes.ok) {
        const driversData = await driversRes.json()
        if (driversData.success) {
          setDrivers(driversData.drivers || [])
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load vehicles and drivers')
    } finally {
      setLoading(false)
    }
  }

  const handleVehicleCreated = async (vehicle: Vehicle) => {
    // Reload vehicles and select the new one
    await loadData()
    if (vehicle.id) {
      setSelectedVehicleId(vehicle.id)
    }
  }

  const handleDriverCreated = async (driver: Driver) => {
    // Reload drivers and select the new one
    await loadData()
    if (driver.id) {
      setSelectedDriverId(driver.id)
    }
  }

  const handleSubmit = async () => {
    if (!selectedVehicleId) {
      toast.error('Please select a vehicle')
      return
    }

    if (dispatchType === 'with-driver' && !selectedDriverId) {
      toast.error('Please select a driver')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/outbound-inventory/${jobId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: selectedVehicleId,
          driverId: dispatchType === 'with-driver' ? selectedDriverId : undefined,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to dispatch job')
      }

      toast.success('Job dispatched successfully')
      onOpenChange(false)
      // Reload page to show updated status
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    } catch (error: any) {
      console.error('Error dispatching job:', error)
      toast.error(error.message || 'Failed to dispatch job')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dispatch Job</DialogTitle>
            <DialogDescription>
              Select vehicle and optionally assign driver for dispatch.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading vehicles and drivers...</span>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dispatch Job</DialogTitle>
          <DialogDescription>
            Select dispatch type and assign vehicle. Optionally assign a driver.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Step 1: Choose Dispatch Type */}
          {!dispatchType && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Select Dispatch Type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  onClick={() => setDispatchType('simple')}
                >
                  <div className="flex items-start gap-3">
                    <Car className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    <div className="text-left">
                      <div className="font-semibold">Simple Dispatch</div>
                      <div className="text-sm text-muted-foreground">
                        Assign vehicle only for dispatch
                      </div>
                    </div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  onClick={() => setDispatchType('with-driver')}
                >
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    <div className="text-left">
                      <div className="font-semibold">Allocate Driver and Dispatch</div>
                      <div className="text-sm text-muted-foreground">
                        Assign driver first, then assign vehicle for dispatch
                      </div>
                    </div>
                  </div>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Simple Dispatch - Vehicle Selection */}
          {dispatchType === 'simple' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Simple Dispatch
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="vehicle">Vehicle *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCreateVehicle(true)}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Create New
                    </Button>
                  </div>
                  <Combobox
                    options={vehicles
                      .filter((v) => v.id !== undefined)
                      .map((v) => ({
                        value: v.id!,
                        label: `${v.fleetNumber || ''} (${v.rego || ''})`,
                      }))}
                    value={selectedVehicleId || undefined}
                    onValueChange={(value) => {
                      if (value === undefined) {
                        setSelectedVehicleId(null)
                        return
                      }
                      setSelectedVehicleId(value as number)
                    }}
                    placeholder="Select vehicle..."
                    emptyText="No vehicles found"
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDispatchType(null)
                      setSelectedVehicleId(null)
                    }}
                  >
                    Back
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: With Driver - Driver and Vehicle Selection */}
          {dispatchType === 'with-driver' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Allocate Driver and Dispatch
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="driver">Driver *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCreateDriver(true)}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Create New
                    </Button>
                  </div>
                  <Combobox
                    options={drivers
                      .filter((d) => d.id !== undefined)
                      .map((d) => ({
                        value: d.id!,
                        label: `${d.name || ''} (${d.phoneNumber || ''})`,
                      }))}
                    value={selectedDriverId || undefined}
                    onValueChange={(value) => {
                      if (value === undefined) {
                        setSelectedDriverId(null)
                        return
                      }
                      setSelectedDriverId(value as number)
                    }}
                    placeholder="Select driver..."
                    emptyText="No drivers found"
                    className="mt-1"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="vehicle">Vehicle *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCreateVehicle(true)}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Create New
                    </Button>
                  </div>
                  <Combobox
                    options={vehicles
                      .filter((v) => v.id !== undefined)
                      .map((v) => ({
                        value: v.id!,
                        label: `${v.fleetNumber || ''} (${v.rego || ''})`,
                      }))}
                    value={selectedVehicleId || undefined}
                    onValueChange={(value) => {
                      if (value === undefined) {
                        setSelectedVehicleId(null)
                        return
                      }
                      setSelectedVehicleId(value as number)
                    }}
                    placeholder="Select vehicle..."
                    emptyText="No vehicles found"
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDispatchType(null)
                      setSelectedVehicleId(null)
                      setSelectedDriverId(null)
                    }}
                  >
                    Back
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          {dispatchType && (
            <Button onClick={handleSubmit} disabled={submitting || !selectedVehicleId}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Dispatching...
                </>
              ) : (
                <>
                  <Truck className="h-4 w-4 mr-2" />
                  Dispatch Job
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>

      {/* Quick Create Vehicle Dialog */}
      <VehicleFormDialog
        open={showCreateVehicle}
        onOpenChange={setShowCreateVehicle}
        mode="create"
        onSuccess={handleVehicleCreated}
      />

      {/* Quick Create Driver Dialog */}
      <DriverFormDialog
        open={showCreateDriver}
        onOpenChange={setShowCreateDriver}
        mode="create"
        onSuccess={handleDriverCreated}
      />
    </Dialog>
  )
}
