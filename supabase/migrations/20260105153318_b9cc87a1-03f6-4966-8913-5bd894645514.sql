-- Create admin_audit_logs table for tracking admin actions (deactivation, reactivation, suspension)
CREATE TABLE public.admin_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NULL,
  target_name TEXT NULL,
  client_id UUID NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can view all audit logs
CREATE POLICY "Super admins can view all admin audit logs"
ON public.admin_audit_logs
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Client admins can view audit logs for their organization
CREATE POLICY "Client admins can view org admin audit logs"
ON public.admin_audit_logs
FOR SELECT
USING (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));

-- Super admins can insert audit logs
CREATE POLICY "Super admins can insert admin audit logs"
ON public.admin_audit_logs
FOR INSERT
WITH CHECK (is_super_admin(auth.uid()) AND user_id = auth.uid());

-- Client admins can insert audit logs for their organization
CREATE POLICY "Client admins can insert org admin audit logs"
ON public.admin_audit_logs
FOR INSERT
WITH CHECK (is_client_admin(auth.uid()) AND user_id = auth.uid() AND client_id = get_user_client_id(auth.uid()));

-- Add comment describing the table
COMMENT ON TABLE public.admin_audit_logs IS 'Tracks admin actions like user deactivation, reactivation, and organization suspension';