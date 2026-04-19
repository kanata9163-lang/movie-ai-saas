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

  const creditAmount = parseInt(credits);
  if (!creditAmount || creditAmount < 100 || creditAmount > 100000) {
    return NextResponse.json(
      { ok: false, error: '100〜100,000クレジットの範囲で指定してください' },
      { status: 400 }
    );
  }

  if (!workspaceSlug) {
    return NextResponse.json(
      { ok: false, error: 'workspaceSlug が指定されていません' },
      { status: 400 }
    );
  }

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

  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const normalizeOrigin = (u: string | undefined): string | null => {
    if (!u) return null;
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
      return parsed.origin;
    } catch {
      return null;
    }
  };
  const appUrl = normalizeOrigin(envAppUrl) ?? req.nextUrl.origin;

  const successUrl = `${appUrl}/w/${encodeURIComponent(workspaceSlug)}/settings?payment=success&credits=${creditAmount}`;
  const cancelUrl = `${appUrl}/w/${encodeURIComponent(workspaceSlug)}/settings?payment=cancelled`;

  console.log('Stripe checkout URLs:', { appUrl, successUrl, cancelUrl, envAppUrl, workspaceSlug });

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
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({ ok: true, data: { url: session.url } });
  } catch (err) {
    console.error('Stripe checkout error:', err, { successUrl, cancelUrl, appUrl, envAppUrl });
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { ok: false, error: `Stripe エラー: ${message} (success_url=${successUrl})` },
      { status: 500 }
    );
  }
}
