-- Deny DigiCam staff (ultra_admin) access to client documents
-- Ultra admins can manage platform/orgs, but must never read documents or storage objects.

-- 1) Remove overly permissive documents policy
DROP POLICY IF EXISTS "Ultra admins can see all documents" ON public.documents;

-- 2) Harden storage bucket access: prevent ultra admins from reading/uploading/deleting objects
DROP POLICY IF EXISTS "Authenticated users can view documents in their org" ON storage.objects;
CREATE POLICY "Authenticated users can view documents in their org"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND NOT is_ultra_admin(auth.uid())
  AND SPLIT_PART(name, '/', 1) = get_user_client_id(auth.uid())::text
);

DROP POLICY IF EXISTS "Authenticated users can upload to their org bucket" ON storage.objects;
CREATE POLICY "Authenticated users can upload to their org bucket"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND NOT is_ultra_admin(auth.uid())
  AND SPLIT_PART(name, '/', 1) = get_user_client_id(auth.uid())::text
);

DROP POLICY IF EXISTS "Admins can delete documents in their org bucket" ON storage.objects;
CREATE POLICY "Admins can delete documents in their org bucket"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND NOT is_ultra_admin(auth.uid())
  AND SPLIT_PART(name, '/', 1) = get_user_client_id(auth.uid())::text
  AND (is_super_admin(auth.uid()) OR is_client_admin(auth.uid()))
);

