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
    credits: 40,
    description: "Pack de 40 demandes traitées",
    stripePriceId: process.env.STRIPE_PRICE_STARTER || null,
  },
  PRO: {
    name: "Pro",
    price: 999,
    credits: 150,
    description: "Pack de 150 demandes traitées",
    stripePriceId: process.env.STRIPE_PRICE_PRO || null,
  },
  BUSINESS: {
    name: "Business",
    price: 1999,
    credits: 500,
    description: "Pack de 500 demandes traitées",
    stripePriceId: process.env.STRIPE_PRICE_BUSINESS || null,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlanConfig(plan: PlanKey) {
  return PLANS[plan];
}
