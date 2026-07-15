# Migrations

These are plain SQL files, run manually against the Supabase project's SQL
Editor — there is no CLI/automated migration runner wired up for this repo.
Most are written to be idempotent (`IF NOT EXISTS` / `ON CONFLICT` / `DROP ...
IF EXISTS` before `CREATE`), so re-running one that already applied is safe.

**Before running any of these, note that `custom_sections` itself has no
`CREATE TABLE` in this repo.** Several files below reference it via foreign
key or RLS policy, so it must already exist in the target database (it was
evidently created directly against Supabase, outside of this migrations
folder) — a genuinely fresh database needs that table created first.

## Recommended order for a fresh database

1. `auto_create_profile.sql` — creates the `profiles` table's signup/email-sync
   triggers.
2. `fix_profile_creation.sql` — supersedes #1 with more robust error handling
   and RLS policies on `profiles`.
3. `secure_profile_role_column.sql` — security fix: stops the signup trigger
   from trusting client-supplied `role` metadata, and blocks the `role`
   column from being changed by anything other than the service_role key.
   Must run after #2.
4. `homepage_sections.sql` — creates `homepage_sections` (requires
   `custom_sections` to already exist, see note above).
5. `add_custom_section_id_column.sql` — defensive re-add of a column already
   included in #4's `CREATE TABLE`; only matters if `homepage_sections` was
   created by some earlier/other version of that table.
6. `fix_homepage_sections_rls.sql` — corrects the admin-visibility RLS policy
   on `homepage_sections`.
7. `enhance_homepage_sections.sql` — adds `section_type`/`config` columns and
   backfills them.
8. `fix_custom_sections_rls.sql` — corrects the admin-management RLS policy
   on `custom_sections`.

## Diagnostics (not schema changes — safe to run any time, in any order)

- `check_custom_sections_policies.sql` — inspects current RLS policies on
  `custom_sections`.
- `diagnose_profile_issue.sql` — read-only queries to check why a profile
  wasn't created for a given user.
