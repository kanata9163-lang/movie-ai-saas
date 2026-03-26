import { createServerClient } from '@/lib/supabase/server';

export async function sendLineNotification(workspaceId: string, message: string) {
  try {
    const supabase = createServerClient();
    const { data: integration } = await supabase
      .from('integrations')
      .select('config, enabled')
      .eq('workspace_id', workspaceId)
      .eq('type', 'line')
      .single();

    if (!integration?.enabled || !integration.config?.access_token) return;

    await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.config.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `message=${encodeURIComponent(message)}`,
    });
  } catch {
    // Silently fail - notifications should not block main operations
  }
}
