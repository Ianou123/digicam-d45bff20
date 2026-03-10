
-- Fix Super Admin RLS policies: scope to their own org instead of global access
-- Super admins should only see data from their own organization (via client_id)
-- Ultra admins are the only ones with cross-org visibility

-- 1. DEPARTMENTS: Super admins should only see their org's departments
DROP POLICY IF EXISTS "Super admins can view all departments" ON public.departments;
CREATE POLICY "Super admins can view departments in their org"
  ON public.departments FOR SELECT
  USING (is_super_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));

DROP POLICY IF EXISTS "Super admins can insert departments" ON public.departments;
CREATE POLICY "Super admins can insert departments in their org"
  ON public.departments FOR INSERT
  WITH CHECK (is_super_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));

DROP POLICY IF EXISTS "Super admins can update departments" ON public.departments;
CREATE POLICY "Super admins can update departments in their org"
  ON public.departments FOR UPDATE
  USING (is_super_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));

-- 2. ACTIVITY_LOGS: Super admins should only see their org's activity
DROP POLICY IF EXISTS "Super admins can view all activity" ON public.activity_logs;
CREATE POLICY "Super admins can view activity in their org"
  ON public.activity_logs FOR SELECT
  USING (is_super_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));

-- 3. SEARCH_LOGS: Super admins should only see their org's search logs
DROP POLICY IF EXISTS "Super admins can view all search logs" ON public.search_logs;
CREATE POLICY "Super admins can view search logs in their org"
  ON public.search_logs FOR SELECT
  USING (is_super_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));

-- 4. PROFILES: Super admins should only see/manage profiles in their org
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view profiles in their org"
  ON public.profiles FOR SELECT
  USING (is_super_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));

DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
CREATE POLICY "Super admins can manage profiles in their org"
  ON public.profiles FOR ALL
  USING (is_super_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));

-- 5. DOCUMENTS: Super admins should only see documents in their org
DROP POLICY IF EXISTS "Super admins can see all documents" ON public.documents;
CREATE POLICY "Super admins can see documents in their org"
  ON public.documents FOR SELECT
  USING (is_super_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));

-- 6. USER_ROLES: Super admins should only manage roles in their org
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
CREATE POLICY "Super admins can manage roles in their org"
  ON public.user_roles FOR ALL
  USING (is_super_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = user_roles.user_id AND profiles.client_id = get_user_client_id(auth.uid())
  ))
  WITH CHECK (is_super_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = user_roles.user_id AND profiles.client_id = get_user_client_id(auth.uid())
  ));

-- 7. ADMIN_AUDIT_LOGS: Super admins should only see their org's audit logs
DROP POLICY IF EXISTS "Super admins can view all admin audit logs" ON public.admin_audit_logs;
CREATE POLICY "Super admins can view admin audit logs in their org"
  ON public.admin_audit_logs FOR SELECT
  USING (is_super_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));

-- 8. SUPER_ADMIN_AUDIT_LOGS: Super admins should only see their own logs
-- (This table is for super admin actions, keep scoped)

-- 9. DOCUMENT_IMMUTABLE_LOG: Super admins should only see their org's logs
DROP POLICY IF EXISTS "Super admins can view all immutable logs" ON public.document_immutable_log;
CREATE POLICY "Super admins can view immutable logs in their org"
  ON public.document_immutable_log FOR SELECT
  USING (is_super_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM documents d WHERE d.id = document_immutable_log.document_id AND d.client_id = get_user_client_id(auth.uid())
  ));

-- 10. CLIENTS: Super admins should only see their own client
DROP POLICY IF EXISTS "Super admins can manage clients" ON public.clients;
CREATE POLICY "Super admins can manage own client"
  ON public.clients FOR ALL
  USING (is_super_admin(auth.uid()) AND id = get_user_client_id(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) AND id = get_user_client_id(auth.uid()));

DROP POLICY IF EXISTS "Super admins can see all clients" ON public.clients;
CREATE POLICY "Super admins can see own client"
  ON public.clients FOR SELECT
  USING (is_super_admin(auth.uid()) AND id = get_user_client_id(auth.uid()));
