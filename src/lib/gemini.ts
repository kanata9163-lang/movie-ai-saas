import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';

export const genAI = new GoogleGenerativeAI(apiKey);

export function getGenerativeModel(modelName: string = 'gemini-2.5-flash') {
  return genAI.getGenerativeModel({ model: modelName });
}

export function getImageModel() {
  // User requested "nanobanana2" model for image generation
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp-image-generation' });
}

export interface GenerationConfig {
  duration_sec: number;
  panel_count: number;
  with_images: boolean;
  image_style?: string;
  image_aspect?: string;
  text_density?: string;
  dialogue_density?: string;
  negative_prompt?: string;
}

export interface StoryboardGenerateParams {
  title: string;
  brief?: string;
  genre?: string;
  tone?: string;
  target_audience?: string;
  characters?: Record<string, string>;
  setting?: string;
  style_preference?: string;
  config: GenerationConfig;
}

export async function generateStoryboardScenes(params: StoryboardGenerateParams) {
  const model = getGenerativeModel();

  const prompt = `あなたは映像制作の絵コンテ作成の専門家です。以下の情報を基に、${params.config.panel_count}コマの絵コンテを作成してください。

タイトル: ${params.title}
${params.brief ? `概要: ${params.brief}` : ''}
${params.genre ? `ジャンル: ${params.genre}` : ''}
${params.tone ? `トーン: ${params.tone}` : ''}
${params.target_audience ? `ターゲット: ${params.target_audience}` : ''}
${params.setting ? `設定: ${params.setting}` : ''}
${params.style_preference ? `スタイル: ${params.style_preference}` : ''}
${params.config.duration_sec ? `尺: ${params.config.duration_sec}秒` : ''}
${params.config.text_density ? `テキスト密度: ${params.config.text_density}` : ''}
${params.config.dialogue_density ? `セリフ密度: ${params.config.dialogue_density}` : ''}

各コマについて以下のJSON形式で出力してください:
[
  {
    "scene_order": 1,
    "dialogue": "セリフやナレーション",
    "description": "シーンの説明（カメラワーク、アクション等）",
    "image_prompt": "画像生成用の英語プロンプト（シーンを視覚的に描写）"
  }
]

JSONのみ出力してください。`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Parse JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse storyboard scenes from AI response');
  }

  return JSON.parse(jsonMatch[0]) as Array<{
    scene_order: number;
    dialogue: string;
    description: string;
    image_prompt: string;
  }>;
}

export async function generateSceneImage(prompt: string, negativePrompt?: string): Promise<string> {
  // Use Gemini image generation
  const model = getImageModel();

  const fullPrompt = `Generate a storyboard illustration: ${prompt}${negativePrompt ? `. Avoid: ${negativePrompt}` : ''}. Style: professional storyboard sketch, cinematic composition.`;

  const result = await model.generateContent(fullPrompt);
  const response = result.response;

  // Check for inline data (image)
  const parts = response.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const part of parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }

  throw new Error('No image generated');
}
