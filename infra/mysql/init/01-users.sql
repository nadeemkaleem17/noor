-- The database and its two users (plan/11-security-auth.md section 6, plan/14-devops.md section 3.4).
-- Not run directly: `node scripts/setup-env.mjs` fills the __TOKENS__ with generated passwords and writes .data/mysql-init.sql,
-- which you run once as the MySQL administrator. Safe to rerun.
--
--   rubaya_app      what the API and worker connect as: data changes only, no DDL.
--   rubaya_migrate  used by db:migrate, db:seed and the retention job: DDL and data.
--
-- ponytail: both users may change every table for now. The migration that creates `audit_log` (task M1-03) revokes UPDATE and
-- DELETE on it from rubaya_app, so the application can append to the audit trail but never edit it.

CREATE DATABASE IF NOT EXISTS rubaya CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS rubaya_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'rubaya_app'@'localhost' IDENTIFIED BY '__APP_DB_PASSWORD__';
CREATE USER IF NOT EXISTS 'rubaya_migrate'@'localhost' IDENTIFIED BY '__MIGRATE_DB_PASSWORD__';

GRANT SELECT, INSERT, UPDATE, DELETE ON rubaya.* TO 'rubaya_app'@'localhost';
GRANT ALL PRIVILEGES ON rubaya.* TO 'rubaya_migrate'@'localhost';
-- the test database is created and dropped by the integration tests (one database per test file)
GRANT ALL PRIVILEGES ON `rubaya_test%`.* TO 'rubaya_migrate'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rubaya_test%`.* TO 'rubaya_app'@'localhost';

FLUSH PRIVILEGES;
