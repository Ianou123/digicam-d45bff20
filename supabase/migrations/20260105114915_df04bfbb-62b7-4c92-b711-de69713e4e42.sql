-- Create function to check if user's client is suspended
CREATE OR REPLACE FUNCTION public.is_client_suspended(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.profiles p ON p.client_id = c.id
    WHERE p.id = _user_id AND c.status = 'suspended'
  )
$$;

-- Update documents INSERT policy to block suspended clients
DROP POLICY IF EXISTS "Admins can insert documents" ON documents;
CREATE POLICY "Admins can insert documents" ON documents
FOR INSERT WITH CHECK (
  (is_super_admin(auth.uid()) OR 
   (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid())))
  AND NOT is_client_suspended(auth.uid())
);

-- Update documents UPDATE policy to block suspended clients
DROP POLICY IF EXISTS "Admins can update documents" ON documents;
CREATE POLICY "Admins can update documents" ON documents
FOR UPDATE USING (
  (is_super_admin(auth.uid()) OR 
   (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid())))
  AND NOT is_client_suspended(auth.uid())
) WITH CHECK (
  (is_super_admin(auth.uid()) OR 
   (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid())))
  AND NOT is_client_suspended(auth.uid())
);

-- Update documents DELETE policy to block suspended clients
DROP POLICY IF EXISTS "Admins can delete documents" ON documents;
CREATE POLICY "Admins can delete documents" ON documents
FOR DELETE USING (
  (is_super_admin(auth.uid()) OR 
   (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid())))
  AND NOT is_client_suspended(auth.uid())
);