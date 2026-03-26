import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';

export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const body = await req.json();
  const { type, webhook_url, access_token } = body;

  if (type === 'slack') {
    if (!webhook_url) return errorResponse('missing_url', 'Webhook URL is required', 400);
    try {
      const res = await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '\u2705 Video Harness \u30c6\u30b9\u30c8\u901a\u77e5: \u63a5\u7d9a\u304c\u6b63\u5e38\u306b\u52d5\u4f5c\u3057\u3066\u3044\u307e\u3059\uff01' }),
      });
      if (res.ok) return NextResponse.json({ ok: true });
      const text = await res.text();
      return errorResponse('slack_error', `Slack error: ${text}`, 400);
    } catch (e) {
      return errorResponse('slack_error', `Failed to send: ${e instanceof Error ? e.message : 'Unknown'}`, 500);
    }
  }

  if (type === 'line') {
    if (!access_token) return errorResponse('missing_token', 'Access token is required', 400);
    try {
      const res = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `message=${encodeURIComponent('\u2705 Video Harness \u30c6\u30b9\u30c8\u901a\u77e5: \u63a5\u7d9a\u304c\u6b63\u5e38\u306b\u52d5\u4f5c\u3057\u3066\u3044\u307e\u3059\uff01')}`,
      });
      if (res.ok) return NextResponse.json({ ok: true });
      const text = await res.text();
      return errorResponse('line_error', `LINE error: ${text}`, 400);
    } catch (e) {
      return errorResponse('line_error', `Failed to send: ${e instanceof Error ? e.message : 'Unknown'}`, 500);
    }
  }

  return errorResponse('invalid_type', 'Type must be slack or line', 400);
}
