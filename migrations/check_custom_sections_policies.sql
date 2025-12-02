-- Check and fix RLS policies for custom_sections table
-- Run this if movies can't be added to categories

-- Check current policies
SELECT 
  policyname,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'custom_sections';

-- Drop existing policies if they're blocking
DROP POLICY IF EXISTS "Admin can manage custom sections" ON custom_sections;
DROP POLICY IF EXISTS "Everyone can view enabled custom sections" ON custom_sections;
DROP POLICY IF EXISTS "Users can manage own custom sections" ON custom_sections;

-- Create better policies
-- Admins can do everything
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

-- Everyone can view enabled custom sections
CREATE POLICY "Everyone can view enabled custom sections" 
  ON custom_sections 
  FOR SELECT 
  USING (enabled = true);

-- Verify policies
SELECT 
  'Policies created' as status,
  COUNT(*)::text as policy_count
FROM pg_policies
WHERE tablename = 'custom_sections';

