
-- Safety: update any existing fiscal clients to admin_publique
UPDATE public.clients SET module = 'admin_publique' WHERE module = 'fiscal';

-- Drop function that depends on old enum type
DROP FUNCTION IF EXISTS public.get_user_module(uuid);

-- Remove 'fiscal' from the client_module enum
ALTER TYPE public.client_module RENAME TO client_module_old;
CREATE TYPE public.client_module AS ENUM ('core', 'admin_publique');

-- Drop default, convert column, re-add default
ALTER TABLE public.clients ALTER COLUMN module DROP DEFAULT;
ALTER TABLE public.clients 
  ALTER COLUMN module TYPE public.client_module USING module::text::public.client_module;
ALTER TABLE public.clients ALTER COLUMN module SET DEFAULT 'core'::public.client_module;

ALTER TABLE public.role_acknowledgments
  ALTER COLUMN module TYPE public.client_module USING module::text::public.client_module;

DROP TYPE public.client_module_old;

-- Recreate get_user_module with new enum type
CREATE OR REPLACE FUNCTION public.get_user_module(_user_id uuid)
 RETURNS public.client_module
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT c.module 
  FROM clients c
  JOIN profiles p ON p.client_id = c.id
  WHERE p.id = _user_id
$$;

-- Update is_restricted_module
CREATE OR REPLACE FUNCTION public.is_restricted_module(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(get_user_module(_user_id) = 'admin_publique', false)
$$;

-- Simplify can_delete_in_module
CREATE OR REPLACE FUNCTION public.can_delete_in_module(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT true
$$;

-- Update can_user_upload
CREATE OR REPLACE FUNCTION public.can_user_upload(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      WHEN is_ultra_admin(_user_id) THEN false
      WHEN is_super_admin(_user_id) THEN (COALESCE(get_user_module(_user_id) != 'admin_publique', true))
      WHEN is_client_admin(_user_id) THEN true
      WHEN is_restricted_module(_user_id) THEN false
      ELSE false
    END
$$;
