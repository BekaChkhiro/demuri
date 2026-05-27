-- Migration 0002: Instagram-style notes
-- notes: a short text + a photo (blob in R2), shown in a carousel above the camera

CREATE TABLE notes (
  id         TEXT PRIMARY KEY,
  r2_key     TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL        -- epoch millis
);

-- Listing index: newest-first feed of notes
CREATE INDEX idx_notes_created ON notes (created_at DESC);
