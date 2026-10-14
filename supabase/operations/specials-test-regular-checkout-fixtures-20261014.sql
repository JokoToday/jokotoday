-- TEST ONLY: JOKO Specials Test, szijiljpasxddzgzckra.
-- Prepared fixtures. Never include this file in the production rollout.
BEGIN;
DO $check$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM cms_products WHERE id='10000000-0000-0000-0000-000000000002' AND name_en='TEST — Butter Croissant') THEN RAISE EXCEPTION 'Expected sandbox product absent; wrong project or changed fixture'; END IF;
 IF NOT EXISTS(SELECT 1 FROM cms_pickup_locations WHERE id='20000000-0000-0000-0000-000000000001' AND name_en='Test Mae Rim') THEN RAISE EXCEPTION 'Expected sandbox location absent'; END IF;
END $check$;
INSERT INTO pickup_schedules(id,schedule_key,label_en,label_th,pickup_weekday,order_cutoff_days_before,order_cutoff_time,cancellation_cutoff_days_before,cancellation_cutoff_time)
VALUES('30000000-0000-4000-8000-000000000014','test-specials-regression-saturday','TEST ONLY — Saturday checkout','ทดสอบเท่านั้น — รับวันเสาร์',6,2,'17:00',1,'00:00')
ON CONFLICT(id) DO NOTHING;
INSERT INTO pickup_schedule_locations(schedule_id,location_id,pickup_open_time,pickup_close_time,pickup_slot_minutes)
VALUES('30000000-0000-4000-8000-000000000014','20000000-0000-0000-0000-000000000001','09:00','17:00',30)
ON CONFLICT(schedule_id,location_id) DO NOTHING;
INSERT INTO pickup_dates(id,schedule_id,pickup_date,order_cutoff_at,cancellation_cutoff_at,status,source,note_en)
VALUES('40000000-0000-4000-8000-000000000014','30000000-0000-4000-8000-000000000014','2026-10-17','2026-10-15 17:00:00+07','2026-10-16 00:00:00+07','open','manual','TEST ONLY — Specials release regular-checkout regression')
ON CONFLICT(id) DO NOTHING;
INSERT INTO pickup_date_locations(pickup_date_id,location_id,pickup_open_time,pickup_close_time,pickup_slot_minutes)
VALUES('40000000-0000-4000-8000-000000000014','20000000-0000-0000-0000-000000000001','09:00','17:00',30)
ON CONFLICT(pickup_date_id,location_id) DO NOTHING;
INSERT INTO product_date_inventory(pickup_date_id,product_id,capacity,capacity_source,override_note)
VALUES('40000000-0000-4000-8000-000000000014','10000000-0000-0000-0000-000000000002',10,'manual_seed','TEST ONLY — no real stock')
ON CONFLICT(pickup_date_id,product_id) DO NOTHING;
INSERT INTO cms_settings(setting_key,value) VALUES('pickup_v2_customer_enabled','true'),('pickup_windows_required','true')
ON CONFLICT(setting_key) DO UPDATE SET value=EXCLUDED.value;
COMMIT;
