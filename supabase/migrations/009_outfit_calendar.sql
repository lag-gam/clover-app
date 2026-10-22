-- User-owned calendar entries for saved outfits.
-- Dates are intentionally DATE values: the client sends local YYYY-MM-DD
-- strings so scheduling does not shift when a timezone changes.

CREATE TABLE IF NOT EXISTS outfit_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  outfit_id UUID REFERENCES outfits(id) ON DELETE CASCADE NOT NULL,
  scheduled_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_outfit_schedule_unique_day
  ON outfit_schedule(user_id, outfit_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_outfit_schedule_user_date
  ON outfit_schedule(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_outfit_schedule_outfit
  ON outfit_schedule(outfit_id);

ALTER TABLE outfit_schedule ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outfit_schedule'
      AND policyname = 'Users can view own outfit schedule'
  ) THEN
    CREATE POLICY "Users can view own outfit schedule"
      ON outfit_schedule FOR SELECT
      USING (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM outfits
          WHERE outfits.id = outfit_schedule.outfit_id
            AND outfits.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outfit_schedule'
      AND policyname = 'Users can insert own outfit schedule'
  ) THEN
    CREATE POLICY "Users can insert own outfit schedule"
      ON outfit_schedule FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM outfits
          WHERE outfits.id = outfit_schedule.outfit_id
            AND outfits.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outfit_schedule'
      AND policyname = 'Users can update own outfit schedule'
  ) THEN
    CREATE POLICY "Users can update own outfit schedule"
      ON outfit_schedule FOR UPDATE
      USING (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM outfits
          WHERE outfits.id = outfit_schedule.outfit_id
            AND outfits.user_id = auth.uid()
        )
      )
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM outfits
          WHERE outfits.id = outfit_schedule.outfit_id
            AND outfits.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outfit_schedule'
      AND policyname = 'Users can delete own outfit schedule'
  ) THEN
    CREATE POLICY "Users can delete own outfit schedule"
      ON outfit_schedule FOR DELETE
      USING (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM outfits
          WHERE outfits.id = outfit_schedule.outfit_id
            AND outfits.user_id = auth.uid()
        )
      );
  END IF;
END;
$$;

COMMENT ON TABLE outfit_schedule IS
  'User-owned saved-outfit assignments to local calendar dates.';
