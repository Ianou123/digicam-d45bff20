-- Allow client admins to insert roles for users in their organization
CREATE POLICY "Client admins can insert roles in their org"
ON public.user_roles
FOR INSERT
WITH CHECK (
  is_client_admin(auth.uid()) AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = user_roles.user_id 
    AND profiles.client_id = get_user_client_id(auth.uid())
  )
);

-- Allow client admins to delete roles for users in their organization  
CREATE POLICY "Client admins can delete roles in their org"
ON public.user_roles
FOR DELETE
USING (
  is_client_admin(auth.uid()) AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = user_roles.user_id 
    AND profiles.client_id = get_user_client_id(auth.uid())
  )
);