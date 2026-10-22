-- Extend garment metadata for deterministic flat-lay styling.
-- Existing rows remain valid: subtype is nullable and metal_tone defaults to none.

ALTER TABLE garments
  ADD COLUMN IF NOT EXISTS subtype TEXT,
  ADD COLUMN IF NOT EXISTS metal_tone TEXT;

UPDATE garments
SET metal_tone = 'none'
WHERE metal_tone IS NULL;

ALTER TABLE garments
  ALTER COLUMN metal_tone SET DEFAULT 'none',
  ALTER COLUMN metal_tone SET NOT NULL;

-- Replace the original category check without assuming its generated name.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.garments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ~ '\mcategory\M'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.garments DROP CONSTRAINT %I',
      constraint_name
    );
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.garments'::regclass
      AND conname = 'garments_category_check'
  ) THEN
    ALTER TABLE public.garments
      ADD CONSTRAINT garments_category_check
      CHECK (
        category IN (
          'tops', 'bottoms', 'dresses', 'outerwear',
          'shoes', 'underwear', 'accessories'
        )
      ) NOT VALID;
  END IF;
END;
$$;

ALTER TABLE garments
  VALIDATE CONSTRAINT garments_category_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.garments'::regclass
      AND conname = 'garments_subtype_check'
  ) THEN
    ALTER TABLE public.garments
      ADD CONSTRAINT garments_subtype_check
      CHECK (
        subtype IS NULL OR subtype IN (
          't_shirt', 'shirt', 'blouse', 'tank_top', 'sweater', 'hoodie',
          'jeans', 'trousers', 'shorts', 'skirt',
          'dress', 'jumpsuit',
          'jacket', 'coat', 'blazer', 'vest',
          'sneakers', 'boots', 'loafers', 'sandals', 'heels',
          'boxers', 'briefs', 'boxer_briefs',
          'necklace', 'watch', 'hat', 'beanie', 'belt', 'bag', 'glasses',
          'bracelet', 'ring', 'earbuds',
          'other'
        )
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.garments'::regclass
      AND conname = 'garments_metal_tone_check'
  ) THEN
    ALTER TABLE public.garments
      ADD CONSTRAINT garments_metal_tone_check
      CHECK (
        metal_tone IN ('none', 'silver', 'gold', 'rose_gold', 'mixed')
      ) NOT VALID;
  END IF;
END;
$$;

ALTER TABLE garments
  VALIDATE CONSTRAINT garments_subtype_check;
ALTER TABLE garments
  VALIDATE CONSTRAINT garments_metal_tone_check;

CREATE INDEX IF NOT EXISTS idx_garments_user_category_subtype
  ON garments(user_id, category, subtype);

COMMENT ON COLUMN garments.subtype IS
  'Structured garment subtype used for outfit compatibility and flat-lay placement.';
COMMENT ON COLUMN garments.metal_tone IS
  'Dominant hardware or jewelry tone: none, silver, gold, rose_gold, or mixed.';

-- Existing garment RLS policies are row-based and automatically cover these
-- columns. No additional grants or policies are required.
