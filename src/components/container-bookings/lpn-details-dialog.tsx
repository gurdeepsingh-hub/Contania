'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type PutAwayRecord = {
  id: number
  lpnNumber: string
  location: string
  huQty: number
}

interface LpnDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  records: PutAwayRecord[]
  skuCode?: string
  skuDescription?: string
}

export function LpnDetailsDialog({
  open,
  onOpenChange,
  records,
  skuCode,
  skuDescription,
}: LpnDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>LPN Details</DialogTitle>
          {skuCode && (
            <div className="mt-2">
              <div className="font-medium">SKU: {skuCode}</div>
              {skuDescription && (
                <div className="text-sm text-muted-foreground">{skuDescription}</div>
              )}
            </div>
          )}
        </DialogHeader>
        <div className="py-4">
          {records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No LPN records found</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Sr No</TableHead>
                    <TableHead>LPN Number</TableHead>
                    <TableHead className="text-right">QTY</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record, index) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-mono">{record.lpnNumber || 'N/A'}</TableCell>
                      <TableCell className="text-right">{record.huQty || 0}</TableCell>
                      <TableCell>{record.location || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
