'use client'

import { useState, useEffect, useCallback } from 'react'
import { FormInput, FormCombobox } from '@/components/ui/form-field'
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
  etd?: string
  receivalStart?: string
  cutoff?: boolean
}

interface Step2VesselInfoExportProps {
  formData: {
    vesselId?: number
    etd?: string
    receivalStart?: string
    cutoff?: boolean
  }
  onUpdate: (data: Partial<Step2VesselInfoExportProps['formData']>) => void
  errors?: Record<string, string>
}

export function Step2VesselInfoExport({
  formData,
  onUpdate,
  errors,
}: Step2VesselInfoExportProps) {
  const [loading, setLoading] = useState(false)
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null)
  const [showVesselModal, setShowVesselModal] = useState(false)

  const loadVessels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/vessels?jobType=export&limit=100')
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
            if (vessel.etd && !formData.etd) {
              onUpdate({ etd: vessel.etd })
            }
            if (vessel.receivalStart && !formData.receivalStart) {
              onUpdate({ receivalStart: vessel.receivalStart })
            }
            if (vessel.cutoff !== undefined && formData.cutoff === undefined) {
              onUpdate({ cutoff: !!vessel.cutoff })
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
        label="ETD (Estimated Time of Departure)"
        type="date"
        value={formData.etd ? new Date(formData.etd).toISOString().split('T')[0] : ''}
        onChange={(e) =>
          onUpdate({ etd: e.target.value ? new Date(e.target.value).toISOString() : undefined })
        }
        error={errors?.etd}
      />

      <FormInput
        label="Receival Start Date"
        type="date"
        value={
          formData.receivalStart
            ? new Date(formData.receivalStart).toISOString().split('T')[0]
            : ''
        }
        onChange={(e) =>
          onUpdate({
            receivalStart: e.target.value
              ? new Date(e.target.value).toISOString()
              : undefined,
          })
        }
        error={errors?.receivalStart}
      />

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="cutoff"
          checked={formData.cutoff || false}
          onChange={(e) => onUpdate({ cutoff: e.target.checked })}
          className="w-4 h-4"
        />
        <label htmlFor="cutoff" className="text-sm font-medium">
          Cutoff
        </label>
      </div>
      {errors?.cutoff && <p className="text-sm text-destructive">{errors.cutoff}</p>}

      {/* Vessel Form Modal */}
      <Dialog open={showVesselModal} onOpenChange={setShowVesselModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Vessel (Export)</DialogTitle>
          </DialogHeader>
          <VesselForm
            initialData={{ jobType: 'export' } as any}
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

