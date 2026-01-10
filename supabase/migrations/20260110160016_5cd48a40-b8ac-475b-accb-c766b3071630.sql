-- Create a document_relations table for tracking related documents
CREATE TABLE IF NOT EXISTS public.document_relations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  related_document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'co_viewed',
  strength INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(source_document_id, related_document_id, relation_type)
);

-- Enable RLS on document_relations
ALTER TABLE public.document_relations ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing document relations (within same client)
CREATE POLICY "Users can view document relations for their client documents"
ON public.document_relations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = source_document_id
    AND d.client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- Create notifications table for watched search matches
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'watched_search_match',
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (user_id = auth.uid());

-- System can insert notifications (via trigger)
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Add department_id to profiles table for department assignment
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- Create function to check if document matches watched search
CREATE OR REPLACE FUNCTION public.check_watched_search_matches()
RETURNS TRIGGER AS $$
DECLARE
  watched_search RECORD;
  search_filters JSONB;
  doc_matches BOOLEAN;
BEGIN
  -- Loop through all saved searches for the client
  FOR watched_search IN
    SELECT ss.id, ss.user_id, ss.name, ss.filters, ss.client_id
    FROM public.saved_searches ss
    WHERE ss.client_id = NEW.client_id
      AND ss.is_pinned = true
  LOOP
    search_filters := watched_search.filters;
    doc_matches := true;
    
    -- Check if document title matches search query
    IF search_filters->>'query' IS NOT NULL AND search_filters->>'query' != '' THEN
      IF NOT (NEW.title ILIKE '%' || (search_filters->>'query') || '%') THEN
        -- Also check OCR text if available
        IF NEW.ocr_text IS NULL OR NOT (NEW.ocr_text ILIKE '%' || (search_filters->>'query') || '%') THEN
          doc_matches := false;
        END IF;
      END IF;
    END IF;
    
    -- Check document type filter
    IF doc_matches AND search_filters->>'type' IS NOT NULL AND search_filters->>'type' != '' THEN
      IF NEW.document_type != search_filters->>'type' THEN
        doc_matches := false;
      END IF;
    END IF;
    
    -- Check department filter
    IF doc_matches AND search_filters->>'department' IS NOT NULL AND search_filters->>'department' != '' THEN
      IF NEW.department_id IS NULL OR NEW.department_id::text != search_filters->>'department' THEN
        doc_matches := false;
      END IF;
    END IF;
    
    -- Check confidentiality filter
    IF doc_matches AND search_filters->>'confidentiality' IS NOT NULL AND search_filters->>'confidentiality' != '' THEN
      IF NEW.confidentiality_level != search_filters->>'confidentiality' THEN
        doc_matches := false;
      END IF;
    END IF;
    
    -- If document matches, create a notification
    IF doc_matches THEN
      INSERT INTO public.notifications (user_id, client_id, type, title, message, metadata)
      VALUES (
        watched_search.user_id,
        watched_search.client_id,
        'watched_search_match',
        'Nouveau document correspondant',
        'Un nouveau document "' || NEW.title || '" correspond à votre recherche "' || watched_search.name || '"',
        jsonb_build_object(
          'document_id', NEW.id,
          'document_title', NEW.title,
          'saved_search_id', watched_search.id,
          'saved_search_name', watched_search.name
        )
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to check watched searches on new document upload
DROP TRIGGER IF EXISTS check_watched_searches_on_insert ON public.documents;
CREATE TRIGGER check_watched_searches_on_insert
  AFTER INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.check_watched_search_matches();

-- Create function to update document relations based on co-viewing
CREATE OR REPLACE FUNCTION public.update_document_relations()
RETURNS TRIGGER AS $$
DECLARE
  recent_doc_id UUID;
  recent_views RECORD;
BEGIN
  -- Only process view actions
  IF NEW.action_type != 'view' OR NEW.document_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Find other documents viewed by the same user in the last hour
  FOR recent_views IN
    SELECT DISTINCT document_id
    FROM public.activity_logs
    WHERE user_id = NEW.user_id
      AND action_type = 'view'
      AND document_id IS NOT NULL
      AND document_id != NEW.document_id
      AND created_at > NOW() - INTERVAL '1 hour'
    LIMIT 5
  LOOP
    -- Insert or update relation from current document to recent document
    INSERT INTO public.document_relations (source_document_id, related_document_id, relation_type, strength)
    VALUES (NEW.document_id, recent_views.document_id, 'co_viewed', 1)
    ON CONFLICT (source_document_id, related_document_id, relation_type)
    DO UPDATE SET strength = document_relations.strength + 1, updated_at = NOW();
    
    -- Also create reverse relation
    INSERT INTO public.document_relations (source_document_id, related_document_id, relation_type, strength)
    VALUES (recent_views.document_id, NEW.document_id, 'co_viewed', 1)
    ON CONFLICT (source_document_id, related_document_id, relation_type)
    DO UPDATE SET strength = document_relations.strength + 1, updated_at = NOW();
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to update document relations on view
DROP TRIGGER IF EXISTS update_relations_on_view ON public.activity_logs;
CREATE TRIGGER update_relations_on_view
  AFTER INSERT ON public.activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_document_relations();