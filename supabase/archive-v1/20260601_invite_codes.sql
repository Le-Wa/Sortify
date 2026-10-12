CREATE TABLE IF NOT EXISTS invite_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash   TEXT        UNIQUE NOT NULL,
  inviter_id  UUID        NOT NULL REFERENCES users(id),
  used_by     UUID        REFERENCES users(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invite_codes_inviter_idx ON invite_codes(inviter_id);
CREATE INDEX IF NOT EXISTS invite_codes_expires_idx ON invite_codes(expires_at) WHERE used_by IS NULL;
