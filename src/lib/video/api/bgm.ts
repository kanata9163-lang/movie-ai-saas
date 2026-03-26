import { GoogleGenAI } from '@google/genai';

export async function generateBGM(
  prompt: string,
): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: 'lyria-3-clip-preview',
    contents: prompt,
    config: {
      responseModalities: ['AUDIO', 'TEXT'],
    },
  });

  // Extract audio data from response
  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('No candidates in Lyria response');
  }

  const parts = candidates[0].content?.parts;
  if (!parts) {
    throw new Error('No parts in Lyria response');
  }

  for (const part of parts) {
    if (part.inlineData?.data) {
      // Base64 decode the audio data
      const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
      return audioBuffer;
    }
  }

  throw new Error('No audio data found in Lyria response');
}
