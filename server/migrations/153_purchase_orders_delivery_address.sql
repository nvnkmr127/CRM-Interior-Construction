-- Migration: 153_purchase_orders_delivery_address.sql
-- Description: Adds delivery_address column to purchase_orders table.

ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS delivery_address TEXT DEFAULT NULL;
