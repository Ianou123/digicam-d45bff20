-- Audit trail for offline pin / unpin (activity_logs.action_type)
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'pin_offline';
ALTER TYPE public.action_type ADD VALUE IF NOT EXISTS 'unpin_offline';
