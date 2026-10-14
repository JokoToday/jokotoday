-- ISOLATED LOCAL TEST DATABASE ONLY. Extends the foundation fixture with commerce contracts.
ALTER TABLE public.user_profiles ADD COLUMN name text DEFAULT 'Customer', ADD COLUMN phone text DEFAULT '0812345678',ADD COLUMN email text,ADD COLUMN line_id text,ADD COLUMN profile_completed boolean DEFAULT true;
ALTER TABLE public.cms_products ADD COLUMN name_th text DEFAULT 'ขนม',ADD COLUMN name_zh text,ADD COLUMN image text;
ALTER TABLE public.cms_pickup_locations ADD COLUMN name_en text DEFAULT 'Bakery',ADD COLUMN name_th text DEFAULT 'ร้าน',ADD COLUMN name_zh text,ADD COLUMN maps_url text;
CREATE SEQUENCE public.online_order_number_seq;
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
ALTER TABLE public.orders ADD PRIMARY KEY(id);
GRANT SELECT,UPDATE,INSERT ON public.orders TO authenticated;
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'easyslip',
  rail text NOT NULL DEFAULT 'promptpay',
  currency text NOT NULL DEFAULT 'THB',
  amount_due numeric(10,2) NOT NULL CHECK (amount_due > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verifying','verified','failed','expired','cancelled')),
  provider_transaction_ref text,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_transactions_order_unique UNIQUE (order_id)
);
CREATE UNIQUE INDEX payment_ref_unique ON public.payment_transactions(provider,provider_transaction_ref) WHERE provider_transaction_ref IS NOT NULL;
CREATE TABLE public.order_notification_events(order_id uuid,notification_type text,status text, UNIQUE(order_id,notification_type));
CREATE FUNCTION public.cancel_online_order(p_order_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
 UPDATE public.orders SET status='cancelled' WHERE id=p_order_id; RETURN '{}';
END $$;
CREATE FUNCTION public.staff_record_order_payment_v2(p_order_id uuid,p_payment_method text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
 UPDATE public.orders SET payment_status='paid' WHERE id=p_order_id; RETURN '{}';
END $$;
CREATE FUNCTION public.confirm_order_pickup(p_order_id uuid) RETURNS SETOF public.orders LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
 RETURN QUERY UPDATE public.orders SET status='picked_up' WHERE id=p_order_id RETURNING *;
END $$;
CREATE FUNCTION public.expire_payment_transaction_v1(p_payment_transaction_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
 UPDATE public.payment_transactions SET status='expired' WHERE id=p_payment_transaction_id; RETURN '{}';
END $$;
CREATE FUNCTION public.finalize_verified_payment_v1(p_payment_transaction_id uuid,p_provider_transaction_ref text,p_amount_in_slip numeric,p_account_matched boolean,p_amount_matched boolean,p_provider_duplicate boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
 RETURN '{}';
END $$;

GRANT SELECT ON public.payment_transactions TO service_role;

CREATE TABLE public.loyalty_settings(purchase_type text,points_per_baht numeric);
INSERT INTO public.loyalty_settings VALUES('online',0.5);
CREATE OR REPLACE FUNCTION "public"."calculate_loyalty_points_on_order"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_rate numeric; v_purchase_type text; v_earning_amount numeric;
BEGIN
  v_purchase_type := COALESCE(NEW.purchase_type, 'online');
  SELECT ls.points_per_baht INTO v_rate FROM public.loyalty_settings ls WHERE ls.purchase_type = v_purchase_type;
  v_rate := COALESCE(v_rate, 0);
  v_earning_amount := CASE WHEN v_purchase_type = 'walk_in' AND NEW.amount_paid IS NOT NULL THEN NEW.amount_paid ELSE NEW.total_amount END;
  NEW.loyalty_points_earned := round(COALESCE(v_earning_amount, 0) * v_rate);
  NEW.loyalty_multiplier := v_rate;
  RETURN NEW;
END; $$;
CREATE TRIGGER orders_calculate_loyalty BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.calculate_loyalty_points_on_order();

-- Regular payment-mode selector contract for replaying the actual Stripe migration.
CREATE TABLE public.payment_settings(id boolean PRIMARY KEY, payment_qr_mode text NOT NULL,
 CONSTRAINT payment_settings_payment_qr_mode_check CHECK(payment_qr_mode IN ('promptpay_legacy','kshop_easyslip','kshop_master')));
INSERT INTO public.payment_settings VALUES(true,'kshop_master');

-- Existing profile read contract used by the checkout SELECT policy.
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.user_profiles TO authenticated;
CREATE POLICY fixture_profile_own_read ON public.user_profiles FOR SELECT TO authenticated USING(id=auth.uid());
