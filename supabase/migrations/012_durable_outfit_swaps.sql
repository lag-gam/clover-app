-- Atomically replace one item in an owned outfit and refresh its aggregate
-- embedding. Client-supplied user IDs are deliberately not accepted.
CREATE OR REPLACE FUNCTION swap_outfit_item(
  p_outfit_id UUID,
  p_outfit_item_id UUID,
  p_replacement_garment_id UUID
)
RETURNS SETOF outfit_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID := auth.uid();
  replaced outfit_items;
  replacement_owner UUID;
  refreshed_embedding JSONB;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT user_id INTO replacement_owner
  FROM garments
  WHERE id = p_replacement_garment_id
    AND user_id = owner_id
    AND processing_status = 'ready';

  IF replacement_owner IS NULL THEN
    RAISE EXCEPTION 'Replacement garment not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM outfit_items
    WHERE outfit_id = p_outfit_id
      AND garment_id = p_replacement_garment_id
      AND id <> p_outfit_item_id
  ) THEN
    RAISE EXCEPTION 'Replacement garment is already in this outfit';
  END IF;

  UPDATE outfit_items AS item
  SET
    garment_id = p_replacement_garment_id,
    display_side = 'front'
  FROM outfits AS outfit
  WHERE item.id = p_outfit_item_id
    AND item.outfit_id = p_outfit_id
    AND outfit.id = item.outfit_id
    AND outfit.user_id = owner_id
  RETURNING item.* INTO replaced;

  IF replaced.id IS NULL THEN
    RAISE EXCEPTION 'Outfit item not found';
  END IF;

  SELECT jsonb_agg(dimension.average_value ORDER BY dimension.ordinality)
  INTO refreshed_embedding
  FROM (
    SELECT value.ordinality, avg(value.coordinate::double precision) AS average_value
    FROM outfit_items AS item
    JOIN garments AS garment ON garment.id = item.garment_id
    CROSS JOIN LATERAL jsonb_array_elements_text(garment.embedding)
      WITH ORDINALITY AS value(coordinate, ordinality)
    WHERE item.outfit_id = p_outfit_id
      AND garment.embedding IS NOT NULL
    GROUP BY value.ordinality
  ) AS dimension;

  UPDATE outfits
  SET
    embedding = refreshed_embedding,
    score = NULL
  WHERE id = p_outfit_id
    AND user_id = owner_id;

  RETURN NEXT replaced;
END;
$$;

REVOKE ALL ON FUNCTION swap_outfit_item(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION swap_outfit_item(UUID, UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION swap_outfit_item(UUID, UUID, UUID) TO authenticated;
