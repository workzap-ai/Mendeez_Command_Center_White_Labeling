// Lazy on purpose: eagerly throwing at module-eval time (the first version of this file did) took
// down the ENTIRE app's build the moment STRIPE_SECRET_KEY was unset — Next.js evaluates every
// route's imports while collecting page data, so one missing billing env var broke pages that
// have nothing to do with billing. getStripe() only throws when something actually calls it (i.e.
// only the webhook route, which is the only caller today), so the rest of the app builds and runs
// fine before Stripe is configured.
import 'server-only';
import Stripe from 'stripe';

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  cached = new Stripe(key);
  return cached;
}
