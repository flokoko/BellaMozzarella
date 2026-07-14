-- Block 1: Tabelle
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(list_id, name)
);

-- Block 2: RLS
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants_read_by_code" ON participants;
DROP POLICY IF EXISTS "participants_write_by_code" ON participants;

CREATE POLICY "participants_read_by_code" ON participants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM lists l WHERE l.id = participants.list_id
    AND l.join_code = (current_setting('request.headers', true)::json ->> 'x-join-code'))
  );

CREATE POLICY "participants_write_by_code" ON participants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM lists l WHERE l.id = participants.list_id
    AND l.join_code = (current_setting('request.headers', true)::json ->> 'x-join-code'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM lists l WHERE l.id = participants.list_id
    AND l.join_code = (current_setting('request.headers', true)::json ->> 'x-join-code'))
  );

-- Block 3: Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE participants;

-- Block 4: Verify
SELECT policyname FROM pg_policies WHERE tablename = 'participants';