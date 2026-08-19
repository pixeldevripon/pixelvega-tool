-- Rename the seeded default BlockerReason from "Uncategorized" to
-- "Unspecified" (data only, no schema change). BlockerReasonsService's
-- DEFAULT_BLOCKER_REASON_NAME now expects the new value.
UPDATE "BlockerReason" SET name = 'Unspecified' WHERE name = 'Uncategorized' AND "deletedAt" IS NULL;
