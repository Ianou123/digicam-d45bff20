-- Allow staff to view profiles in their organization
CREATE POLICY "Staff can view profiles in their org"
ON public.profiles
FOR SELECT
USING (client_id = get_user_client_id(auth.uid()));