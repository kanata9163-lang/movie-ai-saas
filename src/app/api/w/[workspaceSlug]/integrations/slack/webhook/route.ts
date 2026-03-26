import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabase, getWorkspaceBySlug } from '@/lib/api-helpers';

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';

function verifySlackSignature(
  signature: string | null,
  timestamp: string | null,
  body: string
): boolean {
  if (!SLACK_SIGNING_SECRET || !signature || !timestamp) return false;

  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(sigBasestring)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature)
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const rawBody = await request.text();
  const slackSignature = request.headers.get('x-slack-signature');
  const slackTimestamp = request.headers.get('x-slack-request-timestamp');

  // Verify signature if SLACK_SIGNING_SECRET is set
  if (SLACK_SIGNING_SECRET) {
    if (!verifySlackSignature(slackSignature, slackTimestamp, rawBody)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Handle URL verification challenge
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Handle event callbacks
  if (payload.type === 'event_callback') {
    const event = payload.event as Record<string, unknown>;
    const workspace = await getWorkspaceBySlug(params.workspaceSlug);

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Process message events
    if (event.type === 'message' && !event.subtype) {
      const text = (event.text as string) || '';

      const db = getSupabase();

      // Check for task completion keywords
      if (text.includes('完了') || text.includes('done') || text.includes('finished')) {
        // Try to find a matching task by keyword
        const words = text.split(/\s+/).filter((w: string) => w.length > 2);
        for (const word of words) {
          if (word === '完了' || word === 'done' || word === 'finished') continue;

          const { data: tasks } = await db
            .from('tasks')
            .select('id, project_id, title')
            .ilike('title', `%${word}%`)
            .eq('is_completed', false)
            .limit(1);

          if (tasks && tasks.length > 0) {
            // Verify task belongs to this workspace
            const { data: project } = await db
              .from('projects')
              .select('id')
              .eq('id', tasks[0].project_id)
              .eq('workspace_id', workspace.id)
              .single();

            if (project) {
              await db
                .from('tasks')
                .update({ is_completed: true, updated_at: new Date().toISOString() })
                .eq('id', tasks[0].id);
            }
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
