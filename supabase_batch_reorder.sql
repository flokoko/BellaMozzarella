CREATE OR REPLACE FUNCTION batch_reorder_items(item_ids UUID[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  i INT;
BEGIN
  FOR i IN 1..array_length(item_ids, 1) LOOP
    UPDATE items SET sort_order = i - 1 WHERE id = item_ids[i];
  END LOOP;
END;
$$;