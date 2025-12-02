-- Fix RLS policies for homepage_sections to allow admins to see ALL sections
-- Run this if custom categories aren't showing in CategoryManager

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view enabled homepage sections" ON homepage_sections;
DROP POLICY IF EXISTS "Admins can manage homepage sections" ON homepage_sections;

-- Policy: Everyone can view enabled sections (for public homepage)
CREATE POLICY "Everyone can view enabled homepage sections" 
  ON homepage_sections 
  FOR SELECT 
  USING (enabled = true);

-- Policy: Admins can see and manage ALL sections (for admin panel)
-- This allows admins to see disabled sections too for management
CREATE POLICY "Admins can manage homepage sections" 
  ON homepage_sections 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Verify the policies
SELECT 
  policyname,
  cmd as command,
  CASE WHEN qual IS NOT NULL THEN 'Has USING clause' ELSE 'No USING' END as using_clause,
  CASE WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause' ELSE 'No WITH CHECK' END as with_check_clause
FROM pg_policies
WHERE tablename = 'homepage_sections'
ORDER BY policyname;

