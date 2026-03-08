
-- Fix activity_logs policies
DROP POLICY IF EXISTS "Users can view own activity" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can insert own activity" ON public.activity_logs;
DROP POLICY IF EXISTS "Super admins can view all activity" ON public.activity_logs;
DROP POLICY IF EXISTS "Ultra admins can view all activity" ON public.activity_logs;
DROP POLICY IF EXISTS "Client admins can view org activity" ON public.activity_logs;

CREATE POLICY "Users can view own activity" ON public.activity_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own activity" ON public.activity_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Super admins can view all activity" ON public.activity_logs FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Ultra admins can view all activity" ON public.activity_logs FOR SELECT USING (is_ultra_admin(auth.uid()));
CREATE POLICY "Client admins can view org activity" ON public.activity_logs FOR SELECT USING (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));

-- Fix search_logs policies
DROP POLICY IF EXISTS "Users can insert own search logs" ON public.search_logs;
DROP POLICY IF EXISTS "Super admins can view all search logs" ON public.search_logs;
DROP POLICY IF EXISTS "Client admins can view org search logs" ON public.search_logs;

CREATE POLICY "Users can insert own search logs" ON public.search_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Super admins can view all search logs" ON public.search_logs FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Client admins can view org search logs" ON public.search_logs FOR SELECT USING (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));

-- Fix documents policies
DROP POLICY IF EXISTS "Super admins can see all documents" ON public.documents;
DROP POLICY IF EXISTS "Ultra admins can see all documents" ON public.documents;
DROP POLICY IF EXISTS "Users can see documents based on confidentiality" ON public.documents;
DROP POLICY IF EXISTS "Admins can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can update documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can delete documents respecting module" ON public.documents;

CREATE POLICY "Super admins can see all documents" ON public.documents FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Ultra admins can see all documents" ON public.documents FOR SELECT USING (is_ultra_admin(auth.uid()));
CREATE POLICY "Users can see documents based on confidentiality" ON public.documents FOR SELECT USING (client_id = get_user_client_id(auth.uid()) AND (is_super_admin(auth.uid()) OR is_client_admin(auth.uid()) OR confidentiality_level IN ('public', 'internal') OR (confidentiality_level = 'confidential' AND uploaded_by = auth.uid()) OR (confidentiality_level = 'confidential' AND user_has_document_share(auth.uid(), id))));
CREATE POLICY "Admins can insert documents" ON public.documents FOR INSERT WITH CHECK ((is_super_admin(auth.uid()) OR (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()))) AND NOT is_client_suspended(auth.uid()));
CREATE POLICY "Admins can update documents" ON public.documents FOR UPDATE USING ((is_super_admin(auth.uid()) OR (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()))) AND NOT is_client_suspended(auth.uid())) WITH CHECK ((is_super_admin(auth.uid()) OR (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()))) AND NOT is_client_suspended(auth.uid()));
CREATE POLICY "Admins can delete documents respecting module" ON public.documents FOR DELETE USING (can_delete_in_module(auth.uid()) AND (is_super_admin(auth.uid()) OR (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()))) AND NOT is_client_suspended(auth.uid()));

-- Fix shares policies
DROP POLICY IF EXISTS "Users can view shares for documents in their organization" ON public.shares;
DROP POLICY IF EXISTS "Users can create shares for documents they can access" ON public.shares;
DROP POLICY IF EXISTS "Share creators can manage their shares" ON public.shares;
DROP POLICY IF EXISTS "Share creators can delete their shares" ON public.shares;

CREATE POLICY "Users can view shares for documents in their organization" ON public.shares FOR SELECT USING (recipient_user_id = auth.uid() OR document_belongs_to_user_client(auth.uid(), document_id));
CREATE POLICY "Users can create shares for documents they can access" ON public.shares FOR INSERT WITH CHECK (created_by = auth.uid() AND document_belongs_to_user_client(auth.uid(), document_id));
CREATE POLICY "Share creators can manage their shares" ON public.shares FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "Share creators can delete their shares" ON public.shares FOR DELETE USING (created_by = auth.uid());

-- Fix notifications policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Triggers can insert notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Triggers can insert notifications" ON public.notifications FOR INSERT WITH CHECK (user_id IS NOT NULL AND client_id IS NOT NULL);

-- Fix remaining tables
DROP POLICY IF EXISTS "Users can manage their own saved searches" ON public.saved_searches;
CREATE POLICY "Users can manage their own saved searches" ON public.saved_searches FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own acknowledgments" ON public.role_acknowledgments;
DROP POLICY IF EXISTS "Admins can view acknowledgments" ON public.role_acknowledgments;
CREATE POLICY "Users can manage their own acknowledgments" ON public.role_acknowledgments FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view acknowledgments" ON public.role_acknowledgments FOR SELECT USING (is_super_admin(auth.uid()) OR (is_client_admin(auth.uid()) AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = role_acknowledgments.user_id AND p.client_id = get_user_client_id(auth.uid()))));

-- Fix other tables
DROP POLICY IF EXISTS "Users can view document tags in their organization" ON public.document_tags;
DROP POLICY IF EXISTS "Users can manage document tags they have access to" ON public.document_tags;
CREATE POLICY "Users can view document tags in their organization" ON public.document_tags FOR SELECT USING (document_id IN (SELECT id FROM documents WHERE client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "Users can manage document tags they have access to" ON public.document_tags FOR ALL USING (document_id IN (SELECT id FROM documents WHERE client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid())));

DROP POLICY IF EXISTS "Users can view tags in their organization" ON public.tags;
DROP POLICY IF EXISTS "Admins can manage tags" ON public.tags;
CREATE POLICY "Users can view tags in their organization" ON public.tags FOR SELECT USING (client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage tags" ON public.tags FOR ALL USING (client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid()) AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'client_admin')));

DROP POLICY IF EXISTS "Users can view folders in their organization" ON public.folders;
DROP POLICY IF EXISTS "Admins can manage folders" ON public.folders;
CREATE POLICY "Users can view folders in their organization" ON public.folders FOR SELECT USING (client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage folders" ON public.folders FOR ALL USING (client_id IN (SELECT client_id FROM profiles WHERE id = auth.uid()) AND (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'client_admin')) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'active')));

-- Fix audit logs
DROP POLICY IF EXISTS "Super admins can view audit logs" ON public.super_admin_audit_logs;
DROP POLICY IF EXISTS "Super admins can insert audit logs" ON public.super_admin_audit_logs;
DROP POLICY IF EXISTS "Ultra admins can view all super admin audit logs" ON public.super_admin_audit_logs;
CREATE POLICY "Super admins can view audit logs" ON public.super_admin_audit_logs FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins can insert audit logs" ON public.super_admin_audit_logs FOR INSERT WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Ultra admins can view all super admin audit logs" ON public.super_admin_audit_logs FOR SELECT USING (is_ultra_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can view all admin audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Super admins can insert admin audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Ultra admins can view all admin audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Client admins can view org admin audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Client admins can insert org admin audit logs" ON public.admin_audit_logs;
CREATE POLICY "Super admins can view all admin audit logs" ON public.admin_audit_logs FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admins can insert admin audit logs" ON public.admin_audit_logs FOR INSERT WITH CHECK (is_super_admin(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Ultra admins can view all admin audit logs" ON public.admin_audit_logs FOR SELECT USING (is_ultra_admin(auth.uid()));
CREATE POLICY "Client admins can view org admin audit logs" ON public.admin_audit_logs FOR SELECT USING (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));
CREATE POLICY "Client admins can insert org admin audit logs" ON public.admin_audit_logs FOR INSERT WITH CHECK (is_client_admin(auth.uid()) AND user_id = auth.uid() AND client_id = get_user_client_id(auth.uid()));

-- Fix document_departments
DROP POLICY IF EXISTS "Users can view document departments in their org" ON public.document_departments;
DROP POLICY IF EXISTS "Admins can manage document departments" ON public.document_departments;
CREATE POLICY "Users can view document departments in their org" ON public.document_departments FOR SELECT USING (EXISTS (SELECT 1 FROM documents d WHERE d.id = document_departments.document_id AND d.client_id = get_user_client_id(auth.uid())));
CREATE POLICY "Admins can manage document departments" ON public.document_departments FOR ALL USING (EXISTS (SELECT 1 FROM documents d WHERE d.id = document_departments.document_id AND (is_super_admin(auth.uid()) OR (is_client_admin(auth.uid()) AND d.client_id = get_user_client_id(auth.uid()))))) WITH CHECK (EXISTS (SELECT 1 FROM documents d WHERE d.id = document_departments.document_id AND (is_super_admin(auth.uid()) OR (is_client_admin(auth.uid()) AND d.client_id = get_user_client_id(auth.uid())))));

-- Fix document_versions
DROP POLICY IF EXISTS "Admins can view document versions" ON public.document_versions;
DROP POLICY IF EXISTS "Admins can insert document versions" ON public.document_versions;
CREATE POLICY "Admins can view document versions" ON public.document_versions FOR SELECT USING (EXISTS (SELECT 1 FROM documents d WHERE d.id = document_versions.document_id AND (is_super_admin(auth.uid()) OR (is_client_admin(auth.uid()) AND d.client_id = get_user_client_id(auth.uid())))));
CREATE POLICY "Admins can insert document versions" ON public.document_versions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM documents d WHERE d.id = document_versions.document_id AND (is_super_admin(auth.uid()) OR (is_client_admin(auth.uid()) AND d.client_id = get_user_client_id(auth.uid())))));

-- Fix document_immutable_log
DROP POLICY IF EXISTS "Super admins can view all immutable logs" ON public.document_immutable_log;
DROP POLICY IF EXISTS "Client admins can view their org immutable logs" ON public.document_immutable_log;
DROP POLICY IF EXISTS "Admins can insert immutable logs" ON public.document_immutable_log;
CREATE POLICY "Super admins can view all immutable logs" ON public.document_immutable_log FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Client admins can view their org immutable logs" ON public.document_immutable_log FOR SELECT USING (is_client_admin(auth.uid()) AND EXISTS (SELECT 1 FROM documents d WHERE d.id = document_immutable_log.document_id AND d.client_id = get_user_client_id(auth.uid())));
CREATE POLICY "Admins can insert immutable logs" ON public.document_immutable_log FOR INSERT WITH CHECK (is_super_admin(auth.uid()) OR is_client_admin(auth.uid()));

-- Fix document_relations
DROP POLICY IF EXISTS "Users can view document relations for their client documents" ON public.document_relations;
CREATE POLICY "Users can view document relations for their client documents" ON public.document_relations FOR SELECT USING (EXISTS (SELECT 1 FROM documents d WHERE d.id = document_relations.source_document_id AND d.client_id = (SELECT client_id FROM profiles WHERE id = auth.uid())));

-- Fix user_departments
DROP POLICY IF EXISTS "Users can view their own department assignments" ON public.user_departments;
DROP POLICY IF EXISTS "Super admins can manage all user departments" ON public.user_departments;
DROP POLICY IF EXISTS "Client admins can manage user departments in their org" ON public.user_departments;
CREATE POLICY "Users can view their own department assignments" ON public.user_departments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Super admins can manage all user departments" ON public.user_departments FOR ALL USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Client admins can manage user departments in their org" ON public.user_departments FOR ALL USING (is_client_admin(auth.uid()) AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_departments.user_id AND p.client_id = get_user_client_id(auth.uid()))) WITH CHECK (is_client_admin(auth.uid()) AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_departments.user_id AND p.client_id = get_user_client_id(auth.uid())));
