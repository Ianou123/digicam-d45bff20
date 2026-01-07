-- Drop the existing staff policy that doesn't require explicit authentication
DROP POLICY IF EXISTS "Staff can view profiles in their org" ON public.profiles;

-- Recreate with explicit authentication check
CREATE POLICY "Staff can view profiles in their org"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL AND client_id = get_user_client_id(auth.uid()));