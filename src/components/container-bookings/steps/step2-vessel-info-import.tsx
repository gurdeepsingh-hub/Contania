'use client'

import { useState, useEffect, useCallback } from 'react'
import { FormInput, FormCombobox, FormCheckbox } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { VesselForm } from '@/components/entity-forms/vessel-form'

type Vessel = {
  id: number
  vesselName: string
  voyageNumber?: string
  lloydsNumber?: string
  eta?: string
  availability?: string
  storageStart?: string
  firstFreeImportDate?: string
}

interface Step2VesselInfoImportProps {
  formData: {
    vesselId?: number
    eta?: string
    availability?: boolean
    storageStart?: string
    firstFreeImportDate?: string
  }
  onUpdate: (data: Partial<Step2VesselInfoImportProps['formData']>) => void
  errors?: Record<string, string>
}

export function Step2VesselInfoImport({
  formData,
  onUpdate,
  errors,
}: Step2VesselInfoImportProps) {
  const [loading, setLoading] = useState(false)
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null)
  const [showVesselModal, setShowVesselModal] = useState(false)

  const loadVessels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/vessels?jobType=import&limit=100')
      if (res.ok) {
        const data = await res.json()
        setVessels(data.vessels || [])
      }
    } catch (error) {
      console.error('Error loading vessels:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadVessels()
  }, [loadVessels])

  useEffect(() => {
    if (formData.vesselId) {
      // Load vessel details
      fetch(`/api/vessels/${formData.vesselId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.vessel) {
            const vessel = data.vessel as Vessel
            setSelectedVessel(vessel)
            // Auto-fill vessel fields if not already set
            if (vessel.eta && !formData.eta) {
              onUpdate({ eta: vessel.eta })
            }
            if (vessel.availability !== undefined && formData.availability === undefined) {
              onUpdate({ availability: !!vessel.availability })
            }
            if (vessel.storageStart && !formData.storageStart) {
              onUpdate({ storageStart: vessel.storageStart })
            }
            if (vessel.firstFreeImportDate && !formData.firstFreeImportDate) {
              onUpdate({ firstFreeImportDate: vessel.firstFreeImportDate })
            }
          }
        })
        .catch((error) => console.error('Error fetching vessel:', error))
    } else {
      setSelectedVessel(null)
    }
  }, [formData.vesselId, onUpdate])

  const handleVesselCreated = (vessel: Vessel) => {
    if (!vessel.id) return
    setVessels((prev) => [...prev, vessel])
    loadVessels().then(() => {
      onUpdate({ vesselId: vessel.id })
      setShowVesselModal(false)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <div className="flex-1">
          <FormCombobox
            label="Vessel"
            placeholder="Select vessel..."
            options={vessels.map((v) => ({
              value: v.id,
              label: `${v.vesselName}${v.voyageNumber ? ` - ${v.voyageNumber}` : ''}`,
            }))}
            value={formData.vesselId}
            onValueChange={(value) =>
              onUpdate({ vesselId: typeof value === 'number' ? value : undefined })
            }
            error={errors?.vesselId}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="mt-8"
          onClick={() => setShowVesselModal(true)}
          title="Quick create vessel"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {selectedVessel && (
        <div className="p-4 bg-muted rounded-md space-y-2 text-sm">
          <p>
            <strong>Vessel:</strong> {selectedVessel.vesselName}
          </p>
          {selectedVessel.voyageNumber && (
            <p>
              <strong>Voyage:</strong> {selectedVessel.voyageNumber}
            </p>
          )}
          {selectedVessel.lloydsNumber && (
            <p>
              <strong>Lloyds Number:</strong> {selectedVessel.lloydsNumber}
            </p>
          )}
        </div>
      )}

      <FormInput
        label="ETA (Estimated Time of Arrival)"
        type="date"
        value={formData.eta ? new Date(formData.eta).toISOString().split('T')[0] : ''}
        onChange={(e) => onUpdate({ eta: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
        error={errors?.eta}
      />

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="availability"
          checked={formData.availability || false}
          onChange={(e) => onUpdate({ availability: e.target.checked })}
          className="w-4 h-4"
        />
        <label htmlFor="availability" className="text-sm font-medium">
          Availability
        </label>
      </div>
      {errors?.availability && (
        <p className="text-sm text-destructive">{errors.availability}</p>
      )}

      <FormInput
        label="Storage Start Date"
        type="date"
        value={
          formData.storageStart
            ? new Date(formData.storageStart).toISOString().split('T')[0]
            : ''
        }
        onChange={(e) =>
          onUpdate({
            storageStart: e.target.value
              ? new Date(e.target.value).toISOString()
              : undefined,
          })
        }
        error={errors?.storageStart}
      />

      <FormInput
        label="First Free Import Date"
        type="date"
        value={
          formData.firstFreeImportDate
            ? new Date(formData.firstFreeImportDate).toISOString().split('T')[0]
            : ''
        }
        onChange={(e) =>
          onUpdate({
            firstFreeImportDate: e.target.value
              ? new Date(e.target.value).toISOString()
              : undefined,
          })
        }
        error={errors?.firstFreeImportDate}
      />

      {/* Vessel Form Modal */}
      <Dialog open={showVesselModal} onOpenChange={setShowVesselModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Vessel (Import)</DialogTitle>
          </DialogHeader>
          <VesselForm
            initialData={{ jobType: 'import' } as any}
            onSuccess={async (vessel) => {
              handleVesselCreated(vessel as Vessel)
            }}
            onCancel={() => setShowVesselModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

