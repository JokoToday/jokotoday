"""Two committed PostgreSQL payment callbacks, in a disposable *local* test database.

No external API, real orders, service credentials, or production database access.
Loads the repository's actual finalizer, Store stock reconciler and expiry guard.
"""
import concurrent.futures
import os
import re
import subprocess
from pathlib import Path
from uuid import uuid4

ROOT=Path(__file__).resolve().parents[1]
CONTAINER="supabase_db_joko-notifications-paused"
DB="store_concurrency_"+uuid4().hex[:12]
assert re.fullmatch(r"store_concurrency_[0-9a-f]{12}",DB)
if os.environ.get("STORE_CONCURRENCY_ALLOW")!="LOCAL_DISPOSABLE":
    raise SystemExit("Set STORE_CONCURRENCY_ALLOW=LOCAL_DISPOSABLE")
def docker(*args,input=None):
    p=subprocess.run(["docker","exec","-i",CONTAINER,*args],input=input,text=True,capture_output=True)
    if p.returncode: raise RuntimeError(p.stderr[-3000:])
    return p.stdout.strip()
def sql(stmt):
    return docker("psql","-X","-v","ON_ERROR_STOP=1","-A","-t","-U","postgres","-d",DB,input=stmt)
def fn(path,first,last):
    source=(ROOT/path).read_text()
    a=source.index(first)
    b=source.index(last,a)+len(last)
    return source[a:b]

docker("createdb","-U","postgres",DB)
try:
    sql("""
create schema auth;
create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
create table public.orders(
id uuid primary key,customer_id uuid,order_number text,status text,
payment_status text,amount_paid numeric,total_amount numeric,
loyalty_discount_amount numeric default 0, payment_method text,
purchase_type text default 'online',picked_up_at timestamptz,
updated_at timestamptz default now());
create table public.payment_transactions(
id uuid primary key,order_id uuid references public.orders(id),payment_mode text,
customer_id uuid,provider text,provider_transaction_ref text,
status text,amount_due numeric,expires_at timestamptz,
verified_at timestamptz,last_error_code text,last_error_message text,
updated_at timestamptz default now());
create table public.loyalty_redemptions(id uuid,order_id uuid,status text,reward_snapshot jsonb);
create table public.user_profiles(id uuid primary key,preferred_language text);
create table public.order_notification_events(order_id uuid,notification_type text,language text,
unique(order_id,notification_type));
create table public.cms_products(id uuid primary key);
create table public.store_fulfillment_settings(product_id uuid primary key,stock_on_hand int,
stock_reserved int,updated_at timestamptz default now());
create table public.store_reservation_batches(id uuid primary key,state text,
expires_at timestamptz,amount_due numeric,payment_state text default 'pending',
verified_at timestamptz,released_at timestamptz);
create table public.store_reservation_items(batch_id uuid,product_id uuid,quantity int,unit_price numeric);
create table public.store_fulfillment_groups(batch_id uuid,group_kind text);
create table public.store_payment_links(
batch_id uuid primary key,order_id uuid,payment_transaction_id uuid,provider text);
""")
    # Load the actual repository source, not a hand-written approximation.
    sql(fn(Path("supabase/migrations/20261009103000_payment_safety_hardening_v1.sql"),
           "CREATE OR REPLACE FUNCTION public.finalize_verified_payment_v1(",
           "$payment$;"))
    sql(fn(Path("supabase/migrations/20261018193000_store_payment_link_v1.sql"),
           "create or replace function public.service_reconcile_store_verified_v1(",
           "end $$;"))
    guard=(ROOT/"supabase/migrations/20261020113000_store_verified_expiry_guard_v1.sql").read_text()
    sql(guard)
    order,payment,batch,product=(str(uuid4()) for _ in range(4))
    ref="SYNTHETIC-NOT-A-BANK-REF-"+uuid4().hex
    sql(f"""
insert into orders(id,customer_id,order_number,status,payment_status,total_amount)
values('{order}','{product}','CONCURRENCY-ONLY','pending','unpaid',10);
insert into user_profiles(id,preferred_language) values('{product}','en');
insert into cms_products(id) values('{product}');
insert into store_fulfillment_settings(product_id,stock_on_hand,stock_reserved)
values('{product}',5,1);
insert into store_reservation_batches(id,state,expires_at,amount_due)
values('{batch}','held',now()+interval '10 minutes',10);
insert into store_reservation_items(batch_id,product_id,quantity,unit_price)
values('{batch}','{product}',1,10);
insert into store_fulfillment_groups(batch_id,group_kind) values('{batch}','store');
insert into payment_transactions(id,order_id,customer_id,provider,status,amount_due,expires_at)
values('{payment}','{order}','{product}','easyslip','pending',10,now()+interval '10 minutes');
update payment_transactions set payment_mode='kshop_master' where id='{payment}';
insert into store_payment_links(batch_id,order_id,payment_transaction_id,provider)
values('{batch}','{order}','{payment}','kshop_master');
""")
    # The Store reconciler reads payment_mode, added below through a local column.
    # Same schema member used by the real staging table.
    # Run two independent PostgreSQL connections and commit both.
    def callback(_):
        return sql(f"""begin;
select set_config('request.jwt.claim.role','service_role',true);
select coalesce((public.finalize_verified_payment_v1('{payment}','{ref}',10,true,true,false)->>'idempotent_replay'),'null');
select public.service_reconcile_store_verified_v1('{payment}');
commit;""")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(callback,(1,2)))
    print("CALLBACK RESULTS",results)
    assert sum("\nfalse\n" in "\n"+r+"\n" for r in results)==1,results
    assert sum("\ntrue\n" in "\n"+r+"\n" for r in results)==1,results
    assert all("confirmed" in r for r in results)
    state=sql(f"""select o.payment_status,t.status,b.state,s.stock_on_hand,s.stock_reserved,
(select count(*) from order_notification_events where order_id=o.id),
t.provider_transaction_ref
from orders o join payment_transactions t on t.order_id=o.id
join store_payment_links l on l.order_id=o.id
join store_reservation_batches b on b.id=l.batch_id
join store_reservation_items i on i.batch_id=b.id
join store_fulfillment_settings s on s.product_id=i.product_id
where o.id='{order}';""")
    assert state==f"paid|verified|confirmed|4|0|1|{ref}",state
    print("PASS: two committed callbacks; one original + one replay; one inventory deduction.")
    print("FINAL",state)
finally:
    docker("dropdb","-U","postgres","--if-exists","--force",DB)
