/*
  Pickup / inventory architecture v2 — recurring product availability control.

  product_schedule_capacity.is_active determines whether a product is normally
  offered on a recurring pickup schedule. Date overrides remain independent.
*/

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_set_product_schedule_availability_v2(
  p_schedule_id uuid,
  p_product_id uuid,
  p_is_active boolean,
  p_apply_to_future_dates boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today date := timezone('Asia/Bangkok', now())::date;
  v_capacity public.product_schedule_capacity%ROWTYPE;
BEGIN
  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = v_user_id AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_schedule_id IS NULL OR p_product_id IS NULL OR p_is_active IS NULL THEN
    RAISE EXCEPTION 'Schedule, product and active state are required';
  END IF;

  SELECT * INTO v_capacity
  FROM public.product_schedule_capacity
  WHERE schedule_id = p_schedule_id
    AND product_id = p_product_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configure recurring product capacity before changing availability';
  END IF;

  UPDATE public.product_schedule_capacity
  SET is_active = p_is_active,
      updated_at = now()
  WHERE schedule_id = p_schedule_id
    AND product_id = p_product_id
  RETURNING * INTO v_capacity;

  IF COALESCE(p_apply_to_future_dates, true) THEN
    IF p_is_active THEN
      -- Restore/create only recurring-default pools. Explicit date overrides win.
      IF EXISTS (
        SELECT 1
        FROM public.product_date_inventory i
        JOIN public.pickup_dates d ON d.id = i.pickup_date_id
        WHERE d.schedule_id = p_schedule_id
          AND d.pickup_date >= v_today
          AND i.product_id = p_product_id
          AND i.capacity_source = 'recurring_default'
          AND i.reserved_quantity > v_capacity.capacity
      ) THEN
        RAISE EXCEPTION 'Recurring capacity is below an existing reservation on a future pickup date';
      END IF;

      INSERT INTO public.product_date_inventory (
        pickup_date_id, product_id, capacity, reserved_quantity, capacity_source
      )
      SELECT d.id, p_product_id, v_capacity.capacity, 0, 'recurring_default'
      FROM public.pickup_dates d
      WHERE d.schedule_id = p_schedule_id
        AND d.pickup_date >= v_today
      ON CONFLICT (pickup_date_id, product_id) DO NOTHING;

      UPDATE public.product_date_inventory i
      SET capacity = v_capacity.capacity,
          updated_at = now()
      FROM public.pickup_dates d
      WHERE d.id = i.pickup_date_id
        AND d.schedule_id = p_schedule_id
        AND d.pickup_date >= v_today
        AND i.product_id = p_product_id
        AND i.capacity_source = 'recurring_default';
    ELSE
      -- Preserve already-reserved units but leave no additional recurring stock.
      -- Date overrides are deliberately untouched and may explicitly offer the
      -- product on an exceptional date.
      UPDATE public.product_date_inventory i
      SET capacity = i.reserved_quantity,
          updated_at = now()
      FROM public.pickup_dates d
      WHERE d.id = i.pickup_date_id
        AND d.schedule_id = p_schedule_id
        AND d.pickup_date >= v_today
        AND i.product_id = p_product_id
        AND i.capacity_source = 'recurring_default';
    END IF;
  END IF;

  RETURN to_jsonb(v_capacity);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_product_schedule_availability_v2(uuid, uuid, boolean, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_product_schedule_availability_v2(uuid, uuid, boolean, boolean)
TO authenticated;

COMMIT;
