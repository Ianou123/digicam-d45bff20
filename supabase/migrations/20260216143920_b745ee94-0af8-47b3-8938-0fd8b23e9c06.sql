
CREATE OR REPLACE FUNCTION public.can_user_upload(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    CASE 
      -- Ultra admins can always upload
      WHEN is_ultra_admin(_user_id) THEN true
      -- Super admins can upload EXCEPT in fiscal module
      WHEN is_super_admin(_user_id) THEN (COALESCE(get_user_module(_user_id) != 'fiscal', true))
      -- Client admins (Admin IT) can always upload
      WHEN is_client_admin(_user_id) THEN true
      -- In restricted modules (admin_publique, fiscal), staff cannot upload
      WHEN is_restricted_module(_user_id) THEN false
      -- Otherwise allow
      ELSE true
    END
$function$;
