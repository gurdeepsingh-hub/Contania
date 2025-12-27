-- Migration: Add missing routing location ID columns for polymorphic relationships
-- This migration adds the ID fields for location relationships in import container bookings
-- The collection fields already exist from a previous migration

-- Add ID columns for fullRouting group
ALTER TABLE import_container_bookings
ADD COLUMN IF NOT EXISTS full_routing_pickup_location_id INTEGER,
ADD COLUMN IF NOT EXISTS full_routing_dropoff_location_id INTEGER,
ADD COLUMN IF NOT EXISTS full_routing_via_locations INTEGER[];

-- Add ID columns for emptyRouting group
ALTER TABLE import_container_bookings
ADD COLUMN IF NOT EXISTS empty_routing_dropoff_location_id INTEGER,
ADD COLUMN IF NOT EXISTS empty_routing_via_locations INTEGER[];

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_import_bookings_full_pickup_loc 
ON import_container_bookings(full_routing_pickup_location_id) 
WHERE full_routing_pickup_location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_import_bookings_full_dropoff_loc 
ON import_container_bookings(full_routing_dropoff_location_id) 
WHERE full_routing_dropoff_location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_import_bookings_empty_dropoff_loc 
ON import_container_bookings(empty_routing_dropoff_location_id) 
WHERE empty_routing_dropoff_location_id IS NOT NULL;

-- Add indexes for via locations arrays using GIN
CREATE INDEX IF NOT EXISTS idx_import_bookings_full_via_locs 
ON import_container_bookings USING GIN(full_routing_via_locations) 
WHERE full_routing_via_locations IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_import_bookings_empty_via_locs 
ON import_container_bookings USING GIN(empty_routing_via_locations) 
WHERE empty_routing_via_locations IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN import_container_bookings.full_routing_pickup_location_id IS 
'Pickup location ID for full container routing (polymorphic - collection determined by full_routing_pickup_location_collection field)';

COMMENT ON COLUMN import_container_bookings.full_routing_dropoff_location_id IS 
'Dropoff location ID for full container routing (polymorphic - collection determined by full_routing_dropoff_location_collection field)';

COMMENT ON COLUMN import_container_bookings.full_routing_via_locations IS 
'Array of via location IDs for full container routing (polymorphic - collections determined by full_routing_via_locations_collections field)';

COMMENT ON COLUMN import_container_bookings.empty_routing_dropoff_location_id IS 
'Dropoff location ID for empty container routing (polymorphic - collection determined by empty_routing_dropoff_location_collection field)';

COMMENT ON COLUMN import_container_bookings.empty_routing_via_locations IS 
'Array of via location IDs for empty container routing (polymorphic - collections determined by empty_routing_via_locations_collections field)';

-- Note: These are polymorphic relationships where the ID can refer to different tables
-- The corresponding *_collection field indicates which table the ID refers to
-- Allowed collections:
--   - full_routing_pickup_location_id: customers, paying-customers, empty-parks, wharves
--   - full_routing_dropoff_location_id: customers, paying-customers, empty-parks, wharves
--   - full_routing_via_locations: warehouses, wharves, empty-parks
--   - empty_routing_dropoff_location_id: customers, paying-customers, empty-parks, wharves
--   - empty_routing_via_locations: warehouses, wharves, empty-parks

