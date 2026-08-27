# Database Migrations — Safety-First Workflow

**Read this before touching the database.**

WoodCraft OS runs on a single production MySQL database (Hostinger). There
is no separate staging or dev database. That is why the workflow below
looks paranoid — because it needs to be.

---

## What lives in this directory

```
packages/db/
├── prisma/
│   ├── schema.prisma                            # Prisma models (source of truth)
│   └── migrations/
│       ├── migration_lock.toml                  # Records provider = mysql
│       └── 0000_baseline/
│           └── migration.sql                    # Snapshot of the pre-migration
│                                                # production schema, marked
│                                                # applied via `migrate resolve`.
│                                                # NEVER re-executed in prod.
```

`0000_baseline/migration.sql` represents the physical schema that already
existed in production **before** formal Prisma migration history began. It
was generated from live production metadata via `prisma migrate diff
--from-empty --to-url <prod>` (a read-only Prisma command) and then
registered as already applied via `prisma migrate resolve --applied
0000_baseline` on 2026-08-27. Production tables were **not** re-created.

---

## Golden rules

1. **Never run `prisma migrate dev` against production.** It treats the DB
   as owned by the developer and will DROP columns / tables to bring the
   DB in line with `schema.prisma`. In this repo that command is exposed
   as `db:migrate:local-only` — the name is deliberate.
2. **Never run `prisma migrate reset` against production.** It DROPS AND
   RECREATES every table, then re-runs every migration from scratch. That
   would destroy the entire database. Exposed here as
   `db:reset:local-only-danger`.
3. **`prisma db push` bypasses migration history entirely.** It silently
   syncs `schema.prisma` to the connected DB — no migration file, no
   review, no history. Exposed here as `db:push:local-only-danger` (Slice
   6 rename) — the suffix is deliberate. Use it only against disposable
   MySQL containers when spelunking. After the baseline was registered,
   every schema change goes through the normal manual-SQL → PR review →
   `migrate deploy` flow instead.
4. **Never commit a migration you haven't reviewed line-by-line.** Prisma
   sometimes emits `DROP` statements when it thinks a column is stale. If
   you see a `DROP` you didn't expect, stop and investigate.

---

## Migration authoring (local, disposable DB)

You need a disposable MySQL to author migrations. **Do not point local
tools at the production `DATABASE_URL`.**

### Recommended: local Docker MySQL

```bash
docker run -d --rm --name woodcraft-dev-mysql \
  -e MYSQL_ROOT_PASSWORD=devpw \
  -e MYSQL_DATABASE=woodcraft_dev \
  -p 33306:3306 mysql:8

export DATABASE_URL="mysql://root:devpw@127.0.0.1:33306/woodcraft_dev"
```

(Note the non-standard port `33306` so it doesn't clash with a system
MySQL. Adjust as needed.)

### First-time bootstrap of the local DB

Apply the baseline against the empty container to bring it to production
parity, then apply any subsequent migrations:

```bash
npm run --prefix packages/db db:migrate:prod   # runs `prisma migrate deploy`
```

Now the local DB matches production structurally.

### Author a new migration

Two paths, choose based on scope:

**Path A — `migrate dev` against a disposable Docker MySQL** (fine when
the change is purely additive and does NOT touch any `Json`-declared
column):

```bash
# 1. Edit packages/db/prisma/schema.prisma
# 2. Generate + apply against the local Docker DB
npm run --prefix packages/db db:migrate:local-only -- --name add_something
# 3. Inspect packages/db/prisma/migrations/<timestamp>_add_something/migration.sql
# 4. Commit the migration file alongside the schema.prisma change
```

Ensure the generated SQL only does what you intended. If it contains a
`DROP`, `ALTER COLUMN` on an existing column, or any change to a
column not in your PR, investigate before committing.

**Path B — manually authored SQL** (required when the change is near
`Json` columns, when you want fine control over ordering, or when
`migrate dev` would emit unwanted JSON↔LONGTEXT reconciliation on
unrelated columns):

```bash
# 1. Edit packages/db/prisma/schema.prisma to describe the target state
# 2. Create packages/db/prisma/migrations/NNNN_your_name/ manually
# 3. Author migration.sql by hand — copy the style of 0000_baseline
# 4. Test end-to-end against a disposable Docker MySQL via `db:migrate:prod`
#    (which runs `prisma migrate deploy` — same executor prod will use)
# 5. Verify with prisma migrate diff --from-url <disposable> --to-url <prod>
```

The Slice 6 `0001_add_scene_asset_instances` migration uses Path B for
exactly this reason — see its migration.sql header for context.

---

## Production deployment

Production migrations are applied via **`prisma migrate deploy`** only.
This command **only** applies pending migrations — it never drops columns
or re-runs baseline.

Two options, in order of preference:

### Option A — manual controlled window

```bash
# From a machine that has DATABASE_URL pointed at production
npm run --prefix packages/db db:migrate:prod
```

Do this in a low-traffic window, immediately after taking a database
snapshot (see rollback below).

### Option B — Vercel deploy hook (not currently enabled)

Adding `prisma migrate deploy` to the Vercel build step is possible but
was intentionally NOT enabled during baseline setup. Enable it only after
several manual deploys have proven the flow works end-to-end and you have
a rollback plan you trust.

---

## Rollback — this is an operational procedure, not a Prisma feature

Prisma does **not** automatically generate a reverse migration when you
run `migrate dev`. Rolling back requires the appropriate operational
procedure depending on state.

### Rolling back a SUCCESSFULLY APPLIED migration

Preferred order:

1. **Ship a compensating forward migration** — the cleanest recovery for
   additive changes. Example: `0001_add_scene_asset_instances` created a
   table; a compensating migration `NNNN_remove_scene_asset_instances`
   would `DROP TABLE scene_asset_instances`. This preserves migration
   history integrity and is auditable through normal PR review. Not
   viable for destructive migrations that also dropped data.
2. **Restore from a database snapshot** taken immediately before the
   migration was applied. The only reliable recovery for a destructive
   change (dropped columns, dropped tables, type narrowing).

### Rolling back a FAILED migration (`prisma migrate deploy` reported an error)

Use `prisma migrate resolve` — the Prisma-supported recovery workflow:

1. **Diagnose** why the migration failed (log output, DB inspection).
2. If the failed migration made partial changes, **manually reconcile the
   DB** (either roll forward to the intended state via reviewed SQL, or
   restore from snapshot).
3. Once the DB physically reflects the intended state, tell Prisma the
   migration is now either applied or rolled back:

   ```bash
   # If DB now matches the migration's intended target state:
   prisma migrate resolve --applied <migration_name>

   # If DB was reverted (e.g. via snapshot) so the migration effectively
   # never happened:
   prisma migrate resolve --rolled-back <migration_name>
   ```

### Do NOT directly `DELETE FROM _prisma_migrations`

The `_prisma_migrations` table is Prisma-owned bookkeeping. Direct DML
against it is a **last-resort recovery** for scenarios where `prisma
migrate resolve` itself cannot correct the state — never a routine
rollback step. Every normal case has a preferred Prisma-supported path
above.

### Rollback notes in PRs

Every meaningful migration PR should include a **Rollback note** in the
description that spells out which of the above applies and any
prerequisite (e.g. "requires snapshot from 2026-08-27T00:00Z").

---

## Known drift alert

The physical DB stores every `Json` column declared in `schema.prisma` as
`LONGTEXT`. This is a legacy of the pre-baseline `db push` era. Prisma
Client reads and writes them as JSON strings and everything works.

**Consequence for future migration authoring:** if you run `prisma migrate
diff --from-schema-datamodel schema.prisma --to-url <prod>` you will see
Prisma flag 3 of the 18 `Json` columns as `"type changed"`. This is a
Prisma quirk (it inconsistently applies its own `Json ↔ LongText`
compatibility rule) and reflects **no physical schema difference**. All 18
columns are uniform `LONGTEXT / utf8mb4 / utf8mb4_bin`. Do not "fix" this
by generating a migration that would convert LongText → JSON columns
unless you actually want to migrate to native MySQL JSON type (which is a
deliberate, separate decision — not baseline follow-up work).

---

## Backup expectations

Hostinger's shared MySQL plan includes automatic daily backups accessible
via hPanel. Before every production migration:

1. Confirm the most recent automatic backup timestamp.
2. Consider triggering a manual `mysqldump` export beforehand if the
   migration is anything more complex than adding a new table.
3. Record the backup identifier in the PR description alongside the
   rollback note.

Standard baseline registration was performed on 2026-08-27 with a recent
Hostinger backup confirmed.

---

## Script glossary

| Script | Command | Safe for prod? |
|---|---|---|
| `db:generate` | `prisma generate` | ✅ Yes (client-only, no DB access) |
| `db:studio` | `prisma studio` | ✅ Yes (read-only GUI) |
| `db:migrate:prod` | `prisma migrate deploy` | ✅ Yes (only applies pending) |
| `db:seed` | `ts-node src/seed.ts` | ⚠️ Depends on the seed script |
| `db:push:local-only-danger` | `prisma db push` | ❌ Local-only — bypasses history |
| `db:migrate:local-only` | `prisma migrate dev` | ❌ Local-only — can drop columns |
| `db:reset:local-only-danger` | `prisma migrate reset` | ❌ DESTROYS the DB |
