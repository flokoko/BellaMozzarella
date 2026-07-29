-- ═══════════════════════════════════════════════════════════════
-- Bella Mozzarella: Notes Drag-and-Drop Reordering
-- ═══════════════════════════════════════════════════════════════
-- Im Supabase Dashboard → SQL Editor → New Query → dies ausführen
-- ═══════════════════════════════════════════════════════════════

-- 1. sort_order Spalte hinzufügen (mit Default = 0 für bestehende Einträge)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- 2. Bestehende Notizen nach created_at sortieren (älteste zuerst = oben)
UPDATE notes n
SET sort_order = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY list_id ORDER BY created_at ASC) - 1 AS rn
  FROM notes
) sub
WHERE n.id = sub.id;

-- 3. RPC-Funktion für Batch-Reorder
CREATE OR REPLACE FUNCTION batch_reorder_notes(note_ids UUID[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  i INT;
BEGIN
  FOR i IN 1..array_length(note_ids, 1) LOOP
    UPDATE notes SET sort_order = i - 1 WHERE id = note_ids[i];
  END LOOP;
END;
$$;
