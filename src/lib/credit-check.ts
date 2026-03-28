import { NextResponse } from 'next/server';
import { hasEnoughCredits, deductCredits } from './credits';
import { CREDIT_COSTS } from './stripe';

/**
 * Check and deduct credits for an action.
 * Returns null if successful, or an error response if insufficient credits.
 */
export async function checkAndDeductCredits(
  workspaceId: string,
  action: keyof typeof CREDIT_COSTS,
  description: string
): Promise<NextResponse | null> {
  const check = await hasEnoughCredits(workspaceId, action);
  if (!check.ok) {
    return NextResponse.json({
      ok: false,
      error: `クレジット不足です（残高: ${check.balance} / 必要: ${check.cost}）`,
      creditError: true,
      balance: check.balance,
      cost: check.cost,
    }, { status: 402 });
  }

  const success = await deductCredits(workspaceId, action, description);
  if (!success) {
    return NextResponse.json({
      ok: false,
      error: 'クレジットの消費に失敗しました',
      creditError: true,
    }, { status: 402 });
  }

  return null; // Success - proceed
}
