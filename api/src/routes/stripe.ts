import { Router, Request, Response } from "express";
import type Stripe from "stripe";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { getStripe } from "../lib/stripe";
import {
  PLANS,
  TOP_UP_PACKS,
  type PaidPlanKey,
  type PlanKey,
  type TopUpPackKey,
  isPaidPlanKey,
  isSubscriptionActiveStatus,
  isTopUpPackKey,
} from "../lib/plans";

const router = Router();

function getClientUrl() {
  return process.env.CLIENT_URL || "http://localhost:5173";
}

function getStripeCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function getStripeSubscriptionId(
  subscription: string | Stripe.Subscription | null
) {
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

function getStripePaymentIntentId(
  paymentIntent: string | Stripe.PaymentIntent | null
) {
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

function getSubscriptionCurrentPeriodEnd(subscription: Stripe.Subscription) {
  const currentItem = subscription.items.data[0];
  return currentItem?.current_period_end
    ? new Date(currentItem.current_period_end * 1000)
    : null;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const parent = invoice.parent;
  if (!parent || parent.type !== "subscription_details" || !parent.subscription_details) {
    return null;
  }

  return getStripeSubscriptionId(parent.subscription_details.subscription);
}

async function ensureStripeCustomer(user: {
  id: string;
  email: string | null;
  name: string | null;
  stripeCustomerId: string | null;
}) {
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email || undefined,
    name: user.name || undefined,
    metadata: { userId: user.id },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

function getSubscriptionLineItem(planKey: PaidPlanKey): Stripe.Checkout.SessionCreateParams.LineItem {
  const planConfig = PLANS[planKey];

  if (planConfig.stripePriceId) {
    return {
      price: planConfig.stripePriceId,
      quantity: 1,
    };
  }

  return {
    price_data: {
      currency: "eur",
      recurring: { interval: "month" },
      product_data: {
        name: `Vocal2Cal — ${planConfig.name}`,
        description: planConfig.description,
      },
      unit_amount: planConfig.price,
    },
    quantity: 1,
  };
}

function getTopUpLineItem(packKey: TopUpPackKey): Stripe.Checkout.SessionCreateParams.LineItem {
  const packConfig = TOP_UP_PACKS[packKey];

  return {
    price_data: {
      currency: "eur",
      product_data: {
        name: `Vocal2Cal — ${packConfig.name}`,
        description: `${packConfig.credits} crédits supplémentaires`,
      },
      unit_amount: packConfig.price,
    },
    quantity: 1,
  };
}

async function syncSubscriptionState(params: {
  userId: string;
  subscription: Stripe.Subscription;
  customerId: string | null;
  fallbackPlan?: PaidPlanKey;
}) {
  const { userId, subscription, customerId, fallbackPlan } = params;
  const metadataPlan = subscription.metadata?.plan;
  const plan: PaidPlanKey | undefined = isPaidPlanKey(metadataPlan || "")
    ? (metadataPlan as PaidPlanKey)
    : fallbackPlan;
  const shouldResetPlan =
    subscription.status === "canceled" ||
    subscription.status === "unpaid" ||
    subscription.status === "incomplete_expired";
  const nextPlan: PlanKey | undefined = plan
    ? shouldResetPlan
      ? "FREE"
      : plan
    : shouldResetPlan
      ? "FREE"
      : undefined;

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      stripeSubscriptionId: shouldResetPlan ? null : subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionCurrentPeriodEnd: getSubscriptionCurrentPeriodEnd(subscription),
      ...(nextPlan ? { plan: nextPlan } : {}),
    },
  });
}

async function handleTopUpCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;
  const credits = parseInt(session.metadata?.credits || "0", 10);

  if (!userId || !isPaidPlanKey(plan || "") || credits <= 0) {
    return;
  }
  const planKey = plan as PaidPlanKey;

  const paymentIntentId = getStripePaymentIntentId(session.payment_intent);

  await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.updateMany({
      where: {
        stripeSessionId: session.id,
        status: "pending",
      },
      data: {
        status: "completed",
        stripePaymentId: paymentIntentId,
      },
    });

    if (updatedPayment.count === 0) {
      return;
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        credits: { increment: credits },
        plan: planKey,
      },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        type: "PURCHASE",
        amount: credits,
        balance: updatedUser.credits,
        description: `Recharge ${credits} crédits`,
      },
    });
  });
}

async function handleSubscriptionCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;
  const subscriptionId = getStripeSubscriptionId(session.subscription);
  const customerId = getStripeCustomerId(session.customer);

  if (!userId || !subscriptionId) {
    return;
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const fallbackPlan = isPaidPlanKey(plan || "") ? (plan as PaidPlanKey) : undefined;

  await syncSubscriptionState({
    userId,
    subscription,
    customerId,
    fallbackPlan,
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  const customerId = getStripeCustomerId(invoice.customer);

  if (!subscriptionId) {
    return;
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;
  const plan = subscription.metadata?.plan;
  const credits = parseInt(subscription.metadata?.credits || "0", 10);

  if (!userId || !isPaidPlanKey(plan || "") || credits <= 0) {
    return;
  }
  const planKey = plan as PaidPlanKey;

  await prisma.$transaction(async (tx) => {
    const existingPayment = await tx.payment.findUnique({
      where: { stripeInvoiceId: invoice.id },
      select: { id: true },
    });

    if (existingPayment) {
      return;
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        credits: { increment: credits },
        plan: planKey,
        ...(customerId ? { stripeCustomerId: customerId } : {}),
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        subscriptionCurrentPeriodEnd: getSubscriptionCurrentPeriodEnd(subscription),
      },
    });

    await tx.payment.create({
      data: {
        userId,
        kind: "SUBSCRIPTION",
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subscription.id,
        plan: planKey,
        amount: invoice.amount_paid || invoice.amount_due || PLANS[planKey].price,
        creditsGranted: credits,
        status: "completed",
      },
    });

    const isInitialInvoice = invoice.billing_reason === "subscription_create";

    await tx.creditTransaction.create({
      data: {
        userId,
        type: isInitialInvoice ? "PURCHASE" : "SUBSCRIPTION_RENEWAL",
        amount: credits,
        balance: updatedUser.credits,
        description: `${isInitialInvoice ? "Activation" : "Renouvellement"} ${PLANS[planKey].name} — ${credits} crédits`,
      },
    });
  });
}

async function handleSubscriptionLifecycle(subscription: Stripe.Subscription) {
  const customerId = getStripeCustomerId(subscription.customer);

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: subscription.id },
        ...(customerId ? [{ stripeCustomerId: customerId }] : []),
      ],
    },
    select: { id: true },
  });

  if (!user) {
    return;
  }

  await syncSubscriptionState({
    userId: user.id,
    subscription,
    customerId,
    fallbackPlan: undefined,
  });
}

// POST /api/stripe/checkout — Create a Stripe Checkout Session
router.post("/checkout", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { plan, topUpPack } = req.body as { plan?: string; topUpPack?: string };

  if ((plan && topUpPack) || (!plan && !topUpPack)) {
    res.status(400).json({ error: "Choix de paiement invalide" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        credits: true,
        stripeCustomerId: true,
        subscriptionStatus: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "Utilisateur introuvable" });
      return;
    }

    const customerId = await ensureStripeCustomer(user);
    const stripe = getStripe();
    const clientUrl = getClientUrl();

    if (plan) {
      if (!isPaidPlanKey(plan)) {
        res.status(400).json({ error: "Plan invalide" });
        return;
      }

      if (isSubscriptionActiveStatus(user.subscriptionStatus)) {
        res.status(409).json({ error: "Un abonnement actif existe déjà" });
        return;
      }

      const planConfig = PLANS[plan];
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [getSubscriptionLineItem(plan)],
        metadata: {
          purchaseType: "subscription",
          userId: user.id,
          plan,
          credits: String(planConfig.credits),
        },
        subscription_data: {
          metadata: {
            purchaseType: "subscription",
            userId: user.id,
            plan,
            credits: String(planConfig.credits),
          },
        },
        success_url: `${clientUrl}?payment=success&type=subscription&plan=${plan}`,
        cancel_url: `${clientUrl}?payment=cancel`,
      });

      res.json({ url: session.url });
      return;
    }

    if (!isTopUpPackKey(topUpPack!)) {
      res.status(400).json({ error: "Recharge invalide" });
      return;
    }

    if (!isSubscriptionActiveStatus(user.subscriptionStatus) || user.plan === "FREE") {
      res.status(403).json({ error: "Les recharges sont réservées aux abonnés actifs" });
      return;
    }

    if (user.credits > 0) {
      res.status(409).json({ error: "Les recharges sont disponibles une fois le solde à zéro" });
      return;
    }

    const packConfig = TOP_UP_PACKS[topUpPack];
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [getTopUpLineItem(topUpPack)],
      metadata: {
        purchaseType: "topup",
        userId: user.id,
        plan: user.plan,
        topUpPack,
        credits: String(packConfig.credits),
      },
      success_url: `${clientUrl}?payment=success&type=topup&pack=${topUpPack}`,
      cancel_url: `${clientUrl}?payment=cancel`,
    });

    await prisma.payment.create({
      data: {
        userId: user.id,
        kind: "TOP_UP",
        stripeSessionId: session.id,
        plan: user.plan as PlanKey,
        amount: packConfig.price,
        creditsGranted: packConfig.credits,
        status: "pending",
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur Stripe checkout:", error);
    res.status(500).json({ error: "Impossible de créer la session de paiement" });
  }
});

// POST /api/stripe/portal — Open Stripe Billing Portal
router.post("/portal", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      res.status(404).json({ error: "Aucun compte Stripe lié" });
      return;
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${getClientUrl()}?billing=return`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur Stripe portal:", error);
    res.status(500).json({ error: "Impossible d'ouvrir le portail Stripe" });
  }
});

// POST /api/stripe/webhook — Stripe webhook handler
router.post("/webhook", async (req: Request, res: Response) => {
  const stripe = getStripe();
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET manquant");
    res.status(500).send("Configuration manquante");
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    res.status(400).send("Webhook signature invalide");
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const purchaseType = session.metadata?.purchaseType;

      if (purchaseType === "subscription") {
        await handleSubscriptionCheckoutCompleted(session);
      } else if (purchaseType === "topup") {
        await handleTopUpCheckoutCompleted(session);
      }
    }

    if (event.type === "invoice.paid") {
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await handleSubscriptionLifecycle(event.data.object as Stripe.Subscription);
    }
  } catch (error) {
    console.error("Erreur traitement webhook Stripe:", error);
  }

  res.json({ received: true });
});

// GET /api/stripe/plans — Public pricing info
router.get("/plans", (_req: Request, res: Response) => {
  const subscriptions = Object.entries(PLANS).map(([key, config]) => ({
    id: key,
    name: config.name,
    price: config.price,
    credits: config.credits,
    description: config.description,
  }));

  const topUps = Object.entries(TOP_UP_PACKS).map(([key, config]) => ({
    id: key,
    name: config.name,
    price: config.price,
    credits: config.credits,
    description: config.description,
  }));

  res.json({ subscriptions, topUps });
});

export default router;
