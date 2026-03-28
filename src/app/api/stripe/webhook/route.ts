import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { addCredits } from '@/lib/credits';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const workspaceId = session.metadata?.workspace_id;
    const credits = parseInt(session.metadata?.credits || '0');

    if (workspaceId && credits > 0) {
      try {
        await addCredits(
          workspaceId,
          credits,
          'purchase',
          `Stripe決済: ${credits}クレジット購入`,
          session.id
        );
        console.log(`[Stripe] Added ${credits} credits to workspace ${workspaceId}`);
      } catch (err) {
        console.error('[Stripe] Failed to add credits:', err);
        return NextResponse.json({ error: 'Failed to process' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
