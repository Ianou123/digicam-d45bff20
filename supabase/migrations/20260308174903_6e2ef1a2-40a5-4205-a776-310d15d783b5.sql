
-- Fix profiles SELECT policies: drop restrictive, recreate as permissive
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Ultra admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Client admins can view profiles in their org" ON public.profiles;
DROP POLICY IF EXISTS "Staff can view profiles in their org" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Super admins can view all profiles" ON public.profiles FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Ultra admins can view all profiles" ON public.profiles FOR SELECT USING (is_ultra_admin(auth.uid()));
CREATE POLICY "Client admins can view profiles in their org" ON public.profiles FOR SELECT USING (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));
CREATE POLICY "Staff can view profiles in their org" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL AND client_id = get_user_client_id(auth.uid()));

-- Fix profiles non-SELECT policies
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Ultra admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update staff departments" ON public.profiles;
DROP POLICY IF EXISTS "Client admins can manage profiles in their org" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Super admins can manage all profiles" ON public.profiles FOR ALL USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Ultra admins can manage all profiles" ON public.profiles FOR ALL USING (is_ultra_admin(auth.uid())) WITH CHECK (is_ultra_admin(auth.uid()));
CREATE POLICY "Admins can update staff departments" ON public.profiles FOR UPDATE USING ((is_client_admin(auth.uid()) OR is_super_admin(auth.uid())) AND (is_super_admin(auth.uid()) OR client_id = get_user_client_id(auth.uid()))) WITH CHECK ((is_client_admin(auth.uid()) OR is_super_admin(auth.uid())) AND (is_super_admin(auth.uid()) OR client_id = get_user_client_id(auth.uid())));
CREATE POLICY "Client admins can manage profiles in their org" ON public.profiles FOR INSERT WITH CHECK (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));

-- Fix user_roles policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Ultra admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Client admins can view roles in their org" ON public.user_roles;
DROP POLICY IF EXISTS "Client admins can insert roles in their org" ON public.user_roles;
DROP POLICY IF EXISTS "Client admins can delete roles in their org" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Super admins can manage all roles" ON public.user_roles FOR ALL USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Ultra admins can manage all roles" ON public.user_roles FOR ALL USING (is_ultra_admin(auth.uid())) WITH CHECK (is_ultra_admin(auth.uid()));
CREATE POLICY "Client admins can view roles in their org" ON public.user_roles FOR SELECT USING (is_client_admin(auth.uid()) AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = user_roles.user_id AND profiles.client_id = get_user_client_id(auth.uid())));
CREATE POLICY "Client admins can insert roles in their org" ON public.user_roles FOR INSERT WITH CHECK (is_client_admin(auth.uid()) AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = user_roles.user_id AND profiles.client_id = get_user_client_id(auth.uid())));
CREATE POLICY "Client admins can delete roles in their org" ON public.user_roles FOR DELETE USING (is_client_admin(auth.uid()) AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = user_roles.user_id AND profiles.client_id = get_user_client_id(auth.uid())));

-- Fix clients policies
DROP POLICY IF EXISTS "Users can see their own client" ON public.clients;
DROP POLICY IF EXISTS "Super admins can see all clients" ON public.clients;
DROP POLICY IF EXISTS "Ultra admins can see all clients" ON public.clients;
DROP POLICY IF EXISTS "Super admins can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Ultra admins can manage clients" ON public.clients;

CREATE POLICY "Users can see their own client" ON public.clients FOR SELECT USING (id = get_user_client_id(auth.uid()));
CREATE POLICY "Super admins can see all clients" ON public.clients FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Ultra admins can see all clients" ON public.clients FOR SELECT USING (is_ultra_admin(auth.uid()));
CREATE POLICY "Super admins can manage clients" ON public.clients FOR ALL USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Ultra admins can manage clients" ON public.clients FOR ALL USING (is_ultra_admin(auth.uid())) WITH CHECK (is_ultra_admin(auth.uid()));

-- Fix departments policies
DROP POLICY IF EXISTS "Staff can view departments in their org" ON public.departments;
DROP POLICY IF EXISTS "Super admins can view all departments" ON public.departments;
DROP POLICY IF EXISTS "Ultra admins can view all departments" ON public.departments;
DROP POLICY IF EXISTS "Client admins can view departments in their org" ON public.departments;
DROP POLICY IF EXISTS "Super admins can insert departments" ON public.departments;
DROP POLICY IF EXISTS "Super admins can update departments" ON public.departments;
DROP POLICY IF EXISTS "Client admins can insert departments in their org" ON public.departments;
DROP POLICY IF EXISTS "Client admins can update departments in their org" ON public.departments;

CREATE POLICY "Staff can view departments in their org" ON public.departments FOR SELECT USING (client_id = get_user_client_id(auth.uid()));
CREATE POLICY "Super admins can view all departments" ON public.departments FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Ultra admins can view all departments" ON public.departments FOR SELECT USING (is_ultra_admin(auth.uid()));
CREATE POLICY "Client admins can view departments in their org" ON public.departments FOR SELECT USING (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));
CREATE POLICY "Super admins can insert departments" ON public.departments FOR INSERT WITH CHECK (is_super_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));
CREATE POLICY "Super admins can update departments" ON public.departments FOR UPDATE USING (is_super_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid())) WITH CHECK (is_super_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));
CREATE POLICY "Client admins can insert departments in their org" ON public.departments FOR INSERT WITH CHECK (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));
CREATE POLICY "Client admins can update departments in their org" ON public.departments FOR UPDATE USING (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid())) WITH CHECK (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));
