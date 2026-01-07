'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Save, PackageCheck } from 'lucide-react'
import { hasViewPermission } from '@/lib/permissions'
import Link from 'next/link'
import { PutAwayDialog } from '@/components/freight/put-away-dialog'
import { toast } from 'sonner'
import { ReceiveStockForm } from '@/components/freight/receive-stock-form'

type ProductLine = {
  id: number
  skuId?: number | { id: number; skuCode?: string; description?: string }
  skuDescription?: string
  batchNumber?: string
  expectedQty?: number
  recievedQty?: number
  expectedWeight?: number
  recievedWeight?: number
  expectedCubicPerHU?: number
  recievedCubicPerHU?: number
  expiryDate?: string
  attribute1?: string
  attribute2?: string
}

type InboundJob = {
  id: number
  expectedDate?: string
  productLines?: ProductLine[]
}

export default function ReceiveStockPage() {
  const router = useRouter()
  const params = useParams()
  const { tenant, loading } = useTenant()
  const [job, setJob] = useState<InboundJob | null>(null)
  const [productLines, setProductLines] = useState<ProductLine[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingJob, setLoadingJob] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [showPutAwayDialog, setShowPutAwayDialog] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({})

  const jobId = params.id as string

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/tenant-users/me')
        if (!res.ok) {
          router.push('/')
          return
        }
        const data = await res.json()
        if (data.success && data.user) {
          const fullUserRes = await fetch(`/api/tenant-users/${data.user.id}?depth=1`)
          if (fullUserRes.ok) {
            const fullUserData = await fullUserRes.json()
            if (fullUserData.success && fullUserData.user) {
              if (!hasViewPermission(fullUserData.user, 'freight')) {
                router.push('/dashboard')
                return
              }
            }
          }
          setAuthChecked(true)
        }
      } catch (error) {
        router.push('/')
      }
    }

    if (!loading && tenant) {
      checkAuth()
    }
  }, [loading, tenant, router])

  useEffect(() => {
    if (authChecked && jobId) {
      loadJob()
    }
  }, [authChecked, jobId])

  const loadJob = async () => {
    try {
      setLoadingJob(true)
      const res = await fetch(`/api/inbound-inventory/${jobId}?depth=2`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setJob(data.job)
          setProductLines(data.job.productLines || [])
        }
      }
    } catch (error) {
      console.error('Error loading job:', error)
    } finally {
      setLoadingJob(false)
    }
  }

  const handleSave = async (action: 'save' | 'putAway') => {
    // Validate all product lines and collect errors
    const errors: Record<number, string> = {}
    const validProductLines: ProductLine[] = []

    productLines.forEach((line) => {
      const hasValidQty =
        line.recievedQty !== undefined && line.recievedQty !== null && line.recievedQty > 0

      if (!hasValidQty) {
        errors[line.id] = 'Please enter a positive received quantity'
      } else {
        validProductLines.push(line)
      }
    })

    // Set validation errors to show field-level errors
    setValidationErrors(errors)

    // Check if at least one product line has valid data
    if (validProductLines.length === 0) {
      toast.error('Please enter a positive received quantity for at least one product line before saving')
      return
    }

    // If there are errors but also valid lines, show a warning
    if (Object.keys(errors).length > 0 && validProductLines.length > 0) {
      toast.warning(
        `Only ${validProductLines.length} product line(s) with positive values will be saved. Please fill in the remaining product lines.`
      )
    }

    setSaving(true)
    try {
      // Only send product lines with positive received quantities
      const res = await fetch(`/api/inbound-inventory/${jobId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedDate: new Date().toISOString(),
          productLines: validProductLines.map((line) => ({
            id: line.id,
            recievedQty: line.recievedQty,
            recievedWeight: line.recievedWeight,
            recievedCubicPerHU: line.recievedCubicPerHU,
          })),
          openCompletionForm: action === 'putAway',
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          toast.success(
            `Stock received successfully for ${validProductLines.length} product line(s)`
          )
          if (action === 'putAway') {
            // Open put-away dialog
            setShowPutAwayDialog(true)
          } else {
            router.push(`/dashboard/freight/inbound/${jobId}`)
          }
        } else {
          toast.error(data.message || 'Failed to save received stock')
        }
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to save received stock')
      }
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Failed to save received stock')
    } finally {
      setSaving(false)
    }
  }

  const handlePutAwayComplete = () => {
    setShowPutAwayDialog(false)
    router.push(`/dashboard/freight/inbound/${jobId}`)
  }

  const updateProductLine = (index: number, field: keyof ProductLine, value: string | number | undefined) => {
    setProductLines((prev) => {
      const updated = [...prev]
      const line = updated[index]
      updated[index] = { ...line, [field]: value }

      // Clear validation error for this line if received quantity becomes valid
      if (field === 'recievedQty') {
        const hasValidQty =
          value !== undefined && value !== null && typeof value === 'number' && value > 0
        if (hasValidQty && validationErrors[line.id]) {
          setValidationErrors((prevErrors) => {
            const newErrors = { ...prevErrors }
            delete newErrors[line.id]
            return newErrors
          })
        }
      }

      return updated
    })
  }

  if (loading || !authChecked || loadingJob) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!tenant || !job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Job not found</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/freight/inbound/${jobId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Receive Stock</h1>
          <p className="text-muted-foreground">Job #{job.id}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Lines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {productLines.length === 0 ? (
            <p className="text-muted-foreground">No product lines to receive.</p>
          ) : (
            // productLines.map((line, index) => (
            //   <div key={line.id} className="border rounded-lg p-4 space-y-4">
            //     <div>
            //       <h3 className="font-medium">
            //         {typeof line.skuId === 'object' ? line.skuId.skuCode : 'SKU'} - {line.skuDescription || 'N/A'}
            //       </h3>
            //       {line.batchNumber && (
            //         <p className="text-sm text-muted-foreground">Batch: {line.batchNumber}</p>
            //       )}
            //     </div>
            //     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            //       <div>
            //         <Label>Expected Qty</Label>
            //         <Input value={line.expectedQty || 0} readOnly />
            //       </div>
            //       <div>
            //         <Label>Received Qty</Label>
            //         <Input
            //           type="number"
            //           value={line.recievedQty || ''}
            //           onChange={(e) => updateProductLine(index, 'recievedQty', parseInt(e.target.value) || undefined)}
            //         />
            //       </div>
            //       <div>
            //         <Label>Expected Weight</Label>
            //         <Input value={line.expectedWeight || 0} readOnly />
            //       </div>
            //       <div>
            //         <Label>Received Weight</Label>
            //         <Input
            //           type="number"
            //           value={line.recievedWeight || ''}
            //           onChange={(e) => updateProductLine(index, 'recievedWeight', parseInt(e.target.value) || undefined)}
            //         />
            //       </div>
            //       {line.expectedCubicPerHU !== undefined && (
            //         <>
            //           <div>
            //             <Label>Expected Cubic (m³)</Label>
            //             <Input value={line.expectedCubicPerHU || 0} readOnly />
            //           </div>
            //           <div>
            //             <Label>Received Cubic (m³)</Label>
            //             <Input
            //               type="number"
            //               step="0.01"
            //               value={line.recievedCubicPerHU || ''}
            //               onChange={(e) => updateProductLine(index, 'recievedCubicPerHU', parseFloat(e.target.value) || undefined)}
            //             />
            //           </div>
            //         </>
            //       )}
            //     </div>
            //   </div>
            // ))
            <ReceiveStockForm
              productLines={productLines}
              onProductLineChange={updateProductLine}
              validationErrors={validationErrors}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button onClick={() => handleSave('save')} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Receive'}
        </Button>
        <Button onClick={() => handleSave('putAway')} variant="outline" disabled={saving}>
          <PackageCheck className="h-4 w-4 mr-2" />
          Put Away Stock
        </Button>
      </div>

      <PutAwayDialog 
        open={showPutAwayDialog} 
        onOpenChange={setShowPutAwayDialog} 
        jobId={job?.id}
        onComplete={handlePutAwayComplete}
      />
    </div>
  )
}
