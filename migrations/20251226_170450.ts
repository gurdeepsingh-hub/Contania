import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('superadmin');
  CREATE TYPE "public"."enum_users_status" AS ENUM('active', 'inactive');
  CREATE TYPE "public"."enum_tenants_data_region" AS ENUM('ap-southeast-2', 'us-east-1', 'eu-central-1');
  CREATE TYPE "public"."enum_tenants_status" AS ENUM('pending', 'needs_correction', 'approved', 'rejected');
  CREATE TYPE "public"."enum_tenant_users_user_group" AS ENUM('Admin', 'Dispatcher', 'Driver', 'Manager');
  CREATE TYPE "public"."enum_tenant_users_status" AS ENUM('active', 'suspended');
  CREATE TYPE "public"."enum_storage_units_whsto_charge_by" AS ENUM('LPN', 'weight', 'cubic', 'sqm');
  CREATE TYPE "public"."enum_skus_receive_h_u" AS ENUM('YES', 'NO');
  CREATE TYPE "public"."enum_skus_pick_h_u" AS ENUM('YES', 'NO');
  CREATE TYPE "public"."enum_skus_pick_strategy" AS ENUM('FIFO', 'FEFO');
  CREATE TYPE "public"."enum_warehouses_type" AS ENUM('Depot', 'Warehouse');
  CREATE TYPE "public"."enum_stores_zone_type" AS ENUM('Indock', 'Outdock', 'Storage');
  CREATE TYPE "public"."enum_inbound_inventory_transport_mode" AS ENUM('our', 'third_party');
  CREATE TYPE "public"."enum_put_away_stock_allocation_status" AS ENUM('available', 'reserved', 'allocated', 'picked', 'dispatched');
  CREATE TYPE "public"."enum_outbound_inventory_status" AS ENUM('draft', 'partially_allocated', 'allocated', 'ready_to_pick', 'partially_picked', 'picked', 'ready_to_dispatch');
  CREATE TYPE "public"."enum_pickup_stock_pickup_status" AS ENUM('draft', 'completed', 'cancelled');
  CREATE TYPE "public"."enum_trailer_types_trailer_a_teu_capacity" AS ENUM('0', '1', '2');
  CREATE TYPE "public"."enum_trailer_types_trailer_b_teu_capacity" AS ENUM('0', '1', '2');
  CREATE TYPE "public"."enum_drivers_employee_type" AS ENUM('Casual', 'Permanent');
  CREATE TYPE "public"."enum_shipping_lines_calculate_import_free_days_using" AS ENUM('availability_date', 'first_free_import_date', 'discharge_date', 'full_gate_out');
  CREATE TYPE "public"."enum_container_weights_attribute" AS ENUM('HC', 'RF', 'GP', 'TK', 'OT');
  CREATE TYPE "public"."enum_damage_codes_freight_type" AS ENUM('Container', 'General', 'Warehouse');
  CREATE TYPE "public"."enum_detention_control_container_type" AS ENUM('RF', 'DRY');
  CREATE TYPE "public"."enum_vessels_job_type" AS ENUM('import', 'export');
  CREATE TYPE "public"."enum_import_container_bookings_status" AS ENUM('draft', 'confirmed', 'in_progress', 'completed', 'cancelled');
  CREATE TYPE "public"."enum_export_container_bookings_status" AS ENUM('draft', 'confirmed', 'in_progress', 'completed', 'cancelled');
  CREATE TYPE "public"."enum_container_stock_allocations_stage" AS ENUM('allocated', 'picked', 'dispatched', 'expected', 'received', 'put_away');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"full_name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'superadmin',
  	"status" "enum_users_status" DEFAULT 'active',
  	"last_login_at" timestamp(3) with time zone,
  	"deleted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "tenants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"company_name" varchar NOT NULL,
  	"full_name" varchar,
  	"abn" varchar,
  	"acn" varchar,
  	"website" varchar,
  	"scac" varchar,
  	"emails_account" varchar,
  	"emails_bookings" varchar,
  	"emails_management" varchar,
  	"emails_operations" varchar,
  	"emails_reply_to" varchar,
  	"address_street" varchar,
  	"address_city" varchar,
  	"address_state" varchar,
  	"address_postal_code" varchar,
  	"address_country_code" varchar,
  	"phone" varchar,
  	"fax" varchar,
  	"email" varchar NOT NULL,
  	"logo_id" integer,
  	"subdomain" varchar,
  	"approved" boolean DEFAULT false,
  	"approved_by_id" integer,
  	"verified" boolean DEFAULT false,
  	"verified_at" timestamp(3) with time zone,
  	"privacy_consent" boolean,
  	"terms_accepted_at" timestamp(3) with time zone,
  	"email_preferences_marketing" boolean DEFAULT false,
  	"email_preferences_updates" boolean DEFAULT false,
  	"email_preferences_system" boolean DEFAULT true,
  	"data_region" "enum_tenants_data_region",
  	"onboarding_step" varchar,
  	"status" "enum_tenants_status" DEFAULT 'pending',
  	"edit_token" varchar,
  	"edit_token_expires_at" timestamp(3) with time zone,
  	"revert_reason" varchar,
  	"deleted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tenant_users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "tenant_users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"username" varchar,
  	"full_name" varchar NOT NULL,
  	"phone_mobile" varchar,
  	"phone_fixed" varchar,
  	"ddi" varchar,
  	"position" varchar,
  	"role_id" integer NOT NULL,
  	"user_group" "enum_tenant_users_user_group",
  	"status" "enum_tenant_users_status" DEFAULT 'active',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "tenant_roles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"tenant_id_id" integer NOT NULL,
  	"is_system_role" boolean DEFAULT false,
  	"permissions_dashboard_view" boolean DEFAULT false,
  	"permissions_dashboard_edit" boolean DEFAULT false,
  	"permissions_containers_view" boolean DEFAULT false,
  	"permissions_containers_create" boolean DEFAULT false,
  	"permissions_containers_edit" boolean DEFAULT false,
  	"permissions_containers_delete" boolean DEFAULT false,
  	"permissions_inventory_view" boolean DEFAULT false,
  	"permissions_inventory_create" boolean DEFAULT false,
  	"permissions_inventory_edit" boolean DEFAULT false,
  	"permissions_inventory_delete" boolean DEFAULT false,
  	"permissions_transportation_view" boolean DEFAULT false,
  	"permissions_transportation_create" boolean DEFAULT false,
  	"permissions_transportation_edit" boolean DEFAULT false,
  	"permissions_transportation_delete" boolean DEFAULT false,
  	"permissions_freight_view" boolean DEFAULT false,
  	"permissions_freight_create" boolean DEFAULT false,
  	"permissions_freight_edit" boolean DEFAULT false,
  	"permissions_freight_delete" boolean DEFAULT false,
  	"permissions_map_view" boolean DEFAULT false,
  	"permissions_map_edit" boolean DEFAULT false,
  	"permissions_reports_view" boolean DEFAULT false,
  	"permissions_reports_create" boolean DEFAULT false,
  	"permissions_reports_delete" boolean DEFAULT false,
  	"permissions_settings_view" boolean DEFAULT false,
  	"permissions_settings_manage_users" boolean DEFAULT false,
  	"permissions_settings_manage_roles" boolean DEFAULT false,
  	"permissions_settings_entity_settings" boolean DEFAULT false,
  	"permissions_settings_user_settings" boolean DEFAULT false,
  	"permissions_settings_personalization" boolean DEFAULT false,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"customer_name" varchar NOT NULL,
  	"email" varchar,
  	"contact_name" varchar,
  	"contact_phone" varchar,
  	"street" varchar,
  	"city" varchar,
  	"state" varchar,
  	"postcode" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "handling_units" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"abbreviation" varchar,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "storage_units" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"abbreviation" varchar,
  	"name" varchar NOT NULL,
  	"pallet_spaces" numeric,
  	"lengthpersu_mm" numeric,
  	"widthpersu_mm" numeric,
  	"whsto_charge_by" "enum_storage_units_whsto_charge_by",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "skus" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"sku_code" varchar NOT NULL,
  	"description" varchar,
  	"customer_id_id" integer,
  	"storage_unit_id_id" integer NOT NULL,
  	"handling_unit_id_id" integer NOT NULL,
  	"pallet_spaces_of_storage_unit" numeric,
  	"hu_per_su" numeric,
  	"receive_h_u" "enum_skus_receive_h_u",
  	"pick_h_u" "enum_skus_pick_h_u",
  	"pick_strategy" "enum_skus_pick_strategy",
  	"lengthperhu_mm" numeric,
  	"widthperhu_mm" numeric,
  	"heightperhu_mm" numeric,
  	"weightperhu_kg" numeric,
  	"cases_per_layer" numeric,
  	"layers_per_pallet" numeric,
  	"cases_per_pallet" numeric,
  	"eachs_per_case" numeric,
  	"is_expriy" boolean DEFAULT false,
  	"is_attribute1" boolean DEFAULT false,
  	"is_attribute2" boolean DEFAULT false,
  	"expiry_date" timestamp(3) with time zone,
  	"attribute1" varchar,
  	"attribute2" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "paying_customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"customer_name" varchar NOT NULL,
  	"abn" varchar,
  	"email" varchar,
  	"contact_name" varchar,
  	"contact_phone" varchar,
  	"billing_street" varchar,
  	"billing_city" varchar,
  	"billing_state" varchar,
  	"billing_postcode" varchar,
  	"delivery_same_as_billing" boolean DEFAULT false,
  	"delivery_street" varchar,
  	"delivery_city" varchar,
  	"delivery_state" varchar,
  	"delivery_postcode" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "warehouses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar,
  	"contact_name" varchar,
  	"contact_phone" varchar,
  	"street" varchar,
  	"city" varchar,
  	"state" varchar,
  	"postcode" varchar,
  	"type" "enum_warehouses_type",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "stores" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"warehouse_id_id" integer NOT NULL,
  	"store_name" varchar NOT NULL,
  	"countable" boolean DEFAULT false,
  	"zone_type" "enum_stores_zone_type" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "transport_companies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"contact" varchar,
  	"mobile" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "inbound_inventory" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"job_code" varchar NOT NULL,
  	"expected_date" timestamp(3) with time zone,
  	"completed_date" timestamp(3) with time zone,
  	"delivery_customer_reference_number" varchar,
  	"ordering_customer_reference_number" varchar,
  	"delivery_customer_id" varchar,
  	"notes" varchar,
  	"transport_mode" "enum_inbound_inventory_transport_mode",
  	"warehouse_id_id" integer,
  	"customer_name" varchar,
  	"customer_address" varchar,
  	"customer_location" varchar,
  	"customer_state" varchar,
  	"customer_contact_name" varchar,
  	"supplier_id" varchar,
  	"supplier_name" varchar,
  	"supplier_address" varchar,
  	"supplier_location" varchar,
  	"supplier_state" varchar,
  	"supplier_contact_name" varchar,
  	"transport_company_id_id" integer,
  	"transport_contact" varchar,
  	"transport_mobile" varchar,
  	"chep" numeric,
  	"loscam" numeric,
  	"plain" numeric,
  	"pallet_transfer_docket" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "inbound_product_line" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"inbound_inventory_id_id" integer NOT NULL,
  	"sku_id_id" integer,
  	"sku_description" varchar,
  	"batch_number" varchar,
  	"lpn_qty" varchar,
  	"sqm_per_s_u" numeric,
  	"expected_qty" numeric,
  	"recieved_qty" numeric,
  	"expected_weight" numeric,
  	"recieved_weight" numeric,
  	"pallet_spaces" numeric,
  	"weight_per_h_u" numeric,
  	"expected_cubic_per_h_u" numeric,
  	"recieved_cubic_per_h_u" numeric,
  	"expiry_date" timestamp(3) with time zone,
  	"attribute1" varchar,
  	"attribute2" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "put_away_stock" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"lpn_number" varchar NOT NULL,
  	"inbound_inventory_id_id" integer NOT NULL,
  	"inbound_product_line_id_id" integer NOT NULL,
  	"sku_id_id" integer NOT NULL,
  	"warehouse_id_id" integer NOT NULL,
  	"location" varchar NOT NULL,
  	"hu_qty" numeric NOT NULL,
  	"outbound_inventory_id_id" integer,
  	"outbound_product_line_id_id" integer,
  	"allocation_status" "enum_put_away_stock_allocation_status" DEFAULT 'available',
  	"allocated_at" timestamp(3) with time zone,
  	"allocated_by_id" integer,
  	"is_deleted" boolean DEFAULT false,
  	"deleted_at" timestamp(3) with time zone,
  	"deleted_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "outbound_inventory" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"job_code" varchar NOT NULL,
  	"status" "enum_outbound_inventory_status" DEFAULT 'draft',
  	"customer_ref_number" varchar NOT NULL,
  	"consignee_ref_number" varchar NOT NULL,
  	"container_number" varchar,
  	"inspection_number" varchar,
  	"warehouse_id_id" integer NOT NULL,
  	"inbound_job_number" varchar,
  	"customer_id" varchar,
  	"customer_name" varchar,
  	"customer_location" varchar,
  	"customer_state" varchar,
  	"customer_contact" varchar,
  	"customer_to_id" varchar,
  	"customer_to_name" varchar,
  	"customer_to_location" varchar,
  	"customer_to_state" varchar,
  	"customer_to_contact" varchar,
  	"customer_from_id" varchar,
  	"customer_from_name" varchar,
  	"customer_from_location" varchar,
  	"customer_from_state" varchar,
  	"customer_from_contact" varchar,
  	"required_date_time" timestamp(3) with time zone,
  	"order_notes" varchar,
  	"pallet_count" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "outbound_product_line_lpn" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"lpn_number" varchar NOT NULL
  );
  
  CREATE TABLE "outbound_product_line" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"outbound_inventory_id_id" integer NOT NULL,
  	"sku_id_id" integer,
  	"sku_description" varchar,
  	"batch_number" varchar,
  	"lpn_qty" varchar,
  	"sqm_per_s_u" numeric,
  	"expected_qty" numeric,
  	"picked_qty" numeric,
  	"expected_weight" numeric,
  	"picked_weight" numeric,
  	"weight_per_h_u" numeric,
  	"expected_cubic_per_h_u" numeric,
  	"picked_cubic_per_h_u" numeric,
  	"allocated_qty" numeric,
  	"allocated_weight" numeric,
  	"allocated_cubic_per_h_u" numeric,
  	"plt_qty" numeric,
  	"location" varchar,
  	"expiry_date" timestamp(3) with time zone,
  	"attribute1" varchar,
  	"attribute2" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pickup_stock_picked_up_l_p_ns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"lpn_id_id" integer NOT NULL,
  	"lpn_number" varchar NOT NULL,
  	"hu_qty" numeric NOT NULL,
  	"location" varchar
  );
  
  CREATE TABLE "pickup_stock" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"outbound_inventory_id_id" integer NOT NULL,
  	"outbound_product_line_id_id" integer NOT NULL,
  	"picked_up_qty" numeric NOT NULL,
  	"buffer_qty" numeric DEFAULT 0,
  	"final_picked_up_qty" numeric NOT NULL,
  	"pickup_status" "enum_pickup_stock_pickup_status" DEFAULT 'draft',
  	"picked_up_by_id" integer NOT NULL,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "trailer_types" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"max_weight_kg" numeric,
  	"max_cubic_m3" numeric,
  	"max_pallet" numeric,
  	"trailer_a" boolean DEFAULT false,
  	"trailer_b" boolean DEFAULT false,
  	"trailer_c" boolean DEFAULT false,
  	"trailer_a_enabled" boolean DEFAULT false,
  	"trailer_a_max_weight" numeric,
  	"trailer_a_teu_capacity" "enum_trailer_types_trailer_a_teu_capacity",
  	"trailer_b_enabled" boolean DEFAULT false,
  	"trailer_b_max_weight" numeric,
  	"trailer_b_teu_capacity" "enum_trailer_types_trailer_b_teu_capacity",
  	"max_teu_capacity" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "trailers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"fleet_number" varchar NOT NULL,
  	"rego" varchar NOT NULL,
  	"rego_expiry_date" timestamp(3) with time zone,
  	"trailer_type_id_id" integer,
  	"max_weight_kg" numeric,
  	"max_cube_m3" numeric,
  	"max_pallet" numeric,
  	"default_warehouse_id_id" integer,
  	"dangerous_cert_number" varchar,
  	"dangerous_cert_expiry" timestamp(3) with time zone,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "vehicles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"fleet_number" varchar NOT NULL,
  	"rego" varchar NOT NULL,
  	"rego_expiry_date" timestamp(3) with time zone,
  	"gps_id" varchar,
  	"description" varchar,
  	"default_depot_id_id" integer,
  	"a_trailer_id_id" integer,
  	"b_trailer_id_id" integer,
  	"c_trailer_id_id" integer,
  	"default_trailer_combination_id_id" integer,
  	"sideloader" boolean DEFAULT false NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "drivers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"phone_number" varchar NOT NULL,
  	"vehicle_id_id" integer,
  	"default_depot_id_id" integer,
  	"abn" varchar,
  	"address_street" varchar,
  	"city" varchar,
  	"state" varchar,
  	"postcode" varchar,
  	"employee_type" "enum_drivers_employee_type" NOT NULL,
  	"driving_licence_number" varchar NOT NULL,
  	"licence_expiry" timestamp(3) with time zone,
  	"licence_photo_url_id" integer,
  	"dangerous_goods_cert_number" varchar,
  	"dangerous_goods_cert_expiry" timestamp(3) with time zone,
  	"msic_number" varchar,
  	"msic_expiry" timestamp(3) with time zone,
  	"msic_photo_url_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "delay_points" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar,
  	"contact_name" varchar,
  	"contact_phone_number" varchar,
  	"address_street" varchar,
  	"address_city" varchar,
  	"address_state" varchar,
  	"address_postcode" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "empty_parks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar,
  	"contact_name" varchar,
  	"contact_phone_number" varchar,
  	"address_street" varchar,
  	"address_city" varchar,
  	"address_state" varchar,
  	"address_postcode" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "shipping_lines" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar,
  	"contact_name" varchar,
  	"contact_phone_number" varchar,
  	"address_street" varchar,
  	"address_city" varchar,
  	"address_state" varchar,
  	"address_postcode" varchar,
  	"import_free_days" numeric,
  	"calculate_import_free_days_using" "enum_shipping_lines_calculate_import_free_days_using",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "wharves" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar,
  	"contact_name" varchar,
  	"contact_phone_number" varchar,
  	"address_street" varchar,
  	"address_city" varchar,
  	"address_state" varchar,
  	"address_postcode" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "container_sizes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"size" varchar NOT NULL,
  	"code" varchar,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "container_weights" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"size" varchar NOT NULL,
  	"attribute" "enum_container_weights_attribute" NOT NULL,
  	"weight" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "damage_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"freight_type" "enum_damage_codes_freight_type" NOT NULL,
  	"reason" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "detention_control" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"shipping_line_id_id" integer NOT NULL,
  	"container_type" "enum_detention_control_container_type" NOT NULL,
  	"calculate_import_free_days_using" varchar,
  	"import_free_days" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "vessels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"vessel_name" varchar NOT NULL,
  	"voyage_number" varchar,
  	"lloyds_number" varchar,
  	"wharf_id_id" integer,
  	"job_type" "enum_vessels_job_type" NOT NULL,
  	"eta" timestamp(3) with time zone,
  	"availability" timestamp(3) with time zone,
  	"storage_start" timestamp(3) with time zone,
  	"first_free_import_date" timestamp(3) with time zone,
  	"etd" timestamp(3) with time zone,
  	"receival_start" timestamp(3) with time zone,
  	"cutoff" timestamp(3) with time zone,
  	"reefer_cutoff" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "import_container_bookings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"booking_code" varchar NOT NULL,
  	"status" "enum_import_container_bookings_status" DEFAULT 'draft' NOT NULL,
  	"customer_reference" varchar NOT NULL,
  	"booking_reference" varchar NOT NULL,
  	"charge_to_collection" varchar,
  	"charge_to_contact_name" varchar,
  	"charge_to_contact_number" varchar,
  	"consignee_id_id" integer NOT NULL,
  	"vessel_id_id" integer,
  	"eta" timestamp(3) with time zone,
  	"availability" boolean,
  	"storage_start" timestamp(3) with time zone,
  	"first_free_import_date" timestamp(3) with time zone,
  	"from_collection" varchar,
  	"from_address" varchar,
  	"from_city" varchar,
  	"from_state" varchar,
  	"from_postcode" varchar,
  	"to_collection" varchar,
  	"to_address" varchar,
  	"to_city" varchar,
  	"to_state" varchar,
  	"to_postcode" varchar,
  	"container_quantities" jsonb,
  	"full_routing_pickup_location_collection" varchar,
  	"full_routing_pickup_date" timestamp(3) with time zone,
  	"full_routing_via_locations_collections" jsonb,
  	"full_routing_dropoff_location_collection" varchar,
  	"full_routing_dropoff_date" timestamp(3) with time zone,
  	"empty_routing_shipping_line_id_id" integer,
  	"empty_routing_pickup_location_id_id" integer,
  	"empty_routing_pickup_date" timestamp(3) with time zone,
  	"empty_routing_via_locations_collections" jsonb,
  	"empty_routing_dropoff_location_collection" varchar,
  	"empty_routing_dropoff_date" timestamp(3) with time zone,
  	"empty_routing_requested_delivery_date" timestamp(3) with time zone,
  	"instructions" varchar,
  	"job_notes" varchar,
  	"driver_allocation" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "import_container_bookings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"paying_customers_id" integer,
  	"customers_id" integer,
  	"empty_parks_id" integer,
  	"wharves_id" integer,
  	"container_sizes_id" integer,
  	"warehouses_id" integer
  );
  
  CREATE TABLE "export_container_bookings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id_id" integer NOT NULL,
  	"booking_code" varchar NOT NULL,
  	"status" "enum_export_container_bookings_status" DEFAULT 'draft' NOT NULL,
  	"customer_reference" varchar NOT NULL,
  	"booking_reference" varchar NOT NULL,
  	"charge_to_collection" varchar,
  	"charge_to_contact_name" varchar,
  	"charge_to_contact_number" varchar,
  	"consignor_id_id" integer NOT NULL,
  	"vessel_id_id" integer,
  	"etd" timestamp(3) with time zone,
  	"receival_start" timestamp(3) with time zone,
  	"cutoff" boolean,
  	"from_collection" varchar,
  	"from_address" varchar,
  	"from_city" varchar,
  	"from_state" varchar,
  	"from_postcode" varchar,
  	"to_collection" varchar,
  	"to_address" varchar,
  	"to_city" varchar,
  	"to_state" varchar,
  	"to_postcode" varchar,
  	"container_quantities" jsonb,
  	"empty_routing_shipping_line_id_id" integer,
  	"empty_routing_pickup_location_id_id" integer,
  	"empty_routing_pickup_date" timestamp(3) with time zone,
  	"empty_routing_dropoff_date" timestamp(3) with time zone,
  	"empty_routing_requested_delivery_date" timestamp(3) with time zone,
  	"full_routing_pickup_date" timestamp(3) with time zone,
  	"full_routing_dropoff_date" timestamp(3) with time zone,
  	"instructions" varchar,
  	"job_notes" varchar,
  	"release_number" varchar,
  	"weight" varchar,
  	"driver_allocation" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "export_container_bookings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"paying_customers_id" integer,
  	"customers_id" integer,
  	"empty_parks_id" integer,
  	"wharves_id" integer,
  	"container_sizes_id" integer,
  	"warehouses_id" integer
  );
  
  CREATE TABLE "container_details" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"container_number" varchar NOT NULL,
  	"container_size_id_id" integer NOT NULL,
  	"gross" varchar,
  	"tare" varchar,
  	"net" varchar,
  	"pin" varchar,
  	"wh_manifest" varchar,
  	"iso_code" varchar,
  	"time_slot" varchar,
  	"empty_time_slot" varchar,
  	"dehire_date" timestamp(3) with time zone,
  	"shipping_line_id_id" integer,
  	"country_of_origin" varchar,
  	"order_ref" varchar,
  	"job_availability" timestamp(3) with time zone,
  	"seal_number" varchar,
  	"customer_request_date" timestamp(3) with time zone,
  	"dock" varchar,
  	"confirmed_unpack_date" timestamp(3) with time zone,
  	"yard_location" varchar,
  	"secure_seals_intact" timestamp(3) with time zone,
  	"inspect_unpack" timestamp(3) with time zone,
  	"direction_type" varchar,
  	"house_bill_number" varchar,
  	"ocean_bill_number" varchar,
  	"vent_airflow" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "container_details_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"import_container_bookings_id" integer,
  	"export_container_bookings_id" integer
  );
  
  CREATE TABLE "container_stock_allocations_product_lines_lpn" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"lpn_number" varchar NOT NULL
  );
  
  CREATE TABLE "container_stock_allocations_product_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"sku_id_id" integer,
  	"sku_description" varchar,
  	"batch_number" varchar,
  	"lpn_qty" varchar,
  	"sqm_per_s_u" numeric,
  	"expected_qty" numeric,
  	"picked_qty" numeric,
  	"expected_weight" numeric,
  	"picked_weight" numeric,
  	"allocated_qty" numeric,
  	"allocated_weight" numeric,
  	"allocated_cubic_per_h_u" numeric,
  	"plt_qty" numeric,
  	"location" varchar,
  	"expected_qty_import" numeric,
  	"recieved_qty" numeric,
  	"expected_weight_import" numeric,
  	"recieved_weight" numeric,
  	"weight_per_h_u" numeric,
  	"expected_cubic_per_h_u" numeric,
  	"recieved_cubic_per_h_u" numeric,
  	"pallet_spaces" numeric,
  	"expiry_date" timestamp(3) with time zone,
  	"attribute1" varchar,
  	"attribute2" varchar
  );
  
  CREATE TABLE "container_stock_allocations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"container_detail_id_id" integer NOT NULL,
  	"stage" "enum_container_stock_allocations_stage" DEFAULT 'expected' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "container_stock_allocations_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"import_container_bookings_id" integer,
  	"export_container_bookings_id" integer
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"tenants_id" integer,
  	"tenant_users_id" integer,
  	"tenant_roles_id" integer,
  	"customers_id" integer,
  	"handling_units_id" integer,
  	"storage_units_id" integer,
  	"skus_id" integer,
  	"paying_customers_id" integer,
  	"warehouses_id" integer,
  	"stores_id" integer,
  	"transport_companies_id" integer,
  	"inbound_inventory_id" integer,
  	"inbound_product_line_id" integer,
  	"put_away_stock_id" integer,
  	"outbound_inventory_id" integer,
  	"outbound_product_line_id" integer,
  	"pickup_stock_id" integer,
  	"trailer_types_id" integer,
  	"trailers_id" integer,
  	"vehicles_id" integer,
  	"drivers_id" integer,
  	"delay_points_id" integer,
  	"empty_parks_id" integer,
  	"shipping_lines_id" integer,
  	"wharves_id" integer,
  	"container_sizes_id" integer,
  	"container_weights_id" integer,
  	"damage_codes_id" integer,
  	"detention_control_id" integer,
  	"vessels_id" integer,
  	"import_container_bookings_id" integer,
  	"export_container_bookings_id" integer,
  	"container_details_id" integer,
  	"container_stock_allocations_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"tenant_users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tenant_users_sessions" ADD CONSTRAINT "tenant_users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenant_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_role_id_tenant_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."tenant_roles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tenant_roles" ADD CONSTRAINT "tenant_roles_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "handling_units" ADD CONSTRAINT "handling_units_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "storage_units" ADD CONSTRAINT "storage_units_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "skus" ADD CONSTRAINT "skus_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "skus" ADD CONSTRAINT "skus_customer_id_id_customers_id_fk" FOREIGN KEY ("customer_id_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "skus" ADD CONSTRAINT "skus_storage_unit_id_id_storage_units_id_fk" FOREIGN KEY ("storage_unit_id_id") REFERENCES "public"."storage_units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "skus" ADD CONSTRAINT "skus_handling_unit_id_id_handling_units_id_fk" FOREIGN KEY ("handling_unit_id_id") REFERENCES "public"."handling_units"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "paying_customers" ADD CONSTRAINT "paying_customers_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stores" ADD CONSTRAINT "stores_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stores" ADD CONSTRAINT "stores_warehouse_id_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transport_companies" ADD CONSTRAINT "transport_companies_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inbound_inventory" ADD CONSTRAINT "inbound_inventory_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inbound_inventory" ADD CONSTRAINT "inbound_inventory_warehouse_id_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inbound_inventory" ADD CONSTRAINT "inbound_inventory_transport_company_id_id_transport_companies_id_fk" FOREIGN KEY ("transport_company_id_id") REFERENCES "public"."transport_companies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inbound_product_line" ADD CONSTRAINT "inbound_product_line_inbound_inventory_id_id_inbound_inventory_id_fk" FOREIGN KEY ("inbound_inventory_id_id") REFERENCES "public"."inbound_inventory"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inbound_product_line" ADD CONSTRAINT "inbound_product_line_sku_id_id_skus_id_fk" FOREIGN KEY ("sku_id_id") REFERENCES "public"."skus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "put_away_stock" ADD CONSTRAINT "put_away_stock_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "put_away_stock" ADD CONSTRAINT "put_away_stock_inbound_inventory_id_id_inbound_inventory_id_fk" FOREIGN KEY ("inbound_inventory_id_id") REFERENCES "public"."inbound_inventory"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "put_away_stock" ADD CONSTRAINT "put_away_stock_inbound_product_line_id_id_inbound_product_line_id_fk" FOREIGN KEY ("inbound_product_line_id_id") REFERENCES "public"."inbound_product_line"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "put_away_stock" ADD CONSTRAINT "put_away_stock_sku_id_id_skus_id_fk" FOREIGN KEY ("sku_id_id") REFERENCES "public"."skus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "put_away_stock" ADD CONSTRAINT "put_away_stock_warehouse_id_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "put_away_stock" ADD CONSTRAINT "put_away_stock_outbound_inventory_id_id_outbound_inventory_id_fk" FOREIGN KEY ("outbound_inventory_id_id") REFERENCES "public"."outbound_inventory"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "put_away_stock" ADD CONSTRAINT "put_away_stock_outbound_product_line_id_id_outbound_product_line_id_fk" FOREIGN KEY ("outbound_product_line_id_id") REFERENCES "public"."outbound_product_line"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "put_away_stock" ADD CONSTRAINT "put_away_stock_allocated_by_id_tenant_users_id_fk" FOREIGN KEY ("allocated_by_id") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "put_away_stock" ADD CONSTRAINT "put_away_stock_deleted_by_id_tenant_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "outbound_inventory" ADD CONSTRAINT "outbound_inventory_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "outbound_inventory" ADD CONSTRAINT "outbound_inventory_warehouse_id_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "outbound_product_line_lpn" ADD CONSTRAINT "outbound_product_line_lpn_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."outbound_product_line"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "outbound_product_line" ADD CONSTRAINT "outbound_product_line_outbound_inventory_id_id_outbound_inventory_id_fk" FOREIGN KEY ("outbound_inventory_id_id") REFERENCES "public"."outbound_inventory"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "outbound_product_line" ADD CONSTRAINT "outbound_product_line_sku_id_id_skus_id_fk" FOREIGN KEY ("sku_id_id") REFERENCES "public"."skus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pickup_stock_picked_up_l_p_ns" ADD CONSTRAINT "pickup_stock_picked_up_l_p_ns_lpn_id_id_put_away_stock_id_fk" FOREIGN KEY ("lpn_id_id") REFERENCES "public"."put_away_stock"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pickup_stock_picked_up_l_p_ns" ADD CONSTRAINT "pickup_stock_picked_up_l_p_ns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pickup_stock"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pickup_stock" ADD CONSTRAINT "pickup_stock_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pickup_stock" ADD CONSTRAINT "pickup_stock_outbound_inventory_id_id_outbound_inventory_id_fk" FOREIGN KEY ("outbound_inventory_id_id") REFERENCES "public"."outbound_inventory"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pickup_stock" ADD CONSTRAINT "pickup_stock_outbound_product_line_id_id_outbound_product_line_id_fk" FOREIGN KEY ("outbound_product_line_id_id") REFERENCES "public"."outbound_product_line"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pickup_stock" ADD CONSTRAINT "pickup_stock_picked_up_by_id_tenant_users_id_fk" FOREIGN KEY ("picked_up_by_id") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trailer_types" ADD CONSTRAINT "trailer_types_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trailers" ADD CONSTRAINT "trailers_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trailers" ADD CONSTRAINT "trailers_trailer_type_id_id_trailer_types_id_fk" FOREIGN KEY ("trailer_type_id_id") REFERENCES "public"."trailer_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trailers" ADD CONSTRAINT "trailers_default_warehouse_id_id_warehouses_id_fk" FOREIGN KEY ("default_warehouse_id_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_default_depot_id_id_warehouses_id_fk" FOREIGN KEY ("default_depot_id_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_a_trailer_id_id_trailer_types_id_fk" FOREIGN KEY ("a_trailer_id_id") REFERENCES "public"."trailer_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_b_trailer_id_id_trailer_types_id_fk" FOREIGN KEY ("b_trailer_id_id") REFERENCES "public"."trailer_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_c_trailer_id_id_trailer_types_id_fk" FOREIGN KEY ("c_trailer_id_id") REFERENCES "public"."trailer_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_default_trailer_combination_id_id_trailer_types_id_fk" FOREIGN KEY ("default_trailer_combination_id_id") REFERENCES "public"."trailer_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "drivers" ADD CONSTRAINT "drivers_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "drivers" ADD CONSTRAINT "drivers_vehicle_id_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "drivers" ADD CONSTRAINT "drivers_default_depot_id_id_warehouses_id_fk" FOREIGN KEY ("default_depot_id_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "drivers" ADD CONSTRAINT "drivers_licence_photo_url_id_media_id_fk" FOREIGN KEY ("licence_photo_url_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "drivers" ADD CONSTRAINT "drivers_msic_photo_url_id_media_id_fk" FOREIGN KEY ("msic_photo_url_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "delay_points" ADD CONSTRAINT "delay_points_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "empty_parks" ADD CONSTRAINT "empty_parks_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "shipping_lines" ADD CONSTRAINT "shipping_lines_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wharves" ADD CONSTRAINT "wharves_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "container_sizes" ADD CONSTRAINT "container_sizes_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "container_weights" ADD CONSTRAINT "container_weights_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "damage_codes" ADD CONSTRAINT "damage_codes_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "detention_control" ADD CONSTRAINT "detention_control_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "detention_control" ADD CONSTRAINT "detention_control_shipping_line_id_id_shipping_lines_id_fk" FOREIGN KEY ("shipping_line_id_id") REFERENCES "public"."shipping_lines"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vessels" ADD CONSTRAINT "vessels_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vessels" ADD CONSTRAINT "vessels_wharf_id_id_wharves_id_fk" FOREIGN KEY ("wharf_id_id") REFERENCES "public"."wharves"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "import_container_bookings" ADD CONSTRAINT "import_container_bookings_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "import_container_bookings" ADD CONSTRAINT "import_container_bookings_consignee_id_id_customers_id_fk" FOREIGN KEY ("consignee_id_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "import_container_bookings" ADD CONSTRAINT "import_container_bookings_vessel_id_id_vessels_id_fk" FOREIGN KEY ("vessel_id_id") REFERENCES "public"."vessels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "import_container_bookings" ADD CONSTRAINT "import_container_bookings_empty_routing_shipping_line_id_id_shipping_lines_id_fk" FOREIGN KEY ("empty_routing_shipping_line_id_id") REFERENCES "public"."shipping_lines"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "import_container_bookings" ADD CONSTRAINT "import_container_bookings_empty_routing_pickup_location_id_id_empty_parks_id_fk" FOREIGN KEY ("empty_routing_pickup_location_id_id") REFERENCES "public"."empty_parks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "import_container_bookings_rels" ADD CONSTRAINT "import_container_bookings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."import_container_bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "import_container_bookings_rels" ADD CONSTRAINT "import_container_bookings_rels_paying_customers_fk" FOREIGN KEY ("paying_customers_id") REFERENCES "public"."paying_customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "import_container_bookings_rels" ADD CONSTRAINT "import_container_bookings_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "import_container_bookings_rels" ADD CONSTRAINT "import_container_bookings_rels_empty_parks_fk" FOREIGN KEY ("empty_parks_id") REFERENCES "public"."empty_parks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "import_container_bookings_rels" ADD CONSTRAINT "import_container_bookings_rels_wharves_fk" FOREIGN KEY ("wharves_id") REFERENCES "public"."wharves"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "import_container_bookings_rels" ADD CONSTRAINT "import_container_bookings_rels_container_sizes_fk" FOREIGN KEY ("container_sizes_id") REFERENCES "public"."container_sizes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "import_container_bookings_rels" ADD CONSTRAINT "import_container_bookings_rels_warehouses_fk" FOREIGN KEY ("warehouses_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "export_container_bookings" ADD CONSTRAINT "export_container_bookings_tenant_id_id_tenants_id_fk" FOREIGN KEY ("tenant_id_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "export_container_bookings" ADD CONSTRAINT "export_container_bookings_consignor_id_id_customers_id_fk" FOREIGN KEY ("consignor_id_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "export_container_bookings" ADD CONSTRAINT "export_container_bookings_vessel_id_id_vessels_id_fk" FOREIGN KEY ("vessel_id_id") REFERENCES "public"."vessels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "export_container_bookings" ADD CONSTRAINT "export_container_bookings_empty_routing_shipping_line_id_id_shipping_lines_id_fk" FOREIGN KEY ("empty_routing_shipping_line_id_id") REFERENCES "public"."shipping_lines"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "export_container_bookings" ADD CONSTRAINT "export_container_bookings_empty_routing_pickup_location_id_id_empty_parks_id_fk" FOREIGN KEY ("empty_routing_pickup_location_id_id") REFERENCES "public"."empty_parks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "export_container_bookings_rels" ADD CONSTRAINT "export_container_bookings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."export_container_bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "export_container_bookings_rels" ADD CONSTRAINT "export_container_bookings_rels_paying_customers_fk" FOREIGN KEY ("paying_customers_id") REFERENCES "public"."paying_customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "export_container_bookings_rels" ADD CONSTRAINT "export_container_bookings_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "export_container_bookings_rels" ADD CONSTRAINT "export_container_bookings_rels_empty_parks_fk" FOREIGN KEY ("empty_parks_id") REFERENCES "public"."empty_parks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "export_container_bookings_rels" ADD CONSTRAINT "export_container_bookings_rels_wharves_fk" FOREIGN KEY ("wharves_id") REFERENCES "public"."wharves"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "export_container_bookings_rels" ADD CONSTRAINT "export_container_bookings_rels_container_sizes_fk" FOREIGN KEY ("container_sizes_id") REFERENCES "public"."container_sizes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "export_container_bookings_rels" ADD CONSTRAINT "export_container_bookings_rels_warehouses_fk" FOREIGN KEY ("warehouses_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "container_details" ADD CONSTRAINT "container_details_container_size_id_id_container_sizes_id_fk" FOREIGN KEY ("container_size_id_id") REFERENCES "public"."container_sizes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "container_details" ADD CONSTRAINT "container_details_shipping_line_id_id_shipping_lines_id_fk" FOREIGN KEY ("shipping_line_id_id") REFERENCES "public"."shipping_lines"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "container_details_rels" ADD CONSTRAINT "container_details_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."container_details"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "container_details_rels" ADD CONSTRAINT "container_details_rels_import_container_bookings_fk" FOREIGN KEY ("import_container_bookings_id") REFERENCES "public"."import_container_bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "container_details_rels" ADD CONSTRAINT "container_details_rels_export_container_bookings_fk" FOREIGN KEY ("export_container_bookings_id") REFERENCES "public"."export_container_bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "container_stock_allocations_product_lines_lpn" ADD CONSTRAINT "container_stock_allocations_product_lines_lpn_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."container_stock_allocations_product_lines"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "container_stock_allocations_product_lines" ADD CONSTRAINT "container_stock_allocations_product_lines_sku_id_id_skus_id_fk" FOREIGN KEY ("sku_id_id") REFERENCES "public"."skus"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "container_stock_allocations_product_lines" ADD CONSTRAINT "container_stock_allocations_product_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."container_stock_allocations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "container_stock_allocations" ADD CONSTRAINT "container_stock_allocations_container_detail_id_id_container_details_id_fk" FOREIGN KEY ("container_detail_id_id") REFERENCES "public"."container_details"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "container_stock_allocations_rels" ADD CONSTRAINT "container_stock_allocations_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."container_stock_allocations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "container_stock_allocations_rels" ADD CONSTRAINT "container_stock_allocations_rels_import_container_booking_fk" FOREIGN KEY ("import_container_bookings_id") REFERENCES "public"."import_container_bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "container_stock_allocations_rels" ADD CONSTRAINT "container_stock_allocations_rels_export_container_booking_fk" FOREIGN KEY ("export_container_bookings_id") REFERENCES "public"."export_container_bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenants_fk" FOREIGN KEY ("tenants_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenant_users_fk" FOREIGN KEY ("tenant_users_id") REFERENCES "public"."tenant_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenant_roles_fk" FOREIGN KEY ("tenant_roles_id") REFERENCES "public"."tenant_roles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_handling_units_fk" FOREIGN KEY ("handling_units_id") REFERENCES "public"."handling_units"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_storage_units_fk" FOREIGN KEY ("storage_units_id") REFERENCES "public"."storage_units"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_skus_fk" FOREIGN KEY ("skus_id") REFERENCES "public"."skus"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_paying_customers_fk" FOREIGN KEY ("paying_customers_id") REFERENCES "public"."paying_customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_warehouses_fk" FOREIGN KEY ("warehouses_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stores_fk" FOREIGN KEY ("stores_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_transport_companies_fk" FOREIGN KEY ("transport_companies_id") REFERENCES "public"."transport_companies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inbound_inventory_fk" FOREIGN KEY ("inbound_inventory_id") REFERENCES "public"."inbound_inventory"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inbound_product_line_fk" FOREIGN KEY ("inbound_product_line_id") REFERENCES "public"."inbound_product_line"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_put_away_stock_fk" FOREIGN KEY ("put_away_stock_id") REFERENCES "public"."put_away_stock"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_outbound_inventory_fk" FOREIGN KEY ("outbound_inventory_id") REFERENCES "public"."outbound_inventory"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_outbound_product_line_fk" FOREIGN KEY ("outbound_product_line_id") REFERENCES "public"."outbound_product_line"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pickup_stock_fk" FOREIGN KEY ("pickup_stock_id") REFERENCES "public"."pickup_stock"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_trailer_types_fk" FOREIGN KEY ("trailer_types_id") REFERENCES "public"."trailer_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_trailers_fk" FOREIGN KEY ("trailers_id") REFERENCES "public"."trailers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vehicles_fk" FOREIGN KEY ("vehicles_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_drivers_fk" FOREIGN KEY ("drivers_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_delay_points_fk" FOREIGN KEY ("delay_points_id") REFERENCES "public"."delay_points"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_empty_parks_fk" FOREIGN KEY ("empty_parks_id") REFERENCES "public"."empty_parks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_shipping_lines_fk" FOREIGN KEY ("shipping_lines_id") REFERENCES "public"."shipping_lines"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wharves_fk" FOREIGN KEY ("wharves_id") REFERENCES "public"."wharves"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_container_sizes_fk" FOREIGN KEY ("container_sizes_id") REFERENCES "public"."container_sizes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_container_weights_fk" FOREIGN KEY ("container_weights_id") REFERENCES "public"."container_weights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_damage_codes_fk" FOREIGN KEY ("damage_codes_id") REFERENCES "public"."damage_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_detention_control_fk" FOREIGN KEY ("detention_control_id") REFERENCES "public"."detention_control"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vessels_fk" FOREIGN KEY ("vessels_id") REFERENCES "public"."vessels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_import_container_bookings_fk" FOREIGN KEY ("import_container_bookings_id") REFERENCES "public"."import_container_bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_export_container_bookings_fk" FOREIGN KEY ("export_container_bookings_id") REFERENCES "public"."export_container_bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_container_details_fk" FOREIGN KEY ("container_details_id") REFERENCES "public"."container_details"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_container_stock_allocations_fk" FOREIGN KEY ("container_stock_allocations_id") REFERENCES "public"."container_stock_allocations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_tenant_users_fk" FOREIGN KEY ("tenant_users_id") REFERENCES "public"."tenant_users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "tenants_logo_idx" ON "tenants" USING btree ("logo_id");
  CREATE UNIQUE INDEX "tenants_subdomain_idx" ON "tenants" USING btree ("subdomain");
  CREATE INDEX "tenants_approved_by_idx" ON "tenants" USING btree ("approved_by_id");
  CREATE UNIQUE INDEX "tenants_edit_token_idx" ON "tenants" USING btree ("edit_token");
  CREATE INDEX "tenants_updated_at_idx" ON "tenants" USING btree ("updated_at");
  CREATE INDEX "tenants_created_at_idx" ON "tenants" USING btree ("created_at");
  CREATE INDEX "tenant_users_sessions_order_idx" ON "tenant_users_sessions" USING btree ("_order");
  CREATE INDEX "tenant_users_sessions_parent_id_idx" ON "tenant_users_sessions" USING btree ("_parent_id");
  CREATE INDEX "tenant_users_tenant_id_idx" ON "tenant_users" USING btree ("tenant_id_id");
  CREATE INDEX "tenant_users_role_idx" ON "tenant_users" USING btree ("role_id");
  CREATE INDEX "tenant_users_updated_at_idx" ON "tenant_users" USING btree ("updated_at");
  CREATE INDEX "tenant_users_created_at_idx" ON "tenant_users" USING btree ("created_at");
  CREATE UNIQUE INDEX "tenant_users_email_idx" ON "tenant_users" USING btree ("email");
  CREATE INDEX "tenant_roles_tenant_id_idx" ON "tenant_roles" USING btree ("tenant_id_id");
  CREATE INDEX "tenant_roles_updated_at_idx" ON "tenant_roles" USING btree ("updated_at");
  CREATE INDEX "tenant_roles_created_at_idx" ON "tenant_roles" USING btree ("created_at");
  CREATE INDEX "customers_tenant_id_idx" ON "customers" USING btree ("tenant_id_id");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE INDEX "handling_units_tenant_id_idx" ON "handling_units" USING btree ("tenant_id_id");
  CREATE INDEX "handling_units_updated_at_idx" ON "handling_units" USING btree ("updated_at");
  CREATE INDEX "handling_units_created_at_idx" ON "handling_units" USING btree ("created_at");
  CREATE INDEX "storage_units_tenant_id_idx" ON "storage_units" USING btree ("tenant_id_id");
  CREATE INDEX "storage_units_updated_at_idx" ON "storage_units" USING btree ("updated_at");
  CREATE INDEX "storage_units_created_at_idx" ON "storage_units" USING btree ("created_at");
  CREATE INDEX "skus_tenant_id_idx" ON "skus" USING btree ("tenant_id_id");
  CREATE UNIQUE INDEX "skus_sku_code_idx" ON "skus" USING btree ("sku_code");
  CREATE INDEX "skus_customer_id_idx" ON "skus" USING btree ("customer_id_id");
  CREATE INDEX "skus_storage_unit_id_idx" ON "skus" USING btree ("storage_unit_id_id");
  CREATE INDEX "skus_handling_unit_id_idx" ON "skus" USING btree ("handling_unit_id_id");
  CREATE INDEX "skus_updated_at_idx" ON "skus" USING btree ("updated_at");
  CREATE INDEX "skus_created_at_idx" ON "skus" USING btree ("created_at");
  CREATE INDEX "paying_customers_tenant_id_idx" ON "paying_customers" USING btree ("tenant_id_id");
  CREATE INDEX "paying_customers_updated_at_idx" ON "paying_customers" USING btree ("updated_at");
  CREATE INDEX "paying_customers_created_at_idx" ON "paying_customers" USING btree ("created_at");
  CREATE INDEX "warehouses_tenant_id_idx" ON "warehouses" USING btree ("tenant_id_id");
  CREATE INDEX "warehouses_updated_at_idx" ON "warehouses" USING btree ("updated_at");
  CREATE INDEX "warehouses_created_at_idx" ON "warehouses" USING btree ("created_at");
  CREATE INDEX "stores_tenant_id_idx" ON "stores" USING btree ("tenant_id_id");
  CREATE INDEX "stores_warehouse_id_idx" ON "stores" USING btree ("warehouse_id_id");
  CREATE INDEX "stores_updated_at_idx" ON "stores" USING btree ("updated_at");
  CREATE INDEX "stores_created_at_idx" ON "stores" USING btree ("created_at");
  CREATE INDEX "transport_companies_tenant_id_idx" ON "transport_companies" USING btree ("tenant_id_id");
  CREATE INDEX "transport_companies_updated_at_idx" ON "transport_companies" USING btree ("updated_at");
  CREATE INDEX "transport_companies_created_at_idx" ON "transport_companies" USING btree ("created_at");
  CREATE INDEX "inbound_inventory_tenant_id_idx" ON "inbound_inventory" USING btree ("tenant_id_id");
  CREATE UNIQUE INDEX "inbound_inventory_job_code_idx" ON "inbound_inventory" USING btree ("job_code");
  CREATE INDEX "inbound_inventory_warehouse_id_idx" ON "inbound_inventory" USING btree ("warehouse_id_id");
  CREATE INDEX "inbound_inventory_transport_company_id_idx" ON "inbound_inventory" USING btree ("transport_company_id_id");
  CREATE INDEX "inbound_inventory_updated_at_idx" ON "inbound_inventory" USING btree ("updated_at");
  CREATE INDEX "inbound_inventory_created_at_idx" ON "inbound_inventory" USING btree ("created_at");
  CREATE INDEX "inbound_product_line_inbound_inventory_id_idx" ON "inbound_product_line" USING btree ("inbound_inventory_id_id");
  CREATE INDEX "inbound_product_line_sku_id_idx" ON "inbound_product_line" USING btree ("sku_id_id");
  CREATE INDEX "inbound_product_line_updated_at_idx" ON "inbound_product_line" USING btree ("updated_at");
  CREATE INDEX "inbound_product_line_created_at_idx" ON "inbound_product_line" USING btree ("created_at");
  CREATE INDEX "put_away_stock_tenant_id_idx" ON "put_away_stock" USING btree ("tenant_id_id");
  CREATE INDEX "put_away_stock_inbound_inventory_id_idx" ON "put_away_stock" USING btree ("inbound_inventory_id_id");
  CREATE INDEX "put_away_stock_inbound_product_line_id_idx" ON "put_away_stock" USING btree ("inbound_product_line_id_id");
  CREATE INDEX "put_away_stock_sku_id_idx" ON "put_away_stock" USING btree ("sku_id_id");
  CREATE INDEX "put_away_stock_warehouse_id_idx" ON "put_away_stock" USING btree ("warehouse_id_id");
  CREATE INDEX "put_away_stock_outbound_inventory_id_idx" ON "put_away_stock" USING btree ("outbound_inventory_id_id");
  CREATE INDEX "put_away_stock_outbound_product_line_id_idx" ON "put_away_stock" USING btree ("outbound_product_line_id_id");
  CREATE INDEX "put_away_stock_allocated_by_idx" ON "put_away_stock" USING btree ("allocated_by_id");
  CREATE INDEX "put_away_stock_deleted_by_idx" ON "put_away_stock" USING btree ("deleted_by_id");
  CREATE INDEX "put_away_stock_updated_at_idx" ON "put_away_stock" USING btree ("updated_at");
  CREATE INDEX "put_away_stock_created_at_idx" ON "put_away_stock" USING btree ("created_at");
  CREATE INDEX "outbound_inventory_tenant_id_idx" ON "outbound_inventory" USING btree ("tenant_id_id");
  CREATE UNIQUE INDEX "outbound_inventory_job_code_idx" ON "outbound_inventory" USING btree ("job_code");
  CREATE INDEX "outbound_inventory_warehouse_id_idx" ON "outbound_inventory" USING btree ("warehouse_id_id");
  CREATE INDEX "outbound_inventory_updated_at_idx" ON "outbound_inventory" USING btree ("updated_at");
  CREATE INDEX "outbound_inventory_created_at_idx" ON "outbound_inventory" USING btree ("created_at");
  CREATE INDEX "outbound_product_line_lpn_order_idx" ON "outbound_product_line_lpn" USING btree ("_order");
  CREATE INDEX "outbound_product_line_lpn_parent_id_idx" ON "outbound_product_line_lpn" USING btree ("_parent_id");
  CREATE INDEX "outbound_product_line_outbound_inventory_id_idx" ON "outbound_product_line" USING btree ("outbound_inventory_id_id");
  CREATE INDEX "outbound_product_line_sku_id_idx" ON "outbound_product_line" USING btree ("sku_id_id");
  CREATE INDEX "outbound_product_line_updated_at_idx" ON "outbound_product_line" USING btree ("updated_at");
  CREATE INDEX "outbound_product_line_created_at_idx" ON "outbound_product_line" USING btree ("created_at");
  CREATE INDEX "pickup_stock_picked_up_l_p_ns_order_idx" ON "pickup_stock_picked_up_l_p_ns" USING btree ("_order");
  CREATE INDEX "pickup_stock_picked_up_l_p_ns_parent_id_idx" ON "pickup_stock_picked_up_l_p_ns" USING btree ("_parent_id");
  CREATE INDEX "pickup_stock_picked_up_l_p_ns_lpn_id_idx" ON "pickup_stock_picked_up_l_p_ns" USING btree ("lpn_id_id");
  CREATE INDEX "pickup_stock_tenant_id_idx" ON "pickup_stock" USING btree ("tenant_id_id");
  CREATE INDEX "pickup_stock_outbound_inventory_id_idx" ON "pickup_stock" USING btree ("outbound_inventory_id_id");
  CREATE INDEX "pickup_stock_outbound_product_line_id_idx" ON "pickup_stock" USING btree ("outbound_product_line_id_id");
  CREATE INDEX "pickup_stock_picked_up_by_idx" ON "pickup_stock" USING btree ("picked_up_by_id");
  CREATE INDEX "pickup_stock_updated_at_idx" ON "pickup_stock" USING btree ("updated_at");
  CREATE INDEX "pickup_stock_created_at_idx" ON "pickup_stock" USING btree ("created_at");
  CREATE INDEX "trailer_types_tenant_id_idx" ON "trailer_types" USING btree ("tenant_id_id");
  CREATE INDEX "trailer_types_updated_at_idx" ON "trailer_types" USING btree ("updated_at");
  CREATE INDEX "trailer_types_created_at_idx" ON "trailer_types" USING btree ("created_at");
  CREATE INDEX "trailers_tenant_id_idx" ON "trailers" USING btree ("tenant_id_id");
  CREATE INDEX "trailers_trailer_type_id_idx" ON "trailers" USING btree ("trailer_type_id_id");
  CREATE INDEX "trailers_default_warehouse_id_idx" ON "trailers" USING btree ("default_warehouse_id_id");
  CREATE INDEX "trailers_updated_at_idx" ON "trailers" USING btree ("updated_at");
  CREATE INDEX "trailers_created_at_idx" ON "trailers" USING btree ("created_at");
  CREATE INDEX "vehicles_tenant_id_idx" ON "vehicles" USING btree ("tenant_id_id");
  CREATE INDEX "vehicles_default_depot_id_idx" ON "vehicles" USING btree ("default_depot_id_id");
  CREATE INDEX "vehicles_a_trailer_id_idx" ON "vehicles" USING btree ("a_trailer_id_id");
  CREATE INDEX "vehicles_b_trailer_id_idx" ON "vehicles" USING btree ("b_trailer_id_id");
  CREATE INDEX "vehicles_c_trailer_id_idx" ON "vehicles" USING btree ("c_trailer_id_id");
  CREATE INDEX "vehicles_default_trailer_combination_id_idx" ON "vehicles" USING btree ("default_trailer_combination_id_id");
  CREATE INDEX "vehicles_updated_at_idx" ON "vehicles" USING btree ("updated_at");
  CREATE INDEX "vehicles_created_at_idx" ON "vehicles" USING btree ("created_at");
  CREATE INDEX "drivers_tenant_id_idx" ON "drivers" USING btree ("tenant_id_id");
  CREATE INDEX "drivers_vehicle_id_idx" ON "drivers" USING btree ("vehicle_id_id");
  CREATE INDEX "drivers_default_depot_id_idx" ON "drivers" USING btree ("default_depot_id_id");
  CREATE INDEX "drivers_licence_photo_url_idx" ON "drivers" USING btree ("licence_photo_url_id");
  CREATE INDEX "drivers_msic_photo_url_idx" ON "drivers" USING btree ("msic_photo_url_id");
  CREATE INDEX "drivers_updated_at_idx" ON "drivers" USING btree ("updated_at");
  CREATE INDEX "drivers_created_at_idx" ON "drivers" USING btree ("created_at");
  CREATE INDEX "delay_points_tenant_id_idx" ON "delay_points" USING btree ("tenant_id_id");
  CREATE INDEX "delay_points_updated_at_idx" ON "delay_points" USING btree ("updated_at");
  CREATE INDEX "delay_points_created_at_idx" ON "delay_points" USING btree ("created_at");
  CREATE INDEX "empty_parks_tenant_id_idx" ON "empty_parks" USING btree ("tenant_id_id");
  CREATE INDEX "empty_parks_updated_at_idx" ON "empty_parks" USING btree ("updated_at");
  CREATE INDEX "empty_parks_created_at_idx" ON "empty_parks" USING btree ("created_at");
  CREATE INDEX "shipping_lines_tenant_id_idx" ON "shipping_lines" USING btree ("tenant_id_id");
  CREATE INDEX "shipping_lines_updated_at_idx" ON "shipping_lines" USING btree ("updated_at");
  CREATE INDEX "shipping_lines_created_at_idx" ON "shipping_lines" USING btree ("created_at");
  CREATE INDEX "wharves_tenant_id_idx" ON "wharves" USING btree ("tenant_id_id");
  CREATE INDEX "wharves_updated_at_idx" ON "wharves" USING btree ("updated_at");
  CREATE INDEX "wharves_created_at_idx" ON "wharves" USING btree ("created_at");
  CREATE INDEX "container_sizes_tenant_id_idx" ON "container_sizes" USING btree ("tenant_id_id");
  CREATE UNIQUE INDEX "container_sizes_code_idx" ON "container_sizes" USING btree ("code");
  CREATE INDEX "container_sizes_updated_at_idx" ON "container_sizes" USING btree ("updated_at");
  CREATE INDEX "container_sizes_created_at_idx" ON "container_sizes" USING btree ("created_at");
  CREATE INDEX "container_weights_tenant_id_idx" ON "container_weights" USING btree ("tenant_id_id");
  CREATE INDEX "container_weights_updated_at_idx" ON "container_weights" USING btree ("updated_at");
  CREATE INDEX "container_weights_created_at_idx" ON "container_weights" USING btree ("created_at");
  CREATE INDEX "damage_codes_tenant_id_idx" ON "damage_codes" USING btree ("tenant_id_id");
  CREATE INDEX "damage_codes_updated_at_idx" ON "damage_codes" USING btree ("updated_at");
  CREATE INDEX "damage_codes_created_at_idx" ON "damage_codes" USING btree ("created_at");
  CREATE INDEX "detention_control_tenant_id_idx" ON "detention_control" USING btree ("tenant_id_id");
  CREATE INDEX "detention_control_shipping_line_id_idx" ON "detention_control" USING btree ("shipping_line_id_id");
  CREATE INDEX "detention_control_updated_at_idx" ON "detention_control" USING btree ("updated_at");
  CREATE INDEX "detention_control_created_at_idx" ON "detention_control" USING btree ("created_at");
  CREATE INDEX "vessels_tenant_id_idx" ON "vessels" USING btree ("tenant_id_id");
  CREATE INDEX "vessels_wharf_id_idx" ON "vessels" USING btree ("wharf_id_id");
  CREATE INDEX "vessels_updated_at_idx" ON "vessels" USING btree ("updated_at");
  CREATE INDEX "vessels_created_at_idx" ON "vessels" USING btree ("created_at");
  CREATE INDEX "import_container_bookings_tenant_id_idx" ON "import_container_bookings" USING btree ("tenant_id_id");
  CREATE UNIQUE INDEX "import_container_bookings_booking_code_idx" ON "import_container_bookings" USING btree ("booking_code");
  CREATE INDEX "import_container_bookings_consignee_id_idx" ON "import_container_bookings" USING btree ("consignee_id_id");
  CREATE INDEX "import_container_bookings_vessel_id_idx" ON "import_container_bookings" USING btree ("vessel_id_id");
  CREATE INDEX "import_container_bookings_empty_routing_empty_routing_sh_idx" ON "import_container_bookings" USING btree ("empty_routing_shipping_line_id_id");
  CREATE INDEX "import_container_bookings_empty_routing_empty_routing_pi_idx" ON "import_container_bookings" USING btree ("empty_routing_pickup_location_id_id");
  CREATE INDEX "import_container_bookings_updated_at_idx" ON "import_container_bookings" USING btree ("updated_at");
  CREATE INDEX "import_container_bookings_created_at_idx" ON "import_container_bookings" USING btree ("created_at");
  CREATE INDEX "import_container_bookings_rels_order_idx" ON "import_container_bookings_rels" USING btree ("order");
  CREATE INDEX "import_container_bookings_rels_parent_idx" ON "import_container_bookings_rels" USING btree ("parent_id");
  CREATE INDEX "import_container_bookings_rels_path_idx" ON "import_container_bookings_rels" USING btree ("path");
  CREATE INDEX "import_container_bookings_rels_paying_customers_id_idx" ON "import_container_bookings_rels" USING btree ("paying_customers_id");
  CREATE INDEX "import_container_bookings_rels_customers_id_idx" ON "import_container_bookings_rels" USING btree ("customers_id");
  CREATE INDEX "import_container_bookings_rels_empty_parks_id_idx" ON "import_container_bookings_rels" USING btree ("empty_parks_id");
  CREATE INDEX "import_container_bookings_rels_wharves_id_idx" ON "import_container_bookings_rels" USING btree ("wharves_id");
  CREATE INDEX "import_container_bookings_rels_container_sizes_id_idx" ON "import_container_bookings_rels" USING btree ("container_sizes_id");
  CREATE INDEX "import_container_bookings_rels_warehouses_id_idx" ON "import_container_bookings_rels" USING btree ("warehouses_id");
  CREATE INDEX "export_container_bookings_tenant_id_idx" ON "export_container_bookings" USING btree ("tenant_id_id");
  CREATE UNIQUE INDEX "export_container_bookings_booking_code_idx" ON "export_container_bookings" USING btree ("booking_code");
  CREATE INDEX "export_container_bookings_consignor_id_idx" ON "export_container_bookings" USING btree ("consignor_id_id");
  CREATE INDEX "export_container_bookings_vessel_id_idx" ON "export_container_bookings" USING btree ("vessel_id_id");
  CREATE INDEX "export_container_bookings_empty_routing_empty_routing_sh_idx" ON "export_container_bookings" USING btree ("empty_routing_shipping_line_id_id");
  CREATE INDEX "export_container_bookings_empty_routing_empty_routing_pi_idx" ON "export_container_bookings" USING btree ("empty_routing_pickup_location_id_id");
  CREATE INDEX "export_container_bookings_updated_at_idx" ON "export_container_bookings" USING btree ("updated_at");
  CREATE INDEX "export_container_bookings_created_at_idx" ON "export_container_bookings" USING btree ("created_at");
  CREATE INDEX "export_container_bookings_rels_order_idx" ON "export_container_bookings_rels" USING btree ("order");
  CREATE INDEX "export_container_bookings_rels_parent_idx" ON "export_container_bookings_rels" USING btree ("parent_id");
  CREATE INDEX "export_container_bookings_rels_path_idx" ON "export_container_bookings_rels" USING btree ("path");
  CREATE INDEX "export_container_bookings_rels_paying_customers_id_idx" ON "export_container_bookings_rels" USING btree ("paying_customers_id");
  CREATE INDEX "export_container_bookings_rels_customers_id_idx" ON "export_container_bookings_rels" USING btree ("customers_id");
  CREATE INDEX "export_container_bookings_rels_empty_parks_id_idx" ON "export_container_bookings_rels" USING btree ("empty_parks_id");
  CREATE INDEX "export_container_bookings_rels_wharves_id_idx" ON "export_container_bookings_rels" USING btree ("wharves_id");
  CREATE INDEX "export_container_bookings_rels_container_sizes_id_idx" ON "export_container_bookings_rels" USING btree ("container_sizes_id");
  CREATE INDEX "export_container_bookings_rels_warehouses_id_idx" ON "export_container_bookings_rels" USING btree ("warehouses_id");
  CREATE INDEX "container_details_container_size_id_idx" ON "container_details" USING btree ("container_size_id_id");
  CREATE INDEX "container_details_shipping_line_id_idx" ON "container_details" USING btree ("shipping_line_id_id");
  CREATE INDEX "container_details_updated_at_idx" ON "container_details" USING btree ("updated_at");
  CREATE INDEX "container_details_created_at_idx" ON "container_details" USING btree ("created_at");
  CREATE INDEX "container_details_rels_order_idx" ON "container_details_rels" USING btree ("order");
  CREATE INDEX "container_details_rels_parent_idx" ON "container_details_rels" USING btree ("parent_id");
  CREATE INDEX "container_details_rels_path_idx" ON "container_details_rels" USING btree ("path");
  CREATE INDEX "container_details_rels_import_container_bookings_id_idx" ON "container_details_rels" USING btree ("import_container_bookings_id");
  CREATE INDEX "container_details_rels_export_container_bookings_id_idx" ON "container_details_rels" USING btree ("export_container_bookings_id");
  CREATE INDEX "container_stock_allocations_product_lines_lpn_order_idx" ON "container_stock_allocations_product_lines_lpn" USING btree ("_order");
  CREATE INDEX "container_stock_allocations_product_lines_lpn_parent_id_idx" ON "container_stock_allocations_product_lines_lpn" USING btree ("_parent_id");
  CREATE INDEX "container_stock_allocations_product_lines_order_idx" ON "container_stock_allocations_product_lines" USING btree ("_order");
  CREATE INDEX "container_stock_allocations_product_lines_parent_id_idx" ON "container_stock_allocations_product_lines" USING btree ("_parent_id");
  CREATE INDEX "container_stock_allocations_product_lines_sku_id_idx" ON "container_stock_allocations_product_lines" USING btree ("sku_id_id");
  CREATE INDEX "container_stock_allocations_container_detail_id_idx" ON "container_stock_allocations" USING btree ("container_detail_id_id");
  CREATE INDEX "container_stock_allocations_updated_at_idx" ON "container_stock_allocations" USING btree ("updated_at");
  CREATE INDEX "container_stock_allocations_created_at_idx" ON "container_stock_allocations" USING btree ("created_at");
  CREATE INDEX "container_stock_allocations_rels_order_idx" ON "container_stock_allocations_rels" USING btree ("order");
  CREATE INDEX "container_stock_allocations_rels_parent_idx" ON "container_stock_allocations_rels" USING btree ("parent_id");
  CREATE INDEX "container_stock_allocations_rels_path_idx" ON "container_stock_allocations_rels" USING btree ("path");
  CREATE INDEX "container_stock_allocations_rels_import_container_bookin_idx" ON "container_stock_allocations_rels" USING btree ("import_container_bookings_id");
  CREATE INDEX "container_stock_allocations_rels_export_container_bookin_idx" ON "container_stock_allocations_rels" USING btree ("export_container_bookings_id");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_tenants_id_idx" ON "payload_locked_documents_rels" USING btree ("tenants_id");
  CREATE INDEX "payload_locked_documents_rels_tenant_users_id_idx" ON "payload_locked_documents_rels" USING btree ("tenant_users_id");
  CREATE INDEX "payload_locked_documents_rels_tenant_roles_id_idx" ON "payload_locked_documents_rels" USING btree ("tenant_roles_id");
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_locked_documents_rels_handling_units_id_idx" ON "payload_locked_documents_rels" USING btree ("handling_units_id");
  CREATE INDEX "payload_locked_documents_rels_storage_units_id_idx" ON "payload_locked_documents_rels" USING btree ("storage_units_id");
  CREATE INDEX "payload_locked_documents_rels_skus_id_idx" ON "payload_locked_documents_rels" USING btree ("skus_id");
  CREATE INDEX "payload_locked_documents_rels_paying_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("paying_customers_id");
  CREATE INDEX "payload_locked_documents_rels_warehouses_id_idx" ON "payload_locked_documents_rels" USING btree ("warehouses_id");
  CREATE INDEX "payload_locked_documents_rels_stores_id_idx" ON "payload_locked_documents_rels" USING btree ("stores_id");
  CREATE INDEX "payload_locked_documents_rels_transport_companies_id_idx" ON "payload_locked_documents_rels" USING btree ("transport_companies_id");
  CREATE INDEX "payload_locked_documents_rels_inbound_inventory_id_idx" ON "payload_locked_documents_rels" USING btree ("inbound_inventory_id");
  CREATE INDEX "payload_locked_documents_rels_inbound_product_line_id_idx" ON "payload_locked_documents_rels" USING btree ("inbound_product_line_id");
  CREATE INDEX "payload_locked_documents_rels_put_away_stock_id_idx" ON "payload_locked_documents_rels" USING btree ("put_away_stock_id");
  CREATE INDEX "payload_locked_documents_rels_outbound_inventory_id_idx" ON "payload_locked_documents_rels" USING btree ("outbound_inventory_id");
  CREATE INDEX "payload_locked_documents_rels_outbound_product_line_id_idx" ON "payload_locked_documents_rels" USING btree ("outbound_product_line_id");
  CREATE INDEX "payload_locked_documents_rels_pickup_stock_id_idx" ON "payload_locked_documents_rels" USING btree ("pickup_stock_id");
  CREATE INDEX "payload_locked_documents_rels_trailer_types_id_idx" ON "payload_locked_documents_rels" USING btree ("trailer_types_id");
  CREATE INDEX "payload_locked_documents_rels_trailers_id_idx" ON "payload_locked_documents_rels" USING btree ("trailers_id");
  CREATE INDEX "payload_locked_documents_rels_vehicles_id_idx" ON "payload_locked_documents_rels" USING btree ("vehicles_id");
  CREATE INDEX "payload_locked_documents_rels_drivers_id_idx" ON "payload_locked_documents_rels" USING btree ("drivers_id");
  CREATE INDEX "payload_locked_documents_rels_delay_points_id_idx" ON "payload_locked_documents_rels" USING btree ("delay_points_id");
  CREATE INDEX "payload_locked_documents_rels_empty_parks_id_idx" ON "payload_locked_documents_rels" USING btree ("empty_parks_id");
  CREATE INDEX "payload_locked_documents_rels_shipping_lines_id_idx" ON "payload_locked_documents_rels" USING btree ("shipping_lines_id");
  CREATE INDEX "payload_locked_documents_rels_wharves_id_idx" ON "payload_locked_documents_rels" USING btree ("wharves_id");
  CREATE INDEX "payload_locked_documents_rels_container_sizes_id_idx" ON "payload_locked_documents_rels" USING btree ("container_sizes_id");
  CREATE INDEX "payload_locked_documents_rels_container_weights_id_idx" ON "payload_locked_documents_rels" USING btree ("container_weights_id");
  CREATE INDEX "payload_locked_documents_rels_damage_codes_id_idx" ON "payload_locked_documents_rels" USING btree ("damage_codes_id");
  CREATE INDEX "payload_locked_documents_rels_detention_control_id_idx" ON "payload_locked_documents_rels" USING btree ("detention_control_id");
  CREATE INDEX "payload_locked_documents_rels_vessels_id_idx" ON "payload_locked_documents_rels" USING btree ("vessels_id");
  CREATE INDEX "payload_locked_documents_rels_import_container_bookings__idx" ON "payload_locked_documents_rels" USING btree ("import_container_bookings_id");
  CREATE INDEX "payload_locked_documents_rels_export_container_bookings__idx" ON "payload_locked_documents_rels" USING btree ("export_container_bookings_id");
  CREATE INDEX "payload_locked_documents_rels_container_details_id_idx" ON "payload_locked_documents_rels" USING btree ("container_details_id");
  CREATE INDEX "payload_locked_documents_rels_container_stock_allocation_idx" ON "payload_locked_documents_rels" USING btree ("container_stock_allocations_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_rels_tenant_users_id_idx" ON "payload_preferences_rels" USING btree ("tenant_users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "tenants" CASCADE;
  DROP TABLE "tenant_users_sessions" CASCADE;
  DROP TABLE "tenant_users" CASCADE;
  DROP TABLE "tenant_roles" CASCADE;
  DROP TABLE "customers" CASCADE;
  DROP TABLE "handling_units" CASCADE;
  DROP TABLE "storage_units" CASCADE;
  DROP TABLE "skus" CASCADE;
  DROP TABLE "paying_customers" CASCADE;
  DROP TABLE "warehouses" CASCADE;
  DROP TABLE "stores" CASCADE;
  DROP TABLE "transport_companies" CASCADE;
  DROP TABLE "inbound_inventory" CASCADE;
  DROP TABLE "inbound_product_line" CASCADE;
  DROP TABLE "put_away_stock" CASCADE;
  DROP TABLE "outbound_inventory" CASCADE;
  DROP TABLE "outbound_product_line_lpn" CASCADE;
  DROP TABLE "outbound_product_line" CASCADE;
  DROP TABLE "pickup_stock_picked_up_l_p_ns" CASCADE;
  DROP TABLE "pickup_stock" CASCADE;
  DROP TABLE "trailer_types" CASCADE;
  DROP TABLE "trailers" CASCADE;
  DROP TABLE "vehicles" CASCADE;
  DROP TABLE "drivers" CASCADE;
  DROP TABLE "delay_points" CASCADE;
  DROP TABLE "empty_parks" CASCADE;
  DROP TABLE "shipping_lines" CASCADE;
  DROP TABLE "wharves" CASCADE;
  DROP TABLE "container_sizes" CASCADE;
  DROP TABLE "container_weights" CASCADE;
  DROP TABLE "damage_codes" CASCADE;
  DROP TABLE "detention_control" CASCADE;
  DROP TABLE "vessels" CASCADE;
  DROP TABLE "import_container_bookings" CASCADE;
  DROP TABLE "import_container_bookings_rels" CASCADE;
  DROP TABLE "export_container_bookings" CASCADE;
  DROP TABLE "export_container_bookings_rels" CASCADE;
  DROP TABLE "container_details" CASCADE;
  DROP TABLE "container_details_rels" CASCADE;
  DROP TABLE "container_stock_allocations_product_lines_lpn" CASCADE;
  DROP TABLE "container_stock_allocations_product_lines" CASCADE;
  DROP TABLE "container_stock_allocations" CASCADE;
  DROP TABLE "container_stock_allocations_rels" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_users_status";
  DROP TYPE "public"."enum_tenants_data_region";
  DROP TYPE "public"."enum_tenants_status";
  DROP TYPE "public"."enum_tenant_users_user_group";
  DROP TYPE "public"."enum_tenant_users_status";
  DROP TYPE "public"."enum_storage_units_whsto_charge_by";
  DROP TYPE "public"."enum_skus_receive_h_u";
  DROP TYPE "public"."enum_skus_pick_h_u";
  DROP TYPE "public"."enum_skus_pick_strategy";
  DROP TYPE "public"."enum_warehouses_type";
  DROP TYPE "public"."enum_stores_zone_type";
  DROP TYPE "public"."enum_inbound_inventory_transport_mode";
  DROP TYPE "public"."enum_put_away_stock_allocation_status";
  DROP TYPE "public"."enum_outbound_inventory_status";
  DROP TYPE "public"."enum_pickup_stock_pickup_status";
  DROP TYPE "public"."enum_trailer_types_trailer_a_teu_capacity";
  DROP TYPE "public"."enum_trailer_types_trailer_b_teu_capacity";
  DROP TYPE "public"."enum_drivers_employee_type";
  DROP TYPE "public"."enum_shipping_lines_calculate_import_free_days_using";
  DROP TYPE "public"."enum_container_weights_attribute";
  DROP TYPE "public"."enum_damage_codes_freight_type";
  DROP TYPE "public"."enum_detention_control_container_type";
  DROP TYPE "public"."enum_vessels_job_type";
  DROP TYPE "public"."enum_import_container_bookings_status";
  DROP TYPE "public"."enum_export_container_bookings_status";
  DROP TYPE "public"."enum_container_stock_allocations_stage";`)
}
