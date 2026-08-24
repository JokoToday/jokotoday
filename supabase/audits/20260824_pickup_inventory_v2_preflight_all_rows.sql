/*
  READ-ONLY PRE-APPLY SUPPLEMENT
  Pickup / inventory architecture v2 — all legacy rows consumed by foundation

  This file contains SELECT statements only. Run it with the main
  20260824_pickup_inventory_v2_preflight.sql before any v2 migration apply.

  The main preflight intentionally focuses many business-integrity hard stops
  on currently open pickup slots. The foundation metadata backfill can also
  inspect closed / archived legacy rows, so this supplement verifies the cast
  and NOT NULL inputs used by that backfill.
*/

-- HARD STOP: every legacy row shape that can reach the foundation schedule
-- backfill must have a non-null label/sort order and a parseable cutoff time.
-- Must return ZERO rows.
SELECT
  d.id AS legacy_pickup_day_id,
  d.day_key,
  d.label,
  d.label_en,
  d.is_open,
  d.pickup_weekday,
  d.location_id,
  d.sort_order,
  r.id AS cutoff_rule_id,
  r.cutoff_day,
  r.cutoff_time,
  r.is_active AS cutoff_is_active
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
ORDER BY d.sort_order NULLS LAST, d.day_key, r.id;
