-- User-owned physical closet sections and stable garment placement.
CREATE TABLE closet_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 48),
  kind TEXT NOT NULL CHECK (kind IN ('rail', 'shelf', 'drawer')),
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_closet_sections_user_position
  ON closet_sections(user_id, position, id);

ALTER TABLE closet_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own closet sections" ON closet_sections
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own closet sections" ON closet_sections
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own closet sections" ON closet_sections
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own closet sections" ON closet_sections
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION seed_default_closet_sections(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM closet_sections WHERE user_id = p_user_id
  ) THEN
    INSERT INTO closet_sections (user_id, name, kind, position)
    VALUES
      (p_user_id, 'Everyday rail', 'rail', 0),
      (p_user_id, 'Folded favorites', 'shelf', 1),
      (p_user_id, 'Accessories', 'drawer', 2);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION seed_default_closet_sections(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION seed_new_user_closet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM seed_default_closet_sections(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_seed_closet ON auth.users;
CREATE TRIGGER on_auth_user_seed_closet
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION seed_new_user_closet();

-- Seed existing accounts before assigning their existing garments.
DO $$
DECLARE
  existing_user RECORD;
BEGIN
  FOR existing_user IN SELECT id FROM auth.users LOOP
    PERFORM seed_default_closet_sections(existing_user.id);
  END LOOP;
END;
$$;

ALTER TABLE garments
  ADD COLUMN section_id UUID REFERENCES closet_sections(id) ON DELETE SET NULL,
  ADD COLUMN position INTEGER;

WITH default_sections AS (
  SELECT DISTINCT ON (user_id) user_id, id
  FROM closet_sections
  ORDER BY user_id, position, id
),
ordered_garments AS (
  SELECT
    garments.id,
    default_sections.id AS section_id,
    row_number() OVER (
      PARTITION BY garments.user_id
      ORDER BY garments.created_at, garments.id
    ) - 1 AS position
  FROM garments
  JOIN default_sections ON default_sections.user_id = garments.user_id
)
UPDATE garments
SET
  section_id = ordered_garments.section_id,
  position = ordered_garments.position
FROM ordered_garments
WHERE garments.id = ordered_garments.id;

ALTER TABLE garments
  ALTER COLUMN position SET NOT NULL;

CREATE INDEX idx_garments_section_position
  ON garments(section_id, position, id);

CREATE OR REPLACE FUNCTION assign_garment_closet_position()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  section_owner UUID;
BEGIN
  IF NEW.section_id IS NULL THEN
    PERFORM seed_default_closet_sections(NEW.user_id);
    SELECT id
    INTO NEW.section_id
    FROM closet_sections
    WHERE user_id = NEW.user_id
    ORDER BY position, id
    LIMIT 1;
  END IF;

  SELECT user_id
  INTO section_owner
  FROM closet_sections
  WHERE id = NEW.section_id;

  IF section_owner IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Closet section does not belong to garment owner';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.position IS NULL THEN
    SELECT COALESCE(max(position) + 1, 0)
    INTO NEW.position
    FROM garments
    WHERE section_id = NEW.section_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_garment_closet_placement ON garments;
CREATE TRIGGER before_garment_closet_placement
  BEFORE INSERT OR UPDATE OF section_id ON garments
  FOR EACH ROW EXECUTE FUNCTION assign_garment_closet_position();

CREATE OR REPLACE FUNCTION create_closet_section(
  p_name TEXT,
  p_kind TEXT
)
RETURNS closet_sections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID := auth.uid();
  created_section closet_sections;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_kind NOT IN ('rail', 'shelf', 'drawer') THEN
    RAISE EXCEPTION 'Invalid closet section kind';
  END IF;
  IF char_length(trim(p_name)) NOT BETWEEN 1 AND 48 THEN
    RAISE EXCEPTION 'Section name must be 1 to 48 characters';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::TEXT, 0));

  INSERT INTO closet_sections (user_id, name, kind, position)
  SELECT owner_id, trim(p_name), p_kind, COALESCE(max(position) + 1, 0)
  FROM closet_sections
  WHERE user_id = owner_id
  RETURNING * INTO created_section;

  RETURN created_section;
END;
$$;

CREATE OR REPLACE FUNCTION reorder_closet_sections(p_ordered_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID := auth.uid();
  section_count INTEGER;
  distinct_count INTEGER;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::TEXT, 0));

  SELECT count(*) INTO section_count
  FROM closet_sections
  WHERE user_id = owner_id;

  SELECT count(DISTINCT requested.id) INTO distinct_count
  FROM unnest(p_ordered_ids) AS requested(id);

  IF p_ordered_ids IS NULL
    OR cardinality(p_ordered_ids) <> section_count
    OR distinct_count <> section_count
    OR EXISTS (
      SELECT 1
      FROM unnest(p_ordered_ids) AS requested(id)
      LEFT JOIN closet_sections
        ON closet_sections.id = requested.id
        AND closet_sections.user_id = owner_id
      WHERE closet_sections.id IS NULL
    )
  THEN
    RAISE EXCEPTION 'Section order must include every owned section exactly once';
  END IF;

  UPDATE closet_sections
  SET
    position = requested.ordinality - 1,
    updated_at = now()
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS requested(id, ordinality)
  WHERE closet_sections.id = requested.id
    AND closet_sections.user_id = owner_id;
END;
$$;

CREATE OR REPLACE FUNCTION place_garment(
  p_garment_id UUID,
  p_section_id UUID,
  p_position INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID := auth.uid();
  old_section_id UUID;
  old_position INTEGER;
  target_count INTEGER;
  target_position INTEGER;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_position IS NULL THEN
    RAISE EXCEPTION 'Garment position is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::TEXT, 0));

  SELECT section_id, position
  INTO old_section_id, old_position
  FROM garments
  WHERE id = p_garment_id AND user_id = owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Garment not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM closet_sections
    WHERE id = p_section_id AND user_id = owner_id
  ) THEN
    RAISE EXCEPTION 'Closet section not found';
  END IF;

  UPDATE garments
  SET position = -1
  WHERE id = p_garment_id;

  IF old_section_id IS NOT NULL THEN
    UPDATE garments
    SET
      position = position - 1,
      updated_at = now()
    WHERE user_id = owner_id
      AND section_id = old_section_id
      AND position > old_position;
  END IF;

  SELECT count(*) INTO target_count
  FROM garments
  WHERE user_id = owner_id
    AND section_id = p_section_id
    AND id <> p_garment_id;

  target_position := greatest(0, least(p_position, target_count));

  UPDATE garments
  SET
    position = position + 1,
    updated_at = now()
  WHERE user_id = owner_id
    AND section_id = p_section_id
    AND position >= target_position;

  UPDATE garments
  SET
    section_id = p_section_id,
    position = target_position,
    updated_at = now()
  WHERE id = p_garment_id;
END;
$$;

REVOKE ALL ON FUNCTION create_closet_section(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION reorder_closet_sections(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION place_garment(UUID, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_closet_section(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_closet_sections(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION place_garment(UUID, UUID, INTEGER) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'closet_sections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE closet_sections;
  END IF;
END
$$;
