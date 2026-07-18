-- ═══════════════════════════════════════════════════════════════
-- Bella Mozzarella: Kategorien per Drag-and-Drop sortieren
-- ═══════════════════════════════════════════════════════════════
-- Im Supabase Dashboard → SQL Editor → New Query → dies ausführen
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION batch_reorder_categories(category_data JSONB)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec JSONB;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(category_data) LOOP
    UPDATE categories
    SET sort_order = (rec->>'sort_order')::INT
    WHERE id = (rec->>'id')::UUID;
  END LOOP;
END;
$$;
