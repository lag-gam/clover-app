-- Add optional back imagery and persist the side shown for each outfit item.
-- All changes are additive so existing clients continue to read front imagery.
ALTER TABLE garments
  ADD COLUMN IF NOT EXISTS back_image_url TEXT,
  ADD COLUMN IF NOT EXISTS back_cutout_url TEXT;

ALTER TABLE outfit_items
  ADD COLUMN IF NOT EXISTS display_side TEXT;

UPDATE outfit_items
SET display_side = 'front'
WHERE display_side IS NULL;

ALTER TABLE outfit_items
  ALTER COLUMN display_side SET DEFAULT 'front',
  ALTER COLUMN display_side SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'outfit_items_display_side_check'
      AND conrelid = 'public.outfit_items'::regclass
  ) THEN
    ALTER TABLE outfit_items
      ADD CONSTRAINT outfit_items_display_side_check
      CHECK (display_side IN ('front', 'back'));
  END IF;
END
$$;
