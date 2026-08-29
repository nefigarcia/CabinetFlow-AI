-- Migration: add scene-asset wall-attachment placement columns
-- Slice 7 / wall-attached placement — hand-authored.
--
-- Adds five nullable columns to `scene_asset_instances`. Existing rows
-- default `placement_mode` to 'free'; wall_* stay NULL. The API layer
-- rehydrates any row with `placement_mode = 'free'` (or missing wall
-- payload) as `{ mode: "free" }` and treats world position/rotation as
-- authoritative.
--
-- No FK on `wall_id` — walls live in `rooms.metadata.architecture` (a
-- LONGTEXT JSON blob), not a table. Referential integrity is enforced
-- at the API layer against the compiled architecture.
--
-- No index on `wall_id` for MVP: scene assets are already scoped by
-- room_id (which is indexed) and N per room is small (< 100).

ALTER TABLE `scene_asset_instances`
  ADD COLUMN `placement_mode` VARCHAR(32) NOT NULL DEFAULT 'free',
  ADD COLUMN `wall_id` VARCHAR(191) NULL,
  ADD COLUMN `wall_local_x` DECIMAL(10, 4) NULL,
  ADD COLUMN `wall_local_y` DECIMAL(10, 4) NULL,
  ADD COLUMN `wall_local_z` DECIMAL(10, 4) NULL;
