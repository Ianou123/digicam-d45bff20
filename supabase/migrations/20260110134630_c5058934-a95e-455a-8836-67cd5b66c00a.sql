-- V2 Phase 1: Remaining items (profiles policy already exists)

-- 12. Update RLS on profiles to allow department updates by admins
-- Drop if exists to avoid conflicts
DROP POLICY IF EXISTS "Admins can update staff departments" ON public.profiles;

CREATE POLICY "Admins can update staff departments"
  ON public.profiles FOR UPDATE
  USING ((is_client_admin(auth.uid()) OR is_super_admin(auth.uid())) AND 
         (is_super_admin(auth.uid()) OR client_id = get_user_client_id(auth.uid())))
  WITH CHECK ((is_client_admin(auth.uid()) OR is_super_admin(auth.uid())) AND 
              (is_super_admin(auth.uid()) OR client_id = get_user_client_id(auth.uid())));