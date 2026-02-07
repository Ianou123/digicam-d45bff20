-- 4. Create or replace the handle_new_user function to make first user of org a super_admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _invite_code TEXT;
  _client_id UUID;
  _is_first_user BOOLEAN;
BEGIN
  -- Extract invite code from metadata if provided
  _invite_code := NEW.raw_user_meta_data ->> 'invite_code';
  
  -- Look up client by invite code
  IF _invite_code IS NOT NULL AND _invite_code != '' THEN
    SELECT id INTO _client_id FROM public.clients WHERE invite_code = _invite_code;
  END IF;
  
  -- Check if this is the first user for this client
  IF _client_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE client_id = _client_id 
      AND id != NEW.id
    ) INTO _is_first_user;
  ELSE
    _is_first_user := FALSE;
  END IF;
  
  -- Create the profile
  INSERT INTO public.profiles (id, email, full_name, client_id, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    _client_id,
    'active'
  );
  
  -- Assign role based on whether this is the first user
  IF _client_id IS NOT NULL THEN
    IF _is_first_user THEN
      -- First user of organization gets super_admin role
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'super_admin');
    ELSE
      -- Subsequent users get staff role
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'staff');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Create helper function to check if user is ultra_admin
CREATE OR REPLACE FUNCTION public.is_ultra_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'ultra_admin'
  )
$$;

-- 6. Update is_super_admin to exclude ultra_admin (they are separate now)
-- Note: For backward compatibility, is_super_admin will still work for super_admin role
-- Ultra admins have their own function

-- 7. Update RLS policies for user_roles to allow ultra_admin
DROP POLICY IF EXISTS "Ultra admins can manage all roles" ON public.user_roles;
CREATE POLICY "Ultra admins can manage all roles"
  ON public.user_roles
  FOR ALL
  USING (is_ultra_admin(auth.uid()))
  WITH CHECK (is_ultra_admin(auth.uid()));

-- 8. Update RLS policies for clients to allow ultra_admin
DROP POLICY IF EXISTS "Ultra admins can manage clients" ON public.clients;
CREATE POLICY "Ultra admins can manage clients"
  ON public.clients
  FOR ALL
  USING (is_ultra_admin(auth.uid()))
  WITH CHECK (is_ultra_admin(auth.uid()));

DROP POLICY IF EXISTS "Ultra admins can see all clients" ON public.clients;
CREATE POLICY "Ultra admins can see all clients"
  ON public.clients
  FOR SELECT
  USING (is_ultra_admin(auth.uid()));

-- 9. Update RLS policies for profiles to allow ultra_admin
DROP POLICY IF EXISTS "Ultra admins can manage all profiles" ON public.profiles;
CREATE POLICY "Ultra admins can manage all profiles"
  ON public.profiles
  FOR ALL
  USING (is_ultra_admin(auth.uid()))
  WITH CHECK (is_ultra_admin(auth.uid()));

DROP POLICY IF EXISTS "Ultra admins can view all profiles" ON public.profiles;
CREATE POLICY "Ultra admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (is_ultra_admin(auth.uid()));

-- 10. Update RLS policies for documents to allow ultra_admin
DROP POLICY IF EXISTS "Ultra admins can see all documents" ON public.documents;
CREATE POLICY "Ultra admins can see all documents"
  ON public.documents
  FOR SELECT
  USING (is_ultra_admin(auth.uid()));

-- 11. Update RLS for activity_logs
DROP POLICY IF EXISTS "Ultra admins can view all activity" ON public.activity_logs;
CREATE POLICY "Ultra admins can view all activity"
  ON public.activity_logs
  FOR SELECT
  USING (is_ultra_admin(auth.uid()));

-- 12. Update RLS for departments
DROP POLICY IF EXISTS "Ultra admins can view all departments" ON public.departments;
CREATE POLICY "Ultra admins can view all departments"
  ON public.departments
  FOR SELECT
  USING (is_ultra_admin(auth.uid()));