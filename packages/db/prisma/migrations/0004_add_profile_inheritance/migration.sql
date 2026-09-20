-- Migration: add profile inheritance (ConstructionProfile, CabinetMaterialProfile, HardwareProfile).
--
-- Hand-authored (Path B — see packages/db/MIGRATIONS.md) to preserve
-- the schema-wide Json↔LONGTEXT convention already in use. Prisma models
-- the profile Json columns (`verificationGaps`, `fieldProvenance`,
-- `metadata`) as `Json`; MySQL physically stores them as LONGTEXT so
-- they match every other Json column in this database.
--
-- Physical-schema conventions matched to baseline + 0001/0003:
--   · VARCHAR(191) for all id / FK columns (Prisma's MySQL cuid width).
--   · DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci.
--   · Every FK carries ON UPDATE CASCADE (matches baseline pattern);
--     ON DELETE behavior is per the approved packet (CASCADE for
--     org-scoped rows; SET NULL for inheritance refs).
--
-- Additive only:
--   · 3 new tables (construction_profiles, cabinet_material_profiles,
--     hardware_profiles) scoped by org_id with ON DELETE CASCADE.
--   · 9 nullable FK columns across organizations / projects / rooms
--     for field-level profile inheritance:
--       Organization → project → room → cabinet.parameters (JSON key)
--     with ON DELETE SET NULL so deleting a profile row doesn't cascade
--     into project/room/org rows.
--
-- Cabinet-level overrides use the existing `Cabinet.parameters` JSON
-- bag under reserved keys (constructionProfileId / materialProfileId /
-- hardwareProfileId) — no schema change on the cabinets table.
--
-- Phase 1 manufacturing boundary: profiles are metadata + readiness
-- only. compileUnit, CAD service, syncParts, DXF, CNC, and nesting are
-- NOT wired to these profiles. Existing hardcoded compiler defaults
-- remain authoritative.

-- ─── construction_profiles ─────────────────────────────────────────────────
CREATE TABLE `construction_profiles` (
    `id`                          VARCHAR(191) NOT NULL,
    `org_id`                      VARCHAR(191) NOT NULL,
    `name`                        VARCHAR(120) NOT NULL,
    `description`                 TEXT         NULL,
    `constructionMethod`          VARCHAR(20)  NULL,
    `frontOverlayMode`            VARCHAR(24)  NULL,
    `carcassThicknessMm`          DECIMAL(6,2) NULL,
    `drawerBoxThicknessMm`        DECIMAL(6,2) NULL,
    `drawerBoxJoinery`            VARCHAR(60)  NULL,
    `backThicknessMm`             DECIMAL(6,2) NULL,
    `adjustableShelfThicknessMm`  DECIMAL(6,2) NULL,
    `nailerThicknessMm`           DECIMAL(6,2) NULL,
    `verificationStatus`          VARCHAR(24)  NOT NULL DEFAULT 'unverified',
    `verificationGaps`            LONGTEXT     NULL,
    `sourceRef`                   VARCHAR(200) NULL,
    `fieldProvenance`             LONGTEXT     NULL,
    `metadata`                    LONGTEXT     NULL,
    `createdAt`                   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`                   DATETIME(3)  NOT NULL,

    INDEX `construction_profiles_org_id_idx` (`org_id`),
    INDEX `construction_profiles_org_id_verificationStatus_idx` (`org_id`, `verificationStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── cabinet_material_profiles ─────────────────────────────────────────────
CREATE TABLE `cabinet_material_profiles` (
    `id`                             VARCHAR(191) NOT NULL,
    `org_id`                         VARCHAR(191) NOT NULL,
    `name`                           VARCHAR(120) NOT NULL,
    `description`                    TEXT         NULL,
    `carcassMaterialSpec`            VARCHAR(200) NULL,
    `drawerBoxMaterialSpec`          VARCHAR(200) NULL,
    `faceFrameMaterialSpec`          VARCHAR(200) NULL,
    `doorMaterialSpec`               VARCHAR(200) NULL,
    `shelfMaterialSpec`              VARCHAR(200) NULL,
    `backMaterialSpec`               VARCHAR(200) NULL,
    `adjustableShelfMaterialSpec`    VARCHAR(200) NULL,
    `nailerMaterialSpec`             VARCHAR(200) NULL,
    `verificationStatus`             VARCHAR(24)  NOT NULL DEFAULT 'unverified',
    `verificationGaps`               LONGTEXT     NULL,
    `sourceRef`                      VARCHAR(200) NULL,
    `fieldProvenance`                LONGTEXT     NULL,
    `metadata`                       LONGTEXT     NULL,
    `createdAt`                      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`                      DATETIME(3)  NOT NULL,

    INDEX `cabinet_material_profiles_org_id_idx` (`org_id`),
    INDEX `cabinet_material_profiles_org_id_verificationStatus_idx` (`org_id`, `verificationStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── hardware_profiles ─────────────────────────────────────────────────────
-- Nullable booleans (`hingeSoftClose`, `drawerSlideSoftClose`) distinguish
-- UNKNOWN (NULL) from VERIFIED FALSE (0).
CREATE TABLE `hardware_profiles` (
    `id`                        VARCHAR(191) NOT NULL,
    `org_id`                    VARCHAR(191) NOT NULL,
    `name`                      VARCHAR(120) NOT NULL,
    `description`               TEXT         NULL,
    `hingeManufacturer`         VARCHAR(60)  NULL,
    `hingeSoftClose`            TINYINT(1)   NULL,
    `hingeSystem`               VARCHAR(120) NULL,
    `drawerSlideManufacturer`   VARCHAR(60)  NULL,
    `drawerSlideSoftClose`      TINYINT(1)   NULL,
    `drawerSlideSystem`         VARCHAR(120) NULL,
    `verificationStatus`        VARCHAR(24)  NOT NULL DEFAULT 'unverified',
    `verificationGaps`          LONGTEXT     NULL,
    `sourceRef`                 VARCHAR(200) NULL,
    `fieldProvenance`           LONGTEXT     NULL,
    `metadata`                  LONGTEXT     NULL,
    `createdAt`                 DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`                 DATETIME(3)  NOT NULL,

    INDEX `hardware_profiles_org_id_idx` (`org_id`),
    INDEX `hardware_profiles_org_id_verificationStatus_idx` (`org_id`, `verificationStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── organizations: default-profile refs ───────────────────────────────────
ALTER TABLE `organizations`
    ADD COLUMN `default_construction_profile_id` VARCHAR(191) NULL,
    ADD COLUMN `default_material_profile_id`     VARCHAR(191) NULL,
    ADD COLUMN `default_hardware_profile_id`     VARCHAR(191) NULL;

CREATE INDEX `organizations_default_construction_profile_id_idx` ON `organizations`(`default_construction_profile_id`);
CREATE INDEX `organizations_default_material_profile_id_idx`     ON `organizations`(`default_material_profile_id`);
CREATE INDEX `organizations_default_hardware_profile_id_idx`     ON `organizations`(`default_hardware_profile_id`);

-- ─── projects: overrides ───────────────────────────────────────────────────
ALTER TABLE `projects`
    ADD COLUMN `construction_profile_id` VARCHAR(191) NULL,
    ADD COLUMN `material_profile_id`     VARCHAR(191) NULL,
    ADD COLUMN `hardware_profile_id`     VARCHAR(191) NULL;

CREATE INDEX `projects_construction_profile_id_idx` ON `projects`(`construction_profile_id`);
CREATE INDEX `projects_material_profile_id_idx`     ON `projects`(`material_profile_id`);
CREATE INDEX `projects_hardware_profile_id_idx`     ON `projects`(`hardware_profile_id`);

-- ─── rooms: overrides ──────────────────────────────────────────────────────
ALTER TABLE `rooms`
    ADD COLUMN `construction_profile_id` VARCHAR(191) NULL,
    ADD COLUMN `material_profile_id`     VARCHAR(191) NULL,
    ADD COLUMN `hardware_profile_id`     VARCHAR(191) NULL;

CREATE INDEX `rooms_construction_profile_id_idx` ON `rooms`(`construction_profile_id`);
CREATE INDEX `rooms_material_profile_id_idx`     ON `rooms`(`material_profile_id`);
CREATE INDEX `rooms_hardware_profile_id_idx`     ON `rooms`(`hardware_profile_id`);

-- ─── Foreign keys ──────────────────────────────────────────────────────────
-- Every FK carries ON UPDATE CASCADE (matches baseline). ON DELETE per the
-- approved packet: CASCADE for org-scoped profile rows themselves; SET NULL
-- for inheritance refs so deleting a profile does not cascade upward.

ALTER TABLE `construction_profiles`
    ADD CONSTRAINT `construction_profiles_org_id_fkey`
        FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `cabinet_material_profiles`
    ADD CONSTRAINT `cabinet_material_profiles_org_id_fkey`
        FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `hardware_profiles`
    ADD CONSTRAINT `hardware_profiles_org_id_fkey`
        FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `organizations`
    ADD CONSTRAINT `organizations_default_construction_profile_id_fkey`
        FOREIGN KEY (`default_construction_profile_id`) REFERENCES `construction_profiles`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `organizations`
    ADD CONSTRAINT `organizations_default_material_profile_id_fkey`
        FOREIGN KEY (`default_material_profile_id`) REFERENCES `cabinet_material_profiles`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `organizations`
    ADD CONSTRAINT `organizations_default_hardware_profile_id_fkey`
        FOREIGN KEY (`default_hardware_profile_id`) REFERENCES `hardware_profiles`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `projects`
    ADD CONSTRAINT `projects_construction_profile_id_fkey`
        FOREIGN KEY (`construction_profile_id`) REFERENCES `construction_profiles`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `projects`
    ADD CONSTRAINT `projects_material_profile_id_fkey`
        FOREIGN KEY (`material_profile_id`) REFERENCES `cabinet_material_profiles`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `projects`
    ADD CONSTRAINT `projects_hardware_profile_id_fkey`
        FOREIGN KEY (`hardware_profile_id`) REFERENCES `hardware_profiles`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `rooms`
    ADD CONSTRAINT `rooms_construction_profile_id_fkey`
        FOREIGN KEY (`construction_profile_id`) REFERENCES `construction_profiles`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `rooms`
    ADD CONSTRAINT `rooms_material_profile_id_fkey`
        FOREIGN KEY (`material_profile_id`) REFERENCES `cabinet_material_profiles`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `rooms`
    ADD CONSTRAINT `rooms_hardware_profile_id_fkey`
        FOREIGN KEY (`hardware_profile_id`) REFERENCES `hardware_profiles`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
