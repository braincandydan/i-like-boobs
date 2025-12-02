-- Comprehensive fix for profile creation issues
-- Run this entire script in Supabase SQL Editor

-- Step 1: Ensure profiles table exists with correct structure
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Step 2: Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_user_update();

-- Step 3: Create the function with explicit schema and better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert profile with all possible metadata
  INSERT INTO public.profiles (id, email, username, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', NULL),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE((NEW.raw_user_meta_data->>'role')::text, 'user')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    updated_at = NOW();
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log the error (you can check this in Supabase logs)
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Step 4: Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Update function for email changes
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    email = NEW.email,
    updated_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Step 6: Create trigger for email updates
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_update();

-- Step 7: Ensure RLS is enabled but with proper policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Step 8: Drop and recreate RLS policies to ensure they're correct
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Public read access
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own profile (the trigger uses SECURITY DEFINER so this is for manual inserts)
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Step 9: Create profiles for any existing users that don't have one
INSERT INTO public.profiles (id, email, role)
SELECT 
  u.id,
  u.email,
  'user' as role
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- Step 10: Verify the setup
SELECT 
  'Trigger exists' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'on_auth_user_created'
    ) THEN '✓ YES'
    ELSE '✗ NO'
  END as result
UNION ALL
SELECT 
  'Function exists' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'handle_new_user'
    ) THEN '✓ YES'
    ELSE '✗ NO'
  END as result
UNION ALL
SELECT 
  'Profiles table exists' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'profiles'
    ) THEN '✓ YES'
    ELSE '✗ NO'
  END as result
UNION ALL
SELECT 
  'All users have profiles' as check_type,
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM auth.users u
      LEFT JOIN profiles p ON u.id = p.id
      WHERE p.id IS NULL
    ) THEN '✓ YES'
    ELSE '✗ NO (run diagnostic query to see which users are missing profiles)'
  END as result;

