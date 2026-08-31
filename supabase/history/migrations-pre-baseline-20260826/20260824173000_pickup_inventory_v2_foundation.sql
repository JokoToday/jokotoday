/*
  Pickup / inventory architecture v2 — foundation.

  PURPOSE
  -------
  Add the normalized data model required for:
    - explicit pickup dates
    - multiple pickup locations for one recurring schedule
    - one shared product inventory pool per product + pickup date
    - immutable/stable order linkage to a concrete pickup date

  SAFETY / ROLLOUT
  ----------------
  This migration is intentionally additive.
  It does NOT:
    - replace create_online_order()
    - replace cancel_online_order()
    - rewrite existing orders
    - reinterpret cms_products.stock_by_day as recurring capacity
    - switch the frontend to v2 tables
    - delete or deprecate legacy pickup tables

  Existing checkout therefore continues to run unchanged after this migration.
  The companion RPC migration adds opt-in v2 functions only.
*/

BEGIN;

CREATE TABLE IF NOT EXISTS public.pickup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_key text UNIQUE NOT NULL,
  legacy_day_key text UNIQUE,
  label_en text NOT NULL,
  label_th text,
  label_zh text,
  pickup_weekday smallint NOT NULL CHECK (pickup_weekday BETWEEN 0 AND 6),
  order_cutoff_days_before smallint NOT NULL CHECK (order_cutoff_days_before BETWEEN 0 AND 6),
  order_cutoff_time time NOT NULL,
  cancellation_cutoff_days_before smallint NOT NULL DEFAULT 1 CHECK (cancellation_cutoff_days_before BETWEEN 0 AND 6),
  cancellation_cutoff_time time NOT NULL DEFAULT '00:00',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pickup_schedules IS
  'Recurring pickup templates. Locations are linked separately; concrete pickup occurrences live in pickup_dates.';
COMMENT ON COLUMN public.pickup_schedules.schedule_key IS
  'Stable recurring schedule identifier. Seeded from legacy cms_pickup_days.day_key during migration.';

CREATE TABLE IF NOT EXISTS public.pickup_schedule_locations (
  schedule_id uuid NOT NULL REFERENCES public.pickup_schedules(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.cms_pickup_locations(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (schedule_id, location_id)
);

COMMENT ON TABLE public.pickup_schedule_locations IS
  'Default pickup locations offered by a recurring schedule. A schedule may have multiple locations.';

CREATE TABLE IF NOT EXISTS public.pickup_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.pickup_schedules(id) ON DELETE RESTRICT,
  pickup_date date NOT NULL,
  order_cutoff_at timestamptz NOT NULL,
  cancellation_cutoff_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'sold_out')),
  note_en text,
  note_th text,
  note_zh text,
  source text NOT NULL DEFAULT 'generated' CHECK (source IN ('generated', 'manual', 'legacy_override')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, pickup_date)
);

CREATE INDEX IF NOT EXISTS pickup_dates_pickup_date_idx ON public.pickup_dates(pickup_date);
CREATE INDEX IF NOT EXISTS pickup_dates_open_calendar_idx
  ON public.pickup_dates(pickup_date, schedule_id) WHERE status = 'open';

COMMENT ON TABLE public.pickup_dates IS
  'Concrete customer-selectable pickup occurrences with materialized order and cancellation cutoffs.';

CREATE TABLE IF NOT EXISTS public.pickup_date_locations (
  pickup_date_id uuid NOT NULL REFERENCES public.pickup_dates(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.cms_pickup_locations(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  note_en text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pickup_date_id, location_id)
);

COMMENT ON TABLE public.pickup_date_locations IS
  'Locations available for one concrete pickup date. Inventory is intentionally not stored here.';

CREATE TABLE IF NOT EXISTS public.product_schedule_capacity (
  schedule_id uuid NOT NULL REFERENCES public.pickup_schedules(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.cms_products(id) ON DELETE RESTRICT,
  capacity integer NOT NULL CHECK (capacity >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (schedule_id, product_id)
);

COMMENT ON TABLE public.product_schedule_capacity IS
  'Recurring default capacity for product + schedule. Shared by all pickup locations.';

CREATE TABLE IF NOT EXISTS public.product_date_inventory (
  pickup_date_id uuid NOT NULL REFERENCES public.pickup_dates(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.cms_products(id) ON DELETE RESTRICT,
  capacity integer NOT NULL CHECK (capacity >= 0),
  reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  capacity_source text NOT NULL DEFAULT 'recurring_default'
    CHECK (capacity_source IN ('recurring_default', 'date_override', 'manual_seed')),
  override_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pickup_date_id, product_id),
  CONSTRAINT product_date_inventory_reserved_within_capacity CHECK (reserved_quantity <= capacity)
);

CREATE INDEX IF NOT EXISTS product_date_inventory_product_idx
  ON public.product_date_inventory(product_id, pickup_date_id);

COMMENT ON TABLE public.product_date_inventory IS
  'Authoritative shared inventory pool for one product on one concrete pickup date. Never scoped by pickup location.';

CREATE TABLE IF NOT EXISTS public.inventory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_date_id uuid NOT NULL REFERENCES public.pickup_dates(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.cms_products(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('reserve', 'release', 'adjustment')),
  reserved_delta integer NOT NULL CHECK (reserved_delta <> 0),
  actor_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_events_inventory_idx
  ON public.inventory_events(pickup_date_id, product_id, created_at);
CREATE INDEX IF NOT EXISTS inventory_events_order_idx
  ON public.inventory_events(order_id) WHERE order_id IS NOT NULL;

COMMENT ON TABLE public.inventory_events IS
  'Append-only audit ledger for changes to product_date_inventory.reserved_quantity.';

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pickup_date_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_pickup_date_id_fkey'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_pickup_date_id_fkey
      FOREIGN KEY (pickup_date_id) REFERENCES public.pickup_dates(id) ON DELETE RESTRICT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_pickup_date_location_fkey'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_pickup_date_location_fkey
      FOREIGN KEY (pickup_date_id, pickup_location_id)
      REFERENCES public.pickup_date_locations(pickup_date_id, location_id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_pickup_date_requires_location'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_pickup_date_requires_location
      CHECK (pickup_date_id IS NULL OR pickup_location_id IS NOT NULL);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS orders_pickup_date_id_idx
  ON public.orders(pickup_date_id) WHERE pickup_date_id IS NOT NULL;

COMMENT ON COLUMN public.orders.pickup_date_id IS
  'Stable concrete pickup occurrence for v2 online orders. Null for legacy orders until separately reconciled.';

ALTER TABLE public.pickup_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_schedule_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_date_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_schedule_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_date_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.pickup_schedules,
  public.pickup_schedule_locations,
  public.pickup_dates,
  public.pickup_date_locations,
  public.product_schedule_capacity,
  public.product_date_inventory,
  public.inventory_events
FROM anon, authenticated;

/*
  Keep public/customer metadata reads dark at this migration boundary.
  174800 installs anonymous-safe public/admin RLS policies and grants SELECT
  on these four metadata tables in the same transaction.
*/

GRANT SELECT ON TABLE
  public.product_schedule_capacity,
  public.product_date_inventory,
  public.inventory_events
TO authenticated;

DROP POLICY IF EXISTS "Public can read active pickup schedules" ON public.pickup_schedules;
CREATE POLICY "Public can read active pickup schedules"
ON public.pickup_schedules FOR SELECT TO anon, authenticated
USING (
  is_active = true
  OR EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Public can read active schedule locations" ON public.pickup_schedule_locations;
CREATE POLICY "Public can read active schedule locations"
ON public.pickup_schedule_locations FOR SELECT TO anon, authenticated
USING (
  is_active = true
  OR EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Public can read pickup dates" ON public.pickup_dates;
CREATE POLICY "Public can read pickup dates"
ON public.pickup_dates FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pickup_schedules s
    WHERE s.id = pickup_dates.schedule_id
      AND (
        s.is_active = true
        OR EXISTS (
          SELECT 1 FROM public.user_profiles p
          WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
        )
      )
  )
);

DROP POLICY IF EXISTS "Public can read active pickup date locations" ON public.pickup_date_locations;
CREATE POLICY "Public can read active pickup date locations"
ON public.pickup_date_locations FOR SELECT TO anon, authenticated
USING (
  is_active = true
  OR EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can read product schedule capacity" ON public.product_schedule_capacity;
CREATE POLICY "Admins can read product schedule capacity"
ON public.product_schedule_capacity FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can read product date inventory" ON public.product_date_inventory;
CREATE POLICY "Admins can read product date inventory"
ON public.product_date_inventory FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can read inventory events" ON public.inventory_events;
CREATE POLICY "Admins can read inventory events"
ON public.inventory_events FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

/*
  Metadata-only backfill from the legacy recurring schedule.
  This intentionally does NOT backfill product capacities or orders.
  cms_products.stock_by_day currently represents remaining mutable stock and
  must not be mistaken for recurring production capacity.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.cms_pickup_days d
    LEFT JOIN public.pickup_cutoff_rules r
      ON r.day_key = d.day_key
     AND COALESCE(r.is_active, false) = true
    WHERE COALESCE(d.is_open, false) = true
      AND (
        d.day_key IS NULL
        OR d.pickup_weekday IS NULL
        OR d.pickup_weekday NOT BETWEEN 0 AND 6
        OR d.location_id IS NULL
        OR r.day_key IS NULL
        OR CASE r.cutoff_day
             WHEN 'Sunday' THEN 0 WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2
             WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5
             WHEN 'Saturday' THEN 6 ELSE NULL
           END IS NULL
      )
  ) THEN
    RAISE EXCEPTION
      'Pickup v2 metadata backfill aborted: an active legacy pickup slot is missing a valid weekday, location, or active cutoff rule. Run the preflight audit before applying.';
  END IF;
END
$$;

INSERT INTO public.pickup_schedules (
  schedule_key,
  legacy_day_key,
  label_en,
  label_th,
  label_zh,
  pickup_weekday,
  order_cutoff_days_before,
  order_cutoff_time,
  cancellation_cutoff_days_before,
  cancellation_cutoff_time,
  is_active,
  sort_order
)
SELECT
  d.day_key,
  d.day_key,
  COALESCE(d.label_en, d.label),
  d.label_th,
  d.label_zh,
  d.pickup_weekday,
  ((d.pickup_weekday - CASE r.cutoff_day
      WHEN 'Sunday' THEN 0 WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2
      WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5
      WHEN 'Saturday' THEN 6 ELSE NULL END + 7) % 7)::smallint,
  r.cutoff_time::time,
  COALESCE(c.cancel_days_before, 1)::smallint,
  COALESCE(c.cancel_time, '00:00'::time),
  COALESCE(d.is_open, false) AND COALESCE(r.is_active, false),
  d.sort_order
FROM public.cms_pickup_days d
JOIN public.pickup_cutoff_rules r ON r.day_key = d.day_key
LEFT JOIN LATERAL (
  SELECT
    ((d.pickup_weekday - CASE cr.cutoff_day
        WHEN 'Sunday' THEN 0 WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2
        WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5
        WHEN 'Saturday' THEN 6 ELSE NULL END + 7) % 7)::smallint AS cancel_days_before,
    cr.cutoff_time::time AS cancel_time
  FROM public.cancellation_cutoff_rules cr
  WHERE cr.is_active = true
    AND cr.pickup_label_en = COALESCE(d.label_en, d.label)
  ORDER BY cr.sort_order, cr.updated_at DESC NULLS LAST, cr.created_at DESC NULLS LAST
  LIMIT 1
) c ON true
WHERE d.day_key IS NOT NULL
  AND d.pickup_weekday BETWEEN 0 AND 6
  AND d.location_id IS NOT NULL
  AND CASE r.cutoff_day
        WHEN 'Sunday' THEN 0 WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2
        WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5
        WHEN 'Saturday' THEN 6 ELSE NULL END IS NOT NULL
ON CONFLICT (schedule_key) DO NOTHING;

INSERT INTO public.pickup_schedule_locations (
  schedule_id,
  location_id,
  is_active,
  sort_order
)
SELECT
  s.id,
  d.location_id,
  COALESCE(d.is_open, false),
  d.sort_order
FROM public.cms_pickup_days d
JOIN public.pickup_schedules s ON s.schedule_key = d.day_key
WHERE d.location_id IS NOT NULL
ON CONFLICT (schedule_id, location_id) DO NOTHING;

COMMIT;
