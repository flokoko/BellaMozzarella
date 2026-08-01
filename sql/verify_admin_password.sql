-- Admin-Passwort-Verifikation mit bcrypt
CREATE OR REPLACE FUNCTION verify_admin_password(
  p_list_id UUID,
  p_password TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  v_admin_password TEXT;
BEGIN
  SELECT admin_password INTO v_admin_password
  FROM lists WHERE id = p_list_id;

  IF v_admin_password IS NULL THEN
    RETURN false;
  END IF;

  -- bcrypt Vergleich
  RETURN v_admin_password = crypt(p_password, v_admin_password);
END;
$$;