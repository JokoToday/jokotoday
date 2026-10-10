-- Isolated PostgreSQL fixture for window/RPC integration, not a full Supabase restore.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
GRANT USAGE ON SCHEMA private TO anon,authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;
CREATE TABLE public.user_profiles(id uuid PRIMARY KEY,role text,preferred_language text);
CREATE SEQUENCE public.online_order_number_seq;
CREATE TABLE IF NOT EXISTS "public"."cms_pickup_days" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "day_key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "cutoff_time" "text" DEFAULT '22:00'::"text" NOT NULL,
    "is_open" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cutoff_day" "text" DEFAULT 'Monday'::"text" NOT NULL,
    "label_en" "text",
    "label_th" "text",
    "label_zh" "text",
    "location_id" "uuid",
    "pickup_weekday" smallint NOT NULL,
    CONSTRAINT "cms_pickup_days_pickup_weekday_check" CHECK ((("pickup_weekday" >= 0) AND ("pickup_weekday" <= 6)))
);
CREATE TABLE IF NOT EXISTS "public"."cms_pickup_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name_en" "text" NOT NULL,
    "name_th" "text" NOT NULL,
    "description_en" "text",
    "description_th" "text",
    "maps_url" "text",
    "available_days" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "name_zh" "text",
    "description_zh" "text"
);
CREATE TABLE IF NOT EXISTS "public"."cms_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name_en" "text" NOT NULL,
    "name_th" "text" NOT NULL,
    "desc_en" "text" NOT NULL,
    "desc_th" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "image" "text",
    "is_sold_out" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "stock_total" integer,
    "stock_remaining" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "available_days" "jsonb" DEFAULT '[]'::"jsonb",
    "stock_by_day" "jsonb" DEFAULT '{}'::"jsonb",
    "name_zh" "text",
    "desc_zh" "text",
    "qr_code_url" "text"
);
CREATE TABLE IF NOT EXISTS "public"."cms_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "setting_key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);
CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "line_id" "text",
    "whatsapp" "text",
    "wechat_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "qr_token" "text",
    "loyalty_points" integer DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text",
    "short_code" "text",
    CONSTRAINT "at_least_one_contact" CHECK ((("line_id" IS NOT NULL) OR ("whatsapp" IS NOT NULL) OR ("wechat_id" IS NOT NULL)))
);
CREATE TABLE IF NOT EXISTS "public"."inventory_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pickup_date_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "order_id" "uuid",
    "event_type" "text" NOT NULL,
    "reserved_delta" integer NOT NULL,
    "actor_id" "uuid",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['reserve'::"text", 'release'::"text", 'adjustment'::"text"]))),
    CONSTRAINT "inventory_events_reserved_delta_check" CHECK (("reserved_delta" <> 0))
);
CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "order_number" "text" NOT NULL,
    "order_items" "jsonb" DEFAULT '[]'::"jsonb",
    "total_amount" numeric(10,2) NOT NULL,
    "pickup_location_id" "uuid",
    "pickup_date" "date",
    "status" "text" DEFAULT 'pending'::"text",
    "payment_status" "text" DEFAULT 'unpaid'::"text",
    "line_id" "text",
    "customer_name" "text" NOT NULL,
    "customer_phone" "text" NOT NULL,
    "customer_email" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pickup_day" "text",
    "purchase_type" "text" DEFAULT 'online'::"text",
    "walk_in_amount" numeric(10,2),
    "staff_id" "uuid",
    "loyalty_multiplier" numeric(3,2) DEFAULT 1.0,
    "loyalty_points_earned" integer DEFAULT 0,
    "payment_method" "text",
    "picked_up_at" timestamp with time zone,
    "inventory_reserved" boolean DEFAULT false NOT NULL,
    "pickup_date_id" "uuid",
    "loyalty_points_awarded_at" timestamp with time zone,
    "loyalty_discount_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "amount_paid" numeric(10,2),
    "staff_request_key" "uuid",
    CONSTRAINT "orders_amount_paid_nonnegative" CHECK ((("amount_paid" IS NULL) OR ("amount_paid" >= (0)::numeric))),
    CONSTRAINT "orders_amount_paid_not_above_gross" CHECK ((("amount_paid" IS NULL) OR ("amount_paid" <= "total_amount"))),
    CONSTRAINT "orders_loyalty_discount_nonnegative" CHECK (("loyalty_discount_amount" >= (0)::numeric)),
    CONSTRAINT "orders_loyalty_discount_not_above_gross" CHECK (("loyalty_discount_amount" <= "total_amount")),
    CONSTRAINT "orders_pickup_date_requires_location" CHECK ((("pickup_date_id" IS NULL) OR ("pickup_location_id" IS NOT NULL))),
    CONSTRAINT "orders_unpaid_has_no_amount_paid" CHECK (((COALESCE("payment_status", 'unpaid'::"text") <> 'unpaid'::"text") OR ("amount_paid" IS NULL))),
    CONSTRAINT "valid_payment_status" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'paid'::"text"]))),
    CONSTRAINT "valid_purchase_type" CHECK (("purchase_type" = ANY (ARRAY['online'::"text", 'walk_in'::"text"]))),
    CONSTRAINT "valid_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'ready'::"text", 'picked_up'::"text", 'completed'::"text", 'cancelled'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."order_notification_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "language" "text",
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "claimed_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "provider_message_id" "text",
    "last_error" "text",
    "first_attempt_at" timestamp with time zone,
    CONSTRAINT "order_notification_events_attempt_count_check" CHECK (("attempt_count" >= 0)),
    CONSTRAINT "order_notification_events_language_check" CHECK (("language" = ANY (ARRAY['en'::"text", 'th'::"text", 'zh'::"text"]))),
    CONSTRAINT "order_notification_events_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['customer_confirmation'::"text", 'admin_new_order'::"text"]))),
    CONSTRAINT "order_notification_events_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'sent'::"text", 'failed'::"text", 'uncertain'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."pickup_cutoff_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pickup_label_en" "text" NOT NULL,
    "pickup_label_th" "text" NOT NULL,
    "pickup_day" "text" NOT NULL,
    "location" "text" NOT NULL,
    "cutoff_day" "text" NOT NULL,
    "cutoff_time" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pickup_label_zh" "text",
    "cutoff_day_zh" "text",
    "day_key" "text" NOT NULL
);
CREATE TABLE IF NOT EXISTS "public"."pickup_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "pickup_day" "text" NOT NULL,
    "location" "text" NOT NULL,
    "override_type" "text" NOT NULL,
    "custom_cutoff_day" "text",
    "custom_cutoff_time" "text",
    "note_en" "text" DEFAULT ''::"text",
    "note_th" "text" DEFAULT ''::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "note_zh" "text" DEFAULT ''::"text",
    CONSTRAINT "pickup_overrides_override_type_check" CHECK (("override_type" = ANY (ARRAY['closed'::"text", 'custom_cutoff'::"text", 'sold_out'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."pickup_dates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "pickup_date" "date" NOT NULL,
    "order_cutoff_at" timestamp with time zone NOT NULL,
    "cancellation_cutoff_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "note_en" "text",
    "note_th" "text",
    "note_zh" "text",
    "source" "text" DEFAULT 'generated'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pickup_dates_source_check" CHECK (("source" = ANY (ARRAY['generated'::"text", 'manual'::"text", 'legacy_override'::"text"]))),
    CONSTRAINT "pickup_dates_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'sold_out'::"text"])))
);
CREATE TABLE IF NOT EXISTS "public"."pickup_date_locations" (
    "pickup_date_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "note_en" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE TABLE IF NOT EXISTS "public"."pickup_schedule_locations" (
    "schedule_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
CREATE TABLE IF NOT EXISTS "public"."pickup_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_key" "text" NOT NULL,
    "legacy_day_key" "text",
    "label_en" "text" NOT NULL,
    "label_th" "text",
    "label_zh" "text",
    "pickup_weekday" smallint NOT NULL,
    "order_cutoff_days_before" smallint NOT NULL,
    "order_cutoff_time" time without time zone NOT NULL,
    "cancellation_cutoff_days_before" smallint DEFAULT 1 NOT NULL,
    "cancellation_cutoff_time" time without time zone DEFAULT '00:00:00'::time without time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pickup_schedules_cancellation_cutoff_days_before_check" CHECK ((("cancellation_cutoff_days_before" >= 0) AND ("cancellation_cutoff_days_before" <= 6))),
    CONSTRAINT "pickup_schedules_order_cutoff_days_before_check" CHECK ((("order_cutoff_days_before" >= 0) AND ("order_cutoff_days_before" <= 6))),
    CONSTRAINT "pickup_schedules_pickup_weekday_check" CHECK ((("pickup_weekday" >= 0) AND ("pickup_weekday" <= 6)))
);
CREATE TABLE IF NOT EXISTS "public"."product_date_inventory" (
    "pickup_date_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "capacity" integer NOT NULL,
    "reserved_quantity" integer DEFAULT 0 NOT NULL,
    "capacity_source" "text" DEFAULT 'recurring_default'::"text" NOT NULL,
    "override_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_date_inventory_capacity_check" CHECK (("capacity" >= 0)),
    CONSTRAINT "product_date_inventory_capacity_source_check" CHECK (("capacity_source" = ANY (ARRAY['recurring_default'::"text", 'date_override'::"text", 'manual_seed'::"text"]))),
    CONSTRAINT "product_date_inventory_reserved_quantity_check" CHECK (("reserved_quantity" >= 0)),
    CONSTRAINT "product_date_inventory_reserved_within_capacity" CHECK (("reserved_quantity" <= "capacity"))
);
CREATE TABLE IF NOT EXISTS "public"."product_schedule_capacity" (
    "schedule_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "capacity" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_schedule_capacity_capacity_check" CHECK (("capacity" >= 0))
);
ALTER TABLE ONLY "public"."cms_pickup_days"
    ADD CONSTRAINT "cms_pickup_days_day_key_key" UNIQUE ("day_key");
ALTER TABLE ONLY "public"."cms_pickup_days"
    ADD CONSTRAINT "cms_pickup_days_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."cms_pickup_locations"
    ADD CONSTRAINT "cms_pickup_locations_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."cms_products"
    ADD CONSTRAINT "cms_products_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."cms_products"
    ADD CONSTRAINT "cms_products_slug_key" UNIQUE ("slug");
ALTER TABLE ONLY "public"."cms_settings"
    ADD CONSTRAINT "cms_settings_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."cms_settings"
    ADD CONSTRAINT "cms_settings_setting_key_key" UNIQUE ("setting_key");
ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_email_key" UNIQUE ("email");
ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_qr_token_key" UNIQUE ("qr_token");
ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_short_code_key" UNIQUE ("short_code");
ALTER TABLE ONLY "public"."inventory_events"
    ADD CONSTRAINT "inventory_events_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");
ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."order_notification_events"
    ADD CONSTRAINT "order_notification_events_order_id_notification_type_key" UNIQUE ("order_id", "notification_type");
ALTER TABLE ONLY "public"."order_notification_events"
    ADD CONSTRAINT "order_notification_events_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."pickup_cutoff_rules"
    ADD CONSTRAINT "pickup_cutoff_rules_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."pickup_overrides"
    ADD CONSTRAINT "pickup_overrides_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."pickup_dates"
    ADD CONSTRAINT "pickup_dates_pickup_date_unique" UNIQUE ("pickup_date");
ALTER TABLE ONLY "public"."pickup_dates"
    ADD CONSTRAINT "pickup_dates_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."pickup_dates"
    ADD CONSTRAINT "pickup_dates_schedule_id_pickup_date_key" UNIQUE ("schedule_id", "pickup_date");
ALTER TABLE ONLY "public"."pickup_date_locations"
    ADD CONSTRAINT "pickup_date_locations_pkey" PRIMARY KEY ("pickup_date_id", "location_id");
ALTER TABLE ONLY "public"."pickup_schedule_locations"
    ADD CONSTRAINT "pickup_schedule_locations_pkey" PRIMARY KEY ("schedule_id", "location_id");
ALTER TABLE ONLY "public"."pickup_schedules"
    ADD CONSTRAINT "pickup_schedules_legacy_day_key_key" UNIQUE ("legacy_day_key");
ALTER TABLE ONLY "public"."pickup_schedules"
    ADD CONSTRAINT "pickup_schedules_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."pickup_schedules"
    ADD CONSTRAINT "pickup_schedules_schedule_key_key" UNIQUE ("schedule_key");
ALTER TABLE ONLY "public"."product_date_inventory"
    ADD CONSTRAINT "product_date_inventory_pkey" PRIMARY KEY ("pickup_date_id", "product_id");
ALTER TABLE ONLY "public"."product_schedule_capacity"
    ADD CONSTRAINT "product_schedule_capacity_pkey" PRIMARY KEY ("schedule_id", "product_id");
ALTER TABLE public.orders ADD COLUMN client_request_reference text UNIQUE;
CREATE OR REPLACE FUNCTION public.materialize_pickup_dates_v2(p_start_date date, p_end_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_inserted integer := 0;
  v_inserted_date_ids uuid[] := ARRAY[]::uuid[];
  v_date record;
  v_override public.pickup_overrides%ROWTYPE;
  v_custom_cutoff_weekday integer;
  v_custom_cutoff_date date;
  v_today_bangkok date := timezone('Asia/Bangkok', now())::date;
BEGIN
  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = v_user_id AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin authorization required' USING ERRCODE = '42501';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RAISE EXCEPTION 'A valid pickup date range is required';
  END IF;
  IF p_start_date < v_today_bangkok THEN
    RAISE EXCEPTION 'Pickup date materialization cannot start in the past';
  END IF;
  /* Difference 365 means exactly 366 inclusive calendar dates. */
  IF p_end_date - p_start_date >= 366 THEN
    RAISE EXCEPTION 'Pickup date materialization is limited to 366 inclusive days per call';
  END IF;

  /*
    Stabilize both recurring v2 configuration and the transitional legacy
    override bridge. These tables are intentionally small Admin configuration
    tables. SHARE allows SELECT/ROW SHARE readers but blocks DML until this
    transaction finishes, including inserts of rows that row-level locks cannot
    protect against.

    Lock order begins with cms_pickup_locations, matching the v2 Admin lock
    order established by the preceding integrity migration.
  */
  LOCK TABLE public.cms_pickup_locations IN SHARE MODE;
  LOCK TABLE public.pickup_schedules IN SHARE MODE;
  LOCK TABLE public.pickup_schedule_locations IN SHARE MODE;
  LOCK TABLE public.product_schedule_capacity IN SHARE MODE;
  LOCK TABLE public.pickup_cutoff_rules IN SHARE MODE;
  LOCK TABLE public.pickup_overrides IN SHARE MODE;

  /*
    Existing concrete dates are independent snapshots, but legacy-override
    refreshes below can mutate non-manual dates. Serialize those date rows with
    concrete-date Admin writes while leaving recurring configuration protected
    by the table locks above.
  */
  PERFORM d.id
  FROM public.pickup_dates d
  WHERE d.pickup_date BETWEEN p_start_date AND p_end_date
  ORDER BY d.id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.pickup_schedules s
    WHERE s.is_active = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.pickup_schedule_locations sl
        JOIN public.cms_pickup_locations l ON l.id = sl.location_id
        WHERE sl.schedule_id = s.id
          AND sl.is_active = true
          AND l.is_active = true
      )
  ) THEN
    RAISE EXCEPTION 'Every active pickup schedule requires at least one globally active pickup location before materialization';
  END IF;

  /*
    Capture exactly the rows inserted by THIS call. Recurring locations and
    capacities are copied only to those new dates. Re-running materialization
    therefore cannot expand an existing generated/manual date snapshot.
  */
  WITH inserted_dates AS (
    INSERT INTO public.pickup_dates (
      schedule_id, pickup_date, order_cutoff_at, cancellation_cutoff_at, status, source
    )
    SELECT
      s.id,
      gs.day_value::date,
      (((gs.day_value::date - s.order_cutoff_days_before::integer) + s.order_cutoff_time)
        AT TIME ZONE 'Asia/Bangkok'),
      (((gs.day_value::date - s.cancellation_cutoff_days_before::integer) + s.cancellation_cutoff_time)
        AT TIME ZONE 'Asia/Bangkok'),
      'open',
      'generated'
    FROM public.pickup_schedules s
    CROSS JOIN LATERAL generate_series(
      p_start_date::timestamp,
      p_end_date::timestamp,
      interval '1 day'
    ) AS gs(day_value)
    WHERE s.is_active = true
      AND extract(dow FROM gs.day_value)::integer = s.pickup_weekday
    ON CONFLICT (schedule_id, pickup_date) DO NOTHING
    RETURNING id
  )
  SELECT
    COALESCE(array_agg(id), ARRAY[]::uuid[]),
    count(*)::integer
  INTO v_inserted_date_ids, v_inserted
  FROM inserted_dates;

  INSERT INTO public.pickup_date_locations (
    pickup_date_id, location_id, is_active, sort_order
  )
  SELECT d.id, sl.location_id, true, sl.sort_order
  FROM public.pickup_dates d
  JOIN public.pickup_schedule_locations sl ON sl.schedule_id = d.schedule_id
  JOIN public.cms_pickup_locations l ON l.id = sl.location_id
  WHERE d.id = ANY(v_inserted_date_ids)
    AND sl.is_active = true
    AND l.is_active = true
  ON CONFLICT (pickup_date_id, location_id) DO NOTHING;

  INSERT INTO public.product_date_inventory (
    pickup_date_id, product_id, capacity, reserved_quantity, capacity_source
  )
  SELECT d.id, c.product_id, c.capacity, 0, 'recurring_default'
  FROM public.pickup_dates d
  JOIN public.product_schedule_capacity c ON c.schedule_id = d.schedule_id
  WHERE d.id = ANY(v_inserted_date_ids)
    AND c.is_active = true
  ON CONFLICT (pickup_date_id, product_id) DO NOTHING;

  /*
    Transitional legacy overrides may still be refreshed on non-manual dates.
    Explicit Admin concrete-date edits remain protected by source='manual'.
  */
  UPDATE public.pickup_dates d
  SET order_cutoff_at = (((d.pickup_date - s.order_cutoff_days_before::integer) + s.order_cutoff_time)
        AT TIME ZONE 'Asia/Bangkok'),
      cancellation_cutoff_at = (((d.pickup_date - s.cancellation_cutoff_days_before::integer) + s.cancellation_cutoff_time)
        AT TIME ZONE 'Asia/Bangkok'),
      status = 'open',
      note_en = NULL,
      note_th = NULL,
      note_zh = NULL,
      source = 'generated',
      updated_at = now()
  FROM public.pickup_schedules s
  WHERE d.schedule_id = s.id
    AND d.pickup_date BETWEEN p_start_date AND p_end_date
    AND d.source = 'legacy_override';

  FOR v_date IN
    SELECT d.id, d.pickup_date, d.source, s.pickup_weekday, s.legacy_day_key
    FROM public.pickup_dates d
    JOIN public.pickup_schedules s ON s.id = d.schedule_id
    WHERE d.pickup_date BETWEEN p_start_date AND p_end_date
      AND s.legacy_day_key IS NOT NULL
      AND d.source <> 'manual'
    ORDER BY d.id
  LOOP
    SELECT o.* INTO v_override
    FROM public.pickup_overrides o
    JOIN public.pickup_cutoff_rules r
      ON r.day_key = v_date.legacy_day_key
     AND r.pickup_day = o.pickup_day
     AND r.location = o.location
    WHERE o.date = v_date.pickup_date
      AND COALESCE(o.is_active, false) = true
    ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC NULLS LAST
    LIMIT 1;

    IF FOUND THEN
      IF v_override.override_type = 'closed' THEN
        UPDATE public.pickup_dates
        SET status = 'closed',
            note_en = NULLIF(v_override.note_en, ''),
            note_th = NULLIF(v_override.note_th, ''),
            source = 'legacy_override',
            updated_at = now()
        WHERE id = v_date.id
          AND source <> 'manual';
      ELSIF v_override.override_type = 'sold_out' THEN
        UPDATE public.pickup_dates
        SET status = 'sold_out',
            note_en = NULLIF(v_override.note_en, ''),
            note_th = NULLIF(v_override.note_th, ''),
            source = 'legacy_override',
            updated_at = now()
        WHERE id = v_date.id
          AND source <> 'manual';
      ELSIF v_override.override_type = 'custom_cutoff' THEN
        v_custom_cutoff_weekday := CASE v_override.custom_cutoff_day
          WHEN 'Sunday' THEN 0
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          ELSE NULL
        END;
        IF v_custom_cutoff_weekday IS NULL OR v_override.custom_cutoff_time IS NULL THEN
          RAISE EXCEPTION 'Invalid legacy custom cutoff for pickup date %', v_date.pickup_date;
        END IF;
        v_custom_cutoff_date := v_date.pickup_date
          - ((v_date.pickup_weekday - v_custom_cutoff_weekday + 7) % 7);
        UPDATE public.pickup_dates
        SET order_cutoff_at = ((v_custom_cutoff_date + v_override.custom_cutoff_time::time)
              AT TIME ZONE 'Asia/Bangkok'),
            note_en = NULLIF(v_override.note_en, ''),
            note_th = NULLIF(v_override.note_th, ''),
            source = 'legacy_override',
            updated_at = now()
        WHERE id = v_date.id
          AND source <> 'manual';
      END IF;
    END IF;
  END LOOP;

  RETURN v_inserted;
END;
$function$

;
