-- Security Hardening: Field-level encryption for ocr_text
-- Validated 2026-03-22

-- Enable pgcrypto for symmetric encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encrypted column alongside the existing plaintext column (backward compat)
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS ocr_text_encrypted BYTEA;

-- Comment explaining the encryption approach
COMMENT ON COLUMN public.documents.ocr_text_encrypted IS
  'pgp_sym_encrypt(ocr_text, app.ocr_key) — set app.ocr_key per deployment via: ALTER DATABASE <db> SET app.ocr_key = ''<key>'';';

COMMENT ON COLUMN public.documents.ocr_text IS
  'Plaintext OCR content — kept for backward compatibility. '
  'Future migration will null this out once all deployments support key management.';

-- Trigger function: encrypt ocr_text -> ocr_text_encrypted on insert/update
CREATE OR REPLACE FUNCTION public.encrypt_ocr_text()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key TEXT;
BEGIN
  -- Read the per-deployment encryption key (set via ALTER DATABASE SET app.ocr_key)
  BEGIN
    _key := current_setting('app.ocr_key');
  EXCEPTION WHEN OTHERS THEN
    _key := NULL;
  END;

  -- Only encrypt if key is configured AND ocr_text is non-null
  IF _key IS NOT NULL AND _key <> '' AND NEW.ocr_text IS NOT NULL THEN
    NEW.ocr_text_encrypted := pgp_sym_encrypt(NEW.ocr_text, _key);
  ELSE
    -- No key configured: leave encrypted column as-is (null or previous value)
    NEW.ocr_text_encrypted := OLD.ocr_text_encrypted;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to documents table
DROP TRIGGER IF EXISTS trg_encrypt_ocr_text ON public.documents;
CREATE TRIGGER trg_encrypt_ocr_text
  BEFORE INSERT OR UPDATE OF ocr_text
  ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_ocr_text();
