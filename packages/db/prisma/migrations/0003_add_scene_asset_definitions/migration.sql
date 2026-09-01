-- Migration: add scene_asset_definitions (Asset Library persistence).
--
-- Additive only. NO ALTER against existing tables. Consistent with the
-- Json↔LONGTEXT convention already in use across this schema
-- (packages/db/MIGRATIONS.md "Known drift alert" — Prisma models the
-- column as `Json`, MySQL physically stores it as LONGTEXT).
--
-- Scope semantics (enforced at the API layer, not by CHECK constraints
-- to keep the SQL portable):
--   scope = "system"  → orgId = NULL (visible to all orgs)
--   scope = "org"     → orgId = <organization.id> (visible only to that org)
--
-- No FK from `scene_asset_instances.asset_definition_id` to this table
-- yet — instances may still reference legacy code-catalog ids during
-- rollout. The API layer resolves against BOTH sources (code catalog
-- fallback + DB rows).

CREATE TABLE `scene_asset_definitions` (
    `id`             VARCHAR(191) NOT NULL,
    `scope`          VARCHAR(32)  NOT NULL,
    `org_id`         VARCHAR(191) NULL,

    `slug`           VARCHAR(191) NULL,
    `name`           VARCHAR(255) NOT NULL,
    `description`    TEXT NULL,
    `category`       VARCHAR(64)  NOT NULL,

    `width_mm`       DECIMAL(12,4) NOT NULL,
    `height_mm`      DECIMAL(12,4) NOT NULL,
    `depth_mm`       DECIMAL(12,4) NOT NULL,

    `placement`      LONGTEXT NULL,
    `collision`      LONGTEXT NULL,
    `model`          LONGTEXT NULL,
    `provenance`     LONGTEXT NULL,
    `metadata`       LONGTEXT NULL,

    `asset_key`      VARCHAR(512) NULL,
    `thumbnail_key`  VARCHAR(512) NULL,
    `manufacturer`   VARCHAR(255) NULL,
    `sku`            VARCHAR(191) NULL,
    `tags`           LONGTEXT NULL,

    `family`         VARCHAR(191) NOT NULL,
    `revision`       INT NOT NULL DEFAULT 1,

    `active`         BOOLEAN NOT NULL DEFAULT true,
    `system_managed` BOOLEAN NOT NULL DEFAULT false,

    `created_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`     DATETIME(3) NOT NULL,

    INDEX `scene_asset_definitions_scope_org_id_active_idx` (`scope` ASC, `org_id` ASC, `active` ASC),
    INDEX `scene_asset_definitions_family_revision_idx`  (`family` ASC, `revision` ASC),
    INDEX `scene_asset_definitions_category_idx`         (`category` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
