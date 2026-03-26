import { createServerClient } from '@/lib/supabase/server';

export async function sendSlackNotification(workspaceId: string, message: {
  text: string;
  blocks?: unknown[];
}) {
  try {
    const supabase = createServerClient();
    const { data: integration } = await supabase
      .from('integrations')
      .select('config, enabled')
      .eq('workspace_id', workspaceId)
      .eq('type', 'slack')
      .single();

    if (!integration?.enabled || !integration.config?.webhook_url) return;

    await fetch(integration.config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  } catch {
    // Silently fail - notifications should not block main operations
  }
}
