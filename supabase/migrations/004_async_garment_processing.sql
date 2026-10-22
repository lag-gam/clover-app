-- Track server-side garment enrichment without blocking capture.
ALTER TABLE garments
  ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'ready'
    CHECK (processing_status IN ('pending', 'processing', 'ready', 'failed')),
  ADD COLUMN processing_attempts INTEGER NOT NULL DEFAULT 0
    CHECK (processing_attempts >= 0),
  ADD COLUMN processing_error TEXT,
  ADD COLUMN processing_started_at TIMESTAMPTZ,
  ADD COLUMN processing_completed_at TIMESTAMPTZ;

-- Existing garments are already enriched. New client inserts start pending.
ALTER TABLE garments
  ALTER COLUMN processing_status SET DEFAULT 'pending';

CREATE INDEX idx_garments_processing_status
  ON garments(user_id, processing_status)
  WHERE processing_status <> 'ready';

-- Atomically claim pending work so duplicate function invocations cannot enrich
-- the same garment concurrently.
CREATE OR REPLACE FUNCTION claim_garment_processing(
  p_garment_id UUID,
  p_user_id UUID
)
RETURNS SETOF garments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE garments
  SET
    processing_status = 'processing',
    processing_attempts = processing_attempts + 1,
    processing_error = NULL,
    processing_started_at = now(),
    processing_completed_at = NULL,
    updated_at = now()
  WHERE id = p_garment_id
    AND user_id = p_user_id
    AND (
      processing_status IN ('pending', 'failed')
      OR (
        processing_status = 'processing'
        AND processing_started_at <= now() - interval '5 minutes'
      )
    )
  RETURNING garments.*;
END;
$$;

REVOKE ALL ON FUNCTION claim_garment_processing(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_garment_processing(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION claim_garment_processing(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_garment_processing(UUID, UUID) TO service_role;

-- Let an authenticated owner recover failed work or work abandoned before or
-- during an Edge Function invocation. Fresh jobs cannot be reset, which avoids
-- running two provider pipelines for normal duplicate taps.
CREATE OR REPLACE FUNCTION retry_garment_processing(p_garment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID := auth.uid();
  retried BOOLEAN := false;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE garments
  SET
    processing_status = 'pending',
    processing_error = NULL,
    processing_started_at = NULL,
    processing_completed_at = NULL,
    updated_at = now()
  WHERE id = p_garment_id
    AND user_id = owner_id
    AND (
      processing_status = 'failed'
      OR (
        processing_status = 'pending'
        AND updated_at <= now() - interval '5 minutes'
      )
      OR (
        processing_status = 'processing'
        AND processing_started_at <= now() - interval '5 minutes'
      )
    )
  RETURNING true INTO retried;

  RETURN COALESCE(retried, false);
END;
$$;

REVOKE ALL ON FUNCTION retry_garment_processing(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION retry_garment_processing(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION retry_garment_processing(UUID) TO authenticated;

-- Let open closet/detail screens receive enrichment state changes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'garments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE garments;
  END IF;
END
$$;
