-- Patch: tambahan kolom yang dibutuhkan sistem

-- 1. Kolom supporting_document_file di student_request_resignation
ALTER TABLE `student_request_resignation`
  ADD COLUMN IF NOT EXISTS `supporting_document_file` VARCHAR(255) NULL DEFAULT NULL AFTER `application_letter_file`;

-- 2. Fix: student_requests menggunakan id non-auto-increment → ubah ke auto_increment
-- (diperlukan agar INSERT bisa menggunakan NULL/auto)
ALTER TABLE `student_requests`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `student_request_resignation`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `student_request_resignation_approvals`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

-- 3. Fix: student_requests.description VARCHAR(45) terlalu pendek
ALTER TABLE `student_requests`
  MODIFY COLUMN `description` TEXT NULL DEFAULT NULL;

-- 4. Fix: student_request_resignation.reasons VARCHAR(45) terlalu pendek
ALTER TABLE `student_request_resignation`
  MODIFY COLUMN `reasons` TEXT NULL DEFAULT NULL;

-- 5. Fix: student_request_resignation_approvals.approval_reason VARCHAR(45) terlalu pendek
ALTER TABLE `student_request_resignation_approvals`
  MODIFY COLUMN `approval_reason` TEXT NULL DEFAULT NULL;
