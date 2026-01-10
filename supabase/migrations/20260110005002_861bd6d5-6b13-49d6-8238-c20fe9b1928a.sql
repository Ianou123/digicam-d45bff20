-- DigiCam V2: Complete Document Management System
-- Add folders, tags, shares, and document status for workflow management

-- Create folders table (hierarchical structure)
CREATE TABLE public.folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT folders_unique_name_per_parent UNIQUE (client_id, parent_id, name)
);

-- Enable RLS on folders
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- RLS policies for folders
CREATE POLICY "Users can view folders in their organization"
ON public.folders FOR SELECT
USING (client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage folders"
ON public.folders FOR ALL
USING (
  client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  AND (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'client_admin'))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active')
  )
);

-- Create tags table with colors
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT tags_unique_name_per_client UNIQUE (client_id, name)
);

-- Enable RLS on tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for tags
CREATE POLICY "Users can view tags in their organization"
ON public.tags FOR SELECT
USING (client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage tags"
ON public.tags FOR ALL
USING (
  client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'client_admin'))
);

-- Create document_tags junction table
CREATE TABLE public.document_tags (
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, tag_id)
);

-- Enable RLS on document_tags
ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_tags
CREATE POLICY "Users can view document tags in their organization"
ON public.document_tags FOR SELECT
USING (
  document_id IN (
    SELECT id FROM public.documents 
    WHERE client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Users can manage document tags they have access to"
ON public.document_tags FOR ALL
USING (
  document_id IN (
    SELECT id FROM public.documents 
    WHERE client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- Create shares table for document sharing
CREATE TABLE public.shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  share_type TEXT NOT NULL CHECK (share_type IN ('internal', 'link')),
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  link_token TEXT UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  can_download BOOLEAN DEFAULT false,
  password_hash TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on shares
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

-- RLS policies for shares
CREATE POLICY "Users can view shares for documents in their organization"
ON public.shares FOR SELECT
USING (
  document_id IN (
    SELECT id FROM public.documents 
    WHERE client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  )
  OR recipient_user_id = auth.uid()
);

CREATE POLICY "Users can create shares for documents they can access"
ON public.shares FOR INSERT
WITH CHECK (
  document_id IN (
    SELECT id FROM public.documents 
    WHERE client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Share creators can manage their shares"
ON public.shares FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "Share creators can delete their shares"
ON public.shares FOR DELETE
USING (created_by = auth.uid());

-- Add status and folder_id columns to documents table
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ready' CHECK (status IN ('processing', 'ready', 'pending_validation', 'archived')),
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS document_date DATE;

-- Create index for faster folder queries
CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON public.documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_folders_client_id ON public.folders(client_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_tags_client_id ON public.tags(client_id);
CREATE INDEX IF NOT EXISTS idx_shares_document_id ON public.shares(document_id);
CREATE INDEX IF NOT EXISTS idx_shares_link_token ON public.shares(link_token);

-- Create saved_searches table for pinned searches
CREATE TABLE public.saved_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on saved_searches
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- RLS policies for saved_searches
CREATE POLICY "Users can manage their own saved searches"
ON public.saved_searches FOR ALL
USING (user_id = auth.uid());

-- Create index for saved searches
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches(user_id);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;