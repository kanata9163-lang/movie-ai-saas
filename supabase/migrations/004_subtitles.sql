-- Add subtitle fields to video_scenes
ALTER TABLE video_scenes ADD COLUMN IF NOT EXISTS subtitle_text text;
ALTER TABLE video_scenes ADD COLUMN IF NOT EXISTS subtitle_style jsonb DEFAULT '{"fontSize": 36, "fontColor": "#FFFFFF", "bgColor": "rgba(0,0,0,0.7)", "position": "bottom", "fontWeight": "bold"}';
