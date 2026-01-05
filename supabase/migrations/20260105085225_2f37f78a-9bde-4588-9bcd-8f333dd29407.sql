-- Add status column to clients table
ALTER TABLE public.clients 
ADD COLUMN status text NOT NULL DEFAULT 'active';

-- Add constraint for valid status values
ALTER TABLE public.clients 
ADD CONSTRAINT clients_status_check CHECK (status IN ('active', 'inactive', 'suspended'));

-- Add last_activity_at column to clients table
ALTER TABLE public.clients 
ADD COLUMN last_activity_at timestamptz;

-- Create super_admin_audit_logs table for tracking admin actions
CREATE TABLE public.super_admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on super_admin_audit_logs
ALTER TABLE public.super_admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
CREATE POLICY "Super admins can view audit logs"
ON public.super_admin_audit_logs
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Only super admins can insert audit logs
CREATE POLICY "Super admins can insert audit logs"
ON public.super_admin_audit_logs
FOR INSERT
WITH CHECK (is_super_admin(auth.uid()));

-- Create function to update client last_activity_at when activity is logged
CREATE OR REPLACE FUNCTION public.update_client_last_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clients 
  SET last_activity_at = NEW.created_at 
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update last_activity_at
CREATE TRIGGER on_activity_log_insert
  AFTER INSERT ON public.activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_client_last_activity();

-- Create index for faster queries on status
CREATE INDEX idx_clients_status ON public.clients(status);

-- Create index for faster queries on last_activity_at
CREATE INDEX idx_clients_last_activity ON public.clients(last_activity_at);