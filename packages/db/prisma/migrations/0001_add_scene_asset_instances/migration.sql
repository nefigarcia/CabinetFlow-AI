-- Migration: add scene_asset_instances
-- Slice 6 — hand-authored to preserve the legacy Json→LONGTEXT physical
-- representation used by every other Json column in this database. See
-- packages/db/MIGRATIONS.md "Known drift alert" for context.
--
-- Affects ONLY the new table. No ALTER against existing tables. The
-- `Room.sceneAssetInstances` Prisma back-relation added in this slice is
-- a Prisma-only construct and does NOT modify the `rooms` table.

-- CreateTable
CREATE TABLE `scene_asset_instances` (
    `id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `asset_definition_id` VARCHAR(191) NOT NULL,
    `pos_x` DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    `pos_y` DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    `pos_z` DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    `rot_x` DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    `rot_y` DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    `rot_z` DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    `scale_x` DECIMAL(10, 6) NOT NULL DEFAULT 1.000000,
    `scale_y` DECIMAL(10, 6) NOT NULL DEFAULT 1.000000,
    `scale_z` DECIMAL(10, 6) NOT NULL DEFAULT 1.000000,
    `visible` BOOLEAN NOT NULL DEFAULT true,
    `material_overrides` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `scene_asset_instances_org_id_idx`(`org_id` ASC),
    INDEX `scene_asset_instances_room_id_idx`(`room_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `scene_asset_instances` ADD CONSTRAINT `scene_asset_instances_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
