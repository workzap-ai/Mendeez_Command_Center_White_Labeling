// Single Stripe webhook endpoint. Not live-tested in this session — no Stripe account/test keys
// were available — so treat this as a careful first draft, not a verified integration: run it
// against Stripe's CLI (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`) and its
// test-mode events before trusting it in production. Behaviour on each event type:
//   subscription created/updated -> resolve the tenant by stripe_customer_id, resolve the plan by
//     the subscription's price id, update tenants.plan_id, and syncModulesFromPlan() (additions
//     only — see that file's header for why removals are left alone).
//   subscription deleted -> tenants.status = 'cancelled'.
//   invoice.payment_failed -> tenants.status = 'suspended' (the tenant-resolution layer in
//     proxy.ts already knows how to render a suspended tenant — nothing else to wire for this).
import { getStripe } from '@/lib/billing/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncModulesFromPlan } from '@/lib/billing/syncModulesFromPlan';
import type Stripe from 'stripe';

export const runtime = 'nodejs'; // needs the raw body + Node crypto for signature verification

async function tenantIdForCustomer(admin: ReturnType<typeof createAdminClient>, customerId: string) {
  const { data } = await admin.from('tenants').select('id').eq('stripe_customer_id', customerId).maybeSingle();
  return data?.id ?? null;
}

async function planIdForPrice(admin: ReturnType<typeof createAdminClient>, priceId: string | undefined) {
  if (!priceId) return null;
  const { data } = await admin.from('plans').select('id').eq('stripe_price_id', priceId).maybeSingle();
  return data?.id ?? null;
}

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !webhookSecret) return new Response('Missing signature or webhook secret', { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return new Response(`Signature verification failed: ${(err as Error).message}`, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      const tenantId = await tenantIdForCustomer(admin, customerId);
      if (!tenantId) break; // unknown customer — nothing in our DB to update

      const priceId = sub.items.data[0]?.price?.id;
      const planId = await planIdForPrice(admin, priceId);
      if (planId) {
        await admin.from('tenants').update({ plan_id: planId, stripe_subscription_id: sub.id }).eq('id', tenantId);
        await syncModulesFromPlan(tenantId, planId);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      const tenantId = await tenantIdForCustomer(admin, customerId);
      if (tenantId) await admin.from('tenants').update({ status: 'cancelled' }).eq('id', tenantId);
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;
      const tenantId = await tenantIdForCustomer(admin, customerId);
      if (tenantId) await admin.from('tenants').update({ status: 'suspended' }).eq('id', tenantId);
      break;
    }
    default:
      break; // ignore everything else
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
}
