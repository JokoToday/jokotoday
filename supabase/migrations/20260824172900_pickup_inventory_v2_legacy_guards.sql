/*
  Pickup / inventory architecture v2 — fail-closed legacy compatibility guard.

  This migration performs validation only. It deliberately makes no schema or
  data changes. If current production configuration cannot be mapped safely to
  the Phase A one-schedule-per-weekday model, the transaction aborts before the
  foundation migration creates any v2 objects.
*/

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.cms_pickup_days d
    LEFT JOIN public.cms_pickup_locations l ON l.id = d.location_id
    LEFT JOIN public.pickup_cutoff_rules r
      ON r.day_key = d.day_key
     AND COALESCE(r.is_active, false) = true
    WHERE COALESCE(d.is_open, false) = true
      AND (
        d.day_key IS NULL
        OR d.pickup_weekday IS NULL
        OR d.pickup_weekday NOT BETWEEN 0 AND 6
        OR d.location_id IS NULL
        OR l.id IS NULL
        OR COALESCE(l.is_active, false) = false
        OR r.day_key IS NULL
        OR r.cutoff_day NOT IN ('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')
        OR COALESCE(r.cutoff_time, '') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$'
      )
  ) THEN
    RAISE EXCEPTION
      'Pickup v2 guard failed: an active legacy pickup slot has invalid weekday/location/order-cutoff configuration. Run the pickup v2 preflight.';
  END IF;

  IF EXISTS (
    SELECT d.pickup_weekday
    FROM public.cms_pickup_days d
    WHERE COALESCE(d.is_open, false) = true
    GROUP BY d.pickup_weekday
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Pickup v2 guard failed: more than one active legacy pickup slot uses the same weekday. Consolidate locations under one schedule before Phase A.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cms_pickup_days d
    JOIN public.cancellation_cutoff_rules c
      ON c.pickup_label_en = COALESCE(d.label_en, d.label)
     AND COALESCE(c.is_active, false) = true
    WHERE c.cutoff_day NOT IN ('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')
       OR COALESCE(c.cutoff_time, '') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$'
  ) THEN
    RAISE EXCEPTION
      'Pickup v2 guard failed: an active legacy cancellation cutoff has an invalid weekday/time. Run the pickup v2 preflight.';
  END IF;
END
$$;

COMMIT;
