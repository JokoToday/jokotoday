# JOKO TODAY Supabase Baseline

## Baseline

Canonical baseline cut:

- Date: 2026-08-26
- Migration version: `20260826030000`
- Source: validated current production database state

Fresh environments use:

1. `supabase/migrations/20260826030000_production_baseline.sql`
2. `supabase/seed.sql`

The previous 111-migration replay chain is preserved verbatim under:

`supabase/history/migrations-pre-baseline-20260826/`

It is retained for historical and audit purposes and is not used for fresh database bootstrap.

## Baseline scope

The canonical migration recreates:

- current `public` schema
- tables, views, functions and triggers
- Row Level Security configuration
- current grants / ACLs
- current JOKO Storage buckets
- current `storage.objects` policies

The canonical seed recreates current non-transactional application configuration, including:

- CMS categories, labels, pages, products and settings
- pickup locations and legacy pickup configuration
- Pickup / Inventory v2 schedule configuration
- Loyalty configuration
- social links

It deliberately excludes production/customer state including:

- Supabase Auth users
- user profiles
- customers
- orders
- inventory events
- product likes
- loyalty point ledger events
- loyalty redemptions
- notification events
- generated pickup-date state
- VIP magic-link rate-limit state

Those belong to disaster-recovery data restoration, not clean application bootstrap.

## Not included in this database baseline

This baseline is the canonical database/bootstrap layer, not a complete Supabase-project restoration by itself. It does not recreate:

- Supabase Auth project settings, providers, redirect URLs or email-hook configuration
- Edge Function deployments
- Edge Function secrets
- Storage object bytes/files
- external infrastructure or credentials

Those remain separate deployment/disaster-recovery concerns and must be restored or configured through their documented operational procedures.

The baseline intentionally reproduces the current production schema, privileges and Storage policies. Reproducing a production setting here is not an endorsement of that setting as the final security posture; hardening changes should be made separately through reviewed forward migrations.

## Validation

The baseline was validated against the production state by:

- reproducing the failure of the legacy migration chain on an empty Supabase database
- bootstrapping a fresh local Supabase database from the canonical baseline
- matching the non-ACL `public` schema to production
- matching the complete ACL statement set to production
- matching all three production Storage bucket definitions
- matching all eleven current JOKO Storage policies
- matching configuration-table row counts
- matching deterministic configuration-content hashes
- performing a final clean reset using the single squashed migration plus seed

Final result:

`FINAL CLEAN BOOTSTRAP ACCEPTANCE: PASS`

## Production migration-history warning

Archiving the historical migration files in Git does NOT by itself change the production database.

Production currently retains the original 111 applied migration-history records, while this branch has one active local migration version: `20260826030000`.

Do not run a production migration push or migration-history repair solely because this repository baseline exists.

Do not merge this baseline cutover into `main` until the production migration-history normalization runbook has been reviewed, explicitly approved and is ready to execute as the controlled follow-up cutover. Otherwise the repository migration set and production `supabase_migrations.schema_migrations` history will remain intentionally divergent, which can cause migration sync failures on future production pushes.

Any normalization of the production `supabase_migrations.schema_migrations` history is a separate controlled operational action and requires explicit approval and verification. After normalization, verify that local and remote migration versions match exactly before creating or pushing the next production migration.
