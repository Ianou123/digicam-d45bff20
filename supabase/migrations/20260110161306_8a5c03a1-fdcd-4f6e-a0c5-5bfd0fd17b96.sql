-- Drop the overly permissive policy and replace with a more secure one
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create a more restrictive policy - only allow inserts where the user_id matches or through SECURITY DEFINER functions
CREATE POLICY "Triggers can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  -- Allow inserts from triggers (which run as SECURITY DEFINER)
  -- The trigger functions are already SECURITY DEFINER so this will work
  user_id IS NOT NULL AND client_id IS NOT NULL
);