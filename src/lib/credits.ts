import { createServerClient } from './supabase/server';
import { CREDIT_COSTS, INITIAL_FREE_CREDITS } from './stripe';

/**
 * Get current credit balance for a workspace
 */
export async function getCredits(workspaceId: string): Promise<number> {
  const db = createServerClient();
  const { data } = await db
    .from('workspace_credits')
    .select('balance')
    .eq('workspace_id', workspaceId)
    .single();

  return data?.balance ?? 0;
}

/**
 * Check if workspace has enough credits for an action
 */
export async function hasEnoughCredits(
  workspaceId: string,
  action: keyof typeof CREDIT_COSTS
): Promise<{ ok: boolean; balance: number; cost: number }> {
  const balance = await getCredits(workspaceId);
  const cost = CREDIT_COSTS[action];
  return { ok: balance >= cost, balance, cost };
}

/**
 * Deduct credits for an action. Returns false if insufficient.
 */
export async function deductCredits(
  workspaceId: string,
  action: keyof typeof CREDIT_COSTS,
  description: string
): Promise<boolean> {
  const db = createServerClient();
  const cost = CREDIT_COSTS[action];
  const balance = await getCredits(workspaceId);

  if (balance < cost) return false;

  const newBalance = balance - cost;

  // Update balance
  await db
    .from('workspace_credits')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId);

  // Record transaction
  await db.from('credit_transactions').insert({
    workspace_id: workspaceId,
    amount: -cost,
    balance_after: newBalance,
    type: 'usage',
    description,
  });

  return true;
}

/**
 * Add credits to a workspace (for purchases or initial grant)
 */
export async function addCredits(
  workspaceId: string,
  amount: number,
  type: 'purchase' | 'initial' | 'bonus',
  description: string,
  stripeSessionId?: string
): Promise<number> {
  const db = createServerClient();
  const currentBalance = await getCredits(workspaceId);
  const newBalance = currentBalance + amount;

  // Upsert workspace credits
  const { error: upsertError } = await db
    .from('workspace_credits')
    .upsert({
      workspace_id: workspaceId,
      balance: newBalance,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id' });

  if (upsertError) {
    console.error('Failed to update credits:', upsertError);
    throw new Error('Failed to add credits');
  }

  // Record transaction
  await db.from('credit_transactions').insert({
    workspace_id: workspaceId,
    amount,
    balance_after: newBalance,
    type,
    description,
    stripe_session_id: stripeSessionId || null,
  });

  return newBalance;
}

/**
 * Initialize credits for a new workspace
 */
export async function initializeCredits(workspaceId: string): Promise<void> {
  const db = createServerClient();

  // Check if already initialized
  const { data: existing } = await db
    .from('workspace_credits')
    .select('id')
    .eq('workspace_id', workspaceId)
    .single();

  if (existing) return; // Already initialized

  await addCredits(
    workspaceId,
    INITIAL_FREE_CREDITS,
    'initial',
    `初回無料クレジット ${INITIAL_FREE_CREDITS}クレジット`
  );
}
