-- Fix 1: Make documents storage bucket private
UPDATE storage.buckets SET public = false WHERE id = 'documents';

-- Fix 2: Drop overly permissive policy and create confidentiality-aware policy
DROP POLICY IF EXISTS "Users can see documents in their org" ON documents;

CREATE POLICY "Users can see documents based on confidentiality"
ON documents FOR SELECT
USING (
  client_id = get_user_client_id(auth.uid())
  AND (
    -- Super admins see everything in their org
    is_super_admin(auth.uid())
    -- Client admins see everything in their org
    OR is_client_admin(auth.uid())
    -- Staff see only public and internal documents (not confidential)
    OR (confidentiality_level IN ('public', 'internal'))
    -- Staff can see confidential docs they uploaded
    OR (confidentiality_level = 'confidential' AND uploaded_by = auth.uid())
    -- Staff can see confidential docs shared with them
    OR (confidentiality_level = 'confidential' AND EXISTS (
      SELECT 1 FROM shares 
      WHERE shares.document_id = documents.id 
      AND shares.recipient_user_id = auth.uid()
      AND (shares.expires_at IS NULL OR shares.expires_at > now())
    ))
  )
);

-- Fix 3: Add storage policies for authenticated access only
-- Drop existing public policy if exists
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;

-- Create policy for authenticated users to view documents in their org
CREATE POLICY "Authenticated users can view documents in their org"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (
    -- Check if user belongs to the client that owns the document
    -- The path format is: client_id/timestamp_filename
    SPLIT_PART(name, '/', 1) = get_user_client_id(auth.uid())::text
  )
);

-- Create policy for document uploaders
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload to their org bucket"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND SPLIT_PART(name, '/', 1) = get_user_client_id(auth.uid())::text
);

-- Create policy for admins to delete documents
DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;
CREATE POLICY "Admins can delete documents in their org bucket"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND SPLIT_PART(name, '/', 1) = get_user_client_id(auth.uid())::text
  AND (is_super_admin(auth.uid()) OR is_client_admin(auth.uid()))
);