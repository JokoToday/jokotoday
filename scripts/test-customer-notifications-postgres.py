"""Real PostgreSQL races in a disposable local fixture; no dispatcher or provider calls."""
import os
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = os.environ.get("NOTIFICATION_TEST_CONTAINER", "supabase_db_joko-notifications-paused")
DATABASE = os.environ.get("NOTIFICATION_TEST_DATABASE", "notifications_resume_concurrency")
if CONTAINER != "supabase_db_joko-notifications-paused" or not DATABASE.startswith("notifications_resume_"):
    raise SystemExit("Only the isolated paused test container and disposable test databases are allowed")
BASE = ["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", DATABASE, "-At", "-v", "ON_ERROR_STOP=1"]

def sql(statement):
    return subprocess.run(BASE, input=statement, text=True, capture_output=True, check=True).stdout.strip()

def start():
    return subprocess.Popen(BASE, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

subprocess.run(["docker", "exec", CONTAINER, "createdb", "-U", "postgres", DATABASE], check=True)
fixture = (ROOT / "supabase/tests/pickup_windows_fixture.sql").read_text().replace("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;", "")
sql(fixture)
sql("""CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
CREATE TABLE auth.identities(user_id uuid,provider text,provider_id text,identity_data jsonb);
CREATE TABLE public.payment_transactions(order_id uuid UNIQUE,status text,expires_at timestamptz);""")
for suffix in ("_pickup_windows_v1_foundation.sql", "_customer_notification_delivery_v1.sql"):
    sql(next((ROOT / "supabase/migrations").glob("*" + suffix)).read_text())
admin = "00000000-0000-4000-8000-000000000001"
customer = "00000000-0000-4000-8000-000000000002"
location = "00000000-0000-4000-8000-000000000003"
schedule = "00000000-0000-4000-8000-000000000004"
date = "00000000-0000-4000-8000-000000000005"
sql(f"""INSERT INTO public.user_profiles VALUES('{admin}','admin','en'),('{customer}','customer','en');
INSERT INTO auth.users VALUES('{customer}','synthetic@example.invalid',now(),null,null);
INSERT INTO public.cms_pickup_locations(id,name_en,name_th) VALUES('{location}','Test place','Test place');
INSERT INTO public.pickup_schedules(id,schedule_key,label_en,pickup_weekday,order_cutoff_days_before,order_cutoff_time) VALUES('{schedule}','sun','Sunday',0,2,'17:00');
INSERT INTO public.pickup_dates(id,schedule_id,pickup_date,order_cutoff_at,cancellation_cutoff_at) VALUES('{date}','{schedule}',timezone('Asia/Bangkok',now())::date+1,now()+interval '12 hours',now()+interval '12 hours');
INSERT INTO public.pickup_date_locations(pickup_date_id,location_id,pickup_open_time,pickup_close_time,pickup_slot_minutes) VALUES('{date}','{location}','09:00','13:00',30);""")
order_sql = f"""INSERT INTO public.orders(order_number,total_amount,customer_id,customer_name,customer_phone,pickup_date,pickup_date_id,pickup_location_id,created_at,purchase_type)
VALUES('activation-race',25,'{customer}','Synthetic','000',timezone('Asia/Bangkok',now())::date+1,'{date}','{location}',clock_timestamp(),'online');"""
# Hold the activation transaction open while a separate order transaction starts.
activation = start()
activation.stdin.write(f"BEGIN; SELECT set_config('request.jwt.claim.sub','{admin}',false); SELECT public.admin_notification_setting_v1('pickup_reminder',true,true,false,1440,1);\nSELECT 'POLICY_LOCK_HELD';\nSELECT pg_sleep(2); COMMIT;\n")
activation.stdin.close()
while True:
    line = activation.stdout.readline()
    if "POLICY_LOCK_HELD" in line:
        break
    if not line:
        raise AssertionError(activation.stderr.read())
t0 = time.monotonic()
sql(order_sql)
assert time.monotonic() - t0 > 1, "enqueue did not wait for uncommitted activation"
assert activation.wait(timeout=10) == 0, activation.stderr.read()
assert sql("select count(*) from public.order_notification_events where worker_owner='unified'") == "1"
print("PASS: concurrent activation enrolls the waiting order exactly once")
sql(f"""SELECT set_config('request.jwt.claim.sub','{admin}',false);
SELECT public.admin_notification_pause_v1(false,false,true,(select updated_at from private.notification_control_v1));
UPDATE public.order_notification_events SET scheduled_for=now()-interval '1 minute',expires_at=now()+interval '1 day';
UPDATE public.notification_deliveries SET next_attempt_at=now();""")
workers = [start() for _ in range(2)]
for worker in workers:
    worker.stdin.write("SELECT public.notification_claim_v1('email') IS NOT NULL;\n")
    worker.stdin.close()
outputs = []
for worker in workers:
    assert worker.wait(timeout=10) == 0, worker.stderr.read()
    outputs.append(worker.stdout.read().strip())
assert sorted(outputs) == ['f', 't'], outputs
assert sql("select count(*) from public.notification_delivery_attempts") == '1'
print("PASS: concurrent workers grant exactly one lease and one attempt")
# Channel suppression retains active sends; after finishing, a fresh Email-only event terminates.
sql(f"""SELECT set_config('request.jwt.claim.sub','{admin}',false);
SELECT public.notification_line_context_v1('123','U22222222222222222222222222222222');
SELECT public.admin_notification_setting_v1('pickup_reminder',true,false,true,1440,2);""")
assert sql("select event_state from public.order_notification_events where worker_owner='unified'") in ('scheduled', 'ready')
sql("select public.notification_finish_v1(id,lease_token,'permanent',null,'synthetic test') from public.notification_deliveries where status='sending';")
sql(f"""SELECT set_config('request.jwt.claim.sub','{admin}',false);
SELECT public.admin_notification_setting_v1('pickup_reminder',true,true,false,1440,3);""")
sql(order_sql.replace('activation-race', 'channel-switch'))
sql(f"""SELECT set_config('request.jwt.claim.sub','{admin}',false);
SELECT public.admin_notification_setting_v1('pickup_reminder',true,false,true,1440,4);""")
assert sql("select event_state from public.order_notification_events e join public.orders o on o.id=e.order_id where o.order_number='channel-switch'") == 'completed'
assert sql("select count(*) from public.notification_deliveries d join public.order_notification_events e on e.id=d.event_id join public.orders o on o.id=e.order_id where o.order_number='channel-switch'") == '1'
print("PASS: channel switching preserves active leases and completes suppressed pending events")
print("PASS: isolated PostgreSQL concurrency checks; no external sends")
