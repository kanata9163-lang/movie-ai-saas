/**
 * BytePlus ModelArk - Seedance 1.5 Pro (Video Generation)
 * Replaces Runway ML for image-to-video generation
 */

const BYTEPLUS_API_URL = 'https://ark.ap-southeast-1.byteplusapi.com/api/v3/contents/generations/tasks';
const SEEDANCE_ENDPOINT_ID = 'b9c4cc7c-774d-436b-a8ce-a449f0fa6b99';

export async function createVideoFromImage(
  imageUrl: string,
  prompt: string,
  durationSeconds: number = 5,
  aspectRatio: string = '9:16'
): Promise<string> {
  const apiKey = process.env.BYTEPLUS_ARK_API_KEY;
  if (!apiKey) throw new Error('BYTEPLUS_ARK_API_KEY not set');

  // Seedance supports: 16:9, 9:16, 1:1, 4:3, 3:4, 21:9
  const ratioMap: Record<string, string> = {
    '9:16': '9:16',
    '16:9': '16:9',
    '1:1': '1:1',
  };
  const ratio = ratioMap[aspectRatio] || '9:16';

  // Seedance 1.5 supports 2-12 seconds, snap to nearest valid
  const duration = Math.max(2, Math.min(durationSeconds, 12));

  // Build content array for image-to-video
  const content: Array<Record<string, unknown>> = [
    {
      type: 'image_url',
      image_url: {
        url: imageUrl,
      },
    },
  ];

  // Add text prompt if provided
  if (prompt) {
    content.push({
      type: 'text',
      text: prompt.slice(0, 1000),
    });
  }

  const response = await fetch(BYTEPLUS_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SEEDANCE_ENDPOINT_ID,
      content,
      resolution: '720p',
      ratio,
      duration,
      watermark: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`BytePlus Seedance API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return result.id;
}

export async function checkTaskStatus(taskId: string): Promise<{
  status: string;
  outputUrl?: string;
  error?: string;
}> {
  const apiKey = process.env.BYTEPLUS_ARK_API_KEY;
  if (!apiKey) throw new Error('BYTEPLUS_ARK_API_KEY not set');

  const response = await fetch(`${BYTEPLUS_API_URL}/${taskId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`BytePlus task check failed: ${response.status}`);

  const task = await response.json();

  if (task.status === 'succeeded' && task.content?.video_url) {
    return { status: 'SUCCEEDED', outputUrl: task.content.video_url };
  }
  if (task.status === 'failed') {
    return { status: 'FAILED', error: task.error?.message || 'Unknown error' };
  }
  if (task.status === 'cancelled' || task.status === 'expired') {
    return { status: 'FAILED', error: `Task ${task.status}` };
  }

  // queued, running, etc.
  return { status: 'PENDING' };
}
