
-- Allow Super Admins to insert departments in their organization
CREATE POLICY "Super admins can insert departments"
ON public.departments
FOR INSERT
WITH CHECK (
  is_super_admin(auth.uid()) 
  AND client_id = get_user_client_id(auth.uid())
);

-- Allow Super Admins to update departments in their organization
CREATE POLICY "Super admins can update departments"
ON public.departments
FOR UPDATE
USING (
  is_super_admin(auth.uid()) 
  AND client_id = get_user_client_id(auth.uid())
)
WITH CHECK (
  is_super_admin(auth.uid()) 
  AND client_id = get_user_client_id(auth.uid())
);
