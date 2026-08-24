/*
  Pickup / inventory architecture v2 — pre-foundation backfill safety.

  This migration performs validation only. It exists before the foundation so
  stale archived legacy metadata cannot cause a later foundation statement to
  fail after earlier foundation DDL has already committed.

  The foundation metadata backfill consumes matching cms_pickup_days and
  pickup_cutoff_rules rows even when a legacy pickup day is currently closed.
  Validate every row shape that can reach casts / NOT NULL targets there.
*/

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.cms_pickup_days d
    JOIN public.pickup_cutoff_rules r ON r.day_key = d.day_key
    WHERE d.day_key IS NOT NULL
      AND d.pickup_weekday BETWEEN 0 AND 6
      AND d.location_id IS NOT NULL
      AND CASE r.cutoff_day
            WHEN 'Sunday' THEN 0 WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2
            WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5
            WHEN 'Saturday' THEN 6 ELSE NULL
          END IS NOT NULL
      AND (
        COALESCE(d.label_en, d.label) IS NULL
        OR d.sort_order IS NULL
        OR COALESCE(r.cutoff_time, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
      )
  ) THEN
    RAISE EXCEPTION
      'Pickup v2 foundation aborted before DDL: legacy pickup metadata consumed by the backfill contains a null label/sort order or invalid cutoff time. Run the all-row preflight and repair or archive the offending metadata first.';
  END IF;
END
$$;

COMMIT;
