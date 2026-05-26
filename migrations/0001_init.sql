-- Migration 0001: initial schema
-- photos: metadata for each uploaded blob (the blob itself lives in R2)

CREATE TABLE photos (
  id         TEXT PRIMARY KEY,
  r2_key     TEXT NOT NULL,
  name       TEXT,
  created_at INTEGER NOT NULL,        -- epoch millis
  hidden     INTEGER NOT NULL DEFAULT 0
);

-- Listing index: newest-first feed of visible photos
CREATE INDEX idx_photos_hidden_created ON photos (hidden, created_at DESC);
