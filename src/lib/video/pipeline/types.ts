export type PipelineStage =
  | 'pending'
  | 'analyzing'
  | 'scripting'
  | 'script_ready'
  | 'generating_images'
  | 'images_ready'
  | 'generating_video'
  | 'generating_audio'
  | 'composing'
  | 'completed'
  | 'failed';

export const PIPELINE_STAGES: PipelineStage[] = [
  'pending',
  'analyzing',
  'scripting',
  'script_ready',
  'generating_images',
  'images_ready',
  'generating_video',
  'generating_audio',
  'composing',
  'completed',
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  pending: '待機中',
  analyzing: 'URL解析中',
  scripting: '台本作成中',
  script_ready: '台本確認待ち',
  generating_images: '画像生成中',
  images_ready: '画像確認待ち',
  generating_video: '動画生成中',
  generating_audio: 'ナレーション生成中',
  composing: '動画編集中',
  completed: '完了',
  failed: 'エラー',
};
