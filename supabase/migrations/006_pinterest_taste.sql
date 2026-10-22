-- Official Pinterest OAuth, selected boards, bounded Pin cache, and blended taste.
-- This migration is intentionally 006 so it does not collide with concurrent 005 work.

CREATE TABLE IF NOT EXISTS pinterest_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pinterest_user_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pinterest_oauth_states (
  state_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  return_url TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pinterest_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pinterest_board_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  privacy TEXT,
  image_url TEXT,
  selected BOOLEAN NOT NULL DEFAULT false,
  sync_bookmark TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pinterest_board_id)
);

CREATE TABLE IF NOT EXISTS pinterest_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pinterest_pin_id TEXT NOT NULL,
  pinterest_board_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  alt_text TEXT,
  link TEXT,
  image_url TEXT,
  pinterest_created_at TIMESTAMPTZ,
  embedding JSONB NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pinterest_pin_id)
);

ALTER TABLE style_profiles
  ADD COLUMN IF NOT EXISTS interaction_embedding JSONB,
  ADD COLUMN IF NOT EXISTS pinterest_embedding JSONB,
  ADD COLUMN IF NOT EXISTS pinterest_pin_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pinterest_updated_at TIMESTAMPTZ;

-- Existing profiles were interaction-only before this migration.
UPDATE style_profiles
SET interaction_embedding = style_embedding
WHERE interaction_embedding IS NULL
  AND style_embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pinterest_oauth_states_expiry
  ON pinterest_oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_pinterest_boards_user_selected
  ON pinterest_boards(user_id, selected);
CREATE INDEX IF NOT EXISTS idx_pinterest_pins_user_board
  ON pinterest_pins(user_id, pinterest_board_id);
CREATE INDEX IF NOT EXISTS idx_pinterest_pins_user_created
  ON pinterest_pins(user_id, pinterest_created_at DESC);

ALTER TABLE pinterest_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinterest_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinterest_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinterest_pins ENABLE ROW LEVEL SECURITY;

-- Tighten existing cross-table insert policies so a user cannot attach another
-- user's guessed garment or outfit UUID to their own records.
DROP POLICY IF EXISTS "Users can insert own outfit items" ON outfit_items;
CREATE POLICY "Users can insert own outfit items" ON outfit_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM outfits
      WHERE outfits.id = outfit_items.outfit_id
        AND outfits.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM garments
      WHERE garments.id = outfit_items.garment_id
        AND garments.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own interactions" ON interactions;
CREATE POLICY "Users can insert own interactions" ON interactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM outfits
      WHERE outfits.id = interactions.outfit_id
        AND outfits.user_id = auth.uid()
    )
    AND (
      swapped_garment_id IS NULL
      OR EXISTS (
        SELECT 1 FROM garments
        WHERE garments.id = interactions.swapped_garment_id
          AND garments.user_id = auth.uid()
      )
    )
    AND (
      replacement_garment_id IS NULL
      OR EXISTS (
        SELECT 1 FROM garments
        WHERE garments.id = interactions.replacement_garment_id
          AND garments.user_id = auth.uid()
      )
    )
  );

-- No policies are created for token/state rows. Only service_role can read them.
REVOKE ALL ON pinterest_connections FROM anon, authenticated;
REVOKE ALL ON pinterest_oauth_states FROM anon, authenticated;

-- The mobile client can display cached board metadata and aggregate Pin status.
-- Selection writes and all Pin/token writes still go through authenticated functions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pinterest_boards'
      AND policyname = 'Users can view own Pinterest boards'
  ) THEN
    CREATE POLICY "Users can view own Pinterest boards"
      ON pinterest_boards FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pinterest_pins'
      AND policyname = 'Users can view own Pinterest pins'
  ) THEN
    CREATE POLICY "Users can view own Pinterest pins"
      ON pinterest_pins FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;
