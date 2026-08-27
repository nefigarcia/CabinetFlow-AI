-- CreateTable
CREATE TABLE `cabinet_parts` (
    `id` VARCHAR(191) NOT NULL,
    `cabinet_id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `part_type` VARCHAR(100) NOT NULL,
    `width` DECIMAL(10, 4) NOT NULL,
    `height` DECIMAL(10, 4) NOT NULL,
    `thickness` DECIMAL(10, 4) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `material_id` VARCHAR(191) NULL,
    `grain_dir` VARCHAR(20) NULL,
    `edge_banding` LONGTEXT NULL,
    `cut_params` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `assembly_group` VARCHAR(50) NULL,
    `is_manual` BOOLEAN NOT NULL DEFAULT false,

    INDEX `cabinet_parts_cabinet_id_idx`(`cabinet_id` ASC),
    INDEX `cabinet_parts_material_id_fkey`(`material_id` ASC),
    INDEX `cabinet_parts_org_id_idx`(`org_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cabinets` (
    `id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `width` DECIMAL(10, 4) NOT NULL,
    `height` DECIMAL(10, 4) NOT NULL,
    `depth` DECIMAL(10, 4) NOT NULL,
    `pos_x` DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    `pos_y` DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    `pos_z` DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    `parameters` LONGTEXT NOT NULL,
    `material_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cabinets_material_id_fkey`(`material_id` ASC),
    INDEX `cabinets_org_id_idx`(`org_id` ASC),
    INDEX `cabinets_room_id_idx`(`room_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clients` (
    `id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `address` TEXT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `clients_org_id_idx`(`org_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cnc_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `machine_profile_id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'queued',
    `gcode_url` TEXT NULL,
    `dxf_url` TEXT NULL,
    `estimated_time` INTEGER NULL,
    `error_message` TEXT NULL,
    `metadata` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cnc_jobs_machine_profile_id_fkey`(`machine_profile_id` ASC),
    INDEX `cnc_jobs_org_id_idx`(`org_id` ASC),
    INDEX `cnc_jobs_project_id_idx`(`project_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cutlists` (
    `id` VARCHAR(191) NOT NULL,
    `cabinet_id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
    `pdf_url` TEXT NULL,
    `csv_url` TEXT NULL,
    `parts` LONGTEXT NOT NULL,
    `nesting_data` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cutlists_cabinet_id_idx`(`cabinet_id` ASC),
    INDEX `cutlists_org_id_idx`(`org_id` ASC),
    INDEX `cutlists_project_id_idx`(`project_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hardware` (
    `id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `type` VARCHAR(100) NOT NULL,
    `sku` VARCHAR(100) NULL,
    `supplier` VARCHAR(255) NULL,
    `cost_per_unit` DECIMAL(10, 4) NOT NULL,
    `metadata` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `hardware_org_id_idx`(`org_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `installer_feedback` (
    `id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `cabinet_id` VARCHAR(191) NULL,
    `reported_by` VARCHAR(255) NOT NULL,
    `severity` VARCHAR(20) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `description` TEXT NOT NULL,
    `photo_urls` LONGTEXT NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `installer_feedback_org_id_idx`(`org_id` ASC),
    INDEX `installer_feedback_project_id_idx`(`project_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `machine_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `manufacturer` VARCHAR(255) NOT NULL,
    `model` VARCHAR(255) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `config` LONGTEXT NOT NULL,
    `post_processor` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `machine_profiles_org_id_idx`(`org_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `materials` (
    `id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `thickness` DECIMAL(10, 4) NOT NULL,
    `sheet_width` DECIMAL(10, 4) NOT NULL,
    `sheet_height` DECIMAL(10, 4) NOT NULL,
    `cost_per_sheet` DECIMAL(10, 2) NOT NULL,
    `supplier` VARCHAR(255) NULL,
    `sku` VARCHAR(100) NULL,
    `metadata` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `materials_org_id_idx`(`org_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organizations` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `plan` VARCHAR(50) NOT NULL DEFAULT 'starter',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `organizations_slug_key`(`slug` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_runs` (
    `id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    `scheduled_at` DATETIME(3) NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `metadata` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `production_runs_org_id_idx`(`org_id` ASC),
    INDEX `production_runs_project_id_idx`(`project_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
    `metadata` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `projects_client_id_idx`(`client_id` ASC),
    INDEX `projects_org_id_idx`(`org_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotes` (
    `id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
    `valid_until` DATETIME(3) NULL,
    `line_items` LONGTEXT NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `tax_rate` DECIMAL(5, 4) NOT NULL DEFAULT 0.0000,
    `tax_amount` DECIMAL(10, 2) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `notes` TEXT NULL,
    `pdf_url` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `quotes_org_id_idx`(`org_id` ASC),
    INDEX `quotes_project_id_idx`(`project_id` ASC),
    INDEX `quotes_user_id_fkey`(`user_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `revisions` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `snapshot` LONGTEXT NOT NULL,
    `message` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `revisions_org_id_idx`(`org_id` ASC),
    INDEX `revisions_project_id_idx`(`project_id` ASC),
    UNIQUE INDEX `revisions_project_id_version_key`(`project_id` ASC, `version` ASC),
    INDEX `revisions_user_id_fkey`(`user_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rooms` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `width` DECIMAL(10, 4) NOT NULL,
    `height` DECIMAL(10, 4) NOT NULL,
    `depth` DECIMAL(10, 4) NOT NULL,
    `metadata` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `rooms_org_id_idx`(`org_id` ASC),
    INDEX `rooms_project_id_idx`(`project_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `role` VARCHAR(50) NOT NULL DEFAULT 'designer',
    `refresh_token` TEXT NULL,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email` ASC),
    INDEX `users_org_id_idx`(`org_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `validation_reports` (
    `id` VARCHAR(191) NOT NULL,
    `cabinet_id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `errors` LONGTEXT NULL,
    `warnings` LONGTEXT NULL,
    `ai_model` VARCHAR(100) NULL,
    `raw_response` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `validation_reports_cabinet_id_idx`(`cabinet_id` ASC),
    INDEX `validation_reports_org_id_idx`(`org_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cabinet_parts` ADD CONSTRAINT `cabinet_parts_cabinet_id_fkey` FOREIGN KEY (`cabinet_id`) REFERENCES `cabinets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cabinet_parts` ADD CONSTRAINT `cabinet_parts_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cabinets` ADD CONSTRAINT `cabinets_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cabinets` ADD CONSTRAINT `cabinets_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cnc_jobs` ADD CONSTRAINT `cnc_jobs_machine_profile_id_fkey` FOREIGN KEY (`machine_profile_id`) REFERENCES `machine_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cutlists` ADD CONSTRAINT `cutlists_cabinet_id_fkey` FOREIGN KEY (`cabinet_id`) REFERENCES `cabinets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hardware` ADD CONSTRAINT `hardware_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `machine_profiles` ADD CONSTRAINT `machine_profiles_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `materials` ADD CONSTRAINT `materials_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_runs` ADD CONSTRAINT `production_runs_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_runs` ADD CONSTRAINT `production_runs_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `revisions` ADD CONSTRAINT `revisions_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `revisions` ADD CONSTRAINT `revisions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `validation_reports` ADD CONSTRAINT `validation_reports_cabinet_id_fkey` FOREIGN KEY (`cabinet_id`) REFERENCES `cabinets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

