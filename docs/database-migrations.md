# Database Migrations Guide

## How Payload Creates Tables

Payload CMS 3.0 with PostgreSQL uses migrations to create and manage database tables. Unlike MongoDB (which creates collections automatically), PostgreSQL requires explicit schema creation.

## Development Mode (`npm run dev`)

When running in development mode, Payload can automatically push schema changes to your database if `push: true` is configured in `payload.config.ts`. This is enabled by default in development.

**To create tables in development:**
```bash
npm run dev
```

Payload will automatically create/update tables based on your collections when the server starts.

## Production Mode (`npm start`)

In production mode, Payload does NOT automatically create tables. You need to run migrations manually before starting the production server.

### Step 1: Create Migration Files

First, generate migration files based on your current schema:
```bash
npm run migrate:create
```

This will create migration files in the `migrations` directory.

### Step 2: Run Migrations

Apply the migrations to create tables:
```bash
npm run migrate
```

### Step 3: Start Production Server

After migrations are applied, start your production server:
```bash
npm start
```

## Migration Commands

- `npm run migrate:create` - Create new migration files based on schema changes
- `npm run migrate` - Apply pending migrations to the database
- `npm run migrate:status` - Check the status of migrations
- `npm run migrate:refresh` - Reset and re-run all migrations (⚠️ **WARNING**: This will delete all data!)

## Troubleshooting

### Tables Not Created When Running `npm start`

**Problem:** Tables don't exist when you run `npm start` (production mode).

**Solution:**
1. Ensure your `DATABASE_URI` environment variable is set correctly in your `.env` file
2. Run migrations before starting production:
   ```bash
   npm run migrate:create
   npm run migrate
   npm start
   ```

### First Time Setup

If this is your first time setting up the database:

1. **Development (Recommended for first setup):**
   ```bash
   npm run dev
   ```
   This will automatically create tables.

2. **Production:**
   ```bash
   # Create migrations
   npm run migrate:create
   
   # Apply migrations
   npm run migrate
   
   # Build and start
   npm run build
   npm start
   ```

## Important Notes

- **Always backup your database** before running migrations in production
- Migrations are **one-way** - they create/update tables but don't automatically rollback
- In development, `push: true` allows Payload to automatically sync schema changes
- In production, always use migrations for schema changes

## Configuration

The `push` option in `payload.config.ts` is set to `true` only in development mode:

```typescript
db: postgresAdapter({
  pool: {
    connectionString: process.env.DATABASE_URI || '',
  },
  push: process.env.NODE_ENV === 'development',
}),
```

This ensures:
- **Development**: Automatic schema sync (convenient for development)
- **Production**: Manual migrations (safer and more controlled)

