import type { CollectionConfig } from 'payload'

export const ContainerStockAllocations: CollectionConfig = {
  slug: 'container-stock-allocations',
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
        // Will be filtered through container booking relationship in API routes
        return true
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
      name: 'containerDetailId',
      type: 'relationship',
      relationTo: 'container-details',
      required: true,
      admin: {
        description: 'Links stock allocation to container detail',
      },
    },
    {
      name: 'containerBookingId',
      type: 'relationship',
      relationTo: ['import-container-bookings', 'export-container-bookings'],
      required: true,
      admin: {
        description: 'Links stock allocation to container booking (import or export)',
      },
    },
    {
      name: 'stage',
      type: 'select',
      required: true,
      defaultValue: 'expected',
      admin: {
        description: 'Current stage of stock allocation',
      },
      options: [
        // Export stages
        { label: 'Allocated', value: 'allocated' },
        { label: 'Picked', value: 'picked' },
        { label: 'Dispatched', value: 'dispatched' },
        // Import stages
        { label: 'Expected', value: 'expected' },
        { label: 'Received', value: 'received' },
        { label: 'Put Away', value: 'put_away' },
      ],
    },
    {
      name: 'productLines',
      type: 'array',
      admin: {
        description: 'Product lines for this container allocation',
      },
      fields: [
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
            description: 'Product batch number',
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
            description: 'Square meters per storage unit',
            step: 0.01,
            readOnly: true,
          },
        },
        // Export fields
        {
          name: 'expectedQty',
          type: 'number',
          admin: {
            description: 'Quantity of product units expected',
          },
        },
        {
          name: 'pickedQty',
          type: 'number',
          admin: {
            description: 'Quantity of product units picked (export only)',
            condition: (data, siblingData, { user }) => {
              // Check if jobType is export by looking at parent
              return true // Will be validated in hooks/API
            },
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
          name: 'pickedWeight',
          type: 'number',
          admin: {
            description: 'Weight of product units picked (export only)',
          },
        },
        {
          name: 'allocatedQty',
          type: 'number',
          admin: {
            description: 'Quantity allocated (export only)',
          },
        },
        {
          name: 'allocatedWeight',
          type: 'number',
          admin: {
            description: 'Weight allocated (export only)',
            step: 0.01,
          },
        },
        {
          name: 'allocatedCubicPerHU',
          type: 'number',
          admin: {
            description: 'Volume per handling unit for allocated stock (m³)',
            step: 0.01,
          },
        },
        {
          name: 'pltQty',
          type: 'number',
          admin: {
            description: 'Pallet quantity (calculated from allocatedQty / huPerSu)',
            step: 0.01,
          },
        },
        {
          name: 'LPN',
          type: 'array',
          admin: {
            description: 'List of LPNs (License Plate Numbers) allocated',
          },
          fields: [
            {
              name: 'lpnNumber',
              type: 'text',
              required: true,
            },
          ],
        },
        {
          name: 'location',
          type: 'text',
          admin: {
            description: 'Primary location where allocated stock is stored',
          },
        },
        // Import fields
        {
          name: 'expectedQtyImport',
          type: 'number',
          admin: {
            description: 'Quantity expected (import only)',
          },
        },
        {
          name: 'recievedQty',
          type: 'number',
          admin: {
            description: 'Quantity received (import only)',
          },
        },
        {
          name: 'expectedWeightImport',
          type: 'number',
          admin: {
            description: 'Weight expected (import only)',
          },
        },
        {
          name: 'recievedWeight',
          type: 'number',
          admin: {
            description: 'Weight received (import only)',
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
            description: 'Volume per handling unit received (m³)',
            step: 0.01,
          },
        },
        {
          name: 'palletSpaces',
          type: 'number',
          admin: {
            description: 'Number of pallet spaces occupied (auto-calculated)',
            readOnly: true,
          },
        },
        // Common fields
        {
          name: 'expiryDate',
          type: 'date',
          admin: {
            description: 'Expiry date (required if SKU has expiry enabled)',
            condition: async (data, siblingData, { req }) => {
              // Show only if SKU has expiry enabled
              if (!siblingData.skuId || !req?.payload) return false
              try {
                const skuId =
                  typeof siblingData.skuId === 'object'
                    ? (siblingData.skuId as { id: number }).id
                    : siblingData.skuId
                if (!skuId) return false
                const sku = await req.payload.findByID({
                  collection: 'skus',
                  id: skuId,
                })
                return (sku as { isExpriy?: boolean })?.isExpriy === true
              } catch {
                return false
              }
            },
          },
        },
        {
          name: 'attribute1',
          type: 'textarea',
          admin: {
            description: 'Attribute 1 (required if SKU has attribute1 enabled)',
            condition: async (data, siblingData, { req }) => {
              // Show only if SKU has attribute1 enabled
              if (!siblingData.skuId || !req?.payload) return false
              try {
                const skuId =
                  typeof siblingData.skuId === 'object'
                    ? (siblingData.skuId as { id: number }).id
                    : siblingData.skuId
                if (!skuId) return false
                const sku = await req.payload.findByID({
                  collection: 'skus',
                  id: skuId,
                })
                return (sku as { isAttribute1?: boolean })?.isAttribute1 === true
              } catch {
                return false
              }
            },
          },
        },
        {
          name: 'attribute2',
          type: 'textarea',
          admin: {
            description: 'Attribute 2 (required if SKU has attribute2 enabled)',
            condition: async (data, siblingData, { req }) => {
              // Show only if SKU has attribute2 enabled
              if (!siblingData.skuId || !req?.payload) return false
              try {
                const skuId =
                  typeof siblingData.skuId === 'object'
                    ? (siblingData.skuId as { id: number }).id
                    : siblingData.skuId
                if (!skuId) return false
                const sku = await req.payload.findByID({
                  collection: 'skus',
                  id: skuId,
                })
                return (sku as { isAttribute2?: boolean })?.isAttribute2 === true
              } catch {
                return false
              }
            },
          },
        },
      ],
    },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        // Auto-fetch SKU info for product lines
        // Optimize by batching SKU fetches
        if (data.productLines && Array.isArray(data.productLines) && req?.payload) {
          // Collect all SKU IDs that need fetching (skip if data already populated)
          const skuIds: number[] = []
          const skuIdMap = new Map<number, any>() // Map to store product lines by SKU ID

          for (const productLine of data.productLines) {
            if (productLine.skuId) {
              // Skip if SKU data is already populated (from API or previous processing)
              if (productLine.skuDescription && productLine.lpnQty) {
                continue
              }

              const skuId =
                typeof productLine.skuId === 'object'
                  ? (productLine.skuId as { id: number }).id
                  : productLine.skuId

              if (skuId && !skuIds.includes(skuId)) {
                skuIds.push(skuId)
                skuIdMap.set(skuId, [])
              }
              if (skuId) {
                skuIdMap.get(skuId)?.push(productLine)
              }
            }
          }

          // Batch fetch all SKUs at once
          if (skuIds.length > 0) {
            try {
              const skus = await req.payload.find({
                collection: 'skus',
                where: {
                  id: {
                    in: skuIds,
                  },
                },
                limit: 1000,
              })

              // Create a map for quick lookup
              const skuMap = new Map(skus.docs.map((sku: any) => [sku.id, sku]))

              // Process each product line with its SKU data
              for (const productLine of data.productLines) {
                if (productLine.skuId) {
                  const skuId =
                    typeof productLine.skuId === 'object'
                      ? (productLine.skuId as { id: number }).id
                      : productLine.skuId

                  if (skuId) {
                    const sku = skuMap.get(skuId)
                    if (sku) {
                      try {
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
                        }

                        productLine.skuDescription = skuData.description || ''
                        productLine.lpnQty = skuData.huPerSu?.toString() || ''
                        productLine.weightPerHU = skuData.weightPerHU_kg || undefined

                        // Note: expiryDate, attribute1, and attribute2 are filled by user in product line
                        // They are only shown if the corresponding checkbox is enabled in SKU

                        // Auto-calculate cubic from SKU dimensions
                        if (
                          skuData.lengthPerHU_mm &&
                          skuData.widthPerHU_mm &&
                          skuData.heightPerHU_mm
                        ) {
                          const cubicM3 =
                            (skuData.lengthPerHU_mm *
                              skuData.widthPerHU_mm *
                              skuData.heightPerHU_mm) /
                            1_000_000_000
                          productLine.expectedCubicPerHU = cubicM3
                        }

                        // Store storage unit ID for batch fetching later
                        const storageUnitId =
                          typeof skuData.storageUnitId === 'object'
                            ? skuData.storageUnitId.id
                            : skuData.storageUnitId

                        if (storageUnitId) {
                          // Store for batch processing
                          ;(productLine as any)._storageUnitId = storageUnitId
                        }

                        // Auto-calculate palletSpaces for import
                        if (productLine.expectedQtyImport && productLine.lpnQty) {
                          const lpnQtyNum = parseFloat(productLine.lpnQty as string)
                          if (lpnQtyNum > 0) {
                            productLine.palletSpaces =
                              (productLine.expectedQtyImport as number) / lpnQtyNum
                          }
                        }

                        // Auto-calculate pltQty for export
                        if (productLine.allocatedQty && productLine.lpnQty) {
                          const lpnQtyNum = parseFloat(productLine.lpnQty as string)
                          if (lpnQtyNum > 0) {
                            productLine.pltQty = (productLine.allocatedQty as number) / lpnQtyNum
                          }
                        }
                      } catch (error) {
                        console.error('Error processing SKU data:', error)
                      }
                    }
                  }
                }
              }

              // Batch fetch storage units for all product lines that need them
              const storageUnitIds: number[] = []
              for (const productLine of data.productLines) {
                const storageUnitId = (productLine as any)._storageUnitId
                if (storageUnitId && !storageUnitIds.includes(storageUnitId)) {
                  storageUnitIds.push(storageUnitId)
                }
              }

              if (storageUnitIds.length > 0) {
                try {
                  const storageUnits = await req.payload.find({
                    collection: 'storage-units',
                    where: {
                      id: {
                        in: storageUnitIds,
                      },
                    },
                    limit: 1000,
                  })

                  const suMap = new Map(storageUnits.docs.map((su: any) => [su.id, su]))

                  // Apply storage unit data to product lines
                  for (const productLine of data.productLines) {
                    const storageUnitId = (productLine as any)._storageUnitId
                    if (storageUnitId) {
                      const storageUnit = suMap.get(storageUnitId)
                      if (storageUnit) {
                        const su = storageUnit as {
                          lengthPerSU_mm?: number
                          widthPerSU_mm?: number
                        }

                        if (su.lengthPerSU_mm && su.widthPerSU_mm) {
                          const sqmPerSU = (su.lengthPerSU_mm * su.widthPerSU_mm) / 1_000_000
                          productLine.sqmPerSU = sqmPerSU
                        }
                      }
                      // Clean up temporary field
                      delete (productLine as any)._storageUnitId
                    }
                  }
                } catch (error) {
                  console.error('Error batch fetching Storage Units:', error)
                  // Clean up temporary fields
                  for (const productLine of data.productLines) {
                    delete (productLine as any)._storageUnitId
                  }
                }
              }
            } catch (error) {
              console.error('Error batch fetching SKUs:', error)
              // Fallback to individual fetches if batch fails
              for (const productLine of data.productLines) {
                if (productLine.skuId) {
                  try {
                    const skuId =
                      typeof productLine.skuId === 'object'
                        ? (productLine.skuId as { id: number }).id
                        : productLine.skuId

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
                        }

                        productLine.skuDescription = skuData.description || ''
                        productLine.lpnQty = skuData.huPerSu?.toString() || ''
                        productLine.weightPerHU = skuData.weightPerHU_kg || undefined

                        // Note: expiryDate, attribute1, and attribute2 are filled by user in product line
                        // They are only shown if the corresponding checkbox is enabled in SKU

                        // Auto-calculate cubic from SKU dimensions
                        if (
                          skuData.lengthPerHU_mm &&
                          skuData.widthPerHU_mm &&
                          skuData.heightPerHU_mm
                        ) {
                          const cubicM3 =
                            (skuData.lengthPerHU_mm *
                              skuData.widthPerHU_mm *
                              skuData.heightPerHU_mm) /
                            1_000_000_000
                          productLine.expectedCubicPerHU = cubicM3
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

                              if (su.lengthPerSU_mm && su.widthPerSU_mm) {
                                const sqmPerSU = (su.lengthPerSU_mm * su.widthPerSU_mm) / 1_000_000
                                productLine.sqmPerSU = sqmPerSU
                              }
                            }
                          } catch (error) {
                            console.error('Error fetching Storage Unit:', error)
                          }
                        }

                        // Auto-calculate palletSpaces for import
                        if (productLine.expectedQtyImport && productLine.lpnQty) {
                          const lpnQtyNum = parseFloat(productLine.lpnQty as string)
                          if (lpnQtyNum > 0) {
                            productLine.palletSpaces =
                              (productLine.expectedQtyImport as number) / lpnQtyNum
                          }
                        }

                        // Auto-calculate pltQty for export
                        if (productLine.allocatedQty && productLine.lpnQty) {
                          const lpnQtyNum = parseFloat(productLine.lpnQty as string)
                          if (lpnQtyNum > 0) {
                            productLine.pltQty = (productLine.allocatedQty as number) / lpnQtyNum
                          }
                        }
                      }
                    }
                  } catch (error) {
                    console.error('Error fetching SKU:', error)
                  }
                }
              }
            }
          }
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        // Auto-update container status based on product line completion
        // Only run on updates, not creates (to avoid blocking POST requests)
        // Status updates on create are handled by the API route after the response is sent
        if (doc && doc.containerDetailId && req?.payload && operation === 'update') {
          try {
            const containerDetailId =
              typeof doc.containerDetailId === 'object'
                ? (doc.containerDetailId as { id: number }).id
                : doc.containerDetailId

            if (!containerDetailId) return

            // Get all stock allocations for this container (with minimal depth for speed)
            const allocations = await req.payload.find({
              collection: 'container-stock-allocations',
              where: {
                containerDetailId: {
                  equals: containerDetailId,
                },
              },
              depth: 0, // No depth needed for status check
              limit: 100,
            })

            // Determine booking type from containerBookingId
            const bookingRef =
              typeof doc.containerBookingId === 'object'
                ? (doc.containerBookingId as { id: number; relationTo?: string })
                : null

            if (!bookingRef) return

            const isImport = bookingRef.relationTo === 'import-container-bookings'

            // Collect all product lines from all allocations for this container
            const allProductLines: any[] = []
            allocations.docs.forEach((allocation: any) => {
              if (allocation.productLines && Array.isArray(allocation.productLines)) {
                allProductLines.push(...allocation.productLines)
              }
            })

            if (allProductLines.length === 0) return

            // For import: Check if all product lines have received values
            if (isImport) {
              const allReceived = allProductLines.every(
                (line: any) => line.recievedQty && line.recievedQty > 0,
              )

              if (allReceived) {
                // Check if put-away records exist (quick count check)
                const putAwayRecords = await req.payload.find({
                  collection: 'put-away-stock',
                  where: {
                    containerDetailId: {
                      equals: containerDetailId,
                    },
                  },
                  limit: 1, // Just check if any exist
                })

                if (putAwayRecords.docs.length > 0) {
                  // All received and put-away exists
                  await req.payload.update({
                    collection: 'container-details',
                    id: containerDetailId,
                    data: {
                      status: 'put_away',
                    },
                  })
                } else {
                  // All received but no put-away yet
                  await req.payload.update({
                    collection: 'container-details',
                    id: containerDetailId,
                    data: {
                      status: 'received',
                    },
                  })
                }
              } else {
                // Update to expecting if not all received
                await req.payload.update({
                  collection: 'container-details',
                  id: containerDetailId,
                  data: {
                    status: 'expecting',
                  },
                })
              }
            } else {
              // For export: Check if all product lines have been picked
              const hasAllocations = allProductLines.some(
                (line: any) => line.allocatedQty && line.allocatedQty > 0,
              )

              if (hasAllocations) {
                // Check if all have been picked (quick check)
                const pickupRecords = await req.payload.find({
                  collection: 'pickup-stock',
                  where: {
                    containerDetailId: {
                      equals: containerDetailId,
                    },
                    pickupStatus: {
                      equals: 'completed',
                    },
                  },
                  limit: 1, // Just check if any exist
                })

                const allPicked = allProductLines.every(
                  (line: any) => line.pickedQty && line.pickedQty > 0,
                )

                if (allPicked && pickupRecords.docs.length > 0) {
                  await req.payload.update({
                    collection: 'container-details',
                    id: containerDetailId,
                    data: {
                      status: 'picked_up',
                    },
                  })
                } else {
                  await req.payload.update({
                    collection: 'container-details',
                    id: containerDetailId,
                    data: {
                      status: 'allocated',
                    },
                  })
                }
              }
            }
          } catch (error) {
            console.error('Error updating container status:', error)
          }
        }
      },
    ],
  },
}
