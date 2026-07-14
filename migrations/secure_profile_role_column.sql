-- Security fix: prevent privilege escalation via the profiles.role column.
--
-- Two holes existed:
-- 1. handle_new_user() copied role straight from the client-supplied
--    auth.users.raw_user_meta_data, so anyone calling the Supabase Auth
--    signup endpoint directly (bypassing the app's signUp() call) could pass
--    `data: { role: 'admin' }` and be created as an admin.
-- 2. The "Users can update own profile" RLS policy only checked
--    `auth.uid() = id`, so any authenticated user could
--    `update({ role: 'admin' }).eq('id', <own id>)` and promote themselves,
--    since custom_sections/homepage_sections RLS trusts profiles.role.
--
-- Fix: the signup trigger now always inserts role = 'user', and a new
-- BEFORE UPDATE trigger pins role to its previous value unless the request
-- is made with the service_role key (i.e. from the Supabase dashboard or a
-- trusted backend, not from a browser using the anon/authenticated key).
-- There is currently no in-app "promote user to admin" feature, so admin
-- promotion must be done via the Supabase dashboard/service role.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', NULL),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    'user'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND auth.role() <> 'service_role' THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_role_on_update ON public.profiles;
CREATE TRIGGER protect_profile_role_on_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();
