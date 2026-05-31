CREATE TABLE IF NOT EXISTS pending_auth (
  nonce              TEXT        PRIMARY KEY,
  client_id          TEXT        NOT NULL,
  client_secret_enc  TEXT        NOT NULL,
  state              TEXT        UNIQUE NOT NULL,
  invited_by         UUID        REFERENCES users(id),
  expires_at         TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pending_auth_state_idx   ON pending_auth(state);
CREATE INDEX IF NOT EXISTS pending_auth_expires_idx ON pending_auth(expires_at);
