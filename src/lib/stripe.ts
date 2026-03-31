import Stripe from 'stripe';

// Re-export constants for server-side consumers
export { CREDIT_COSTS, CREDIT_PRICE_YEN, INITIAL_FREE_CREDITS } from './stripe-constants';

// Lazy initialization to avoid build-time errors
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not set');
    _stripe = new Stripe(key, {
      apiVersion: '2026-03-25.dahlia',
    });
  }
  return _stripe;
}
