/*
  Require scheduled pickup dates for newly inserted online orders.

  An insert-only trigger preserves existing legacy online rows with null
  pickup_date and does not prevent staff from updating those rows. Walk-in
  purchases remain exempt.
*/

CREATE OR REPLACE FUNCTION require_online_order_pickup_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.purchase_type, 'online') <> 'walk_in'
     AND NEW.pickup_date IS NULL THEN
    RAISE EXCEPTION 'A scheduled pickup date is required for online orders';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_online_order_pickup_date_on_insert ON orders;

CREATE TRIGGER require_online_order_pickup_date_on_insert
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION require_online_order_pickup_date();
