-- Run this in your Supabase SQL editor (https://supabase.com/dashboard/project/qmlovitzrupolqitwobv/sql/new)
-- 
-- This RPC verifies the admin password server-side, so the password
-- never leaves the database in plaintext.

create or replace function verify_admin_password(
  p_list_id uuid,
  p_password text
) returns boolean
language plpgsql
security definer
as $$
declare
  v_admin_password text;
begin
  select admin_password into v_admin_password
  from lists
  where id = p_list_id;

  -- If no admin password is set, any password is valid (first-time setup)
  if v_admin_password is null then
    return true;
  end if;

  return v_admin_password = p_password;
end;
$$;
