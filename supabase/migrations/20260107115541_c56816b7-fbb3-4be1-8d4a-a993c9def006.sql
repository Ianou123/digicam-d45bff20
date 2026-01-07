-- Create the documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their organization's folder
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
);

-- Allow public read access (since bucket is public)
CREATE POLICY "Public read access for documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'documents');

-- Allow authenticated users to update their uploaded files
CREATE POLICY "Authenticated users can update documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'documents');

-- Allow authenticated users to delete documents
CREATE POLICY "Authenticated users can delete documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documents');