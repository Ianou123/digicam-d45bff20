-- Ultra Admin needs to view super_admin_audit_logs (logs made by Super Admins)
CREATE POLICY "Ultra admins can view all super admin audit logs"
  ON public.super_admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (is_ultra_admin(auth.uid()));

-- Ultra Admin needs to view admin_audit_logs (logs made by Client Admins and Super Admins)
CREATE POLICY "Ultra admins can view all admin audit logs"
  ON public.admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (is_ultra_admin(auth.uid()));