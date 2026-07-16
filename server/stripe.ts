/**
 * Sentinel AI — Stripe billing integration
 * Subscription tiers: Free | Pro
 */

import Stripe from "stripe";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export const stripe = new Stripe(ENV.stripeSecretKey, {
  apiVersion: "2026-06-24.dahlia",
});

// ── Product / Price definitions ───────────────────────────────────────────────
// These are looked up by name from Stripe. Create them in the Stripe Dashboard
// or via the seed script below.

export const PLANS = {
  free: {
    name: "Free",
    priceMonthly: 0,
    features: [
      "SENTINEL AI assistant",
      "1 calendar integration",
      "Basic reminders",
      "Weather & news",
    ],
  },
  pro: {
    name: "Pro",
    priceMonthly: 1499, // cents — $14.99/mo
    priceId: ENV.stripePriceIdPro ?? "", // set via STRIPE_PRICE_ID_PRO env var
    features: [
      "Everything in Free",
      "Unlimited calendar integrations",
      "Spotify, GitHub, Slack, Discord",
      "Home Assistant smart home control",
      "Voice commands (TTS/STT)",
      "Morning briefings",
      "Priority support",
    ],
  },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Get or create a Stripe customer for a user. */
export async function getOrCreateCustomer(userId: number, email: string, name?: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [user] = await db.select({ stripeCustomerId: users.stripeCustomerId }).from(users).where(eq(users.id, userId));

  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { userId: String(userId) },
  });

  await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, userId));
  return customer.id;
}

/** Create a Stripe Checkout session for the Pro plan. */
export async function createCheckoutSession(
  userId: number,
  email: string,
  name: string | null | undefined,
  origin: string
): Promise<string> {
  const customerId = await getOrCreateCustomer(userId, email, name ?? undefined);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price: PLANS.pro.priceId,
        quantity: 1,
      },
    ],
    allow_promotion_codes: true,
    client_reference_id: String(userId),
    metadata: {
      user_id: String(userId),
      customer_email: email,
      customer_name: name ?? "",
    },
    success_url: `${origin}/billing?success=1`,
    cancel_url: `${origin}/billing?canceled=1`,
  });

  return session.url!;
}

/** Create a Stripe Customer Portal session so users can manage their subscription. */
export async function createPortalSession(userId: number, origin: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [user] = await db.select({ stripeCustomerId: users.stripeCustomerId }).from(users).where(eq(users.id, userId));

  if (!user?.stripeCustomerId) {
    throw new Error("No Stripe customer found for this user.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${origin}/billing`,
  });

  return session.url;
}

/** Get the current subscription status for a user. */
export async function getSubscriptionStatus(userId: number): Promise<{
  status: string;
  plan: "free" | "pro";
  periodEnd: Date | null;
  customerId: string | null;
}> {
  const db = await getDb();
  if (!db) return { status: "free", plan: "free", periodEnd: null, customerId: null };
  const [user] = await db
    .select({
      stripeCustomerId: users.stripeCustomerId,
      stripeSubscriptionId: users.stripeSubscriptionId,
      subscriptionStatus: users.subscriptionStatus,
      subscriptionPeriodEnd: users.subscriptionPeriodEnd,
    })
    .from(users)
    .where(eq(users.id, userId));

  const status = user?.subscriptionStatus ?? "free";
  const plan: "free" | "pro" = status === "pro" ? "pro" : "free";

  return {
    status,
    plan,
    periodEnd: user?.subscriptionPeriodEnd ?? null,
    customerId: user?.stripeCustomerId ?? null,
  };
}

/** Handle webhook: update user subscription status from Stripe events. */
export async function handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId));

  if (!user) return;

  const isActive = subscription.status === "active" || subscription.status === "trialing";
  // current_period_end lives on the first phase item in the new Stripe API
  const rawPeriodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
  const periodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000) : null;

  await db.update(users).set({
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: isActive ? "pro" : subscription.status === "canceled" ? "canceled" : "free",
    subscriptionPeriodEnd: periodEnd,
  }).where(eq(users.id, user.id));
}

/** Handle webhook: checkout.session.completed — link customer to user. */
export async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const userId = session.metadata?.user_id ? parseInt(session.metadata.user_id) : null;
  if (!userId) return;

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (customerId) {
    await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
  }

  if (session.subscription) {
    const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    const sub = await stripe.subscriptions.retrieve(subId);
    await handleSubscriptionUpdate(sub);
  }
}
