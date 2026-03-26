import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';

export const genAI = new GoogleGenerativeAI(apiKey);

// Nano Banana 2 (gemini-3.1-flash-image-preview) for image generation
const IMAGE_MODEL = 'gemini-3.1-flash-image-preview';

export function getGenerativeModel(modelName: string = 'gemini-2.5-flash') {
  return genAI.getGenerativeModel({ model: modelName });
}

export function getImageModel() {
  return genAI.getGenerativeModel({
    model: IMAGE_MODEL,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    } as Record<string, unknown>,
  });
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
  elements?: string[];
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
${params.config.image_style ? `画像スタイル: ${params.config.image_style}` : ''}
${params.config.image_aspect ? `アスペクト比: ${params.config.image_aspect}` : ''}
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

export interface ReferenceImage {
  mimeType: string;
  data: string; // raw base64 without data:... prefix
}

// Map Japanese style names to detailed English style prompts
function getStylePrompt(imageStyle: string): string {
  const styleMap: Record<string, string> = {
    '漫画': 'Japanese manga style, black and white ink drawing, screentone shading, bold outlines, expressive characters',
    'アニメ': 'Japanese anime illustration style, vibrant colors, cel-shaded, smooth gradients, large expressive eyes',
    'リアル': 'photorealistic style, highly detailed, natural lighting, realistic proportions, lifelike textures, real photograph quality, no anime or cartoon elements',
    'シネマティック': 'cinematic style, dramatic lighting, film-like color grading, wide angle composition, shallow depth of field, movie scene quality',
  };
  return styleMap[imageStyle] || imageStyle || '';
}

export async function generateSceneImage(
  prompt: string,
  negativePrompt?: string,
  aspectRatio?: string,
  referenceImages?: ReferenceImage[],
  imageStyle?: string,
): Promise<string> {
  // Build style-specific prompt
  const styleDesc = getStylePrompt(imageStyle || '');
  const hasRefs = referenceImages && referenceImages.length > 0;

  let fullPrompt = '';
  if (styleDesc) {
    fullPrompt = `Generate an image in ${styleDesc} style. Scene: ${prompt}`;
  } else {
    fullPrompt = `Generate a storyboard illustration: ${prompt}`;
  }

  if (negativePrompt) {
    fullPrompt += `. Do NOT include: ${negativePrompt}`;
  }

  if (hasRefs) {
    fullPrompt += `. IMPORTANT: The reference images provided show the exact characters/objects that must appear in this scene. Match their appearance, clothing, and features precisely.`;
  }

  // Build generationConfig
  const generationConfig: Record<string, unknown> = {
    responseModalities: ['TEXT', 'IMAGE'],
  };

  if (aspectRatio) {
    const cleanRatio = aspectRatio.replace(/（.*）/, '').trim();
    if (['1:1', '16:9', '9:16', '4:3', '3:4'].includes(cleanRatio)) {
      generationConfig.imageConfig = { aspectRatio: cleanRatio };
    }
  }

  const model = genAI.getGenerativeModel({
    model: IMAGE_MODEL,
    generationConfig,
  });

  // Build content parts: reference images first, then text prompt
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  if (hasRefs) {
    for (const ref of referenceImages!) {
      parts.push({
        inlineData: {
          mimeType: ref.mimeType,
          data: ref.data,
        },
      });
    }
  }

  parts.push({ text: fullPrompt });

  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const response = result.response;

  const responseParts = response.candidates?.[0]?.content?.parts;
  if (responseParts) {
    for (const part of responseParts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }

  throw new Error('No image generated');
}
