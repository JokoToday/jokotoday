#!/usr/bin/env python3
"""Create the reviewed Specials SQL bundle/manifest. Never contacts a database."""
import hashlib,json,re,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
names=[
'20261008101347_joko_specials_inventory_foundation_v1.sql',
'20261008110550_joko_specials_checkout_v1.sql',
'20261009025239_joko_specials_payment_compatibility_v1.sql',
'20261010144000_pickup_handover_v1.sql',
'20261011161020_joko_specials_catalogue_products_v1.sql',
'20261012094221_joko_specials_pickup_handover_v1.sql',
'20261012100247_joko_specials_main_payment_guards_v1.sql',
'20261012144155_joko_specials_dual_payment_rails_v1.sql',
'20261013024901_joko_specials_receipt_compatibility_v1.sql',
'20261014040517_joko_specials_noncard_refund_evidence_v1.sql',
'20261014041822_joko_specials_release_guards_v1.sql']
preflight="""-- PREPARED ONLY. Apply only after explicit production rollout approval.
-- This bundle assumes the independently approved current-main notification-preferences rollout is complete.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
DO $preflight$
BEGIN
 IF to_regclass('public.specials_batches') IS NOT NULL THEN RAISE EXCEPTION 'Specials already exists; inspect migration history instead of reapplying'; END IF;
 IF to_regprocedure('public.resolve_customer_notification_recipient_v1(uuid,text)') IS NULL THEN RAISE EXCEPTION 'Complete the current-main notification-preferences rollout first'; END IF;
 IF to_regprocedure('public.notification_channel_allowed_v1(uuid,text)') IS NULL THEN RAISE EXCEPTION 'Complete current-main legacy notification pause-gate rollout first'; END IF;
 -- Preserve independently approved transactional notification controls; this bundle does not change them.
END $preflight$;
"""
parts=[preflight];entries=[]
for name in names:
 raw=(root/'supabase/migrations'/name).read_text();version,label=name[:-4].split('_',1)
 sql=re.sub(r'^\s*(BEGIN|COMMIT);\s*$', '',raw,flags=re.M)
 parts.append(f'\n-- {name}\n'+sql)
 quoted=raw.replace("'","''")
 parts.append(f"\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('{version}','{label}',ARRAY['{quoted}']);\n")
 entries.append({'file':name,'sha256':hashlib.sha256(raw.encode()).hexdigest()})
parts.append("\nUPDATE specials_private.settings SET enabled=false,payment_mode='stripe_promptpay';\nCOMMIT;\n")
output=root/'supabase/operations/specials-production-rollout-20261014.sql'
output.write_text(''.join(parts))
functions={'stripe-promptpay-intent':True,'stripe-webhook':False,'specials-retry-stripe-refund':True,'specials-merchant-config':True,'create-pickup-handover':True,'pickup-handover-status':False,'confirm-specials-pickup-receipt':False,'bypass-pickup-receipt':True,'specials-line-send':True,'send-payment-confirmation':True}
manifest={'production_project':'xvhualoeboobulwgmkla','test_project':'szijiljpasxddzgzckra','reviewed_main':subprocess.check_output(['git','rev-parse','origin/main'],cwd=root,text=True).strip(),'migrations':entries,'sql_bundle_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'edge_functions':[{'name':n,'verify_jwt':v,'sha256':hashlib.sha256((root/'supabase/functions'/n/'index.ts').read_bytes()).hexdigest()} for n,v in functions.items()],'launch':{'payment_mode':'stripe_promptpay','payments_enabled_until_smoke_test':False,'SPECIALS_LINE_ENABLED':'false','VITE_SPECIALS_LINE_ENABLED':'false','VITE_SPECIALS_EASYSLIP_ENABLED':'false','scheduled_notifications':'preserve existing controls'},'test_data_imported':False,'shared_function_sources':[{'file':str(p.relative_to(root)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted((root/'supabase/functions/_shared').glob('*.ts'))],'required_database_functions':['public.resolve_customer_notification_recipient_v1(uuid,text)','public.notification_channel_allowed_v1(uuid,text)']}
(root/'docs/specials/production-release-manifest-20261014.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Prepared {len(entries)} migrations, {len(functions)} endpoints; no database contacted. SQL SHA256: {manifest["sql_bundle_sha256"]}')
