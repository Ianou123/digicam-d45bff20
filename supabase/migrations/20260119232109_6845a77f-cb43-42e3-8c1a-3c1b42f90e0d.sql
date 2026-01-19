-- Create helper function to check if a user has a valid share for a document
CREATE OR REPLACE FUNCTION public.user_has_document_share(_user_id uuid, _document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shares
    WHERE document_id = _document_id
      AND recipient_user_id = _user_id
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Create helper function to check if a document belongs to a user's client
CREATE OR REPLACE FUNCTION public.document_belongs_to_user_client(_user_id uuid, _document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = _document_id
      AND d.client_id = (SELECT client_id FROM public.profiles WHERE id = _user_id)
  )
$$;

-- Drop the problematic documents policy
DROP POLICY IF EXISTS "Users can see documents based on confidentiality" ON public.documents;

-- Create new documents policy using helper function
CREATE POLICY "Users can see documents based on confidentiality"
  ON public.documents FOR SELECT
  TO authenticated
  USING (
    client_id = get_user_client_id(auth.uid())
    AND (
      is_super_admin(auth.uid())
      OR is_client_admin(auth.uid())
      OR confidentiality_level IN ('public', 'internal')
      OR (confidentiality_level = 'confidential' AND uploaded_by = auth.uid())
      OR (confidentiality_level = 'confidential' AND user_has_document_share(auth.uid(), id))
    )
  );

-- Drop the problematic shares policies
DROP POLICY IF EXISTS "Users can view shares for documents in their organization" ON public.shares;
DROP POLICY IF EXISTS "Users can create shares for documents they can access" ON public.shares;

-- Create new shares SELECT policy using helper function
CREATE POLICY "Users can view shares for documents in their organization"
  ON public.shares FOR SELECT
  TO authenticated
  USING (
    recipient_user_id = auth.uid()
    OR document_belongs_to_user_client(auth.uid(), document_id)
  );

-- Create new shares INSERT policy using helper function
CREATE POLICY "Users can create shares for documents they can access"
  ON public.shares FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND document_belongs_to_user_client(auth.uid(), document_id)
  );