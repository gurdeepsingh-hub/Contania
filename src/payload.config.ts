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
  collections: [Users, Media, Tenants, TenantUsers, TenantRoles],
  email: nodemailerAdapter(
    // {
    // defaultFromName: process.env.EMAIL_FROM_NAME || 'Contania',
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
),
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  sharp,
  plugins: [
    payloadCloudPlugin(),
    // storage-adapter-placeholder
  ],
})
