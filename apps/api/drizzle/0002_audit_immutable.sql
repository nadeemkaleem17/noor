-- The audit trail is append-only (plan/11-security-auth.md section 6). Intended rule: the application's database user can INSERT and SELECT
-- on audit_log and never UPDATE or DELETE. MySQL cannot take a table privilege away from a user who holds the same privilege on the whole
-- schema (partial revokes work per schema only), so the rule is enforced here instead, by two triggers that refuse the change for every
-- user except the migration user (USER(), the connected account: CURRENT_USER() inside a trigger is its definer). The retention job (monthly, 10,000 rows per batch) runs as that user.
-- Hand-written migration (drizzle-kit generate --custom); the schema file does not describe triggers.
CREATE TRIGGER `audit_log_no_update` BEFORE UPDATE ON `audit_log` FOR EACH ROW
BEGIN
  IF SUBSTRING_INDEX(USER(), '@', 1) <> 'rubaya_migrate' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log is append-only';
  END IF;
END;
--> statement-breakpoint
CREATE TRIGGER `audit_log_no_delete` BEFORE DELETE ON `audit_log` FOR EACH ROW
BEGIN
  IF SUBSTRING_INDEX(USER(), '@', 1) <> 'rubaya_migrate' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log is append-only';
  END IF;
END;
