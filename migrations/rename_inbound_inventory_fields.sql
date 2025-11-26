-- Migration script to rename inbound_inventory table columns
-- Run this script against your PostgreSQL database

-- Rename deliveryCustomerRef to deliveryCustomerReferenceNumber (if it exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inbound_inventory' 
        AND column_name = 'delivery_customer_ref'
    ) THEN
        ALTER TABLE inbound_inventory 
        RENAME COLUMN delivery_customer_ref TO delivery_customer_reference_number;
    END IF;
END $$;

-- Rename customerReference to orderingCustomerReferenceNumber (if it exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inbound_inventory' 
        AND column_name = 'customer_reference'
    ) THEN
        ALTER TABLE inbound_inventory
        RENAME COLUMN customer_reference TO ordering_customer_reference_number;
    END IF;
END $$;

-- Add new deliveryCustomerId column (if it doesn't exist)
-- Note: This column should already exist from Payload's auto-sync, but adding it just in case
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inbound_inventory' 
        AND column_name = 'delivery_customer_id'
    ) THEN
        ALTER TABLE inbound_inventory ADD COLUMN delivery_customer_id TEXT;
    END IF;
END $$;

-- Update supplierId column type from integer to text (if it was a relationship)
-- First check if it exists as integer, then alter it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inbound_inventory' 
        AND column_name = 'supplier_id'
        AND data_type = 'integer'
    ) THEN
        -- Convert existing integer IDs to text format (assuming they're from customers collection)
        -- This is a data migration - adjust based on your actual data
        ALTER TABLE inbound_inventory 
        ALTER COLUMN supplier_id TYPE TEXT USING 
            CASE 
                WHEN supplier_id IS NOT NULL THEN 'customers:' || supplier_id::TEXT
                ELSE NULL
            END;
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inbound_inventory' 
        AND column_name = 'supplier_id'
    ) THEN
        ALTER TABLE inbound_inventory ADD COLUMN supplier_id TEXT;
    END IF;
END $$;

