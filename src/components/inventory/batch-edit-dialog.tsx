'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
const toast = {
  success: (message: string) => alert(message),
  error: (message: string) => alert(message),
}

const batchEditSchema = z.object({
  batchNumber: z.string().min(1, 'Batch number is required'),
})

type BatchEditFormData = z.infer<typeof batchEditSchema>

type BatchEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  skuId: string
  currentBatchNumber: string
  onSuccess: () => void
}

export function BatchEditDialog({
  open,
  onOpenChange,
  skuId,
  currentBatchNumber,
  onSuccess,
}: BatchEditDialogProps) {
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<BatchEditFormData>({
    resolver: zodResolver(batchEditSchema),
  })

  useEffect(() => {
    if (open) {
      setValue('batchNumber', currentBatchNumber)
    } else {
      reset()
    }
  }, [open, currentBatchNumber, setValue, reset])

  const onSubmit = async (data: BatchEditFormData) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/inventory/batch`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          skuId,
          oldBatchNumber: currentBatchNumber,
          newBatchNumber: data.batchNumber,
        }),
      })

      if (res.ok) {
        const result = await res.json()
        if (result.success) {
          toast.success('Batch number updated successfully')
          onOpenChange(false)
          onSuccess()
        } else {
          toast.error(result.message || 'Failed to update batch number')
        }
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to update batch number')
      }
    } catch (error) {
      console.error('Error updating batch number:', error)
      toast.error('Failed to update batch number')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Batch Number</DialogTitle>
          <DialogDescription>
            Update batch number for SKU: {skuId}
            <br />
            <span className="text-xs text-muted-foreground">
              This will update the batch for all LPNs with this batch number
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="batchNumber">Batch Number</Label>
            <Input
              id="batchNumber"
              {...register('batchNumber')}
              placeholder="e.g., BATCH001"
              disabled={loading}
            />
            {errors.batchNumber && (
              <p className="text-sm text-destructive">{errors.batchNumber.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}



