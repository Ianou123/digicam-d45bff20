-- Create function to escape ILIKE special characters
CREATE OR REPLACE FUNCTION public.escape_ilike_pattern(pattern TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Escape special ILIKE characters: \, %, _
  RETURN replace(replace(replace(COALESCE(pattern, ''), '\', '\\'), '%', '\%'), '_', '\_');
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Replace the trigger function with a safer version using escaped patterns
CREATE OR REPLACE FUNCTION public.check_watched_search_matches()
RETURNS TRIGGER AS $$
DECLARE
  watched_search RECORD;
  search_filters JSONB;
  doc_matches BOOLEAN;
  safe_query TEXT;
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
    
    -- Check if document title matches search query (with escaped pattern)
    IF search_filters->>'query' IS NOT NULL AND search_filters->>'query' != '' THEN
      -- Escape special characters to prevent pattern injection
      safe_query := public.escape_ilike_pattern(search_filters->>'query');
      
      IF NOT (NEW.title ILIKE '%' || safe_query || '%') THEN
        -- Also check OCR text if available
        IF NEW.ocr_text IS NULL OR NOT (NEW.ocr_text ILIKE '%' || safe_query || '%') THEN
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
        'Un nouveau document "' || public.escape_ilike_pattern(NEW.title) || '" correspond à votre recherche "' || public.escape_ilike_pattern(watched_search.name) || '"',
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