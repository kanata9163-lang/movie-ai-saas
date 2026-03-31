/**
 * BytePlus ModelArk - Seedance 1.5 Pro (Video Generation)
 * Image-to-video generation via ModelArk Content Generation API
 *
 * API Docs: https://docs.byteplus.com/en/docs/ModelArk/1520757
 * Region: Asia Pacific (ap-southeast)
 */

const BYTEPLUS_API_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks';

// Model name for Seedance 1.5 Pro
const SEEDANCE_MODEL = process.env.BYTEPLUS_SEEDANCE_MODEL || 'seedance-1-5-pro-251215';

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

  // Seedance 1.5 Pro i2v supports 4-12 seconds
  const duration = Math.max(4, Math.min(durationSeconds, 12));

  // Build content array: first_frame image + text prompt
  const content: Array<Record<string, unknown>> = [
    {
      type: 'image_url',
      image_url: {
        url: imageUrl,
      },
      role: 'first_frame',
    },
  ];

  // Add text prompt for motion description
  if (prompt) {
    content.push({
      type: 'text',
      text: prompt.slice(0, 1000),
    });
  }

  const body = {
    model: SEEDANCE_MODEL,
    content,
    resolution: '720p',
    ratio,
    duration,
    watermark: false,
  };

  console.log(`[Seedance] Creating video task: model=${SEEDANCE_MODEL}, ratio=${ratio}, duration=${duration}s`);

  const response = await fetch(BYTEPLUS_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Seedance] API error: ${response.status}`, errorText);
    throw new Error(`BytePlus Seedance API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const taskId = result.id || result.task_id;
  console.log(`[Seedance] Task created: ${taskId}`);
  return taskId;
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

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Seedance] Task check error: ${response.status}`, errorText);
    throw new Error(`BytePlus task check failed: ${response.status}`);
  }

  const task = await response.json();

  // Seedance status values: queued, running, succeeded, failed, expired, cancelled
  if (task.status === 'succeeded') {
    const videoUrl = task.content?.video_url || task.output?.video_url;
    if (videoUrl) {
      return { status: 'SUCCEEDED', outputUrl: videoUrl };
    }
  }
  if (task.status === 'failed') {
    return { status: 'FAILED', error: task.error?.message || task.error?.code || 'Unknown error' };
  }
  if (task.status === 'cancelled' || task.status === 'expired') {
    return { status: 'FAILED', error: `Task ${task.status}` };
  }

  // queued, running
  return { status: 'PENDING' };
}
