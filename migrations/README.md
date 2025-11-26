# Database Migrations

## Rename Inbound Inventory Fields

This migration renames columns in the `inbound_inventory` table to match the updated field names in the collection.

### Option 1: Let Payload Auto-Sync (Recommended)

Payload CMS should automatically sync schema changes. Try restarting your development server:

```bash
# Stop the server (Ctrl+C)
# Then restart
pnpm dev
```

If Payload doesn't auto-sync, you may need to run the SQL migration manually.

### Option 2: Manual SQL Migration

If auto-sync doesn't work, run the SQL migration script:

```bash
# Using psql
psql -U your_username -d your_database -f migrations/rename_inbound_inventory_fields.sql

# Or using a database GUI tool like pgAdmin, DBeaver, etc.
# Just copy and paste the contents of rename_inbound_inventory_fields.sql
```

### What This Migration Does

1. Renames `delivery_customer_ref` → `delivery_customer_reference_number`
2. Renames `customer_reference` → `ordering_customer_reference_number`
3. Ensures `delivery_customer_id` column exists (TEXT type)
4. Converts `supplier_id` from INTEGER to TEXT (if it was a relationship field)
   - Existing integer IDs are converted to "customers:ID" format

### Important Notes

- **Backup your database** before running migrations in production
- The migration converts existing `supplier_id` integer values to "customers:ID" format
- If you have `supplier_id` values that should be from `paying-customers` collection, you'll need to update them manually after migration


