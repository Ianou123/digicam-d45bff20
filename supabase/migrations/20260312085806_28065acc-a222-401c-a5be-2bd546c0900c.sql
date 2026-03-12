
-- Set modules for the 3 new organizations
UPDATE public.clients SET module = 'admin_publique', module_configured = true WHERE id = 'dd2de8c5-c49f-41c0-a73b-7ece78469aad'; -- Cabinet Kouassi
UPDATE public.clients SET module = 'admin_publique', module_configured = true WHERE id = '9d88117f-88a6-4375-b342-75efaa2e8c9f'; -- TransAfrik
UPDATE public.clients SET module = 'core', module_configured = true WHERE id = '0be5f511-a470-43cf-bb24-2a8f96d2ee89'; -- Studio Créatif

-- Create departments for Cabinet Kouassi
INSERT INTO public.departments (client_id, name) VALUES
  ('dd2de8c5-c49f-41c0-a73b-7ece78469aad', 'Droit des Affaires'),
  ('dd2de8c5-c49f-41c0-a73b-7ece78469aad', 'Droit Immobilier'),
  ('dd2de8c5-c49f-41c0-a73b-7ece78469aad', 'Contentieux');

-- Create departments for TransAfrik
INSERT INTO public.departments (client_id, name) VALUES
  ('9d88117f-88a6-4375-b342-75efaa2e8c9f', 'Opérations'),
  ('9d88117f-88a6-4375-b342-75efaa2e8c9f', 'Comptabilité'),
  ('9d88117f-88a6-4375-b342-75efaa2e8c9f', 'Ressources Humaines');

-- Create departments for Studio Créatif
INSERT INTO public.departments (client_id, name) VALUES
  ('0be5f511-a470-43cf-bb24-2a8f96d2ee89', 'Design'),
  ('0be5f511-a470-43cf-bb24-2a8f96d2ee89', 'Administration');
