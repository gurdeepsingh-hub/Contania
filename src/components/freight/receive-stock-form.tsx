'use client'

import { FormInput } from '@/components/ui/form-field'

type ProductLine = {
  id: number
  skuDescription?: string
  expectedQty?: number
  recievedQty?: number
  expectedWeight?: number
  recievedWeight?: number
  expectedCubicPerHU?: number
  recievedCubicPerHU?: number
}

interface ReceiveStockFormProps {
  productLines: ProductLine[]
  onProductLineChange: (index: number, field: keyof ProductLine, value: any) => void
}

export function ReceiveStockForm({ productLines, onProductLineChange }: ReceiveStockFormProps) {
  return (
    <div className="space-y-4">
      {productLines.map((line, index) => (
        <div key={line.id} className="border rounded-lg p-4 md:p-6 space-y-4 bg-card">
          <div>
            <h3 className="font-semibold text-lg">{line.skuDescription || 'Product Line'}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FormInput
              label="Expected Qty"
              value={line.expectedQty || 0}
              readOnly
              className="bg-muted"
            />
            <FormInput
              label="Received Qty"
              type="number"
              min="0"
              value={line.recievedQty || ''}
              onChange={(e) =>
                onProductLineChange(index, 'recievedQty', parseInt(e.target.value) || undefined)
              }
              placeholder="Enter received quantity"
            />
            <FormInput
              label="Expected Weight"
              value={line.expectedWeight || 0}
              readOnly
              className="bg-muted"
            />
            <FormInput
              label="Received Weight"
              type="number"
              min="0"
              value={line.recievedWeight || ''}
              onChange={(e) =>
                onProductLineChange(index, 'recievedWeight', parseInt(e.target.value) || undefined)
              }
              placeholder="Enter received weight"
            />
            {line.expectedCubicPerHU !== undefined && (
              <>
                <FormInput
                  label="Expected Cubic (m³)"
                  value={line.expectedCubicPerHU || 0}
                  readOnly
                  className="bg-muted"
                />
                <FormInput
                  label="Received Cubic (m³)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={line.recievedCubicPerHU || ''}
                  onChange={(e) =>
                    onProductLineChange(
                      index,
                      'recievedCubicPerHU',
                      parseFloat(e.target.value) || undefined,
                    )
                  }
                  placeholder="Enter received cubic"
                />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
