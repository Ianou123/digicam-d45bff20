-- Add data sovereignty and hosting fields to clients
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS hosting_model TEXT DEFAULT 'cloud',
ADD COLUMN IF NOT EXISTS data_location TEXT DEFAULT 'eu-west';

-- Add comment for documentation
COMMENT ON COLUMN public.clients.hosting_model IS 'The hosting model for this client: cloud, local_dc, or on_premise';
COMMENT ON COLUMN public.clients.data_location IS 'The primary geographic location of the client data (e.g. eu-west, us-east)';
