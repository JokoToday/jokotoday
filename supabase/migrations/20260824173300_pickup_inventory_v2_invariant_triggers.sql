/*
  Pickup / inventory architecture v2 — invariant triggers.

  These guards enforce lifecycle rules at the database boundary instead of
  relying only on the Admin/customer RPC implementations.
*/

BEGIN;

-- Once concrete dates exist, a recurring schedule's weekday is stable. Concrete
-- date exceptions belong on pickup_dates rather than by moving the template.
CREATE OR REPLACE FUNCTION public.guard_pickup_schedule_lifecycle_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_today date := timezone('Asia/Bangkok', now())::date;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.pickup_weekday IS DISTINCT FROM NEW.pickup_weekday
     AND EXISTS (
       SELECT 1 FROM public.pickup_dates d WHERE d.schedule_id = OLD.id
     ) THEN
    RAISE EXCEPTION
      'Pickup weekday cannot change after concrete dates have been materialized; use concrete-date overrides or a reviewed schedule transition';
  END IF;

  IF COALESCE(NEW.is_active, false) AND EXISTS (
    SELECT 1
    FROM public.pickup_dates d
    WHERE d.schedule_id IS DISTINCT FROM NEW.id
      AND d.pickup_date >= v_today
      AND extract(dow FROM d.pickup_date)::integer = NEW.pickup_weekday
  ) THEN
    RAISE EXCEPTION
      'Another schedule already owns future concrete dates for this weekday; reconcile those dates before activating this schedule';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_pickup_schedule_lifecycle_v2()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_pickup_schedule_lifecycle_v2
  ON public.pickup_schedules;
CREATE TRIGGER guard_pickup_schedule_lifecycle_v2
BEFORE INSERT OR UPDATE OF pickup_weekday, is_active
ON public.pickup_schedules
FOR EACH ROW
EXECUTE FUNCTION public.guard_pickup_schedule_lifecycle_v2();

-- Enforce the immutable order snapshot/date/location relationship at INSERT and
-- lock the selected date/location rows. This closes the race where Admin could
-- disable a location between customer validation and order insertion.
CREATE OR REPLACE FUNCTION public.guard_v2_order_pickup_selection()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_date public.pickup_dates%ROWTYPE;
  v_date_location_active boolean;
  v_location_active boolean;
BEGIN
  IF NEW.pickup_date_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.purchase_type, 'online') <> 'online' THEN
    RAISE EXCEPTION 'Concrete pickup-date identity is reserved for online v2 orders';
  END IF;
  IF NEW.pickup_location_id IS NULL THEN
    RAISE EXCEPTION 'A v2 order requires a pickup location';
  END IF;

  SELECT d.* INTO v_date
  FROM public.pickup_dates d
  WHERE d.id = NEW.pickup_date_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected pickup date does not exist';
  END IF;

  IF NEW.pickup_date IS DISTINCT FROM v_date.pickup_date THEN
    RAISE EXCEPTION 'Order pickup-date snapshot does not match pickup_date_id';
  END IF;
  IF v_date.status <> 'open' THEN
    RAISE EXCEPTION 'Selected pickup date is unavailable';
  END IF;
  IF v_date.pickup_date < timezone('Asia/Bangkok', now())::date THEN
    RAISE EXCEPTION 'Selected pickup date is in the past';
  END IF;
  IF now() >= v_date.order_cutoff_at THEN
    RAISE EXCEPTION 'Ordering cutoff has passed for the selected pickup date';
  END IF;

  SELECT dl.is_active, l.is_active
  INTO v_date_location_active, v_location_active
  FROM public.pickup_date_locations dl
  JOIN public.cms_pickup_locations l ON l.id = dl.location_id
  WHERE dl.pickup_date_id = NEW.pickup_date_id
    AND dl.location_id = NEW.pickup_location_id
  FOR SHARE OF dl, l;

  IF NOT FOUND
     OR COALESCE(v_date_location_active, false) = false
     OR COALESCE(v_location_active, false) = false THEN
    RAISE EXCEPTION 'Selected pickup location is not available for this date';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_v2_order_pickup_selection()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_v2_order_pickup_selection ON public.orders;
CREATE TRIGGER guard_v2_order_pickup_selection
BEFORE INSERT ON public.orders
FOR EACH ROW
WHEN (NEW.pickup_date_id IS NOT NULL)
EXECUTE FUNCTION public.guard_v2_order_pickup_selection();

-- Inventory events are an append-only audit ledger. Corrections are represented
-- by new adjustment entries, never by rewriting or deleting historical events.
CREATE OR REPLACE FUNCTION public.prevent_inventory_event_mutation_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'inventory_events is append-only; write a compensating adjustment event instead';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_inventory_event_mutation_v2()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_inventory_event_update_v2
  ON public.inventory_events;
CREATE TRIGGER prevent_inventory_event_update_v2
BEFORE UPDATE ON public.inventory_events
FOR EACH ROW
EXECUTE FUNCTION public.prevent_inventory_event_mutation_v2();

DROP TRIGGER IF EXISTS prevent_inventory_event_delete_v2
  ON public.inventory_events;
CREATE TRIGGER prevent_inventory_event_delete_v2
BEFORE DELETE ON public.inventory_events
FOR EACH ROW
EXECUTE FUNCTION public.prevent_inventory_event_mutation_v2();

COMMIT;
