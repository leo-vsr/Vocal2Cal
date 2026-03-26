import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY manquant");
    }
    stripeInstance = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  }
  return stripeInstance;
}
