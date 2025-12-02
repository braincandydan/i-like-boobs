-- Diagnostic queries to check why profiles aren't being created
-- Run these one by one in Supabase SQL Editor to diagnose the issue

-- 1. Check if trigger exists
SELECT 
  tgname as trigger_name,
  tgtype,
  tgenabled,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';

-- 2. Check if function exists and is correct
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE proname = 'handle_new_user';

-- 3. Check if profiles table exists and has correct structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 4. Check all users in auth.users
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- 5. Check all profiles
SELECT 
  id,
  email,
  role,
  created_at
FROM profiles
ORDER BY created_at DESC;

-- 6. Find users without profiles
SELECT 
  u.id,
  u.email,
  u.created_at as user_created,
  p.id as profile_id
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- 7. Check RLS policies on profiles table
SELECT 
  policyname,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'profiles';

-- 8. Test the function directly (replace 'USER_ID_HERE' with an actual user ID from step 4)
-- SELECT public.handle_new_user();

-- 9. Check for any errors in trigger execution (if you have access to logs)
-- This would be in Supabase Dashboard → Logs → Database

