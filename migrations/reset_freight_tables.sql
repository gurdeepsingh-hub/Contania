-- Migration script to reset freight/inventory tables
-- This drops and recreates freight/inventory tables while preserving tenant, user, and entity data
-- 
-- IMPORTANT: BACKUP YOUR DATABASE BEFORE RUNNING THIS SCRIPT
-- This will DELETE all freight/inventory data (inbound/outbound jobs, product lines, put-away stock)
-- Tenant, user, customer, warehouse, SKU, and other entity data will be preserved

-- Step 1: Drop freight/inventory tables in correct order (handling dependencies)
-- Using CASCADE to automatically drop foreign key constraints

DO $$
DECLARE
    dropped_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting freight/inventory tables reset...';
    RAISE NOTICE 'This will delete all inbound/outbound inventory data.';
    RAISE NOTICE 'Tenant, user, customer, warehouse, and SKU data will be preserved.';
    
    -- Drop outbound_product_line first (depends on outbound_inventory)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'outbound_product_line') THEN
        DROP TABLE IF EXISTS outbound_product_line CASCADE;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped table: outbound_product_line';
    END IF;
    
    -- Drop outbound_inventory
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'outbound_inventory') THEN
        DROP TABLE IF EXISTS outbound_inventory CASCADE;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped table: outbound_inventory';
    END IF;
    
    -- Drop put_away_stock (may reference inbound/outbound)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'put_away_stock') THEN
        DROP TABLE IF EXISTS put_away_stock CASCADE;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped table: put_away_stock';
    END IF;
    
    -- Drop inbound_product_line (depends on inbound_inventory)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inbound_product_line') THEN
        DROP TABLE IF EXISTS inbound_product_line CASCADE;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped table: inbound_product_line';
    END IF;
    
    -- Drop inbound_inventory
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inbound_inventory') THEN
        DROP TABLE IF EXISTS inbound_inventory CASCADE;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped table: inbound_inventory';
    END IF;
    
    RAISE NOTICE 'Successfully dropped % freight/inventory table(s)', dropped_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Restart your Payload server (pnpm dev)';
    RAISE NOTICE '2. Payload will automatically recreate these tables with the correct schema';
    RAISE NOTICE '3. Verify tables are created correctly';
    
END $$;

-- Verify tables are dropped
DO $$
DECLARE
    remaining_tables TEXT[];
BEGIN
    SELECT array_agg(table_name) INTO remaining_tables
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'inbound_inventory',
        'inbound_product_line',
        'outbound_inventory',
        'outbound_product_line',
        'put_away_stock'
    );
    
    IF remaining_tables IS NOT NULL AND array_length(remaining_tables, 1) > 0 THEN
        RAISE WARNING 'Some tables still exist: %', array_to_string(remaining_tables, ', ');
    ELSE
        RAISE NOTICE 'All freight/inventory tables have been successfully dropped.';
    END IF;
END $$;





