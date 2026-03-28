const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

const VOICES = {
  female: 'hMK7c1GPJmptCzI4bQIu',
  male: '4sirbXwrtRlmPV80MJkQ',
};

export type VoiceStyle = 'elegant' | 'energetic' | 'speedy' | 'brand';

const VOICE_STYLE_SETTINGS: Record<VoiceStyle, { stability: number; similarity_boost: number; style: number; speed?: number }> = {
  elegant: { stability: 0.6, similarity_boost: 0.8, style: 0.3, speed: 0.85 },
  energetic: { stability: 0.3, similarity_boost: 0.85, style: 0.8, speed: 1.15 },
  speedy: { stability: 0.25, similarity_boost: 0.85, style: 0.7, speed: 1.35 },
  brand: { stability: 0.7, similarity_boost: 0.9, style: 0.4, speed: 0.9 },
};

export async function generateNarration(
  text: string,
  gender: 'male' | 'female',
  voiceStyle: VoiceStyle = 'energetic'
): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set');

  const voiceId = VOICES[gender];
  const styleSettings = VOICE_STYLE_SETTINGS[voiceStyle];

  const response = await fetch(
    `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_v3',
        voice_settings: {
          stability: styleSettings.stability,
          similarity_boost: styleSettings.similarity_boost,
          style: styleSettings.style,
          use_speaker_boost: true,
          ...(styleSettings.speed ? { speed: styleSettings.speed } : {}),
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
