import type { CollectionConfig } from 'payload'

export const OutboundProductLine: CollectionConfig = {
  slug: 'outbound-product-line',
  admin: {
    useAsTitle: 'id',
  },
  access: {
    create: ({ req }) => {
      const user = (req as unknown as { user?: { role?: string; tenantId?: number | string } }).user
      if (user?.role === 'superadmin') return true
      return !!user?.tenantId
    },
    read: ({ req }) => {
      const user = (
        req as unknown as {
          user?: { role?: string; tenantId?: number | string; collection?: string }
        }
      ).user
      if (user?.role === 'superadmin' || user?.collection === 'users') return true
      if (user?.tenantId) {
        // Check tenantId through the outbound inventory relationship
        return true // Will be filtered in API routes
      }
      return false
    },
    update: ({ req }) => {
      const user = (
        req as unknown as {
          user?: { role?: string; tenantId?: number | string; collection?: string }
        }
      ).user
      if (user?.role === 'superadmin' || user?.collection === 'users') return true
      if (user?.tenantId) {
        return true // Will be filtered in API routes
      }
      return false
    },
    delete: ({ req }) => {
      const user = (
        req as unknown as {
          user?: { role?: string; tenantId?: number | string; collection?: string }
        }
      ).user
      if (user?.role === 'superadmin' || user?.collection === 'users') return true
      if (user?.tenantId) {
        return true // Will be filtered in API routes
      }
      return false
    },
  },
  fields: [
    {
      name: 'outboundInventoryId',
      type: 'relationship',
      relationTo: 'outbound-inventory',
      required: true,
      admin: {
        description: 'Links product line to outbound job header',
      },
    },
    // SKU & Batch Details
    {
      name: 'batchNumber',
      type: 'text',
      required: true,
      admin: {
        description: 'Batch number searched from inbound product lines of same tenant',
      },
    },
    {
      name: 'skuId',
      type: 'relationship',
      relationTo: 'skus',
      admin: {
        description: 'SKU linked to this batch',
      },
    },
    {
      name: 'skuDescription',
      type: 'text',
      admin: {
        description: 'Description of SKU (cached from SKU master)',
        readOnly: true,
      },
    },
    {
      name: 'expiry',
      type: 'date',
      admin: {
        description: 'Expiry date of product (pulled from SKU or inbound batch)',
        readOnly: true,
      },
    },
    {
      name: 'attribute1',
      type: 'textarea',
      admin: {
        description: 'Custom attribute 1 (from SKU), e.g., colour/grade',
        readOnly: true,
      },
    },
    {
      name: 'attribute2',
      type: 'textarea',
      admin: {
        description: 'Custom attribute 2 (from SKU), e.g., size/variant',
        readOnly: true,
      },
    },
    // Quantities & Measurements
    {
      name: 'requiredQty',
      type: 'number',
      admin: {
        description: 'Quantity requested by customer for outbound',
      },
    },
    {
      name: 'allocatedQty',
      type: 'number',
      admin: {
        description: 'Quantity actually allocated from inventory',
        readOnly: true,
      },
    },
    {
      name: 'requiredWeight',
      type: 'number',
      admin: {
        description: 'Requested weight for the order',
      },
    },
    {
      name: 'allocatedWeight',
      type: 'number',
      admin: {
        description: 'Actual allocated weight',
        readOnly: true,
      },
    },
    {
      name: 'requiredCubicPerHU',
      type: 'number',
      admin: {
        description: 'Requested cubic volume per handling unit',
        step: 0.01,
      },
    },
    {
      name: 'allocatedCubicPerHU',
      type: 'number',
      admin: {
        description: 'Allocated cubic volume per handling unit',
        step: 0.01,
        readOnly: true,
      },
    },
    // Handling & Location Details
    {
      name: 'containerNumber',
      type: 'text',
      admin: {
        description: 'Container number used at line level if different',
      },
    },
    {
      name: 'pltQty',
      type: 'number',
      admin: {
        description:
          'Pallet quantity allocated for this specific batch line calculated automatically',
        readOnly: true,
      },
    },
    {
      name: 'LPN',
      type: 'array',
      fields: [
        {
          name: 'lpnNumber',
          type: 'text',
        },
      ],
      admin: {
        description: 'List of LPN (License Plate Numbers) assigned for outbound',
      },
    },
    {
      name: 'location',
      type: 'text',
      admin: {
        description: 'Warehouse storage location from where goods are picked',
        readOnly: true,
      },
    },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        // Auto-fetch SKU info when skuId is set
        if (data.skuId && req?.payload) {
          try {
            const skuId =
              typeof data.skuId === 'object' ? (data.skuId as { id: number }).id : data.skuId

            if (skuId) {
              const sku = await req.payload.findByID({
                collection: 'skus',
                id: skuId,
              })

              if (sku) {
                const skuData = sku as {
                  description?: string
                  weightPerHU_kg?: number
                  lengthPerHU_mm?: number
                  widthPerHU_mm?: number
                  heightPerHU_mm?: number
                  isExpriy?: boolean
                  isAttribute1?: boolean
                  isAttribute2?: boolean
                  expiryDate?: string
                  attribute1?: string
                  attribute2?: string
                }
                data.skuDescription = skuData.description || ''

                // Auto-populate expiry, attribute1, attribute2 if SKU has them enabled
                if (skuData.isExpriy && skuData.expiryDate) {
                  data.expiry = skuData.expiryDate
                }
                if (skuData.isAttribute1 && skuData.attribute1) {
                  data.attribute1 = skuData.attribute1
                }
                if (skuData.isAttribute2 && skuData.attribute2) {
                  data.attribute2 = skuData.attribute2
                }

                // Auto-calculate cubic from SKU dimensions (length × width × height in m³)
                if (skuData.lengthPerHU_mm && skuData.widthPerHU_mm && skuData.heightPerHU_mm) {
                  // Convert from mm³ to m³: divide by 1,000,000,000
                  const cubicM3 =
                    (skuData.lengthPerHU_mm * skuData.widthPerHU_mm * skuData.heightPerHU_mm) /
                    1_000_000_000
                  data.requiredCubicPerHU = cubicM3
                }
              }
            }
          } catch (error) {
            console.error('Error fetching SKU:', error)
          }
        }

        // Auto-calculate pltQty from allocatedQty (if we have lpnQty from SKU)
        // This will be updated during allocation, but we can calculate here if needed
        if (data.allocatedQty && data.skuId && req?.payload) {
          try {
            const skuId =
              typeof data.skuId === 'object' ? (data.skuId as { id: number }).id : data.skuId
            if (skuId) {
              const sku = await req.payload.findByID({
                collection: 'skus',
                id: skuId,
              })
              if (sku) {
                const skuData = sku as { huPerSu?: number }
                if (skuData.huPerSu && skuData.huPerSu > 0) {
                  data.pltQty = (data.allocatedQty as number) / skuData.huPerSu
                }
              }
            }
          } catch (error) {
            console.error('Error calculating pltQty:', error)
          }
        }

        return data
      },
    ],
  },
}



