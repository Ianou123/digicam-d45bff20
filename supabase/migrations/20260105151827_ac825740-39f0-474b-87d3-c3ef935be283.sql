-- Add status column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN status text NOT NULL DEFAULT 'active';

-- Add check constraint for valid values
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_status_check 
CHECK (status IN ('active', 'deactivated'));

-- Mark users without roles as deactivated (retroactive fix)
UPDATE public.profiles 
SET status = 'deactivated' 
WHERE id NOT IN (SELECT user_id FROM public.user_roles);

-- Create helper function to check if user is deactivated
CREATE OR REPLACE FUNCTION public.is_user_deactivated(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND status = 'deactivated'
  )
$$;