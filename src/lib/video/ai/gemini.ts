import { CompanyAnalysis, CompanyAnalysisSchema, StoryboardSchema, Storyboard } from './schema';
import { ANALYZE_URL_PROMPT, GENERATE_SCRIPT_PROMPT } from './prompts';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const TEXT_MODEL = 'gemini-2.5-flash';

export interface ReferenceImage {
  data: string; // base64
  mimeType: string;
  imageType: string; // logo, face, product, other
}

export async function analyzeCompanyUrl(url: string): Promise<CompanyAnalysis> {
  let content: string;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VideoHarness/1.0)' },
    });
    const html = await response.text();
    content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000);
  } catch {
    content = `URL: ${url} (コンテンツ取得不可)`;
  }

  const prompt = ANALYZE_URL_PROMPT.replace('{content}', content);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini returned invalid JSON');

  return CompanyAnalysisSchema.parse(JSON.parse(jsonMatch[0]));
}

export async function generateScript(
  analysis: CompanyAnalysis,
  imageDescriptions: string[],
  sceneCount: number,
  referenceImages?: ReferenceImage[],
  knowledgeContext?: string
): Promise<Storyboard> {
  const prompt = GENERATE_SCRIPT_PROMPT
    .replace('{analysis}', JSON.stringify(analysis, null, 2))
    .replace('{imageDescriptions}', imageDescriptions.length > 0 ? imageDescriptions.join('\n') : 'なし')
    .replace('{sceneCount}', String(sceneCount))
    .replace('{knowledgeContext}', knowledgeContext || '');

  const parts: Array<Record<string, unknown>> = [];

  if (referenceImages && referenceImages.length > 0) {
    parts.push({ text: prompt + '\n\n以下の参照画像を考慮して、画像プロンプトにこれらの画像の要素を反映させてください。' });
    for (const img of referenceImages) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      parts.push({ text: `↑ ${img.imageType}画像` });
    }
  } else {
    parts.push({ text: prompt });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts }] }),
    }
  );

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini returned invalid JSON');

  return StoryboardSchema.parse(JSON.parse(jsonMatch[0]));
}
