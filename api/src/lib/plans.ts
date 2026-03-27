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
    price: 499, // cents
    credits: 60,
    description: "60 crédits / mois pour un usage occasionnel",
    stripePriceId: process.env.STRIPE_PRICE_STARTER || null,
  },
  PRO: {
    name: "Pro",
    price: 999,
    credits: 180,
    description: "180 crédits / mois pour un usage régulier",
    stripePriceId: process.env.STRIPE_PRICE_PRO || null,
  },
  BUSINESS: {
    name: "Business",
    price: 1999,
    credits: 600,
    description: "600 crédits / mois pour les usages intensifs",
    stripePriceId: process.env.STRIPE_PRICE_BUSINESS || null,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
export type PaidPlanKey = Exclude<PlanKey, "FREE">;

export const PAID_PLAN_KEYS = ["STARTER", "PRO", "BUSINESS"] as const;

export const TOP_UP_PACKS = {
  BOOST_20: {
    name: "Boost 20",
    price: 399,
    credits: 20,
    description: "Recharge ponctuelle pour terminer le mois",
  },
  BOOST_80: {
    name: "Boost 80",
    price: 1199,
    credits: 80,
    description: "Recharge intermédiaire, moins avantageuse qu'un upgrade",
  },
  BOOST_200: {
    name: "Boost 200",
    price: 2499,
    credits: 200,
    description: "Gros appoint de crédits, pensé pour les pics d'usage",
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
