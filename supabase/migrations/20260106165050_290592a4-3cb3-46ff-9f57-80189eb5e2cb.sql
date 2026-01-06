-- Add deleted_at column for soft delete
ALTER TABLE public.documents 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for efficient filtering
CREATE INDEX idx_documents_deleted_at ON public.documents(deleted_at);