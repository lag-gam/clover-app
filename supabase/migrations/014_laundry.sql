-- Track when a garment was last washed so past scheduled outfits can
-- fill a laundry basket until the user empties it.

ALTER TABLE garments
  ADD COLUMN IF NOT EXISTS last_laundered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_garments_user_last_laundered
  ON garments(user_id, last_laundered_at);

COMMENT ON COLUMN garments.last_laundered_at IS
  'Set when the user washes this garment. Scheduled wears on or before that local date leave the laundry basket.';
