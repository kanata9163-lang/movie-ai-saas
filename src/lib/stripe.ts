import Stripe from 'stripe';

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

// Credit costs per action
// Manusは1クレジット≒$0.01(¥1.5)程度。Vid Harnessは1クレジット=¥1でやや安め。
export const CREDIT_COSTS = {
  IMAGE_GENERATION: 50,       // 画像生成1枚 = 50cr (¥50)
  IMAGE_REGENERATION: 50,     // 画像再生成 = 50cr
  VIDEO_GENERATION: 200,      // 動画生成1シーン = 200cr (¥200)
  NARRATION: 30,              // ナレーション1シーン = 30cr (¥30)
  BGM_GENERATION: 50,         // BGM生成 = 50cr (¥50)
  STORYBOARD_GENERATION: 100, // 絵コンテ生成 = 100cr (¥100)
  URL_ANALYSIS: 50,           // URL解析+台本生成 = 50cr (¥50)
} as const;

// 1 credit = ¥1
export const CREDIT_PRICE_YEN = 1;

// Initial free credits for new users
export const INITIAL_FREE_CREDITS = 1000;
