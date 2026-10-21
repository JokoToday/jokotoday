"""Run the real Store customer RPC in an isolated throwaway PostgreSQL database."""
import os, subprocess, uuid
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = 'supabase_db_joko-notifications-paused'
if os.getenv('STORE_CONCURRENCY_ALLOW') != 'LOCAL_DISPOSABLE':
    raise SystemExit('Only LOCAL_DISPOSABLE test execution is allowed')
DB = 'store_concurrency_' + uuid.uuid4().hex[:12]

def docker(*args, payload=None):
    r = subprocess.run(['docker','exec','-i',CONTAINER,*args],input=payload,text=True,capture_output=True)
    if r.returncode: raise AssertionError(r.stderr[-2400:])
    return r.stdout.strip()

def sql(query):
    return docker('psql','-X','-U','postgres','-d',DB,'-A','-t','-v','ON_ERROR_STOP=1',payload=query)

docker('createdb','-U','postgres',DB)
try:
    sql("""
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.store_payment_policy(policy_key text primary key,checkout_enabled boolean,fallback_enabled boolean);
create table public.user_profiles(id uuid primary key,name text,phone text,email text);
create table public.cms_products(id uuid primary key,price numeric,name_en text,catalog_scope text,is_active boolean,is_sold_out boolean);
create table public.store_product_assignments(product_id uuid,is_published boolean);
create table public.store_fulfillment_settings(product_id uuid primary key,stock_on_hand integer,stock_reserved integer,ordering_enabled boolean,pickup_today boolean,updated_at timestamptz);
create table public.store_reservation_batches(id uuid primary key default gen_random_uuid(),request_key uuid unique,expires_at timestamptz,state text default 'held',amount_due numeric);
create table public.store_reservation_items(batch_id uuid,product_id uuid,quantity integer,unit_price numeric);
create table public.orders(id uuid primary key default gen_random_uuid(),order_number text,customer_id uuid,order_items jsonb,total_amount numeric,customer_name text,customer_phone text,customer_email text,notes text,order_type text,pickup_date date,purchase_type text,payment_status text default 'unpaid');
create table public.store_fulfillment_groups(batch_id uuid,group_kind text,method text);
create table public.store_order_payment_modes(order_id uuid,payment_mode text);
create table public.payment_transactions(id uuid primary key default gen_random_uuid(),order_id uuid,customer_id uuid,amount_due numeric,expires_at timestamptz,payment_mode text,provider text);
create table public.store_payment_links(batch_id uuid,order_id uuid,payment_transaction_id uuid,provider text);
create function public.fixture_payment_mode() returns trigger language plpgsql as $$
begin
  select payment_mode into new.payment_mode from public.store_order_payment_modes where order_id=new.order_id;
  new.provider:=case when new.payment_mode='stripe_promptpay' then 'stripe' else 'easyslip' end;
  return new;
end $$;
create trigger fixture_payment_mode before insert on public.payment_transactions for each row execute function public.fixture_payment_mode();
""")
    sql((ROOT/'supabase/migrations/20261020190000_store_customer_checkout_v1.sql').read_text())
    user,product,other = [str(uuid.uuid4()) for _ in range(3)]
    sql(f"""
insert into public.store_payment_policy values('default',false,false);
insert into public.user_profiles values('{user}','Checkout Test','0810000000','test@example.invalid');
insert into public.cms_products values('{product}',120,'Test flour','store_only',true,false);
insert into public.store_product_assignments values('{product}',true);
insert into public.store_fulfillment_settings values('{product}',2,0,true,true,now());
""")
    items = f"""'[{{"product_id":"{product}","quantity":1,"price":0.01}}]'::jsonb"""
    def invoke(key,mode='kshop_master',sku=None,qty=None,who=user):
        ln=items if sku is None else f"""'[{{"product_id":"{sku}","quantity":{qty or 1}}}]'::jsonb"""
        return sql(f"""begin; select set_config('request.jwt.claim.sub','{who}',true);
select public.create_store_customer_order_v1('{key}'::uuid,{ln},'{mode}')::text; commit;""")
    key = str(uuid.uuid4())
    try: invoke(key)
    except AssertionError as e: assert 'Store checkout is not yet enabled' in str(e)
    else: raise AssertionError('Disabled policy accepted order')
    assert sql('select count(*) from public.orders')=='0'
    sql("update public.store_payment_policy set checkout_enabled=true,fallback_enabled=true")
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _:invoke(key),[0,1]))
    assert sum('"idempotent_replay": false' in result for result in results)==1,results
    assert sum('"idempotent_replay": true' in result for result in results)==1,results
    assert sql('select count(*) from public.orders')=='1'
    assert sql(f"select stock_on_hand||'|'||stock_reserved from public.store_fulfillment_settings where product_id='{product}'")=='2|1'
    assert float(sql('select total_amount from public.orders'))==120
    assert sql("select payment_mode||'|'||provider from payment_transactions")=='kshop_master|easyslip'
    print('PASS: concurrent checkout replay creates one order, reserves one unit, server price 120, EasySlip label')
    try: invoke(str(uuid.uuid4()),sku=product,qty=2)
    except AssertionError as e: assert 'Store item unavailable' in str(e)
    else: raise AssertionError('Oversell not rejected')
    assert sql('select count(*) from public.orders')=='1'
    print('PASS: oversell rejected with no partial order')
    second=str(uuid.uuid4())
    sql(f"update public.store_fulfillment_settings set stock_on_hand=3 where product_id='{product}'")
    result=invoke(second,mode='stripe_promptpay')
    assert '"idempotent_replay": false' in result
    assert sql("select payment_mode||'|'||provider from payment_transactions where payment_mode='stripe_promptpay'")=='stripe_promptpay|stripe'
    print('PASS: Stripe PromptPay payment mode snapshot')
finally:
    docker('dropdb','-U','postgres','--if-exists','--force',DB)
