'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { FormInput, FormCombobox } from '@/components/ui/form-field'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { toast } from 'sonner'
import { Plus, Trash2, Save, CheckCircle2, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type ContainerSize = {
  id: number
  size: string
  code?: string
}

type ShippingLine = {
  id: number
  name: string
}

type Warehouse = {
  id: number
  name: string
}

type ContainerDetail = {
  id?: number
  containerNumber: string
  containerSizeId: number
  warehouseId?: number
  gross?: string
  tare?: string
  net?: string
  pin?: string
  whManifest?: string
  isoCode?: string
  timeSlot?: string
  emptyTimeSlot?: string
  dehireDate?: string
  shippingLineId?: number
  countryOfOrigin?: string
  orderRef?: string
  jobAvailability?: string
  sealNumber?: string
  customerRequestDate?: string
  dock?: string
  confirmedUnpackDate?: string
  yardLocation?: string
  secureSealsIntact?: string
  inspectUnpack?: string
  directionType?: string
  houseBillNumber?: string
  oceanBillNumber?: string
  ventAirflow?: string
}

interface Step5ContainerDetailsExportProps {
  bookingId?: number
  formData: {
    containerDetails?: ContainerDetail[]
  }
  step3Data?: {
    containerSizeIds?: number[]
    containerQuantities?: Record<string, number>
  }
  step4Data?: {
    emptyRouting?: {
      shippingLineId?: number
    }
  }
  onUpdate: (data: Partial<Step5ContainerDetailsExportProps['formData']>) => void
  errors?: Record<string, string>
}

export function Step5ContainerDetailsExport({
  bookingId,
  formData,
  step3Data,
  step4Data,
  onUpdate,
  errors,
}: Step5ContainerDetailsExportProps) {
  const [loading, setLoading] = useState(false)
  const [containerSizes, setContainerSizes] = useState<ContainerSize[]>([])
  const [shippingLines, setShippingLines] = useState<ShippingLine[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [containers, setContainers] = useState<ContainerDetail[]>(formData.containerDetails || [])
  const [weightErrors, setWeightErrors] = useState<
    Record<number, { gross?: string; tare?: string }>
  >({})
  const [expandedContainer, setExpandedContainer] = useState<string | undefined>(undefined)
  const [savingContainerIndex, setSavingContainerIndex] = useState<number | null>(null)

  // Group containers by size
  const containersBySize = useMemo(() => {
    const grouped: Record<
      number,
      {
        size: ContainerSize | undefined
        containers: Array<{ container: ContainerDetail; index: number }>
      }
    > = {}

    containers.forEach((container, index) => {
      const sizeId = container.containerSizeId
      if (!grouped[sizeId]) {
        grouped[sizeId] = {
          size: containerSizes.find((s) => s.id === sizeId),
          containers: [],
        }
      }
      grouped[sizeId].containers.push({ container, index })
    })

    return grouped
  }, [containers, containerSizes])

  const loadOptions = useCallback(async () => {
    setLoading(true)
    try {
      const [sizesRes, shippingLinesRes, warehousesRes] = await Promise.all([
        fetch('/api/container-sizes?limit=100'),
        fetch('/api/shipping-lines?limit=100'),
        fetch('/api/warehouses?limit=100'),
      ])

      if (sizesRes.ok) {
        const data = await sizesRes.json()
        setContainerSizes(data.containerSizes || [])
      }
      if (shippingLinesRes.ok) {
        const data = await shippingLinesRes.json()
        setShippingLines(data.shippingLines || [])
      }
      if (warehousesRes.ok) {
        const data = await warehousesRes.json()
        const warehousesData = data.warehouses || []
        setWarehouses(warehousesData)
      }
    } catch (error) {
      console.error('Error loading options:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  // Auto-select warehouse if only one option and container doesn't have warehouseId
  useEffect(() => {
    if (warehouses.length === 1) {
      const updatedContainers = containers.map((container) => {
        if (!container.warehouseId) {
          return { ...container, warehouseId: warehouses[0].id }
        }
        return container
      })
      // Only update if there were changes
      const hasChanges = updatedContainers.some(
        (container, index) => container.warehouseId !== containers[index]?.warehouseId,
      )
      if (hasChanges) {
        setContainers(updatedContainers)
        onUpdate({ containerDetails: updatedContainers })
      }
    }
  }, [warehouses, containers, onUpdate])

  // Initialize containers from Step 3 quantities
  useEffect(() => {
    if (step3Data?.containerSizeIds && step3Data?.containerQuantities && containers.length === 0) {
      const newContainers: ContainerDetail[] = []
      step3Data.containerSizeIds.forEach((sizeId) => {
        const quantity = step3Data.containerQuantities?.[String(sizeId)] || 0
        for (let i = 0; i < quantity; i++) {
          newContainers.push({
            containerSizeId: sizeId,
            containerNumber: '',
            shippingLineId: step4Data?.emptyRouting?.shippingLineId,
          })
        }
      })
      setContainers(newContainers)
      onUpdate({ containerDetails: newContainers })
    }
  }, [step3Data, step4Data, containers.length, onUpdate])

  // Helper function to calculate net weight from gross and tare
  const calculateNetWeight = (gross: string | undefined, tare: string | undefined): string => {
    if (!gross || !tare) return ''
    const grossNum = parseFloat(gross)
    const tareNum = parseFloat(tare)
    if (isNaN(grossNum) || isNaN(tareNum)) return ''
    const net = grossNum - tareNum
    return net >= 0 ? net.toString() : ''
  }

  // Validate that tare is less than gross
  const validateWeights = (
    gross: string | undefined,
    tare: string | undefined,
  ): { gross?: string; tare?: string } => {
    const errors: { gross?: string; tare?: string } = {}

    if (gross && tare) {
      const grossNum = parseFloat(gross)
      const tareNum = parseFloat(tare)

      if (!isNaN(grossNum) && !isNaN(tareNum)) {
        if (tareNum >= grossNum) {
          errors.tare = 'Tare weight must be less than gross weight'
          errors.gross = 'Gross weight must be greater than tare weight'
        }
      }
    }

    return errors
  }

  const updateContainer = (index: number, field: keyof ContainerDetail, value: any) => {
    const updated = [...containers]
    updated[index] = { ...updated[index], [field]: value }

    // Auto-calculate net weight when gross or tare changes
    if (field === 'gross' || field === 'tare') {
      const gross = field === 'gross' ? value : updated[index].gross
      const tare = field === 'tare' ? value : updated[index].tare

      // Validate weights
      const weightValidationErrors = validateWeights(gross, tare)
      setWeightErrors((prev) => ({
        ...prev,
        [index]: weightValidationErrors,
      }))

      // Only calculate net if validation passes
      if (!weightValidationErrors.gross && !weightValidationErrors.tare) {
        updated[index].net = calculateNetWeight(gross, tare)
      } else {
        // Clear net weight if validation fails
        updated[index].net = ''
      }
    }

    setContainers(updated)
    onUpdate({ containerDetails: updated })
  }

  const addContainer = () => {
    const newContainer: ContainerDetail = {
      containerNumber: '',
      containerSizeId: step3Data?.containerSizeIds?.[0] || 0,
      shippingLineId: step4Data?.emptyRouting?.shippingLineId,
    }
    const updated = [...containers, newContainer]
    setContainers(updated)
    onUpdate({ containerDetails: updated })
  }

  const removeContainer = (index: number) => {
    const updated = containers.filter((_, i) => i !== index)
    setContainers(updated)
    onUpdate({ containerDetails: updated })
  }

  const saveContainer = async (index: number) => {
    if (!bookingId) {
      toast.error('Booking ID is required')
      return
    }

    const container = containers[index]
    if (!container.containerNumber || !container.containerSizeId || !container.warehouseId) {
      toast.error('Container number, size, and warehouse are required')
      return
    }

    // Validate weights before saving
    const weightValidationErrors = validateWeights(container.gross, container.tare)
    if (weightValidationErrors.gross || weightValidationErrors.tare) {
      toast.error('Please fix weight validation errors before saving')
      setWeightErrors((prev) => ({
        ...prev,
        [index]: weightValidationErrors,
      }))
      return
    }

    setSavingContainerIndex(index)
    try {
      const method = container.id ? 'PATCH' : 'POST'
      const url = container.id
        ? `/api/container-details/${container.id}`
        : `/api/export-container-bookings/${bookingId}/container-details`

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(container),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && data.containerDetail) {
          const updated = [...containers]
          updated[index] = { ...updated[index], id: data.containerDetail.id }
          setContainers(updated)
          onUpdate({ containerDetails: updated })
          toast.success(container.id ? 'Container detail updated' : 'Container detail saved')
        }
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to save container detail')
      }
    } catch (error) {
      console.error('Error saving container:', error)
      toast.error('Failed to save container detail')
    } finally {
      setSavingContainerIndex(null)
    }
  }

  const getContainerStatus = (container: ContainerDetail) => {
    if (!container.containerNumber || !container.containerSizeId || !container.warehouseId) {
      return { status: 'incomplete', label: 'Incomplete', icon: AlertCircle }
    }
    if (container.id) {
      return { status: 'saved', label: 'Saved', icon: CheckCircle2 }
    }
    return { status: 'unsaved', label: 'Not Saved', icon: AlertCircle }
  }

  const getContainerDisplayName = (container: ContainerDetail, index: number) => {
    if (container.containerNumber) {
      return `Container ${container.containerNumber}`
    }
    return `Container ${index + 1}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Container Details</h3>
        <Button type="button" onClick={addContainer} variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Container
        </Button>
      </div>

      {containers.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No containers defined. Containers will be created based on Step 3 quantities.</p>
        </div>
      )}

      <div className="space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto">
        {Object.entries(containersBySize).map(([sizeId, { size, containers: sizeContainers }]) => (
          <div key={sizeId} className="space-y-3">
            <div className="sticky top-0 bg-background z-10 pb-2 border-b">
              <h4 className="text-base font-semibold text-foreground">
                {size ? `${size.size}${size.attribute ? ` ${size.attribute}` : ''}` : `Size ID: ${sizeId}`}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({sizeContainers.length}{' '}
                  {sizeContainers.length === 1 ? 'container' : 'containers'})
                </span>
              </h4>
            </div>

            <Accordion
              type="single"
              collapsible
              value={expandedContainer}
              onValueChange={setExpandedContainer}
              className="space-y-2"
            >
              {sizeContainers.map(({ container, index }) => {
                const containerId = `container-${index}`
                const containerStatus = getContainerStatus(container)
                const StatusIcon = containerStatus.icon
                const isSaving = savingContainerIndex === index
                const canSave =
                  container.containerNumber &&
                  container.containerSizeId &&
                  container.warehouseId &&
                  !weightErrors[index]?.gross &&
                  !weightErrors[index]?.tare

                return (
                  <AccordionItem key={index} value={containerId} className="border rounded-lg px-4">
                    <div className="flex items-center gap-2">
                      <AccordionTrigger className="hover:no-underline flex-1">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="font-medium">
                            {getContainerDisplayName(container, index + 1)}
                          </span>
                          <Badge
                            variant={
                              containerStatus.status === 'saved'
                                ? 'default'
                                : containerStatus.status === 'incomplete'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                            className="flex items-center gap-1"
                          >
                            <StatusIcon className="w-3 h-3" />
                            {containerStatus.label}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      {bookingId && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            saveContainer(index)
                          }}
                          disabled={!canSave || isSaving}
                          className="shrink-0"
                        >
                          <Save className="w-4 h-4 mr-1" />
                          {isSaving ? 'Saving...' : container.id ? 'Update' : 'Save'}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeContainer(index)
                        }}
                        className="shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <AccordionContent>
                      <div className="pt-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormInput
                            label="Container Number"
                            required
                            value={container.containerNumber || ''}
                            onChange={(e) =>
                              updateContainer(index, 'containerNumber', e.target.value)
                            }
                            error={errors?.[`containerDetails.${index}.containerNumber`]}
                          />

                          <FormCombobox
                            label="Container Size"
                            required
                            placeholder="Select container size..."
                            options={containerSizes.map((size) => ({
                              value: size.id,
                              label: `${size.size}${size.attribute ? ` ${size.attribute}` : ''}`,
                            }))}
                            value={container.containerSizeId}
                            onValueChange={(value) =>
                              updateContainer(
                                index,
                                'containerSizeId',
                                typeof value === 'number' ? value : 0,
                              )
                            }
                            error={errors?.[`containerDetails.${index}.containerSizeId`]}
                          />

                          <FormCombobox
                            label="Warehouse"
                            required
                            placeholder="Select warehouse..."
                            options={warehouses.map((wh) => ({
                              value: wh.id,
                              label: wh.name,
                            }))}
                            value={container.warehouseId}
                            onValueChange={(value) =>
                              updateContainer(
                                index,
                                'warehouseId',
                                typeof value === 'number' ? value : undefined,
                              )
                            }
                            error={errors?.[`containerDetails.${index}.warehouseId`]}
                          />

                          <FormCombobox
                            label="Shipping Line"
                            placeholder="Select shipping line..."
                            options={shippingLines.map((sl) => ({
                              value: sl.id,
                              label: sl.name,
                            }))}
                            value={container.shippingLineId}
                            onValueChange={(value) =>
                              updateContainer(
                                index,
                                'shippingLineId',
                                typeof value === 'number' ? value : undefined,
                              )
                            }
                          />

                          <FormInput
                            label="Gross Weight"
                            value={container.gross || ''}
                            onChange={(e) => updateContainer(index, 'gross', e.target.value)}
                            error={weightErrors[index]?.gross}
                          />

                          <FormInput
                            label="Tare Weight"
                            value={container.tare || ''}
                            onChange={(e) => updateContainer(index, 'tare', e.target.value)}
                            error={weightErrors[index]?.tare}
                          />

                          <FormInput
                            label="Net Weight"
                            value={
                              container.net ||
                              calculateNetWeight(container.gross, container.tare) ||
                              ''
                            }
                            readOnly
                            className="bg-muted"
                            placeholder="Auto-calculated (Gross - Tare)"
                          />

                          <FormInput
                            label="PIN"
                            value={container.pin || ''}
                            onChange={(e) => updateContainer(index, 'pin', e.target.value)}
                          />

                          <FormInput
                            label="Warehouse Manifest"
                            value={container.whManifest || ''}
                            onChange={(e) => updateContainer(index, 'whManifest', e.target.value)}
                          />

                          <FormInput
                            label="ISO Code"
                            value={container.isoCode || ''}
                            onChange={(e) => updateContainer(index, 'isoCode', e.target.value)}
                          />

                          <FormInput
                            label="Time Slot"
                            value={container.timeSlot || ''}
                            onChange={(e) => updateContainer(index, 'timeSlot', e.target.value)}
                          />

                          <FormInput
                            label="Empty Time Slot"
                            value={container.emptyTimeSlot || ''}
                            onChange={(e) =>
                              updateContainer(index, 'emptyTimeSlot', e.target.value)
                            }
                          />

                          <FormInput
                            label="Dehire Date"
                            type="date"
                            value={
                              container.dehireDate
                                ? new Date(container.dehireDate).toISOString().split('T')[0]
                                : ''
                            }
                            onChange={(e) =>
                              updateContainer(
                                index,
                                'dehireDate',
                                e.target.value ? new Date(e.target.value).toISOString() : undefined,
                              )
                            }
                          />

                          <FormInput
                            label="Country of Origin"
                            value={container.countryOfOrigin || ''}
                            onChange={(e) =>
                              updateContainer(index, 'countryOfOrigin', e.target.value)
                            }
                          />

                          <FormInput
                            label="Order Reference"
                            value={container.orderRef || ''}
                            onChange={(e) => updateContainer(index, 'orderRef', e.target.value)}
                          />

                          <FormInput
                            label="Job Availability"
                            type="date"
                            value={
                              container.jobAvailability
                                ? new Date(container.jobAvailability).toISOString().split('T')[0]
                                : ''
                            }
                            onChange={(e) =>
                              updateContainer(
                                index,
                                'jobAvailability',
                                e.target.value ? new Date(e.target.value).toISOString() : undefined,
                              )
                            }
                          />

                          <FormInput
                            label="Seal Number"
                            value={container.sealNumber || ''}
                            onChange={(e) => updateContainer(index, 'sealNumber', e.target.value)}
                          />

                          <FormInput
                            label="Customer Request Date"
                            type="date"
                            value={
                              container.customerRequestDate
                                ? new Date(container.customerRequestDate)
                                    .toISOString()
                                    .split('T')[0]
                                : ''
                            }
                            onChange={(e) =>
                              updateContainer(
                                index,
                                'customerRequestDate',
                                e.target.value ? new Date(e.target.value).toISOString() : undefined,
                              )
                            }
                          />

                          <FormInput
                            label="Dock"
                            value={container.dock || ''}
                            onChange={(e) => updateContainer(index, 'dock', e.target.value)}
                          />

                          <FormInput
                            label="Confirmed Unpack Date"
                            type="date"
                            value={
                              container.confirmedUnpackDate
                                ? new Date(container.confirmedUnpackDate)
                                    .toISOString()
                                    .split('T')[0]
                                : ''
                            }
                            onChange={(e) =>
                              updateContainer(
                                index,
                                'confirmedUnpackDate',
                                e.target.value ? new Date(e.target.value).toISOString() : undefined,
                              )
                            }
                          />

                          <FormInput
                            label="Yard Location"
                            value={container.yardLocation || ''}
                            onChange={(e) => updateContainer(index, 'yardLocation', e.target.value)}
                          />

                          <FormInput
                            label="Secure Seals Intact"
                            type="date"
                            value={
                              container.secureSealsIntact
                                ? new Date(container.secureSealsIntact).toISOString().split('T')[0]
                                : ''
                            }
                            onChange={(e) =>
                              updateContainer(
                                index,
                                'secureSealsIntact',
                                e.target.value ? new Date(e.target.value).toISOString() : undefined,
                              )
                            }
                          />

                          <FormInput
                            label="Inspect Unpack"
                            type="date"
                            value={
                              container.inspectUnpack
                                ? new Date(container.inspectUnpack).toISOString().split('T')[0]
                                : ''
                            }
                            onChange={(e) =>
                              updateContainer(
                                index,
                                'inspectUnpack',
                                e.target.value ? new Date(e.target.value).toISOString() : undefined,
                              )
                            }
                          />

                          <FormInput
                            label="Direction Type"
                            value={container.directionType || ''}
                            onChange={(e) =>
                              updateContainer(index, 'directionType', e.target.value)
                            }
                          />

                          <FormInput
                            label="House Bill Number"
                            value={container.houseBillNumber || ''}
                            onChange={(e) =>
                              updateContainer(index, 'houseBillNumber', e.target.value)
                            }
                          />

                          <FormInput
                            label="Ocean Bill Number"
                            value={container.oceanBillNumber || ''}
                            onChange={(e) =>
                              updateContainer(index, 'oceanBillNumber', e.target.value)
                            }
                          />

                          <FormInput
                            label="Vent Airflow"
                            value={container.ventAirflow || ''}
                            onChange={(e) => updateContainer(index, 'ventAirflow', e.target.value)}
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </div>
        ))}
      </div>
    </div>
  )
}
