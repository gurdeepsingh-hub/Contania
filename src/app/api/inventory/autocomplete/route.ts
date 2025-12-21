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

        // Filter by warehouse via put-away-stock -> inbound-product-line relationship
        // We need to find batches that exist in put-away-stock records for this warehouse
        if (warehouseId) {
          // First, get all inbound-product-line IDs that are linked to put-away-stock in this warehouse
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
            depth: 2,
            limit: 10000,
          })

          const productLineIds = new Set<number>()
          for (const record of putAwayRecords.docs) {
            const productLineId =
              typeof (record as any).inboundProductLineId === 'object'
                ? (record as any).inboundProductLineId.id
                : (record as any).inboundProductLineId
            if (productLineId) {
              productLineIds.add(productLineId)
            }
          }

          // If we have product line IDs, filter by them
          if (productLineIds.size > 0) {
            batchWhere.and.push({
              id: {
                in: Array.from(productLineIds),
              },
            })
          } else {
            // No records found, return empty
            break
          }
        }

        // Filter by SKU ID if provided
        if (skuId) {
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
            // SKU not found, return empty
            break
          }
        }

        const productLines = await payload.find({
          collection: 'inbound-product-line',
          where: batchWhere,
          limit: 1000, // Get more to find distinct values
        })

        // Get unique batch numbers
        const batchSet = new Set<string>()
        for (const line of productLines.docs) {
          if ((line as any).batchNumber) {
            batchSet.add((line as any).batchNumber)
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
        // Check both inbound and outbound inventory
        const inboundJobs = await payload.find({
          collection: 'inbound-inventory',
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

        const containerSet = new Set<string>()
        for (const job of inboundJobs.docs) {
          if ((job as any).containerNumber) {
            containerSet.add((job as any).containerNumber)
          }
        }
        for (const job of outboundJobs.docs) {
          if ((job as any).containerNumber) {
            containerSet.add((job as any).containerNumber)
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
            depth: 2,
            limit: 10000,
          })

          const productLineIds = new Set<number>()
          for (const record of putAwayRecords.docs) {
            // Filter by SKU if provided
            if (skuId) {
              const recordSkuId =
                typeof (record as any).skuId === 'object'
                  ? (record as any).skuId.id
                  : (record as any).skuId
              const recordSkuCode =
                typeof (record as any).skuId === 'object'
                  ? (record as any).skuId.skuCode
                  : undefined

              if (recordSkuCode !== skuId && recordSkuId?.toString() !== skuId) {
                continue
              }
            }

            const productLineId =
              typeof (record as any).inboundProductLineId === 'object'
                ? (record as any).inboundProductLineId.id
                : (record as any).inboundProductLineId
            if (productLineId) {
              productLineIds.add(productLineId)
            }
          }

          if (productLineIds.size > 0) {
            attr1Where.and.push({
              id: {
                in: Array.from(productLineIds),
              },
            })
          } else {
            break
          }
        }

        const productLines = await payload.find({
          collection: 'inbound-product-line',
          where: attr1Where,
          limit: 1000,
        })

        const attrSet = new Set<string>()
        for (const line of productLines.docs) {
          if ((line as any).attribute1) {
            attrSet.add((line as any).attribute1)
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
            depth: 2,
            limit: 10000,
          })

          const productLineIds = new Set<number>()
          for (const record of putAwayRecords.docs) {
            // Filter by SKU if provided
            if (skuId) {
              const recordSkuId =
                typeof (record as any).skuId === 'object'
                  ? (record as any).skuId.id
                  : (record as any).skuId
              const recordSkuCode =
                typeof (record as any).skuId === 'object'
                  ? (record as any).skuId.skuCode
                  : undefined

              if (recordSkuCode !== skuId && recordSkuId?.toString() !== skuId) {
                continue
              }
            }

            const productLineId =
              typeof (record as any).inboundProductLineId === 'object'
                ? (record as any).inboundProductLineId.id
                : (record as any).inboundProductLineId
            if (productLineId) {
              productLineIds.add(productLineId)
            }
          }

          if (productLineIds.size > 0) {
            attr2Where.and.push({
              id: {
                in: Array.from(productLineIds),
              },
            })
          } else {
            break
          }
        }

        const productLines = await payload.find({
          collection: 'inbound-product-line',
          where: attr2Where,
          limit: 1000,
        })

        const attrSet = new Set<string>()
        for (const line of productLines.docs) {
          if ((line as any).attribute2) {
            attrSet.add((line as any).attribute2)
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


