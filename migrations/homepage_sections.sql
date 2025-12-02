-- Migration: Add homepage_sections table for managing homepage category order
-- Run this SQL in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS homepage_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  section_type TEXT NOT NULL CHECK (section_type IN ('builtin', 'custom')),
  custom_section_id UUID REFERENCES custom_sections(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable Row Level Security
ALTER TABLE homepage_sections ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view enabled sections
CREATE POLICY "Everyone can view enabled homepage sections" ON homepage_sections 
  FOR SELECT USING (enabled = true);

-- Policy: Admins can manage all sections
CREATE POLICY "Admins can manage homepage sections" ON homepage_sections 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Insert default homepage sections
INSERT INTO homepage_sections (section_key, title, section_type, order_index, enabled)
VALUES 
  ('trending', 'Trending Now', 'builtin', 0, true),
  ('popular-movies', 'Popular Movies', 'builtin', 1, true),
  ('top-rated', 'Top Rated Movies', 'builtin', 2, true),
  ('popular-tv', 'Popular TV Shows', 'builtin', 3, true),
  ('upcoming', 'Upcoming Movies', 'builtin', 4, true)
ON CONFLICT (section_key) DO NOTHING;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_homepage_sections_order ON homepage_sections(order_index, enabled);

