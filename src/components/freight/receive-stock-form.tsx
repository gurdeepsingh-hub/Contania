'use client'

import { FormInput } from '@/components/ui/form-field'

type ProductLine = {
  id: number
  skuId?: number | { id: number; skuCode?: string; description?: string }
  skuDescription?: string
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

interface ReceiveStockFormProps {
  productLines: ProductLine[]
  onProductLineChange: (
    index: number,
    field: keyof ProductLine,
    value: string | number | undefined,
  ) => void
  validationErrors?: Record<number, string>
}

export function ReceiveStockForm({
  productLines,
  onProductLineChange,
  validationErrors = {},
}: ReceiveStockFormProps) {
  return (
    <div className="space-y-4">
      {productLines.map((line, index) => (
        <div key={line.id} className="border rounded-lg p-4 md:p-6 space-y-4 bg-card">
          <div className="space-y-2">
            {/* SKU Name */}
            {(() => {
              const skuCode =
                typeof line.skuId === 'object' && line.skuId?.skuCode
                  ? line.skuId.skuCode
                  : typeof line.skuId === 'number'
                    ? 'SKU'
                    : null
              return skuCode ? <h2 className="font-bold text-xl">{skuCode}</h2> : null
            })()}
            {/* SKU Description */}
            <h3 className="font-semibold text-lg text-muted-foreground">
              {line.skuDescription || 'Product Line'}
            </h3>
            {/* Expiry and Attributes */}
            {(line.expiryDate || line.attribute1 || line.attribute2) && (
              <div className="flex flex-wrap gap-4 mt-2 text-sm">
                {line.expiryDate && (
                  <div className="text-muted-foreground">
                    <span className="font-medium">Expiry:</span>{' '}
                    {new Date(line.expiryDate).toLocaleDateString()}
                  </div>
                )}
                {line.attribute1 && (
                  <div className="text-muted-foreground">
                    <span className="font-medium">Attribute 1:</span> {line.attribute1}
                  </div>
                )}
                {line.attribute2 && (
                  <div className="text-muted-foreground">
                    <span className="font-medium">Attribute 2:</span> {line.attribute2}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3  gap-4 ">
            {/* Quantity Column */}
            <div className="space-y-4 block ">
              <FormInput
                label="Expected Qty"
                value={line.expectedQty || 0}
                readOnly
                className="bg-muted"
              />
              <div>
                <FormInput
                  label="Received Qty"
                  type="number"
                  min="0"
                  value={line.recievedQty || ''}
                  onChange={(e) =>
                    onProductLineChange(index, 'recievedQty', parseInt(e.target.value) || undefined)
                  }
                  placeholder="Enter received quantity"
                  className={validationErrors[line.id] ? 'border-red-500' : ''}
                />
                {validationErrors[line.id] && (
                  <p className="text-sm text-red-500 mt-1">{validationErrors[line.id]}</p>
                )}
              </div>
            </div>

            {/* Weight Column */}
            <div className="space-y-4">
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
                  onProductLineChange(
                    index,
                    'recievedWeight',
                    parseInt(e.target.value) || undefined,
                  )
                }
                placeholder="Enter received weight"
              />
            </div>

            {/* Cubic Column - only show if expected cubic exists */}
            {line.expectedCubicPerHU !== undefined && (
              <div className="space-y-4">
                <FormInput
                  label="Expected Cubic (m³)"
                  value={line.expectedCubicPerHU || 0}
                  readOnly
                  className="bg-muted"
                />
                <FormInput
                  label="Received Cubic (m³)"
                  type="text"
                  inputMode="decimal"
                  value={
                    line.recievedCubicPerHU !== undefined && line.recievedCubicPerHU !== null
                      ? line.recievedCubicPerHU.toString()
                      : ''
                  }
                  onChange={(e) => {
                    const value = e.target.value
                    // Allow empty, numbers, decimals, and leading zeros
                    if (value === '') {
                      onProductLineChange(index, 'recievedCubicPerHU', undefined)
                    } else if (/^\d*\.?\d*$/.test(value)) {
                      // Valid number format - allow typing 0, 0., 0.0, 0.00, etc.
                      const numValue = value === '' || value === '.' ? undefined : parseFloat(value)
                      onProductLineChange(
                        index,
                        'recievedCubicPerHU',
                        isNaN(numValue as number) ? undefined : numValue,
                      )
                    }
                    // Ignore invalid input
                  }}
                  placeholder="Enter received cubic"
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
