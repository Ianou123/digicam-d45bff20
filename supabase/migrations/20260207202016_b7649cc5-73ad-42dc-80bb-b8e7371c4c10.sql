-- 1. Add ultra_admin to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ultra_admin';

-- 2. Add is_watched and last_matched_at columns to saved_searches
ALTER TABLE public.saved_searches ADD COLUMN IF NOT EXISTS is_watched BOOLEAN DEFAULT false;
ALTER TABLE public.saved_searches ADD COLUMN IF NOT EXISTS last_matched_at TIMESTAMPTZ;

-- 3. Create index for watched searches
CREATE INDEX IF NOT EXISTS idx_saved_searches_is_watched ON public.saved_searches(is_watched) WHERE is_watched = true;