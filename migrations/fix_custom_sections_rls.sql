-- Fix RLS policies for custom_sections to allow admin updates
-- Run this if you can't add movies to categories

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can manage custom sections" ON custom_sections;
DROP POLICY IF EXISTS "Everyone can view enabled custom sections" ON custom_sections;

-- Create policy that allows admins to do everything (INSERT, UPDATE, DELETE, SELECT)
CREATE POLICY "Admin can manage custom sections" 
  ON custom_sections 
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

-- Everyone can view enabled custom sections (for homepage display)
CREATE POLICY "Everyone can view enabled custom sections" 
  ON custom_sections 
  FOR SELECT 
  USING (enabled = true);

-- Verify the policies
SELECT 
  policyname,
  cmd as command,
  CASE WHEN qual IS NOT NULL THEN 'Has USING clause' ELSE 'No USING' END as using_clause,
  CASE WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause' ELSE 'No WITH CHECK' END as with_check_clause
FROM pg_policies
WHERE tablename = 'custom_sections';

