# Database Migrations

## Reset Freight/Inventory Tables

This migration completely resets all freight/inventory tables by dropping and recreating them. Use this when you have schema inconsistencies or foreign key constraint issues that are difficult to fix manually.

### When to Use This Migration

Use this migration when:

- You're experiencing persistent foreign key constraint errors
- Schema inconsistencies between Payload collections and database tables
- You want a clean slate for freight/inventory data
- You're okay with losing all existing freight/inventory data (inbound/outbound jobs, product lines, put-away stock)

### What Gets Preserved

The following data will be **preserved**:

- ✅ Tenants
- ✅ Tenant Users
- ✅ Tenant Roles
- ✅ Users (super admin)
- ✅ Customers
- ✅ Paying Customers
- ✅ Warehouses
- ✅ SKUs
- ✅ Storage Units
- ✅ Handling Units
- ✅ Transport Companies
- ✅ Media files

### What Gets Deleted

The following tables and their data will be **deleted**:

- ❌ `inbound_inventory` - All inbound job records
- ❌ `inbound_product_line` - All inbound product line records
- ❌ `outbound_inventory` - All outbound job records
- ❌ `outbound_product_line` - All outbound product line records
- ❌ `put_away_stock` - All put-away stock records

### How to Run

**⚠️ IMPORTANT: BACKUP YOUR DATABASE BEFORE RUNNING THIS MIGRATION**

```bash
# Using psql
psql -U your_username -d your_database -f migrations/reset_freight_tables.sql

# Or using a database GUI tool like pgAdmin, DBeaver, etc.
# Just copy and paste the contents of reset_freight_tables.sql
```

### After Running the Migration

1. **Restart your Payload server**:

   ```bash
   # Stop the server (Ctrl+C)
   pnpm dev
   ```

2. **Payload will automatically recreate the tables** with the correct schema based on your collection definitions

3. **Verify tables are created correctly** by checking:
   - Tables exist in your database
   - You can create new inbound/outbound jobs
   - No foreign key constraint errors

### What This Migration Does

1. **Drops freight/inventory tables** in the correct order (handling dependencies)
2. **Uses CASCADE** to automatically drop foreign key constraints
3. **Verifies tables are dropped** before completion
4. **Provides clear next steps** for recreating tables

### Important Notes

- **This is a destructive operation** - all freight/inventory data will be permanently deleted
- **Backup your database** before running in production
- Tenant, user, and entity data will be preserved
- Tables will be automatically recreated by Payload on server restart
- This is the recommended approach when dealing with complex schema issues
