// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Tenants } from './collections/Tenants'
import { TenantUsers } from './collections/TenantUsers'
import { TenantRoles } from './collections/TenantRoles'
import { Customers } from './collections/Customers'
import { HandlingUnits } from './collections/HandlingUnits'
import { StorageUnits } from './collections/StorageUnits'
import { SKUs } from './collections/SKUs'
import { PayingCustomers } from './collections/PayingCustomers'
import { Warehouses } from './collections/Warehouses'
import { Stores } from './collections/Stores'
import { TransportCompanies } from './collections/TransportCompanies'
import { InboundInventory } from './collections/InboundInventory'
import { InboundProductLine } from './collections/InboundProductLine'
import { PutAwayStock } from './collections/PutAwayStock'
import { OutboundInventory } from './collections/OutboundInventory'
import { OutboundProductLine } from './collections/OutboundProductLine'
import { PickupStock } from './collections/PickupStock'
import { TrailerTypes } from './collections/TrailerTypes'
import { Trailers } from './collections/Trailers'
import { Vehicles } from './collections/Vehicles'
import { Drivers } from './collections/Drivers'
import { DelayPoints } from './collections/DelayPoints'
import { EmptyParks } from './collections/EmptyParks'
import { ShippingLines } from './collections/ShippingLines'
import { Wharves } from './collections/Wharves'
import { ContainerSizes } from './collections/ContainerSizes'
import { ContainerWeights } from './collections/ContainerWeights'
import { DamageCodes } from './collections/DamageCodes'
import { DetentionControl } from './collections/DetentionControl'
import { Vessels } from './collections/Vessels'
import { ImportContainerBookings } from './collections/ImportContainerBookings'
import { ExportContainerBookings } from './collections/ExportContainerBookings'
import { ContainerDetails } from './collections/ContainerDetails'
import { ContainerStockAllocations } from './collections/ContainerStockAllocations'

import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Users,
    Media,
    Tenants,
    TenantUsers,
    TenantRoles,
    Customers,
    HandlingUnits,
    StorageUnits,
    SKUs,
    PayingCustomers,
    Warehouses,
    Stores,
    TransportCompanies,
    InboundInventory,
    InboundProductLine,
    PutAwayStock,
    OutboundInventory,
    OutboundProductLine,
    PickupStock,
    TrailerTypes,
    Trailers,
    Vehicles,
    Drivers,
    DelayPoints,
    EmptyParks,
    ShippingLines,
    Wharves,
    ContainerSizes,
    ContainerWeights,
    DamageCodes,
    DetentionControl,
    Vessels,
    ImportContainerBookings,
    ExportContainerBookings,
    ContainerDetails,
    ContainerStockAllocations,
  ],
  email: nodemailerAdapter(),
  // {
  // defaultFromName: process.env.EMAIL_FROM_NAME || 'Containa',
  // defaultFromAddress:
  //   process.env.EMAIL_FROM || `no-reply@${process.env.DEFAULT_HOST || 'localhost'}`,
  // transportOptions: {
  //   host: process.env.SMTP_HOST || '',
  //   port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 0,
  //   auth: {
  //     user: process.env.SMTP_USER || '',
  //     pass: process.env.SMTP_PASS || '',
  //   },
  // },
  // }
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    push: process.env.NODE_ENV === 'development',
  }),
  sharp,
  plugins: [
    payloadCloudPlugin(),
    // storage-adapter-placeholder
  ],
})
