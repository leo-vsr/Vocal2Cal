export const PLANS = {
  FREE: {
    name: "Découverte",
    price: 0,
    credits: 5,
    description: "5 crédits offerts pour tester",
    stripePriceId: null,
  },
  STARTER: {
    name: "Starter",
    price: 299, // cents
    credits: 30,
    description: "30 crédits / mois pour un usage occasionnel",
    stripePriceId: process.env.STRIPE_PRICE_STARTER || null,
  },
  PRO: {
    name: "Pro",
    price: 499,
    credits: 75,
    description: "75 crédits / mois pour un usage régulier",
    stripePriceId: process.env.STRIPE_PRICE_PRO || null,
  },
  BUSINESS: {
    name: "Business",
    price: 999,
    credits: 200,
    description: "200 crédits / mois pour les usages intensifs",
    stripePriceId: process.env.STRIPE_PRICE_BUSINESS || null,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
export type PaidPlanKey = Exclude<PlanKey, "FREE">;

export const PAID_PLAN_KEYS = ["STARTER", "PRO", "BUSINESS"] as const;
export const PLAN_TIERS: Record<PlanKey, number> = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
  BUSINESS: 3,
};

export const TOP_UP_PACKS = {
  BOOST_10: {
    name: "Boost 10",
    price: 99,
    credits: 10,
    description: "Petit appoint pour terminer le mois sans changer d'offre",
  },
  BOOST_30: {
    name: "Boost 30",
    price: 299,
    credits: 30,
    description: "Recharge souple, volontairement moins rentable qu'un abonnement",
  },
  BOOST_75: {
    name: "Boost 75",
    price: 699,
    credits: 75,
    description: "Gros appoint ponctuel, utile si vous êtes déjà abonné",
  },
} as const;

export type TopUpPackKey = keyof typeof TOP_UP_PACKS;

export function getPlanConfig(plan: PlanKey) {
  return PLANS[plan];
}

export function isPaidPlanKey(value: string): value is PaidPlanKey {
  return (PAID_PLAN_KEYS as readonly string[]).includes(value);
}

export function isTopUpPackKey(value: string): value is TopUpPackKey {
  return Object.prototype.hasOwnProperty.call(TOP_UP_PACKS, value);
}

export function isSubscriptionActiveStatus(status?: string | null) {
  return status === "active" || status === "trialing";
}

export function isUpgradePlan(currentPlan: PlanKey, targetPlan: PlanKey) {
  return PLAN_TIERS[targetPlan] > PLAN_TIERS[currentPlan];
}

export function getPlanCreditDelta(currentPlan: PlanKey, targetPlan: PlanKey) {
  return Math.max(0, PLANS[targetPlan].credits - PLANS[currentPlan].credits);
}

export function getPaidPlanKeyByStripePriceId(priceId?: string | null): PaidPlanKey | undefined {
  if (!priceId) {
    return undefined;
  }

  return PAID_PLAN_KEYS.find((planKey) => PLANS[planKey].stripePriceId === priceId);
}
