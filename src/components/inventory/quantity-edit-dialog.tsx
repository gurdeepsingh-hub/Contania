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

const quantityEditSchema = z.object({
  receivedQty: z.number().min(0, 'Received quantity must be 0 or greater'),
})

type QuantityEditFormData = z.infer<typeof quantityEditSchema>

type QuantityEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  skuId: string
  currentReceivedQty: number
  onSuccess: () => void
}

export function QuantityEditDialog({
  open,
  onOpenChange,
  skuId,
  currentReceivedQty,
  onSuccess,
}: QuantityEditDialogProps) {
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<QuantityEditFormData>({
    resolver: zodResolver(quantityEditSchema),
  })

  useEffect(() => {
    if (open) {
      setValue('receivedQty', currentReceivedQty)
    } else {
      reset()
    }
  }, [open, currentReceivedQty, setValue, reset])

  const onSubmit = async (data: QuantityEditFormData) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/inventory/quantity`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          skuId,
          receivedQty: data.receivedQty,
        }),
      })

      if (res.ok) {
        const result = await res.json()
        if (result.success) {
          toast.success('Quantity updated successfully')
          onOpenChange(false)
          onSuccess()
        } else {
          toast.error(result.message || 'Failed to update quantity')
        }
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to update quantity')
      }
    } catch (error) {
      console.error('Error updating quantity:', error)
      toast.error('Failed to update quantity')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Received Quantity</DialogTitle>
          <DialogDescription>
            Update received quantity for SKU: {skuId}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="receivedQty">Received Quantity</Label>
            <Input
              id="receivedQty"
              type="number"
              {...register('receivedQty', { valueAsNumber: true })}
              placeholder="0"
              min="0"
              step="0.01"
              disabled={loading}
            />
            {errors.receivedQty && (
              <p className="text-sm text-destructive">{errors.receivedQty.message}</p>
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



