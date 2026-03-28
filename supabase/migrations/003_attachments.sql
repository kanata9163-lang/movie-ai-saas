-- File attachments for video projects
CREATE TABLE IF NOT EXISTS video_attachments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_project_id uuid NOT NULL REFERENCES video_projects(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_type_label text NOT NULL,
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE video_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON video_attachments FOR ALL USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_video_attachments_project ON video_attachments(video_project_id);
