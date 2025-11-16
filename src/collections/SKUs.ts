import type { CollectionConfig } from 'payload'

export const SKUs: CollectionConfig = {
  slug: 'skus',
  admin: {
    useAsTitle: 'skuCode',
  },
  access: {
    create: ({ req }) => {
      const user = (req as unknown as { user?: { role?: string; tenantId?: number | string } }).user
      if (user?.role === 'superadmin') return true
      return !!user?.tenantId
    },
    read: ({ req }) => {
      const user = (req as unknown as { user?: { role?: string; tenantId?: number | string; collection?: string } }).user
      if (user?.role === 'superadmin' || user?.collection === 'users') return true
      if (user?.tenantId) {
        return {
          tenantId: {
            equals: user.tenantId,
          },
        }
      }
      return false
    },
    update: ({ req }) => {
      const user = (req as unknown as { user?: { role?: string; tenantId?: number | string; collection?: string } }).user
      if (user?.role === 'superadmin' || user?.collection === 'users') return true
      if (user?.tenantId) {
        return {
          tenantId: {
            equals: user.tenantId,
          },
        }
      }
      return false
    },
    delete: ({ req }) => {
      const user = (req as unknown as { user?: { role?: string; tenantId?: number | string; collection?: string } }).user
      if (user?.role === 'superadmin' || user?.collection === 'users') return true
      if (user?.tenantId) {
        return {
          tenantId: {
            equals: user.tenantId,
          },
        }
      }
      return false
    },
  },
  fields: [
    {
      name: 'tenantId',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: {
        description: 'Links SKU to their company (tenant)',
      },
    },
    {
      name: 'skuCode',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Unique SKU identifier for product',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Detailed product description',
      },
    },
    {
      name: 'customerId',
      type: 'relationship',
      relationTo: 'customers',
      admin: {
        description: 'Customer who owns or is linked to this SKU',
      },
    },
    {
      name: 'storageUnitId',
      type: 'relationship',
      relationTo: 'storage-units',
      required: true,
      admin: {
        description: 'Default storage unit (SU) for SKU, mandatory, eg: pallet',
      },
    },
    {
      name: 'handlingUnitId',
      type: 'relationship',
      relationTo: 'handling-units',
      required: true,
      admin: {
        description: 'Default handling unit (HU) for SKU, mandatory, eg: boxes',
      },
    },
    {
      name: 'palletSpacesOfStorageUnit',
      type: 'number',
      admin: {
        description: 'Fetched from selected storage unit',
        readOnly: true,
      },
    },
    {
      name: 'huPerSu',
      type: 'number',
      admin: {
        description: 'Number of handling units per storage unit',
        step: 0.01,
      },
    },
    {
      name: 'receiveHU',
      type: 'select',
      options: [
        { label: 'YES', value: 'YES' },
        { label: 'NO', value: 'NO' },
      ],
      admin: {
        description: 'Whether SKU can be received per handling unit',
      },
    },
    {
      name: 'pickHU',
      type: 'select',
      options: [
        { label: 'YES', value: 'YES' },
        { label: 'NO', value: 'NO' },
      ],
      admin: {
        description: 'Whether SKU can be picked per handling unit',
      },
    },
    {
      name: 'pickStrategy',
      type: 'select',
      options: [
        { label: 'FIFO', value: 'FIFO' },
        { label: 'FEFO', value: 'FEFO' },
      ],
      admin: {
        description: 'Defines stock picking rule',
      },
    },
    {
      name: 'lengthPerHU_mm',
      type: 'number',
      admin: {
        description: 'Length per handling unit in millimeters',
        step: 0.01,
      },
    },
    {
      name: 'widthPerHU_mm',
      type: 'number',
      admin: {
        description: 'Width per handling unit in millimeters',
        step: 0.01,
      },
    },
    {
      name: 'heightPerHU_mm',
      type: 'number',
      admin: {
        description: 'Height per handling unit in millimeters',
        step: 0.01,
      },
    },
    {
      name: 'weightPerHU_kg',
      type: 'number',
      admin: {
        description: 'Weight per handling unit in kilograms',
        step: 0.01,
      },
    },
    {
      name: 'casesPerLayer',
      type: 'number',
      admin: {
        description: 'Number of cases per layer',
      },
    },
    {
      name: 'layersPerPallet',
      type: 'number',
      admin: {
        description: 'Number of layers per pallet',
      },
    },
    {
      name: 'casesPerPallet',
      type: 'number',
      admin: {
        description: 'Number of cases per pallet',
      },
    },
    {
      name: 'eachsPerCase',
      type: 'number',
      admin: {
        description: 'Number of individual units (eachs) per case',
      },
    },
    {
      name: 'isExpriy',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether expiry date tracking is enabled',
      },
    },
    {
      name: 'isAttribute1',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether attribute 1 is enabled',
      },
    },
    {
      name: 'isAttribute2',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether attribute 2 is enabled',
      },
    },
    {
      name: 'expiryDate',
      type: 'date',
      admin: {
        description: 'Expiry date (optional)',
        condition: (data) => {
          return (data as { isExpriy?: boolean }).isExpriy === true
        },
      },
    },
    {
      name: 'attribute1',
      type: 'textarea',
      admin: {
        description: 'Extra notes for attribute 1 (optional)',
        condition: (data) => {
          return (data as { isAttribute1?: boolean }).isAttribute1 === true
        },
      },
    },
    {
      name: 'attribute2',
      type: 'textarea',
      admin: {
        description: 'Extra notes for attribute 2 (optional)',
        condition: (data) => {
          return (data as { isAttribute2?: boolean }).isAttribute2 === true
        },
      },
    },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      ({ req, data }) => {
        const user = (req as unknown as { user?: { role?: string; tenantId?: number | string; collection?: string } }).user
        // If creating/updating and user has tenantId, ensure it matches
        if (user?.tenantId && data.tenantId !== user.tenantId) {
          // Super admins can set any tenantId, but regular users cannot
          if (user.role !== 'superadmin' && user.collection !== 'users') {
            data.tenantId = user.tenantId
          }
        }
        return data
      },
      async ({ data, req }) => {
        // Auto-fetch palletSpacesOfStorageUnit from selected storage unit
        if (data.storageUnitId && req?.payload) {
          try {
            const storageUnitId = typeof data.storageUnitId === 'object' 
              ? (data.storageUnitId as { id: number }).id 
              : data.storageUnitId
            
            if (storageUnitId) {
              const storageUnit = await req.payload.findByID({
                collection: 'storage-units',
                id: storageUnitId,
              })
              
              if (storageUnit) {
                const su = storageUnit as { palletSpaces?: number; lengthPerSU_mm?: number; widthPerSU_mm?: number }
                
                // Auto-fill palletSpacesOfStorageUnit
                if (su.palletSpaces) {
                  data.palletSpacesOfStorageUnit = su.palletSpaces
                }

                // Auto-calculate casesPerLayer if we have all required dimensions
                const lengthPerHU = (data as { lengthPerHU_mm?: number }).lengthPerHU_mm
                const widthPerHU = (data as { widthPerHU_mm?: number }).widthPerHU_mm
                const lengthPerSU = su.lengthPerSU_mm
                const widthPerSU = su.widthPerSU_mm

                // Only auto-calculate if field is empty or dependencies changed
                const shouldCalculateCasesPerLayer = 
                  lengthPerHU && widthPerHU && lengthPerSU && widthPerSU &&
                  (!(data as { casesPerLayer?: number }).casesPerLayer || 
                   (data as { _casesPerLayerCalculated?: boolean })._casesPerLayerCalculated === true)

                if (shouldCalculateCasesPerLayer) {
                  // Calculate cases per layer based on dimensions
                  // Floor division: (SU length / HU length) * (SU width / HU width)
                  const casesPerLength = Math.floor((lengthPerSU || 0) / (lengthPerHU || 1))
                  const casesPerWidth = Math.floor((widthPerSU || 0) / (widthPerHU || 1))
                  const calculatedCasesPerLayer = casesPerLength * casesPerWidth
                  
                  if (calculatedCasesPerLayer > 0) {
                    (data as { casesPerLayer?: number }).casesPerLayer = calculatedCasesPerLayer
                    // Mark as auto-calculated so user can still edit
                    (data as { _casesPerLayerCalculated?: boolean })._casesPerLayerCalculated = true
                  }
                }

                // Auto-calculate layersPerPallet if we have casesPerLayer and huPerSu
                const casesPerLayer = (data as { casesPerLayer?: number }).casesPerLayer
                const huPerSu = (data as { huPerSu?: number }).huPerSu

                const shouldCalculateLayersPerPallet =
                  casesPerLayer && huPerSu && casesPerLayer > 0 &&
                  (!(data as { layersPerPallet?: number }).layersPerPallet ||
                   (data as { _layersPerPalletCalculated?: boolean })._layersPerPalletCalculated === true)

                if (shouldCalculateLayersPerPallet) {
                  // Calculate layers per pallet: huPerSu / casesPerLayer
                  const calculatedLayersPerPallet = Math.floor((huPerSu || 0) / (casesPerLayer || 1))
                  
                  if (calculatedLayersPerPallet > 0) {
                    (data as { layersPerPallet?: number }).layersPerPallet = calculatedLayersPerPallet
                    (data as { _layersPerPalletCalculated?: boolean })._layersPerPalletCalculated = true
                  }
                }

                // Auto-calculate casesPerPallet if we have casesPerLayer and layersPerPallet
                const layersPerPallet = (data as { layersPerPallet?: number }).layersPerPallet

                const shouldCalculateCasesPerPallet =
                  casesPerLayer && layersPerPallet &&
                  (!(data as { casesPerPallet?: number }).casesPerPallet ||
                   (data as { _casesPerPalletCalculated?: boolean })._casesPerPalletCalculated === true)

                if (shouldCalculateCasesPerPallet) {
                  // Calculate cases per pallet: casesPerLayer × layersPerPallet
                  const calculatedCasesPerPallet = (casesPerLayer || 0) * (layersPerPallet || 0)
                  
                  if (calculatedCasesPerPallet > 0) {
                    (data as { casesPerPallet?: number }).casesPerPallet = calculatedCasesPerPallet
                    (data as { _casesPerPalletCalculated?: boolean })._casesPerPalletCalculated = true
                  }
                }
              }
            }
          } catch (error) {
            // If storage unit not found, leave values unchanged
            console.error('Error fetching storage unit:', error)
          }
        }


        return data
      },
    ],
  },
}

