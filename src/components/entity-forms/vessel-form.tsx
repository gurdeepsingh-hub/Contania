'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormInput, FormSelect, FormCombobox } from '@/components/ui/form-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Save, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { WharfForm } from './wharf-form'

const vesselSchema = z.object({
  vesselName: z.string().min(1, 'Vessel name is required'),
  voyageNumber: z.string().min(1, 'Voyage number is required'),
  lloydsNumber: z.string().optional(),
  wharfId: z.number().optional(),
  jobType: z.enum(['import', 'export']),
  // Import fields
  eta: z.string().optional(),
  availability: z.string().optional(),
  storageStart: z.string().optional(),
  firstFreeImportDate: z.string().optional(),
  // Export fields
  etd: z.string().optional(),
  receivalStart: z.string().optional(),
  cutoff: z.string().optional(),
  reeferCutoff: z.string().optional(),
})

type VesselFormData = z.infer<typeof vesselSchema>

type Vessel = {
  id?: number
  vesselName?: string
  voyageNumber?: string
  lloydsNumber?: string
  wharfId?: number | { id: number }
  jobType?: 'import' | 'export'
  eta?: string | Date
  availability?: string | Date
  storageStart?: string | Date
  firstFreeImportDate?: string | Date
  etd?: string | Date
  receivalStart?: string | Date
  cutoff?: string | Date
  reeferCutoff?: string | Date
}

type Wharf = {
  id: number
  name: string
}

// Helper function to convert date string (YYYY-MM-DD) or Date object to datetime-local format (YYYY-MM-DDTHH:mm)
const formatDateForInput = (dateValue: string | Date | undefined | null): string => {
  if (!dateValue) return ''

  // Handle Date objects
  if (dateValue instanceof Date) {
    // Convert Date to local datetime string (YYYY-MM-DDTHH:mm)
    // Use local time, not UTC
    const year = dateValue.getFullYear()
    const month = String(dateValue.getMonth() + 1).padStart(2, '0')
    const day = String(dateValue.getDate()).padStart(2, '0')
    const hours = String(dateValue.getHours()).padStart(2, '0')
    const minutes = String(dateValue.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  // Handle string values
  const dateString = String(dateValue).trim()

  // If empty after trimming, return empty string
  if (!dateString) return ''

  // If it's already in datetime-local format (YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss)
  if (dateString.includes('T')) {
    // Extract date and time parts
    const [date, time] = dateString.split('T')
    if (!date || !time) return dateString

    // Handle timezone offset (Z or +/-HH:mm)
    let timePart = time
    if (timePart.includes('Z')) {
      timePart = timePart.replace('Z', '')
    } else if (timePart.includes('+') || timePart.includes('-')) {
      // Remove timezone offset (e.g., +05:30 or -08:00)
      const timezoneMatch = timePart.match(/([+-]\d{2}:\d{2})$/)
      if (timezoneMatch) {
        timePart = timePart.replace(timezoneMatch[0], '')
      }
    }

    // Remove seconds if present (datetime-local doesn't support seconds)
    const timeWithoutSeconds = timePart.split(':').slice(0, 2).join(':')
    return `${date}T${timeWithoutSeconds}`
  }

  // If it's just a date (YYYY-MM-DD), add time component
  // Validate it's a proper date format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return `${dateString}T00:00`
  }

  // If format is unexpected, try to parse it
  try {
    const parsedDate = new Date(dateString)
    if (!isNaN(parsedDate.getTime())) {
      const year = parsedDate.getFullYear()
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
      const day = String(parsedDate.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}T00:00`
    }
  } catch {
    // If parsing fails, return empty string
    return ''
  }

  return ''
}

// Helper function to convert datetime-local format to date string for API
const formatDateForAPI = (dateTimeString: string | undefined | null): string | undefined => {
  if (!dateTimeString) return undefined
  // Extract just the date part (YYYY-MM-DD)
  return dateTimeString.split('T')[0]
}

interface VesselFormProps {
  initialData?: Vessel | null
  onSuccess: (vessel: Vessel) => void
  onCancel: () => void
  mode?: 'create' | 'edit'
  jobType?: 'import' | 'export'
}

export function VesselForm({ initialData, onSuccess, onCancel, mode = 'create', jobType: propJobType }: VesselFormProps) {
  const [wharves, setWharves] = useState<Wharf[]>([])
  const [showWharfModal, setShowWharfModal] = useState(false)

  useEffect(() => {
    const loadWharves = async () => {
      try {
        const res = await fetch('/api/wharves?limit=100')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.wharves) {
            setWharves(data.wharves)
          }
        }
      } catch (error) {
        console.error('Error loading wharves:', error)
      }
    }
    loadWharves()
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    reset,
  } = useForm<VesselFormData>({
    resolver: zodResolver(vesselSchema),
    defaultValues: {
      vesselName: initialData?.vesselName || '',
      voyageNumber: initialData?.voyageNumber || '',
      lloydsNumber: initialData?.lloydsNumber || '',
      wharfId:
        typeof initialData?.wharfId === 'object'
          ? initialData.wharfId.id
          : initialData?.wharfId || undefined,
      jobType: initialData?.jobType || propJobType || 'import',
      eta: formatDateForInput(initialData?.eta),
      availability: formatDateForInput(initialData?.availability),
      storageStart: formatDateForInput(initialData?.storageStart),
      firstFreeImportDate: formatDateForInput(initialData?.firstFreeImportDate),
      etd: formatDateForInput(initialData?.etd),
      receivalStart: formatDateForInput(initialData?.receivalStart),
      cutoff: formatDateForInput(initialData?.cutoff),
      reeferCutoff: formatDateForInput(initialData?.reeferCutoff),
    },
  })

  // Reset form when initialData changes (e.g., when opening edit dialog)
  useEffect(() => {
    if (initialData) {
      reset({
        vesselName: initialData.vesselName || '',
        voyageNumber: initialData.voyageNumber || '',
        lloydsNumber: initialData.lloydsNumber || '',
        wharfId:
          typeof initialData.wharfId === 'object'
            ? initialData.wharfId.id
            : initialData.wharfId || undefined,
        jobType: initialData.jobType || propJobType || 'import',
        eta: formatDateForInput(initialData.eta),
        availability: formatDateForInput(initialData.availability),
        storageStart: formatDateForInput(initialData.storageStart),
        firstFreeImportDate: formatDateForInput(initialData.firstFreeImportDate),
        etd: formatDateForInput(initialData.etd),
        receivalStart: formatDateForInput(initialData.receivalStart),
        cutoff: formatDateForInput(initialData.cutoff),
        reeferCutoff: formatDateForInput(initialData.reeferCutoff),
      })
    } else {
      // Reset to empty form when initialData is null/undefined
      reset({
        vesselName: '',
        voyageNumber: '',
        lloydsNumber: '',
        wharfId: undefined,
        jobType: propJobType || 'import',
        eta: '',
        availability: '',
        storageStart: '',
        firstFreeImportDate: '',
        etd: '',
        receivalStart: '',
        cutoff: '',
        reeferCutoff: '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.id, initialData?.vesselName, reset])

  const jobType = watch('jobType')

  const handleWharfCreated = (wharf: { id?: number; name?: string }) => {
    if (wharf.id) {
      // Add to the list
      const newWharf: Wharf = {
        id: wharf.id,
        name: wharf.name || '',
      }
      setWharves((prev) => [...prev, newWharf])
      // Set as selected
      setValue('wharfId', wharf.id)
      toast.success('Wharf created successfully')
    }
  }

  const onSubmit = async (data: VesselFormData) => {
    try {
      const url = initialData?.id ? `/api/vessels/${initialData.id}` : '/api/vessels'
      const method = initialData?.id ? 'PATCH' : 'POST'

      // Convert datetime-local strings back to date strings for API
      // Ensure jobType is always included (from form data, prop, or initialData)
      const apiData = {
        ...data,
        jobType: data.jobType || propJobType || initialData?.jobType || 'import',
        eta: formatDateForAPI(data.eta),
        availability: formatDateForAPI(data.availability),
        storageStart: formatDateForAPI(data.storageStart),
        firstFreeImportDate: formatDateForAPI(data.firstFreeImportDate),
        etd: formatDateForAPI(data.etd),
        receivalStart: formatDateForAPI(data.receivalStart),
        cutoff: formatDateForAPI(data.cutoff),
        reeferCutoff: formatDateForAPI(data.reeferCutoff),
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      })

      if (res.ok) {
        const result = await res.json()
        toast.success(
          mode === 'create' ? 'Vessel created successfully' : 'Vessel updated successfully',
        )
        onSuccess(result.vessel || result)
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to save vessel')
      }
    } catch (error) {
      console.error('Error saving vessel:', error)
      toast.error('An error occurred while saving the vessel')
    }
  }

  const vesselName = watch('vesselName')
  const voyageNumber = watch('voyageNumber')

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Vessel Name"
            required
            error={errors.vesselName?.message}
            placeholder="Vessel name"
            {...register('vesselName')}
          />
          <FormInput
            label="Voyage Number"
            required
            error={errors.voyageNumber?.message}
            placeholder="Voyage number"
            {...register('voyageNumber')}
          />
          {(vesselName || voyageNumber) && (
            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Display Name: </span>
                <span>{vesselName || ''}{vesselName && voyageNumber ? '/' : ''}{voyageNumber || ''}</span>
              </div>
            </div>
          )}
          <FormInput
            label="Lloyds Number"
            error={errors.lloydsNumber?.message}
            placeholder="Lloyds number"
            {...register('lloydsNumber')}
          />
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <FormCombobox
                label="Wharf"
                placeholder="Select wharf..."
                options={wharves.map((wh) => ({
                  value: wh.id,
                  label: wh.name,
                }))}
                value={watch('wharfId')}
                onValueChange={(value) => {
                  setValue('wharfId', value ? Number(value) : undefined)
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="mt-8"
              onClick={() => setShowWharfModal(true)}
              title="Quick create wharf"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {jobType === 'import' && (
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-4">Import Fields</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="ETA"
                type="datetime-local"
                error={errors.eta?.message}
                {...register('eta')}
              />
              <FormInput
                label="Availability"
                type="datetime-local"
                error={errors.availability?.message}
                {...register('availability')}
              />
              <FormInput
                label="Storage Start"
                type="datetime-local"
                error={errors.storageStart?.message}
                {...register('storageStart')}
              />
              <FormInput
                label="First Free Import Date"
                type="datetime-local"
                error={errors.firstFreeImportDate?.message}
                {...register('firstFreeImportDate')}
              />
            </div>
          </div>
        )}

        {jobType === 'export' && (
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-4">Export Fields</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="ETD"
                type="datetime-local"
                error={errors.etd?.message}
                {...register('etd')}
              />
              <FormInput
                label="Receival Start"
                type="datetime-local"
                error={errors.receivalStart?.message}
                {...register('receivalStart')}
              />
              <FormInput
                label="Cutoff"
                type="datetime-local"
                error={errors.cutoff?.message}
                {...register('cutoff')}
              />
              <FormInput
                label="Reefer Cutoff"
                type="datetime-local"
                error={errors.reeferCutoff?.message}
                {...register('reeferCutoff')}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create' : 'Update'}
          </Button>
        </div>
      </form>

      {/* Quick Create Wharf Dialog */}
      <Dialog open={showWharfModal} onOpenChange={setShowWharfModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Create Wharf</DialogTitle>
            <DialogDescription>Create a new wharf quickly</DialogDescription>
          </DialogHeader>
          <WharfForm
            onSuccess={handleWharfCreated}
            onCancel={() => setShowWharfModal(false)}
            mode="create"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
