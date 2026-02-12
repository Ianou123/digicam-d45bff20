
ALTER TABLE public.clients ADD COLUMN module_configured BOOLEAN NOT NULL DEFAULT false;

-- Mark existing clients as already configured
UPDATE public.clients SET module_configured = true;
