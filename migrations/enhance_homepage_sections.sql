-- Migration: Enhance homepage_sections with page visibility and TMDB filters
-- Run this SQL in your Supabase SQL Editor

-- Ensure custom_section_id column exists (if not already added)
ALTER TABLE homepage_sections 
ADD COLUMN IF NOT EXISTS custom_section_id UUID REFERENCES custom_sections(id) ON DELETE CASCADE;

-- Ensure section_type column exists (determines if builtin or custom)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'homepage_sections' 
    AND column_name = 'section_type'
  ) THEN
    ALTER TABLE homepage_sections 
    ADD COLUMN section_type TEXT;
  END IF;
END $$;

-- Update section_type for existing sections
-- Default to 'builtin' for sections without custom_section_id
UPDATE homepage_sections
SET section_type = CASE 
  WHEN custom_section_id IS NOT NULL THEN 'custom'
  ELSE 'builtin'
END
WHERE section_type IS NULL;

-- Add CHECK constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'homepage_sections' 
    AND constraint_name = 'homepage_sections_section_type_check'
  ) THEN
    ALTER TABLE homepage_sections 
    ADD CONSTRAINT homepage_sections_section_type_check 
    CHECK (section_type IN ('builtin', 'custom'));
  END IF;
END $$;

-- Ensure config column exists (should already exist based on schema screenshot)
-- This migration assumes config is already a JSONB column

-- Update existing sections to have default config if they don't have one
UPDATE homepage_sections
SET config = jsonb_build_object(
  'visible_on', ARRAY['homepage']::text[],
  'page_order', jsonb_build_object('homepage', order_index)
)
WHERE config IS NULL OR config = '{}'::jsonb;

-- For sections that have config but missing visible_on
UPDATE homepage_sections
SET config = config || jsonb_build_object(
  'visible_on', COALESCE(config->'visible_on', '["homepage"]'::jsonb)
)
WHERE config->'visible_on' IS NULL;

-- For sections that have config but missing page_order
UPDATE homepage_sections
SET config = config || jsonb_build_object(
  'page_order', COALESCE(config->'page_order', jsonb_build_object('homepage', order_index))
)
WHERE config->'page_order' IS NULL;

-- Create index on config for better query performance
CREATE INDEX IF NOT EXISTS idx_homepage_sections_config_visible_on 
ON homepage_sections USING GIN ((config->'visible_on'));

-- Helper function to refresh schema cache (can be called if needed)
CREATE OR REPLACE FUNCTION refresh_schema_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Force schema refresh by querying the table structure
  PERFORM column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'homepage_sections'
  LIMIT 1;
  
  RAISE NOTICE 'Schema cache refresh attempted. If issues persist, check Supabase dashboard.';
END;
$$;

-- Verify the updates
SELECT 
  id,
  title,
  section_type,
  config->'visible_on' as visible_on,
  config->'page_order' as page_order,
  CASE 
    WHEN config->'tmdb_filters' IS NOT NULL THEN 'Has filters'
    ELSE 'No filters'
  END as filter_status
FROM homepage_sections
LIMIT 5;

