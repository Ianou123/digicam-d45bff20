-- Create search_logs table for V2 analytics preparation (write-only for now)
CREATE TABLE public.search_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL,
  query_text TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  clicked_document_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own search logs (write-only)
CREATE POLICY "Users can insert own search logs" 
ON public.search_logs 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Super admins can view all search logs (for future analytics)
CREATE POLICY "Super admins can view all search logs" 
ON public.search_logs 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- Client admins can view search logs in their org (for future analytics)
CREATE POLICY "Client admins can view org search logs" 
ON public.search_logs 
FOR SELECT 
USING (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()));

-- Create index for performance
CREATE INDEX idx_search_logs_user_id ON public.search_logs(user_id);
CREATE INDEX idx_search_logs_client_id ON public.search_logs(client_id);
CREATE INDEX idx_search_logs_created_at ON public.search_logs(created_at DESC);