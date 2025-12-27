-- Migration: Add collection fields for routing polymorphic relationships
-- This migration adds collection tracking fields for location relationships in import container bookings

-- Add collection fields for fullRouting group
ALTER TABLE import_container_bookings
ADD COLUMN IF NOT EXISTS full_routing_pickup_location_collection TEXT,
ADD COLUMN IF NOT EXISTS full_routing_dropoff_location_collection TEXT,
ADD COLUMN IF NOT EXISTS full_routing_via_locations_collections JSONB;

-- Add collection fields for emptyRouting group
ALTER TABLE import_container_bookings
ADD COLUMN IF NOT EXISTS empty_routing_dropoff_location_collection TEXT,
ADD COLUMN IF NOT EXISTS empty_routing_via_locations_collections JSONB;

-- Add comments for documentation
COMMENT ON COLUMN import_container_bookings.full_routing_pickup_location_collection IS 'Collection type for fullRouting.pickupLocationId (customers, paying-customers, empty-parks, wharves)';
COMMENT ON COLUMN import_container_bookings.full_routing_dropoff_location_collection IS 'Collection type for fullRouting.dropoffLocationId (customers, paying-customers, empty-parks, wharves)';
COMMENT ON COLUMN import_container_bookings.full_routing_via_locations_collections IS 'Array of collection types for fullRouting.viaLocations (warehouses, wharves, empty-parks)';
COMMENT ON COLUMN import_container_bookings.empty_routing_dropoff_location_collection IS 'Collection type for emptyRouting.dropoffLocationId (customers, paying-customers, empty-parks, wharves)';
COMMENT ON COLUMN import_container_bookings.empty_routing_via_locations_collections IS 'Array of collection types for emptyRouting.viaLocations (warehouses, wharves, empty-parks)';

