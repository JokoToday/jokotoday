/*
  Enforce the Phase A shared-date invariant.

  JOKO TODAY is a single operator in this phase. Multiple pickup locations for
  the same weekday/date belong to one schedule/date, not separate schedules.
  This guarantees that product_date_inventory cannot be accidentally split into
  two independent pools for the same calendar date.

  A future multi-vendor phase may replace these global uniqueness rules with
  vendor-scoped equivalents.
*/

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS pickup_schedules_one_active_per_weekday_idx
  ON public.pickup_schedules(pickup_weekday)
  WHERE is_active = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pickup_dates_pickup_date_unique'
      AND conrelid = 'public.pickup_dates'::regclass
  ) THEN
    ALTER TABLE public.pickup_dates
      ADD CONSTRAINT pickup_dates_pickup_date_unique UNIQUE (pickup_date);
  END IF;
END
$$;

COMMIT;
