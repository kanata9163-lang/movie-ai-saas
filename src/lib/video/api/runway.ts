const RUNWAY_API_URL = 'https://api.dev.runwayml.com/v1';

type RunwayRatio = '1280:720' | '720:1280' | '960:960';

export async function createVideoFromImage(
  imageUrl: string,
  prompt: string,
  durationSeconds: number = 5,
  aspectRatio: string = '9:16'
): Promise<string> {
  const apiKey = process.env.RUNWAYML_API_SECRET;
  if (!apiKey) throw new Error('RUNWAYML_API_SECRET not set');

  const ratioMap: Record<string, RunwayRatio> = {
    '9:16': '720:1280',
    '16:9': '1280:720',
    '1:1': '960:960',
  };
  const ratio = ratioMap[aspectRatio] || '720:1280';
  const duration = durationSeconds <= 5 ? 5 : 10;

  const response = await fetch(`${RUNWAY_API_URL}/image_to_video`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Runway-Version': '2024-11-06',
    },
    body: JSON.stringify({
      model: 'gen4_turbo',
      promptImage: imageUrl,
      promptText: prompt || 'Smooth cinematic motion, professional quality',
      ratio,
      duration,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Runway API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return result.id;
}

export async function checkTaskStatus(taskId: string): Promise<{
  status: string;
  outputUrl?: string;
  error?: string;
}> {
  const apiKey = process.env.RUNWAYML_API_SECRET;
  if (!apiKey) throw new Error('RUNWAYML_API_SECRET not set');

  const response = await fetch(`${RUNWAY_API_URL}/tasks/${taskId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-Runway-Version': '2024-11-06',
    },
  });

  if (!response.ok) throw new Error(`Runway task check failed: ${response.status}`);

  const task = await response.json();

  if (task.status === 'SUCCEEDED' && task.output && task.output.length > 0) {
    return { status: 'SUCCEEDED', outputUrl: task.output[0] };
  }
  if (task.status === 'FAILED') {
    return { status: 'FAILED', error: String(task.failure || 'Unknown error') };
  }
  return { status: task.status || 'PENDING' };
}
