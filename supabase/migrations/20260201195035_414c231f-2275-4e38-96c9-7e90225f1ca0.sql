-- Phase 1: Module-Based Architecture Database Schema

-- 1.1 Add module type enum
CREATE TYPE client_module AS ENUM ('core', 'admin_publique', 'fiscal');

-- 1.2 Add module column to clients table
ALTER TABLE clients ADD COLUMN module client_module NOT NULL DEFAULT 'core';

-- 1.3 Create user-department many-to-many junction table
CREATE TABLE user_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, department_id)
);

-- Enable RLS on user_departments
ALTER TABLE user_departments ENABLE ROW LEVEL SECURITY;

-- 1.4 Create document-department many-to-many junction table
CREATE TABLE document_departments (
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, department_id)
);

-- Enable RLS on document_departments
ALTER TABLE document_departments ENABLE ROW LEVEL SECURITY;

-- 1.5 Add context column to activity_logs for enhanced audit
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}';

-- 1.6 Create immutable document log for fiscal module (append-only)
CREATE TABLE document_immutable_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'version', 'purge_request', 'view', 'download')),
  actor_id UUID NOT NULL,
  justification TEXT,
  file_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on document_immutable_log
ALTER TABLE document_immutable_log ENABLE ROW LEVEL SECURITY;

-- 1.7 Create role acknowledgments table
CREATE TABLE role_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  module client_module NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, module)
);

-- Enable RLS on role_acknowledgments
ALTER TABLE role_acknowledgments ENABLE ROW LEVEL SECURITY;

-- 2.1 Get client module for a user
CREATE OR REPLACE FUNCTION get_user_module(_user_id UUID)
RETURNS client_module
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.module 
  FROM clients c
  JOIN profiles p ON p.client_id = c.id
  WHERE p.id = _user_id
$$;

-- 2.2 Check if user's organization uses Admin/Fiscal module
CREATE OR REPLACE FUNCTION is_restricted_module(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(get_user_module(_user_id) IN ('admin_publique', 'fiscal'), false)
$$;

-- 2.3 Check if user has access to department
CREATE OR REPLACE FUNCTION user_has_department_access(_user_id UUID, _department_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      WHEN is_restricted_module(_user_id) THEN
        EXISTS (
          SELECT 1 FROM user_departments 
          WHERE user_id = _user_id AND department_id = _department_id
        )
      ELSE
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE id = _user_id AND department_id = _department_id
        )
    END
$$;

-- 2.4 Check if user can upload (staff cannot upload in restricted modules)
CREATE OR REPLACE FUNCTION can_user_upload(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      WHEN is_super_admin(_user_id) THEN true
      WHEN is_client_admin(_user_id) THEN true
      WHEN is_restricted_module(_user_id) THEN false
      ELSE true
    END
$$;

-- 2.5 Check if deletion is allowed (blocked in fiscal module)
CREATE OR REPLACE FUNCTION can_delete_in_module(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(get_user_module(_user_id) != 'fiscal', true)
$$;

-- RLS Policies for user_departments
CREATE POLICY "Super admins can manage all user departments"
  ON user_departments FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Client admins can manage user departments in their org"
  ON user_departments FOR ALL
  USING (
    is_client_admin(auth.uid()) 
    AND EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = user_departments.user_id 
      AND p.client_id = get_user_client_id(auth.uid())
    )
  )
  WITH CHECK (
    is_client_admin(auth.uid()) 
    AND EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = user_departments.user_id 
      AND p.client_id = get_user_client_id(auth.uid())
    )
  );

CREATE POLICY "Users can view their own department assignments"
  ON user_departments FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policies for document_departments
CREATE POLICY "Admins can manage document departments"
  ON document_departments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_departments.document_id
      AND (
        is_super_admin(auth.uid())
        OR (is_client_admin(auth.uid()) AND d.client_id = get_user_client_id(auth.uid()))
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_departments.document_id
      AND (
        is_super_admin(auth.uid())
        OR (is_client_admin(auth.uid()) AND d.client_id = get_user_client_id(auth.uid()))
      )
    )
  );

CREATE POLICY "Users can view document departments in their org"
  ON document_departments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_departments.document_id
      AND d.client_id = get_user_client_id(auth.uid())
    )
  );

-- RLS Policies for document_immutable_log (append-only)
CREATE POLICY "Admins can insert immutable logs"
  ON document_immutable_log FOR INSERT
  WITH CHECK (
    is_super_admin(auth.uid()) OR is_client_admin(auth.uid())
  );

CREATE POLICY "Super admins can view all immutable logs"
  ON document_immutable_log FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Client admins can view their org immutable logs"
  ON document_immutable_log FOR SELECT
  USING (
    is_client_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_immutable_log.document_id
      AND d.client_id = get_user_client_id(auth.uid())
    )
  );

-- RLS Policies for role_acknowledgments
CREATE POLICY "Users can manage their own acknowledgments"
  ON role_acknowledgments FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view acknowledgments"
  ON role_acknowledgments FOR SELECT
  USING (
    is_super_admin(auth.uid())
    OR (
      is_client_admin(auth.uid())
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = role_acknowledgments.user_id
        AND p.client_id = get_user_client_id(auth.uid())
      )
    )
  );

-- Update documents deletion policy to respect fiscal module
DROP POLICY IF EXISTS "Admins can delete documents" ON documents;

CREATE POLICY "Admins can delete documents respecting module"
  ON documents FOR DELETE
  USING (
    can_delete_in_module(auth.uid())
    AND (
      is_super_admin(auth.uid()) 
      OR (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()))
    )
    AND NOT is_client_suspended(auth.uid())
  );

-- Add indexes for performance
CREATE INDEX idx_user_departments_user_id ON user_departments(user_id);
CREATE INDEX idx_user_departments_department_id ON user_departments(department_id);
CREATE INDEX idx_document_departments_document_id ON document_departments(document_id);
CREATE INDEX idx_document_departments_department_id ON document_departments(department_id);
CREATE INDEX idx_document_immutable_log_document_id ON document_immutable_log(document_id);
CREATE INDEX idx_role_acknowledgments_user_id ON role_acknowledgments(user_id);
CREATE INDEX idx_clients_module ON clients(module);