-- LOCAL ISOLATED TEST DATABASE ONLY. Never run this fixture on production.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
CREATE TABLE public.user_profiles(id uuid PRIMARY KEY REFERENCES auth.users,role text NOT NULL);
CREATE TABLE public.cms_products(id uuid PRIMARY KEY, name_en text, price numeric(10,2),is_active boolean,stock_remaining integer);
CREATE TABLE public.cms_pickup_locations(id uuid PRIMARY KEY,is_active boolean);
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003'),('00000000-0000-0000-0000-000000000004');
INSERT INTO public.user_profiles VALUES ('00000000-0000-0000-0000-000000000001','admin'),('00000000-0000-0000-0000-000000000002','customer'),('00000000-0000-0000-0000-000000000003','staff'),('00000000-0000-0000-0000-000000000004','product_staff');
INSERT INTO public.cms_products VALUES ('10000000-0000-0000-0000-000000000001','Country Sourdough',220,true,20),('10000000-0000-0000-0000-000000000002','Croissant',95,true,10),('10000000-0000-0000-0000-000000000003','Inactive product',50,false,10);
INSERT INTO public.cms_pickup_locations VALUES ('20000000-0000-0000-0000-000000000001',true),('20000000-0000-0000-0000-000000000002',false);
