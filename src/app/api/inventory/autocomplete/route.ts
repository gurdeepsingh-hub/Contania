import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'inventory_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const url = new URL(request.url)
    const field = url.searchParams.get('field')
    const search = url.searchParams.get('search') || ''
    const warehouseId = url.searchParams.get('warehouseId')
    // Additional filter parameters for contextual filtering
    const skuId = url.searchParams.get('skuId')
    const batch = url.searchParams.get('batch')
    const fetchDefaults = url.searchParams.get('fetchDefaults') === 'true' // For default suggestions

    if (!field) {
      return NextResponse.json({ message: 'Field parameter is required' }, { status: 400 })
    }

    const suggestions: string[] = []
    const limit = fetchDefaults ? 4 : 20 // Limit to 3-4 for default suggestions

    // Base where clause for tenant filtering
    const tenantWhere: any = {
      tenantId: {
        equals: tenant.id,
      },
    }

    switch (field) {
      case 'customerName': {
        const customers = await payload.find({
          collection: 'customers',
          where: {
            and: [
              tenantWhere,
              {
                customer_name: {
                  contains: search,
                },
              },
            ],
          },
          limit,
        })
        suggestions.push(...customers.docs.map((c: any) => c.customer_name).filter(Boolean))
        break
      }

      case 'skuId': {
        const skuWhere: any = {
          and: [tenantWhere],
        }

        // Add search filter if provided
        if (search) {
          skuWhere.and.push({
            or: [
              {
                skuCode: {
                  contains: search,
                },
              },
              {
                description: {
                  contains: search,
                },
              },
            ],
          })
        }

        // Filter by warehouse if provided - only show SKUs that exist in put-away-stock for this warehouse
        if (warehouseId) {
          const putAwayRecords = await payload.find({
            collection: 'put-away-stock',
            where: {
              and: [
                tenantWhere,
                {
                  warehouseId: {
                    equals: Number(warehouseId),
                  },
                },
                {
                  isDeleted: {
                    equals: false,
                  },
                },
              ],
            },
            depth: 1,
            limit: 10000,
          })

          const skuIds = new Set<number>()
          for (const record of putAwayRecords.docs) {
            const recordSkuId =
              typeof (record as any).skuId === 'object'
                ? (record as any).skuId.id
                : (record as any).skuId
            if (recordSkuId) {
              skuIds.add(recordSkuId)
            }
          }

          if (skuIds.size > 0) {
            skuWhere.and.push({
              id: {
                in: Array.from(skuIds),
              },
            })
          } else {
            // No records found, return empty
            break
          }
        }

        const skus = await payload.find({
          collection: 'skus',
          where: skuWhere,
          limit,
        })
        suggestions.push(...skus.docs.map((s: any) => s.skuCode).filter(Boolean))
        break
      }

      case 'batch': {
        // Build where clause with warehouse and SKU filtering
        const batchWhere: any = {
          and: [
            {
              batchNumber: {
                exists: true,
              },
            },
          ],
        }

        // Add search filter if provided
        if (search) {
          batchWhere.and.push({
            batchNumber: {
              contains: search,
            },
          })
        }

        // Track batches from container allocations
        const containerBatchSet = new Set<string>()

        // Filter by warehouse via put-away-stock -> inbound-product-line relationship
        // Also check container stock allocations for batches
        if (warehouseId) {
          // First, get all put-away-stock records for this warehouse
          const putAwayRecords = await payload.find({
            collection: 'put-away-stock',
            where: {
              and: [
                tenantWhere,
                {
                  warehouseId: {
                    equals: Number(warehouseId),
                  },
                },
                {
                  isDeleted: {
                    equals: false,
                  },
                },
              ],
            },
            depth: 3, // Include container stock allocations with product lines
            limit: 10000,
          })

          const productLineIds = new Set<number>()
          
          // Get SKU ID if filtering by SKU
          let targetSkuId: number | undefined
          if (skuId) {
            const skuResult = await payload.find({
              collection: 'skus',
              where: {
                and: [
                  tenantWhere,
                  {
                    skuCode: {
                      equals: skuId,
                    },
                  },
                ],
              },
              limit: 1,
            })
            if (skuResult.docs.length > 0) {
              targetSkuId = skuResult.docs[0].id
            }
          }
          
          for (const record of putAwayRecords.docs) {
            // Check inbound product lines
            const inboundProductLineId = (record as any).inboundProductLineId
            if (inboundProductLineId) {
              const productLineId =
                typeof inboundProductLineId === 'object' && inboundProductLineId !== null
                  ? inboundProductLineId.id
                  : inboundProductLineId
              if (productLineId) {
                productLineIds.add(productLineId)
              }
            }

            // Check container stock allocations
            const containerStockAllocationId = (record as any).containerStockAllocationId
            if (containerStockAllocationId) {
              const allocation =
                typeof containerStockAllocationId === 'object' && containerStockAllocationId !== null
                  ? containerStockAllocationId
                  : null
              
              if (allocation && allocation.productLines && Array.isArray(allocation.productLines)) {
                for (const productLine of allocation.productLines) {
                  if (productLine.batchNumber) {
                    // Apply search filter if provided
                    if (!search || productLine.batchNumber.toLowerCase().includes(search.toLowerCase())) {
                      // Apply SKU filter if provided
                      if (targetSkuId) {
                        const productLineSkuId =
                          typeof productLine.skuId === 'object' && productLine.skuId !== null
                            ? productLine.skuId.id
                            : productLine.skuId
                        
                        if (productLineSkuId === targetSkuId) {
                          containerBatchSet.add(productLine.batchNumber)
                        }
                      } else {
                        containerBatchSet.add(productLine.batchNumber)
                      }
                    }
                  }
                }
              }
            }
          }

          // If we have product line IDs, filter by them
          if (productLineIds.size > 0) {
            batchWhere.and.push({
              id: {
                in: Array.from(productLineIds),
              },
            })
          } else if (containerBatchSet.size === 0 && !skuId) {
            // No records found, return empty (unless we're filtering by SKU, then continue)
            break
          }
        }

        // Filter by SKU ID if provided (for inbound product lines)
        if (skuId && batchWhere.and.length > 0) {
          // Find SKU by code
          const skuResult = await payload.find({
            collection: 'skus',
            where: {
              and: [
                tenantWhere,
                {
                  skuCode: {
                    equals: skuId,
                  },
                },
              ],
            },
            limit: 1,
          })

          if (skuResult.docs.length > 0) {
            const sku = skuResult.docs[0]
            batchWhere.and.push({
              skuId: {
                equals: sku.id,
              },
            })
          } else {
            // SKU not found, but continue if we have container batches
            if (containerBatchSet.size === 0) {
              break
            }
          }
        }

        // Get batches from inbound product lines
        const batchSet = new Set<string>()
        if (batchWhere.and.length > 0) {
          const productLines = await payload.find({
            collection: 'inbound-product-line',
            where: batchWhere,
            limit: 1000, // Get more to find distinct values
          })

          for (const line of productLines.docs) {
            if ((line as any).batchNumber) {
              batchSet.add((line as any).batchNumber)
            }
          }
        }

        // Add batches from container allocations
        for (const batch of containerBatchSet) {
          batchSet.add(batch)
        }

        // If no warehouse filter, also check container allocations directly (limited)
        if (!warehouseId && search) {
          // Find container allocations with matching batch numbers
          const containerAllocations = await payload.find({
            collection: 'container-stock-allocations',
            where: {
              // We'll filter in memory since productLines is an array field
            },
            depth: 2,
            limit: 1000,
          })

          for (const allocation of containerAllocations.docs) {
            const allocationData = allocation as any
            const productLines = allocationData.productLines || []
            for (const productLine of productLines) {
              if (
                productLine.batchNumber &&
                productLine.batchNumber.toLowerCase().includes(search.toLowerCase())
              ) {
                // Apply SKU filter if provided
                if (skuId) {
                  const productLineSkuId =
                    typeof productLine.skuId === 'object' && productLine.skuId !== null
                      ? productLine.skuId.id
                      : productLine.skuId
                  const productLineSkuCode =
                    typeof productLine.skuId === 'object' && productLine.skuId !== null
                      ? productLine.skuId.skuCode
                      : undefined
                  
                  // Find SKU by code to compare
                  const skuResult = await payload.find({
                    collection: 'skus',
                    where: {
                      and: [
                        tenantWhere,
                        {
                          skuCode: {
                            equals: skuId,
                          },
                        },
                      ],
                    },
                    limit: 1,
                  })
                  
                  if (skuResult.docs.length > 0) {
                    const sku = skuResult.docs[0]
                    if (productLineSkuId === sku.id || productLineSkuCode === sku.skuCode) {
                      batchSet.add(productLine.batchNumber)
                    }
                  }
                } else {
                  batchSet.add(productLine.batchNumber)
                }
              }
            }
          }
        }

        suggestions.push(...Array.from(batchSet).slice(0, limit))
        break
      }

      case 'skuDescription': {
        const skuDescWhere: any = {
          and: [tenantWhere],
        }

        // Add search filter if provided
        if (search) {
          skuDescWhere.and.push({
            description: {
              contains: search,
            },
          })
        }

        // Filter by warehouse if provided
        if (warehouseId) {
          const putAwayRecords = await payload.find({
            collection: 'put-away-stock',
            where: {
              and: [
                tenantWhere,
                {
                  warehouseId: {
                    equals: Number(warehouseId),
                  },
                },
                {
                  isDeleted: {
                    equals: false,
                  },
                },
              ],
            },
            depth: 1,
            limit: 10000,
          })

          const skuIds = new Set<number>()
          for (const record of putAwayRecords.docs) {
            const recordSkuId =
              typeof (record as any).skuId === 'object'
                ? (record as any).skuId.id
                : (record as any).skuId
            if (recordSkuId) {
              skuIds.add(recordSkuId)
            }
          }

          if (skuIds.size > 0) {
            skuDescWhere.and.push({
              id: {
                in: Array.from(skuIds),
              },
            })
          } else {
            break
          }
        }

        // Filter by SKU ID if provided
        if (skuId) {
          skuDescWhere.and.push({
            skuCode: {
              equals: skuId,
            },
          })
        }

        const skus = await payload.find({
          collection: 'skus',
          where: skuDescWhere,
          limit,
        })
        suggestions.push(...skus.docs.map((s: any) => s.description).filter(Boolean))
        break
      }

      case 'lpn': {
        const where: any = {
          and: [
            tenantWhere,
            {
              lpnNumber: {
                contains: search,
              },
            },
            {
              isDeleted: {
                equals: false,
              },
            },
          ],
        }

        if (warehouseId) {
          where.and.push({
            warehouseId: {
              equals: Number(warehouseId),
            },
          })
        }

        const putAwayRecords = await payload.find({
          collection: 'put-away-stock',
          where,
          limit: 1000,
        })

        // Get unique LPN numbers
        const lpnSet = new Set<string>()
        for (const record of putAwayRecords.docs) {
          if ((record as any).lpnNumber) {
            lpnSet.add((record as any).lpnNumber)
          }
        }
        suggestions.push(...Array.from(lpnSet).slice(0, limit))
        break
      }

      case 'containerNumber': {
        // Check outbound inventory and container details
        // Note: inbound-inventory doesn't have containerNumber field
        const outboundJobs = await payload.find({
          collection: 'outbound-inventory',
          where: {
            and: [
              tenantWhere,
              {
                containerNumber: {
                  contains: search,
                },
              },
            ],
          },
          limit,
        })

        // Also check container details (for container bookings)
        const containerDetails = await payload.find({
          collection: 'container-details',
          where: {
            and: [
              {
                containerNumber: {
                  contains: search,
                },
              },
            ],
          },
          depth: 2, // Include booking to filter by tenant
          limit: 1000,
        })

        const containerSet = new Set<string>()
        for (const job of outboundJobs.docs) {
          if ((job as any).containerNumber) {
            containerSet.add((job as any).containerNumber)
          }
        }
        // Filter container details by tenant through booking
        for (const container of containerDetails.docs) {
          const containerData = container as any
          const bookingRef = containerData.containerBookingId
          if (bookingRef) {
            let bookingTenantId: number | undefined
            if (typeof bookingRef === 'object' && bookingRef !== null) {
              if ('value' in bookingRef && bookingRef.value) {
                // Fully loaded booking with depth
                bookingTenantId =
                  typeof bookingRef.value.tenantId === 'object'
                    ? bookingRef.value.tenantId.id
                    : bookingRef.value.tenantId
              } else if ('id' in bookingRef && bookingRef.id) {
                // Partial load - try to get tenant from id if it's an object
                const bookingIdObj = bookingRef.id
                if (typeof bookingIdObj === 'object' && bookingIdObj !== null && 'tenantId' in bookingIdObj) {
                  bookingTenantId =
                    typeof (bookingIdObj as any).tenantId === 'object'
                      ? (bookingIdObj as any).tenantId.id
                      : (bookingIdObj as any).tenantId
                }
              }
            }
            if (bookingTenantId === tenant.id && containerData.containerNumber) {
              containerSet.add(containerData.containerNumber)
            }
          } else if (containerData.containerNumber) {
            // If no booking ref, still add the container number (might be orphaned)
            containerSet.add(containerData.containerNumber)
          }
        }
        suggestions.push(...Array.from(containerSet).slice(0, limit))
        break
      }

      case 'customerReference': {
        const inboundJobs = await payload.find({
          collection: 'inbound-inventory',
          where: {
            and: [
              tenantWhere,
              {
                deliveryCustomerReferenceNumber: {
                  contains: search,
                },
              },
            ],
          },
          limit,
        })

        const outboundJobs = await payload.find({
          collection: 'outbound-inventory',
          where: {
            and: [
              tenantWhere,
              {
                deliveryCustomerReferenceNumber: {
                  contains: search,
                },
              },
            ],
          },
          limit,
        })

        // Also check container bookings
        const importBookings = await payload.find({
          collection: 'import-container-bookings',
          where: {
            and: [
              tenantWhere,
              {
                customerReference: {
                  contains: search,
                },
              },
            ],
          },
          limit,
        })

        const exportBookings = await payload.find({
          collection: 'export-container-bookings',
          where: {
            and: [
              tenantWhere,
              {
                customerReference: {
                  contains: search,
                },
              },
            ],
          },
          limit,
        })

        const refSet = new Set<string>()
        for (const job of inboundJobs.docs) {
          if ((job as any).deliveryCustomerReferenceNumber) {
            refSet.add((job as any).deliveryCustomerReferenceNumber)
          }
        }
        for (const job of outboundJobs.docs) {
          if ((job as any).deliveryCustomerReferenceNumber) {
            refSet.add((job as any).deliveryCustomerReferenceNumber)
          }
        }
        for (const booking of importBookings.docs) {
          if ((booking as any).customerReference) {
            refSet.add((booking as any).customerReference)
          }
        }
        for (const booking of exportBookings.docs) {
          if ((booking as any).customerReference) {
            refSet.add((booking as any).customerReference)
          }
        }
        suggestions.push(...Array.from(refSet).slice(0, limit))
        break
      }

      case 'inboundOrderNumber': {
        const jobs = await payload.find({
          collection: 'inbound-inventory',
          where: {
            and: [
              tenantWhere,
              {
                jobCode: {
                  contains: search,
                },
              },
            ],
          },
          limit,
        })
        suggestions.push(...jobs.docs.map((j: any) => j.jobCode).filter(Boolean))
        break
      }

      case 'containerBookingCode': {
        // Check both import and export container bookings
        const importBookings = await payload.find({
          collection: 'import-container-bookings',
          where: {
            and: [
              tenantWhere,
              {
                bookingCode: {
                  contains: search,
                },
              },
            ],
          },
          limit,
        })

        const exportBookings = await payload.find({
          collection: 'export-container-bookings',
          where: {
            and: [
              tenantWhere,
              {
                bookingCode: {
                  contains: search,
                },
              },
            ],
          },
          limit,
        })

        const bookingCodeSet = new Set<string>()
        for (const booking of importBookings.docs) {
          if ((booking as any).bookingCode) {
            bookingCodeSet.add((booking as any).bookingCode)
          }
        }
        for (const booking of exportBookings.docs) {
          if ((booking as any).bookingCode) {
            bookingCodeSet.add((booking as any).bookingCode)
          }
        }
        suggestions.push(...Array.from(bookingCodeSet).slice(0, limit))
        break
      }

      case 'attribute1': {
        const attr1Where: any = {
          and: [
            {
              attribute1: {
                exists: true,
              },
            },
          ],
        }

        // Add search filter if provided
        if (search) {
          attr1Where.and.push({
            attribute1: {
              contains: search,
            },
          })
        }

        // Track attribute1 values from container allocations
        const containerAttr1Set = new Set<string>()

        // Filter by warehouse and SKU if provided
        if (warehouseId || skuId) {
          const putAwayWhere: any = {
            and: [
              tenantWhere,
              {
                isDeleted: {
                  equals: false,
                },
              },
            ],
          }

          if (warehouseId) {
            putAwayWhere.and.push({
              warehouseId: {
                equals: Number(warehouseId),
              },
            })
          }

          const putAwayRecords = await payload.find({
            collection: 'put-away-stock',
            where: putAwayWhere,
            depth: 3, // Include container stock allocations
            limit: 10000,
          })

          // Get SKU ID if filtering by SKU
          let targetSkuId: number | undefined
          let targetSkuCode: string | undefined
          if (skuId) {
            const skuResult = await payload.find({
              collection: 'skus',
              where: {
                and: [
                  tenantWhere,
                  {
                    skuCode: {
                      equals: skuId,
                    },
                  },
                ],
              },
              limit: 1,
            })
            if (skuResult.docs.length > 0) {
              targetSkuId = skuResult.docs[0].id
              targetSkuCode = skuResult.docs[0].skuCode
            }
          }

          const productLineIds = new Set<number>()
          for (const record of putAwayRecords.docs) {
            // Filter by SKU if provided
            if (targetSkuId || targetSkuCode) {
              const recordSkuId =
                typeof (record as any).skuId === 'object'
                  ? (record as any).skuId.id
                  : (record as any).skuId
              const recordSkuCode =
                typeof (record as any).skuId === 'object'
                  ? (record as any).skuId.skuCode
                  : undefined

              if (recordSkuCode !== targetSkuCode && recordSkuId !== targetSkuId) {
                continue
              }
            }

            // Check inbound product lines
            const inboundProductLineId = (record as any).inboundProductLineId
            if (inboundProductLineId) {
              const productLineId =
                typeof inboundProductLineId === 'object' && inboundProductLineId !== null
                  ? inboundProductLineId.id
                  : inboundProductLineId
              if (productLineId) {
                productLineIds.add(productLineId)
              }
            }

            // Check container stock allocations
            const containerStockAllocationId = (record as any).containerStockAllocationId
            if (containerStockAllocationId) {
              const allocation =
                typeof containerStockAllocationId === 'object' && containerStockAllocationId !== null
                  ? containerStockAllocationId
                  : null
              
              if (allocation && allocation.productLines && Array.isArray(allocation.productLines)) {
                for (const productLine of allocation.productLines) {
                  if (productLine.attribute1) {
                    // Apply search filter if provided
                    if (!search || productLine.attribute1.toLowerCase().includes(search.toLowerCase())) {
                      // Apply SKU filter if provided
                      if (targetSkuId || targetSkuCode) {
                        const productLineSkuId =
                          typeof productLine.skuId === 'object' && productLine.skuId !== null
                            ? productLine.skuId.id
                            : productLine.skuId
                        const productLineSkuCode =
                          typeof productLine.skuId === 'object' && productLine.skuId !== null
                            ? productLine.skuId.skuCode
                            : undefined
                        
                        if (productLineSkuId === targetSkuId || productLineSkuCode === targetSkuCode) {
                          containerAttr1Set.add(productLine.attribute1)
                        }
                      } else {
                        containerAttr1Set.add(productLine.attribute1)
                      }
                    }
                  }
                }
              }
            }
          }

          if (productLineIds.size > 0) {
            attr1Where.and.push({
              id: {
                in: Array.from(productLineIds),
              },
            })
          } else if (containerAttr1Set.size === 0 && !skuId) {
            break
          }
        }

        const attrSet = new Set<string>()
        
        // Get attribute1 from inbound product lines
        if (attr1Where.and.length > 0) {
          const productLines = await payload.find({
            collection: 'inbound-product-line',
            where: attr1Where,
            limit: 1000,
          })

          for (const line of productLines.docs) {
            if ((line as any).attribute1) {
              attrSet.add((line as any).attribute1)
            }
          }
        }

        // Add attribute1 from container allocations
        for (const attr1 of containerAttr1Set) {
          attrSet.add(attr1)
        }

        // If no warehouse filter, also check container allocations directly (limited)
        if (!warehouseId && search) {
          const containerAllocations = await payload.find({
            collection: 'container-stock-allocations',
            where: {},
            depth: 2,
            limit: 1000,
          })

          for (const allocation of containerAllocations.docs) {
            const allocationData = allocation as any
            const productLines = allocationData.productLines || []
            for (const productLine of productLines) {
              if (
                productLine.attribute1 &&
                productLine.attribute1.toLowerCase().includes(search.toLowerCase())
              ) {
                // Apply SKU filter if provided
                if (skuId) {
                  const productLineSkuId =
                    typeof productLine.skuId === 'object' && productLine.skuId !== null
                      ? productLine.skuId.id
                      : productLine.skuId
                  const productLineSkuCode =
                    typeof productLine.skuId === 'object' && productLine.skuId !== null
                      ? productLine.skuId.skuCode
                      : undefined
                  
                  // Find SKU by code to compare
                  const skuResult = await payload.find({
                    collection: 'skus',
                    where: {
                      and: [
                        tenantWhere,
                        {
                          skuCode: {
                            equals: skuId,
                          },
                        },
                      ],
                    },
                    limit: 1,
                  })
                  
                  if (skuResult.docs.length > 0) {
                    const sku = skuResult.docs[0]
                    if (productLineSkuId === sku.id || productLineSkuCode === sku.skuCode) {
                      attrSet.add(productLine.attribute1)
                    }
                  }
                } else {
                  attrSet.add(productLine.attribute1)
                }
              }
            }
          }
        }

        suggestions.push(...Array.from(attrSet).slice(0, limit))
        break
      }

      case 'attribute2': {
        const attr2Where: any = {
          and: [
            {
              attribute2: {
                exists: true,
              },
            },
          ],
        }

        // Add search filter if provided
        if (search) {
          attr2Where.and.push({
            attribute2: {
              contains: search,
            },
          })
        }

        // Track attribute2 values from container allocations
        const containerAttr2Set = new Set<string>()

        // Filter by warehouse and SKU if provided
        if (warehouseId || skuId) {
          const putAwayWhere: any = {
            and: [
              tenantWhere,
              {
                isDeleted: {
                  equals: false,
                },
              },
            ],
          }

          if (warehouseId) {
            putAwayWhere.and.push({
              warehouseId: {
                equals: Number(warehouseId),
              },
            })
          }

          const putAwayRecords = await payload.find({
            collection: 'put-away-stock',
            where: putAwayWhere,
            depth: 3, // Include container stock allocations
            limit: 10000,
          })

          // Get SKU ID if filtering by SKU
          let targetSkuId: number | undefined
          let targetSkuCode: string | undefined
          if (skuId) {
            const skuResult = await payload.find({
              collection: 'skus',
              where: {
                and: [
                  tenantWhere,
                  {
                    skuCode: {
                      equals: skuId,
                    },
                  },
                ],
              },
              limit: 1,
            })
            if (skuResult.docs.length > 0) {
              targetSkuId = skuResult.docs[0].id
              targetSkuCode = skuResult.docs[0].skuCode
            }
          }

          const productLineIds = new Set<number>()
          for (const record of putAwayRecords.docs) {
            // Filter by SKU if provided
            if (targetSkuId || targetSkuCode) {
              const recordSkuId =
                typeof (record as any).skuId === 'object'
                  ? (record as any).skuId.id
                  : (record as any).skuId
              const recordSkuCode =
                typeof (record as any).skuId === 'object'
                  ? (record as any).skuId.skuCode
                  : undefined

              if (recordSkuCode !== targetSkuCode && recordSkuId !== targetSkuId) {
                continue
              }
            }

            // Check inbound product lines
            const inboundProductLineId = (record as any).inboundProductLineId
            if (inboundProductLineId) {
              const productLineId =
                typeof inboundProductLineId === 'object' && inboundProductLineId !== null
                  ? inboundProductLineId.id
                  : inboundProductLineId
              if (productLineId) {
                productLineIds.add(productLineId)
              }
            }

            // Check container stock allocations
            const containerStockAllocationId = (record as any).containerStockAllocationId
            if (containerStockAllocationId) {
              const allocation =
                typeof containerStockAllocationId === 'object' && containerStockAllocationId !== null
                  ? containerStockAllocationId
                  : null
              
              if (allocation && allocation.productLines && Array.isArray(allocation.productLines)) {
                for (const productLine of allocation.productLines) {
                  if (productLine.attribute2) {
                    // Apply search filter if provided
                    if (!search || productLine.attribute2.toLowerCase().includes(search.toLowerCase())) {
                      // Apply SKU filter if provided
                      if (targetSkuId || targetSkuCode) {
                        const productLineSkuId =
                          typeof productLine.skuId === 'object' && productLine.skuId !== null
                            ? productLine.skuId.id
                            : productLine.skuId
                        const productLineSkuCode =
                          typeof productLine.skuId === 'object' && productLine.skuId !== null
                            ? productLine.skuId.skuCode
                            : undefined
                        
                        if (productLineSkuId === targetSkuId || productLineSkuCode === targetSkuCode) {
                          containerAttr2Set.add(productLine.attribute2)
                        }
                      } else {
                        containerAttr2Set.add(productLine.attribute2)
                      }
                    }
                  }
                }
              }
            }
          }

          if (productLineIds.size > 0) {
            attr2Where.and.push({
              id: {
                in: Array.from(productLineIds),
              },
            })
          } else if (containerAttr2Set.size === 0 && !skuId) {
            break
          }
        }

        const attrSet = new Set<string>()
        
        // Get attribute2 from inbound product lines
        if (attr2Where.and.length > 0) {
          const productLines = await payload.find({
            collection: 'inbound-product-line',
            where: attr2Where,
            limit: 1000,
          })

          for (const line of productLines.docs) {
            if ((line as any).attribute2) {
              attrSet.add((line as any).attribute2)
            }
          }
        }

        // Add attribute2 from container allocations
        for (const attr2 of containerAttr2Set) {
          attrSet.add(attr2)
        }

        // If no warehouse filter, also check container allocations directly (limited)
        if (!warehouseId && search) {
          const containerAllocations = await payload.find({
            collection: 'container-stock-allocations',
            where: {},
            depth: 2,
            limit: 1000,
          })

          for (const allocation of containerAllocations.docs) {
            const allocationData = allocation as any
            const productLines = allocationData.productLines || []
            for (const productLine of productLines) {
              if (
                productLine.attribute2 &&
                productLine.attribute2.toLowerCase().includes(search.toLowerCase())
              ) {
                // Apply SKU filter if provided
                if (skuId) {
                  const productLineSkuId =
                    typeof productLine.skuId === 'object' && productLine.skuId !== null
                      ? productLine.skuId.id
                      : productLine.skuId
                  const productLineSkuCode =
                    typeof productLine.skuId === 'object' && productLine.skuId !== null
                      ? productLine.skuId.skuCode
                      : undefined
                  
                  // Find SKU by code to compare
                  const skuResult = await payload.find({
                    collection: 'skus',
                    where: {
                      and: [
                        tenantWhere,
                        {
                          skuCode: {
                            equals: skuId,
                          },
                        },
                      ],
                    },
                    limit: 1,
                  })
                  
                  if (skuResult.docs.length > 0) {
                    const sku = skuResult.docs[0]
                    if (productLineSkuId === sku.id || productLineSkuCode === sku.skuCode) {
                      attrSet.add(productLine.attribute2)
                    }
                  }
                } else {
                  attrSet.add(productLine.attribute2)
                }
              }
            }
          }
        }

        suggestions.push(...Array.from(attrSet).slice(0, limit))
        break
      }

      case 'location': {
        const where: any = {
          and: [
            tenantWhere,
            {
              location: {
                contains: search,
              },
            },
            {
              isDeleted: {
                equals: false,
              },
            },
          ],
        }

        if (warehouseId) {
          where.and.push({
            warehouseId: {
              equals: Number(warehouseId),
            },
          })
        }

        const putAwayRecords = await payload.find({
          collection: 'put-away-stock',
          where,
          limit: 1000,
        })

        const locationSet = new Set<string>()
        for (const record of putAwayRecords.docs) {
          if ((record as any).location) {
            locationSet.add((record as any).location)
          }
        }
        suggestions.push(...Array.from(locationSet).slice(0, limit))
        break
      }

      default:
        return NextResponse.json({ message: `Unknown field: ${field}` }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      suggestions: suggestions.filter(Boolean),
    })
  } catch (error) {
    console.error('Error fetching autocomplete suggestions:', error)
    return NextResponse.json(
      { message: 'Failed to fetch suggestions' },
      { status: 500 }
    )
  }
}


