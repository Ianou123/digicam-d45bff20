-- Add invite_code column to clients table
ALTER TABLE public.clients 
ADD COLUMN invite_code TEXT UNIQUE;

-- Create function to get client by invite code
CREATE OR REPLACE FUNCTION public.get_client_by_invite_code(_code TEXT)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.clients WHERE invite_code = _code
$$;

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Update handle_new_user function to process invite code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite_code TEXT;
  _client_id UUID;
BEGIN
  -- Get invite code from user metadata
  _invite_code := NEW.raw_user_meta_data ->> 'invite_code';
  
  -- If invite code provided, find the client
  IF _invite_code IS NOT NULL AND _invite_code != '' THEN
    SELECT id INTO _client_id FROM public.clients WHERE invite_code = _invite_code;
  END IF;

  -- Insert profile with client_id if found
  INSERT INTO public.profiles (id, email, full_name, client_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    _client_id
  );
  
  -- If client found, assign staff role
  IF _client_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'staff');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();