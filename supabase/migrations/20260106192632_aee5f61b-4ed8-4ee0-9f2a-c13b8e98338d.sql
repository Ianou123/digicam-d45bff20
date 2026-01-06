-- Add archived_at column to departments
ALTER TABLE public.departments 
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for filtering active departments
CREATE INDEX idx_departments_archived_at ON public.departments(archived_at);

-- Update RLS policies for departments

-- Drop existing policies
DROP POLICY IF EXISTS "Client admins can manage departments in their org" ON public.departments;
DROP POLICY IF EXISTS "Super admins can manage all departments" ON public.departments;
DROP POLICY IF EXISTS "Users can view departments in their org" ON public.departments;

-- Super admins can only VIEW departments (not edit)
CREATE POLICY "Super admins can view all departments"
ON public.departments
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Client admins can fully manage departments in their org
CREATE POLICY "Client admins can view departments in their org"
ON public.departments
FOR SELECT
USING (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));

CREATE POLICY "Client admins can insert departments in their org"
ON public.departments
FOR INSERT
WITH CHECK (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));

CREATE POLICY "Client admins can update departments in their org"
ON public.departments
FOR UPDATE
USING (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()))
WITH CHECK (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));

-- Staff can only view departments in their org
CREATE POLICY "Staff can view departments in their org"
ON public.departments
FOR SELECT
USING (client_id = get_user_client_id(auth.uid()));