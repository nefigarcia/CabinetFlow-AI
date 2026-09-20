-- Migration: add Phase 2 cabinet-family / front-system / drawer-system rows.
--
-- Hand-authored (Path B — see packages/db/MIGRATIONS.md) matching the
-- 0004 conventions verbatim so the physical schema stays consistent:
--   · VARCHAR(191) for all id / FK columns.
--   · DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci.
--   · LONGTEXT for every Prisma `Json` column (schema-wide convention).
--   · ON UPDATE CASCADE on every FK (baseline pattern).
--   · ON DELETE CASCADE on system→organization FKs (org-scoped rows).
--
-- Additive only:
--   · `organizations.metadata`  — LONGTEXT NULL. Reused for the
--     `cabinetSystemAssignments` JSON blob (per-CabinetType family rule
--     map + optional preferredFrontSystemId / preferredDrawerSystemId).
--     Project.metadata and Room.metadata already exist and carry the
--     same JSON shape at their respective scopes.
--   · 3 new tables (cabinet_family_rules, front_systems, drawer_systems)
--     scoped by org_id. No new columns on cabinets — cabinet-level
--     overrides live in Cabinet.parameters JSON under the keys
--     familyRuleId / frontSystemId / drawerSystemId, and the
--     disableFamilyRule boolean flag.
--
-- Phase 2 manufacturing boundary: family / front / drawer rows are
-- semantic + readiness only. compileUnit, CAD service, syncParts, DXF,
-- CNC, sheet nesting, G-code, and the legacy calculateHardwareBom()
-- are NOT wired to any of these tables. Existing hardcoded compiler
-- defaults + BOM behavior remain authoritative.

-- ─── organizations: metadata JSON blob ─────────────────────────────────────
ALTER TABLE `organizations`
    ADD COLUMN `metadata` LONGTEXT NULL;

-- ─── cabinet_family_rules ──────────────────────────────────────────────────
CREATE TABLE `cabinet_family_rules` (
    `id`                  VARCHAR(191) NOT NULL,
    `org_id`              VARCHAR(191) NOT NULL,
    `cabinetType`         VARCHAR(32)  NOT NULL,
    `name`                VARCHAR(255) NOT NULL,
    `description`         TEXT         NULL,

    `hasToeKick`          TINYINT(1)   NULL,
    `hasBack`             TINYINT(1)   NULL,
    `hasNailer`           TINYINT(1)   NULL,
    `fixedShelfPolicy`    VARCHAR(32)  NULL,
    `cornerVariant`       VARCHAR(24)  NULL,

    `toeHeightMm`         DECIMAL(10,4) NULL,
    `toeRecessMm`         DECIMAL(10,4) NULL,
    `topRevealMm`         DECIMAL(10,4) NULL,
    `bottomRevealMm`      DECIMAL(10,4) NULL,
    `topScribeMm`         DECIMAL(10,4) NULL,
    `bottomScribeMm`      DECIMAL(10,4) NULL,

    `verificationStatus`  VARCHAR(24)  NOT NULL DEFAULT 'unverified',
    `verificationGaps`    LONGTEXT     NULL,
    `sourceRef`           VARCHAR(200) NULL,
    `fieldProvenance`     LONGTEXT     NULL,
    `metadata`            LONGTEXT     NULL,
    `createdAt`           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`           DATETIME(3)  NOT NULL,

    INDEX `cabinet_family_rules_org_id_idx` (`org_id`),
    INDEX `cabinet_family_rules_org_id_cabinetType_idx` (`org_id`, `cabinetType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── front_systems ─────────────────────────────────────────────────────────
CREATE TABLE `front_systems` (
    `id`                  VARCHAR(191) NOT NULL,
    `org_id`              VARCHAR(191) NOT NULL,
    `name`                VARCHAR(255) NOT NULL,
    `description`         TEXT         NULL,

    `kind`                VARCHAR(24)  NOT NULL,
    `role`                VARCHAR(24)  NOT NULL,
    `glassFlag`           TINYINT(1)   NOT NULL DEFAULT 0,

    `verificationStatus`  VARCHAR(24)  NOT NULL DEFAULT 'unverified',
    `verificationGaps`    LONGTEXT     NULL,
    `sourceRef`           VARCHAR(200) NULL,
    `fieldProvenance`     LONGTEXT     NULL,
    `metadata`            LONGTEXT     NULL,
    `createdAt`           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`           DATETIME(3)  NOT NULL,

    INDEX `front_systems_org_id_idx` (`org_id`),
    INDEX `front_systems_org_id_kind_idx` (`org_id`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── drawer_systems ────────────────────────────────────────────────────────
CREATE TABLE `drawer_systems` (
    `id`                     VARCHAR(191) NOT NULL,
    `org_id`                 VARCHAR(191) NOT NULL,
    `name`                   VARCHAR(255) NOT NULL,
    `description`            TEXT         NULL,

    `kind`                   VARCHAR(24)  NOT NULL,

    -- traditional only; null for proprietary
    `boxSideThicknessMm`     DECIMAL(10,4) NULL,
    `boxBottomThicknessMm`   DECIMAL(10,4) NULL,
    `boxBackThicknessMm`     DECIMAL(10,4) NULL,
    `boxSubFrontThicknessMm` DECIMAL(10,4) NULL,
    `boxJoinery`             VARCHAR(32)  NULL,

    -- proprietary only; null for traditional
    `proprietaryFamily`      VARCHAR(64)  NULL,

    `verificationStatus`     VARCHAR(24)  NOT NULL DEFAULT 'unverified',
    `verificationGaps`       LONGTEXT     NULL,
    `sourceRef`              VARCHAR(200) NULL,
    `fieldProvenance`        LONGTEXT     NULL,
    `metadata`               LONGTEXT     NULL,
    `createdAt`              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`              DATETIME(3)  NOT NULL,

    INDEX `drawer_systems_org_id_idx` (`org_id`),
    INDEX `drawer_systems_org_id_kind_idx` (`org_id`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Foreign keys ──────────────────────────────────────────────────────────
-- ON DELETE CASCADE on org→system so deleting an org cleans up its library.
-- No FK back-refs from organizations to these tables — assignments live in
-- Organization.metadata JSON (per-CabinetType family map + preferred IDs).

ALTER TABLE `cabinet_family_rules`
    ADD CONSTRAINT `cabinet_family_rules_org_id_fkey`
        FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `front_systems`
    ADD CONSTRAINT `front_systems_org_id_fkey`
        FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `drawer_systems`
    ADD CONSTRAINT `drawer_systems_org_id_fkey`
        FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE;
