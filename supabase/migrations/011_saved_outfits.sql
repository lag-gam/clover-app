-- Distinguish recommendations shown for learning from outfits a user saved.
ALTER TABLE outfits
  ADD COLUMN IF NOT EXISTS is_saved BOOLEAN;

-- Everything created before this distinction was user-visible as a saved
-- outfit, including manual outfits, so retain that behavior.
UPDATE outfits
SET is_saved = true
WHERE is_saved IS NULL;

ALTER TABLE outfits
  ALTER COLUMN is_saved SET DEFAULT false,
  ALTER COLUMN is_saved SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outfits_saved
  ON outfits(user_id, created_at DESC)
  WHERE is_saved = true;

-- Side changes on a saved outfit remain protected by outfit ownership.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outfit_items'
      AND policyname = 'Users can update own outfit items'
  ) THEN
    CREATE POLICY "Users can update own outfit items" ON outfit_items
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM outfits
          WHERE outfits.id = outfit_items.outfit_id
            AND outfits.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM outfits
          WHERE outfits.id = outfit_items.outfit_id
            AND outfits.user_id = auth.uid()
        )
      );
  END IF;
END
$$;
