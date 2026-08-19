-- The custom password reset flow is gone: better-auth serves forgot-password,
-- reset-password and change-password itself now, using its own `verification`
-- table for the token. This table backed the hand rolled six digit code flow
-- and has no remaining reader.
--
-- Dropped rather than left in place because a table holding hashed reset codes
-- that nothing writes and nothing expires is a stale credential store.
DROP TABLE IF EXISTS "PasswordResetCode";
