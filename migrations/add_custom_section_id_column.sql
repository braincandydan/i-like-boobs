-- Add custom_section_id column to homepage_sections if it doesn't exist
-- Run this if you get: "Could not find the 'custom_section_id' column"

-- Check if column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'homepage_sections' 
    AND column_name = 'custom_section_id'
  ) THEN
    ALTER TABLE homepage_sections 
    ADD COLUMN custom_section_id UUID REFERENCES custom_sections(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Added custom_section_id column to homepage_sections';
  ELSE
    RAISE NOTICE 'Column custom_section_id already exists';
  END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'homepage_sections'
ORDER BY ordinal_position;

