-- Security audit: staff cannot SELECT confidential documents; invite expiry + single use;
-- null plaintext ocr_text when encrypted copy exists; invite validation RPC.

-- ---------------------------------------------------------------------------
-- 1) Documents: staff (non-admin org members) cannot read confidential rows
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can see documents based on confidentiality" ON public.documents;

CREATE POLICY "Users can see documents based on confidentiality"
ON public.documents
FOR SELECT
USING (
  client_id = get_user_client_id(auth.uid())
  AND (
    is_super_admin(auth.uid())
    OR is_client_admin(auth.uid())
    OR confidentiality_level IN ('public', 'internal')
  )
);

-- ---------------------------------------------------------------------------
-- 2) Invite codes: expiry (7 days) + single-use timestamp on clients
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS invite_code_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invite_code_used_at TIMESTAMPTZ;

COMMENT ON COLUMN public.clients.invite_code_expires_at IS 'When the current invite_code stops accepting new signups (default 7 days after generation).';
COMMENT ON COLUMN public.clients.invite_code_used_at IS 'When the invite_code was consumed by a successful signup (single-use).';

UPDATE public.clients
SET invite_code_expires_at = now() + interval '7 days'
WHERE invite_code IS NOT NULL
  AND invite_code_expires_at IS NULL;

CREATE OR REPLACE FUNCTION public.get_client_by_invite_code(_code TEXT)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.clients c
  WHERE c.invite_code IS NOT NULL
    AND upper(btrim(c.invite_code)) = upper(btrim(_code))
    AND c.invite_code_used_at IS NULL
    AND (c.invite_code_expires_at IS NULL OR c.invite_code_expires_at > now())
$$;

CREATE OR REPLACE FUNCTION public.validate_invite_for_signup(_code TEXT)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid uuid;
  exp timestamptz;
  used_at timestamptz;
BEGIN
  IF _code IS NULL OR btrim(_code) = '' THEN
    RETURN NULL;
  END IF;

  SELECT c.id, c.invite_code_expires_at, c.invite_code_used_at
  INTO cid, exp, used_at
  FROM public.clients c
  WHERE c.invite_code IS NOT NULL
    AND upper(btrim(c.invite_code)) = upper(btrim(_code));

  IF cid IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  IF used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite code already used';
  END IF;

  IF exp IS NOT NULL AND exp < now() THEN
    RAISE EXCEPTION 'Invite code expired';
  END IF;

  RETURN cid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_invite_for_signup(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_invite_for_signup(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite_code TEXT;
  _client_id UUID;
  _is_first_user BOOLEAN;
  _invite_exp TIMESTAMPTZ;
  _invite_used TIMESTAMPTZ;
BEGIN
  _invite_code := NEW.raw_user_meta_data ->> 'invite_code';
  _client_id := NULL;

  IF _invite_code IS NOT NULL AND btrim(_invite_code) <> '' THEN
    SELECT c.id, c.invite_code_expires_at, c.invite_code_used_at
    INTO _client_id, _invite_exp, _invite_used
    FROM public.clients c
    WHERE c.invite_code IS NOT NULL
      AND upper(btrim(c.invite_code)) = upper(btrim(_invite_code));

    IF _client_id IS NULL THEN
      RAISE EXCEPTION 'Invalid invite code';
    END IF;

    IF _invite_used IS NOT NULL THEN
      RAISE EXCEPTION 'Invite code already used';
    END IF;

    IF _invite_exp IS NOT NULL AND _invite_exp < now() THEN
      RAISE EXCEPTION 'Invite code expired';
    END IF;
  END IF;

  IF _client_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.client_id = _client_id
        AND p.id <> NEW.id
    ) INTO _is_first_user;
  ELSE
    _is_first_user := FALSE;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, client_id, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    _client_id,
    'active'
  );

  IF _client_id IS NOT NULL THEN
    IF _is_first_user THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'super_admin');
    ELSE
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'staff');
    END IF;

    UPDATE public.clients
    SET invite_code_used_at = now()
    WHERE id = _client_id
      AND invite_code IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Remove plaintext OCR where ciphertext exists (pgcrypto path)
-- ---------------------------------------------------------------------------
UPDATE public.documents
SET ocr_text = NULL
WHERE ocr_text_encrypted IS NOT NULL
  AND ocr_text IS NOT NULL;
