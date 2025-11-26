import type { CollectionConfig } from 'payload'

export const InboundProductLine: CollectionConfig = {
  slug: 'inbound-product-line',
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
        // Check tenantId through the inbound inventory relationship
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
      name: 'inboundInventoryId',
      type: 'relationship',
      relationTo: 'inbound-inventory',
      required: true,
      admin: {
        description: 'Links product to inbound shipment',
      },
    },
    {
      name: 'skuId',
      type: 'relationship',
      relationTo: 'skus',
      admin: {
        description: 'References SKU (product) record',
      },
    },
    {
      name: 'skuDescription',
      type: 'text',
      admin: {
        description: 'Fetched from SKU ID',
        readOnly: true,
      },
    },
    {
      name: 'batchNumber',
      type: 'text',
      admin: {
        description:
          'Product batch number (if batch id is in system give warn if wrong sku id and batch)',
      },
    },
    {
      name: 'lpnQty',
      type: 'text',
      admin: {
        description: 'Fetched from SKU ID huPerSU',
        readOnly: true,
      },
    },
    {
      name: 'sqmPerSU',
      type: 'number',
      admin: {
        description:
          'Square meters per storage unit (auto-calculated from Storage Unit length and width)',
        step: 0.01,
        readOnly: true,
      },
    },
    {
      name: 'expectedQty',
      type: 'number',
      admin: {
        description: 'Quantity of product units expected',
      },
    },
    {
      name: 'recievedQty',
      type: 'number',
      admin: {
        description: 'Quantity of product units received',
      },
    },
    {
      name: 'expectedWeight',
      type: 'number',
      admin: {
        description: 'Weight of product units expected',
      },
    },
    {
      name: 'recievedWeight',
      type: 'number',
      admin: {
        description: 'Weight of product units received',
      },
    },
    {
      name: 'palletSpaces',
      type: 'number',
      admin: {
        description: 'Number of pallet spaces occupied (auto-calculated from qty / lpnQty)',
        readOnly: true,
      },
    },
    {
      name: 'weightPerHU',
      type: 'number',
      admin: {
        description: 'Weight per handling unit, fetched from SKU / editable',
        step: 0.01,
      },
    },
    {
      name: 'expectedCubicPerHU',
      type: 'number',
      admin: {
        description: 'Volume per handling unit (m³)',
        step: 0.01,
      },
    },
    {
      name: 'recievedCubicPerHU',
      type: 'number',
      admin: {
        description: 'Volume per handling unit (m³)',
        step: 0.01,
      },
    },
    {
      name: 'expiryDate',
      type: 'date',
      admin: {
        description: 'Expiry date (auto-fetched from SKU if enabled)',
        readOnly: true,
      },
    },
    {
      name: 'attribute1',
      type: 'textarea',
      admin: {
        description: 'Attribute 1 (auto-fetched from SKU if enabled)',
        readOnly: true,
      },
    },
    {
      name: 'attribute2',
      type: 'textarea',
      admin: {
        description: 'Attribute 2 (auto-fetched from SKU if enabled)',
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
                  huPerSu?: number
                  weightPerHU_kg?: number
                  storageUnitId?: number | { id: number }
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
                data.lpnQty = skuData.huPerSu?.toString() || ''
                data.weightPerHU = skuData.weightPerHU_kg || undefined

                // Auto-populate expiry, attribute1, attribute2 if SKU has them enabled
                if (skuData.isExpriy && skuData.expiryDate) {
                  data.expiryDate = skuData.expiryDate
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
                  data.expectedCubicPerHU = cubicM3
                }

                // Fetch Storage Unit to calculate SQM/SU
                const storageUnitId =
                  typeof skuData.storageUnitId === 'object'
                    ? skuData.storageUnitId.id
                    : skuData.storageUnitId

                if (storageUnitId) {
                  try {
                    const storageUnit = await req.payload.findByID({
                      collection: 'storage-units',
                      id: storageUnitId,
                    })

                    if (storageUnit) {
                      const su = storageUnit as {
                        lengthPerSU_mm?: number
                        widthPerSU_mm?: number
                      }

                      // Auto-calculate SQM/SU from Storage Unit dimensions (length × width in m²)
                      if (su.lengthPerSU_mm && su.widthPerSU_mm) {
                        // Convert from mm² to m²: divide by 1,000,000
                        const sqmPerSU = (su.lengthPerSU_mm * su.widthPerSU_mm) / 1_000_000
                        data.sqmPerSU = sqmPerSU
                      }
                    }
                  } catch (error) {
                    console.error('Error fetching Storage Unit:', error)
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error fetching SKU:', error)
          }
        }

        // Auto-calculate palletSpaces from expectedQty / lpnQty
        if (data.expectedQty && data.lpnQty) {
          const lpnQtyNum = parseFloat(data.lpnQty as string)
          if (lpnQtyNum > 0) {
            data.palletSpaces = (data.expectedQty as number) / lpnQtyNum
          }
        }

        return data
      },
    ],
  },
}
