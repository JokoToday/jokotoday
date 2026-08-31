/*
  Pickup / inventory architecture v2 — public/admin RLS split.

  Anonymous policies must not reference user_profiles because anon has no table
  privileges there. Public-active and authenticated-admin access are represented
  as separate permissive policies.
*/

BEGIN;

DROP POLICY IF EXISTS "Public can read active pickup schedules" ON public.pickup_schedules;
DROP POLICY IF EXISTS "Admins can read all pickup schedules" ON public.pickup_schedules;
CREATE POLICY "Public can read active pickup schedules"
ON public.pickup_schedules FOR SELECT TO anon, authenticated
USING (is_active = true);
CREATE POLICY "Admins can read all pickup schedules"
ON public.pickup_schedules FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Public can read active schedule locations" ON public.pickup_schedule_locations;
DROP POLICY IF EXISTS "Admins can read all schedule locations" ON public.pickup_schedule_locations;
CREATE POLICY "Public can read active schedule locations"
ON public.pickup_schedule_locations FOR SELECT TO anon, authenticated
USING (is_active = true);
CREATE POLICY "Admins can read all schedule locations"
ON public.pickup_schedule_locations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Public can read pickup dates" ON public.pickup_dates;
DROP POLICY IF EXISTS "Admins can read all pickup dates" ON public.pickup_dates;
CREATE POLICY "Public can read pickup dates"
ON public.pickup_dates FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.pickup_schedules s
    WHERE s.id = pickup_dates.schedule_id
      AND s.is_active = true
  )
);
CREATE POLICY "Admins can read all pickup dates"
ON public.pickup_dates FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Public can read active pickup date locations" ON public.pickup_date_locations;
DROP POLICY IF EXISTS "Admins can read all pickup date locations" ON public.pickup_date_locations;
CREATE POLICY "Public can read active pickup date locations"
ON public.pickup_date_locations FOR SELECT TO anon, authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.pickup_dates d
    WHERE d.id = pickup_date_locations.pickup_date_id
  )
);
CREATE POLICY "Admins can read all pickup date locations"
ON public.pickup_date_locations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

/* Expose metadata only after the anonymous-safe policy split is installed. */
GRANT SELECT ON TABLE
  public.pickup_schedules,
  public.pickup_schedule_locations,
  public.pickup_dates,
  public.pickup_date_locations
TO anon, authenticated;

COMMIT;
