import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';
import { getCredits } from '@/lib/credits';
import { createServerClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/credit-check';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { workspaceSlug: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const isAdmin = isAdminEmail(auth.userEmail);

  const balance = await getCredits(auth.workspace.id as string);

  // Get recent transactions
  const db = createServerClient();
  const { data: transactions } = await db
    .from('credit_transactions')
    .select('*')
    .eq('workspace_id', auth.workspace.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({
    ok: true,
    data: {
      balance,
      transactions: transactions || [],
      isAdmin,
    },
  });
}
