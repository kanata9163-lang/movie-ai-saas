export interface ReferenceImageData {
  data: string; // base64
  mimeType: string;
}

export async function generateVideoImage(
  prompt: string,
  aspectRatio: string = '9:16',
  referenceImages?: ReferenceImageData[]
): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const model = 'gemini-3.1-flash-image-preview';

  const orientationHint = aspectRatio === '9:16' ? 'vertical (portrait mode for TikTok/Shorts)'
    : aspectRatio === '16:9' ? 'horizontal (landscape mode for YouTube)'
    : 'square (Instagram post)';

  const hasRefs = referenceImages && referenceImages.length > 0;

  const enhancedPrompt = hasRefs
    ? `Based on the attached reference images, generate a high-quality promotional image: ${prompt}.
IMPORTANT: Use the actual product/brand appearance from the reference images.
Style: Modern, clean, professional, suitable for social media video content.
Aspect ratio: ${aspectRatio} ${orientationHint}.
High resolution, vibrant colors, professional lighting.`
    : `Generate a high-quality, professional corporate promotional image: ${prompt}.
Style: Modern, clean, professional, suitable for social media video content.
Aspect ratio: ${aspectRatio} ${orientationHint}.
High resolution, vibrant colors, professional lighting.`;

  const parts: Array<Record<string, unknown>> = [];

  if (hasRefs) {
    for (const ref of referenceImages) {
      parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
    }
  }
  parts.push({ text: enhancedPrompt });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio },
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image generation API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const candidates = result.candidates;
  if (!candidates || candidates.length === 0) throw new Error('No candidates returned');

  const responseParts = candidates[0].content?.parts || [];
  for (const part of responseParts) {
    if (part.inlineData) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }

  throw new Error('No image data in response');
}
