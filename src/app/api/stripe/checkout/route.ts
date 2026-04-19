import { NextRequest, NextResponse } from 'next/server';
import { getStripe, CREDIT_PRICE_YEN } from '@/lib/stripe';
import { getAuthUser } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { credits, workspaceId, workspaceSlug } = await req.json();

  // Validate
  const creditAmount = parseInt(credits);
  if (!creditAmount || creditAmount < 100 || creditAmount > 100000) {
    return NextResponse.json(
      { ok: false, error: '100〜100,000クレジットの範囲で指定してください' },
      { status: 400 }
    );
  }

  // Verify user is member of workspace
  const db = createServerClient();
  const { data: membership } = await db
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ ok: false, error: 'Not a workspace member' }, { status: 403 });
  }

  const priceInYen = creditAmount * CREDIT_PRICE_YEN;

  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const isValidHttpsUrl = (u: string | undefined): u is string => {
    if (!u) return false;
    try {
      const parsed = new URL(u);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  };
  const appUrl = isValidHttpsUrl(envAppUrl) ? envAppUrl : req.nextUrl.origin;

  if (!workspaceSlug) {
    return NextResponse.json(
      { ok: false, error: 'workspaceSlug が指定されていません' },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            unit_amount: priceInYen,
            product_data: {
              name: `${creditAmount} クレジット`,
              description: `Vid Harness クレジット購入（1クレジット = ¥${CREDIT_PRICE_YEN}）`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        workspace_id: workspaceId,
        user_id: user.id,
        credits: String(creditAmount),
      },
      success_url: `${appUrl}/w/${workspaceSlug}/settings?payment=success&credits=${creditAmount}`,
      cancel_url: `${appUrl}/w/${workspaceSlug}/settings?payment=cancelled`,
    });

    return NextResponse.json({ ok: true, data: { url: session.url } });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: `Stripe エラー: ${message}` }, { status: 500 });
  }
}
